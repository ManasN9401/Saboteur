import "server-only";
import { engineMode } from "./engine";
import { callJSON, LLMError } from "./llm";
import { gradeCorrectionOffline } from "./offline/grade";
import { gradeCorrectionsPrompt } from "./prompts/gradeCorrections";
import { GradeOutputSchema, type GradeOutput, type GradedItem, type PlantedError, type Round, type RoundResult, type Submission } from "./schemas";
import { catchPoints, classify, falseFlagPoints, maxScore, totalScore } from "./scoring";

const BLANK_FEEDBACK = "You spotted it, but didn't say what was wrong. Writing the fix is what makes it stick.";

export async function gradeSubmission(sub: Submission, round: Round, errors: PlantedError[]): Promise<RoundResult> {
  const known = new Set(round.sentences.map((s) => s.id));
  const flags = sub.flags.filter((f) => known.has(f.sentenceId));
  const { catches, misses, falseFlags } = classify(flags, errors);
  const textById = new Map(round.sentences.map((s) => [s.id, s.text]));

  // Empty corrections are graded "incorrect" without spending a model call.
  const toGrade = catches.filter((c) => c.flag.correction.trim());
  const needsModel = toGrade.length > 0 || falseFlags.length > 0;
  const offline = () => offlineGrades(toGrade.map(({ flag, error }) => ({ error, correction: flag.correction })), falseFlags.map((f) => f.sentenceId), round);
  let graded: GradeOutput = { grades: [], explanations: [] };
  if (needsModel && (round.engine === "offline" || engineMode().engine === "offline")) {
    graded = offline();
  } else if (needsModel) {
    try {
      graded = await callJSON(
        gradeCorrectionsPrompt({
          level: round.level,
          catches: toGrade.map(({ flag, error }) => ({
            sentenceId: error.sentenceId,
            sabotagedSentence: error.sabotagedSentence,
            originalSentence: error.originalSentence,
            explanation: error.explanation,
            correction: flag.correction.trim(),
          })),
          falseFlags: falseFlags.map((f) => ({ sentenceId: f.sentenceId, text: textById.get(f.sentenceId) ?? "" })),
        }),
        GradeOutputSchema,
      );
    } catch (err) {
      // The round was written by the AI but it can't mark right now: mark with rules instead of failing.
      if (!(err instanceof LLMError && err.unavailable)) throw err;
      console.warn("[grade] AI unavailable, marking with rules:", err.message);
      graded = offline();
    }
  }

  const gradeById = new Map(graded.grades.map((g) => [g.sentenceId, g]));
  const explanationById = new Map(graded.explanations.map((e) => [e.sentenceId, e.text]));

  const items: GradedItem[] = [
    ...catches.map(({ flag, error }): GradedItem => {
      const g = flag.correction.trim() ? gradeById.get(error.sentenceId) : undefined;
      const grade = g?.grade ?? "incorrect";
      return {
        sentenceId: error.sentenceId,
        kind: "catch",
        correctionGrade: grade,
        feedback: g?.feedback ?? (flag.correction.trim() ? "You flagged the right sentence." : BLANK_FEEDBACK),
        confidence: flag.confidence,
        points: catchPoints(grade, round.difficulty),
      };
    }),
    ...misses.map((error): GradedItem => ({ sentenceId: error.sentenceId, kind: "miss", feedback: error.explanation, points: 0 })),
    ...falseFlags.map((flag): GradedItem => ({
      sentenceId: flag.sentenceId,
      kind: "false_flag",
      feedback: explanationById.get(flag.sentenceId) ?? "This sentence was accurate as written.",
      confidence: flag.confidence,
      points: falseFlagPoints(round.difficulty),
    })),
  ];

  // Present in passage order.
  const order = new Map(round.sentences.map((s, i) => [s.id, i]));
  items.sort((a, b) => (order.get(a.sentenceId) ?? 0) - (order.get(b.sentenceId) ?? 0));

  return {
    roundId: round.id,
    items,
    errors: [...errors].sort((a, b) => (order.get(a.sentenceId) ?? 0) - (order.get(b.sentenceId) ?? 0)),
    score: totalScore(items),
    maxScore: maxScore(errors.length, round.difficulty),
  };
}

/** Rule-based marking, used when the round was built offline or the AI can't be reached. */
function offlineGrades(catches: { error: PlantedError; correction: string }[], falseFlagIds: string[], round: Round): GradeOutput {
  const source = round.source?.label ?? "the source";
  return {
    grades: catches.map(({ error, correction }) => ({
      sentenceId: error.sentenceId,
      ...gradeCorrectionOffline(error.originalSentence, error.sabotagedSentence, correction),
    })),
    explanations: falseFlagIds.map((sentenceId) => ({
      sentenceId,
      text: `Nothing in this sentence was changed. It matches ${source === "Your notes" ? "your notes" : source} word for word.`,
    })),
  };
}
