import { EFFORT, MODELS } from "../config";
import type { Prompt } from "../llm";

export interface GradeParams {
  level: string;
  catches: {
    sentenceId: string;
    sabotagedSentence: string;
    originalSentence: string;
    explanation: string;
    correction: string;
  }[];
  falseFlags: { sentenceId: string; text: string }[];
}

/** Grades every catch and explains every false flag in one call (spec 10.4 + 10.5 merged). */
export function gradeCorrectionsPrompt(params: GradeParams): Prompt<GradeParams> {
  const { level, catches, falseFlags } = params;
  return {
    name: "gradeCorrections",
    params,
    model: MODELS.grade,
    effort: EFFORT.grade,
    maxTokens: 8000,
    system: `You grade a student's corrections in an error-spotting game, at level "${level}".

Part 1. For each caught sentence you get the sabotaged sentence, the original correct sentence, the explanation of the error, and the student's correction. Grade on meaning, not wording or spelling. "correct" = they identified what was wrong and what it should be. "partially_correct" = they identified what was wrong but the fix is incomplete or vague. "incorrect" = they flagged the right sentence but for the wrong reason. Give one short, encouraging sentence of feedback addressed to the student.

Part 2. For each sentence the student flagged that was actually correct, write one sentence explaining why it is correct.

Use UK spelling. Return JSON only, in exactly this shape:
{ "grades": [{ "sentenceId": "s3", "grade": "correct", "feedback": "..." }], "explanations": [{ "sentenceId": "s5", "text": "..." }] }
Use empty arrays when a part has no items.`,
    user: [
      catches.length
        ? "Caught sentences:\n" +
          catches
            .map(
              (c) =>
                `[${c.sentenceId}]\nSabotaged: ${c.sabotagedSentence}\nOriginal: ${c.originalSentence}\nThe error: ${c.explanation}\nStudent's correction: ${c.correction}`,
            )
            .join("\n\n")
        : "Caught sentences: none.",
      falseFlags.length
        ? "Correct sentences the student flagged:\n" + falseFlags.map((f) => `[${f.sentenceId}] ${f.text}`).join("\n")
        : "Correct sentences the student flagged: none.",
    ].join("\n\n"),
  };
}
