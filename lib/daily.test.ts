import { describe, expect, it } from "vitest";
import { buildDaily, DAILY_ANCHOR, dailyDateOf, dailyDifficulty, dailyEntry, dailyId, dailyInfo, isDailyDate } from "./daily";
import { looksFair } from "./offline/generate";
import { findLibraryEntry, LIBRARY } from "./offline/library";
import { addDays } from "./progress/day";

describe("library", () => {
  it("has at least 30 topics, each with a subject and unique id", () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(30);
    expect(new Set(LIBRARY.map((e) => e.id)).size).toBe(LIBRARY.length);
    for (const e of LIBRARY) expect(e.subject, e.id).toMatch(/\w/);
  });

  it("spreads topics over at least eight subjects", () => {
    expect(new Set(LIBRARY.map((e) => e.subject)).size).toBeGreaterThanOrEqual(8);
  });

  it("gives every topic 10+ sentences and 3+ curated errors that pass the fairness check", () => {
    for (const e of LIBRARY) {
      expect(e.sentences.length, e.id).toBeGreaterThanOrEqual(10);
      const errors = Object.entries(e.errors);
      expect(errors.length, e.id).toBeGreaterThanOrEqual(3);
      for (const [i, err] of errors) {
        const original = e.sentences[Number(i)];
        expect(original, `${e.id} #${i}`).toBeDefined();
        const planted = { sentenceId: "s", originalSentence: original, sabotagedSentence: err.sabotaged, errorType: err.type, explanation: err.explanation, whyTempting: err.tempting, misconceptionLabel: err.label };
        expect(looksFair(planted), `${e.id} #${i}: ${err.sabotaged}`).toBe(true);
        expect(err.explanation.length).toBeGreaterThan(20);
      }
    }
  });

  it("finds every topic by its own title", () => {
    for (const e of LIBRARY) expect(findLibraryEntry(e.title)?.id, e.title).toBe(e.id);
  });

  it("still finds the original topics by their keywords", () => {
    expect(findLibraryEntry("chloroplasts")?.id).toBe("photosynthesis");
    expect(findLibraryEntry("half-life")?.id).toBe("radioactivity");
    expect(findLibraryEntry("binary search")?.id).toBe("sorting");
    expect(findLibraryEntry("hexadecimal")?.id).toBe("binary");
  });
});

describe("daily case", () => {
  it("is identical for the same date, every time", async () => {
    const a = await buildDaily("2026-10-16");
    const b = await buildDaily("2026-10-16");
    expect(a).toEqual(b);
    expect(a.round.id).toBe("daily-2026-10-16");
    expect(a.round.createdAt).toBe("2026-10-16T00:00:00.000Z");
    expect(a.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("uses the library topic and the weekday difficulty", async () => {
    const { round } = await buildDaily("2026-10-19"); // a Monday
    expect(round.topic).toBe(dailyEntry("2026-10-19").title);
    expect(round.difficulty).toBe("obvious");
    expect(round.subject).toBe(dailyEntry("2026-10-19").subject);
  });

  it("sets difficulty by weekday", () => {
    expect(dailyDifficulty("2026-10-19")).toBe("obvious"); // Mon
    expect(dailyDifficulty("2026-10-20")).toBe("obvious"); // Tue
    expect(dailyDifficulty("2026-10-21")).toBe("subtle"); // Wed
    expect(dailyDifficulty("2026-10-22")).toBe("subtle"); // Thu
    expect(dailyDifficulty("2026-10-23")).toBe("devious"); // Fri
    expect(dailyDifficulty("2026-10-25")).toBe("devious"); // Sun
  });

  it("never repeats a subject within four days, over a year", () => {
    const subjects = Array.from({ length: 365 }, (_, i) => dailyEntry(addDays(DAILY_ANCHOR, i)).subject);
    for (let i = 0; i < subjects.length; i++) {
      const window = subjects.slice(Math.max(0, i - 3), i);
      expect(window, `day ${i}`).not.toContain(subjects[i]);
    }
  });

  it("varies the topic: no repeat within three weeks", () => {
    const ids = Array.from({ length: 200 }, (_, i) => dailyEntry(addDays(DAILY_ANCHOR, i)).id);
    for (let i = 0; i < ids.length; i++) expect(ids.slice(Math.max(0, i - 21), i)).not.toContain(ids[i]);
  });

  it("gives the same rotation however the dates are first asked for", () => {
    const later = dailyEntry("2027-03-01").id;
    expect(dailyEntry("2027-03-01").id).toBe(later);
    expect(dailyInfo("2027-03-01").topic).toBe(dailyEntry("2027-03-01").title);
  });

  it("only opens dates up to tomorrow", () => {
    const now = new Date("2026-10-16T12:00:00Z");
    expect(isDailyDate("2026-10-16", now)).toBe(true);
    expect(isDailyDate("2026-10-17", now)).toBe(true);
    expect(isDailyDate("2026-10-18", now)).toBe(false);
    expect(isDailyDate("2025-12-31", now)).toBe(false);
    expect(isDailyDate("nope", now)).toBe(false);
  });

  it("round-trips its id", () => {
    expect(dailyDateOf(dailyId("2026-10-16"))).toBe("2026-10-16");
    expect(dailyDateOf("rnd_123")).toBeNull();
  });
});
