/**
 * How often a targeted round actually plants a targeted error (V06-05 acceptance).
 *
 *     npm run eval:targeting                          # offline engine (rules and the library)
 *     SABOTEUR_MOCK=1 npm run eval:targeting -- llm   # the LLM pipeline against canned answers
 *     npm run eval:targeting -- llm                   # the real models (any provider key, see docs/router.md; ~20 rounds of calls)
 *
 * Offline, each round targets a misconception from the topic's own library entry ("exact"), or only a
 * kind of error ("type"). Targets are hit in every round where a matching error is possible: the
 * report says how many weren't, and why. The LLM run asks for a library misconception on its topic and
 * should hit at least 70% of rounds.
 */
import { labelKey } from "../../lib/learning/labels";
import { LIBRARY, type LibraryEntry } from "../../lib/offline/library";
import { generateOffline } from "../../lib/offline/generate";
import { candidatesFor } from "../../lib/offline/sabotage";
import { generateRound } from "../../lib/pipeline";
import { ERROR_TYPES, type ErrorType, type GenerateRequest, type PlantedError, type Target } from "../../lib/schemas";

const ROUNDS = 20;
const quiet = () => {};
const pick = <T>(xs: readonly T[], n: number) => xs[n % xs.length];
const hit = (errors: PlantedError[]) => errors.some((e) => e.targetsMisconceptionId);

function exactTarget(entry: LibraryEntry, n: number): Target {
  const e = pick(Object.values(entry.errors), n);
  return { key: labelKey(e.label), label: e.label, errorType: e.type };
}

/** Could this topic carry an error of this type at all (a curated one, or a rule)? */
function possible(entry: LibraryEntry, type: ErrorType): boolean {
  if (Object.values(entry.errors).some((e) => e.type === type)) return true;
  const sentences = entry.sentences.map((text, i) => ({ id: `s${i + 1}`, text }));
  return sentences.some((s) => candidatesFor(s, sentences, "subtle").some((c) => c.errorType === type));
}

async function offline() {
  for (const mode of ["exact", "type"] as const) {
    let hits = 0;
    let possibleRounds = 0;
    const misses: string[] = [];
    for (let n = 0; n < ROUNDS; n++) {
      const entry = pick(LIBRARY, n * 7);
      const target: Target = mode === "exact" ? exactTarget(entry, n) : { key: `type-${n}`, label: "A mistake of this kind", errorType: pick(ERROR_TYPES, n * 5 + 1) };
      const req: GenerateRequest = { topic: entry.title, level: "A-level", difficulty: "subtle", targets: [target] };
      const { errors } = await generateOffline(req, quiet, { entry, seed: 1000 + n });
      const can = possible(entry, target.errorType);
      if (can) possibleRounds++;
      if (hit(errors)) hits++;
      else misses.push(`${entry.title} / ${target.errorType}${can ? "  ← possible but missed" : " (no error of this type possible)"}`);
    }
    console.log(`offline, ${mode} targets: ${hits}/${ROUNDS} rounds hit a target; ${hits}/${possibleRounds} where one was possible`);
    for (const m of misses) console.log(`  · ${m}`);
  }
}

async function llm() {
  // The mock answers with three canned topics (lib/mock.ts), so it can only be asked about those.
  const topics = process.env.SABOTEUR_MOCK === "1" ? LIBRARY.slice(0, 3) : LIBRARY;
  let hits = 0;
  for (let n = 0; n < ROUNDS; n++) {
    const entry = pick(topics, n * 7);
    const target = exactTarget(entry, n);
    const { errors } = await generateRound({ topic: entry.title, level: "A-level", difficulty: "subtle", targets: [target] }, quiet);
    if (hit(errors)) hits++;
    console.log(`  ${hit(errors) ? "✓" : "✗"} ${entry.title}: “${target.label}”`);
  }
  console.log(`llm${process.env.SABOTEUR_MOCK === "1" ? " (mock)" : ""}: ${hits}/${ROUNDS} = ${Math.round((hits / ROUNDS) * 100)}% (target ≥ 70%)`);
}

await (process.argv.includes("llm") ? llm() : offline());
