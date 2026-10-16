import { beforeEach, describe, expect, it } from "vitest";
import { stubWindow, type MemoryStorage } from "@/test/storage-stub";
import { emptyStats } from "../profile/schema";
import {
  activeId,
  boot,
  createProfile,
  deleteProfile,
  exportProfile,
  getMeta,
  getProfile,
  getStats,
  importProfile,
  listProfiles,
  resetBoot,
  saveStats,
  setActive,
} from "../profile/profiles";
import type { Round, RoundResult, Submission } from "../schemas";
import { store } from "../store";
import { KEYS, SESSION, V1_KEYS } from "./keys";
import { migrateV1 } from "./migrate";

const round = (id: string, createdAt = "2026-10-01T10:00:00.000Z", topic = "Photosynthesis"): Round => ({
  id,
  topic,
  topicId: topic.toLowerCase(),
  level: "A-level / high school",
  difficulty: "subtle",
  sentences: [
    { id: "s1", text: "Plants make sugar." },
    { id: "s2", text: "They use light." },
  ],
  createdAt,
  engine: "offline",
});
const submission = (roundId: string): Submission => ({ roundId, flags: [{ sentenceId: "s1", correction: "x", confidence: 0.8 }], foundAllConfidence: 0.7 });
const result = (roundId: string): RoundResult => ({
  roundId,
  items: [{ sentenceId: "s1", kind: "catch", correctionGrade: "correct", feedback: "Yes", confidence: 0.8, points: 150 }],
  errors: [
    {
      sentenceId: "s1",
      originalSentence: "Plants make sugar.",
      sabotagedSentence: "Plants make salt.",
      errorType: "swapped_terms",
      explanation: "Sugar, not salt.",
      whyTempting: "Both are white.",
      misconceptionLabel: "Salt vs sugar",
    },
  ],
  score: 150,
  maxScore: 150,
});

let local: MemoryStorage;
let session: MemoryStorage;
beforeEach(() => {
  ({ local, session } = stubWindow());
  resetBoot();
});

describe("migrateV1 (pure)", () => {
  const opts = { now: "2026-10-16T09:00:00.000Z", profileId: "prf_test" };

  it("empty: makes Player 1 with nothing else", () => {
    const r = migrateV1({ rounds: null, settings: null, drafts: {} }, opts);
    expect(r.meta).toEqual({ schemaVersion: 2, activeProfileId: "prf_test", profileOrder: ["prf_test"] });
    const writes = Object.fromEntries(r.writes);
    expect((writes[KEYS.profile("prf_test")] as { name: string }).name).toBe("Player 1");
    expect(writes[KEYS.rounds("prf_test")]).toEqual({});
    expect(writes[KEYS.stats("prf_test")]).toEqual(emptyStats());
    expect(writes[KEYS.settings("prf_test")]).toBeUndefined();
    expect(r.dropped).toBe(0);
  });

  it("typical: moves rounds, results, settings and live drafts", () => {
    const rounds = {
      a: { round: round("a"), submission: submission("a"), result: result("a"), playedAt: "2026-10-01T10:05:00.000Z" },
      b: { round: round("b", "2026-10-02T10:00:00.000Z"), notes: "my notes" },
    };
    const r = migrateV1(
      {
        rounds: JSON.stringify(rounds),
        settings: JSON.stringify({ topic: "Photosynthesis", level: "A-level / high school", difficulty: "subtle", notes: "" }),
        drafts: { a: JSON.stringify([{ sentenceId: "s1", correction: "", confidence: 0.7 }]), b: JSON.stringify([{ sentenceId: "s2", correction: "", confidence: 0.9 }]) },
      },
      opts,
    );
    const writes = Object.fromEntries(r.writes);
    expect(Object.keys(writes[KEYS.rounds("prf_test")] as object).sort()).toEqual(["a", "b"]);
    expect(writes[KEYS.settings("prf_test")]).toMatchObject({ topic: "Photosynthesis" });
    // The finished round's leftover draft is useless; the open one's is kept.
    expect(writes[KEYS.draft("prf_test", "a")]).toBeUndefined();
    expect(writes[KEYS.draft("prf_test", "b")]).toHaveLength(1);
  });

  it("corrupt: keeps what parses and counts what doesn't", () => {
    const rounds = { a: { round: round("a") }, bad: { round: { id: "bad" } }, wrongKey: { round: round("other") } };
    const r = migrateV1({ rounds: JSON.stringify(rounds), settings: "{not json", drafts: { a: "nope" } }, opts);
    const writes = Object.fromEntries(r.writes);
    expect(Object.keys(writes[KEYS.rounds("prf_test")] as object)).toEqual(["a"]);
    expect(r.dropped).toBe(2);
    expect(writes[KEYS.settings("prf_test")]).toBeUndefined();
  });

  it("corrupt: a rounds blob that isn't JSON still yields a working profile", () => {
    const r = migrateV1({ rounds: "]]]", settings: null, drafts: {} }, opts);
    expect(Object.fromEntries(r.writes)[KEYS.rounds("prf_test")]).toEqual({});
  });

  it("uses the backfill to rebuild stats from migrated rounds", () => {
    const r = migrateV1({ rounds: JSON.stringify({ a: { round: round("a") } }), settings: null, drafts: {} }, {
      ...opts,
      backfill: (records) => ({ ...emptyStats(), xp: Object.keys(records).length * 10 }),
    });
    expect((Object.fromEntries(r.writes)[KEYS.stats("prf_test")] as { xp: number }).xp).toBe(10);
  });
});

