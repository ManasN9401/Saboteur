// One event moves progress: a round completed. Pure: (stats, event) → (stats, what changed), so the
// round-end strip can show exactly what happened and tests can replay any history.
import { emptyStats, type Stats } from "../profile/schema";
import type { Difficulty } from "../schemas";
import { brierScore, confidentMistakes, roundJudgements } from "../scoring";
import type { RoundRecord } from "../storage/schemas";
import { newBadges } from "./badges";
import { dayKey, daysBetween, localHour } from "./day";
import { applyDay, tryRepair } from "./streak";
import { CALIBRATION, levelFor, rankFor, roundXp, XP, type RankName } from "./xp";

export interface CompletionEvent {
  roundId: string;
  /** When it was completed (ISO) and where: the local day and hour come from these. */
  at: string;
  tz: string;
  day: string;
  hour: number;
  topic: string;
  subject: string;
  difficulty: Difficulty;
  points: number;
  maxScore: number;
  catches: number;
  misses: number;
  falseFlags: number;
  judgements: number;
  brier: number | null;
  confidentMistakes: number;
  source: "notes" | "wikipedia" | "library" | "ai";
  engine: "llm" | "offline";
  /** The daily case's date, when this round is one. */
  daily?: string;
  replay?: boolean;
}

export interface XpPart {
  label: string;
  xp: number;
}

export interface ProgressDelta {
  roundId: string;
  /** Why nothing was awarded, if it wasn't. */
  skipped?: "already-counted" | "replay" | "daily-replay" | "clock";
  xp: number;
  parts: XpPart[];
  xpBefore: number;
  xpAfter: number;
  levelBefore: number;
  levelAfter: number;
  rankBefore: RankName;
  rankAfter: RankName;
  streak: { before: number; after: number; extended: boolean; frozen: string[]; freezeEarned: boolean; broke: boolean; repaired: boolean };
  day: string;
  daily: boolean;
  badges: string[];
}

const AWARDED_CAP = 400;
const RECENT_CAP = 20;

export function sourceKind(record: RoundRecord): CompletionEvent["source"] {
  const label = record.round.source?.label ?? "";
  if (record.notes || label === "Your notes") return "notes";
  if (label.startsWith("Wikipedia")) return "wikipedia";
  if (label.startsWith("Built-in")) return "library";
  return record.round.engine === "offline" ? "library" : "ai";
}

/** Build the event for a graded round. Null if the round has no result yet. */
export function eventFromRecord(record: RoundRecord, tz: string, at = record.playedAt ?? new Date().toISOString()): CompletionEvent | null {
  const { round, result, submission } = record;
  if (!result || !submission) return null;
  if (Number.isNaN(Date.parse(at))) at = round.createdAt;
  if (Number.isNaN(Date.parse(at))) return null;
  const count = (k: string) => result.items.filter((i) => i.kind === k).length;
  const judgements = roundJudgements(result.items, submission.foundAllConfidence);
  const cm = confidentMistakes(result.items, submission.foundAllConfidence);
  return {
    roundId: round.id,
    at,
    tz,
    day: dayKey(at, tz),
    hour: localHour(at, tz),
    topic: round.topic,
    subject: round.subject ?? round.topicId,
    difficulty: round.difficulty,
    points: result.score,
    maxScore: result.maxScore,
    catches: count("catch"),
    misses: count("miss"),
    falseFlags: count("false_flag"),
    judgements: judgements.length,
    brier: brierScore(judgements),
    confidentMistakes: cm.falseFlags.length + cm.missedWhileSure.length,
    source: sourceKind(record),
    engine: round.engine ?? "llm",
    daily: record.daily,
    replay: !!record.replayOf,
  };
}

/** Award a badge outside a round (e.g. the recruit tutorial). */
export function awardBadge(stats: Stats, id: string, at: string): { stats: Stats; awarded: boolean } {
  if (stats.badges[id]) return { stats, awarded: false };
  return { stats: { ...stats, badges: { ...stats.badges, [id]: { earnedAt: at } } }, awarded: true };
}

