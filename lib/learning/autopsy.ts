// What the Wrong Answer Autopsy files in the Misconception Profile (V07-06). Pure, like model.ts.
//
// - "That's it": the misconception is confirmed. It counts as a miss (it got past the student in real
//   work), holds a little more firmly than a planted miss, and joins the review queue.
// - "Not quite": the diagnosis was wrong. Recorded, so the corkboard can say so, but it adds no strength.
// - "Just a slip": nothing is filed.
// - Check questions: each right answer loosens it, each trap taken tightens it; all right resolves it and
//   moves it up a review box.
import type { Judgement } from "../scoring";
import type { ErrorType } from "../schemas";
import { resolveKey } from "./labels";
import { CONFIDENT_EXTRA, INTERVALS, RETIRED_BOX, strengthAt, WEIGHT } from "./model";
import type { AutopsyRecord, Learning, Misconception } from "./schema";

export interface Finding {
  /** The autopsy item's id, unique per examination (it stands in for a round id). */
  id: string;
  at: string;
  label: string;
  errorType: ErrorType | null;
  subject: string;
  /** A short topic for drills ("Resistors in parallel"). */
  topic: string;
  level: string;
  question: string;
  answer: string;
  correct: string;
  explanation: string;
  correction: string;
}

const DAY_MS = 86_400_000;
const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY_MS).toISOString();
const MAX_HISTORY = 4;
const clip = (s: string, n = 400) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
/** Errors the student found in their own work carry this much extra weight over a planted miss. */
const CONFIRMED_EXTRA = CONFIDENT_EXTRA;

function base(l: Learning, key: string, f: Finding): Misconception {
  return (
    l.misconceptions[key] ?? {
      key,
      label: f.label,
      errorType: f.errorType ?? "plausible_but_false_detail",
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
    }
  );
}

const record = (a: AutopsyRecord | null, status: AutopsyRecord["status"], event: AutopsyRecord["history"][number]): AutopsyRecord => ({
  status,
  history: [...(a?.history ?? []), event].slice(-8),
});

export function confirmFinding(l: Learning, f: Finding): Learning {
  const key = resolveKey(l, f.label);
  if (l.misconceptions[key]?.history.some((h) => h.roundId === f.id)) return l;
  const m = base(l, key, f);
  const strength = Math.max(0, strengthAt(m, f.at) + WEIGHT.missed + CONFIRMED_EXTRA);
  const next: Misconception = {
    ...m,
    errorType: f.errorType ?? m.errorType,
    subjects: [f.subject, ...m.subjects.filter((s) => s !== f.subject)].slice(0, 5),
    topics: [f.topic, ...m.topics.filter((t) => t !== f.topic)].slice(0, 5),
    level: f.level,
    seen: m.seen + 1,
    missed: m.missed + 1,
    lastSeen: f.at > m.lastSeen ? f.at : m.lastSeen,
    strength: +strength.toFixed(4),
    strengthAt: f.at,
    review: { box: 0, due: addDays(f.at, INTERVALS[0]) },
    correction: clip(f.correction),
    history: [
      ...m.history,
      { roundId: f.id, source: "autopsy" as const, at: f.at, topic: f.topic, outcome: "missed" as const, original: clip(`${f.question} → ${f.correct}`), sabotaged: clip(f.answer), explanation: clip(f.explanation), whyTempting: "" },
    ].slice(-MAX_HISTORY),
    autopsy: record(m.autopsy, "confirmed", { at: f.at, event: "confirmed" }),
  };
  return { ...l, misconceptions: { ...l.misconceptions, [key]: next } };
}

/** "Not quite": the diagnosis was wrong. Kept as a note on the label; no strength, no review. */
export function rejectFinding(l: Learning, f: Finding): Learning {
  const key = resolveKey(l, f.label);
  const m = base(l, key, f);
  // A belief the student has confirmed before stays confirmed: this examination just missed the mark.
  const status = m.autopsy?.status === "confirmed" || m.autopsy?.status === "resolved" ? m.autopsy.status : "rejected";
  return { ...l, misconceptions: { ...l.misconceptions, [key]: { ...m, autopsy: record(m.autopsy, status, { at: f.at, event: "rejected" }) } } };
}

/**
 * The check questions' result for a confirmed misconception. Bets placed on them count towards
 * calibration like any other.
 */
export function checkResult(l: Learning, key: string, at: string, answers: { right: boolean; confidence: number }[], subject: string): Learning {
  const m = l.misconceptions[key];
  if (!m || !answers.length) return l;
  const right = answers.filter((a) => a.right).length;
  const all = right === answers.length;
  const strength = Math.max(0, strengthAt(m, at) + right * WEIGHT.caught + (answers.length - right) * WEIGHT.half);
  const box = m.review && m.review.box < RETIRED_BOX ? m.review.box : 0;
  const review = all ? (box + 1 >= RETIRED_BOX ? { box: RETIRED_BOX, due: null } : { box: box + 1, due: addDays(at, INTERVALS[box + 1]) }) : { box: 0, due: addDays(at, INTERVALS[0]) };
  let next: Misconception = {
    ...m,
    strength: +strength.toFixed(4),
    strengthAt: at,
    seen: m.seen + 1,
    caught: m.caught + (all ? 1 : 0),
    missed: m.missed + (all ? 0 : 1),
    lastSeen: at,
    review,
    autopsy: record(m.autopsy, m.autopsy?.status ?? "confirmed", { at, event: "checked", right, of: answers.length }),
  };
  if (all) next = { ...next, autopsy: record(next.autopsy, "resolved", { at, event: "resolved" }) };

  const judgements: Judgement[] = answers.map((a) => ({ confidence: a.confidence, correct: a.right }));
  const c = l.calibration;
  const add = (t: { bets: number; hits: number; conf: number; sq: number } | undefined, j: Judgement) => {
    const b = t ?? { bets: 0, hits: 0, conf: 0, sq: 0 };
    return { bets: b.bets + 1, hits: b.hits + (j.correct ? 1 : 0), conf: b.conf + j.confidence, sq: b.sq + (j.confidence - (j.correct ? 1 : 0)) ** 2 };
  };
  const calibration = { ...c, buckets: { ...c.buckets }, bySubject: { ...c.bySubject } };
  for (const j of judgements) {
    calibration.all = add(calibration.all, j);
    const b = String(Math.round(j.confidence * 10) * 10);
    calibration.buckets[b] = add(calibration.buckets[b], j);
    calibration.bySubject[subject] = add(calibration.bySubject[subject], j);
  }
  return {
    ...l,
    misconceptions: { ...l.misconceptions, [key]: next },
    calibration,
    reviews: { ...l.reviews, retired: l.reviews.retired + (review.box === RETIRED_BOX && m.review?.box !== RETIRED_BOX ? 1 : 0) },
  };
}

/** Has the student ever confirmed a misconception through the autopsy? (The Coroner badge.) */
export const hasConfirmed = (l: Learning | null | undefined) => !!l && Object.values(l.misconceptions).some((m) => m.autopsy?.history.some((h) => h.event === "confirmed"));
