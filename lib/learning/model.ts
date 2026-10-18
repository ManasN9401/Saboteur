// Learning from a graded round. Pure: (learning, facts) → learning, so any history can be replayed in
// tests, rebuilt from saved rounds, or merged after label normalisation.
import { roundJudgements, type Judgement } from "../scoring";
import type { ErrorType } from "../schemas";
import type { RoundRecord } from "../storage/schemas";
import { resolveKey } from "./labels";
import { emptyLearning, type Calibration, type Learning, type Misconception, type Outcome, type Tally } from "./schema";

/** A misconception's strength halves after this many days without being seen again. */
export const HALF_LIFE_DAYS = 10;
/** How much one sighting moves its strength. A confident miss adds CONFIDENT_EXTRA on top. */
export const WEIGHT: Record<Outcome, number> = { missed: 1, half: 0.5, caught: -0.5 };
export const CONFIDENT_EXTRA = 0.5;
/** Days until a misconception in Leitner box 0, 1, 2, 3 is due again. Box 4 is retired. */
export const INTERVALS = [1, 3, 7, 16] as const;
export const RETIRED_BOX = INTERVALS.length;

const MAX_MISCONCEPTIONS = 60;
const MAX_HISTORY = 4;
const MAX_TEXT = 400;
const COUNTED_CAP = 400;
const BRIER_CAP = 60;
const DAY_MS = 86_400_000;

export interface ErrorOutcome {
  label: string;
  errorType: ErrorType;
  outcome: Outcome;
  confidence?: number;
  confidentWrong: boolean;
  original: string;
  sabotaged: string;
  explanation: string;
  whyTempting: string;
}

/** Everything one graded round tells us. */
export interface RoundFacts {
  roundId: string;
  at: string;
  topic: string;
  subject: string;
  level: string;
  outcomes: ErrorOutcome[];
  judgements: Judgement[];
  review: boolean;
}

const clip = (s: string) => (s.length > MAX_TEXT ? s.slice(0, MAX_TEXT - 1) + "…" : s);
const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY_MS).toISOString();
const daysSince = (from: string, to: string) => Math.max(0, (Date.parse(to) - Date.parse(from)) / DAY_MS);

/** A misconception's strength now: it fades by half every HALF_LIFE_DAYS. */
export function strengthAt(m: Pick<Misconception, "strength" | "strengthAt">, at: string): number {
  return m.strength * 0.5 ** (daysSince(m.strengthAt, at) / HALF_LIFE_DAYS);
}

export function factsFromRecord(record: RoundRecord): RoundFacts | null {
  const { round, result, submission } = record;
  if (!result || !submission) return null;
  const at = record.playedAt ?? round.createdAt;
  const confidentAll = submission.foundAllConfidence >= 0.8;
  const outcomes = result.errors.map((e): ErrorOutcome => {
    const item = result.items.find((i) => i.sentenceId === e.sentenceId && i.kind !== "false_flag");
    const outcome: Outcome = item?.kind === "catch" ? (item.correctionGrade === "incorrect" ? "half" : "caught") : "missed";
    return {
      label: e.misconceptionLabel,
      errorType: e.errorType,
      outcome,
      confidence: outcome === "missed" ? undefined : item?.confidence,
      confidentWrong: outcome === "missed" && confidentAll,
      original: e.originalSentence,
      sabotaged: e.sabotagedSentence,
      explanation: e.explanation,
      whyTempting: e.whyTempting,
    };
  });
  return {
    roundId: round.id,
    at,
    topic: round.topic,
    // Library topics carry a school subject; anything else is filed under its own topic.
    subject: round.subject ?? round.topic,
    level: round.level,
    outcomes,
    judgements: roundJudgements(result.items, submission.foundAllConfidence),
    review: !!record.review,
  };
}

function addTally(t: Tally | undefined, j: Judgement): Tally {
  const base = t ?? { bets: 0, hits: 0, conf: 0, sq: 0 };
  return { bets: base.bets + 1, hits: base.hits + (j.correct ? 1 : 0), conf: base.conf + j.confidence, sq: base.sq + (j.confidence - (j.correct ? 1 : 0)) ** 2 };
}

