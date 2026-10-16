import { EFFORT, MODELS } from "../config";
import type { Prompt } from "../llm";
import type { Difficulty, Sentence } from "../schemas";

export interface VerifyParams {
  /** The passage exactly as the student will see it (sabotaged sentences included). */
  sentences: Sentence[];
  planted: { sentenceId: string; explanation: string }[];
  level: string;
  difficulty: Difficulty;
}

export function verifyPrompt(params: VerifyParams): Prompt<VerifyParams> {
  const { sentences, planted, level, difficulty } = params;
  return {
    name: "verify",
    params,
    model: MODELS.generate,
    effort: EFFORT.verify,
    system: `You are a strict fact-checker for an educational game. Below is a passage (as numbered sentences) for a student at level "${level}", and a list of sentences that were deliberately made wrong at "${difficulty}" difficulty. Check:
1. Is each listed sentence actually and unambiguously wrong at this level? (If it's arguably correct, mark it invalid.)
2. Are ALL the other sentences correct? List any sentence that contains an error, oversimplification that would be marked wrong in an exam, or ambiguity.
3. Is any planted error so obvious it can be spotted without subject knowledge (from grammar, style, hedging or an absurd claim)?

Return JSON only, in exactly this shape:
{ "plantedChecks": [{ "sentenceId": "s3", "valid": true, "reason": "..." }], "unintendedIssues": [{ "sentenceId": "s5", "issue": "..." }], "tooObvious": ["s7"] }
Use empty arrays when there is nothing to report.`,
    user: [
      "Passage:",
      sentences.map((s) => `${s.id}: ${s.text}`).join("\n"),
      "Deliberately wrong sentences (with the intended error):",
      planted.map((p) => `- ${p.sentenceId}: ${p.explanation}`).join("\n"),
    ].join("\n\n"),
  };
}
