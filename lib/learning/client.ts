// Browser side of the learning loop: background label normalisation, and filing autopsy findings.
import { getStats, readRecords, saveStats } from "../profile/profiles";
import { badgeArt } from "../progress/badges";
import { earnBadge } from "../progress/record";
import { toast } from "../toast";
import { checkResult, confirmFinding, rejectFinding, type Finding } from "./autopsy";
import { buildLearning } from "./model";
import type { Learning } from "./schema";
import { applyMatches, pendingLabels, type Match } from "./normalise";

let running = false;

/** Ask the server which new labels duplicate old ones and merge them. Quiet on any failure. */
export async function normaliseLabels(): Promise<void> {
  if (running) return;
  const learning = getStats().learning;
  if (!learning) return;
  const { fresh, known } = pendingLabels(learning);
  if (!fresh.length) return;
  running = true;
  try {
    const res = await fetch("/api/learning/normalise", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fresh, known }) });
    if (!res.ok) return;
    const { matches } = (await res.json()) as { matches: Match[] };
    // Stats may have moved on while we waited: apply to what's there now.
    const stats = getStats();
    if (stats.learning) saveStats({ ...stats, learning: applyMatches(stats.learning, fresh.map((f) => f.key), matches) });
  } catch {
    // Labels stay as they are and are asked about again after the next round.
  } finally {
    running = false;
  }
}

/** The learning record as it stands (built from saved rounds the first time). */
export function currentLearning(): Learning {
  return getStats().learning ?? buildLearning(readRecords());
}

function save(learning: Learning) {
  saveStats({ ...getStats(), learning });
}

/** File an autopsy verdict: "That's it" confirms, "Not quite" rejects ("Just a slip" files nothing). */
export function fileFinding(f: Finding, verdict: "confirmed" | "rejected"): void {
  const before = currentLearning();
  save(verdict === "confirmed" ? confirmFinding(before, f) : rejectFinding(before, f));
  if (verdict === "confirmed" && earnBadge("coroner")) toast("Badge earned: Coroner", { art: badgeArt("coroner"), tone: "good" });
  if (verdict === "confirmed") void normaliseLabels();
}

export function fileCheck(key: string, answers: { right: boolean; confidence: number }[], subject: string): void {
  save(checkResult(currentLearning(), key, new Date().toISOString(), answers, subject));
}
