import { describe, expect, it } from "vitest";
import { dayKey } from "./progress/day";
import { elapsedOf, finish, formatClock, freshTimer, isActive, isRunning, lap, leftOf, nextPhase, pause, reset, setMode, setSettings, setTimerLength, start, TimerSchema, todayTally } from "./timer";

const MIN = 60_000;
const T0 = new Date("2026-10-16T09:00:00").getTime();

describe("focus timer", () => {
  it("starts at the full focus length and counts down from an end time", () => {
    const t = start(freshTimer(), T0);
    expect(t.endsAt).toBe(T0 + 25 * MIN);
    expect(leftOf(t, T0 + 5 * MIN)).toBe(20 * MIN);
    expect(isRunning(t)).toBe(true);
  });

  it("pauses with the time left, and resumes from it", () => {
    let t = start(freshTimer(), T0);
    t = pause(t, T0 + 10 * MIN);
    expect(t.endsAt).toBeNull();
    expect(t.left).toBe(15 * MIN);
    expect(leftOf(t, T0 + 60 * MIN)).toBe(15 * MIN); // paused: time doesn't pass
    t = start(t, T0 + 60 * MIN);
    expect(t.endsAt).toBe(T0 + 75 * MIN);
  });

  it("goes focus → short break → … → long break after the set rounds → focus round 1", () => {
    let t = freshTimer();
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) {
      seen.push(`${t.phase}${t.round}`);
      t = { ...t, ...nextPhase(t) };
    }
    expect(seen).toEqual(["focus1", "short1", "focus2", "short2", "focus3", "short3", "focus4", "long4"]);
    expect([t.phase, t.round]).toEqual(["focus", 1]); // after the long break, a new cycle
  });

  it("counts a finished focus round for today and starts the break by itself", () => {
    const t = finish(start(freshTimer(), T0), T0 + 25 * MIN);
    expect(t.phase).toBe("short");
    expect(t.endsAt).toBe(T0 + 30 * MIN);
    expect(todayTally(t, T0)).toBe(1);
    expect(t.tally[dayKey(T0)]).toBe(1);
  });

  it("waits at the next phase when auto-start is off", () => {
    const t0 = setSettings(freshTimer(), { autoStart: false });
    const t = finish(start(t0, T0), T0 + 25 * MIN);
    expect(t.phase).toBe("short");
    expect(isRunning(t)).toBe(false);
    expect(leftOf(t, T0)).toBe(5 * MIN);
  });

  it("doesn't count a skipped focus round, and doesn't auto-start after a skip", () => {
    const t = finish(start(freshTimer(), T0), T0 + MIN, { skipped: true });
    expect(t.phase).toBe("short");
    expect(todayTally(t, T0)).toBe(0);
    expect(isRunning(t)).toBe(false);
  });

  it("uses new lengths for an idle countdown straight away", () => {
    const t = setSettings(freshTimer(), { focus: 50 });
    expect(leftOf(t, T0)).toBe(50 * MIN);
  });

  it("rejects silly settings rather than storing them", () => {
    expect(() => setSettings(freshTimer(), { focus: 0 })).toThrow();
  });
});

describe("plain timer", () => {
  it("sets a length, runs, and goes idle when done", () => {
    let t = setTimerLength(freshTimer(), 10);
    expect(t.mode).toBe("timer");
    t = start(t, T0);
    expect(leftOf(t, T0 + MIN)).toBe(9 * MIN);
    t = finish(t, T0 + 10 * MIN);
    expect(isActive(t)).toBe(false);
    expect(leftOf(t, T0)).toBe(10 * MIN);
  });

  it("switching mode stops a countdown under way", () => {
    const t = setMode(start(freshTimer(), T0), "timer");
    expect(t.mode).toBe("timer");
    expect(isActive(t)).toBe(false);
  });
});

describe("stopwatch", () => {
  it("runs, pauses, keeps laps, resets", () => {
    let t = setMode(freshTimer(), "stopwatch");
    t = start(t, T0);
    t = lap(t, T0 + 1500);
    t = pause(t, T0 + 4000);
    expect(elapsedOf(t, T0 + 99_000)).toBe(4000);
    t = start(t, T0 + 10_000);
    expect(elapsedOf(t, T0 + 11_000)).toBe(5000);
    expect(t.laps).toEqual([1500]);
    t = reset(t);
    expect(isActive(t)).toBe(false);
    expect(t.laps).toEqual([]);
  });
});

describe("storage shape", () => {
  it("fills in defaults for an old or partial blob", () => {
    const t = TimerSchema.parse({ mode: "timer", settings: { focus: 30 } });
    expect(t.settings.focus).toBe(30);
    expect(t.settings.short).toBe(5);
    expect(t.timerMin).toBe(10);
  });
});

describe("formatClock", () => {
  it("shows minutes and seconds, hours when needed, rounding a countdown up", () => {
    expect(formatClock(25 * MIN)).toBe("25:00");
    expect(formatClock(59_001)).toBe("1:00");
    expect(formatClock(61 * MIN)).toBe("1:01:00");
    expect(formatClock(65_400, { tenths: true })).toBe("1:05.4");
  });
});
