import "server-only";
import { callJSON } from "../llm";
import { autopsyDiagnosePrompt } from "../prompts/autopsyDiagnose";
import { targetedQuestionsPrompt } from "../prompts/targetedQuestions";
import { DiagnoseOutputSchema, QuestionsOutputSchema, type DiagnoseOutput, type DiagnoseRequest, type Diagnosis, type QuestionsRequest } from "./schema";

/** Below this the page asks the student the probe question instead of stating the diagnosis. */
export const PROBE_BELOW = 0.6;

/** Keep the model to the rules: one diagnosis per item, slips without an error type, probes only when unsure. */
export function tidy(out: DiagnoseOutput, askedIds: string[] | null): DiagnoseOutput {
  const ids = askedIds ?? (out.items ?? []).map((i) => i.id);
  const seen = new Set<string>();
  const diagnoses = out.diagnoses
    .filter((d) => ids.includes(d.itemId) && !seen.has(d.itemId) && seen.add(d.itemId))
    .map((d): Diagnosis => ({
      ...d,
      errorType: d.kind === "careless_slip" ? null : d.errorType,
      probe: d.confidence < PROBE_BELOW && d.kind === "misconception" ? (d.probe ?? null) : null,
      subject: d.subject.toLowerCase(),
    }));
  return { items: askedIds ? undefined : (out.items ?? []).filter((i) => seen.has(i.id)), diagnoses };
}

export async function diagnose(req: DiagnoseRequest, onProgress: (step: "read" | "examine" | "write", message: string) => void): Promise<DiagnoseOutput> {
  if (req.image) onProgress("read", "Reading your marked work…");
  onProgress("examine", req.items.length ? `Examining ${req.items.length} wrong answer${req.items.length === 1 ? "" : "s"}…` : "Examining the wrong answers…");
  const out = await callJSON(autopsyDiagnosePrompt({ items: req.items, level: req.level, subject: req.subject, image: req.image }), DiagnoseOutputSchema);
  onProgress("write", "Writing up the findings…");
  return tidy(out, req.image ? null : req.items.map((i) => i.id));
}

export async function checkQuestions(req: QuestionsRequest) {
  return callJSON(targetedQuestionsPrompt(req), QuestionsOutputSchema);
}
