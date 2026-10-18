import { EFFORT, MODELS } from "../config";
import type { Prompt } from "../llm";

export interface LabelRef {
  key: string;
  label: string;
  errorType: string;
}

export interface NormaliseParams {
  /** Labels not yet checked. */
  fresh: LabelRef[];
  /** Labels already on file, which a fresh one may duplicate. */
  known: LabelRef[];
}

/** Maps new misconception labels onto ones already on file when they name the same wrong belief (V06-02). */
export function normaliseLabelsPrompt(params: NormaliseParams): Prompt<NormaliseParams> {
  const { fresh, known } = params;
  return {
    name: "normaliseLabels",
    params,
    model: MODELS.grade,
    effort: EFFORT.grade,
    maxTokens: 4000,
    system: `You keep a student's list of misconceptions tidy. Each misconception is a short label naming a wrong belief, with a key.

For each NEW label, decide whether it names the same wrong belief as one of the KNOWN labels or another NEW label listed before it. Same belief means a teacher would correct both with the same explanation (for example "photosynthesis happens in the mitochondria" and "plants make sugar in their mitochondria"). Labels on the same topic that are different mistakes are NOT the same (for example "the Calvin cycle needs light directly" and "oxygen comes from carbon dioxide").

When unsure, answer null. Merging two different misconceptions is worse than leaving a duplicate.

Return JSON only, in exactly this shape:
{ "matches": [{ "key": "<new key>", "sameAs": "<key it duplicates, or null>" }] }`,
    user: [
      "KNOWN:",
      known.length ? known.map((l) => `${l.key} | ${l.errorType} | ${l.label}`).join("\n") : "(none)",
      "",
      "NEW:",
      fresh.map((l) => `${l.key} | ${l.errorType} | ${l.label}`).join("\n"),
    ].join("\n"),
  };
}
