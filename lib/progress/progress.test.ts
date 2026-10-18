import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emptyLearning } from "../learning/schema";
import { emptyStats, StreakSchema, type Stats, type Streak } from "../profile/schema";
import type { RoundRecord } from "../storage/schemas";
import { BADGES, newBadges } from "./badges";
import { addDays, dayKey, dayNumber, daysBetween, fromDayNumber, localHour, weekday } from "./day";
import { awardBadge, eventFromRecord, rebuildStats, roundCompleted, sourceKind, type CompletionEvent } from "./events";
import { applyDay, liveStreak, tryRepair } from "./streak";
import { levelFor, progressOf, rankFor, roundXp, xpFor } from "./xp";

const streak = (s: Partial<Streak> = {}): Streak => ({ ...StreakSchema.parse({}), ...s });

let n = 0;
function event(e: Partial<CompletionEvent> = {}): CompletionEvent {
  n++;
  return {
    roundId: `r${n}`,
    at: "2026-10-14T12:00:00.000Z",
    tz: "UTC",
    day: "2026-10-14",
    hour: 12,
    topic: "Photosynthesis",
    subject: "biology",
    difficulty: "subtle",
    points: 200,
    maxScore: 450,
    catches: 2,
    misses: 1,
    falseFlags: 0,
    judgements: 4,
    brier: 0.2,
    confidentMistakes: 0,
    source: "library",
    engine: "offline",
    ...e,
  };
}

/** Play one round per listed day (noon UTC). */
function playDays(days: string[], stats: Stats = emptyStats(), restDays: number[] = []) {
  let s = stats;
  for (const day of days) s = roundCompleted(s, event({ day, at: `${day}T12:00:00.000Z` }), { restDays }).stats;
  return s;
}

describe("day", () => {
  it("keys an instant by the local date in a time zone", () => {
    const t = "2026-10-15T23:30:00.000Z";
    expect(dayKey(t, "UTC")).toBe("2026-10-15");
    expect(dayKey(t, "Europe/London")).toBe("2026-10-16"); // BST, UTC+1
    expect(dayKey(t, "America/New_York")).toBe("2026-10-15");
    expect(dayKey(t, "Pacific/Auckland")).toBe("2026-10-16");
  });

  it("gives the local hour", () => {
    expect(localHour("2026-10-15T23:30:00.000Z", "Europe/London")).toBe(0);
    expect(localHour("2026-10-15T03:00:00.000Z", "UTC")).toBe(3);
  });

  it("counts calendar days, not 24-hour periods, across the clocks going back", () => {
    // UK clocks go back on 25 Oct 2026: that day is 25 hours long.
    const before = dayKey("2026-10-24T23:30:00.000Z", "Europe/London"); // 00:30 BST on the 25th
    const after = dayKey("2026-10-26T00:30:00.000Z", "Europe/London"); // 00:30 GMT on the 26th
    expect(before).toBe("2026-10-25");
    expect(after).toBe("2026-10-26");
    expect(daysBetween(before, after)).toBe(1);
  });

  it("counts calendar days across the clocks going forward", () => {
    // 29 Mar 2026 is 23 hours long in London.
    expect(daysBetween(dayKey("2026-03-28T23:30:00.000Z", "Europe/London"), dayKey("2026-03-29T22:30:00.000Z", "Europe/London"))).toBe(1);
  });

  it("does day arithmetic across months, years and leap days", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(fromDayNumber(dayNumber("2026-10-16"))).toBe("2026-10-16");
    expect(daysBetween("2026-10-16", "2026-10-09")).toBe(-7);
  });

  it("knows the weekday", () => {
    expect(weekday("2026-10-16")).toBe(5); // Friday
    expect(weekday("2026-10-18")).toBe(0); // Sunday
  });
});

