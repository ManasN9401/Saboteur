// The bridge between a graded round and the player's progress (browser only).
import { buildLearning, factsFromRecord, learnFromRound } from "../learning/model";
import { insightFor } from "../learning/views";
import { activeId, getProfile, getStats, readRecords, saveStats } from "../profile/profiles";
import { store } from "../store";
import { SESSION } from "../storage/keys";
import { getRaw, remove, setRaw } from "../storage/kv";
import { deviceTimeZone } from "./day";
import { awardBadge, eventFromRecord, roundCompleted, type ProgressDelta } from "./events";

/**
 * Count a round the player just completed. Call it only when `store.saveResult` returned true; stats
 * also remember counted rounds, so even a second call can't award twice.
 */
export function recordCompletion(roundId: string): ProgressDelta | null {
  const record = store.getRound(roundId);
  if (!record) return null;
  const event = eventFromRecord(record, deviceTimeZone());
  if (!event) return null;
  const id = activeId();
  const restDays = getProfile(id)?.prefs.restDays ?? [];
  // Learn first (replays and repeat dailies teach as much as scored rounds), so badges can see it.
  // A profile from before v0.6 learns from all its saved rounds the first time.
  const before = getStats(id);
  const facts = factsFromRecord(record);
  let learning = before.learning ?? buildLearning(readRecords(id));
  if (facts) learning = learnFromRound(learning, facts);
  const { stats, delta } = roundCompleted({ ...before, learning }, event, { restDays });
  delta.insight = facts ? insightFor(learning, facts) : null;
  saveStats(stats, id);
  setRaw(SESSION.delta(roundId), JSON.stringify(delta), "session");
  return delta;
}

// Taken deltas stay here for the rest of this page load, so a re-render (or React's development
// double-render) shows the same strip; a reload starts empty and doesn't replay it.
const taken = new Map<string, ProgressDelta | null>();

/** The progress a round just earned, for the reveal page. Read once per page load. */
export function takeDelta(roundId: string): ProgressDelta | null {
  if (taken.has(roundId)) return taken.get(roundId)!;
  const raw = getRaw(SESSION.delta(roundId), "session");
  remove(SESSION.delta(roundId), "session");
  let delta: ProgressDelta | null = null;
  try {
    delta = raw ? (JSON.parse(raw) as ProgressDelta) : null;
  } catch {
    delta = null;
  }
  taken.set(roundId, delta);
  return delta;
}

export function earnBadge(badgeId: string): boolean {
  const { stats, awarded } = awardBadge(getStats(), badgeId, new Date().toISOString());
  if (awarded) saveStats(stats);
  return awarded;
}
