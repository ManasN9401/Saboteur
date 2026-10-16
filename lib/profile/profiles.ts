// Profiles on this device: who exists, who is playing, and their data. Boot runs once per page load
// (migration from v1, wiping stale guests), lazily on the first read, so every caller sees v2 data.
import { z } from "zod";
import { KEYS, SESSION, V1_KEYS } from "../storage/keys";
import { getRaw, keys, notify, parse, quarantine, read, remove, setRaw, silently, write } from "../storage/kv";
import { migrateV1, newProfile, parseRecords } from "../storage/migrate";
import { MetaSchema, NotesLibrarySchema, SetupSettingsSchema, TopicsSchema, type Meta, type RoundRecord } from "../storage/schemas";
import { deviceTimeZone } from "../progress/day";
import { rebuildStats } from "../progress/events";
import { newId } from "../text";
import {
  AVATARS,
  DevicePrefsSchema,
  emptyStats,
  MAX_PROFILES,
  ProfileSchema,
  StatsSchema,
  type Avatar,
  type DevicePrefs,
  type Profile,
  type Stats,
} from "./schema";

let booted = false;
// Migrated players keep their history: streak, XP and badges are rebuilt from their old rounds.
const backfill = (records: Record<string, RoundRecord>) => rebuildStats(records, deviceTimeZone());

/** For tests: forget that boot ran. */
export function resetBoot() {
  booted = false;
}

const now = () => new Date().toISOString();

function readMeta(): Meta | undefined {
  const raw = getRaw(KEYS.meta);
  const meta = parse(raw, MetaSchema);
  if (meta === null) quarantine(KEYS.meta, raw!, "failed validation");
  return meta ?? undefined;
}

function v1Blobs() {
  const drafts: Record<string, string> = {};
  for (const k of keys(V1_KEYS.draftPrefix)) drafts[k.slice(V1_KEYS.draftPrefix.length)] = getRaw(k) ?? "";
  return { rounds: getRaw(V1_KEYS.rounds), settings: getRaw(V1_KEYS.settings), drafts };
}

function profileExists(id: string) {
  return getRaw(KEYS.profile(id)) !== null;
}

function wipe(id: string) {
  for (const k of keys(KEYS.profilePrefix(id))) remove(k);
}

export function boot() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  silently(() => {
    let meta = readMeta();
    if (!meta) {
      // Profiles may survive a lost meta blob: find them again before starting over.
      const found = keys("saboteur:v2:p:")
        .filter((k) => k.endsWith(":profile"))
        .map((k) => k.slice("saboteur:v2:p:".length, -":profile".length));
      if (found.length) {
        meta = { schemaVersion: 2, activeProfileId: found[0], profileOrder: found };
      } else {
        const v1 = v1Blobs();
        const result = migrateV1(v1, { now: now(), profileId: newId("prf"), backfill });
        for (const [k, v] of result.writes) write(k, v);
        meta = result.meta;
      }
    }
    // A guest belongs to the browser session that made it.
    const guest = getRaw(SESSION.guest, "session");
    for (const id of meta.profileOrder) {
      const p = profileExists(id) ? read(KEYS.profile(id), ProfileSchema, null) : null;
      if (!p || (p.guest && p.id !== guest)) {
        wipe(id);
        meta = { ...meta, profileOrder: meta.profileOrder.filter((x) => x !== id) };
      }
    }
    if (!meta.profileOrder.length) {
      const p = newProfile({ id: newId("prf"), name: "Player 1", now: now() });
      write(KEYS.profile(p.id), p);
      write(KEYS.stats(p.id), emptyStats());
      meta = { ...meta, profileOrder: [p.id] };
    }
    if (!meta.activeProfileId || !meta.profileOrder.includes(meta.activeProfileId)) meta = { ...meta, activeProfileId: meta.profileOrder[0] };
    write(KEYS.meta, meta);
  });
}

export function getMeta(): Meta {
  boot();
  return readMeta() ?? { schemaVersion: 2, activeProfileId: null, profileOrder: [] };
}

/** The active profile's id. Boot guarantees there is always one. */
export function activeId(): string {
  const meta = getMeta();
  return meta.activeProfileId ?? meta.profileOrder[0] ?? "prf_none";
}

export function getProfile(id: string): Profile | null {
  boot();
  return read(KEYS.profile(id), ProfileSchema, null);
}

export function listProfiles(): Profile[] {
  return getMeta()
    .profileOrder.map(getProfile)
    .filter((p): p is Profile => p !== null);
}

export class ProfileError extends Error {}

export function createProfile(fields: { name: string; avatar?: Avatar; guest?: boolean; onboarding?: Profile["onboarding"] }): Profile {
  const meta = getMeta();
  if (meta.profileOrder.length >= MAX_PROFILES) throw new ProfileError(`This device already has ${MAX_PROFILES} investigators.`);
  const used = new Set(listProfiles().map((p) => (p.avatar.kind === "pin" ? p.avatar.id : "")));
  const avatar = fields.avatar ?? { kind: "pin" as const, id: AVATARS.find((a) => !used.has(a)) ?? "owl" };
  const profile = newProfile({ id: newId("prf"), name: fields.name, now: now(), avatar, guest: fields.guest ?? false, onboarding: fields.onboarding });
  silently(() => {
    write(KEYS.profile(profile.id), profile);
    write(KEYS.stats(profile.id), emptyStats());
    if (profile.guest) setRaw(SESSION.guest, profile.id, "session");
  });
  write(KEYS.meta, { ...meta, profileOrder: [...meta.profileOrder, profile.id] });
  return profile;
}

