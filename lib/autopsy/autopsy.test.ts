import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as diagnoseRoute } from "@/app/api/autopsy/diagnose/route";
import { POST as questionsRoute } from "@/app/api/autopsy/questions/route";
import { resetLimits } from "../security/limits";
import { tidy } from "./diagnose";
import { WORKSHEETS } from "./fixtures";
import { mockDiagnosis } from "./mock";
import { QuestionsOutputSchema, type AutopsyEvent, type Diagnosis } from "./schema";

const post = (body: unknown) => new Request("http://x/api", { method: "POST", body: JSON.stringify(body) });
async function events(res: Response): Promise<AutopsyEvent[]> {
  return (await res.text())
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}
const circuits = WORKSHEETS[3].items.map((i, n) => ({ id: `a${n + 1}`, question: i.question, answer: i.answer, correct: i.correct }));

describe("autopsy routes (mock model)", () => {
  beforeEach(() => {
    process.env.SABOTEUR_MOCK = "1";
    resetLimits(); // these tests are about the autopsy, not its rate limits (lib/security)
  });
  afterEach(() => {
    delete process.env.SABOTEUR_MOCK;
    delete process.env.SABOTEUR_ENGINE;
    vi.restoreAllMocks();
  });

  it("diagnoses pasted answers, one per item, with progress first", async () => {
    const ev = await events(await diagnoseRoute(post({ items: circuits, level: "GCSE" })));
    expect(ev[0]).toMatchObject({ type: "progress", step: "examine" });
    const done = ev.find((e) => e.type === "done");
    if (done?.type !== "done") throw new Error("no result");
    expect(done.result.diagnoses.map((d) => d.itemId)).toEqual(["a1", "a2", "a3", "a4"]);
    expect(done.result.diagnoses[0].label).toBe("Resistances in parallel add up like in series");
    expect(done.result.diagnoses[3].kind).toBe("careless_slip");
  });

  it("says honestly when it can't diagnose (offline)", async () => {
    process.env.SABOTEUR_ENGINE = "offline";
    const ev = await events(await diagnoseRoute(post({ items: circuits, level: "GCSE" })));
    expect(ev).toEqual([{ type: "offline", message: expect.stringContaining("log what you got wrong yourself") }]);
  });

  it("rejects an empty request", async () => {
    const res = await diagnoseRoute(post({ items: [], level: "GCSE" }));
    expect(res.status).toBe(400);
  });

  it("never logs or keeps a picture of marked work", async () => {
    const data = "SECRETPIXELS".repeat(40);
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((k) => vi.spyOn(console, k).mockImplementation(() => {}));
    const ev = await events(await diagnoseRoute(post({ image: { mediaType: "image/png", data }, level: "GCSE" })));
    const done = ev.find((e) => e.type === "done");
    expect(done?.type === "done" && done.result.items?.length).toBe(4); // what was read from the picture
    expect(JSON.stringify(ev)).not.toContain("SECRETPIXELS");
    for (const s of spies) for (const call of s.mock.calls) expect(JSON.stringify(call)).not.toContain("SECRETPIXELS");
  });

  it("writes check questions with a trap that isn't the answer", async () => {
    const res = await questionsRoute(post({ label: "Resistances in parallel add up", errorType: "false_generalisation", explanation: "", correction: "1/R = 1/R1 + 1/R2", subject: "physics", level: "GCSE", example: circuits[0] }));
    const body = QuestionsOutputSchema.parse(await res.json());
    expect(body.questions).toHaveLength(3);
    for (const q of body.questions) expect(q.trap).not.toBe(q.answer);
    expect(new Set(body.questions.map((q) => q.answer)).size).toBeGreaterThan(1); // the right answer moves about
  });

  it("check questions are refused offline", async () => {
    process.env.SABOTEUR_ENGINE = "offline";
    const res = await questionsRoute(post({ label: "x", errorType: null, explanation: "", correction: "", subject: "", level: "GCSE", example: circuits[0] }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ offline: true });
  });
});

describe("tidying the model's answer", () => {
  const d = (over: Partial<Diagnosis>): Diagnosis => ({ itemId: "a1", kind: "misconception", label: "x", errorType: "swapped_terms", explanation: "e", correction: "c", confidence: 0.9, probe: "Did you?", subject: "Physics", topic: "Circuits", ...over });
  it("keeps one diagnosis per asked item, probes only when unsure, slips untyped", () => {
    const out = tidy({ diagnoses: [d({}), d({ label: "dup" }), d({ itemId: "zz" }), d({ itemId: "a2", kind: "careless_slip" }), d({ itemId: "a3", confidence: 0.4 })] }, ["a1", "a2", "a3"]);
    expect(out.diagnoses.map((x) => [x.itemId, x.label, x.probe, x.errorType, x.subject])).toEqual([
      ["a1", "x", null, "swapped_terms", "physics"],
      ["a2", "x", null, null, "physics"],
      ["a3", "x", "Did you?", "swapped_terms", "physics"],
    ]);
  });
});

describe("mock heuristic", () => {
  it("calls a near-miss a slip and anything else a cautious misconception", () => {
    expect(mockDiagnosis({ id: "a1", question: "Spell the unit of force", answer: "Newtom", correct: "Newton" }).kind).toBe("careless_slip");
    const m = mockDiagnosis({ id: "a1", question: "Capital of Australia?", answer: "Sydney", correct: "Canberra" });
    expect(m.kind).toBe("misconception");
    expect(m.probe).toBeTruthy();
  });
});
