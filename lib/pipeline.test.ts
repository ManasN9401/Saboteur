import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractJSON } from "./json";
import { cleanErrors, generateRound, sabotage } from "./pipeline";
import { PlantOutputSchema, VerifyOutputSchema, type PlantedError } from "./schemas";

const sentences = [
  { id: "s1", text: "A is true." },
  { id: "s2", text: "B is true." },
];
const planted = (sentenceId: string, sabotagedSentence: string): PlantedError => ({
  sentenceId,
  originalSentence: "whatever the model said",
  sabotagedSentence,
  errorType: "swapped_terms",
  explanation: "e",
  whyTempting: "t",
  misconceptionLabel: "m",
});

describe("cleanErrors", () => {
  it("drops unknown ids, repeats and unchanged rewrites, and restores the true original", () => {
    const out = cleanErrors(
      [planted("s9", "x"), planted("s1", "A is false."), planted("s1", "A is wrong."), planted("s2", "B is true.")],
      sentences,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ sentenceId: "s1", originalSentence: "A is true.", sabotagedSentence: "A is false." });
  });

  it("skips sentences already holding an error", () => {
    expect(cleanErrors([planted("s1", "A is false.")], sentences, new Set(["s1"]))).toEqual([]);
  });
});

describe("sabotage", () => {
  it("replaces only the planted sentences", () => {
    expect(sabotage(sentences, [planted("s2", "B is false.")])).toEqual([
      { id: "s1", text: "A is true." },
      { id: "s2", text: "B is false." },
    ]);
  });
});

describe("LLM output parsing", () => {
  it("extracts JSON from fenced or chatty replies", () => {
    expect(extractJSON('Here you go:\n```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extractJSON('Sure! {"a": {"b": 2}} Hope that helps.')).toEqual({ a: { b: 2 } });
    expect(() => extractJSON("no json here")).toThrow();
  });

  it("rejects malformed planter output", () => {
    expect(PlantOutputSchema.safeParse({ errors: [{ sentenceId: "s1" }] }).success).toBe(false);
    expect(PlantOutputSchema.safeParse({ errors: [{ ...planted("s1", "x"), errorType: "made_up_type" }] }).success).toBe(false);
  });

  it("rejects verifier output with the wrong shape", () => {
    expect(VerifyOutputSchema.safeParse({ plantedChecks: [], unintendedIssues: "none", tooObvious: [] }).success).toBe(false);
  });
});

describe("generateRound (mock LLM)", () => {
  beforeEach(() => {
    process.env.SABOTEUR_MOCK = "1";
  });
  afterEach(() => {
    delete process.env.SABOTEUR_MOCK;
  });

  it.each(["Photosynthesis", "The water cycle", "Causes of WW1"])("builds a clean round for %s", async (topic) => {
    const steps: string[] = [];
    const { round, errors } = await generateRound({ topic, level: "A-level / high school", difficulty: "subtle" }, (step) => steps.push(step));
    expect(steps).toEqual(["write", "plant", "verify"]);
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors.length).toBeLessThanOrEqual(4);
    for (const e of errors) {
      const shown = round.sentences.find((s) => s.id === e.sentenceId);
      expect(shown?.text).toBe(e.sabotagedSentence);
      expect(e.originalSentence).not.toBe(e.sabotagedSentence);
    }
    // The round sent to the browser carries no answers.
    expect(JSON.stringify(round)).not.toContain("whyTempting");
    expect(round.topicId).toMatch(/^[a-z0-9-]+$/);
  });
});