describe("streak", () => {
  it("starts at 1 on the first day", () => {
    const o = applyDay(streak(), "2026-10-01");
    expect(o.streak.current).toBe(1);
    expect(o.extended).toBe(true);
    expect(o.streak.lastDay).toBe("2026-10-01");
  });

  it("extends on consecutive days and tracks the best", () => {
    let s = streak();
    for (const d of ["2026-10-01", "2026-10-02", "2026-10-03"]) s = applyDay(s, d).streak;
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
  });

  it("a second round on the same day changes nothing", () => {
    const s = applyDay(streak(), "2026-10-01").streak;
    const o = applyDay(s, "2026-10-01");
    expect(o.streak).toBe(s);
    expect(o.extended).toBe(false);
  });

  it("breaks after a missed day with no freeze, remembering what was lost", () => {
    const s = streak({ current: 5, best: 5, lastDay: "2026-10-05" });
    const o = applyDay(s, "2026-10-07");
    expect(o.broke).toBe(true);
    expect(o.streak.current).toBe(1);
    expect(o.streak.best).toBe(5);
    expect(o.streak.broken).toEqual({ length: 5, lastDay: "2026-10-05", brokeOn: "2026-10-07" });
  });

  it("spends a freeze on a missed day", () => {
    const o = applyDay(streak({ current: 5, lastDay: "2026-10-05", freezes: 1 }), "2026-10-07");
    expect(o.broke).toBe(false);
    expect(o.frozen).toEqual(["2026-10-06"]);
    expect(o.streak).toMatchObject({ current: 6, freezes: 0, frozenDays: ["2026-10-06"] });
  });

  it("two freezes cover two missed days", () => {
    const o = applyDay(streak({ current: 9, lastDay: "2026-10-05", freezes: 2 }), "2026-10-08");
    expect(o.streak).toMatchObject({ current: 10, freezes: 0 });
    expect(o.frozen).toEqual(["2026-10-06", "2026-10-07"]);
  });

  it("doesn't waste freezes on a gap they can't cover", () => {
    const o = applyDay(streak({ current: 9, lastDay: "2026-10-05", freezes: 2 }), "2026-10-09");
    expect(o.broke).toBe(true);
    expect(o.streak.freezes).toBe(2);
    expect(o.frozen).toEqual([]);
  });

  it("earns a freeze every seven days, holding at most two", () => {
    let s = streak({ current: 6, lastDay: "2026-10-06" });
    let o = applyDay(s, "2026-10-07");
    expect(o.freezeEarned).toBe(true);
    expect(o.streak.freezes).toBe(1);
    s = streak({ current: 13, lastDay: "2026-10-13", freezes: 2 });
    o = applyDay(s, "2026-10-14");
    expect(o.freezeEarned).toBe(false);
    expect(o.streak.freezes).toBe(2);
  });

  it("reports milestones only when reached", () => {
    expect(applyDay(streak({ current: 2, lastDay: "2026-10-02" }), "2026-10-03").milestone).toBe(3);
    expect(applyDay(streak({ current: 3, lastDay: "2026-10-03" }), "2026-10-04").milestone).toBeNull();
    expect(applyDay(streak({ current: 99, lastDay: "2026-10-03" }), "2026-10-04").milestone).toBe(100);
  });

  it("rest days neither break nor extend", () => {
    // Fri 16 Oct → Mon 19 Oct with weekends off.
    const o = applyDay(streak({ current: 4, lastDay: "2026-10-16" }), "2026-10-19", [0, 6]);
    expect(o.broke).toBe(false);
    expect(o.frozen).toEqual([]);
    expect(o.streak.current).toBe(5);
  });

  it("playing on a rest day keeps the streak without adding to it", () => {
    const o = applyDay(streak({ current: 4, lastDay: "2026-10-16" }), "2026-10-17", [6]);
    expect(o.extended).toBe(false);
    expect(o.streak.current).toBe(4);
    expect(o.streak.lastDay).toBe("2026-10-17");
  });

  it("a time-travelling clock (an earlier day) changes nothing", () => {
    const s = streak({ current: 4, lastDay: "2026-10-16" });
    expect(applyDay(s, "2026-10-10").streak).toBe(s);
  });

  it("repairs a broken streak with three rounds on the day it broke", () => {
    const broken = applyDay(streak({ current: 8, best: 8, lastDay: "2026-10-05" }), "2026-10-08").streak;
    expect(tryRepair(broken, "2026-10-08", 2).repaired).toBe(false);
    const r = tryRepair(broken, "2026-10-08", 3);
    expect(r.repaired).toBe(true);
    expect(r.streak.current).toBe(9);
    expect(r.streak.broken).toBeNull();
    expect(r.streak.repairs).toEqual(["2026-10"]);
  });

  it("allows the repair on the next day too, but not later", () => {
    const broken = applyDay(streak({ current: 8, lastDay: "2026-10-05" }), "2026-10-08").streak;
    const nextDay = applyDay(broken, "2026-10-09").streak;
    expect(tryRepair(nextDay, "2026-10-09", 3).streak.current).toBe(10);
    const later = applyDay(nextDay, "2026-10-10").streak;
    expect(later.broken).toBeNull();
    expect(tryRepair(later, "2026-10-10", 3).repaired).toBe(false);
  });

  it("allows one repair a month", () => {
    const s = streak({ current: 1, lastDay: "2026-10-20", broken: { length: 5, lastDay: "2026-10-18", brokeOn: "2026-10-20" }, repairs: ["2026-10"] });
    expect(tryRepair(s, "2026-10-20", 3).repaired).toBe(false);
    expect(tryRepair({ ...s, repairs: ["2026-09"] }, "2026-10-20", 3).repaired).toBe(true);
  });

  it("shows a live streak as lost once a day is missed without a freeze", () => {
    const s = streak({ current: 6, lastDay: "2026-10-14" });
    expect(liveStreak(s, "2026-10-14")).toEqual({ current: 6, atRisk: false });
    expect(liveStreak(s, "2026-10-15")).toEqual({ current: 6, atRisk: true });
    expect(liveStreak(s, "2026-10-16").current).toBe(0);
    expect(liveStreak({ ...s, freezes: 1 }, "2026-10-16").current).toBe(6);
    expect(liveStreak(streak(), "2026-10-16")).toEqual({ current: 0, atRisk: false });
  });
});

