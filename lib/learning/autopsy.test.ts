import { describe, expect, it } from "vitest";
import { checkResult, confirmFinding, hasConfirmed, rejectFinding, type Finding } from "./autopsy";
import { labelKey } from "./labels";
import { mergeInto, RETIRED_BOX } from "./model";
import { emptyLearning } from "./schema";
import { dueReviews, topMisconceptions } from "./views";

const DAY = (d: number) => new Date(Date.UTC(2026, 9, d, 12)).toISOString();
const finding = (over: Partial<Finding> = {}): Finding => ({
  id: "aut1-a1",
  at: DAY(1),
  label: "Resistances in parallel add up like in series",
  errorType: "false_generalisation",
  subject: "physics",
  topic: "Resistors in parallel",
  level: "GCSE",
  question: "Two 6 Ω resistors in parallel?",
  answer: "12 Ω",
  correct: "3 Ω",
  explanation: "Added them, the series rule.",
  correction: "1/R = 1/6 + 1/6, so R = 3 Ω.",
  ...over,
});
const key = labelKey("Resistances in parallel add up like in series");

describe("autopsy findings in the profile", () => {
  it("a confirmed finding is a miss that holds a bit more firmly, and goes into review", () => {
    const l = confirmFinding(emptyLearning(), finding());
    const m = l.misconceptions[key];
    expect(m).toMatchObject({ seen: 1, missed: 1, strength: 1.5, topics: ["Resistors in parallel"], subjects: ["physics"], correction: "1/R = 1/6 + 1/6, so R = 3 Ω." });
    expect(m.autopsy).toEqual({ status: "confirmed", history: [{ at: DAY(1), event: "confirmed" }] });
    expect(m.review).toEqual({ box: 0, due: DAY(2) });
    expect(m.history[0]).toMatchObject({ source: "autopsy", sabotaged: "12 Ω", original: "Two 6 Ω resistors in parallel? → 3 Ω" });
    expect(topMisconceptions(l, DAY(1))[0].key).toBe(key);
    expect(dueReviews(l, DAY(2))).toHaveLength(1);
    expect(hasConfirmed(l)).toBe(true);
    expect(confirmFinding(l, finding())).toBe(l); // the same finding twice counts once
  });

  it("a rejected diagnosis adds no strength and isn't pinned", () => {
    const l = rejectFinding(emptyLearning(), finding());
    expect(l.misconceptions[key]).toMatchObject({ seen: 0, missed: 0, strength: 0, review: null, autopsy: { status: "rejected" } });
    expect(topMisconceptions(l, DAY(1))).toHaveLength(0);
    expect(hasConfirmed(l)).toBe(false);
    // Rejecting a later diagnosis doesn't undo an earlier confirmation.
    const both = rejectFinding(confirmFinding(emptyLearning(), finding()), finding({ id: "aut2-a1", at: DAY(3) }));
    expect(both.misconceptions[key].autopsy?.status).toBe("confirmed");
  });

  it("check questions: all right resolves and moves up a box; a trap taken sends it back", () => {
    const l = confirmFinding(emptyLearning(), finding());
    const passed = checkResult(l, key, DAY(2), [{ right: true, confidence: 0.9 }, { right: true, confidence: 0.8 }, { right: true, confidence: 0.7 }], "physics");
    const m = passed.misconceptions[key];
    expect(m.autopsy?.status).toBe("resolved");
    expect(m.autopsy?.history.map((h) => h.event)).toEqual(["confirmed", "checked", "resolved"]);
    expect(m.autopsy?.history[1]).toMatchObject({ right: 3, of: 3 });
    expect(m.review).toEqual({ box: 1, due: DAY(5) });
    expect(m.strength).toBeLessThan(l.misconceptions[key].strength);
    expect(passed.calibration.all).toMatchObject({ bets: 3, hits: 3 });
    expect(passed.calibration.bySubject.physics.bets).toBe(3);

    const failed = checkResult(l, key, DAY(2), [{ right: true, confidence: 0.9 }, { right: false, confidence: 0.9 }], "physics");
    expect(failed.misconceptions[key].autopsy?.status).toBe("confirmed");
    expect(failed.misconceptions[key].review).toEqual({ box: 0, due: DAY(3) });
  });

  it("resolving from the last box retires it", () => {
    let l = confirmFinding(emptyLearning(), finding());
    l = { ...l, misconceptions: { ...l.misconceptions, [key]: { ...l.misconceptions[key], review: { box: 3, due: DAY(1) } } } };
    const out = checkResult(l, key, DAY(2), [{ right: true, confidence: 0.9 }, { right: true, confidence: 0.9 }], "physics");
    expect(out.misconceptions[key].review).toEqual({ box: RETIRED_BOX, due: null });
    expect(out.reviews.retired).toBe(1);
  });

  it("label merges keep the autopsy record", () => {
    let l = confirmFinding(emptyLearning(), finding());
    l = rejectFinding(l, finding({ id: "x", label: "Parallel resistors just add", at: DAY(2) }));
    const merged = mergeInto(l, labelKey("Parallel resistors just add"), key);
    expect(merged.misconceptions[key].autopsy?.status).toBe("confirmed");
    expect(merged.misconceptions[key].autopsy?.history.map((h) => h.event)).toEqual(["confirmed", "rejected"]);
  });
});
