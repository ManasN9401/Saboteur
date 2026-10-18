import type { QuestionsRequest } from "../autopsy/schema";
import { EFFORT, MODELS } from "../config";
import type { Prompt } from "../llm";

/** Wrong Answer Autopsy, step two (spec §10.7): check questions aimed at one confirmed misconception. */
export function targetedQuestionsPrompt(params: QuestionsRequest): Prompt<QuestionsRequest> {
  const { label, explanation, correction, subject, level, example } = params;
  return {
    name: "targetedQuestions",
    params,
    model: MODELS.generate,
    effort: EFFORT.questions,
    maxTokens: 6000,
    system: `You write short multiple-choice check questions for a student at level "${level}" in ${subject || "their subject"}. The student has confirmed a misconception. Write 3 questions that test exactly that misconception in NEW situations (different numbers, examples or wording from the original question), so someone who still holds it gets them wrong and someone who has fixed it gets them right.

Each question has 4 options. Exactly one is right ("answer", 0–3). Exactly one other is the answer the misconception produces ("trap", 0–3). The other two are plausible but less tempting. Vary the position of the right answer. "explanation" says why the right answer is right in one or two sentences. "trapExplanation" says why the trap is tempting and where that reasoning goes wrong. Keep stems under 60 words. UK spelling. No "all of the above".

Return JSON only, in exactly this shape:
{ "questions": [{ "stem": "...", "options": ["...", "...", "...", "..."], "answer": 2, "trap": 0, "explanation": "...", "trapExplanation": "..." }] }`,
    user: [
      `Misconception: ${label}`,
      explanation && `How it showed up: ${explanation}`,
      correction && `The right idea: ${correction}`,
      `Original question: ${example.question}\nStudent's answer: ${example.answer}\nCorrect answer: ${example.correct}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}
