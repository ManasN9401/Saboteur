import { describe, expect, it } from "vitest";
import { parseIntake } from "./parse";

const triples = (text: string) => parseIntake(text).items.map((i) => [i.question, i.answer, i.correct]);

describe("intake parser: ten ways students paste marked work", () => {
  it("1. labelled blocks", () => {
    const text = `Q: What is the unit of resistance?
My answer: Volts
Correct answer: Ohms

Q: Resistors of 2 Ω and 2 Ω in parallel give?
My answer: 4 Ω
Correct answer: 1 Ω`;
    expect(triples(text)).toEqual([
      ["What is the unit of resistance?", "Volts", "Ohms"],
      ["Resistors of 2 Ω and 2 Ω in parallel give?", "4 Ω", "1 Ω"],
    ]);
    expect(parseIntake(text).format).toBe("labelled");
  });

  it("2. numbered questions with indented answers", () => {
    const text = `1. Solve 3x + 2 = 11
   My answer: x = 4
   Correct: x = 3
2. Expand (x + 2)²
   I wrote: x² + 4
   Should be: x² + 4x + 4`;
    expect(triples(text)).toEqual([
      ["Solve 3x + 2 = 11", "x = 4", "x = 3"],
      ["Expand (x + 2)²", "x² + 4", "x² + 4x + 4"],
    ]);
  });

  it("3. a table copied from a document (tabs), with a header", () => {
    const text = "Question\tMy answer\tCorrect answer\nWhere does photosynthesis happen?\tMitochondria\tChloroplasts\nWhat gas is released?\tCarbon dioxide\tOxygen";
    expect(triples(text)).toEqual([
      ["Where does photosynthesis happen?", "Mitochondria", "Chloroplasts"],
      ["What gas is released?", "Carbon dioxide", "Oxygen"],
    ]);
    expect(parseIntake(text).format).toBe("table");
  });

  it("4. a markdown table with the columns in another order", () => {
    const text = `| Correct | Question | What I put |
|---|---|---|
| 1914 | When did the First World War start? | 1918 |
| Archduke Franz Ferdinand | Whose assassination triggered it? | Kaiser Wilhelm |`;
    expect(triples(text)).toEqual([
      ["When did the First World War start?", "1918", "1914"],
      ["Whose assassination triggered it?", "Kaiser Wilhelm", "Archduke Franz Ferdinand"],
    ]);
  });

  it("5. a spreadsheet export (CSV with quotes and commas)", () => {
    const text = `question,my answer,correct answer
"If price rises, what happens to quantity demanded?",It rises,It falls
"What shifts the supply curve, a price change or a cost change?","A price change","A cost change"`;
    expect(triples(text)).toEqual([
      ["If price rises, what happens to quantity demanded?", "It rises", "It falls"],
      ["What shifts the supply curve, a price change or a cost change?", "A price change", "A cost change"],
    ]);
  });

  it("6. one line per answer with separators", () => {
    expect(triples("Atomic number of carbon | 12 | 6\nCharge on an electron | positive | negative")).toEqual([
      ["Atomic number of carbon", "12", "6"],
      ["Charge on an electron", "positive", "negative"],
    ]);
    expect(triples("Speed of light — 3×10^5 m/s — 3×10^8 m/s")).toEqual([["Speed of light", "3×10^5 m/s", "3×10^8 m/s"]]);
  });

  it("7. everything inline on one line each", () => {
    const text = `- Value of g on Earth? My answer: 10 m/s. Correct: 9.8 m/s²
- Unit of power? My answer: Joules. Correct answer: Watts`;
    expect(triples(text)).toEqual([
      ["Value of g on Earth?", "10 m/s", "9.8 m/s²"],
      ["Unit of power?", "Joules", "Watts"],
    ]);
  });

  it("8. ticks, crosses and the correction in brackets", () => {
    const text = `Q1) Differentiate x³
A: 3x ✗ (should be 3x²)
Q2) Differentiate sin x
A: -cos x ✗ (correct: cos x)`;
    expect(triples(text)).toEqual([
      ["Differentiate x³", "3x", "3x²"],
      ["Differentiate sin x", "-cos x", "cos x"],
    ]);
  });

  it("9. bare three-line blocks, Windows line endings and non-breaking spaces", () => {
    const text = "Function of mitochondria\r\nMakes proteins\r\nReleases energy (respiration)\r\n\r\nWhat carries oxygen in blood?\r\nPlasma\r\nHaemoglobin in red blood cells";
    expect(triples(text)).toEqual([
      ["Function of mitochondria", "Makes proteins", "Releases energy (respiration)"],
      ["What carries oxygen in blood?", "Plasma", "Haemoglobin in red blood cells"],
    ]);
    expect(parseIntake(text).format).toBe("blocks");
  });

  it("10. multi-line questions, answers that already match, and a missing correction", () => {
    const text = `Question 1: A ball is thrown upwards.
What is its acceleration at the top?
My answer: zero
Correct answer: 9.8 m/s² downwards

Question 2: What is 7 × 8?
My answer: 56
Correct answer: 56

Question 3: Name the powerhouse of the cell
My answer: nucleus`;
    const r = parseIntake(text);
    expect(r.items.map((i) => [i.question, i.answer, i.correct])).toEqual([["A ball is thrown upwards. What is its acceleration at the top?", "zero", "9.8 m/s² downwards"]]);
    expect(r.matching.map((i) => i.question)).toEqual(["What is 7 × 8?"]);
    expect(r.incomplete.map((i) => i.question)).toEqual(["Name the powerhouse of the cell"]);
  });

  it("strips a verdict word only from the end", () => {
    expect(triples("Which way does current flow? | the wrong way round - wrong | positive to negative")).toEqual([["Which way does current flow?", "the wrong way round", "positive to negative"]]);
  });

  it("gives up honestly on prose", () => {
    const r = parseIntake("I got most of the test wrong and I don't know why, especially the bits on enzymes.");
    expect(r.items).toEqual([]);
  });

  it("caps the number of items", () => {
    const text = Array.from({ length: 30 }, (_, i) => `Q: q${i}\nMy answer: a${i}\nCorrect: c${i}`).join("\n\n");
    expect(parseIntake(text).items).toHaveLength(20);
  });
});
