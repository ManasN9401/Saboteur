import { z } from "zod";
import { DifficultySchema, FlagSchema, RoundResultSchema, RoundSchema, SubmissionSchema } from "../schemas";

export const MetaSchema = z.object({
  schemaVersion: z.literal(2),
  activeProfileId: z.string().nullable(),
  profileOrder: z.array(z.string()),
});
export type Meta = z.infer<typeof MetaSchema>;

export const RoundRecordSchema = z.object({
  round: RoundSchema,
  notes: z.string().optional(),
  submission: SubmissionSchema.optional(),
  result: RoundResultSchema.optional(),
  playedAt: z.string().optional(),
  /** The daily case this round is (yyyy-mm-dd). Only the first attempt each day is scored. */
  daily: z.string().optional(),
  /** A replay of an earlier case, for revision: never scored. */
  replayOf: z.string().optional(),
  /** A review case (Leitner queue), built to target misconceptions that were due. */
  review: z.boolean().optional(),
  /** Misconception keys this round was asked to target ("Drill this", review cases). */
  targets: z.array(z.string()).optional(),
});
export type RoundRecord = z.infer<typeof RoundRecordSchema>;

export const SetupSettingsSchema = z.object({
  topic: z.string(),
  level: z.string(),
  difficulty: DifficultySchema,
  notes: z.string().default(""),
});
export type SetupSettings = z.infer<typeof SetupSettingsSchema>;

export const TopicsSchema = z.object({
  recent: z.array(z.string()).max(12).default([]),
  favourites: z.array(z.string()).max(24).default([]),
});
export type Topics = z.infer<typeof TopicsSchema>;

/** Pasted notes saved per topic (Q6), keyed by topic slug. */
export const NotesLibrarySchema = z.record(z.string(), z.object({ topic: z.string(), notes: z.string(), savedAt: z.string() }));
export type NotesLibrary = z.infer<typeof NotesLibrarySchema>;

export const DraftSchema = z.array(FlagSchema);