export function updateProfile(id: string, patch: Partial<Omit<Profile, "id" | "createdAt">>): Profile | null {
  const current = getProfile(id);
  if (!current) return null;
  const next = ProfileSchema.parse({ ...current, ...patch, id });
  write(KEYS.profile(id), next);
  return next;
}

/** Change some of the active profile's settings. */
export function updatePrefs(patch: Partial<Profile["prefs"]>, id = activeId()) {
  const p = getProfile(id);
  if (p) updateProfile(id, { prefs: { ...p.prefs, ...patch } });
}

export function setActive(id: string) {
  const meta = getMeta();
  if (!meta.profileOrder.includes(id) || meta.activeProfileId === id) return;
  silently(() => updateProfile(id, { lastActiveAt: now() }));
  write(KEYS.meta, { ...meta, activeProfileId: id });
}

export function deleteProfile(id: string) {
  const meta = getMeta();
  silently(() => wipe(id));
  const order = meta.profileOrder.filter((x) => x !== id);
  write(KEYS.meta, { ...meta, profileOrder: order, activeProfileId: meta.activeProfileId === id ? (order[0] ?? null) : meta.activeProfileId });
  if (!order.length) {
    // Never leave the device without a player.
    booted = false;
    remove(KEYS.meta);
    boot();
    notify();
  }
}

export function getStats(id = activeId()): Stats {
  boot();
  return read(KEYS.stats(id), StatsSchema, emptyStats());
}

export function saveStats(stats: Stats, id = activeId()) {
  write(KEYS.stats(id), StatsSchema.parse(stats));
}

export function getDevicePrefs(): DevicePrefs {
  return read(KEYS.device, DevicePrefsSchema, DevicePrefsSchema.parse({}));
}

export function saveDevicePrefs(prefs: Partial<DevicePrefs>) {
  write(KEYS.device, DevicePrefsSchema.parse({ ...getDevicePrefs(), ...prefs }));
}

/* ---------- Export / import: one JSON file per profile ---------- */

export const ExportSchema = z.object({
  format: z.literal("saboteur-profile"),
  version: z.literal(2),
  exportedAt: z.string(),
  profile: ProfileSchema,
  stats: StatsSchema,
  rounds: z.record(z.string(), z.unknown()),
  settings: SetupSettingsSchema.nullable(),
  topics: TopicsSchema.nullable(),
  notes: NotesLibrarySchema.nullable(),
});
export type ProfileExport = z.infer<typeof ExportSchema>;

export function exportProfile(id = activeId()): ProfileExport | null {
  const profile = getProfile(id);
  if (!profile) return null;
  return {
    format: "saboteur-profile",
    version: 2,
    exportedAt: now(),
    profile,
    stats: getStats(id),
    rounds: parseRecords(JSON.parse(getRaw(KEYS.rounds(id)) ?? "{}")).records,
    settings: read(KEYS.settings(id), SetupSettingsSchema, null),
    topics: read(KEYS.topics(id), TopicsSchema, null),
    notes: read(KEYS.notes(id), NotesLibrarySchema, null),
  };
}

/** Bring a profile back from an export. Keeps its id when free, so a restored profile is the same one. */
export function importProfile(data: unknown): Profile {
  const parsed = ExportSchema.safeParse(data);
  if (!parsed.success) throw new ProfileError("That file isn't a Saboteur profile export.");
  const meta = getMeta();
  const { profile, stats, rounds, settings, topics, notes } = parsed.data;
  const clash = meta.profileOrder.includes(profile.id);
  if (meta.profileOrder.length >= MAX_PROFILES) throw new ProfileError(`This device already has ${MAX_PROFILES} investigators.`);
  const id = clash ? newId("prf") : profile.id;
  const records = parseRecords(rounds).records;
  silently(() => {
    write(KEYS.profile(id), { ...profile, id, guest: false });
    write(KEYS.stats(id), stats);
    write(KEYS.rounds(id), records);
    if (settings) write(KEYS.settings(id), settings);
    if (topics) write(KEYS.topics(id), topics);
    if (notes) write(KEYS.notes(id), notes);
  });
  write(KEYS.meta, { ...meta, profileOrder: [...meta.profileOrder, id], activeProfileId: id });
  return { ...profile, id, guest: false };
}

/** Records that parse, for code that reads rounds outside React. */
export function readRecords(id = activeId()): Record<string, RoundRecord> {
  boot();
  const raw = getRaw(KEYS.rounds(id));
  if (raw === null) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    quarantine(KEYS.rounds(id), raw, "not JSON");
    return {};
  }
  const { records, dropped } = parseRecords(data);
  // Keep a copy of anything we couldn't read before the next write drops it for good.
  if (dropped) silently(() => setRaw(`${KEYS.rounds(id)}:corrupt:${Date.now()}`, raw));
  return records;
}

