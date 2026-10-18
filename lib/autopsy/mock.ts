// Canned autopsy answers for SABOTEUR_MOCK=1: the fixture worksheets' expected diagnoses, or a cautious
// guess (with a probe question) for anything else.
import type { DiagnoseParams } from "../prompts/autopsyDiagnose";
import type { CheckQuestion, Diagnosis, IntakeItemInput, QuestionsRequest } from "./schema";
import { fixtureFor, WORKSHEETS } from "./fixtures";

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export function mockDiagnosis(item: IntakeItemInput, subject = ""): Diagnosis {
  const f = fixtureFor(item.question);
  if (f) return { itemId: item.id, ...f.expect, confidence: 0.85, probe: null, subject: f.subject, topic: f.title };
  const close = distance(item.answer.toLowerCase(), item.correct.toLowerCase()) <= 2 && item.correct.length > 2;
  if (close)
    return { itemId: item.id, kind: "careless_slip", label: "A slip in writing the answer", errorType: null, explanation: `“${item.answer}” is one or two characters away from “${item.correct}”, so the idea looks right.`, correction: `The answer is ${item.correct}.`, confidence: 0.55, probe: null, subject, topic: item.question.slice(0, 80) };
  return {
    itemId: item.id,
    kind: "misconception",
    label: `Thinks the answer is “${item.answer}”`.slice(0, 160),
    errorType: "plausible_but_false_detail",
    explanation: `Your answer, “${item.answer}”, would follow from a rule that doesn't apply here.`,
    correction: `The answer is ${item.correct}.`,
    confidence: 0.45,
    probe: `Did you think “${item.answer}” was right because of a rule you'd learned?`.slice(0, 300),
    subject,
    topic: item.question.slice(0, 80),
  };
}

export function mockDiagnose(p: DiagnoseParams) {
  if (p.image) {
    // A picture can't be read without a model: answer with the circuits worksheet, as if read from it.
    const w = WORKSHEETS[3];
    const items = w.items.map((i, n) => ({ id: `a${n + 1}`, question: i.question, answer: i.answer, correct: i.correct }));
    return { items, diagnoses: items.map((i) => mockDiagnosis(i, w.subject)) };
  }
  return { diagnoses: p.items.map((i) => mockDiagnosis(i, p.subject ?? "")) };
}

export function mockQuestions(p: QuestionsRequest): { questions: CheckQuestion[] } {
  const base = [p.example.correct, p.example.answer, "Neither: it depends on the units used", "Both, in different situations"];
  const questions = [0, 1, 2].map((n): CheckQuestion => {
    // Rotate the options so the right answer moves about.
    const order = [0, 1, 2, 3].map((i) => (i + n) % 4);
    const options = order.map((i) => base[i]);
    return {
      stem: n === 0 ? p.example.question : `${["Which is right?", "Check again:", "One more:"][n]} ${p.example.question}`,
      options,
      answer: order.indexOf(0),
      trap: order.indexOf(1),
      explanation: p.correction || `The answer is ${p.example.correct}.`,
      trapExplanation: `“${p.example.answer}” is what “${p.label}” leads to.`,
    };
  });
  return { questions };
}
