// Label normalisation (V06-02): after a round, labels not checked yet are sent to
// /api/learning/normalise, and any that duplicate a label on file are merged into it.
import { mergeInto } from "./model";
import type { Learning } from "./schema";

const MAX_FRESH = 12;
const MAX_KNOWN = 80;

export interface Match {
  key: string;
  sameAs: string | null;
}

const ref = (l: Learning, key: string) => ({ key, label: l.misconceptions[key].label, errorType: l.misconceptions[key].errorType });

/** Labels to ask about, and the ones already on file they might duplicate (most recent first). */
export function pendingLabels(l: Learning) {
  const done = new Set(l.normalised);
  const byRecent = Object.values(l.misconceptions).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  return {
    fresh: byRecent.filter((m) => !done.has(m.key)).slice(0, MAX_FRESH).map((m) => ref(l, m.key)),
    known: byRecent.filter((m) => done.has(m.key)).slice(0, MAX_KNOWN).map((m) => ref(l, m.key)),
  };
}

/** Merge the duplicates, and remember every label asked about so it isn't asked again. */
export function applyMatches(l: Learning, asked: string[], matches: Match[]): Learning {
  let next = l;
  for (const { key, sameAs } of matches) {
    if (!sameAs || !next.misconceptions[key]) continue;
    // The target may itself have been merged earlier in this batch.
    let to = sameAs;
    for (let i = 0; i < 4 && next.aliases[to] && next.aliases[to] !== to; i++) to = next.aliases[to];
    if (to !== key && next.misconceptions[to]) next = mergeInto(next, key, to);
  }
  const normalised = [...new Set([...next.normalised, ...asked])].filter((k) => next.misconceptions[k]);
  return { ...next, normalised };
}
