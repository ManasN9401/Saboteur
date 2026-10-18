import "server-only";
import type { z } from "zod";
import { MODELS, USE_FALLBACKS } from "./config";
import { FriendlyError } from "./errors";
import { extractJSON } from "./json";
import { mockResponse } from "./mock";
import { newPolicy, router, type Need, type Policy, type Route } from "./router/router";
import { budget } from "./security/limits";
import { callAnthropic, callOpenAI, RouteError, type FailureCategory } from "./router/transport";

export type Effort = "low" | "medium" | "high";

/** A fully built prompt. `name` and `params` let the mock layer answer without calling the API. */
export interface Prompt<P = unknown> {
  name: string;
  params: P;
  /** The Claude model this prompt was written for; the router uses it exactly when Anthropic is set up. */
  model: string;
  effort: Effort;
  system: string;
  user: string;
  maxTokens?: number;
  /** Pictures sent ahead of the text (marked work for the autopsy). Never logged or kept. */
  images?: { mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif"; data: string }[];
}

/**
 * Raised for anything the student should see as "try again". `unavailable` marks failures where the
 * AI can't be used at all right now (no key, bad key, rate limit, outage, no network), so callers can
 * switch to the offline engine instead.
 */
export class LLMError extends FriendlyError {
  constructor(message: string, cause?: unknown, readonly unavailable = false) {
    super(message, cause);
    this.name = "LLMError";
  }
}

export const isMock = () => process.env.SABOTEUR_MOCK === "1";

/** Routes tried per request before giving up. */
const MAX_ROUTES = 6;
/** Failures that say the AI can't be reached right now, rather than that this request is at fault. */
const AVAILABILITY: FailureCategory[] = ["rate_limit", "quota", "auth", "server", "not_found"];

/** Provider error text for the log: short, and with anything that looks like data (an echoed image) cut out. */
const scrub = (s: string) => s.replace(/[A-Za-z0-9+/=_-]{40,}/g, "…").slice(0, 160);

const EFFORT_TIER: Record<Effort, number> = { low: 1, medium: 2, high: 3 };

/** What a prompt needs from a model: generation steps want a strong one, grading a quick one. */
export function needOf(prompt: Prompt): Need {
  const strong = prompt.model === MODELS.generate;
  return {
    task: prompt.name,
    minCapability: strong ? 3 : 1,
    effortTier: EFFORT_TIER[prompt.effort] + (strong ? 1 : 0),
    vision: !!prompt.images?.length,
    preferredModel: prompt.model,
  };
}

/**
 * One reply from the first route that gives one (lib/router). A failure cools what it should (a rate
 * limit the key, a missing model the route) and the next route is tried; the error says why if none work.
 */
async function complete(prompt: Prompt, user: string, policy: Policy): Promise<{ text: string; route: Route }> {
  const r = router();
  const need = needOf(prompt);
  const failures: FailureCategory[] = [];
  for (let attempt = 0; attempt < MAX_ROUTES; attempt++) {
    const route = await r.select(need, policy);
    if (!route) break;
    // The server's daily allowance of AI calls (AI_DAILY_BUDGET): past it, the AI counts as unavailable.
    if (!budget().spend()) {
      r.release(route);
      throw new LLMError("The AI has done all it can for today. Rounds are being built offline until tomorrow.", "daily AI budget spent", true);
    }
    policy.tried.add(route.key);
    try {
      const req = { system: prompt.system, user, maxTokens: prompt.maxTokens ?? 16000, effort: prompt.effort, images: prompt.images };
      const text = route.provider === "anthropic" ? await callAnthropic(route, req, USE_FALLBACKS, r.env) : await callOpenAI(route, req, r.fetchImpl, r.env);
      return { text, route };
    } catch (err) {
      const e = err instanceof RouteError ? err : new RouteError("server", err instanceof Error ? err.message : "unknown error");
      r.failed(route, need.task, e.category, e.message, e.retryAt);
      failures.push(e.category);
      // An unreachable host won't answer on its next model or key either: try another provider.
      if (e.network) policy.avoid.add(route.provider);
      console.warn(`[router] ${prompt.name}: ${route.key} failed (${e.category}${e.status ? ` ${e.status}` : ""}): ${scrub(e.message)}`);
    }
  }
  const why = await r.explain(need, policy);
  if (!failures.length) {
    const none = !r.hasRoutes();
    throw new LLMError(none ? "No AI provider is set up. Add a key to .env.local (see docs/router.md)." : need.vision ? "None of the connected AI models can read pictures right now." : "Every AI model is busy right now. Try again in a minute.", why, true);
  }
  const unavailable = failures.every((f) => AVAILABILITY.includes(f));
  if (failures.includes("refusal") && !unavailable) throw new LLMError("The model declined to write this. Try rephrasing the topic.", why);
  throw new LLMError(unavailable ? "Couldn't reach a working AI model right now. Try again in a minute." : "The AI returned something we couldn't use. Try again.", why, unavailable);
}

/**
 * Ask for JSON and validate it with Zod. If parsing or validation fails, ask again (on another route)
 * with the error appended so the model can correct itself.
 */
export async function callJSON<T>(prompt: Prompt, schema: z.ZodType<T>): Promise<T> {
  if (isMock()) {
    const parsed = schema.safeParse(mockResponse(prompt));
    if (!parsed.success) throw new LLMError(`Mock response for ${prompt.name} failed validation.`, parsed.error);
    return parsed.data;
  }

  const policy = newPolicy();
  let user = prompt.user;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, route } = await complete(prompt, user, policy);
    try {
      const parsed = schema.safeParse(extractJSON(text));
      if (parsed.success) {
        router().succeeded(route, prompt.name);
        return parsed.data;
      }
      lastError = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    router().failed(route, prompt.name, "invalid_output", lastError);
    user = `${prompt.user}\n\nA previous reply could not be used: ${lastError}\nReply again with only the corrected JSON object.`;
  }
  console.error(`[llm] ${prompt.name} returned invalid JSON twice: ${lastError}`);
  throw new LLMError("The AI returned something we couldn't read. Try again.");
}
