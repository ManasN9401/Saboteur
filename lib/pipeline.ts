import "server-only";
import { ERROR_RANGE, MAX_VERIFY_RETRIES } from "./config";
import { callJSON, LLMError } from "./llm";
import { plantErrorsPrompt } from "./prompts/plantErrors";
import { verifyPrompt } from "./prompts/verify";
import { writeExplanationPrompt } from "./prompts/writeExplanation";
import {
  ExplanationOutputSchema,
  PlantOutputSchema,
  VerifyOutputSchema,
  type GenerateRequest,
  type PipelineStep,
  type PlantedError,
  type Round,
  type Sentence,
} from "./schemas";
import { newId, slugify } from "./text";

export type Progress = (step: PipelineStep, attempt: number, message: string) => void;

const randomInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

/** Apply the planted errors to the passage, giving the text exactly as the student will read it. */
export function sabotage(sentences: Sentence[], errors: PlantedError[]): Sentence[] {
  const byId = new Map(errors.map((e) => [e.sentenceId, e.sabotagedSentence]));
  return sentences.map((s) => ({ id: s.id, text: byId.get(s.id) ?? s.text }));
}

/** Drop anything the planter got wrong: unknown or repeated sentences, and rewrites that changed nothing. */
export function cleanErrors(raw: PlantedError[], sentences: Sentence[], taken: Set<string> = new Set()): PlantedError[] {
  const textById = new Map(sentences.map((s) => [s.id, s.text]));
  const seen = new Set(taken);
  const out: PlantedError[] = [];
  for (const e of raw) {
    const original = textById.get(e.sentenceId);
    if (!original || seen.has(e.sentenceId)) continue;
    if (e.sabotagedSentence.trim() === original.trim()) continue;
    seen.add(e.sentenceId);
    out.push({ ...e, originalSentence: original, targetsMisconceptionId: e.targetsMisconceptionId ?? undefined });
  }
  return out;
}

async function writePassage(req: GenerateRequest, onProgress: Progress, attempt: number): Promise<Sentence[]> {
  onProgress("write", attempt, attempt ? "Rewriting the briefing from scratch…" : "Writing the briefing…");
  const out = await callJSON(writeExplanationPrompt(req), ExplanationOutputSchema);
  // Renumber so ids are always s1..sN regardless of what the model returned.
  return out.sentences.map((s, i) => ({ id: `s${i + 1}`, text: s.text.trim() })).filter((s) => s.text);
}

async function plant(
  req: GenerateRequest,
  sentences: Sentence[],
  count: number,
  keep: PlantedError[] = [],
  rejected: { sentenceId: string; reason: string }[] = [],
): Promise<PlantedError[]> {
  const taken = new Set(keep.map((e) => e.sentenceId));
  const out = await callJSON(
    plantErrorsPrompt({ sentences, count, level: req.level, difficulty: req.difficulty, avoidIds: [...taken], rejected }),
    PlantOutputSchema,
  );
  return [...keep, ...cleanErrors(out.errors as PlantedError[], sentences, taken).slice(0, count)];
}

/**
 * write → plant → verify. The verifier can send us back up to MAX_VERIFY_RETRIES times: real
 * mistakes in the "correct" sentences get those sentences cut (or the passage rewritten), and
 * invalid or too-obvious errors get replanted. If problems remain, bad errors are dropped as long
 * as at least two survive.
 */
export async function generateRound(req: GenerateRequest, onProgress: Progress): Promise<{ round: Round; errors: PlantedError[] }> {
  const target = randomInt(ERROR_RANGE.min, ERROR_RANGE.max);
  let retries = 0;
  let sentences = await writePassage(req, onProgress, 0);

  onProgress("plant", 0, "Planting the errors…");
  let errors = await plant(req, sentences, target);

  for (;;) {
    if (errors.length < ERROR_RANGE.min) {
      if (retries >= MAX_VERIFY_RETRIES) throw new LLMError("We couldn't plant enough fair errors in this topic. Try a broader topic or different notes.");
      retries++;
      onProgress("plant", retries, "Not enough usable errors. Planting more…");
      errors = await plant(req, sentences, target - errors.length, errors);
      continue;
    }

    onProgress("verify", retries, retries ? "Checking the new cover story…" : "Checking our cover story…");
    const plantedIds = new Set(errors.map((e) => e.sentenceId));
    const check = await callJSON(
      verifyPrompt({
        sentences: sabotage(sentences, errors),
        planted: errors.map((e) => ({ sentenceId: e.sentenceId, explanation: e.explanation })),
        level: req.level,
        difficulty: req.difficulty,
      }),
      VerifyOutputSchema,
    );

    const unintended = check.unintendedIssues.filter((u) => !plantedIds.has(u.sentenceId) && sentences.some((s) => s.id === u.sentenceId));
    const reasons = new Map<string, string>();
    for (const c of check.plantedChecks) if (!c.valid && plantedIds.has(c.sentenceId)) reasons.set(c.sentenceId, `arguably correct: ${c.reason}`);
    for (const id of check.tooObvious) if (plantedIds.has(id) && !reasons.has(id)) reasons.set(id, "too easy to spot without subject knowledge");

    if (!unintended.length && !reasons.size) break;

    // A sentence that is wrong by accident would be graded as "correct", so it never stays in.
    // Cutting it is cheap and safe while the passage stays long enough; otherwise start over.
    if (unintended.length) {
      const cut = new Set(unintended.map((u) => u.sentenceId));
      if (sentences.length - cut.size >= 7) {
        sentences = sentences.filter((s) => !cut.has(s.id));
      } else if (retries < MAX_VERIFY_RETRIES) {
        retries++;
        sentences = await writePassage(req, onProgress, retries);
        onProgress("plant", retries, "Planting the errors…");
        errors = await plant(req, sentences, target);
        continue;
      } else {
        throw new LLMError("We couldn't produce a passage our fact-checker trusted. Try again, or paste your notes to ground it.");
      }
    }

    if (!reasons.size) break;
    const good = errors.filter((e) => !reasons.has(e.sentenceId));
    if (retries >= MAX_VERIFY_RETRIES) {
      if (good.length < ERROR_RANGE.min) throw new LLMError("Our fact-checker rejected too many of the planted errors. Try again.");
      errors = good;
      break;
    }
    retries++;
    onProgress("plant", retries, "The fact-checker caught a weak error. Replanting…");
    errors = await plant(
      req,
      sentences,
      errors.length - good.length,
      good,
      [...reasons].map(([sentenceId, reason]) => ({ sentenceId, reason })),
    );
  }

  const round: Round = {
    id: newId("rnd"),
    topic: req.topic,
    topicId: slugify(req.topic),
    level: req.level,
    difficulty: req.difficulty,
    sentences: sabotage(sentences, errors),
    createdAt: new Date().toISOString(),
  };
  return { round, errors };
}
