// Rule-based error planting for when no language model is available. Each rule rewrites one sentence
// so that it states something false while still reading naturally, and explains what changed.
import type { Difficulty, ErrorType, PlantedError, Sentence } from "../schemas";
import { escapeRegExp } from "./sentences";

export interface Candidate extends Omit<PlantedError, "targetsMisconceptionId"> {
  /** 0 = very easy to spot, 1 = needs real subject knowledge. */
  subtlety: number;
  rule: string;
}

/* ---------- Word lists ---------- */

// Pairs where swapping one for the other reverses the meaning.
const DIRECTION: [string, string][] = [
  ["increases", "decreases"], ["increase", "decrease"], ["increased", "decreased"], ["increasing", "decreasing"],
  ["rises", "falls"], ["rise", "fall"], ["rising", "falling"], ["raises", "lowers"],
  ["higher", "lower"], ["highest", "lowest"], ["more", "less"],
  ["larger", "smaller"], ["largest", "smallest"], ["greater", "smaller"], ["bigger", "smaller"],
  ["faster", "slower"], ["fastest", "slowest"], ["stronger", "weaker"], ["strongest", "weakest"],
  ["absorbs", "releases"], ["absorb", "release"], ["absorbed", "released"], ["absorbing", "releasing"],
  ["gains", "loses"], ["gain", "loss"], ["gained", "lost"],
  ["expands", "contracts"], ["expand", "contract"], ["heats", "cools"], ["warms", "cools"], ["warmer", "cooler"],
  ["attracts", "repels"], ["attract", "repel"], ["positive", "negative"], ["positively", "negatively"],
  ["denser", "less dense"], ["thicker", "thinner"], ["longer", "shorter"], ["deeper", "shallower"],
  ["oxidation", "reduction"], ["oxidised", "reduced"], ["exothermic", "endothermic"],
  ["acidic", "alkaline"], ["soluble", "insoluble"], ["permeable", "impermeable"],
  ["inhibits", "stimulates"], ["inhibit", "stimulate"], ["promotes", "prevents"],
  ["away from", "towards"], ["inside", "outside"], ["internal", "external"],
  ["left", "right"], ["north", "south"], ["east", "west"],
  ["import", "export"], ["imports", "exports"], ["surplus", "deficit"], ["inflation", "deflation"],
  ["rich", "poor"], ["wet", "dry"], ["hot", "cold"], ["high", "low"],
];

// Pairs that put events in the wrong order.
const SEQUENCE: [string, string][] = [
  ["before", "after"], ["first", "last"], ["earlier", "later"], ["precedes", "follows"], ["preceded", "followed"],
  ["beginning", "end"], ["start", "end"],
];

