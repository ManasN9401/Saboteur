import { describe, expect, it } from "vitest";
import type { ErrorType, GradedItem, PlantedError } from "../schemas";
import type { RoundRecord } from "../storage/schemas";
import { labelKey, resolveKey } from "./labels";
import { applyMatches, pendingLabels } from "./normalise";
import { buildLearning, factsFromRecord, learnFromRound, mergeInto, RETIRED_BOX, strengthAt } from "./model";
import { emptyLearning, type Learning } from "./schema";
import { brierTrend, dueReviews, errorTypeRows, insightFor, nextReview, overconfidence, reliability, subjectRows, topMisconceptions } from "./views";

const DAY = (d: number) => new Date(Date.UTC(2026, 9, d, 12)).toISOString();

const LABELS = {
  A: "Photosynthesis happens in the mitochondria",
  B: "Light reactions make glucose directly",
  C: "Chlorophyll absorbs green light",
  D: "The Somme came before Verdun",
  E: "The Schlieffen Plan was Austrian",
} as const;
type Key = keyof typeof LABELS;
const TYPE: Record<Key, ErrorType> = { A: "swapped_terms", B: "wrong_mechanism", C: "wrong_quantity_or_value", D: "wrong_sequence", E: "wrong_attribution" };

interface Spec {
  id: string;
  day: number;
  subject: string;
  errors: { k: Key; outcome: "caught" | "half" | "missed"; conf?: number }[];
  falseFlags?: number[];
  foundAll: number;
  review?: boolean;
}

function record(s: Spec): RoundRecord {
  const errors: PlantedError[] = s.errors.map((e, i) => ({
    sentenceId: `s${i + 1}`,
    originalSentence: `Original ${e.k}.`,
    sabotagedSentence: `Sabotaged ${e.k}.`,
    errorType: TYPE[e.k],
    explanation: `Why ${e.k} is wrong.`,
    whyTempting: `Why ${e.k} is tempting.`,
    misconceptionLabel: LABELS[e.k],
  }));
  const items: GradedItem[] = [
    ...s.errors.map((e, i): GradedItem =>
      e.outcome === "missed"
        ? { sentenceId: `s${i + 1}`, kind: "miss", feedback: "", points: 0 }
        : { sentenceId: `s${i + 1}`, kind: "catch", correctionGrade: e.outcome === "half" ? "incorrect" : "correct", confidence: e.conf, feedback: "", points: 100 },
    ),
    ...(s.falseFlags ?? []).map((c, i): GradedItem => ({ sentenceId: `f${i + 1}`, kind: "false_flag", confidence: c, feedback: "", points: -25 })),
  ];
  return {
    round: { id: s.id, topic: s.subject === "biology" ? "Photosynthesis" : "First World War", topicId: "t", level: "A-level", difficulty: "subtle", sentences: [], createdAt: DAY(s.day), subject: s.subject },
    submission: { roundId: s.id, flags: [], foundAllConfidence: s.foundAll },
    result: { roundId: s.id, items, errors, score: 0, maxScore: 0 },
    playedAt: DAY(s.day),
    review: s.review,
  };
}

// Five rounds, numbers worked out by hand in the comments.
const ROUNDS: Spec[] = [
  { id: "r1", day: 1, subject: "biology", errors: [{ k: "A", outcome: "missed" }, { k: "B", outcome: "caught", conf: 0.9 }], falseFlags: [0.6], foundAll: 0.8 },
  { id: "r2", day: 2, subject: "biology", errors: [{ k: "A", outcome: "missed" }, { k: "C", outcome: "caught", conf: 0.7 }], foundAll: 0.9 },
  { id: "r3", day: 3, subject: "history", errors: [{ k: "D", outcome: "caught", conf: 0.8 }, { k: "E", outcome: "half", conf: 0.9 }], foundAll: 0.5 },
  { id: "r4", day: 4, subject: "history", errors: [{ k: "D", outcome: "missed" }], foundAll: 0.6 },
  { id: "r5", day: 5, subject: "biology", errors: [{ k: "A", outcome: "caught", conf: 0.9 }, { k: "B", outcome: "missed" }], foundAll: 1 },
];
const records = ROUNDS.map(record);
const facts = records.map((r) => factsFromRecord(r)!);
const learned = facts.reduce(learnFromRound, emptyLearning());
const mc = (l: Learning, k: Key) => l.misconceptions[labelKey(LABELS[k])];

