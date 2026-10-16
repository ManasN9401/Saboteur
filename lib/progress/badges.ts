// The badge list, as data (docs/roadmap/v0.3-identity/streaks.md#badges). Art is in public/assets/badges.
import type { Stats } from "../profile/schema";
import type { CompletionEvent } from "./events";

export interface BadgeContext {
  /** Stats after this round has been counted. */
  stats: Stats;
  event: CompletionEvent;
  repaired: boolean;
}

export interface Badge {
  id: string;
  name: string;
  /** How to earn it, shown on the corkboard. */
  description: string;
  /** Badges for features that haven't shipped yet stay on the board as a promise, greyed out. */
  later?: string;
  test: (c: BadgeContext) => boolean;
}

const recentWith = (s: Stats, n: number) => s.recent.slice(-n);

export const BADGES: Badge[] = [
  { id: "recruit", name: "Recruit", description: "Finish the briefing for new recruits.", test: () => false },
  { id: "first-case", name: "First case", description: "Close your first case.", test: ({ stats }) => stats.totals.rounds >= 1 },
  { id: "red-handed", name: "Red-handed", description: "Catch every planted error in a case.", test: ({ event: e }) => e.misses === 0 && e.catches > 0 },
  { id: "clean-hands", name: "Clean hands", description: "Close a case without a single false alarm.", test: ({ event: e }) => e.falseFlags === 0 && e.catches > 0 },
  {
    id: "devious-mind",
    name: "Devious mind",
    description: "A perfect case on Devious.",
    test: ({ event: e }) => e.difficulty === "devious" && e.misses === 0 && e.falseFlags === 0 && e.catches > 0,
  },
  {
    id: "honest-doubt",
    name: "Honest doubt",
    description: "Average Brier score of 0.10 or better over five cases.",
    test: ({ stats }) => {
      const scored = stats.recent.filter((r) => r.brier !== null).slice(-5);
      return scored.length === 5 && scored.reduce((n, r) => n + r.brier!, 0) / 5 <= 0.1;
    },
  },
  {
    id: "measured",
    name: "Measured",
    description: "Ten cases in a row without a confident mistake.",
    test: ({ stats }) => recentWith(stats, 10).length === 10 && recentWith(stats, 10).every((r) => r.confidentMistakes === 0),
  },
  { id: "on-the-beat", name: "On the beat", description: "A 3-day streak.", test: ({ stats }) => stats.streak.current >= 3 },
  { id: "week-on-the-case", name: "Week on the case", description: "A 7-day streak.", test: ({ stats }) => stats.streak.current >= 7 },
  { id: "stakeout", name: "Month-long stakeout", description: "A 30-day streak.", test: ({ stats }) => stats.streak.current >= 30 },
  { id: "centurion", name: "Centurion", description: "A 100-day streak.", test: ({ stats }) => stats.streak.current >= 100 },
  { id: "regular", name: "Regular", description: "Seven daily cases.", test: ({ stats }) => Object.keys(stats.daily).length >= 7 },
  { id: "polymath", name: "Polymath", description: "Cases in five different subjects.", test: ({ stats }) => stats.subjects.length >= 5 },
  { id: "did-the-reading", name: "Did the reading", description: "Five cases built from your own notes.", test: ({ stats }) => stats.totals.notesRounds >= 5 },
  { id: "off-the-grid", name: "Off the grid", description: "Close a case built offline, without AI.", test: ({ event: e }) => e.engine === "offline" },
  { id: "night-owl", name: "Night owl", description: "Close a case between midnight and 4 am.", test: ({ event: e }) => e.hour >= 0 && e.hour < 4 },
  { id: "comeback", name: "Comeback", description: "Repair a broken streak with three cases in a day.", test: ({ repaired }) => repaired },
  { id: "coroner", name: "Coroner", description: "Your first autopsy.", later: "Arrives with Autopsy", test: () => false },
  { id: "line-up", name: "Line-up", description: "Your first confusables drill.", later: "Arrives with drills", test: () => false },
  { id: "root-cause", name: "Root cause", description: "Your first root-gap trace.", later: "Arrives with Root Gap", test: () => false },
];

export const BADGE_BY_ID = Object.fromEntries(BADGES.map((b) => [b.id, b]));

export const badgeArt = (id: string) => `/assets/badges/${id}.webp`;

/** Badges newly earned by this round, in board order. */
export function newBadges(c: BadgeContext): string[] {
  return BADGES.filter((b) => !c.stats.badges[b.id] && b.test(c)).map((b) => b.id);
}
