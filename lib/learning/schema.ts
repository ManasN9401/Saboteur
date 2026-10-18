// What the game has learned about one player (docs/roadmap/v0.6-learning-loop): the misconceptions that
// get past them, how well their confidence matches their accuracy, and what is due for review. Stored
// inside the profile's stats, so it travels with export and import.
import { z } from "zod";
import { ErrorTypeSchema } from "../schemas";

export const OutcomeSchema = z.enum(["caught", "half", "missed"]);
export type Outcome = z.infer<typeof OutcomeSchema>;

/** One time a misconception was planted in front of the player, or found in their marked work (autopsy). */
export const SightingSchema = z.object({
  /** The round, or for an autopsy the finding's own id. */
  roundId: z.string(),
  source: z.enum(["round", "autopsy"]).default("round"),
  at: z.string(),
  topic: z.string(),
  outcome: OutcomeSchema,
  /** The confidence they flagged it with, when they flagged it. */
  confidence: z.number().optional(),
  original: z.string(),
  sabotaged: z.string(),
  explanation: z.string(),
  whyTempting: z.string().default(""),
});
export type Sighting = z.infer<typeof SightingSchema>;

/** Leitner box 0–3 is in the queue (due after 1, 3, 7 or 16 days); 4 means retired. */
export const ReviewSchema = z.object({
  box: z.number().int().min(0).max(4),
  due: z.string().nullable(),
});
export type Review = z.infer<typeof ReviewSchema>;

/** The Wrong Answer Autopsy's say on a misconception (v0.7): the student confirmed it, rejected the diagnosis, or fixed it. */
export const AutopsyStatusSchema = z.enum(["confirmed", "rejected", "resolved"]);
export type AutopsyStatus = z.infer<typeof AutopsyStatusSchema>;
export const AutopsyRecordSchema = z.object({
  status: AutopsyStatusSchema,
  history: z
    .array(
      z.object({
        at: z.string(),
        event: z.enum(["confirmed", "rejected", "checked", "resolved"]),
        /** Check questions: how many right, out of how many. */
        right: z.number().int().optional(),
        of: z.number().int().optional(),
      }),
    )
    .default([]),
});
export type AutopsyRecord = z.infer<typeof AutopsyRecordSchema>;

export const MisconceptionSchema = z.object({
  key: z.string(),
  label: z.string(),
  errorType: ErrorTypeSchema,
  subjects: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
  level: z.string().optional(),
  seen: z.number().int().default(0),
  caught: z.number().int().default(0),
  /** Flagged the right sentence, but the correction was wrong. */
  half: z.number().int().default(0),
  missed: z.number().int().default(0),
  /** Missed while betting at least 80% that every error had been found. */
  confidentWrong: z.number().int().default(0),
  firstSeen: z.string(),
  lastSeen: z.string(),
  /** Strength (how firmly it holds) at `strengthAt`; it halves every HALF_LIFE_DAYS after that. */
  strength: z.number().min(0).default(0),
  strengthAt: z.string(),
  review: ReviewSchema.nullable().default(null),
  history: z.array(SightingSchema).default([]),
  /** Null for misconceptions only ever met in planted rounds. */
  autopsy: AutopsyRecordSchema.nullable().default(null),
  /** The right idea, from an autopsy diagnosis. */
  correction: z.string().optional(),
});
export type Misconception = z.infer<typeof MisconceptionSchema>;

const Tally = z.object({ bets: z.number().int().default(0), hits: z.number().int().default(0), conf: z.number().default(0), sq: z.number().default(0) });
export type Tally = z.infer<typeof Tally>;
const emptyTally = (): Tally => ({ bets: 0, hits: 0, conf: 0, sq: 0 });

export const CalibrationSchema = z.object({
  /** Every bet so far: count, hits, summed confidence, summed squared error (for Brier). */
  all: Tally.default(emptyTally()),
  /** By confidence, rounded to the nearest 10%: "50" … "100". */
  buckets: z.record(z.string(), Tally).default({}),
  bySubject: z.record(z.string(), Tally).default({}),
  /** Planted errors by type: how many were seen and caught (half-catches count as caught). */
  byErrorType: z.record(z.string(), z.object({ seen: z.number().int(), caught: z.number().int() })).default({}),
  /** The same, per subject and type ("biology|swapped_terms"), for "… in biology". */
  bySubjectType: z.record(z.string(), z.object({ seen: z.number().int(), caught: z.number().int() })).default({}),
  /** One point per round, oldest first. */
  brier: z.array(z.object({ roundId: z.string(), at: z.string(), brier: z.number(), bets: z.number().int() })).default([]),
});
export type Calibration = z.infer<typeof CalibrationSchema>;

export const LearningSchema = z.object({
  version: z.literal(1).default(1),
  misconceptions: z.record(z.string(), MisconceptionSchema).default({}),
  /** Label keys merged into another (label normalisation): key → canonical key. */
  aliases: z.record(z.string(), z.string()).default({}),
  /** Keys already sent for normalisation, so each label is asked about once. */
  normalised: z.array(z.string()).default([]),
  calibration: CalibrationSchema.default(CalibrationSchema.parse({})),
  /** Rounds already learned from, so nothing counts twice. */
  counted: z.array(z.string()).default([]),
  /** Review cases closed, and misconceptions retired from the queue. */
  reviews: z.object({ closed: z.number().int().default(0), retired: z.number().int().default(0) }).default({ closed: 0, retired: 0 }),
});
export type Learning = z.infer<typeof LearningSchema>;

export const emptyLearning = (): Learning => LearningSchema.parse({});