describe("labels", () => {
  it("folds case, punctuation, filler words and plurals", () => {
    expect(labelKey("Photosynthesis happens in mitochondria.")).toBe(labelKey("photosynthesis happens in the Mitochondria"));
    expect(labelKey("The light reactions make glucose")).toBe(labelKey("light reaction makes glucose"));
    expect(labelKey("Gas")).toBe("gas");
    expect(labelKey("Photosynthesis")).toBe("photosynthesis");
    expect(labelKey("...")).toBe("unlabelled");
  });
  it("follows aliases, and stops on a cycle", () => {
    expect(resolveKey({ aliases: { alpha: "beta", beta: "gamma" } }, "Alpha")).toBe("gamma");
    expect(resolveKey({ aliases: { alpha: "beta", beta: "alpha" } }, "alpha")).toMatch(/^(alpha|beta)$/);
  });
});

describe("facts from a graded round", () => {
  it("reads outcomes, confident misses and bets", () => {
    const f = facts[0];
    expect(f.outcomes.map((o) => o.outcome)).toEqual(["missed", "caught"]);
    expect(f.outcomes[0].confidentWrong).toBe(true); // missed while 80% sure everything was found
    expect(f.judgements).toEqual([
      { confidence: 0.9, correct: true },
      { confidence: 0.6, correct: false },
      { confidence: 0.8, correct: false },
    ]);
    expect(facts[2].outcomes[1].outcome).toBe("half");
    expect(factsFromRecord({ round: records[0].round })).toBeNull();
  });
});

describe("calibration after five rounds", () => {
  it("buckets bets by confidence", () => {
    // 50: .5✓ · 60: .6✗ .6✗ · 70: .7✓ · 80: .8✗ .8✓ · 90: .9✓ .9✗ .9✓ .9✓ · 100: 1.0✗
    expect(reliability(learned).map((b) => [b.confidence, b.bets, b.accuracy])).toEqual([
      [50, 1, 1],
      [60, 2, 0],
      [70, 1, 1],
      [80, 2, 0.5],
      [90, 4, 0.75],
      [100, 1, 0],
    ]);
  });
  it("totals, Brier and overconfidence", () => {
    const all = learned.calibration.all;
    expect(all.bets).toBe(11);
    expect(all.hits).toBe(6);
    expect(all.conf).toBeCloseTo(8.6);
    expect(all.sq / all.bets).toBeCloseTo(3.58 / 11); // 0.3255
    expect(overconfidence(all)).toBe(24); // (8.6 − 6) / 11 = 23.6 points
    expect(learned.calibration.brier.map((b) => b.brier)).toEqual([0.3367, 0.45, 0.1, 0.36, 0.505]);
    expect(brierTrend(learned, 2)).toEqual({ recent: expect.closeTo(0.4325), before: expect.closeTo(0.275) });
  });
  it("breaks down by subject and error type", () => {
    const subjects = subjectRows(learned);
    expect(subjects.map((s) => [s.subject, s.bets])).toEqual([
      ["biology", 7],
      ["history", 4],
    ]);
    const types = errorTypeRows(learned);
    expect(types.find((t) => t.type === "swapped_terms")).toMatchObject({ seen: 3, caught: 1 });
    expect(types.find((t) => t.type === "wrong_attribution")).toMatchObject({ seen: 1, caught: 1 }); // a half-catch still found it
    expect(learned.calibration.bySubjectType["history|wrong_sequence"]).toEqual({ seen: 2, caught: 1 });
  });
});

