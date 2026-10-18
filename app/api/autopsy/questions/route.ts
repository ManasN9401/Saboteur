import { checkQuestions } from "@/lib/autopsy/diagnose";
import { QuestionsRequestSchema } from "@/lib/autopsy/schema";
import { engineMode } from "@/lib/engine";
import { FriendlyError } from "@/lib/errors";
import { LLMError } from "@/lib/llm";
import { guard, MAX_BODY, readJson } from "@/lib/security/guard";

export const maxDuration = 60;

/** Two or three check questions aimed at one confirmed misconception (V07-05). */
export async function POST(request: Request) {
  const pass = guard(request, "questions");
  if (pass instanceof Response) return pass;
  const body = await readJson(request, MAX_BODY.small);
  if ("response" in body) return body.response;
  const parsed = QuestionsRequestSchema.safeParse(body.data);
  if (!parsed.success) return Response.json({ error: "That misconception couldn't be read." }, { status: 400 });
  if (engineMode().engine === "offline") return Response.json({ offline: true, error: "Check questions need the AI, and it isn't connected." }, { status: 503 });
  try {
    return Response.json(await checkQuestions(parsed.data));
  } catch (err) {
    console.error("[autopsy questions]", err instanceof Error ? err.message : "unknown error");
    const offline = err instanceof LLMError && err.unavailable;
    return Response.json({ offline, error: err instanceof FriendlyError ? err.message : "The check questions couldn't be written. Try again." }, { status: offline ? 503 : 502 });
  }
}
