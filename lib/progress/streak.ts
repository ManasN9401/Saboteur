// Streak rules (docs/roadmap/v0.3-identity/streaks.md). Pure: the same history always gives the same
// streak. A day counts when at least one round is completed on it.
import type { Streak } from "../profile/schema";
import { addDays, daysBetween, monthOf, weekday } from "./day";

export const MAX_FREEZES = 2;
/** A freeze is earned every this-many days of streak. */
export const FREEZE_EVERY = 7;
/** Rounds in one day that repair a streak broken the day before. */
export const REPAIR_ROUNDS = 3;
export const MILESTONES = [3, 7, 14, 30, 60, 100] as const;

export interface DayOutcome {
  streak: Streak;
  /** The day extended the streak (false for a rest day, a repeat day or a reset). */
  extended: boolean;
  /** Missed days covered by a freeze just now. */
  frozen: string[];
  freezeEarned: boolean;
  /** The streak had to start again from 1. */
  broke: boolean;
  /** A streak milestone reached today (3, 7, 14…). */
  milestone: number | null;
}

/** Apply the first completed round of `day` to the streak. */
export function applyDay(s: Streak, day: string, restDays: number[] = []): DayOutcome {
  const same = { streak: s, extended: false, frozen: [], freezeEarned: false, broke: false, milestone: null };
  if (s.lastDay && daysBetween(s.lastDay, day) <= 0) return same; // already counted, or the past
  const isRest = (d: string) => restDays.includes(weekday(d));

  // Last chance for a broken streak passes once the day after it broke is over.
  let next: Streak = { ...s, broken: s.broken && daysBetween(s.broken.brokeOn, day) <= 1 ? s.broken : null };

  if (!s.lastDay) {
    next = { ...next, current: 1, lastDay: day };
    return finish(next, { extended: true, frozen: [], broke: false });
  }

  const missed: string[] = [];
  for (let d = addDays(s.lastDay, 1); d !== day; d = addDays(d, 1)) if (!isRest(d)) missed.push(d);

  if (missed.length > s.freezes) {
    // Not enough freezes to bridge the gap: don't spend them on a lost cause.
    next = { ...next, current: 1, lastDay: day, broken: { length: s.current, lastDay: s.lastDay, brokeOn: day } };
    return finish(next, { extended: false, frozen: [], broke: true });
  }

  const frozenDays = [...s.frozenDays, ...missed].slice(-60);
  const freezes = s.freezes - missed.length;
  if (isRest(day)) {
    // Playing on a rest day keeps the streak alive without adding to it.
    next = { ...next, freezes, frozenDays, lastDay: day };
    return finish(next, { extended: false, frozen: missed, broke: false });
  }
  next = { ...next, freezes, frozenDays, current: s.current + 1, lastDay: day };
  return finish(next, { extended: true, frozen: missed, broke: false });
}

function finish(s: Streak, o: { extended: boolean; frozen: string[]; broke: boolean }): DayOutcome {
  let streak = { ...s, best: Math.max(s.best, s.current) };
  let freezeEarned = false;
  if (o.extended && streak.current % FREEZE_EVERY === 0 && streak.freezes < MAX_FREEZES) {
    streak = { ...streak, freezes: streak.freezes + 1 };
    freezeEarned = true;
  }
  const milestone = o.extended ? (MILESTONES.find((m) => m === streak.current) ?? null) : null;
  return { streak, ...o, freezeEarned, milestone };
}

/**
 * A broken streak comes back if, by the day after it broke, the player completes three rounds in one
 * day. Once a month at most. `roundsToday` includes the round just completed.
 */
export function tryRepair(s: Streak, day: string, roundsToday: number): { streak: Streak; repaired: boolean } {
  const b = s.broken;
  if (!b || roundsToday < REPAIR_ROUNDS || daysBetween(b.brokeOn, day) > 1 || daysBetween(b.brokeOn, day) < 0) return { streak: s, repaired: false };
  if (s.repairs.includes(monthOf(day))) return { streak: s, repaired: false };
  const current = b.length + s.current;
  return {
    streak: { ...s, current, best: Math.max(s.best, current), broken: null, repairs: [...s.repairs, monthOf(day)].slice(-12) },
    repaired: true,
  };
}

/** What the streak shows today, without playing: a missed day with no freeze left means it's gone. */
export function liveStreak(s: Streak, today: string, restDays: number[] = []): { current: number; atRisk: boolean } {
  if (!s.lastDay) return { current: 0, atRisk: false };
  const gap = daysBetween(s.lastDay, today);
  if (gap <= 0) return { current: s.current, atRisk: false };
  let missed = 0;
  for (let d = addDays(s.lastDay, 1); d !== today; d = addDays(d, 1)) if (!restDays.includes(weekday(d))) missed++;
  if (missed > s.freezes) return { current: 0, atRisk: false };
  return { current: s.current, atRisk: !restDays.includes(weekday(today)) };
}