describe("misconception profile after five rounds", () => {
  it("counts every sighting", () => {
    expect(mc(learned, "A")).toMatchObject({ seen: 3, caught: 1, missed: 2, confidentWrong: 2, subjects: ["biology"], topics: ["Photosynthesis"] });
    expect(mc(learned, "B")).toMatchObject({ seen: 2, caught: 1, missed: 1, confidentWrong: 1 });
    expect(mc(learned, "E")).toMatchObject({ seen: 1, half: 1, missed: 0 });
    expect(mc(learned, "A").history.map((h) => h.outcome)).toEqual(["missed", "missed", "caught"]);
  });
  it("strength grows with misses and fades with time", () => {
    // A: 1.5 on day 1; ×0.5^0.1 + 1.5 on day 2; ×0.5^0.3 − 0.5 on day 5.
    const a = 1.5 * 0.5 ** 0.1 + 1.5;
    expect(mc(learned, "A").strength).toBeCloseTo(a * 0.5 ** 0.3 - 0.5, 3);
    expect(strengthAt(mc(learned, "A"), DAY(15))).toBeCloseTo(mc(learned, "A").strength / 2, 3);
    expect(mc(learned, "C").strength).toBe(0); // caught, never below zero
  });
  it("ranks the top three", () => {
    expect(topMisconceptions(learned, DAY(5), 3).map((m) => m.label)).toEqual([LABELS.A, LABELS.B, LABELS.D]);
    expect(topMisconceptions(learned, DAY(5)).some((m) => m.label === LABELS.C)).toBe(false); // never missed
  });
  it("learns each round once, and rebuilds the same from saved rounds", () => {
    expect(learnFromRound(learned, facts[0])).toBe(learned);
    const rebuilt = buildLearning(Object.fromEntries([...records].reverse().map((r) => [r.round.id, r])));
    expect(rebuilt).toEqual(learned);
  });
});

describe("review queue", () => {
  it("schedules misses and moves due catches up a box", () => {
    expect(mc(learned, "A").review).toEqual({ box: 1, due: DAY(8) }); // missed day 2 (due day 3), caught day 5
    expect(mc(learned, "B").review).toEqual({ box: 0, due: DAY(6) });
    expect(mc(learned, "D").review).toEqual({ box: 0, due: DAY(5) });
    expect(mc(learned, "E").review).toEqual({ box: 0, due: DAY(4) }); // a half-catch needs review too
    expect(mc(learned, "C").review).toBeNull();
    expect(dueReviews(learned, DAY(5)).map((m) => m.label)).toEqual([LABELS.E, LABELS.D]);
    expect(nextReview(learned, DAY(5))).toBe(DAY(6));
  });

  it("walks the Leitner boxes on a fake clock and retires", () => {
    const at = (d: number) => new Date(Date.UTC(2026, 9, 1, 12) + d * 86_400_000).toISOString();
    const play = (l: Learning, id: string, d: number, outcome: "caught" | "missed") =>
      learnFromRound(l, { ...factsFromRecord(record({ id, day: 1, subject: "biology", errors: [{ k: "A", outcome, conf: 0.9 }], foundAll: 0.5 }))!, at: at(d) });
    let l = play(emptyLearning(), "w0", 0, "missed");
    expect(mc(l, "A").review).toEqual({ box: 0, due: at(1) });
    l = play(l, "w1", 0.5, "caught"); // not due yet: no change
    expect(mc(l, "A").review).toEqual({ box: 0, due: at(1) });
    l = play(l, "w2", 1, "caught");
    expect(mc(l, "A").review).toEqual({ box: 1, due: at(4) });
    l = play(l, "w3", 4, "caught");
    expect(mc(l, "A").review).toEqual({ box: 2, due: at(11) });
    l = play(l, "w4", 11, "caught");
    expect(mc(l, "A").review).toEqual({ box: 3, due: at(27) });
    expect(dueReviews(l, at(26))).toHaveLength(0);
    expect(dueReviews(l, at(27))).toHaveLength(1);
    l = play(l, "w5", 27, "caught");
    expect(mc(l, "A").review).toEqual({ box: RETIRED_BOX, due: null });
    expect(l.reviews.retired).toBe(1);
    l = play(l, "w6", 40, "missed"); // an old habit back: into box 0 again
    expect(mc(l, "A").review).toEqual({ box: 0, due: at(41) });
  });

  it("counts review cases closed", () => {
    const l = learnFromRound(emptyLearning(), factsFromRecord(record({ ...ROUNDS[0], id: "rv", review: true }))!);
    expect(l.reviews.closed).toBe(1);
  });
});