function learnCalibration(c: Calibration, f: RoundFacts): Calibration {
  const next: Calibration = { ...c, buckets: { ...c.buckets }, bySubject: { ...c.bySubject }, byErrorType: { ...c.byErrorType }, bySubjectType: { ...c.bySubjectType } };
  for (const j of f.judgements) {
    next.all = addTally(next.all, j);
    const b = String(Math.round(j.confidence * 10) * 10);
    next.buckets[b] = addTally(next.buckets[b], j);
    next.bySubject[f.subject] = addTally(next.bySubject[f.subject], j);
  }
  for (const o of f.outcomes) {
    const hit = o.outcome === "missed" ? 0 : 1;
    const t = next.byErrorType[o.errorType] ?? { seen: 0, caught: 0 };
    next.byErrorType[o.errorType] = { seen: t.seen + 1, caught: t.caught + hit };
    const k = `${f.subject}|${o.errorType}`;
    const st = next.bySubjectType[k] ?? { seen: 0, caught: 0 };
    next.bySubjectType[k] = { seen: st.seen + 1, caught: st.caught + hit };
  }
  if (f.judgements.length) {
    const brier = f.judgements.reduce((n, j) => n + (j.confidence - (j.correct ? 1 : 0)) ** 2, 0) / f.judgements.length;
    next.brier = [...c.brier, { roundId: f.roundId, at: f.at, brier: +brier.toFixed(4), bets: f.judgements.length }].slice(-BRIER_CAP);
  }
  return next;
}

/** The Leitner step: a miss sends it back to box 0; a catch once it's due moves it up a box. */
function nextReview(m: Misconception, outcome: Outcome, at: string): { review: Misconception["review"]; retired: boolean } {
  if (outcome !== "caught") return { review: { box: 0, due: addDays(at, INTERVALS[0]) }, retired: false };
  const r = m.review;
  if (!r || r.box >= RETIRED_BOX || !r.due || r.due > at) return { review: r, retired: false };
  const box = r.box + 1;
  if (box >= RETIRED_BOX) return { review: { box: RETIRED_BOX, due: null }, retired: true };
  return { review: { box, due: addDays(at, INTERVALS[box]) }, retired: false };
}

function sight(m: Misconception | undefined, key: string, o: ErrorOutcome, f: RoundFacts): { m: Misconception; retired: boolean } {
  const base: Misconception = m ?? {
    key,
    label: o.label,
    errorType: o.errorType,
    subjects: [],
    topics: [],
    level: f.level,
    seen: 0,
    caught: 0,
    half: 0,
    missed: 0,
    confidentWrong: 0,
    firstSeen: f.at,
    lastSeen: f.at,
    strength: 0,
    strengthAt: f.at,
    review: null,
    history: [],
    autopsy: null,
  };
  const { review, retired } = nextReview(base, o.outcome, f.at);
  const strength = Math.max(0, strengthAt(base, f.at) + WEIGHT[o.outcome] + (o.confidentWrong ? CONFIDENT_EXTRA : 0));
  const sighting = {
    roundId: f.roundId,
    source: "round" as const,
    at: f.at,
    topic: f.topic,
    outcome: o.outcome,
    confidence: o.confidence,
    original: clip(o.original),
    sabotaged: clip(o.sabotaged),
    explanation: clip(o.explanation),
    whyTempting: clip(o.whyTempting),
  };
  return {
    retired,
    m: {
      ...base,
      subjects: [f.subject, ...base.subjects.filter((s) => s !== f.subject)].slice(0, 5),
      topics: [f.topic, ...base.topics.filter((t) => t !== f.topic)].slice(0, 5),
      level: f.level,
      seen: base.seen + 1,
      caught: base.caught + (o.outcome === "caught" ? 1 : 0),
      half: base.half + (o.outcome === "half" ? 1 : 0),
      missed: base.missed + (o.outcome === "missed" ? 1 : 0),
      confidentWrong: base.confidentWrong + (o.confidentWrong ? 1 : 0),
      lastSeen: f.at > base.lastSeen ? f.at : base.lastSeen,
      strength: +strength.toFixed(4),
      strengthAt: f.at,
      review,
      history: [...base.history, sighting].slice(-MAX_HISTORY),
    },
  };
}

