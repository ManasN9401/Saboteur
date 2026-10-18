// When the model fails mid-autopsy, the error is logged without anything the student sent.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../llm", async (orig) => ({
  ...(await orig<typeof import("../llm")>()),
  // An SDK error can carry the request it failed on; the route must not log that.
  callJSON: vi.fn(async (prompt: { images?: { data: string }[] }) => {
    throw Object.assign(new Error("upstream exploded"), { request: prompt });
  }),
}));

describe("autopsy privacy on failure", () => {
  afterEach(() => {
    delete process.env.SABOTEUR_MOCK;
    vi.restoreAllMocks();
  });

  it("logs the error message only", async () => {
    process.env.SABOTEUR_MOCK = "1";
    const { POST } = await import("@/app/api/autopsy/diagnose/route");
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((k) => vi.spyOn(console, k).mockImplementation(() => {}));
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ image: { mediaType: "image/png", data: "SECRETPIXELS".repeat(40) }, level: "GCSE" }) }));
    const text = await res.text();
    expect(text).toContain('"type":"error"');
    expect(text).not.toContain("SECRETPIXELS");
    const logged = spies.flatMap((s) => s.mock.calls);
    expect(logged.length).toBeGreaterThan(0);
    for (const call of logged) expect(JSON.stringify(call)).not.toContain("SECRETPIXELS");
  });
});
