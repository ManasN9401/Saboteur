// Pure scoring and calibration maths. No I/O, no LLM calls, so it is easy to unit test.
import { DIFFICULTY_MULTIPLIER, POINTS } from "./config";
import type { CorrectionGrade, Difficulty, Flag, GradedItem, PlantedError } from "./schemas";

export interface Classification {
  catches: { flag: Flag; error: PlantedError }[];
  misses: PlantedError[];
  falseFlags: Flag[];
}

/** Match flags against planted errors by sentence id. Duplicate flags on one sentence count once. */
export function classify(flags: Flag[], errors: PlantedError[]): Classification {
  const errorById = new Map(errors.map((e) => [e.sentenceId, e]));
  const seen = new Set<string>();
  const out: Classification = { catches: [], misses: [], falseFlags: [] };
  for (const flag of flags) {
    if (seen.has(flag.sentenceId)) continue;
    seen.add(flag.sentenceId);
    const error = errorById.get(flag.sentenceId);
    if (error) out.catches.push({ flag, error });
    else out.falseFlags.push(flag);
  }
  out.misses = errors.filter((e) => !seen.has(e.sentenceId));
  return out;
}

/** Round half away from zero, so -37.5 becomes -38 just as 37.5 becomes 38. */
const roundPoints = (x: number) => Math.sign(x) * Math.round(Math.abs(x));

export function catchPoints(grade: CorrectionGrade, difficulty: Difficulty): number {
  return roundPoints(POINTS[grade] * DIFFICULTY_MULTIPLIER[difficulty]);
}

export function falseFlagPoints(difficulty: Difficulty): number {
  return roundPoints(POINTS.falseFlag * DIFFICULTY_MULTIPLIER[difficulty]);
}

export function maxScore(errorCount: number, difficulty: Difficulty): number {
  return errorCount * catchPoints("correct", difficulty);
}

export function totalScore(items: Pick<GradedItem, "points">[]): number {
  return items.reduce((sum, item) => sum + item.points, 0);
}

/* ---------- Calibration ---------- */

export interface Judgement {
  confidence: number; // 0.5–1.0
  correct: boolean;
}

/** Each flag is a bet that "this sentence is wrong"; the overall bet is "I found them all". */
export function roundJudgements(items: GradedItem[], foundAllConfidence: number): Judgement[] {
  const bets = items
    .filter((i) => i.kind !== "miss" && typeof i.confidence === "number")
    .map((i) => ({ confidence: i.confidence as number, correct: i.kind === "catch" }));
  const foundAll = !items.some((i) => i.kind === "miss");
  return [...bets, { confidence: foundAllConfidence, correct: foundAll }];
}

/** Mean of (confidence − outcome)². 0 is perfect; 0.25 is what always saying 50% earns. */
export function brierScore(judgements: Judgement[]): number | null {
  if (!judgements.length) return null;
  const total = judgements.reduce((sum, j) => sum + (j.confidence - (j.correct ? 1 : 0)) ** 2, 0);
  return total / judgements.length;
}

export function brierGrade(score: number | null): string {
  if (score === null) return "No bets yet";
  if (score <= 0.1) return "Sharp";
  if (score <= 0.2) return "Well calibrated";
  if (score <= 0.3) return "A bit off";
  return "Overconfident";
}

export const BUCKETS = [50, 60, 70, 80, 90, 100] as const;

export interface Bucket {
  confidence: (typeof BUCKETS)[number];
  count: number;
  accuracy: number | null;
}

/** Group bets by confidence (rounded to the nearest 10%) and report the hit rate in each. */
export function calibrationBuckets(judgements: Judgement[]): Bucket[] {
  return BUCKETS.map((b) => {
    const inBucket = judgements.filter((j) => Math.round(j.confidence * 10) * 10 === b);
    const hits = inBucket.filter((j) => j.correct).length;
    return { confidence: b, count: inBucket.length, accuracy: inBucket.length ? hits / inBucket.length : null };
  });
}

/** Confident mistakes worth calling out (hypercorrection): ≥80% sure and wrong. */
export function confidentMistakes(items: GradedItem[], foundAllConfidence: number) {
  const falseFlags = items.filter((i) => i.kind === "false_flag" && (i.confidence ?? 0) >= 0.8);
  const missedWhileSure = foundAllConfidence >= 0.8 ? items.filter((i) => i.kind === "miss") : [];
  return { falseFlags, missedWhileSure, foundAllConfidence };
}
