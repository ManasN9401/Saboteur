import { z } from "zod";
import { saveRound } from "@/lib/roundStore.server";
import { PlantedErrorSchema, RoundSchema } from "@/lib/schemas";
import { guard, MAX_BODY, readJson } from "@/lib/security/guard";
import { newId } from "@/lib/text";

const ReplaySchema = z.object({ round: RoundSchema, errors: z.array(PlantedErrorSchema).min(1).max(6) });

/**
 * "Replay this case" (QoL Q4): the same sentences with the errors hidden again, for revision. The
 * browser already holds the revealed errors, so it sends them back; replays are never scored, so
 * there is nothing to gain by tampering.
 */
export async function POST(request: Request) {
  const pass = guard(request, "replay");
  if (pass instanceof Response) return pass;
  const body = await readJson(request, MAX_BODY.replay);
  if ("response" in body) return body.response;
  const parsed = ReplaySchema.safeParse(body.data);
  if (!parsed.success) return Response.json({ error: "That case couldn't be replayed." }, { status: 400 });
  const { round, errors } = parsed.data;
  const ids = new Set(round.sentences.map((s) => s.id));
  if (!errors.every((e) => ids.has(e.sentenceId))) return Response.json({ error: "That case couldn't be replayed." }, { status: 400 });
  const replay = { ...round, id: newId("rpl"), createdAt: new Date().toISOString() };
  saveRound(replay, errors);
  return Response.json({ round: replay });
}