// Hedged words that become sweeping claims.
const GENERALISE: [RegExp, string][] = [
  [/\b(usually|often|generally|typically|mostly|frequently|commonly|normally|sometimes)\b/i, "always"],
  [/\b(rarely|seldom)\b/i, "never"],
  [/\bmost\b(?= [a-z])/i, "all"],
  [/\bmany\b(?= [a-z])/i, "all"],
  [/\bsome\b(?= [a-z])/i, "all"],
  [/\b(can|may|might|could)\b(?= [a-z]+)/i, "will always"],
  [/\btend to\b/i, "always"],
  [/\b(about|approximately|around|roughly|nearly|almost)\b(?= \d)/i, "exactly"],
];

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth"];
const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
const NEGATION = /\b(not|no|never|neither|nor|without|n't|cannot)\b/i;
const CAUSAL = /\b(because|caus|leads? to|results? in|so that|therefore|thus|due to|when|which)\b/i;

/* ---------- Helpers ---------- */

const matchCase = (source: string, replacement: string) =>
  source[0] === source[0].toUpperCase() && source[0] !== source[0].toLowerCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;

/** Fix "a apple" / "an banana" after a word swap. */
function fixArticles(s: string): string {
  return s.replace(/\b(a|an|A|An) ([A-Za-z]+)/g, (m, art: string, word: string) => {
    const vowel = /^[aeiou]/i.test(word) && !/^(uni|eu|one|use)/i.test(word);
    const want = vowel ? "an" : "a";
    if (art.toLowerCase() === want) return m;
    return `${art[0] === "A" ? want[0].toUpperCase() + want.slice(1) : want} ${word}`;
  });
}

function replaceFirst(sentence: string, from: string, to: string): string | null {
  const re = new RegExp(`\\b${escapeRegExp(from)}\\b`, "i");
  const m = sentence.match(re);
  if (!m || m.index === undefined) return null;
  return fixArticles(sentence.slice(0, m.index) + matchCase(m[0], to) + sentence.slice(m.index + m[0].length));
}

const has = (s: string, w: string) => new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(s);

/* ---------- Rules ---------- */

function directionRule(s: Sentence): Candidate[] {
  const out: Candidate[] = [];
  for (const [list, type] of [
    [DIRECTION, CAUSAL.test(s.text) ? "reversed_causation" : "wrong_mechanism"],
    [SEQUENCE, "wrong_sequence"],
  ] as const) {
    for (const [a, b] of list) {
      for (const [from, to] of [[a, b], [b, a]] as const) {
        if (!has(s.text, from) || has(s.text, to)) continue; // both present: swapping one is unsafe
        if (from === "first" && /\bat first\b/i.test(s.text)) continue;
        const sabotaged = replaceFirst(s.text, from, to);
        if (!sabotaged || sabotaged === s.text) continue;
        out.push({
          sentenceId: s.id,
          originalSentence: s.text,
          sabotagedSentence: sabotaged,
          errorType: type,
          explanation: `It should say “${from}”, not “${to}”. Flipping it reverses what actually happens.`,
          whyTempting: "Every technical word is still in place and the sentence reads smoothly. Only the direction changed, which is easy to skim past.",
          misconceptionLabel: `Mixes up “${from}” and “${to}”`,
          subtlety: type === "wrong_sequence" ? 0.55 : CAUSAL.test(s.text) ? 0.5 : 0.35,
          rule: "direction",
        });
        break;
      }
    }
  }
  return out;
}

function shiftNumber(value: number, raw: string, difficulty: Difficulty): number {
  const isYear = /^(1[0-9]{3}|20[0-9]{2})$/.test(raw);
  if (isYear) return value + (difficulty === "obvious" ? 25 : [-3, -2, 2, 3, 4][value % 5]);
  if (raw.endsWith("%")) {
    if (difficulty === "obvious") return value > 50 ? Math.round(value / 3) : Math.min(95, value * 3);
    return value >= 50 ? Math.max(5, 100 - value) : Math.min(95, value + 20);
  }
  if (Number.isInteger(value) && value <= 12) return difficulty === "obvious" ? value * 3 : value === 1 ? 2 : value + (value % 2 ? 1 : -1);
  if (difficulty === "obvious") return value * 10;
  return Math.round(value * (value % 2 ? 2 : 0.5) * 100) / 100;
}

function numberRule(s: Sentence, difficulty: Difficulty): Candidate[] {
  const out: Candidate[] = [];
  // Digits: years, percentages, plain quantities. Skip things like "3-phosphate" and ordinals in names.
  const num = s.text.match(/(?<![\w.-])(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(%?)(?![\w-])/);
  if (num && num.index !== undefined) {
    const raw = num[1] + num[2];
    const value = Number(num[1].replace(/,/g, ""));
    // "28 July" or "July 28": shift the day within the month rather than scaling it.
    const after = s.text.slice(num.index + num[0].length, num.index + num[0].length + 12);
    const before = s.text.slice(Math.max(0, num.index - 12), num.index);
    const isDay = new RegExp(`^\\s*(${MONTHS})\\b`).test(after) || new RegExp(`\\b(${MONTHS})\\s*$`).test(before);
    const next = isDay && value <= 31 ? ((value + 6) % 28) + 1 : shiftNumber(value, raw, difficulty);
    if (Number.isFinite(next) && next !== value) {
      const shown = (num[1].includes(",") ? next.toLocaleString("en-GB") : String(next)) + num[2];
      const sabotaged = s.text.slice(0, num.index) + shown + s.text.slice(num.index + num[0].length);
      out.push({
        sentenceId: s.id,
        originalSentence: s.text,
        sabotagedSentence: sabotaged,
        errorType: "wrong_quantity_or_value",
        explanation: `The correct figure is ${raw}, not ${shown}.`,
        whyTempting: "The new figure is in a believable range, and exact numbers are the details people half-remember.",
        misconceptionLabel: `Misremembers ${raw} as ${shown}`,
        subtlety: difficulty === "obvious" ? 0.3 : 0.6,
        rule: "number",
      });
    }
  }
  // Number words: "two stages" → "three stages".
  for (const list of [NUMBER_WORDS, ORDINALS]) {
    // Skip "one" ("one of the", "one cell thick" break when changed) and "first" (handled as sequence).
    const idx = list.findIndex((w, i) => i >= 2 && has(s.text, w) && !new RegExp(`\\b${w} of\\b`, "i").test(s.text) && !(list === ORDINALS && w === "first"));
    if (idx < 2) continue;
    const to = list[idx + 1] ?? list[idx - 1];
    const sabotaged = replaceFirst(s.text, list[idx], to);
    if (!sabotaged) continue;
    out.push({
      sentenceId: s.id,
      originalSentence: s.text,
      sabotagedSentence: sabotaged,
      errorType: list === ORDINALS ? "wrong_sequence" : "wrong_quantity_or_value",
      explanation: `It should be “${list[idx]}”, not “${to}”.`,
      whyTempting: "Off-by-one counts look almost right, especially when the items aren't listed out.",
      misconceptionLabel: `Says ${to} instead of ${list[idx]}`,
      subtlety: 0.5,
      rule: "number-word",
    });
  }
  return out;
}

function generaliseRule(s: Sentence): Candidate[] {
  for (const [re, to] of GENERALISE) {
    const m = s.text.match(re);
    if (!m || m.index === undefined) continue;
    if (to === "will always" && NEGATION.test(s.text)) continue;
    const sabotaged = fixArticles(s.text.slice(0, m.index) + matchCase(m[0], to) + s.text.slice(m.index + m[0].length));
    return [
      {
        sentenceId: s.id,
        originalSentence: s.text,
        sabotagedSentence: sabotaged,
        errorType: "false_generalisation",
        explanation: `The original says “${m[0]}”. Making it “${to}” turns a true tendency into a rule that has exceptions.`,
        whyTempting: "Absolute statements sound confident and textbook-like, and the exceptions are the part people forget.",
        misconceptionLabel: `Treats “${m[0]}” as “${to}”`,
        subtlety: 0.75,
        rule: "generalise",
      },
    ];
  }
  return [];
}

function exceptionRule(s: Sentence): Candidate[] {
  const m = s.text.match(/,?\s*\b(except|unless|apart from|other than|with the exception of)\b[^,.;]*/i);
  if (!m || m.index === undefined) return [];
  const sabotaged = (s.text.slice(0, m.index) + s.text.slice(m.index + m[0].length)).replace(/\s+([,.;])/g, "$1");
  if (sabotaged.split(/\s+/).length < 5) return [];
  return [
    {
      sentenceId: s.id,
      originalSentence: s.text,
      sabotagedSentence: sabotaged,
      errorType: "missing_exception",
      explanation: `The original includes an exception (“${m[0].replace(/^,?\s*/, "")}”) that this version silently drops.`,
      whyTempting: "General rules are easier to remember than their exceptions, so the shorter version sounds complete.",
      misconceptionLabel: "Forgets the exception to the rule",
      subtlety: 0.8,
      rule: "exception",
    },
  ];
}

/** Terms worth swapping: proper nouns and technical words that appear elsewhere in the passage. */
function termsIn(text: string): string[] {
  const proper = text.slice(1).match(/\b[A-Z][a-z]+(?:[ -][A-Z][a-z]+)*\b/g) ?? [];
  const technical = text.match(/\b[a-z]{7,}\b/g) ?? [];
  return [...new Set([...proper, ...technical])];
}

const STOP = new Set(["because", "between", "through", "without", "another", "different", "important", "including", "although", "however", "therefore", "example", "process", "together", "usually", "generally", "produce", "produces", "contain", "contains", "against", "therefore", "several", "possible"]);
const DIRECTION_WORDS = new Set([...DIRECTION, ...SEQUENCE].flat());
const shape = (t: string) =>
  /^[A-Z]/.test(t) ? `proper:${t.split(/[ -]/).length}:${/(ian|ish|ese|an|ic)$/.test(t) ? "adj" : "noun"}` : t.slice(-3);
/** Lowercase verbs and participles swap badly ("pumps started blood"); keep to likely nouns. */
const looksLikeNoun = (t: string) => /^[A-Z]/.test(t) || !/(ed|ing|es|ly|ise|ize|ate)$/.test(t);

function swapRule(s: Sentence, all: Sentence[]): Candidate[] {
  const elsewhere = all.filter((o) => o.id !== s.id).flatMap((o) => termsIn(o.text));
  const out: Candidate[] = [];
  for (const term of termsIn(s.text)) {
    if (STOP.has(term.toLowerCase()) || DIRECTION_WORDS.has(term.toLowerCase()) || !looksLikeNoun(term)) continue;
    // A partner of the same kind (both names, or both words with the same ending) not already here.
    const partner = elsewhere.find(
      (o) =>
        o !== term && !STOP.has(o.toLowerCase()) && looksLikeNoun(o) && shape(o) === shape(term) && !has(s.text, o) && !o.includes(term) && !term.includes(o),
    );
    if (!partner) continue;
    const sabotaged = replaceFirst(s.text, term, partner);
    if (!sabotaged) continue;
    const proper = /^[A-Z]/.test(term);
    out.push({
      sentenceId: s.id,
      originalSentence: s.text,
      sabotagedSentence: sabotaged,
      errorType: proper ? "wrong_attribution" : "swapped_terms",
      explanation: `It should be “${term}”, not “${partner}”. Both belong to this topic, but here they aren't interchangeable.`,
      whyTempting: `“${partner}” appears elsewhere in the same topic, so the sentence still looks familiar.`,
      misconceptionLabel: `Confuses ${term} with ${partner}`,
      subtlety: proper ? 0.6 : 0.7,
      rule: "swap",
    });
    if (out.length >= 2) break;
  }
  return out;
}

/** Every rule-based rewrite available for a sentence. */
export function candidatesFor(s: Sentence, all: Sentence[], difficulty: Difficulty): Candidate[] {
  return [...directionRule(s), ...numberRule(s, difficulty), ...generaliseRule(s), ...exceptionRule(s), ...swapRule(s, all)];
}

const PREFERRED: Record<Difficulty, number> = { obvious: 0.35, subtle: 0.55, devious: 0.75 };
// Rules whose output is most reliably false. Swaps can occasionally land on a true sentence.
const RELIABILITY: Record<string, number> = { direction: 1, number: 1, "number-word": 0.9, generalise: 0.8, exception: 0.7, swap: 0.6 };

/**
 * Choose `count` errors in different sentences, spreading the error types and preferring
 * rules whose subtlety matches the difficulty (and any `prefer`red types). Deterministic for a given seed.
 */
export function chooseErrors(sentences: Sentence[], count: number, difficulty: Difficulty, seed = 1, avoid: Set<string> = new Set(), prefer: ErrorType[] = []): Candidate[] {
  // mulberry32: small seeded PRNG so a round can be reproduced in tests.
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pool = sentences
    .filter((s) => !avoid.has(s.id))
    .flatMap((s) => candidatesFor(s, sentences, difficulty))
    // Types the player keeps falling for (a targeted round) jump the queue.
    .map((c) => ({ c, score: RELIABILITY[c.rule] * 2 - Math.abs(c.subtlety - PREFERRED[difficulty]) + rand() * 0.6 + (prefer.includes(c.errorType) ? 3 : 0) }))
    .sort((a, b) => b.score - a.score);

  const chosen: Candidate[] = [];
  const usedTypes = new Map<ErrorType, number>();
  const usedSentences = new Set<string>();
  for (const pass of [0, 1]) {
    for (const { c } of pool) {
      if (chosen.length >= count) break;
      if (usedSentences.has(c.sentenceId)) continue;
      // First pass: one of each type; second pass: fill up.
      if (pass === 0 && usedTypes.has(c.errorType)) continue;
      chosen.push(c);
      usedSentences.add(c.sentenceId);
      usedTypes.set(c.errorType, (usedTypes.get(c.errorType) ?? 0) + 1);
    }
  }
  return chosen;
}
