// Misconception labels come from the planter in free text ("Photosynthesis happens in the
// mitochondria", "photosynthesis occurs in mitochondria"). A key folds the obvious variants together;
// the language model merges the rest (app/api/learning/normalise), and those merges are kept as aliases.
import type { Learning } from "./schema";

const STOP = new Set("a an the of is are was were be been to in on at for and or that this by with as it its from into than then so do does".split(" "));

/** A stable key for a label: lower case, punctuation and filler words dropped, simple plurals folded. */
export function labelKey(label: string): string {
  const words = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9₀-₉]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is") ? w.slice(0, -1) : w));
  return words.join("-").slice(0, 80) || "unlabelled";
}

/** The key a label is filed under, following merges (at most a few hops; cycles stop). */
export function resolveKey(learning: Pick<Learning, "aliases">, label: string): string {
  let key = labelKey(label);
  for (let i = 0; i < 4 && learning.aliases[key] && learning.aliases[key] !== key; i++) key = learning.aliases[key];
  return key;
}
