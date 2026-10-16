// v1 → v2: one player's worth of data becomes "Player 1". Pure, so it can be tested on fixtures; the
// caller reads the v1 blobs and writes the result. v1 keys are left in place as a backup for a release.
import { z } from "zod";
import { emptyStats, ProfileSchema, type Profile, type Stats } from "../profile/schema";
import { KEYS } from "./keys";
import { DraftSchema, RoundRecordSchema, SetupSettingsSchema, type Meta, type RoundRecord } from "./schemas";

export interface V1Blobs {
  rounds: string | null;
  settings: string | null;
  /** Raw draft blobs by round id. */
  drafts: Record<string, string>;
}

export interface MigrationResult {
  meta: Meta;
  writes: [key: string, value: unknown][];
  /** Rounds dropped because they no longer parse. */
  dropped: number;
}

function json(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Keep every record that still parses; a single bad round shouldn't cost the player the rest. */
export function parseRecords(raw: unknown): { records: Record<string, RoundRecord>; dropped: number } {
  const records: Record<string, RoundRecord> = {};
  let dropped = 0;
  const obj = z.record(z.string(), z.unknown()).safeParse(raw);
  if (!obj.success) return { records, dropped: raw === undefined || raw === null ? 0 : 1 };
  for (const [id, value] of Object.entries(obj.data)) {
    const r = RoundRecordSchema.safeParse(value);
    if (r.success && r.data.round.id === id) records[id] = r.data;
    else dropped++;
  }
  return { records, dropped };
}

export function newProfile(fields: { id: string; name: string; now: string } & Partial<Profile>): Profile {
  const { id, name, now, ...rest } = fields;
  return ProfileSchema.parse({ avatar: { kind: "pin", id: "owl" }, ...rest, id, name, createdAt: now, lastActiveAt: now });
}

function safeBackfill(fn: ((r: Record<string, RoundRecord>) => Stats) | undefined, records: Record<string, RoundRecord>): Stats {
  try {
    return fn ? fn(records) : emptyStats();
  } catch (err) {
    // Losing old badges is better than failing to start.
    console.warn("[saboteur] Couldn't rebuild progress from old rounds", err);
    return emptyStats();
  }
}

export function migrateV1(
  v1: V1Blobs,
  opts: { now: string; profileId: string; backfill?: (records: Record<string, RoundRecord>) => Stats },
): MigrationResult {
  const { records, dropped } = parseRecords(json(v1.rounds));
  const id = opts.profileId;
  const profile = newProfile({ id, name: "Player 1", now: opts.now });
  const writes: MigrationResult["writes"] = [
    [KEYS.profile(id), profile],
    [KEYS.rounds(id), records],
    [KEYS.stats(id), safeBackfill(opts.backfill, records)],
  ];
  const settings = SetupSettingsSchema.safeParse(json(v1.settings));
  if (settings.success) writes.push([KEYS.settings(id), settings.data]);
  for (const [roundId, raw] of Object.entries(v1.drafts)) {
    const draft = DraftSchema.safeParse(json(raw));
    // Drafts of finished or forgotten rounds are of no use.
    if (draft.success && draft.data.length && records[roundId] && !records[roundId].result) writes.push([KEYS.draft(id, roundId), draft.data]);
  }
  return { meta: { schemaVersion: 2, activeProfileId: id, profileOrder: [id] }, writes, dropped };
}
