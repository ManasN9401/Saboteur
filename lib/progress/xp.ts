// XP and investigator ranks. The numbers are the flexible part of the spec; keep them here.

export const XP = {
  roundMin: 10,
  pointsRate: 0.5,
  perfect: 40,
  daily: 50,
  calibration: 20,
  /** Streak milestone bonuses. */
  milestone: { 3: 30, 7: 75, 14: 150, 30: 300, 60: 600, 100: 1000 } as Record<number, number>,
} as const;

/** Good calibration: Brier ≤ this over at least `calibrationMinBets` bets. */
export const CALIBRATION = { brier: 0.15, minBets: 3 } as const;

export function roundXp(points: number): number {
  return Math.max(XP.roundMin, Math.round(points * XP.pointsRate));
}

/** Total XP needed to reach a level: 100 × level^1.6 (level 0 needs nothing). */
export function xpFor(level: number): number {
  return level <= 0 ? 0 : Math.round(100 * level ** 1.6);
}

export function levelFor(xp: number): number {
  let level = 0;
  while (xpFor(level + 1) <= xp) level++;
  return level;
}

export const RANKS = [
  { name: "Recruit", from: 0 },
  { name: "Constable", from: 1 },
  { name: "Detective", from: 3 },
  { name: "Inspector", from: 6 },
  { name: "Chief Inspector", from: 10 },
  { name: "Spymaster", from: 15 },
] as const;
export type RankName = (typeof RANKS)[number]["name"];

export function rankFor(level: number): RankName {
  return [...RANKS].reverse().find((r) => level >= r.from)!.name;
}

/** Everything a progress bar needs. */
export function progressOf(xp: number) {
  const level = levelFor(xp);
  const floor = xpFor(level);
  const ceiling = xpFor(level + 1);
  return { xp, level, rank: rankFor(level), floor, ceiling, fraction: (xp - floor) / (ceiling - floor) };
}
