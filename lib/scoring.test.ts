import { describe, expect, it } from "vitest";
import type { GradedItem, PlantedError } from "./schemas";
import {
  brierGrade,
  brierScore,
  calibrationBuckets,
  catchPoints,
  classify,
  confidentMistakes,
  falseFlagPoints,
  maxScore,
  roundJudgements,
  totalScore,
} from "./scoring";

const err = (sentenceId: string): PlantedError => ({
  sentenceId,
  originalSentence: "o",
  sabotagedSentence: "s",
  errorType: "swapped_terms",
  explanation: "e",
  whyTempting: "t",
  misconceptionLabel: "m",
});
const flag = (sentenceId: string, confidence = 0.7) => ({ sentenceId, correction: "fix", confidence });

describe("classify", () => {
  it("sorts flags into catches, misses and false flags", () => {
    const out = classify([flag("s2"), flag("s5")], [err("s2"), err("s7")]);
    expect(out.catches.map((c) => c.flag.sentenceId)).toEqual(["s2"]);
    expect(out.misses.map((m) => m.sentenceId)).toEqual(["s7"]);
    expect(out.falseFlags.map((f) => f.sentenceId)).toEqual(["s5"]);
  });

  it("counts a sentence flagged twice only once", () => {
    const out = classify([flag("s2"), flag("s2", 0.9)], [err("s2")]);
    expect(out.catches).toHaveLength(1);
    expect(out.catches[0].flag.confidence).toBe(0.7);
    expect(out.falseFlags).toHaveLength(0);
  });

  it("treats no flags as all misses", () => {
    const out = classify([], [err("s1"), err("s3")]);
    expect(out.misses).toHaveLength(2);
    expect(out.catches).toHaveLength(0);
  });
});

describe("points", () => {
  it("awards catch points by correction grade", () => {
    expect(catchPoints("correct", "obvious")).toBe(100);
    expect(catchPoints("partially_correct", "obvious")).toBe(60);
    expect(catchPoints("incorrect", "obvious")).toBe(30);
  });

  it("applies the difficulty multiplier", () => {
    expect(catchPoints("correct", "subtle")).toBe(150);
    expect(catchPoints("correct", "devious")).toBe(200);
    expect(catchPoints("partially_correct", "subtle")).toBe(90);
    expect(catchPoints("incorrect", "devious")).toBe(60);
  });

  it("penalises false flags, scaled by difficulty", () => {
    expect(falseFlagPoints("obvious")).toBe(-25);
    expect(falseFlagPoints("subtle")).toBe(-38); // -37.5 rounds away from zero
    expect(falseFlagPoints("devious")).toBe(-50);
  });

  it("computes the max score from the number of errors", () => {
    expect(maxScore(3, "subtle")).toBe(450);
    expect(maxScore(2, "obvious")).toBe(200);
  });

  it("sums item points, allowing a negative total", () => {
    expect(totalScore([{ points: 100 }, { points: -25 }, { points: 0 }])).toBe(75);
    expect(totalScore([{ points: -25 }, { points: -25 }])).toBe(-50);
  });
});

const items: GradedItem[] = [
  { sentenceId: "s1", kind: "catch", correctionGrade: "correct", feedback: "", confidence: 0.9, points: 100 },
  { sentenceId: "s2", kind: "false_flag", feedback: "", confidence: 0.8, points: -25 },
  { sentenceId: "s3", kind: "miss", feedback: "", points: 0 },
];

describe("calibration", () => {
  it("turns flags and the found-all bet into judgements", () => {
    expect(roundJudgements(items, 0.6)).toEqual([
      { confidence: 0.9, correct: true },
      { confidence: 0.8, correct: false },
      { confidence: 0.6, correct: false },
    ]);
  });

  it("scores a perfect forecaster at 0 and a coin flip at 0.25", () => {
    expect(brierScore([{ confidence: 1, correct: true }])).toBe(0);
    expect(brierScore([{ confidence: 0.5, correct: true }, { confidence: 0.5, correct: false }])).toBe(0.25);
    expect(brierScore([])).toBeNull();
  });

  it("computes the Brier score as the mean squared error", () => {
    const score = brierScore([
      { confidence: 0.9, correct: true },
      { confidence: 0.8, correct: false },
    ]);
    expect(score).toBeCloseTo((0.01 + 0.64) / 2);
  });

  it("labels Brier scores", () => {
    expect(brierGrade(0.05)).toBe("Sharp");
    expect(brierGrade(0.4)).toBe("Overconfident");
    expect(brierGrade(null)).toBe("No bets yet");
  });

  it("buckets judgements by confidence and reports accuracy", () => {
    const buckets = calibrationBuckets([
      { confidence: 0.9, correct: true },
      { confidence: 0.9, correct: false },
      { confidence: 0.92, correct: true },
      { confidence: 0.5, correct: false },
    ]);
    expect(buckets.map((b) => b.confidence)).toEqual([50, 60, 70, 80, 90, 100]);
    expect(buckets.find((b) => b.confidence === 90)).toMatchObject({ count: 3, accuracy: 2 / 3 });
    expect(buckets.find((b) => b.confidence === 50)).toMatchObject({ count: 1, accuracy: 0 });
    expect(buckets.find((b) => b.confidence === 70)).toMatchObject({ count: 0, accuracy: null });
  });

  it("flags confident mistakes for the hypercorrection callout", () => {
    const sure = confidentMistakes(items, 0.9);
    expect(sure.falseFlags.map((i) => i.sentenceId)).toEqual(["s2"]);
    expect(sure.missedWhileSure.map((i) => i.sentenceId)).toEqual(["s3"]);
    expect(confidentMistakes(items, 0.7).missedWhileSure).toEqual([]);
  });
});
