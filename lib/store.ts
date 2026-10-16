// Browser persistence behind one small interface, so it can move to a database later. Everything here
// belongs to the active profile (lib/profile/profiles.ts); switching profile switches what you see.
import type { Flag, Round, RoundResult, Submission } from "./schemas";
import { activeId, boot, readRecords } from "./profile/profiles";
import { KEYS, SESSION } from "./storage/keys";
import { getRaw, read, remove, setRaw, write } from "./storage/kv";
import { parseRecords } from "./storage/migrate";
import { DraftSchema, NotesLibrarySchema, SetupSettingsSchema, TopicsSchema, type NotesLibrary, type RoundRecord, type SetupSettings, type Topics } from "./storage/schemas";
import { slugify } from "./text";

export type { RoundRecord, SetupSettings, Topics };
export { subscribe } from "./storage/kv";

const MAX_ROUNDS = 40;
/** Saved notes per profile (Q6): beyond this the oldest are dropped. */
const MAX_NOTES_BYTES = 200_000;

/** The active profile's raw saved rounds, tagged with the profile: a stable snapshot that changes only with the data. */
export function roundsSnapshot(): string {
  if (typeof window === "undefined") return "";
  boot();
  const id = activeId();
  return `${id}\n${getRaw(KEYS.rounds(id)) ?? "{}"}`;
}
export function parseRounds(snapshot: string): Record<string, RoundRecord> {
  const raw = snapshot.slice(snapshot.indexOf("\n") + 1);
  try {
    return parseRecords(JSON.parse(raw)).records;
  } catch {
    return {};
  }
}

function writeRecords(records: Record<string, RoundRecord>) {
  // Keep the newest rounds; trim further if the browser says storage is full. Profile and stats are
  // separate keys, so a full disk only ever costs old rounds.
  const key = KEYS.rounds(activeId());
  let list = Object.values(records).sort((a, b) => b.round.createdAt.localeCompare(a.round.createdAt)).slice(0, MAX_ROUNDS);
  while (list.length && !write(key, Object.fromEntries(list.map((r) => [r.round.id, r])))) list = list.slice(0, -1);
}

function session(key: string, value?: string | null): string | null {
  if (value === undefined) return getRaw(key, "session");
  if (value === null) remove(key, "session");
  else setRaw(key, value, "session");
  return value;
}

export const store = {
  saveRound(round: Round, notes?: string, extra?: Pick<RoundRecord, "daily" | "replayOf">) {
    const records = readRecords();
    records[round.id] = { ...records[round.id], ...extra, round, notes };
    writeRecords(records);
  },

  getRound(id: string): RoundRecord | null {
    return readRecords()[id] ?? null;
  },

  listRounds(): RoundRecord[] {
    return Object.values(readRecords()).sort((a, b) => b.round.createdAt.localeCompare(a.round.createdAt));
  },

  /** Save a graded round. True only the first time, so whatever follows (progress, XP) runs once. */
  saveResult(id: string, submission: Submission, result: RoundResult): boolean {
    const records = readRecords();
    const record = records[id];
    if (!record || record.result) return false;
    records[id] = { ...record, submission, result, playedAt: new Date().toISOString() };
    writeRecords(records);
    remove(KEYS.draft(activeId(), id));
    return true;
  },

  saveDraft(id: string, flags: Flag[]) {
    write(KEYS.draft(activeId(), id), flags);
  },

  getDraft(id: string): Flag[] {
    return read(KEYS.draft(activeId(), id), DraftSchema, []);
  },

  saveSettings(settings: SetupSettings) {
    write(KEYS.settings(activeId()), settings);
    if (settings.topic.trim()) store.rememberTopic(settings.topic.trim());
  },

  getSettings(): SetupSettings | null {
    return read(KEYS.settings(activeId()), SetupSettingsSchema, null);
  },

  /* ---------- Recent topics, favourites and saved notes (Q5, Q6) ---------- */

  getTopics(): Topics {
    return read(KEYS.topics(activeId()), TopicsSchema, { recent: [], favourites: [] });
  },

  rememberTopic(topic: string) {
    const t = store.getTopics();
    const recent = [topic, ...t.recent.filter((x) => x.toLowerCase() !== topic.toLowerCase())].slice(0, 12);
    write(KEYS.topics(activeId()), { ...t, recent });
  },

  toggleFavourite(topic: string) {
    const t = store.getTopics();
    const has = t.favourites.some((x) => x.toLowerCase() === topic.toLowerCase());
    const favourites = has ? t.favourites.filter((x) => x.toLowerCase() !== topic.toLowerCase()) : [topic, ...t.favourites].slice(0, 24);
    write(KEYS.topics(activeId()), { ...t, favourites });
  },

  getSavedNotes(topic: string): string | null {
    return read(KEYS.notes(activeId()), NotesLibrarySchema, {} as NotesLibrary)[slugify(topic)]?.notes ?? null;
  },

  saveNotes(topic: string, notes: string) {
    const lib = read(KEYS.notes(activeId()), NotesLibrarySchema, {} as NotesLibrary);
    if (notes.trim()) lib[slugify(topic)] = { topic, notes, savedAt: new Date().toISOString() };
    else delete lib[slugify(topic)];
    // Newest first (the one just saved leads even within the same millisecond); drop from the end.
    const key = slugify(topic);
    let entries = Object.entries(lib).sort((a, b) => Number(b[0] === key) - Number(a[0] === key) || b[1].savedAt.localeCompare(a[1].savedAt));
    while (entries.length > 1 && JSON.stringify(Object.fromEntries(entries)).length > MAX_NOTES_BYTES) entries = entries.slice(0, -1);
    write(KEYS.notes(activeId()), Object.fromEntries(entries));
  },

  /* ---------- One-shot hand-offs within this tab ---------- */

  /** Ask the setup page to start generating as soon as it opens (one-shot, this tab only). */
  requestAutostart() {
    session(SESSION.autostart, "1");
  },

  peekAutostart(): boolean {
    return session(SESSION.autostart) === "1";
  },

  takeAutostart(): boolean {
    const on = session(SESSION.autostart) === "1";
    session(SESSION.autostart, null);
    return on;
  },
};
