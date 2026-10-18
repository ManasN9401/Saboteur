import { afterEach, describe, expect, it, vi } from "vitest";
import { generateOffline } from "./generate";
import { gradeCorrectionOffline } from "./grade";
import { findLibraryEntry, LIBRARY } from "./library";
import { candidatesFor, chooseErrors } from "./sabotage";
import { notesToSentences, selectSentences, splitSentences, stem } from "./sentences";
import { cleanWikiText, findSource, parseExtract, parseSearch } from "./source";

const S = (text: string, id = "s1") => ({ id, text });

describe("sentences", () => {
  it("splits prose without breaking abbreviations, initials or decimals", () => {
    expect(splitSentences("Gravity is about 9.8 N/kg on Earth. It was described by Sir I. Newton, e.g. in the Principia. Done!")).toEqual([
      "Gravity is about 9.8 N/kg on Earth.",
      "It was described by Sir I. Newton, e.g. in the Principia.",
      "Done!",
    ]);
  });

  it("turns bullet notes into sentences", () => {
    expect(notesToSentences("- Mitochondria release energy\n* Ribosomes make proteins.\n1. Nucleus holds DNA")).toEqual([
      "Mitochondria release energy.",
      "Ribosomes make proteins.",
      "Nucleus holds DNA.",
    ]);
  });

  it("keeps sentence order and drops fragments when selecting", () => {
    const picked = selectSentences(["Too short.", "This sentence is long enough to be judged on its own merits.", "What about questions like this one here?"]);
    expect(picked).toEqual(["This sentence is long enough to be judged on its own merits."]);
  });

  it("stems related word forms together", () => {
    expect(stem("cools")).toBe(stem("cooling"));
    expect(stem("cooled")).toBe("cool");
  });
});

describe("sabotage rules", () => {
  const all = (text: string, others: string[] = []) => candidatesFor(S(text), [S(text), ...others.map((t, i) => S(t, `o${i}`))], "subtle");

  it("reverses directions", () => {
    const flips = all("As air rises it expands, which causes its temperature to decrease.").filter((x) => x.rule === "direction");
    expect(flips.map((c) => c.sabotagedSentence)).toEqual(
      expect.arrayContaining(["As air rises it expands, which causes its temperature to increase.", "As air falls it expands, which causes its temperature to decrease."]),
    );
    expect(flips.every((c) => c.errorType === "reversed_causation")).toBe(true);
  });

  it("does not flip a word whose opposite is already in the sentence", () => {
    expect(all("Prices can rise or fall depending on demand.").filter((x) => x.rule === "direction")).toEqual([]);
  });

  it("shifts years, percentages and counts", () => {
    expect(all("The war ended in 1918.").find((x) => x.rule === "number")?.sabotagedSentence).not.toContain("1918");
    expect(all("About 71% of the surface is covered by water.").find((x) => x.rule === "number")?.sabotagedSentence).toMatch(/\d+% of the surface/);
    expect(all("The heart has four chambers in total.").find((x) => x.rule === "number-word")?.sabotagedSentence).toBe("The heart has five chambers in total.");
  });

  it("turns tendencies into absolutes", () => {
    const c = all("Volcanoes usually form near plate boundaries.").find((x) => x.rule === "generalise");
    expect(c?.sabotagedSentence).toBe("Volcanoes always form near plate boundaries.");
    expect(c?.errorType).toBe("false_generalisation");
  });

  it("drops exceptions", () => {
    const c = all("All mammals give birth to live young, except monotremes such as the platypus.").find((x) => x.rule === "exception");
    expect(c?.sabotagedSentence).toBe("All mammals give birth to live young.");
  });

  it("swaps a term for another one from the same passage", () => {
    const c = all("The Treaty of Versailles was signed in France.", ["Germany lost territory to Poland."]).find((x) => x.rule === "swap");
    expect(c?.errorType).toBe("wrong_attribution");
    expect(c?.sabotagedSentence).not.toBe("The Treaty of Versailles was signed in France.");
  });

  it("fixes a/an after a swap", () => {
    const c = all("It is a higher energy state.").find((x) => x.rule === "direction");
    expect(c?.sabotagedSentence).toBe("It is a lower energy state.");
  });

  it("can plant at least two rule-based errors in every built-in passage, at every difficulty", () => {
    for (const entry of LIBRARY) {
      const sentences = entry.sentences.map((t, i) => S(t, `s${i + 1}`));
      for (const d of ["obvious", "subtle", "devious"] as const) {
        const chosen = chooseErrors(sentences, 4, d, 7);
        expect(chosen.length, `${entry.id} ${d}`).toBeGreaterThanOrEqual(2);
        expect(new Set(chosen.map((c) => c.sentenceId)).size).toBe(chosen.length);
        for (const c of chosen) expect(c.sabotagedSentence).not.toBe(c.originalSentence);
      }
    }
  });
});

describe("offline grading", () => {
  const original = "As the water vapour rises, it cools and condenses into droplets.";
  const sabotaged = "As the water vapour rises, it warms and condenses into droplets.";

  it("marks a correction that names the right word as correct", () => {
    expect(gradeCorrectionOffline(original, sabotaged, "it should cool, not warm").grade).toBe("correct");
    expect(gradeCorrectionOffline(original, sabotaged, "Cooling").grade).toBe("correct");
  });

  it("gives partial credit for naming the problem without the fix", () => {
    expect(gradeCorrectionOffline(original, sabotaged, "it doesn't warm up").grade).toBe("partially_correct");
  });

  it("marks an unrelated reason as incorrect, and a blank as incorrect", () => {
    expect(gradeCorrectionOffline(original, sabotaged, "the droplets are the wrong shape").grade).toBe("incorrect");
    expect(gradeCorrectionOffline(original, sabotaged, "  ").grade).toBe("incorrect");
  });

  it("matches numbers", () => {
    expect(gradeCorrectionOffline("It ended in 1918.", "It ended in 1921.", "1918").grade).toBe("correct");
    expect(gradeCorrectionOffline("It ended in 1918.", "It ended in 1921.", "not 1921").grade).toBe("partially_correct");
  });
});

