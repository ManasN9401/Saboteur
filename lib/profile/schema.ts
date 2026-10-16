// Shapes of everything a player owns. Every blob read back from storage is parsed with these, so a
// field added later needs a default here (old saves must still parse).
import { z } from "zod";

export const AVATARS = ["owl", "fox", "raven", "otter", "cat", "hound", "heron", "hare", "badger", "stag", "magpie", "tortoise"] as const;
export const PROFILE_COLOURS = ["#b3261e", "#1f4e8c", "#2f6b3a", "#6a3d8f", "#9a5b13", "#2d5f6b"] as const;
export const MAX_PROFILES = 6;

export const AvatarSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pin"), id: z.enum(AVATARS) }),
  z.object({ kind: z.literal("monogram"), colour: z.string().regex(/^#[0-9a-f]{6}$/i) }),
]);
export type Avatar = z.infer<typeof AvatarSchema>;

/** Settings that follow the player (customisation.md). Device-wide ones are in DevicePrefsSchema. */
export const ProfilePrefsSchema = z.object({
  theme: z.enum(["system", "day", "night", "auto"]).default("system"),
  desk: z.enum(["oak", "plain"]).default("oak"),
  pen: z.enum(["red", "blue", "green", "violet"]).default("red"),
  ink: z.enum(["classic", "mono", "safe"]).default("classic"),
  textSize: z.union([z.literal(90), z.literal(100), z.literal(115), z.literal(130)]).default(100),
  density: z.enum(["comfortable", "compact"]).default("comfortable"),
  font: z.enum(["newsreader", "atkinson"]).default("newsreader"),
  countHint: z.enum(["hidden", "range", "exact"]).default("hidden"),
  confidenceInput: z.enum(["slider", "buttons"]).default("slider"),
  /** Days of the week (0 = Sunday) that neither break nor extend a streak. */
  restDays: z.array(z.number().int().min(0).max(6)).max(6).default([]),
  showStreak: z.boolean().default(true),
  /** A− / A+ inside a round (Q12), separate from the global text size. */
  roundText: z.number().min(0.85).max(1.4).default(1),
});
export type ProfilePrefs = z.infer<typeof ProfilePrefsSchema>;

export const DevicePrefsSchema = z.object({
  motion: z.enum(["system", "reduced", "full"]).default("system"),
  titleScreen: z.enum(["always", "session", "never"]).default("session"),
  engine: z.enum(["auto", "offline"]).default("auto"),
});
export type DevicePrefs = z.infer<typeof DevicePrefsSchema>;

export const ProfileSchema = z.object({
  id: z.string().regex(/^prf_[\w-]+$/),
  name: z.string().trim().min(1).max(24),
  avatar: AvatarSchema,
  createdAt: z.string(),
  lastActiveAt: z.string(),
  /** A temporary profile, wiped when a new browser session starts. */
  guest: z.boolean().default(false),
  tutorialDone: z.boolean().default(false),
  onboarding: z
    .object({
      level: z.string().optional(),
      subjects: z.array(z.string()).max(12).default([]),
      goalPerWeek: z.number().int().min(1).max(7).optional(),
    })
    .default({ subjects: [] }),
  prefs: ProfilePrefsSchema.default(ProfilePrefsSchema.parse({})),
});
export type Profile = z.infer<typeof ProfileSchema>;

const DayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const StreakSchema = z.object({
  current: z.number().int().min(0).default(0),
  best: z.number().int().min(0).default(0),
  /** The last local day that counted (yyyy-mm-dd). */
  lastDay: DayKey.nullable().default(null),
  freezes: z.number().int().min(0).max(2).default(0),
  frozenDays: z.array(DayKey).default([]),
  /** A streak that broke recently, which three rounds in one day can still repair. */
  broken: z.object({ length: z.number().int(), lastDay: DayKey, brokeOn: DayKey }).nullable().default(null),
  /** Months (yyyy-mm) in which a repair was used: at most one each. */
  repairs: z.array(z.string()).default([]),
});
export type Streak = z.infer<typeof StreakSchema>;

export const StatsSchema = z.object({
  xp: z.number().min(0).default(0),
  streak: StreakSchema.default(StreakSchema.parse({})),
  /** Daily cases played, by date: the first (scored) attempt only. */
  daily: z.record(DayKey, z.object({ roundId: z.string(), score: z.number(), max: z.number() })).default({}),
  badges: z.record(z.string(), z.object({ earnedAt: z.string() })).default({}),
  totals: z
    .object({
      rounds: z.number().int().default(0),
      catches: z.number().int().default(0),
      misses: z.number().int().default(0),
      falseFlags: z.number().int().default(0),
      perfectRounds: z.number().int().default(0),
      notesRounds: z.number().int().default(0),
    })
    .default({ rounds: 0, catches: 0, misses: 0, falseFlags: 0, perfectRounds: 0, notesRounds: 0 }),
  /** Rounds completed per local day, for the heat map and streak repair. */
  days: z.record(DayKey, z.number().int()).default({}),
  /** Recent per-round facts that badges look back over. Newest last, capped. */
  recent: z
    .array(z.object({ brier: z.number().nullable(), confidentMistakes: z.number().int(), judgements: z.number().int() }))
    .default([]),
  subjects: z.array(z.string()).default([]),
  best: z.object({ roundId: z.string(), score: z.number(), max: z.number(), topic: z.string() }).nullable().default(null),
  /** Round ids already counted, so a reload or a second tab never awards twice. */
  awarded: z.array(z.string()).default([]),
  /** The latest time seen, to notice a device clock that jumps backwards. */
  lastSeenAt: z.string().nullable().default(null),
});
export type Stats = z.infer<typeof StatsSchema>;

export const emptyStats = (): Stats => StatsSchema.parse({});