export function roundCompleted(stats: Stats, e: CompletionEvent, opts: { restDays?: number[] } = {}): { stats: Stats; delta: ProgressDelta } {
  const levelBefore = levelFor(stats.xp);
  const base: ProgressDelta = {
    roundId: e.roundId,
    xp: 0,
    parts: [],
    xpBefore: stats.xp,
    xpAfter: stats.xp,
    levelBefore,
    levelAfter: levelBefore,
    rankBefore: rankFor(levelBefore),
    rankAfter: rankFor(levelBefore),
    streak: { before: stats.streak.current, after: stats.streak.current, extended: false, frozen: [], freezeEarned: false, broke: false, repaired: false },
    day: e.day,
    daily: false,
    badges: [],
  };
  if (stats.awarded.includes(e.roundId)) return { stats, delta: { ...base, skipped: "already-counted" } };
  const awarded = [...stats.awarded, e.roundId].slice(-AWARDED_CAP);
  if (e.replay) return { stats: { ...stats, awarded }, delta: { ...base, skipped: "replay" } };
  if (e.daily && stats.daily[e.daily]) return { stats: { ...stats, awarded }, delta: { ...base, skipped: "daily-replay" } };

  // A device clock that jumped back more than a day: count the round, award nothing.
  if (stats.lastSeenAt && Date.parse(e.at) < Date.parse(stats.lastSeenAt) - 86_400_000) {
    const totals = { ...stats.totals, rounds: stats.totals.rounds + 1 };
    console.warn("[saboteur] The device clock went backwards; this round earns no progress.");
    return { stats: { ...stats, totals, awarded }, delta: { ...base, skipped: "clock" } };
  }

  const perfect = e.misses === 0 && e.falseFlags === 0 && e.catches > 0;
  const days = { ...stats.days, [e.day]: (stats.days[e.day] ?? 0) + 1 };
  // Keep about four months of day counts: enough for the heat map and repairs.
  for (const d of Object.keys(days)) if (daysBetween(d, e.day) > 120) delete days[d];

  const day = applyDay(stats.streak, e.day, opts.restDays);
  const repair = tryRepair(day.streak, e.day, days[e.day]);
  const streak = repair.streak;

  const parts: XpPart[] = [{ label: "Case closed", xp: roundXp(e.points) }];
  if (perfect) parts.push({ label: "Perfect case", xp: XP.perfect });
  const isDaily = !!e.daily;
  if (isDaily) parts.push({ label: "Daily case", xp: XP.daily });
  if (e.brier !== null && e.judgements >= CALIBRATION.minBets && e.brier <= CALIBRATION.brier) parts.push({ label: "Well calibrated", xp: XP.calibration });
  if (day.milestone) parts.push({ label: `${day.milestone}-day streak`, xp: XP.milestone[day.milestone] });
  const gained = parts.reduce((n, p) => n + p.xp, 0);

  const best = !stats.best || e.points / Math.max(1, e.maxScore) > stats.best.score / Math.max(1, stats.best.max) ? { roundId: e.roundId, score: e.points, max: e.maxScore, topic: e.topic } : stats.best;
  let next: Stats = {
    ...stats,
    xp: stats.xp + gained,
    streak,
    daily: isDaily ? { ...stats.daily, [e.daily!]: { roundId: e.roundId, score: e.points, max: e.maxScore } } : stats.daily,
    totals: {
      rounds: stats.totals.rounds + 1,
      catches: stats.totals.catches + e.catches,
      misses: stats.totals.misses + e.misses,
      falseFlags: stats.totals.falseFlags + e.falseFlags,
      perfectRounds: stats.totals.perfectRounds + (perfect ? 1 : 0),
      notesRounds: stats.totals.notesRounds + (e.source === "notes" ? 1 : 0),
    },
    days,
    recent: [...stats.recent, { brier: e.brier, confidentMistakes: e.confidentMistakes, judgements: e.judgements }].slice(-RECENT_CAP),
    subjects: stats.subjects.includes(e.subject) ? stats.subjects : [...stats.subjects, e.subject].slice(-50),
    best,
    awarded,
    lastSeenAt: !stats.lastSeenAt || e.at > stats.lastSeenAt ? e.at : stats.lastSeenAt,
  };
  const badges = newBadges({ stats: next, event: e, repaired: repair.repaired });
  if (badges.length) next = { ...next, badges: { ...next.badges, ...Object.fromEntries(badges.map((id) => [id, { earnedAt: e.at }])) } };

  const levelAfter = levelFor(next.xp);
  return {
    stats: next,
    delta: {
      ...base,
      xp: gained,
      parts,
      xpAfter: next.xp,
      levelAfter,
      rankAfter: rankFor(levelAfter),
      streak: {
        before: stats.streak.current,
        after: streak.current,
        extended: day.extended || repair.repaired,
        frozen: day.frozen,
        freezeEarned: day.freezeEarned,
        broke: day.broke && !repair.repaired,
        repaired: repair.repaired,
      },
      daily: isDaily,
      badges,
    },
  };
}

/** Rebuild stats from saved rounds, oldest first: used when v1 data is migrated. */
export function rebuildStats(records: Record<string, RoundRecord>, tz: string): Stats {
  const done = Object.values(records)
    .filter((r) => r.result && r.submission)
    .sort((a, b) => (a.playedAt ?? a.round.createdAt).localeCompare(b.playedAt ?? b.round.createdAt));
  let stats = emptyStats();
  for (const r of done) {
    const e = eventFromRecord(r, tz, r.playedAt ?? r.round.createdAt);
    if (e) stats = roundCompleted(stats, e).stats;
  }
  return stats;
}