describe("label merges", () => {
  it("adds the counts together and keeps the more urgent review", () => {
    const merged = mergeInto(learned, labelKey(LABELS.B), labelKey(LABELS.A));
    const a = merged.misconceptions[labelKey(LABELS.A)];
    expect(merged.misconceptions[labelKey(LABELS.B)]).toBeUndefined();
    expect(a).toMatchObject({ seen: 5, caught: 2, missed: 3, confidentWrong: 3 });
    expect(a.review).toEqual({ box: 0, due: DAY(6) });
    expect(merged.aliases[labelKey(LABELS.B)]).toBe(labelKey(LABELS.A));
    // New sightings of B's label now land on A.
    const again = learnFromRound(merged, { ...facts[4], roundId: "r6", at: DAY(6) });
    expect(again.misconceptions[labelKey(LABELS.B)]).toBeUndefined();
    expect(again.misconceptions[labelKey(LABELS.A)].seen).toBe(7);
  });
});

describe("the reveal's insight line", () => {
  it("calls out a repeat miss", () => {
    const upTo2 = facts.slice(0, 2).reduce(learnFromRound, emptyLearning());
    expect(insightFor(upTo2, facts[1])).toBe(`That's the second time “${LABELS.A}” has got past you.`);
  });
  it("celebrates a comeback catch", () => {
    expect(insightFor(learned, facts[4])).toBe(`You caught “${LABELS.A}” this time, after it got past you twice.`);
  });
  it("spots a pattern by error type and subject", () => {
    const f = (id: string, day: number, label: string) => ({ ...facts[3], roundId: id, at: DAY(day), outcomes: [{ ...facts[3].outcomes[0], label }] });
    let l = emptyLearning();
    l = learnFromRound(l, f("x1", 1, "Ypres came before Mons"));
    l = learnFromRound(l, f("x2", 2, "Jutland came before Gallipoli"));
    expect(insightFor(l, f("x2", 2, "Jutland came before Gallipoli"))).toBe("That's the second time a wrong order of events has got past you in history.");
  });
  it("says nothing when there's nothing to say", () => {
    const one = learnFromRound(emptyLearning(), facts[2]);
    expect(insightFor(one, facts[2])).toBeNull();
  });
});

describe("label normalisation", () => {
  it("asks about each label once, newest first, with the labels on file", () => {
    const p = pendingLabels(learned);
    expect(p.fresh.map((f) => f.label)).toEqual([LABELS.A, LABELS.B, LABELS.D, LABELS.E, LABELS.C]);
    expect(p.known).toEqual([]);
    const after = applyMatches(learned, p.fresh.map((f) => f.key), []);
    expect(pendingLabels(after).fresh).toEqual([]);
    expect(pendingLabels(after).known).toHaveLength(5);
  });
  it("merges duplicates, following earlier merges in the same batch", () => {
    const keys = pendingLabels(learned).fresh.map((f) => f.key);
    const [a, b, d] = [labelKey(LABELS.A), labelKey(LABELS.B), labelKey(LABELS.D)];
    const out = applyMatches(learned, keys, [
      { key: b, sameAs: a },
      { key: d, sameAs: b }, // b is now a
      { key: labelKey(LABELS.C), sameAs: "no-such-key" },
    ]);
    expect(Object.keys(out.misconceptions).sort()).toEqual([a, labelKey(LABELS.C), labelKey(LABELS.E)].sort());
    expect(out.misconceptions[a].seen).toBe(3 + 2 + 2);
    expect(out.normalised.sort()).toEqual([a, labelKey(LABELS.C), labelKey(LABELS.E)].sort());
  });
});
