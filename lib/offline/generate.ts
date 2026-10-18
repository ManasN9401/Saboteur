// The no-LLM version of write → plant → verify.
import { ERROR_RANGE } from "../config";
import { FriendlyError } from "../errors";
import type { GenerateRequest, PipelineStep, PlantedError, Round, Sentence } from "../schemas";
import { labelKey } from "../learning/labels";
import { newId, slugify } from "../text";
import { chooseErrors } from "./sabotage";
import type { LibraryEntry } from "./library";
import { findSource, type SourceText } from "./source";

type Progress = (step: PipelineStep, attempt: number, message: string) => void;

export const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;

/** Rule-based sanity checks standing in for the LLM verifier. */
export function looksFair(e: PlantedError): boolean {
  const ratio = e.sabotagedSentence.length / e.originalSentence.length;
  return e.sabotagedSentence !== e.originalSentence && ratio > 0.6 && ratio < 1.5 && !/\b(\w+) \1\b/i.test(e.sabotagedSentence);
}

/** Pin a round down so it can be rebuilt identically (the daily case). */
export interface OfflineOptions {
  seed?: number;
  id?: string;
  createdAt?: string;
  /** Use this library entry rather than looking the topic up. */
  entry?: LibraryEntry;
}

export async function generateOffline(req: GenerateRequest, onProgress: Progress, opts: OfflineOptions = {}): Promise<{ round: Round; errors: PlantedError[] }> {
  onProgress("write", 0, req.notes ? "Reading your notes…" : "Finding a trustworthy source…");
  const source: SourceText = opts.entry ? { sentences: opts.entry.sentences, label: `Built-in topic: ${opts.entry.title}`, library: opts.entry } : await findSource(req.topic, req.notes);
  const sentences: Sentence[] = source.sentences.map((text, i) => ({ id: `s${i + 1}`, text }));

  onProgress("plant", 0, "Planting the errors…");
  const seed = opts.seed ?? hash(`${req.topic}|${Date.now()}`);
  const count = ERROR_RANGE.min + (seed % (ERROR_RANGE.max - ERROR_RANGE.min + 1));

  // A targeted round (V06-05): an error with the same label hits the target exactly; one of the
  // same type exploits the same kind of mistake.
  const targets = req.targets ?? [];
  const targetOf = (label: string, type: string) => targets.find((t) => labelKey(t.label) === labelKey(label) || t.key === labelKey(label)) ?? targets.find((t) => t.errorType === type);
  const rank = (label: string, type: string) => (targets.some((t) => labelKey(t.label) === labelKey(label) || t.key === labelKey(label)) ? 2 : targetOf(label, type) ? 1 : 0);

  // Hand-written errors from the library are better than rules, so use those first.
  const errors: PlantedError[] = [];
  if (source.library) {
    const curated = Object.entries(source.library.errors).sort((a, b) => rank(b[1].label, b[1].type) - rank(a[1].label, a[1].type) || hash(a[0] + seed) - hash(b[0] + seed));
    for (const [index, e] of curated.slice(0, count)) {
      const s = sentences[Number(index)];
      errors.push({ sentenceId: s.id, originalSentence: s.text, sabotagedSentence: e.sabotaged, errorType: e.type, explanation: e.explanation, whyTempting: e.tempting, misconceptionLabel: e.label, targetsMisconceptionId: targetOf(e.label, e.type)?.key });
    }
  }
  const prefer = targets.map((t) => t.errorType);
  const fromRule = (c: ReturnType<typeof chooseErrors>[number]): PlantedError => ({
    sentenceId: c.sentenceId,
    originalSentence: c.originalSentence,
    sabotagedSentence: c.sabotagedSentence,
    errorType: c.errorType,
    explanation: c.explanation,
    whyTempting: c.whyTempting,
    misconceptionLabel: c.misconceptionLabel,
    targetsMisconceptionId: targetOf(c.misconceptionLabel, c.errorType)?.key,
  });
  if (errors.length < count) {
    const taken = new Set(errors.map((e) => e.sentenceId));
    for (const c of chooseErrors(sentences, count - errors.length, req.difficulty, seed, taken, prefer)) errors.push(fromRule(c));
  }
  // Still nothing on target, but a rule can make one of the right type: swap it in for the last error.
  if (targets.length && !errors.some((e) => e.targetsMisconceptionId && looksFair(e))) {
    const rest = errors.slice(0, -1);
    const hit = chooseErrors(sentences, 1, req.difficulty, seed, new Set(rest.map((e) => e.sentenceId)), prefer).find((c) => prefer.includes(c.errorType));
    if (hit) errors.splice(0, errors.length, ...rest, fromRule(hit));
  }

  onProgress("verify", 0, "Checking our cover story…");
  const fair = errors.filter(looksFair);
  if (fair.length < ERROR_RANGE.min) {
    throw new FriendlyError("This text doesn't give the rule-based saboteur enough to work with (it needs numbers, comparisons or key terms). Try more detailed notes or a built-in topic.");
  }

  const byId = new Map(fair.map((e) => [e.sentenceId, e.sabotagedSentence]));
  const round: Round = {
    id: opts.id ?? newId("rnd"),
    topic: req.topic,
    topicId: slugify(req.topic),
    level: req.level,
    difficulty: req.difficulty,
    sentences: sentences.map((s) => ({ id: s.id, text: byId.get(s.id) ?? s.text })),
    createdAt: opts.createdAt ?? new Date().toISOString(),
    engine: "offline",
    source: { label: source.label, url: source.url },
    subject: source.library?.subject,
  };
  return { round, errors: fair };
}
