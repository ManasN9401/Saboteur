import type { AutopsyImage, IntakeItemInput } from "../autopsy/schema";
import { EFFORT, MODELS } from "../config";
import type { Prompt } from "../llm";
import { ERROR_TYPES } from "../schemas";

export interface DiagnoseParams {
  items: IntakeItemInput[];
  level: string;
  subject?: string;
  /** Marked work as a picture: the model reads the wrong answers off it first. */
  image?: AutopsyImage;
}

/** Wrong Answer Autopsy, step one (spec §10.6): the misconception behind each wrong answer, or "just a slip". */
export function autopsyDiagnosePrompt(params: DiagnoseParams): Prompt<DiagnoseParams> {
  const { items, level, subject, image } = params;
  return {
    name: "autopsyDiagnose",
    params,
    model: MODELS.generate,
    effort: EFFORT.autopsy,
    images: image ? [image] : undefined,
    system: `You are an experienced teacher diagnosing a student's wrong answers, at level "${level}"${subject ? ` in ${subject}` : ""}. For each wrong answer, work out the most likely reason the student wrote exactly that.

- If the answer follows from a wrong belief about the subject, kind = "misconception". "label" names the wrong belief from the student's side in under twelve words ("Resistances in parallel add up like in series"), not the topic and not the right answer. "explanation" shows, step by step in one to three sentences, how that belief produces their exact answer. "errorType" is the closest of: ${ERROR_TYPES.join(", ")}.
- If the student clearly knows the idea but slipped (arithmetic, a copied number, a misread question, a sign dropped at the end, a unit left off), kind = "careless_slip", "label" says what the slip was, and errorType is null. Don't invent a misconception for a slip; don't excuse a misconception as a slip.
- "correction" gives the right idea in one or two sentences, addressed to the student.
- "confidence" (0–1) is how sure you are of the diagnosis. Below 0.6, also write "probe": one short yes/no question to ask the student that would confirm it ("Did you think resistance adds up in parallel?"). Otherwise probe is null.
- "subject" is the school subject, lower case (e.g. "physics"). "topic" is a short revision topic the question belongs to, two to six words ("Resistors in parallel").
- Be kind and specific. Never mock the student. UK spelling.
${image ? `\nThe marked work is in the attached image. First read every question the student got wrong: the question, the student's answer and the correct answer (from the teacher's marking, or work it out if it isn't shown). Return them as "items" with ids a1, a2, … in the order they appear, then diagnose each. Ignore questions marked correct. If nothing legible is wrong, return empty lists.` : ""}

Return JSON only, in exactly this shape:
{ ${image ? `"items": [{ "id": "a1", "question": "...", "answer": "...", "correct": "..." }], ` : ""}"diagnoses": [{ "itemId": "a1", "kind": "misconception", "label": "...", "errorType": "swapped_terms", "explanation": "...", "correction": "...", "confidence": 0.8, "probe": null, "subject": "physics", "topic": "Resistors in parallel" }] }`,
    user: items.length
      ? items.map((i) => `${i.id}\nQuestion: ${i.question}\nStudent's answer: ${i.answer}\nCorrect answer: ${i.correct}`).join("\n\n")
      : "Read the wrong answers from the attached image.",
  };
}