describe("boot", () => {
  it("creates Player 1 on a fresh device", () => {
    boot();
    const profiles = listProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe("Player 1");
    expect(activeId()).toBe(profiles[0].id);
  });

  it("migrates v1 data once and keeps the v1 keys as a backup", () => {
    local.setItem(V1_KEYS.rounds, JSON.stringify({ a: { round: round("a"), submission: submission("a"), result: result("a"), playedAt: "x" } }));
    local.setItem(V1_KEYS.settings, JSON.stringify({ topic: "Tides", level: "GCSE / middle school", difficulty: "obvious", notes: "" }));
    boot();
    expect(store.getRound("a")?.result?.score).toBe(150);
    expect(store.getSettings()?.topic).toBe("Tides");
    expect(local.getItem(V1_KEYS.rounds)).not.toBeNull();
    // Running again (next page load) changes nothing.
    const before = local.dump();
    resetBoot();
    boot();
    expect(local.dump()).toEqual(before);
  });

  it("quarantines a corrupt meta blob and recovers the profiles it pointed at", () => {
    boot();
    const id = activeId();
    local.setItem(KEYS.meta, "{broken");
    resetBoot();
    boot();
    expect(activeId()).toBe(id);
    expect(Object.keys(local.dump()).some((k) => k.startsWith(`${KEYS.meta}:corrupt:`))).toBe(true);
  });

  it("quarantines unreadable stats instead of throwing", () => {
    boot();
    local.setItem(KEYS.stats(activeId()), JSON.stringify({ xp: "lots" }));
    expect(getStats()).toEqual(emptyStats());
    expect(Object.keys(local.dump()).some((k) => k.includes(":stats:corrupt:"))).toBe(true);
  });

  it("keeps a copy of rounds it cannot read", () => {
    boot();
    local.setItem(KEYS.rounds(activeId()), JSON.stringify({ a: { round: round("a") }, b: { round: { id: "b" } } }));
    expect(Object.keys(store.listRounds())).toHaveLength(1);
    expect(Object.keys(local.dump()).some((k) => k.includes(":rounds:corrupt:"))).toBe(true);
  });
});

