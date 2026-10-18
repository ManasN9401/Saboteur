import { z } from "zod";
import { engineMode } from "@/lib/engine";
import { callJSON } from "@/lib/llm";
import { normaliseLabelsPrompt } from "@/lib/prompts/normaliseLabels";
import { guard, MAX_BODY, readJson } from "@/lib/security/guard";

export const maxDuration = 60;

const Ref = z.object({ key: z.string().min(1).max(80), label: z.string().min(1).max(200), errorType: z.string().max(40) });
const BodySchema = z.object({ fresh: z.array(Ref).min(1).max(12), known: z.array(Ref).max(80) });
const OutputSchema = z.object({ matches: z.array(z.object({ key: z.string(), sameAs: z.string().nullable() })) });

/**
 * Which new misconception labels duplicate ones already on file. Offline, or if the AI fails, every
 * label stands alone (the key's own folding still merges the obvious variants).
 */
export async function POST(request: Request) {
  const pass = guard(request, "normalise");
  if (pass instanceof Response) return pass;
  const body = await readJson(request, MAX_BODY.medium);
  if ("response" in body) return body.response;
  const parsed = BodySchema.safeParse(body.data);
  if (!parsed.success) return Response.json({ error: "Those labels couldn't be read." }, { status: 400 });
  const { fresh, known } = parsed.data;
  const alone = { matches: fresh.map((l) => ({ key: l.key, sameAs: null })), engine: "offline" as const };
  if (engineMode().engine === "offline") return Response.json(alone);
  try {
    const out = await callJSON(normaliseLabelsPrompt({ fresh, known }), OutputSchema);
    // Only answers about labels we asked about, pointing at keys we know (or an earlier new one).
    const allowed = new Set([...known.map((l) => l.key), ...fresh.map((l) => l.key)]);
    const matches = fresh.map((l) => {
      const m = out.matches.find((x) => x.key === l.key);
      return { key: l.key, sameAs: m?.sameAs && m.sameAs !== l.key && allowed.has(m.sameAs) ? m.sameAs : null };
    });
    return Response.json({ matches, engine: "llm" });
  } catch (err) {
    console.warn("[normalise]", err);
    return Response.json(alone);
  }
}
