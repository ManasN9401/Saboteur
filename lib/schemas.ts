import { z } from "zod";
import { DIFFICULTIES } from "./config";

/* ---------- Domain ---------- */

export const DifficultySchema = z.enum(DIFFICULTIES);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const ERROR_TYPES = [
  "reversed_causation",
  "wrong_quantity_or_value",
  "swapped_terms",
  "false_generalisation",
  "missing_exception",
  "wrong_mechanism",
  "wrong_sequence",
  "wrong_attribution",
  "plausible_but_false_detail",
] as const;
export const ErrorTypeSchema = z.enum(ERROR_TYPES);
export type ErrorType = z.infer<typeof ErrorTypeSchema>;

export const SentenceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});
export type Sentence = z.infer<typeof SentenceSchema>;

export const PlantedErrorSchema = z.object({
  sentenceId: z.string(),
  originalSentence: z.string().min(1),
  sabotagedSentence: z.string().min(1),
  errorType: ErrorTypeSchema,
  explanation: z.string().min(1),
  whyTempting: z.string().min(1),
  misconceptionLabel: z.string().min(1),
  targetsMisconceptionId: z.string().optional(),
});
export type PlantedError = z.infer<typeof PlantedErrorSchema>;

export const RoundSchema = z.object({
  id: z.string(),
  topic: z.string(),
  topicId: z.string(),
  level: z.string(),
  difficulty: DifficultySchema,
  sentences: z.array(SentenceSchema),
  createdAt: z.string(),
  /** "offline" rounds were built by rules from a trusted source, without a language model. */
  engine: z.enum(["llm", "offline"]).optional(),
  source: z.object({ label: z.string(), url: z.string().optional() }).optional(),
  /** The school subject, when known (library topics): drives the Polymath badge and daily rotation. */
  subject: z.string().optional(),
});
export type Round = z.infer<typeof RoundSchema>;

export const ConfidenceSchema = z.number().min(0.5).max(1);

export const FlagSchema = z.object({
  sentenceId: z.string().min(1),
  correction: z.string().max(1000),
  confidence: ConfidenceSchema,
});
export type Flag = z.infer<typeof FlagSchema>;

export const SubmissionSchema = z.object({
  roundId: z.string().min(1),
  flags: z.array(FlagSchema).max(40),
  foundAllConfidence: ConfidenceSchema,
  timeTakenSec: z.number().nonnegative().optional(),
});
export type Submission = z.infer<typeof SubmissionSchema>;

export const CorrectionGradeSchema = z.enum(["correct", "partially_correct", "incorrect"]);
export type CorrectionGrade = z.infer<typeof CorrectionGradeSchema>;

export const GradedItemSchema = z.object({
  sentenceId: z.string(),
  kind: z.enum(["catch", "miss", "false_flag"]),
  correctionGrade: CorrectionGradeSchema.optional(),
  feedback: z.string(),
  confidence: z.number().optional(),
  points: z.number(),
});
export type GradedItem = z.infer<typeof GradedItemSchema>;

export const RoundResultSchema = z.object({
  roundId: z.string(),
  items: z.array(GradedItemSchema),
  errors: z.array(PlantedErrorSchema),
  score: z.number(),
  maxScore: z.number(),
});
export type RoundResult = z.infer<typeof RoundResultSchema>;

/* ---------- API request bodies ---------- */

/** A misconception a round should try to plant again (V06-05). `key` is the profile's id for it. */
export const TargetSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().trim().min(1).max(200),
  errorType: ErrorTypeSchema,
});
export type Target = z.infer<typeof TargetSchema>;

export const GenerateRequestSchema = z.object({
  topic: z.string().trim().min(2, "Give the topic at least a couple of words.").max(200),
  level: z.string().trim().min(2).max(80),
  difficulty: DifficultySchema,
  notes: z.string().trim().max(12000).optional(),
  /** Build the daily case for this date (yyyy-mm-dd) instead; topic and difficulty are then ignored. */
  daily: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** The player chose to play without AI on this device. */
  engine: z.enum(["auto", "offline"]).optional(),
  /** Misconceptions this player keeps falling for: plant at least one of them if the topic allows. */
  targets: z.array(TargetSchema).max(3).optional(),
});
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

/* ---------- LLM outputs ---------- */

export const ExplanationOutputSchema = z.object({
  sentences: z.array(SentenceSchema).min(6).max(20),
});

export const PlantOutputSchema = z.object({
  errors: z
    .array(PlantedErrorSchema.omit({ targetsMisconceptionId: true }).extend({ targetsMisconceptionId: z.string().nullish() }))
    .min(1)
    .max(6),
});

export const VerifyOutputSchema = z.object({
  plantedChecks: z.array(z.object({ sentenceId: z.string(), valid: z.boolean(), reason: z.string() })),
  unintendedIssues: z.array(z.object({ sentenceId: z.string(), issue: z.string() })),
  tooObvious: z.array(z.string()),
});

export const GradeOutputSchema = z.object({
  grades: z.array(
    z.object({
      sentenceId: z.string(),
      grade: CorrectionGradeSchema,
      feedback: z.string(),
    }),
  ),
  explanations: z.array(z.object({ sentenceId: z.string(), text: z.string() })),
});
export type GradeOutput = z.infer<typeof GradeOutputSchema>;

/* ---------- Streaming progress from /api/saboteur/generate ---------- */

export type PipelineStep = "write" | "plant" | "verify";

export type GenerateEvent =
  | { type: "progress"; step: PipelineStep; attempt: number; message: string }
  | { type: "done"; round: Round }
  | { type: "error"; message: string };
