// Single place for model names, effort levels and the numbers the game runs on.

export const MODELS = {
  /** Writes the explanation, plants the errors and fact-checks the result. */
  generate: "claude-sonnet-5-5",
  /** Grades corrections and explains false flags; latency matters more here. */
  grade: "claude-haiku-5-5",
} as const;

/** Thinking depth per pipeline step (Claude's `output_config.effort`). */
export const EFFORT = {
  write: "medium",
  plant: "medium",
  verify: "medium",
  grade: "low",
  /** Wrong Answer Autopsy: diagnosing wrong answers, and writing check questions. */
  autopsy: "medium",
  questions: "medium",
} as const;

/**
 * Server-side refusal fallback. Supported for the Sonnet generation calls on the
 * Claude API only; set SABOTEUR_FALLBACKS=0 to turn it off (e.g. on other platforms).
 */
export const USE_FALLBACKS = process.env.SABOTEUR_FALLBACKS !== "0";

export const DIFFICULTIES = ["obvious", "subtle", "devious"] as const;

export const DIFFICULTY_MULTIPLIER: Record<(typeof DIFFICULTIES)[number], number> = {
  obvious: 1,
  subtle: 1.5,
  devious: 2,
};

export const POINTS = {
  correct: 100,
  partially_correct: 60,
  incorrect: 30,
  falseFlag: -25,
} as const;

/** How many errors get planted; the exact number is hidden from the student. */
export const ERROR_RANGE = { min: 2, max: 4 } as const;

/** Total regenerate attempts the verifier may trigger before we fall back to dropping errors. */
export const MAX_VERIFY_RETRIES = 2;

/** Rounds are held in server memory; anything older is discarded. */
export const ROUND_TTL_MS = 2 * 60 * 60 * 1000;

export const LEVELS = [
  "GCSE / middle school",
  "A-level / high school",
  "University intro",
  "University advanced",
] as const;
