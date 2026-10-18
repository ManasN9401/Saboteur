// Which models each provider actually offers right now. Free catalogues come and go, so the router asks
// each provider's /models once an hour: catalogue entries that have vanished are dropped, and for
// providers that allow it, suitable models nobody listed are added with a guessed capability.
import { baseUrlOf, CATALOGUE, type CatalogueModel, type Provider } from "./providers";

export type Fetch = typeof fetch;

const TTL_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 6000;
const cache = new Map<string, { at: number; ids: string[] | null }>();

/** For tests. */
export function clearDiscovery() {
  cache.clear();
}

// Not chat models: embeddings, speech, moderation, image generation and the like.
const NOT_CHAT = /embed|whisper|tts|speech|audio|transcri|guard|rerank|moderation|dall-?e|imagen|image-gen|flux|stable-diffusion|sdxl|clip|bge|nomic|e5-|search|realtime|veo|lyria|aqa/i;

/** A model's capability (1–5), from its family and size, for models the catalogue doesn't know. */
export function guessModel(provider: Provider["id"], id: string): CatalogueModel | null {
  if (NOT_CHAT.test(id)) return null;
  const name = id.toLowerCase();
  let capability = 2;
  const size = name.match(/(\d+(?:\.\d+)?)b\b/);
  if (size) {
    const b = Number(size[1]);
    capability = b >= 200 ? 4 : b >= 60 ? 3 : b >= 20 ? 3 : b >= 7 ? 2 : 1;
  }
  if (/deepseek-(?:v3|r1|chat)|qwen3-235b|qwen3-coder|gpt-oss-120b|kimi-k2|glm-4\.5|llama-4-maverick|gemini-[\d.]+-flash(?!-lite)|grok-[34]|mistral-large/.test(name)) capability = Math.max(capability, 4);
  if (/gemini-[\d.]+-pro|claude-(?:sonnet|opus)|gpt-[45]\b|gpt-4o(?!-mini)|o[34](?:-|$)/.test(name)) capability = 5;
  const vision = /vision|[-_/]vl\b|-vl-|gemini|llama-4|pixtral|gemma-3|gpt-4o|claude/.test(name);
  const thinks = /\br1\b|-r1|qwq|thinking|reason/.test(name);
  return { provider, id, capability, vision, cost: name.endsWith(":free") ? 0 : 1, thinks };
}

async function listModels(p: Provider, keyEnv: string, fetchImpl: Fetch, env: Record<string, string | undefined>): Promise<string[] | null> {
  const key = env[keyEnv]?.trim();
  if (!key || p.kind !== "openai") return null;
  const hit = cache.get(`${p.id}@${keyEnv}`);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ids;
  let ids: string[] | null = null;
  try {
    const res = await fetchImpl(`${baseUrlOf(p, env)}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.ok) {
      const body = (await res.json()) as { data?: { id?: string }[]; models?: { id?: string; name?: string }[] };
      const list = body.data ?? body.models ?? [];
      ids = list.map((m) => String((m as { id?: string }).id ?? (m as { name?: string }).name ?? "").replace(/^models\//, "")).filter(Boolean);
    }
  } catch {
    ids = null; // unreachable: fall back to the catalogue, and try again next hour
  }
  cache.set(`${p.id}@${keyEnv}`, { at: Date.now(), ids });
  return ids;
}

/**
 * The models to route to for one provider key: the catalogue's (only those the provider lists, when it
 * can list them), plus guessed ones where the provider's policy allows.
 */
export async function modelsFor(p: Provider, keyEnv: string, fetchImpl: Fetch = fetch, env: Record<string, string | undefined> = process.env): Promise<CatalogueModel[]> {
  const known = CATALOGUE.filter((m) => m.provider === p.id);
  const ids = await listModels(p, keyEnv, fetchImpl, env);
  if (!ids) return known;
  const listed = new Set(ids);
  const kept = known.filter((m) => listed.has(m.id));
  if (p.discover === "catalogue-only") return kept.length ? kept : known;
  const extra = ids
    .filter((id) => !known.some((m) => m.id === id))
    .filter((id) => p.discover === "any" || id.endsWith(":free"))
    .map((id) => guessModel(p.id, id))
    .filter((m): m is CatalogueModel => !!m);
  return [...kept, ...extra];
}
