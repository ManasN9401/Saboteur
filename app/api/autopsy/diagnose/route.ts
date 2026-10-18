import { diagnose } from "@/lib/autopsy/diagnose";
import { DiagnoseRequestSchema, type AutopsyEvent } from "@/lib/autopsy/schema";
import { engineMode } from "@/lib/engine";
import { FriendlyError } from "@/lib/errors";
import { LLMError } from "@/lib/llm";
import { guard, MAX_BODY, readJson } from "@/lib/security/guard";

export const maxDuration = 120;

const OFFLINE = "Diagnosing wrong answers needs the AI, and it isn't connected right now. You can still log what you got wrong yourself.";

/**
 * The Wrong Answer Autopsy (V07-02). Streams progress as NDJSON. Privacy: the request (including any
 * picture of marked work) is read once and dropped. Nothing from it is stored or logged here.
 */
export async function POST(request: Request) {
  const pass = guard(request, "diagnose");
  if (pass instanceof Response) return pass;
  const body = await readJson(request, MAX_BODY.image);
  if ("response" in body) {
    pass.done();
    return body.response;
  }
  const parsed = DiagnoseRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    pass.done();
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Those answers couldn't be read." }, { status: 400 });
  }
  const req = parsed.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AutopsyEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        if (engineMode().engine === "offline") send({ type: "offline", message: OFFLINE });
        else send({ type: "done", result: await diagnose(req, (step, message) => send({ type: "progress", step, message })) });
      } catch (err) {
        // Log what went wrong, never what was sent.
        console.error("[autopsy]", err instanceof Error ? err.message : "unknown error");
        if (err instanceof LLMError && err.unavailable) send({ type: "offline", message: OFFLINE });
        else send({ type: "error", message: err instanceof FriendlyError ? err.message : "The examination failed. Try again." });
      } finally {
        pass.done();
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
