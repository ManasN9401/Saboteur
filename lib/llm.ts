import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { USE_FALLBACKS } from "./config";
import { FriendlyError } from "./errors";
import { extractJSON } from "./json";
import { mockResponse } from "./mock";

export type Effort = "low" | "medium" | "high";

/** A fully built prompt. `name` and `params` let the mock layer answer without calling the API. */
export interface Prompt<P = unknown> {
  name: string;
  params: P;
  model: string;
  effort: Effort;
  system: string;
  user: string;
  maxTokens?: number;
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

let client: Anthropic | null = null;
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new LLMError("The server has no ANTHROPIC_API_KEY set. Add it to .env.local.", undefined, true);
    client = new Anthropic();
  }
  return client;
}

export const isMock = () => process.env.SABOTEUR_MOCK === "1";

async function complete(prompt: Prompt, user: string): Promise<string> {
  const api = getClient();
  const sonnet = prompt.model.startsWith("claude-sonnet");
  try {
    const response = await api.beta.messages.create({
      model: prompt.model,
      max_tokens: prompt.maxTokens ?? 16000,
      system: prompt.system,
      output_config: { effort: prompt.effort },
      messages: [{ role: "user", content: user }],
      ...(sonnet && USE_FALLBACKS ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    if (response.stop_reason === "refusal") throw new LLMError("The model declined to write this round. Try rephrasing the topic.");
    if (response.stop_reason === "max_tokens") throw new LLMError("The model ran out of room mid-answer. Try a narrower topic.");
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    if (!text.trim()) throw new LLMError("The model returned an empty answer.");
    return text;
  } catch (err) {
    if (err instanceof LLMError) throw err;
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError)
      throw new LLMError("The API key was rejected. Check ANTHROPIC_API_KEY in .env.local.", err, true);
    if (err instanceof Anthropic.RateLimitError) throw new LLMError("Too many requests right now. Wait a few seconds and try again.", err, true);
    if (err instanceof Anthropic.APIConnectionError) throw new LLMError("Couldn't reach the AI service. Check your connection and try again.", err, true);
    if (err instanceof Anthropic.APIError)
      throw new LLMError("The AI service had a problem. Try again in a moment.", err, typeof err.status !== "number" || err.status >= 500);
    throw new LLMError("Couldn't reach the AI service. Check your connection and try again.", err, true);
  }
}

/**
 * Ask Claude for JSON and validate it with Zod. If parsing or validation fails, retry once
 * with the error appended so the model can correct itself.
 */
export async function callJSON<T>(prompt: Prompt, schema: z.ZodType<T>): Promise<T> {
  if (isMock()) {
    const parsed = schema.safeParse(mockResponse(prompt));
    if (!parsed.success) throw new LLMError(`Mock response for ${prompt.name} failed validation.`, parsed.error);
    return parsed.data;
  }

  let user = prompt.user;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await complete(prompt, user);
    try {
      const parsed = schema.safeParse(extractJSON(text));
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    user = `${prompt.user}\n\nYour previous reply could not be used: ${lastError}\nReply again with only the corrected JSON object.`;
  }
  console.error(`[llm] ${prompt.name} returned invalid JSON twice: ${lastError}`);
  throw new LLMError("The AI returned something we couldn't read. Try again.");
}
