// One request to one route, and what went wrong if it failed. The category decides how the router
// reacts (lib/router/router.ts): a rate limit cools the key, a bad key takes it out, a missing model
// takes that route out, a server hiccup just moves on.
import Anthropic from "@anthropic-ai/sdk";
import type { Fetch } from "./discovery";
import { baseUrlOf, PROVIDER_BY_ID } from "./providers";
import type { Route } from "./router";

export type FailureCategory =
  | "rate_limit" // 429: slow down on this key
  | "quota" // out of credit or daily allowance: this key, for a while
  | "auth" // key rejected: this key, until it's changed
  | "not_found" // the model isn't served (any more): this route, for hours
  | "bad_request" // this route can't take this request (too long, no images…)
  | "server" // 5xx, network, timeout: try elsewhere, come back soon
  | "invalid_output" // answered, but not with usable JSON
  | "refusal"; // the model declined

export class RouteError extends Error {
  constructor(
    readonly category: FailureCategory,
    message: string,
    readonly status?: number,
    /** When the provider says to try again (Retry-After, or a quota reset). */
    readonly retryAt?: number,
    /** The provider's host couldn't be reached at all: its other routes won't fare better just now. */
    readonly network = false,
  ) {
    super(message);
    this.name = "RouteError";
  }
}

export interface Request {
  system: string;
  user: string;
  maxTokens: number;
  effort: "low" | "medium" | "high";
  images?: { mediaType: string; data: string }[];
}

const TIMEOUT_MS = 120_000;
/** Most free OpenAI-compatible endpoints cap replies well below Claude's limit. */
const OPENAI_MAX_TOKENS = 8192;

function retryAfter(res: Response): number | undefined {
  const h = res.headers.get("retry-after");
  if (!h) return undefined;
  const s = Number(h);
  if (!Number.isNaN(s)) return Date.now() + s * 1000;
  const at = Date.parse(h);
  return Number.isNaN(at) ? undefined : at;
}

/** Sort an HTTP failure into a category from its status and message. */
export function classify(status: number, message: string): FailureCategory {
  const m = message.toLowerCase();
  if (status === 401 || status === 403) return /quota|billing|credit|balance|payment/.test(m) ? "quota" : "auth";
  if (status === 402) return "quota";
  if (status === 429) return /quota|per day|daily|credits|exceeded your|insufficient|limit reached for the day|free-models-per-day/.test(m) ? "quota" : "rate_limit";
  if (status === 404 || /model[^.]*(not found|does not exist|decommissioned|deprecated|no longer|not supported)|no endpoints found|unknown model|invalid model/.test(m)) return "not_found";
  if (status === 400 || status === 413 || status === 422) return "bad_request";
  return "server";
}

/** Remove a reasoning model's <think>…</think> preamble. */
export const stripThinking = (text: string) => text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

export async function callOpenAI(route: Route, req: Request, fetchImpl: Fetch = fetch, env: Record<string, string | undefined> = process.env): Promise<string> {
  const provider = PROVIDER_BY_ID[route.provider];
  const content = req.images?.length
    ? [...req.images.map((i) => ({ type: "image_url", image_url: { url: `data:${i.mediaType};base64,${i.data}` } })), { type: "text", text: req.user }]
    : req.user;
  const headers: Record<string, string> = { Authorization: `Bearer ${env[route.keyEnv] ?? ""}`, "Content-Type": "application/json" };
  if (route.provider === "openrouter" || route.provider === "kilo") {
    headers["HTTP-Referer"] = "https://saboteur.app";
    headers["X-Title"] = "Saboteur";
  }
  let res: Response;
  try {
    res = await fetchImpl(`${baseUrlOf(provider, env)}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: route.model,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content },
        ],
        max_tokens: Math.min(req.maxTokens, OPENAI_MAX_TOKENS),
        temperature: req.effort === "low" ? 0.2 : 0.5,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new RouteError("server", timedOut ? "timed out" : "couldn't reach the provider", undefined, undefined, !timedOut);
  }
  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string } | string;
    message?: string;
    choices?: { message?: { content?: string | { type?: string; text?: string }[]; refusal?: string | null }; finish_reason?: string }[];
  } | null;
  const errMessage = typeof body?.error === "string" ? body.error : (body?.error?.message ?? body?.message ?? "");
  if (!res.ok) throw new RouteError(classify(res.status, errMessage), errMessage || `HTTP ${res.status}`, res.status, retryAfter(res));
  // Some gateways report an upstream failure inside a 200.
  if (body?.error) throw new RouteError(classify(0, errMessage), errMessage || "provider error");
  const choice = body?.choices?.[0];
  if (choice?.message?.refusal) throw new RouteError("refusal", choice.message.refusal);
  const raw = choice?.message?.content;
  const text = Array.isArray(raw) ? raw.map((p) => p.text ?? "").join("") : (raw ?? "");
  if (choice?.finish_reason === "length") throw new RouteError("bad_request", "the reply was cut off (too long for this model)");
  const out = route.thinks ? stripThinking(text) : text.trim();
  if (!out) throw new RouteError("invalid_output", "empty reply");
  return out;
}

let anthropic: { key: string; client: Anthropic } | null = null;

export async function callAnthropic(route: Route, req: Request, fallbacks: boolean, env: Record<string, string | undefined> = process.env): Promise<string> {
  const key = env[route.keyEnv] ?? "";
  if (!anthropic || anthropic.key !== key) anthropic = { key, client: new Anthropic({ apiKey: key }) };
  const sonnet = route.model.startsWith("claude-sonnet");
  try {
    const response = await anthropic.client.beta.messages.create({
      model: route.model,
      max_tokens: req.maxTokens,
      system: req.system,
      output_config: { effort: req.effort },
      messages: [
        {
          role: "user",
          content: req.images?.length
            ? [
                ...req.images.map((i) => ({ type: "image" as const, source: { type: "base64" as const, media_type: i.mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: i.data } })),
                { type: "text" as const, text: req.user },
              ]
            : req.user,
        },
      ],
      ...(sonnet && fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    if (response.stop_reason === "refusal") throw new RouteError("refusal", "the model declined");
    if (response.stop_reason === "max_tokens") throw new RouteError("bad_request", "the reply was cut off");
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    if (!text.trim()) throw new RouteError("invalid_output", "empty reply");
    return text;
  } catch (err) {
    if (err instanceof RouteError) throw err;
    if (err instanceof Anthropic.APIError && typeof err.status === "number") throw new RouteError(classify(err.status, err.message), err.message, err.status);
    throw new RouteError("server", "couldn't reach the provider", undefined, undefined, true);
  }
}