describe("xp and ranks", () => {
  it("pays half the points, never less than 10", () => {
    expect(roundXp(300)).toBe(150);
    expect(roundXp(15)).toBe(10);
    expect(roundXp(-50)).toBe(10);
  });

  it("follows 100 × level^1.6", () => {
    expect(xpFor(0)).toBe(0);
    expect(xpFor(1)).toBe(100);
    expect(xpFor(2)).toBe(303);
    expect(levelFor(99)).toBe(0);
    expect(levelFor(100)).toBe(1);
    expect(levelFor(302)).toBe(1);
    expect(levelFor(303)).toBe(2);
  });

  it("names ranks from Recruit to Spymaster", () => {
    expect(rankFor(0)).toBe("Recruit");
    expect(rankFor(1)).toBe("Constable");
    expect(rankFor(3)).toBe("Detective");
    expect(rankFor(9)).toBe("Inspector");
    expect(rankFor(10)).toBe("Chief Inspector");
    expect(rankFor(40)).toBe("Spymaster");
  });

  it("reports progress within a level", () => {
    const p = progressOf(200);
    expect(p.level).toBe(1);
    expect(p.fraction).toBeCloseTo((200 - 100) / (303 - 100));
  });
});

describe("roundCompleted", () => {
  it("counts a round: XP, totals, streak, day, subject, first-case badge", () => {
    const { stats, delta } = roundCompleted(emptyStats(), event({ points: 300 }));
    expect(delta.xp).toBe(150);
    expect(delta.parts).toEqual([{ label: "Case closed", xp: 150 }]);
    expect(stats.xp).toBe(150);
    expect(stats.totals).toMatchObject({ rounds: 1, catches: 2, misses: 1, falseFlags: 0 });
    expect(stats.streak.current).toBe(1);
    expect(stats.days["2026-10-14"]).toBe(1);
    expect(stats.subjects).toEqual(["biology"]);
    expect(delta.badges).toContain("first-case");
    expect(delta.levelBefore).toBe(0);
    expect(delta.levelAfter).toBe(1);
    expect(delta.rankAfter).toBe("Constable");
  });

  it("is idempotent: the same round never counts twice", () => {
    const e = event();
    const once = roundCompleted(emptyStats(), e).stats;
    const twice = roundCompleted(once, e);
    expect(twice.stats).toBe(once);
    expect(twice.delta.skipped).toBe("already-counted");
    expect(twice.delta.xp).toBe(0);
  });

  it("pays bonuses for a perfect case and good calibration", () => {
    const { delta } = roundCompleted(emptyStats(), event({ points: 400, misses: 0, falseFlags: 0, brier: 0.1, judgements: 3 }));
    expect(delta.parts.map((p) => p.label)).toEqual(["Case closed", "Perfect case", "Well calibrated"]);
    expect(delta.xp).toBe(200 + 40 + 20);
  });

  it("needs at least three bets for the calibration bonus", () => {
    const { delta } = roundCompleted(emptyStats(), event({ brier: 0.05, judgements: 2 }));
    expect(delta.parts.some((p) => p.label === "Well calibrated")).toBe(false);
  });

  it("pays the daily case once per date; a replay earns nothing", () => {
    const first = roundCompleted(emptyStats(), event({ daily: "2026-10-14", points: 100 }));
    expect(first.delta.daily).toBe(true);
    expect(first.delta.parts).toContainEqual({ label: "Daily case", xp: 50 });
    expect(first.stats.daily["2026-10-14"]).toMatchObject({ score: 100, max: 450 });
    const again = roundCompleted(first.stats, event({ daily: "2026-10-14", points: 450 }));
    expect(again.delta.skipped).toBe("daily-replay");
    expect(again.stats.xp).toBe(first.stats.xp);
    expect(again.stats.daily["2026-10-14"].score).toBe(100);
  });

  it("never pays for a replayed case", () => {
    const r = roundCompleted(emptyStats(), event({ replay: true }));
    expect(r.delta.skipped).toBe("replay");
    expect(r.stats.xp).toBe(0);
    expect(r.stats.totals.rounds).toBe(0);
  });

  it("pays streak milestones", () => {
    const s = playDays(["2026-10-01", "2026-10-02"]);
    const { delta } = roundCompleted(s, event({ day: "2026-10-03", at: "2026-10-03T12:00:00.000Z" }));
    expect(delta.parts).toContainEqual({ label: "3-day streak", xp: 30 });
    expect(delta.badges).toContain("on-the-beat");
  });

  it("earns a freeze at 7 days and spends it on a missed day", () => {
    const days = Array.from({ length: 7 }, (_, i) => addDays("2026-10-01", i));
    let s = playDays(days);
    expect(s.streak.freezes).toBe(1);
    expect(s.badges["week-on-the-case"]).toBeDefined();
    const { stats, delta } = roundCompleted(s, event({ day: "2026-10-09", at: "2026-10-09T12:00:00.000Z" }));
    s = stats;
    expect(delta.streak.frozen).toEqual(["2026-10-08"]);
    expect(s.streak.current).toBe(8);
  });

  it("repairs a streak after three rounds on the comeback day and awards Comeback", () => {
    let s = playDays(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    const day = "2026-10-07";
    const at = `${day}T12:00:00.000Z`;
    const r1 = roundCompleted(s, event({ day, at }));
    expect(r1.delta.streak.broke).toBe(true);
    s = roundCompleted(r1.stats, event({ day, at })).stats;
    const r3 = roundCompleted(s, event({ day, at }));
    expect(r3.delta.streak.repaired).toBe(true);
    expect(r3.stats.streak.current).toBe(5);
    expect(r3.delta.badges).toContain("comeback");
  });

  it("ignores progress when the device clock jumps backwards", () => {
    const s = roundCompleted(emptyStats(), event({ at: "2026-10-14T12:00:00.000Z" })).stats;
    const r = roundCompleted(s, event({ at: "2026-10-10T12:00:00.000Z", day: "2026-10-10" }));
    expect(r.delta.skipped).toBe("clock");
    expect(r.stats.xp).toBe(s.xp);
    expect(r.stats.totals.rounds).toBe(2);
    expect(r.stats.streak).toEqual(s.streak);
  });

  it("keeps the best case by percentage", () => {
    let s = roundCompleted(emptyStats(), event({ points: 100, maxScore: 300, topic: "A" })).stats;
    s = roundCompleted(s, event({ points: 200, maxScore: 900, topic: "B" })).stats;
    expect(s.best?.topic).toBe("A");
    s = roundCompleted(s, event({ points: 300, maxScore: 300, topic: "C" })).stats;
    expect(s.best?.topic).toBe("C");
  });

  it("forgets day counts older than four months", () => {
    let s = roundCompleted(emptyStats(), event({ day: "2026-01-01", at: "2026-01-01T12:00:00.000Z" })).stats;
    s = roundCompleted(s, event({ day: "2026-10-14", at: "2026-10-14T12:00:00.000Z" })).stats;
    expect(Object.keys(s.days)).toEqual(["2026-10-14"]);
  });
});

describe("badges", () => {
  const ctx = (e: Partial<CompletionEvent> = {}, s: Partial<Stats> = {}) => ({ stats: { ...emptyStats(), ...s }, event: event(e), repaired: false });

  it("has 21 badges, each with art and a description", () => {
    expect(BADGES).toHaveLength(21);
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(21);
    for (const b of BADGES) {
      expect(b.description.length).toBeGreaterThan(5);
      expect(existsSync(`public/assets/badges/${b.id}.webp`)).toBe(true);
    }
  });

  it("reformed needs a misconception retired from review", () => {
    const learning = { ...emptyLearning(), reviews: { closed: 4, retired: 1 } };
    expect(newBadges(ctx({}, { learning }))).toContain("reformed");
    expect(newBadges(ctx({}, { learning: { ...learning, reviews: { closed: 4, retired: 0 } } }))).not.toContain("reformed");
    expect(newBadges(ctx())).not.toContain("reformed");
  });

  it("red-handed needs every error caught", () => {
    expect(newBadges(ctx({ misses: 0, catches: 2 }))).toContain("red-handed");
    expect(newBadges(ctx({ misses: 1 }))).not.toContain("red-handed");
  });

  it("clean-hands needs no false alarms and at least one catch", () => {
    expect(newBadges(ctx({ falseFlags: 0, catches: 1 }))).toContain("clean-hands");
    expect(newBadges(ctx({ falseFlags: 0, catches: 0 }))).not.toContain("clean-hands");
  });

  it("devious-mind needs a perfect devious case", () => {
    expect(newBadges(ctx({ difficulty: "devious", misses: 0, falseFlags: 0 }))).toContain("devious-mind");
    expect(newBadges(ctx({ difficulty: "subtle", misses: 0, falseFlags: 0 }))).not.toContain("devious-mind");
  });

  it("honest-doubt averages the last five scored cases", () => {
    const good = Array.from({ length: 5 }, () => ({ brier: 0.08, confidentMistakes: 0, judgements: 3 }));
    expect(newBadges(ctx({}, { recent: good }))).toContain("honest-doubt");
    expect(newBadges(ctx({}, { recent: good.slice(1) }))).not.toContain("honest-doubt");
    expect(newBadges(ctx({}, { recent: [...good.slice(1), { brier: 0.4, confidentMistakes: 0, judgements: 3 }] }))).not.toContain("honest-doubt");
  });

  it("measured needs ten cases without a confident mistake", () => {
    const clean = Array.from({ length: 10 }, () => ({ brier: 0.2, confidentMistakes: 0, judgements: 3 }));
    expect(newBadges(ctx({}, { recent: clean }))).toContain("measured");
    expect(newBadges(ctx({}, { recent: [...clean.slice(1), { brier: 0.2, confidentMistakes: 1, judgements: 3 }] }))).not.toContain("measured");
  });

  it("polymath, did-the-reading and regular count across cases", () => {
    expect(newBadges(ctx({}, { subjects: ["a", "b", "c", "d", "e"] }))).toContain("polymath");
    expect(newBadges(ctx({}, { totals: { ...emptyStats().totals, notesRounds: 5 } }))).toContain("did-the-reading");
    const daily = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [addDays("2026-10-01", i), { roundId: "x", score: 1, max: 1 }]));
    expect(newBadges(ctx({}, { daily }))).toContain("regular");
  });

  it("off-the-grid and night-owl look at the case itself", () => {
    expect(newBadges(ctx({ engine: "offline" }))).toContain("off-the-grid");
    expect(newBadges(ctx({ engine: "llm" }))).not.toContain("off-the-grid");
    expect(newBadges(ctx({ hour: 2 }))).toContain("night-owl");
    expect(newBadges(ctx({ hour: 4 }))).not.toContain("night-owl");
  });

  it("never awards a badge twice or the ones that haven't shipped", () => {
    const earned = newBadges(ctx({ engine: "offline" }, { badges: { "off-the-grid": { earnedAt: "x" } } }));
    expect(earned).not.toContain("off-the-grid");
    for (const id of ["coroner", "line-up", "root-cause", "recruit"]) expect(newBadges(ctx({ misses: 0, falseFlags: 0, hour: 1 }))).not.toContain(id);
  });

  it("awards the recruit badge directly, once", () => {
    const a = awardBadge(emptyStats(), "recruit", "2026-10-14T00:00:00.000Z");
    expect(a.awarded).toBe(true);
    expect(awardBadge(a.stats, "recruit", "later").awarded).toBe(false);
  });
});