/** Keep the profile small: drop retired and faded misconceptions first, never one waiting in the queue. */
function prune(all: Record<string, Misconception>, at: string): Record<string, Misconception> {
  const list = Object.values(all);
  if (list.length <= MAX_MISCONCEPTIONS) return all;
  const queued = (m: Misconception) => !!m.review && m.review.box < RETIRED_BOX;
  const keep = list
    .sort((a, b) => Number(queued(b)) - Number(queued(a)) || strengthAt(b, at) - strengthAt(a, at) || b.lastSeen.localeCompare(a.lastSeen))
    .slice(0, MAX_MISCONCEPTIONS);
  return Object.fromEntries(keep.map((m) => [m.key, m]));
}

export function learnFromRound(learning: Learning, f: RoundFacts): Learning {
  if (learning.counted.includes(f.roundId)) return learning;
  const misconceptions = { ...learning.misconceptions };
  let retired = 0;
  for (const o of f.outcomes) {
    const key = resolveKey(learning, o.label);
    const s = sight(misconceptions[key], key, o, f);
    misconceptions[key] = s.m;
    if (s.retired) retired++;
  }
  return {
    ...learning,
    misconceptions: prune(misconceptions, f.at),
    calibration: learnCalibration(learning.calibration, f),
    counted: [...learning.counted, f.roundId].slice(-COUNTED_CAP),
    reviews: { closed: learning.reviews.closed + (f.review ? 1 : 0), retired: learning.reviews.retired + retired },
  };
}

/** Learn from saved rounds, oldest first: the first time a profile opens with v0.6. */
export function buildLearning(records: Record<string, RoundRecord>, start: Learning = emptyLearning()): Learning {
  return Object.values(records)
    .map(factsFromRecord)
    .filter((f): f is RoundFacts => !!f)
    .sort((a, b) => a.at.localeCompare(b.at))
    .reduce(learnFromRound, start);
}

/** Two autopsy records for one belief: the history interleaves; an open confirmation outranks the rest. */
function mergeAutopsy(a: Misconception["autopsy"], b: Misconception["autopsy"]): Misconception["autopsy"] {
  if (!a || !b) return a ?? b;
  const rank = { confirmed: 2, resolved: 1, rejected: 0 } as const;
  return { status: rank[a.status] > rank[b.status] ? a.status : b.status, history: [...a.history, ...b.history].sort((x, y) => x.at.localeCompare(y.at)).slice(-8) };
}

/**
 * Fold one label into another (normalisation said they're the same belief). The counts add up, the
 * history interleaves, and the review state is the more urgent of the two.
 */
export function mergeInto(learning: Learning, from: string, to: string): Learning {
  if (from === to) return learning;
  const a = learning.misconceptions[from];
  const b = learning.misconceptions[to];
  const aliases = { ...learning.aliases, [from]: to };
  const misconceptions = { ...learning.misconceptions };
  delete misconceptions[from];
  if (a && !b) misconceptions[to] = { ...a, key: to };
  else if (a && b) {
    const at = a.lastSeen > b.lastSeen ? a.lastSeen : b.lastSeen;
    const reviews = [a.review, b.review].filter((r) => r && r.box < RETIRED_BOX) as NonNullable<Misconception["review"]>[];
    const review = reviews.length ? reviews.sort((x, y) => x.box - y.box || (x.due ?? "").localeCompare(y.due ?? ""))[0] : (b.review ?? a.review);
    misconceptions[to] = {
      ...b,
      subjects: [...new Set([...b.subjects, ...a.subjects])].slice(0, 5),
      topics: [...new Set([...b.topics, ...a.topics])].slice(0, 5),
      seen: a.seen + b.seen,
      caught: a.caught + b.caught,
      half: a.half + b.half,
      missed: a.missed + b.missed,
      confidentWrong: a.confidentWrong + b.confidentWrong,
      firstSeen: a.firstSeen < b.firstSeen ? a.firstSeen : b.firstSeen,
      lastSeen: at,
      strength: +(strengthAt(a, at) + strengthAt(b, at)).toFixed(4),
      strengthAt: at,
      review,
      history: [...a.history, ...b.history].sort((x, y) => x.at.localeCompare(y.at)).slice(-MAX_HISTORY),
      autopsy: mergeAutopsy(a.autopsy, b.autopsy),
      correction: b.correction ?? a.correction,
    };
  }
  return { ...learning, aliases, misconceptions };
}
