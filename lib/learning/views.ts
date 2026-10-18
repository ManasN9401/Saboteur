// Read-only views of the learning data, for the dossier, the menu and the reveal.
import { ERROR_TYPE_LABEL, ERROR_TYPE_PHRASE } from "../errorTypes";
import { BUCKETS } from "../scoring";
import type { ErrorType } from "../schemas";
import { resolveKey } from "./labels";
import { RETIRED_BOX, strengthAt, type RoundFacts } from "./model";
import type { Learning, Misconception, Tally } from "./schema";

/** Below this many bets the calibration numbers are mostly noise, so the views say so. */
export const MIN_BETS = 10;

export const hitRate = (t: Tally) => (t.bets ? t.hits / t.bets : null);
export const meanConfidence = (t: Tally) => (t.bets ? t.conf / t.bets : null);
export const brierOf = (t: Tally) => (t.bets ? t.sq / t.bets : null);
/** Mean confidence minus hit rate, in percentage points: above 0 is overconfident, below is underconfident. */
export const overconfidence = (t: Tally) => (t.bets ? Math.round(((t.conf - t.hits) / t.bets) * 100) : null);

export function calibrationWord(points: number | null): string {
  if (points === null) return "No bets yet";
  if (points >= 15) return "Overconfident";
  if (points >= 6) return "A little overconfident";
  if (points <= -15) return "Underconfident";
  if (points <= -6) return "A little underconfident";
  return "Well calibrated";
}

/** One row per confidence level, 50–100%: how often bets at that level were right. */
export function reliability(learning: Learning) {
  return BUCKETS.map((b) => {
    const t = learning.calibration.buckets[String(b)];
    return { confidence: b, bets: t?.bets ?? 0, accuracy: t ? hitRate(t) : null };
  });
}

/** The mean Brier score of the last `n` rounds, and of the `n` before them (for a trend). */
export function brierTrend(learning: Learning, n = 5) {
  const pts = learning.calibration.brier;
  const mean = (xs: typeof pts) => (xs.length ? xs.reduce((s, p) => s + p.brier, 0) / xs.length : null);
  return { recent: mean(pts.slice(-n)), before: mean(pts.slice(-2 * n, -n)) };
}

export function subjectRows(learning: Learning) {
  return Object.entries(learning.calibration.bySubject)
    .map(([subject, t]) => ({ subject, bets: t.bets, accuracy: hitRate(t), confidence: meanConfidence(t), over: overconfidence(t), brier: brierOf(t) }))
    .sort((a, b) => b.bets - a.bets);
}

export function errorTypeRows(learning: Learning) {
  return Object.entries(learning.calibration.byErrorType)
    .map(([type, t]) => ({ type: type as ErrorType, label: ERROR_TYPE_LABEL[type as ErrorType] ?? type, seen: t.seen, caught: t.caught, rate: t.seen ? t.caught / t.seen : null }))
    .sort((a, b) => (a.rate ?? 1) - (b.rate ?? 1) || b.seen - a.seen);
}

/** Misconceptions that still hold: strongest first. Ones never missed don't count. */
export function topMisconceptions(learning: Learning, at: string, n = 12): (Misconception & { now: number })[] {
  return Object.values(learning.misconceptions)
    .filter((m) => m.missed + m.half > 0)
    .map((m) => ({ ...m, now: strengthAt(m, at) }))
    .sort((a, b) => b.now - a.now || b.missed - a.missed || b.lastSeen.localeCompare(a.lastSeen))
    .slice(0, n);
}

/** In the review queue and due by `at`: the most overdue first. */
export function dueReviews(learning: Learning, at: string): Misconception[] {
  return Object.values(learning.misconceptions)
    .filter((m) => m.review && m.review.box < RETIRED_BOX && m.review.due && m.review.due <= at)
    .sort((a, b) => a.review!.due!.localeCompare(b.review!.due!) || b.missed - a.missed);
}

/** What a review case targets: the most overdue misconception, plus one more due on the same topic. */
export function reviewBatch(learning: Learning, at: string): Misconception[] {
  const [first, ...rest] = dueReviews(learning, at);
  if (!first) return [];
  const partner = rest.find((m) => m.topics[0] === first.topics[0]);
  return partner ? [first, partner] : [first];
}

/** Misconceptions waiting in the review queue, due or not. */
export const queued = (learning: Learning) => Object.values(learning.misconceptions).filter((m) => m.review && m.review.box < RETIRED_BOX).length;

/** The next review that isn't due yet, for "next review in 2 days". */
export function nextReview(learning: Learning, at: string): string | null {
  const dues = Object.values(learning.misconceptions)
    .map((m) => (m.review && m.review.box < RETIRED_BOX ? m.review.due : null))
    .filter((d): d is string => !!d && d > at)
    .sort();
  return dues[0] ?? null;
}

/** "tomorrow", "in 3 days", "on 2 Nov", for a review date. */
export function relativeDay(iso: string, at: string): string {
  const days = Math.ceil((Date.parse(iso) - Date.parse(at)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  return `on ${new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

const ORDINAL = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
const ordinal = (n: number) => ORDINAL[n] ?? `${n}th`;
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
const subjectName = (s: string) => (s === "english" ? "English" : s);
const quote = (s: string) => `“${s.replace(/[.\s]+$/, "")}”`;

/**
 * One sentence for the reveal, from what the profile now knows (learning must already include this
 * round). The most telling fact wins: a repeat miss, then a comeback catch, then a pattern by error
 * type, then calibration.
 */
export function insightFor(learning: Learning, f: RoundFacts): string | null {
  const ms = (o: RoundFacts["outcomes"][number]) => learning.misconceptions[resolveKey(learning, o.label)];
  const missed = f.outcomes.filter((o) => o.outcome !== "caught");
  const repeat = missed.map((o) => ms(o)).filter((m): m is Misconception => !!m && m.missed + m.half >= 2).sort((a, b) => b.missed + b.half - (a.missed + a.half))[0];
  if (repeat) return `That's the ${ordinal(repeat.missed + repeat.half)} time ${quote(repeat.label)} has got past you.`;

  const comeback = f.outcomes
    .filter((o) => o.outcome === "caught")
    .map((o) => ms(o))
    .find((m): m is Misconception => !!m && m.missed + m.half >= 1);
  if (comeback) return `You caught ${quote(comeback.label)} this time, after it got past you ${times(comeback.missed + comeback.half)}.`;

  for (const o of missed) {
    const t = learning.calibration.bySubjectType[`${f.subject}|${o.errorType}`];
    const misses = t ? t.seen - t.caught : 0;
    if (misses >= 2) return `That's the ${ordinal(misses)} time ${ERROR_TYPE_PHRASE[o.errorType]} has got past you in ${subjectName(f.subject)}.`;
  }
  for (const o of missed) {
    const t = learning.calibration.byErrorType[o.errorType];
    const misses = t ? t.seen - t.caught : 0;
    if (misses >= 3) return `That's the ${ordinal(misses)} time ${ERROR_TYPE_PHRASE[o.errorType]} has got past you.`;
  }

  const all = learning.calibration.all;
  const over = overconfidence(all);
  if (all.bets >= MIN_BETS * 2 && over !== null && Math.abs(over) >= 10)
    return over > 0
      ? `Across your cases, your bets run about ${over} points more confident than your hit rate.`
      : `Across your cases, you're right more often than you bet: about ${-over} points underconfident.`;
  return null;
}
