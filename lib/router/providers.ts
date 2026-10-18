// The providers the router can use, the env vars their keys live in, and a starting catalogue of models.
// Every provider except Anthropic speaks the OpenAI chat-completions dialect. Each key variable may have
// numbered siblings (GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3): every set one becomes its own
// route, with its own rate limits and health.

export type ProviderId = "anthropic" | "openrouter" | "groq" | "gemini" | "nvidia" | "cohere" | "llm7" | "kilo";

export interface Provider {
  id: ProviderId;
  name: string;
  kind: "anthropic" | "openai";
  /** OpenAI-compatible base URL (…/v1), overridable with <PREFIX>_BASE_URL. */
  baseUrl: string;
  /** Key variables: the base name, then _2, _3. */
  keyEnv: string;
  /** Models that aren't in the catalogue are only used if this provider lists them and they pass the filter. */
  discover: "catalogue-only" | "free-only" | "any";
}

export const PROVIDERS: Provider[] = [
  { id: "anthropic", name: "Anthropic", kind: "anthropic", baseUrl: "", keyEnv: "ANTHROPIC_API_KEY", discover: "catalogue-only" },
  { id: "openrouter", name: "OpenRouter", kind: "openai", baseUrl: "https://openrouter.ai/api/v1", keyEnv: "OPENROUTER_API_KEY", discover: "free-only" },
  { id: "groq", name: "Groq", kind: "openai", baseUrl: "https://api.groq.com/openai/v1", keyEnv: "GROQ_API_KEY", discover: "catalogue-only" },
  { id: "gemini", name: "Gemini", kind: "openai", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", keyEnv: "GEMINI_API_KEY", discover: "catalogue-only" },
  { id: "nvidia", name: "NVIDIA", kind: "openai", baseUrl: "https://integrate.api.nvidia.com/v1", keyEnv: "NVIDIA_API_KEY", discover: "catalogue-only" },
  { id: "cohere", name: "Cohere", kind: "openai", baseUrl: "https://api.cohere.ai/compatibility/v1", keyEnv: "COHERE_API_KEY", discover: "catalogue-only" },
  { id: "llm7", name: "LLM7", kind: "openai", baseUrl: "https://api.llm7.io/v1", keyEnv: "LLM7_API_KEY", discover: "any" },
  { id: "kilo", name: "Kilo", kind: "openai", baseUrl: "https://api.kilo.ai/api/openrouter", keyEnv: "KILO_API_KEY", discover: "free-only" },
];

export const PROVIDER_BY_ID = Object.fromEntries(PROVIDERS.map((p) => [p.id, p])) as Record<ProviderId, Provider>;

export interface CatalogueModel {
  provider: ProviderId;
  id: string;
  /** 1 (small, fast) to 5 (frontier). Strong tasks (writing, planting, verifying, diagnosing) need 3+. */
  capability: number;
  vision?: boolean;
  /** Relative price: 0 free, 1 cheap, 3 dear. Breaks ties after capability. */
  cost: number;
  /** Replies open with <think>…</think>, stripped before parsing. */
  thinks?: boolean;
}

/**
 * Known-good starting points. Free catalogues change often, so where a provider can list its models the
 * router only keeps the ones it actually offers (lib/router/discovery.ts), and adds suitable new ones.
 * Add or override routes with SABOTEUR_ROUTES (see docs/router.md).
 */
export const CATALOGUE: CatalogueModel[] = [
  { provider: "anthropic", id: "claude-sonnet-5-5", capability: 5, vision: true, cost: 3 },
  { provider: "anthropic", id: "claude-haiku-5-5", capability: 3, vision: true, cost: 1 },

  { provider: "gemini", id: "gemini-2.5-pro", capability: 5, vision: true, cost: 0 },
  { provider: "gemini", id: "gemini-2.5-flash", capability: 4, vision: true, cost: 0 },
  { provider: "gemini", id: "gemini-2.5-flash-lite", capability: 2, vision: true, cost: 0 },
  { provider: "gemini", id: "gemini-2.0-flash", capability: 3, vision: true, cost: 0 },

  { provider: "groq", id: "openai/gpt-oss-120b", capability: 4, cost: 0 },
  { provider: "groq", id: "moonshotai/kimi-k2-instruct", capability: 4, cost: 0 },
  { provider: "groq", id: "llama-3.3-70b-versatile", capability: 3, cost: 0 },
  { provider: "groq", id: "meta-llama/llama-4-scout-17b-16e-instruct", capability: 3, vision: true, cost: 0 },
  { provider: "groq", id: "llama-3.1-8b-instant", capability: 1, cost: 0 },

  { provider: "openrouter", id: "deepseek/deepseek-chat-v3-0324:free", capability: 4, cost: 0 },
  { provider: "openrouter", id: "meta-llama/llama-3.3-70b-instruct:free", capability: 3, cost: 0 },
  { provider: "openrouter", id: "qwen/qwen-2.5-72b-instruct:free", capability: 3, cost: 0 },
  { provider: "openrouter", id: "google/gemini-2.0-flash-exp:free", capability: 3, vision: true, cost: 0 },

  { provider: "nvidia", id: "deepseek-ai/deepseek-r1", capability: 4, cost: 0, thinks: true },
  { provider: "nvidia", id: "meta/llama-3.3-70b-instruct", capability: 3, cost: 0 },
  { provider: "nvidia", id: "meta/llama-3.2-90b-vision-instruct", capability: 3, vision: true, cost: 0 },

  { provider: "cohere", id: "command-a-03-2025", capability: 4, cost: 1 },
  { provider: "cohere", id: "command-r-plus-08-2024", capability: 3, cost: 1 },
];

/** Every key variable for a provider that is actually set: KEY, KEY_2, KEY_3 (and on, up to _9). */
export function keyVariants(keyEnv: string, env: Record<string, string | undefined> = process.env): string[] {
  return [keyEnv, ...Array.from({ length: 8 }, (_, i) => `${keyEnv}_${i + 2}`)].filter((k) => env[k]?.trim());
}

export function baseUrlOf(p: Provider, env: Record<string, string | undefined> = process.env): string {
  const prefix = p.keyEnv.replace(/_API_KEY$/, "");
  return (env[`${prefix}_BASE_URL`] || p.baseUrl).replace(/\/+$/, "");
}
