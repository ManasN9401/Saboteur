// Shapes for the Wrong Answer Autopsy (docs/roadmap/v0.7-autopsy): what the student brings, what the
// diagnoser says about each wrong answer, and the check questions that follow.
import { z } from "zod";
import { ErrorTypeSchema } from "../schemas";

export const IntakeItemSchema = z.object({
  id: z.string().min(1).max(12),
  question: z.string().trim().min(1).max(1200),
  answer: z.string().trim().min(1).max(1200),
  correct: z.string().trim().min(1).max(1200),
});
export type IntakeItemInput = z.infer<typeof IntakeItemSchema>;

/** A photo, screenshot or PDF page of marked work (v0.7b). Read once by the model and never kept. */
export const AutopsyImageSchema = z.object({
  mediaType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
  /** Base64, without the data: prefix. About 5 MB of image at most. */
  data: z.string().min(16).max(7_000_000),
});
export type AutopsyImage = z.infer<typeof AutopsyImageSchema>;

export const DiagnoseRequestSchema = z
  .object({
    items: z.array(IntakeItemSchema).max(20).default([]),
    image: AutopsyImageSchema.optional(),
    subject: z.string().trim().max(60).optional(),
    level: z.string().trim().min(2).max(80),
  })
  .refine((r) => r.items.length > 0 || r.image, "Paste at least one wrong answer, or add a picture of your marked work.");
export type DiagnoseRequest = z.infer<typeof DiagnoseRequestSchema>;

export const DiagnosisSchema = z.object({
  itemId: z.string(),
  /** A wrong belief, or just a slip (arithmetic, copying, misreading): slips are never filed as misconceptions. */
  kind: z.enum(["misconception", "careless_slip"]),
  /** The wrong belief in under twelve words ("Resistances in parallel add up"), or what the slip was. */
  label: z.string().min(1).max(160),
  errorType: ErrorTypeSchema.nullable(),
  /** How the belief produces exactly this wrong answer. */
  explanation: z.string().min(1).max(800),
  /** The right idea, in a sentence or two. */
  correction: z.string().min(1).max(800),
  confidence: z.number().min(0).max(1),
  /** When unsure: a yes/no question to ask the student instead ("Did you think resistance adds up in parallel?"). */
  probe: z.string().max(300).nullable(),
  subject: z.string().max(60),
  /** A short revision topic for a drill ("Resistors in parallel"). */
  topic: z.string().min(1).max(80),
});
export type Diagnosis = z.infer<typeof DiagnosisSchema>;

/** Items read from an image come back with the diagnoses, so the page can show what was read. */
export const DiagnoseOutputSchema = z.object({
  items: z.array(IntakeItemSchema.extend({ id: z.string() })).optional(),
  diagnoses: z.array(DiagnosisSchema),
});
export type DiagnoseOutput = z.infer<typeof DiagnoseOutputSchema>;

export const QuestionsRequestSchema = z.object({
  label: z.string().trim().min(1).max(160),
  errorType: ErrorTypeSchema.nullable(),
  explanation: z.string().trim().max(800),
  correction: z.string().trim().max(800),
  subject: z.string().trim().max(60),
  level: z.string().trim().min(2).max(80),
  example: IntakeItemSchema.omit({ id: true }),
});
export type QuestionsRequest = z.infer<typeof QuestionsRequestSchema>;

export const CheckQuestionSchema = z
  .object({
    stem: z.string().min(1).max(600),
    options: z.array(z.string().min(1).max(300)).length(4),
    /** The right option (0–3). */
    answer: z.number().int().min(0).max(3),
    /** The option the misconception would choose (0–3), never the right one. */
    trap: z.number().int().min(0).max(3),
    explanation: z.string().min(1).max(800),
    /** Why the trap option is tempting, and wrong. */
    trapExplanation: z.string().min(1).max(600),
  })
  .refine((q) => q.answer !== q.trap, "The trap can't be the right answer.");
export type CheckQuestion = z.infer<typeof CheckQuestionSchema>;

export const QuestionsOutputSchema = z.object({ questions: z.array(CheckQuestionSchema).min(2).max(3) });
export type QuestionsOutput = z.infer<typeof QuestionsOutputSchema>;

/** Streaming progress from /api/autopsy/diagnose. */
export type AutopsyEvent =
  | { type: "progress"; step: "read" | "examine" | "write"; message: string }
  | { type: "done"; result: DiagnoseOutput }
  | { type: "offline"; message: string }
  | { type: "error"; message: string };