describe("profiles", () => {
  it("isolates every profile's rounds, drafts, settings and stats", () => {
    boot();
    const a = activeId();
    store.saveRound(round("r1"));
    store.saveDraft("r1", [{ sentenceId: "s1", correction: "", confidence: 0.6 }]);
    store.saveSettings({ topic: "Tides", level: "x", difficulty: "obvious", notes: "" });
    saveStats({ ...emptyStats(), xp: 99 });

    const b = createProfile({ name: "Sam" });
    setActive(b.id);
    expect(store.listRounds()).toEqual([]);
    expect(store.getDraft("r1")).toEqual([]);
    expect(store.getSettings()).toBeNull();
    expect(getStats().xp).toBe(0);
    expect(store.getTopics().recent).toEqual([]);

    store.saveRound(round("r2"));
    setActive(a);
    expect(store.listRounds().map((r) => r.round.id)).toEqual(["r1"]);
    expect(getStats().xp).toBe(99);
    // Nothing of B's lives under A's prefix.
    expect(Object.keys(local.dump()).filter((k) => k.includes("r2")).every((k) => k.startsWith(KEYS.profilePrefix(b.id)))).toBe(true);
  });

  it("caps a device at six profiles", () => {
    boot();
    for (let i = 0; i < 5; i++) createProfile({ name: `P${i}` });
    expect(() => createProfile({ name: "Seventh" })).toThrow(/six|6/);
  });

  it("gives each new profile an unused avatar", () => {
    boot();
    const b = createProfile({ name: "Sam" });
    expect(b.avatar).not.toEqual(listProfiles()[0].avatar);
  });

  it("deleting removes every key of that profile and keeps a player on the device", () => {
    boot();
    const a = activeId();
    store.saveRound(round("r1"));
    deleteProfile(a);
    expect(Object.keys(local.dump()).some((k) => k.startsWith(KEYS.profilePrefix(a)))).toBe(false);
    expect(listProfiles()).toHaveLength(1);
    expect(activeId()).not.toBe(a);
  });

  it("wipes a guest once its browser session is over", () => {
    boot();
    const g = createProfile({ name: "Guest", guest: true });
    expect(session.getItem(SESSION.guest)).toBe(g.id);
    resetBoot();
    boot();
    expect(getProfile(g.id)).not.toBeNull(); // same session
    session.clear();
    resetBoot();
    boot();
    expect(getProfile(g.id)).toBeNull();
    expect(getMeta().profileOrder).not.toContain(g.id);
  });

  it("exports and imports a profile with everything in it", () => {
    boot();
    const id = activeId();
    store.saveRound(round("r1"));
    store.saveResult("r1", submission("r1"), result("r1"));
    store.saveNotes("Tides", "the moon pulls");
    saveStats({ ...emptyStats(), xp: 321 });
    const file = JSON.parse(JSON.stringify(exportProfile()));

    local.clear();
    session.clear();
    resetBoot();
    const restored = importProfile(file);
    setActive(restored.id);
    expect(restored.id).toBe(id);
    expect(store.getRound("r1")?.result?.score).toBe(150);
    expect(store.getSavedNotes("Tides")).toBe("the moon pulls");
    expect(getStats().xp).toBe(321);
  });

  it("rejects a file that isn't a profile export", () => {
    boot();
    expect(() => importProfile({ hello: "world" })).toThrow(/isn't a Saboteur profile/);
  });
});

describe("store adapter", () => {
  it("saveResult is true only the first time", () => {
    boot();
    store.saveRound(round("r1"));
    expect(store.saveResult("r1", submission("r1"), result("r1"))).toBe(true);
    expect(store.saveResult("r1", submission("r1"), result("r1"))).toBe(false);
    expect(store.saveResult("missing", submission("missing"), result("missing"))).toBe(false);
  });

  it("trims the oldest rounds when storage is full, never the profile or stats", () => {
    boot();
    const id = activeId();
    saveStats({ ...emptyStats(), xp: 5 });
    for (let i = 0; i < 10; i++) store.saveRound(round(`r${i}`, `2026-10-0${i}T00:00:00.000Z`));
    local.quota = Object.entries(local.dump()).reduce((n, [k, v]) => n + k.length + v.length, 0) + 50; // not room for one more round
    store.saveRound(round("new", "2026-10-15T00:00:00.000Z"));
    const ids = store.listRounds().map((r) => r.round.id);
    expect(ids[0]).toBe("new");
    expect(ids).not.toContain("r0");
    expect(getStats(id).xp).toBe(5);
    expect(getProfile(id)).not.toBeNull();
  });

  it("keeps at most 40 rounds", () => {
    boot();
    for (let i = 0; i < 45; i++) store.saveRound(round(`r${i}`, new Date(Date.UTC(2026, 0, 1 + i)).toISOString()));
    expect(store.listRounds()).toHaveLength(40);
  });

  it("remembers recent topics and favourites", () => {
    boot();
    store.saveSettings({ topic: "Tides", level: "x", difficulty: "obvious", notes: "" });
    store.saveSettings({ topic: "Volcanoes", level: "x", difficulty: "obvious", notes: "" });
    store.saveSettings({ topic: "tides", level: "x", difficulty: "obvious", notes: "" });
    expect(store.getTopics().recent).toEqual(["tides", "Volcanoes"]);
    store.toggleFavourite("Volcanoes");
    expect(store.getTopics().favourites).toEqual(["Volcanoes"]);
    store.toggleFavourite("volcanoes");
    expect(store.getTopics().favourites).toEqual([]);
  });

  it("caps saved notes at 200 KB, dropping the oldest", () => {
    boot();
    const big = "x".repeat(80_000);
    store.saveNotes("A", big);
    store.saveNotes("B", big);
    store.saveNotes("C", big);
    expect(store.getSavedNotes("A")).toBeNull();
    expect(store.getSavedNotes("C")).toBe(big);
  });
});
