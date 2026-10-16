// Rule-based marking of a student's correction: did they name what was wrong, and what it should be?
import { wordDiff } from "../diff";
import type { CorrectionGrade } from "../schemas";
import { stem, words } from "./sentences";

const FILLER = new Set(["the", "a", "an", "of", "in", "on", "to", "and", "or", "is", "it", "its", "it's", "be", "by", "as", "at", "not", "no", "that", "this", "should", "say", "says", "was", "are", "were", "with"]);

const keyStems = (text: string) => new Set(words(text).map(stem).filter((w) => w && !FILLER.has(w)));
const numbers = (text: string) => (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(/,/g, "")));

export interface OfflineGrade {
  grade: CorrectionGrade;
  feedback: string;
}

export function gradeCorrectionOffline(original: string, sabotaged: string, correction: string): OfflineGrade {
  const fix = correction.trim();
  if (!fix) return { grade: "incorrect", feedback: "You spotted it, but didn't say what was wrong. Writing the fix is what makes it stick." };

  const parts = wordDiff(sabotaged, original);
  const restored = keyStems(parts.filter((p) => p.kind === "added").map((p) => p.text).join(" "));
  const planted = keyStems(parts.filter((p) => p.kind === "removed").map((p) => p.text).join(" "));
  const said = keyStems(fix);
  const saidNumbers = numbers(fix);
  const restoredNumbers = numbers(parts.filter((p) => p.kind === "added").map((p) => p.text).join(" "));
  const plantedNumbers = numbers(parts.filter((p) => p.kind === "removed").map((p) => p.text).join(" "));

  const namesFix = [...restored].some((w) => said.has(w)) || restoredNumbers.some((n) => saidNumbers.includes(n));
  const namesProblem = [...planted].some((w) => said.has(w)) || plantedNumbers.some((n) => saidNumbers.includes(n));
  // A dropped exception has nothing "restored" to name except the clause itself.
  const exceptionCue = restored.size > 0 && /\b(except|exception|unless|not always|not all|sometimes|usually)\b/i.test(fix) && planted.size === 0;

  if (namesFix || exceptionCue) {
    return { grade: "correct", feedback: "Spot on: you named exactly what it should say." };
  }
  if (namesProblem || /\b(opposite|reverse|backwards|wrong way|too (high|low|big|small)|not always|overgenerali)/i.test(fix)) {
    return { grade: "partially_correct", feedback: "You found the right problem. Now pin down exactly what it should say." };
  }
  return { grade: "incorrect", feedback: "Right sentence, but the mistake was somewhere else in it. Check the comparison below." };
}
