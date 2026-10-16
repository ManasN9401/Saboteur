// Sentence splitting and light text helpers for the offline (no-LLM) engine.

const ABBREVIATIONS = ["e.g", "i.e", "etc", "vs", "approx", "c", "ca", "cf", "Dr", "Mr", "Mrs", "Ms", "Prof", "St", "Jr", "Sr", "No", "Fig", "al", "U.S", "U.K", "U.N"];

/** Split prose into sentences without breaking on "e.g.", "Dr.", decimals or initials. */
export function splitSentences(text: string): string[] {
  const clean = text
    .replace(/\[\d+\]|\[citation needed\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return [];
  // Protect dots that don't end a sentence.
  const guarded = clean
    .replace(new RegExp(`\\b(${ABBREVIATIONS.map((a) => a.replace(/\./g, "\\.")).join("|")})\\.`, "g"), (m) => m.replace(/\./g, "․"))
    .replace(/\b([A-Z])\.(?=\s?[A-Z]\.)/g, "$1․")
    // A lone initial after a capitalised word ("Sir I. Newton") is part of a name.
    .replace(/(?<=\b[A-Z][a-z]+ )([A-Z])\.(?= [A-Z])/g, "$1․")
    .replace(/(\d)\.(\d)/g, "$1․$2");
  return guarded
    .split(/(?<=[.!?]["”’)]?)\s+(?=["“(]?[A-Z0-9])/)
    .map((s) => s.replace(/․/g, ".").trim())
    .filter(Boolean);
}

/** Bullet points and line-broken notes become sentences too. */
export function notesToSentences(notes: string): string[] {
  return notes
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•–]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
    .map((line) => (/[.!?]["”’)]?$/.test(line) ? line : `${line}.`))
    .flatMap(splitSentences);
}

export const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Keep sentences that can stand alone and be judged: not too short, not too long, not questions. */
export function usableSentence(s: string): boolean {
  const n = wordCount(s);
  return n >= 6 && n <= 45 && !s.endsWith("?") && /[a-z]/.test(s) && !/^(see also|references|this article)/i.test(s);
}

/** Pick up to `max` sentences in order, preferring ones with concrete content (numbers, terms, causes). */
export function selectSentences(all: string[], max = 14): string[] {
  const usable = all.filter(usableSentence);
  if (usable.length <= max) return usable;
  const scored = usable.map((s, i) => ({
    i,
    score:
      (/\d/.test(s) ? 2 : 0) +
      (/\b(because|causes?|leads? to|results? in|therefore|so that|when|during|before|after)\b/i.test(s) ? 2 : 0) +
      (s.match(/\b[A-Z][a-z]{2,}/g)?.length ?? 0) * 0.3 +
      Math.min(wordCount(s), 30) / 15 -
      i * 0.08, // the opening of a text is usually the clearest overview
  }));
  const keep = new Set(scored.sort((a, b) => b.score - a.score).slice(0, max).map((x) => x.i));
  return usable.filter((_, i) => keep.has(i));
}

/** Crude English stemmer: enough to match "cools"/"cooling"/"cooled" to "cool". */
export function stem(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z0-9₂]/g, "");
  if (w.length > 5) w = w.replace(/(ations?|ingly|edly|ings?|ness|ment|ies|ied|ers?|ed|es|ly)$/, "");
  if (w.length > 3) w = w.replace(/s$/, "");
  return w;
}

export const words = (s: string) => s.match(/[A-Za-z][A-Za-z'-]*|\d+(?:[.,]\d+)?%?/g) ?? [];

export function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
