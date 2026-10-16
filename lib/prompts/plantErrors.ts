import { EFFORT, MODELS } from "../config";
import type { Prompt } from "../llm";
import type { Difficulty, Sentence } from "../schemas";

export interface PlantParams {
  sentences: Sentence[];
  count: number;
  level: string;
  difficulty: Difficulty;
  /** Sentences that already hold a planted error or must not be touched. */
  avoidIds?: string[];
  /** Errors the verifier rejected last time, so the planter doesn't repeat them. */
  rejected?: { sentenceId: string; reason: string }[];
}

export function plantErrorsPrompt(params: PlantParams): Prompt<PlantParams> {
  const { sentences, count, level, difficulty, avoidIds = [], rejected = [] } = params;
  return {
    name: "plantErrors",
    params,
    model: MODELS.generate,
    effort: EFFORT.plant,
    system: `You design learning exercises. You will receive a correct explanation as numbered sentences. Choose exactly ${count} different sentences and rewrite each one to contain exactly ONE subtle factual or conceptual error, at "${difficulty}" difficulty, for a student at level "${level}".
Rules:
- The rewritten sentence must keep the same length, tone, and style. It must not be detectable by grammar, awkwardness, hedging, or style — only by knowing the subject.
- Use a variety of error types from: reversed_causation, wrong_quantity_or_value, swapped_terms, false_generalisation, missing_exception, wrong_mechanism, wrong_sequence, wrong_attribution, plausible_but_false_detail.
- Each error should embody a REAL misconception that students at this level commonly hold, not a random fact swap.
- "obvious" = a student who studied would catch it; "subtle" = needs solid understanding; "devious" = targets a well-known, persistent misconception and is very convincing.
- Do not make errors that depend on another sentence also being changed.
- The error must be unambiguously wrong at this level, not merely a simplification.
- "originalSentence" must be copied exactly from the input. "explanation" says why the rewrite is wrong (one or two sentences). "whyTempting" says why a student might believe it. "misconceptionLabel" names the wrong belief in under ten words.

Return JSON only, in exactly this shape:
{ "errors": [{ "sentenceId": "s3", "originalSentence": "...", "sabotagedSentence": "...", "errorType": "swapped_terms", "explanation": "...", "whyTempting": "...", "misconceptionLabel": "..." }] }`,
    user: [
      "Sentences:",
      sentences.map((s) => `${s.id}: ${s.text}`).join("\n"),
      avoidIds.length ? `Do not choose these sentences: ${avoidIds.join(", ")}.` : "",
      rejected.length
        ? `A fact-checker rejected these earlier attempts; do not repeat them:\n${rejected.map((r) => `- ${r.sentenceId}: ${r.reason}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}
