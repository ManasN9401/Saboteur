import { describe, expect, it } from "vitest";
import { HISTORY_LIMIT, historyReducer, initHistory, type FlagHistory } from "./flagsHistory";
import type { Flag } from "./schemas";

const f = (id: string, correction = "", confidence = 0.7): Flag => ({ sentenceId: id, correction, confidence });
const run = (h: FlagHistory, ...actions: Parameters<typeof historyReducer>[1][]) => actions.reduce(historyReducer, h);

describe("flag history", () => {
  it("undoes and redoes adding a flag", () => {
    let h = run(initHistory([]), { type: "set", flags: [f("s1")] });
    expect(h.present).toEqual([f("s1")]);
    h = historyReducer(h, { type: "undo" });
    expect(h.present).toEqual([]);
    h = historyReducer(h, { type: "redo" });
    expect(h.present).toEqual([f("s1")]);
  });

  it("does nothing when there is nothing to undo or redo", () => {
    const h = initHistory([f("s1")]);
    expect(historyReducer(h, { type: "undo" })).toBe(h);
    expect(historyReducer(h, { type: "redo" })).toBe(h);
  });

  it("merges a run of typing into one step", () => {
    let h = run(initHistory([]), { type: "set", flags: [f("s1")] });
    h = run(h, { type: "set", flags: [f("s1", "a")], key: "fix:s1" }, { type: "set", flags: [f("s1", "ab")], key: "fix:s1" }, { type: "set", flags: [f("s1", "abc")], key: "fix:s1" });
    expect(h.past).toHaveLength(2);
    h = historyReducer(h, { type: "undo" });
    expect(h.present).toEqual([f("s1")]);
  });

  it("starts a new step when a different kind of change comes between", () => {
    let h = run(
      initHistory([f("s1")]),
      { type: "set", flags: [f("s1", "a")], key: "fix:s1" },
      { type: "set", flags: [f("s1", "a", 0.9)], key: "conf:s1" },
      { type: "set", flags: [f("s1", "ab", 0.9)], key: "fix:s1" },
    );
    expect(h.past).toHaveLength(3);
    h = historyReducer(h, { type: "undo" });
    expect(h.present).toEqual([f("s1", "a", 0.9)]);
  });

  it("a new change clears the redo stack", () => {
    let h = run(initHistory([]), { type: "set", flags: [f("s1")] }, { type: "undo" });
    expect(h.future).toHaveLength(1);
    h = historyReducer(h, { type: "set", flags: [f("s2")] });
    expect(h.future).toEqual([]);
  });

  it("keeps at most 30 steps", () => {
    let h = initHistory([]);
    for (let i = 0; i < 40; i++) h = historyReducer(h, { type: "set", flags: [f(`s${i}`)] });
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    for (let i = 0; i < 50; i++) h = historyReducer(h, { type: "undo" });
    expect(h.present).toEqual([f("s9")]);
  });

  it("undo after a merged run goes back past the whole run, and redo restores it", () => {
    let h = run(initHistory([]), { type: "set", flags: [f("s1", "x")], key: "fix:s1" }, { type: "set", flags: [f("s1", "xy")], key: "fix:s1" });
    h = historyReducer(h, { type: "undo" });
    expect(h.present).toEqual([]);
    h = historyReducer(h, { type: "redo" });
    expect(h.present).toEqual([f("s1", "xy")]);
  });

  it("reset drops all history", () => {
    const h = run(initHistory([]), { type: "set", flags: [f("s1")] }, { type: "reset", flags: [f("s2")] });
    expect(h).toEqual(initHistory([f("s2")]));
  });
});