describe("sources", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("matches built-in topics", () => {
    expect(findLibraryEntry("Photosynthesis: light-dependent reactions")?.id).toBe("photosynthesis");
    expect(findLibraryEntry("Newton's second law")?.id).toBe("newtons-laws");
    expect(findLibraryEntry("The Tudor dynasty")).toBeNull();
  });

  it("parses Wikipedia responses", () => {
    expect(parseSearch({ query: { search: [{ title: "Photosynthesis" }] } })).toBe("Photosynthesis");
    expect(parseSearch({ query: { search: [] } })).toBeNull();
    expect(parseExtract({ query: { pages: { "1": { title: "X", extract: "Hello." } } } })).toEqual({ title: "X", text: "Hello." });
    expect(parseExtract({ query: { pages: { "-1": { title: "X", missing: "" } } } })).toBeNull();
    expect(cleanWikiText("Photosynthesis (/ˌfoʊtəˈsɪnθəsɪs/ FOH-tə-SINTH) is a process.\n== History ==\nIt was studied.")).toBe(
      "Photosynthesis is a process. It was studied.",
    );
  });

  it("asks for notes when there is no built-in topic and Wikipedia is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(findSource("The Tudor dynasty")).rejects.toThrow(/Paste your notes/);
  });

  it("rejects notes that are too thin", async () => {
    await expect(findSource("anything", "Cells are small.")).rejects.toThrow(/usable sentences/);
  });
});

describe("generateOffline", () => {
  it("builds a library round with hand-written errors", async () => {
    const steps: string[] = [];
    const { round, errors } = await generateOffline({ topic: "The water cycle", level: "GCSE", difficulty: "subtle" }, (s) => steps.push(s));
    expect(steps).toEqual(["write", "plant", "verify"]);
    expect(round.engine).toBe("offline");
    expect(round.source?.label).toMatch(/Built-in/);
    expect(errors.length).toBeGreaterThanOrEqual(2);
    for (const e of errors) expect(round.sentences.find((s) => s.id === e.sentenceId)?.text).toBe(e.sabotagedSentence);
  });

  it("builds a round from the student's own notes with rule-based errors", async () => {
    const notes = [
      "The French Revolution began in 1789.",
      "Bread prices rose sharply in the years before the revolution.",
      "The Estates-General met at Versailles in May 1789.",
      "The Third Estate declared itself the National Assembly.",
      "Crowds stormed the Bastille on 14 July 1789.",
      "The Declaration of the Rights of Man was adopted in August 1789.",
      "King Louis XVI was executed in January 1793.",
      "Robespierre usually justified the Terror as a defence of the Republic.",
    ].join(" ");
    const { round, errors } = await generateOffline({ topic: "French Revolution", level: "GCSE", difficulty: "subtle", notes }, () => {});
    expect(round.source?.label).toBe("Your notes");
    expect(errors.length).toBeGreaterThanOrEqual(2);
    for (const e of errors) expect(notes).toContain(e.originalSentence);
  });
});

describe("targeted rounds (V06-05)", () => {
  const quiet = () => {};
  const entry = LIBRARY[0];
  const [first] = Object.values(entry.errors);

  it("plants the targeted misconception from the library first", async () => {
    for (let seed = 1; seed <= 10; seed++) {
      const target = { key: "t-exact", label: first.label, errorType: first.type };
      const { errors } = await generateOffline({ topic: entry.title, level: "A-level", difficulty: "subtle", targets: [target] }, quiet, { entry, seed });
      expect(errors.some((e) => e.misconceptionLabel === first.label && e.targetsMisconceptionId === "t-exact")).toBe(true);
    }
  });

  it("falls back to a rule that makes the same kind of error", async () => {
    const sentences = entry.sentences.map((text, i) => ({ id: `s${i + 1}`, text }));
    const curatedTypes = new Set(Object.values(entry.errors).map((e) => e.type));
    const ruleOnly = [...new Set(sentences.flatMap((s) => candidatesFor(s, sentences, "subtle")).map((c) => c.errorType))].find((t) => !curatedTypes.has(t));
    if (!ruleOnly) return; // nothing to test on this entry
    const { errors } = await generateOffline({ topic: entry.title, level: "A-level", difficulty: "subtle", targets: [{ key: "t-type", label: "Some other belief", errorType: ruleOnly }] }, quiet, { entry, seed: 3 });
    expect(errors.find((e) => e.targetsMisconceptionId === "t-type")?.errorType).toBe(ruleOnly);
  });

  it("chooseErrors puts preferred types first", () => {
    const sentences = entry.sentences.map((text, i) => ({ id: `s${i + 1}`, text }));
    const types = [...new Set(sentences.flatMap((s) => candidatesFor(s, sentences, "subtle")).map((c) => c.errorType))];
    for (const t of types) expect(chooseErrors(sentences, 1, "subtle", 7, new Set(), [t])[0].errorType).toBe(t);
  });

  it("leaves untargeted rounds alone", async () => {
    const { errors } = await generateOffline({ topic: entry.title, level: "A-level", difficulty: "subtle" }, quiet, { entry, seed: 5 });
    expect(errors.every((e) => !e.targetsMisconceptionId)).toBe(true);
  });
});
