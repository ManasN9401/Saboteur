import { EFFORT, MODELS } from "../config";
import type { Prompt } from "../llm";

export interface WriteParams {
  topic: string;
  level: string;
  notes?: string;
}

export function writeExplanationPrompt(params: WriteParams): Prompt<WriteParams> {
  const { topic, level, notes } = params;
  return {
    name: "writeExplanation",
    params,
    model: MODELS.generate,
    effort: EFFORT.write,
    system: `You are an expert teacher writing a clear, accurate explanation of a topic for a student at the stated level. Write 8–16 sentences (180–350 words). Every sentence must be factually correct and self-contained enough to be judged on its own. Prefer concrete facts, mechanisms, causes, sequences, and values over vague statements, because each sentence may later be tested. Do not use hedging words like "sometimes" or "usually" unless they are factually necessary. If source notes are provided, stay within their content and terminology. Use UK spelling.

Return JSON only, in exactly this shape: { "sentences": [{ "id": "s1", "text": "..." }, ...] }`,
    user: [
      `Topic: ${topic}`,
      `Student level: ${level}`,
      notes ? `Source notes (stay within these):\n"""\n${notes}\n"""` : "No source notes were provided.",
    ].join("\n\n"),
  };
}