describe("from saved rounds", () => {
  const record = (id: string, playedAt: string, over: Partial<RoundRecord> = {}): RoundRecord => ({
    round: {
      id,
      topic: "Tides",
      topicId: "tides",
      level: "x",
      difficulty: "obvious",
      sentences: [{ id: "s1", text: "a" }],
      createdAt: playedAt,
      engine: "llm",
    },
    submission: { roundId: id, flags: [{ sentenceId: "s1", correction: "b", confidence: 0.9 }], foundAllConfidence: 0.9 },
    result: {
      roundId: id,
      items: [{ sentenceId: "s1", kind: "catch", correctionGrade: "correct", feedback: "", confidence: 0.9, points: 100 }],
      errors: [],
      score: 100,
      maxScore: 100,
    },
    playedAt,
    ...over,
  });

  it("builds an event from a graded record", () => {
    const e = eventFromRecord(record("a", "2026-10-14T01:30:00.000Z"), "UTC")!;
    expect(e).toMatchObject({ roundId: "a", day: "2026-10-14", hour: 1, catches: 1, misses: 0, falseFlags: 0, subject: "tides", source: "ai" });
    expect(e.judgements).toBe(2);
    expect(e.brier).toBeCloseTo(0.01);
  });

  it("has no event for an unfinished round", () => {
    expect(eventFromRecord({ round: record("a", "x").round }, "UTC")).toBeNull();
  });

  it("tells sources apart", () => {
    const base = record("a", "2026-10-14T00:00:00.000Z");
    expect(sourceKind({ ...base, notes: "mine" })).toBe("notes");
    expect(sourceKind({ ...base, round: { ...base.round, source: { label: "Wikipedia: Tide" } } })).toBe("wikipedia");
    expect(sourceKind({ ...base, round: { ...base.round, engine: "offline", source: { label: "Built-in topic: Tides" } } })).toBe("library");
    expect(sourceKind(base)).toBe("ai");
  });

  it("rebuilds stats from history in the order it was played", () => {
    const s = rebuildStats(
      {
        b: record("b", "2026-10-15T12:00:00.000Z"),
        a: record("a", "2026-10-14T12:00:00.000Z"),
        c: record("c", "2026-10-16T12:00:00.000Z"),
        open: { round: record("open", "2026-10-16T12:00:00.000Z").round },
      },
      "UTC",
    );
    expect(s.totals.rounds).toBe(3);
    expect(s.streak.current).toBe(3);
    expect(s.awarded).toEqual(["a", "b", "c"]);
    expect(s.badges["on-the-beat"]).toBeDefined();
  });
});
