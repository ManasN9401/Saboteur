import { describe, expect, it } from "vitest";
import { wordDiff } from "./diff";

describe("wordDiff", () => {
  it("shows a single-word swap", () => {
    expect(wordDiff("As it rises, it warms and condenses.", "As it rises, it cools and condenses.")).toEqual([
      { kind: "same", text: "As it rises, it " },
      { kind: "removed", text: "warms" },
      { kind: "added", text: "cools" },
      { kind: "same", text: " and condenses." },
    ]);
  });

  it("folds a short shared word into one swap", () => {
    expect(wordDiff("stored in rivers and lakes.", "stored in ice caps and glaciers.")).toEqual([
      { kind: "same", text: "stored in " },
      { kind: "removed", text: "rivers and lakes." },
      { kind: "added", text: "ice caps and glaciers." },
    ]);
  });

  it("returns one unchanged part for identical text", () => {
    expect(wordDiff("Same text.", "Same text.")).toEqual([{ kind: "same", text: "Same text." }]);
  });

  it("rebuilds both sentences from the parts", () => {
    const a = "The Triple Alliance linked Germany, Austria-Hungary and Russia.";
    const b = "The Triple Alliance linked Germany, Austria-Hungary and Italy.";
    const parts = wordDiff(a, b);
    expect(parts.filter((p) => p.kind !== "added").map((p) => p.text).join("")).toBe(a);
    expect(parts.filter((p) => p.kind !== "removed").map((p) => p.text).join("")).toBe(b);
  });
});
