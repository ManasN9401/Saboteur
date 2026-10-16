// Canned answers for SABOTEUR_MOCK=1, so the whole game can be played without an API key.
// Uses the first three library topics; any other topic gets the closest-sounding one.
import type { Prompt } from "./llm";
import { LIBRARY } from "./offline/library";
import type { GradeParams } from "./prompts/gradeCorrections";
import type { PlantParams } from "./prompts/plantErrors";
import type { VerifyParams } from "./prompts/verify";
import type { WriteParams } from "./prompts/writeExplanation";

const CANNED = LIBRARY.slice(0, 3);
type Canned = (typeof LIBRARY)[number];

function pick(text: string): Canned {
  return CANNED.find((c) => c.match.test(text)) ?? CANNED[Math.abs([...text].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7)) % CANNED.length];
}

function cannedFor(sentences: { text: string }[]): Canned {
  return CANNED.find((c) => c.sentences[0] === sentences[0]?.text) ?? CANNED[0];
}

export function mockResponse(prompt: Prompt): unknown {
  switch (prompt.name) {
    case "writeExplanation": {
      const { topic } = prompt.params as WriteParams;
      return { sentences: pick(topic).sentences.map((text, i) => ({ id: `s${i + 1}`, text })) };
    }
    case "plantErrors": {
      const p = prompt.params as PlantParams;
      const canned = cannedFor(p.sentences);
      const avoid = new Set(p.avoidIds ?? []);
      const chosen = Object.keys(canned.errors).map(Number).filter((i) => !avoid.has(`s${i + 1}`)).slice(0, p.count);
      return {
        errors: chosen.map((i) => {
          const e = canned.errors[i];
          return { sentenceId: `s${i + 1}`, originalSentence: canned.sentences[i], sabotagedSentence: e.sabotaged, errorType: e.type, explanation: e.explanation, whyTempting: e.tempting, misconceptionLabel: e.label };
        }),
      };
    }
    case "verify": {
      const p = prompt.params as VerifyParams;
      return { plantedChecks: p.planted.map((e) => ({ sentenceId: e.sentenceId, valid: true, reason: "Clearly wrong at this level." })), unintendedIssues: [], tooObvious: [] };
    }
    case "gradeCorrections": {
      const p = prompt.params as GradeParams;
      const words = (s: string) => new Set(s.toLowerCase().match(/[a-z₂0-9]{4,}/g) ?? []);
      return {
        grades: p.catches.map((c) => {
          const fixWords = words(c.correction);
          const sab = words(c.sabotagedSentence);
          const key = [...words(c.originalSentence)].filter((w) => !sab.has(w));
          const grade = key.some((w) => fixWords.has(w)) ? "correct" : c.correction.trim().length > 3 ? "partially_correct" : "incorrect";
          const feedback = { correct: "Spot on: you named exactly what was wrong.", partially_correct: "You were onto something; check the exact detail in the original.", incorrect: "Right sentence, but the problem was something else." }[grade];
          return { sentenceId: c.sentenceId, grade, feedback };
        }),
        explanations: p.falseFlags.map((f) => ({ sentenceId: f.sentenceId, text: "This statement is accurate as written at this level." })),
      };
    }
    default:
      throw new Error(`No mock for prompt ${prompt.name}`);
  }
}
