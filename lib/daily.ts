// The daily case: the same case for everyone on a given date, with no server state. The date picks a
// library topic and a seed; the offline engine does the rest deterministically, so the server can
// rebuild the round (and its planted errors) whenever it needs to grade one.
import { generateOffline, hash } from "./offline/generate";
import { LIBRARY, type LibraryEntry } from "./offline/library";
import { addDays, daysBetween, weekday } from "./progress/day";
import type { Difficulty, PlantedError, Round } from "./schemas";

/** Rotation starts here; dates before it are still valid but ignore history. */
export const DAILY_ANCHOR = "2026-10-01";
export const DAILY_LEVEL = "A-level / high school";
/** No subject comes round again within this many days. */
const SUBJECT_GAP = 4;
/** Nor does a topic within this many (when the library allows). */
const TOPIC_GAP = 21;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const dailyId = (date: string) => `daily-${date}`;
export const dailyDateOf = (roundId: string) => (/^daily-(\d{4}-\d{2}-\d{2})$/.exec(roundId) ?? [])[1] ?? null;

export const dailySeed = (date: string) => hash(`saboteur-daily|${date}`);

/** Mon/Tue obvious, Wed/Thu subtle, Fri–Sun devious. */
export function dailyDifficulty(date: string): Difficulty {
  const d = weekday(date);
  if (d === 1 || d === 2) return "obvious";
  if (d === 3 || d === 4) return "subtle";
  return "devious";
}

function pick(date: string, recent: LibraryEntry[]): LibraryEntry {
  const seed = dailySeed(date);
  const order = [...LIBRARY].sort((a, b) => hash(`${seed}|${a.id}`) - hash(`${seed}|${b.id}`) || a.id.localeCompare(b.id));
  const subjects = new Set(recent.slice(-(SUBJECT_GAP - 1)).map((e) => e.subject));
  const topics = new Set(recent.slice(-TOPIC_GAP).map((e) => e.id));
  return order.find((e) => !subjects.has(e.subject) && !topics.has(e.id)) ?? order.find((e) => !subjects.has(e.subject)) ?? order[0];
}

const cache = new Map<string, LibraryEntry>();

/** The library topic for a date. Walks forward from the anchor so the rotation rules hold. */
export function dailyEntry(date: string): LibraryEntry {
  const hit = cache.get(date);
  if (hit) return hit;
  if (daysBetween(DAILY_ANCHOR, date) < 0) return pick(date, []);
  const history: LibraryEntry[] = [];
  for (let d = DAILY_ANCHOR; ; d = addDays(d, 1)) {
    const entry = cache.get(d) ?? pick(d, history.slice(-TOPIC_GAP));
    cache.set(d, entry);
    history.push(entry);
    if (d === date) return entry;
  }
}

export interface DailyInfo {
  date: string;
  id: string;
  topic: string;
  subject: string;
  difficulty: Difficulty;
}

export function dailyInfo(date: string): DailyInfo {
  const e = dailyEntry(date);
  return { date, id: dailyId(date), topic: e.title, subject: e.subject, difficulty: dailyDifficulty(date) };
}

/** A date the server will build a daily case for: not before the first one, not beyond tomorrow anywhere. */
export function isDailyDate(date: string, now = new Date()): boolean {
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) return false;
  const latest = addDays(now.toISOString().slice(0, 10), 1);
  return daysBetween("2026-01-01", date) >= 0 && daysBetween(date, latest) >= 0;
}

/** Build the daily case for a date. Identical every time, on every machine. */
export function buildDaily(date: string): Promise<{ round: Round; errors: PlantedError[] }> {
  const info = dailyInfo(date);
  return generateOffline({ topic: info.topic, level: DAILY_LEVEL, difficulty: info.difficulty }, () => {}, {
    seed: dailySeed(date),
    id: info.id,
    createdAt: `${date}T00:00:00.000Z`,
    entry: dailyEntry(date),
  });
}
