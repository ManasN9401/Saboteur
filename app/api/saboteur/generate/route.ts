import { buildRound } from "@/lib/engine";
import { FriendlyError } from "@/lib/errors";
import { saveRound } from "@/lib/roundStore.server";
import { GenerateRequestSchema, type GenerateEvent } from "@/lib/schemas";
import { guard, MAX_BODY, readJson } from "@/lib/security/guard";

export const maxDuration = 300;

/**
 * Streams newline-delimited JSON so the loading screen can follow the real pipeline steps.
 * The final event carries the round without its planted errors; those stay on the server.
 */
export async function POST(request: Request) {
  const pass = guard(request, "generate");
  if (pass instanceof Response) return pass;
  const body = await readJson(request, MAX_BODY.medium);
  if ("response" in body) {
    pass.done();
    return body.response;
  }
  const parsed = GenerateRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    pass.done();
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Check the topic, level and difficulty." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: GenerateEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        const { round, errors } = await buildRound(parsed.data, (step, attempt, message) => send({ type: "progress", step, attempt, message }));
        saveRound(round, errors);
        send({ type: "done", round });
      } catch (err) {
        console.error("[generate]", err);
        send({ type: "error", message: err instanceof FriendlyError ? err.message : "Something went wrong building the round. Try again." });
      } finally {
        pass.done();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
