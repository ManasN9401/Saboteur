import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as generate } from "@/app/api/saboteur/generate/route";
import { POST as replay } from "@/app/api/saboteur/replay/route";
import { getRound } from "../roundStore.server";
import { clientIp, readJson, sameOrigin } from "./guard";
import { Budget, Limiter, LIMITS, resetLimits } from "./limits";

let clock = 1_000_000;
const now = () => clock;

describe("rate limiter", () => {
  beforeEach(() => {
    clock = 1_000_000;
  });

  it("allows the per-minute allowance, then refuses with a retry time", () => {
    const l = new Limiter(now, () => 1);
    for (let i = 0; i < LIMITS.grade.perMinute; i++) expect(l.take("grade", "1.2.3.4").ok).toBe(true);
    const no = l.take("grade", "1.2.3.4");
    expect(no).toMatchObject({ ok: false, reason: "rate" });
    expect(no.retryAfter).toBeGreaterThan(0);
    expect(l.take("grade", "5.6.7.8").ok).toBe(true); // another client is unaffected
    expect(l.take("questions", "1.2.3.4").ok).toBe(true); // and so is another route
  });

  it("slides: the previous minute still counts in part", () => {
    const l = new Limiter(now, () => 1);
    for (let i = 0; i < LIMITS.grade.perMinute; i++) l.take("grade", "a");
    clock += 60_000 + 6_000; // 10% into the next minute: 90% of the last one (9 of 10) still weighs
    expect(l.take("grade", "a").ok).toBe(true); // 9 + 1 fits
    expect(l.take("grade", "a").ok).toBe(false); // 9 + 2 doesn't
    clock += 54_000; // the old minute has slid out
    expect(l.take("grade", "a").ok).toBe(true);
  });

  it("enforces the hourly allowance across minutes", () => {
    const l = new Limiter(now, () => 1);
    let allowed = 0;
    for (let m = 0; m < 60; m++) {
      for (let i = 0; i < LIMITS.diagnose.perMinute; i++) {
        if (l.take("diagnose", "a").ok) {
          allowed++;
          l.done("diagnose", "a");
        }
      }
      clock += 60_000;
    }
    expect(allowed).toBeLessThanOrEqual(LIMITS.diagnose.perHour + 1);
    expect(allowed).toBeGreaterThanOrEqual(LIMITS.diagnose.perHour - 1);
  });

  it("caps how many long streams one client holds open", () => {
    const l = new Limiter(now, () => 1);
    expect(l.take("diagnose", "a").ok).toBe(true);
    expect(l.take("diagnose", "a")).toMatchObject({ ok: false, reason: "concurrent" });
    l.done("diagnose", "a");
    expect(l.take("diagnose", "a").ok).toBe(true);
  });

  it("scales with RATE_LIMIT_SCALE", () => {
    const l = new Limiter(now, () => 3);
    let n = 0;
    while (l.take("grade", "a").ok) n++;
    expect(n).toBe(LIMITS.grade.perMinute * 3);
  });

  it("the daily AI budget runs out and resets the next day", () => {
    vi.stubEnv("AI_DAILY_BUDGET", "3");
    const b = new Budget(now);
    expect([b.spend(), b.spend(), b.spend(), b.spend()]).toEqual([true, true, true, false]);
    clock += 86_400_000;
    expect(b.spend()).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("request checks", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it("trusts the right client address", () => {
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6, 1.1.1.1" }), {})).toBe("1.1.1.1"); // forged entries are on the left
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6, 1.1.1.1, 10.0.0.2" }), { TRUST_PROXY_HOPS: "2" })).toBe("1.1.1.1");
    expect(clientIp(h({ "fly-client-ip": "2.2.2.2", "x-forwarded-for": "9.9.9.9" }), { TRUSTED_IP_HEADER: "Fly-Client-IP" })).toBe("2.2.2.2");
    expect(clientIp(h({}), {})).toBe("unknown");
  });

  it("refuses other sites, allows same-origin and origin-less requests", () => {
    const r = (origin?: string) => new Request("http://saboteur.app/api/x", { method: "POST", headers: { host: "saboteur.app", ...(origin ? { origin } : {}) } });
    expect(sameOrigin(r("http://saboteur.app"), {})).toBe(true);
    expect(sameOrigin(r(), {})).toBe(true);
    expect(sameOrigin(r("https://evil.example"), {})).toBe(false);
    expect(sameOrigin(r("null"), {})).toBe(false);
    expect(sameOrigin(r("https://partner.example"), { ALLOWED_ORIGINS: "https://partner.example" })).toBe(true);
  });

  it("refuses an oversized body, declared or not", async () => {
    const big = JSON.stringify({ x: "a".repeat(5000) });
    const declared = await readJson(new Request("http://x", { method: "POST", body: big, headers: { "content-length": String(big.length) } }), 1000);
    expect("response" in declared && declared.response.status).toBe(413);
    const stream = new ReadableStream({
      start(c) {
        for (let i = 0; i < 10; i++) c.enqueue(new TextEncoder().encode("a".repeat(500)));
        c.close();
      },
    });
    const undeclared = await readJson(new Request("http://x", { method: "POST", body: stream, duplex: "half" } as RequestInit), 1000);
    expect("response" in undeclared && undeclared.response.status).toBe(413);
    const ok = await readJson(new Request("http://x", { method: "POST", body: '{"a":1}' }), 1000);
    expect(ok).toEqual({ data: { a: 1 } });
    const bad = await readJson(new Request("http://x", { method: "POST", body: "{nope" }), 1000);
    expect("response" in bad && bad.response.status).toBe(400);
  });
});

describe("routes behind the guard", () => {
  beforeEach(() => {
    resetLimits();
    process.env.SABOTEUR_ENGINE = "offline";
  });
  afterEach(() => {
    delete process.env.SABOTEUR_ENGINE;
    resetLimits();
  });
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    new Request("http://saboteur.app/api", { method: "POST", body: JSON.stringify(body), headers: { host: "saboteur.app", "x-forwarded-for": "7.7.7.7", ...headers } });

  it("generate: a script hammering it gets 429 with Retry-After", async () => {
    const req = { topic: "The water cycle", level: "GCSE / middle school", difficulty: "subtle" };
    const codes: number[] = [];
    for (let i = 0; i < LIMITS.generate.perMinute + 2; i++) {
      const res = await generate(post(req));
      codes.push(res.status);
      await res.text(); // let the stream finish so its slot frees
    }
    expect(codes.slice(0, LIMITS.generate.perMinute).every((c) => c === 200)).toBe(true);
    expect(codes.at(-1)).toBe(429);
    const res = await generate(post(req));
    expect(res.headers.get("retry-after")).toBeTruthy();
    expect((await res.json()).error).toMatch(/Too many requests/);
  });

  it("refuses a cross-site request before doing any work", async () => {
    const res = await generate(post({ topic: "x" }, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
  });

  it("replay can't fill the server's memory with oversized rounds", async () => {
    const huge = { round: { id: "r", topic: "t", topicId: "t", level: "l", difficulty: "subtle", createdAt: "x", sentences: [{ id: "s1", text: "a".repeat(400_000) }] }, errors: [] };
    const res = await replay(post(huge));
    expect(res.status).toBe(413);
    expect(getRound("r")).toBeUndefined();
  });
});
