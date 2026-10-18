import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { callJSON, type Prompt } from "../llm";
import { clearDiscovery, guessModel, modelsFor } from "./discovery";
import { keyVariants, PROVIDER_BY_ID } from "./providers";
import { newPolicy, Router, setRouter, type Need } from "./router";
import { classify, stripThinking } from "./transport";

const strong: Need = { task: "plantErrors", minCapability: 3, effortTier: 3, vision: false };
const quick: Need = { task: "gradeCorrections", minCapability: 1, effortTier: 1, vision: false };

/** A fake provider world: /models lists, and chat replies scripted per model. */
function world(opts: { models?: Record<string, string[] | "down">; reply?: (model: string, key: string) => Response | Promise<Response> } = {}) {
  const calls: { url: string; model?: string; key?: string }[] = [];
  const impl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const key = (init?.headers as Record<string, string> | undefined)?.Authorization?.replace("Bearer ", "");
    if (url.endsWith("/models")) {
      const host = Object.keys(opts.models ?? {}).find((h) => url.includes(h));
      const list = host ? opts.models![host] : undefined;
      if (!list || list === "down") return new Response("nope", { status: 500 });
      return Response.json({ data: list.map((id) => ({ id })) });
    }
    const body = JSON.parse(String(init?.body ?? "{}"));
    calls.push({ url, model: body.model, key });
    return opts.reply ? opts.reply(body.model, key ?? "") : Response.json({ choices: [{ message: { content: '{"ok":true}' } }] });
  });
  return { fetch: impl as unknown as typeof fetch, calls };
}

let clock = 1_000_000;
const now = () => clock;

describe("providers and discovery", () => {
  beforeEach(() => clearDiscovery());

  it("finds numbered key variants that are set", () => {
    expect(keyVariants("GROQ_API_KEY", { GROQ_API_KEY: "a", GROQ_API_KEY_2: "", GROQ_API_KEY_3: "c" })).toEqual(["GROQ_API_KEY", "GROQ_API_KEY_3"]);
    expect(keyVariants("GROQ_API_KEY", {})).toEqual([]);
  });

  it("keeps only catalogue models a provider still lists, and falls back to the catalogue when it can't list", async () => {
    const env = { GROQ_API_KEY: "g" };
    const live = world({ models: { "api.groq.com": ["llama-3.3-70b-versatile", "whisper-large-v3"] } });
    expect((await modelsFor(PROVIDER_BY_ID.groq, "GROQ_API_KEY", live.fetch, env)).map((m) => m.id)).toEqual(["llama-3.3-70b-versatile"]);
    clearDiscovery();
    const down = world({ models: { "api.groq.com": "down" } });
    expect((await modelsFor(PROVIDER_BY_ID.groq, "GROQ_API_KEY", down.fetch, env)).length).toBeGreaterThan(3);
  });

  it("adds new free OpenRouter models with a guessed capability, never paid ones", async () => {
    const w = world({ models: { "openrouter.ai": ["new-lab/giant-405b-instruct:free", "new-lab/giant-405b-instruct", "acme/tiny-3b:free", "x/text-embedding-3:free"] } });
    const ms = await modelsFor(PROVIDER_BY_ID.openrouter, "OPENROUTER_API_KEY", w.fetch, { OPENROUTER_API_KEY: "o" });
    expect(ms.map((m) => [m.id, m.capability])).toEqual([
      ["new-lab/giant-405b-instruct:free", 4],
      ["acme/tiny-3b:free", 1],
    ]);
  });

  it("guesses capability, vision and thinking from a model's name", () => {
    expect(guessModel("llm7", "deepseek-r1-0528")).toMatchObject({ capability: 4, thinks: true });
    expect(guessModel("llm7", "gemini-2.5-pro")).toMatchObject({ capability: 5, vision: true });
    expect(guessModel("llm7", "qwen2.5-vl-72b-instruct")).toMatchObject({ capability: 3, vision: true });
    expect(guessModel("llm7", "text-embedding-3-small")).toBeNull();
  });

  it("classifies failures", () => {
    expect(classify(429, "Rate limit reached for requests")).toBe("rate_limit");
    expect(classify(429, "You exceeded your current quota")).toBe("quota");
    expect(classify(429, "Rate limit exceeded: free-models-per-day")).toBe("quota");
    expect(classify(401, "Invalid API key")).toBe("auth");
    expect(classify(402, "Insufficient credits")).toBe("quota");
    expect(classify(404, "")).toBe("not_found");
    expect(classify(400, "The model `x` has been decommissioned")).toBe("not_found");
    expect(classify(400, "context length exceeded")).toBe("bad_request");
    expect(classify(503, "overloaded")).toBe("server");
    expect(stripThinking("<think>hmm {not json}</think>\n{\"a\":1}")).toBe('{"a":1}');
  });
});

describe("route selection", () => {
  beforeEach(() => {
    clearDiscovery();
    clock = 1_000_000;
  });
  const env = { GROQ_API_KEY: "g1", GROQ_API_KEY_2: "g2", GEMINI_API_KEY: "m" };
  const make = (e: Record<string, string> = env, w = world()) => new Router({ env: e, fetch: w.fetch, now, file: null });

  it("uses only providers with keys, one route per key", async () => {
    const r = make();
    expect(r.providers().map((p) => [p.id, p.keys])).toEqual([
      ["groq", 2],
      ["gemini", 1],
    ]);
    const routes = await r.allRoutes();
    expect(routes.every((x) => x.provider === "groq" || x.provider === "gemini")).toBe(true);
    expect(routes.filter((x) => x.model === "llama-3.3-70b-versatile").map((x) => x.keyEnv)).toEqual(["GROQ_API_KEY", "GROQ_API_KEY_2"]);
  });

  it("strong tasks get capable models, quick tasks small ones, pictures vision models", async () => {
    const r = make();
    const s = (await r.select(strong, newPolicy()))!;
    const q = (await r.select(quick, newPolicy()))!;
    expect(s.capability).toBeGreaterThanOrEqual(4);
    expect(q.capability).toBeLessThan(s.capability);
    expect((await r.select({ ...strong, vision: true }, newPolicy()))!.vision).toBe(true);
  });

  it("uses the exact Claude model a prompt names when Anthropic is set up", async () => {
    const r = make({ ...env, ANTHROPIC_API_KEY: "a" });
    expect((await r.select({ ...strong, preferredModel: "claude-sonnet-5-5" }, newPolicy()))!.key).toBe("anthropic/claude-sonnet-5-5@ANTHROPIC_API_KEY");
  });

  it("takes turns across keys of the same model", async () => {
    const r = make({ GROQ_API_KEY: "g1", GROQ_API_KEY_2: "g2" });
    const a = (await r.select(quick, newPolicy()))!;
    r.succeeded(a, quick.task);
    const b = (await r.select(quick, newPolicy()))!;
    expect(a.model).toBe(b.model);
    expect(a.keyEnv).not.toBe(b.keyEnv);
  });

  it("a rate limit rests the key and halves its capacity once per window", async () => {
    const r = make({ GROQ_API_KEY: "g1" });
    expect(r.capacity("GROQ_API_KEY")).toBe(8);
    const a = (await r.select(strong, newPolicy()))!;
    const b = (await r.select(strong, newPolicy()))!; // two requests in flight when the 429s arrive
    r.failed(a, strong.task, "rate_limit", "slow down");
    r.failed(b, strong.task, "rate_limit", "slow down"); // the same window: no second halving
    expect(r.capacity("GROQ_API_KEY")).toBe(4);
    expect(await r.select(strong, newPolicy())).toBeNull(); // the only key is resting
    expect(await r.explain({ vision: false }, newPolicy())).toMatch(/key unavailable=\d+/);
    expect(r.status().keys[0]).toMatchObject({ key: "GROQ_API_KEY", why: expect.stringContaining("rate limited") });
    clock += 61_000;
    expect(await r.select(strong, newPolicy())).not.toBeNull();
  });

  it("a refused key is out for a day; a missing model only takes out its route", async () => {
    const r = make();
    const a = (await r.select(strong, newPolicy()))!;
    r.failed(a, strong.task, a.provider === "groq" ? "auth" : "auth", "bad key");
    for (let i = 0; i < 10; i++) {
      const next = await r.select(strong, newPolicy());
      if (!next) break;
      expect(next.keyEnv).not.toBe(a.keyEnv);
      r.release(next);
    }
    const b = (await r.select(quick, newPolicy()))!;
    r.failed(b, quick.task, "not_found", "decommissioned");
    const c = (await r.select(quick, newPolicy()))!;
    expect(c.key).not.toBe(b.key);
  });

  it("learns per task: bad output lowers a route's score for that task only", async () => {
    const r = make({ GROQ_API_KEY: "g1" });
    const a = (await r.select(strong, newPolicy()))!;
    for (let i = 0; i < 5; i++) r.failed(a, strong.task, "invalid_output", "not json");
    expect(r.score(strong.task, a.key)).toBeLessThan(0.5);
    expect(r.score("gradeCorrections", a.key)).toBe(0.9);
    const b = (await r.select(strong, newPolicy()))!;
    expect(b.key).not.toBe(a.key); // a sub-confidence route is skipped while others qualify
  });

  it("explains an empty router", async () => {
    const r = make({});
    expect(r.hasRoutes()).toBe(false);
    expect(await r.explain({ vision: false }, newPolicy())).toMatch(/no AI provider keys/);
  });

  it("SABOTEUR_ROUTES adds routes by hand", async () => {
    const r = make({ GROQ_API_KEY: "g", SABOTEUR_ROUTES: "groq:my-org/new-model:4:vision" });
    expect((await r.allRoutes()).find((x) => x.model === "my-org/new-model")).toMatchObject({ capability: 4, vision: true });
  });
});

describe("callJSON through the router", () => {
  const prompt: Prompt = { name: "plantErrors", params: {}, model: "claude-sonnet-5-5", effort: "medium", system: "s", user: "u" };
  const Schema = z.object({ ok: z.literal(true) });
  const saved = { ...process.env };
  beforeEach(() => {
    clearDiscovery();
    clock = 1_000_000;
    for (const k of Object.keys(process.env)) if (/_API_KEY|SABOTEUR_/.test(k)) delete process.env[k];
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = { ...saved };
    setRouter(null);
    vi.restoreAllMocks();
  });

  it("fails over from a rate-limited key to the next route and returns valid JSON", async () => {
    process.env.GROQ_API_KEY = "g1";
    process.env.GEMINI_API_KEY = "m";
    const w = world({ reply: (_m, key) => (key === "g1" ? new Response(JSON.stringify({ error: { message: "Rate limit reached" } }), { status: 429, headers: { "retry-after": "30" } }) : Response.json({ choices: [{ message: { content: 'Sure! ```json\n{"ok": true}\n```' } }] })) });
    setRouter(new Router({ fetch: w.fetch, now, file: null }));
    expect(await callJSON(prompt, Schema)).toEqual({ ok: true });
    expect(w.calls.map((c) => c.key)).toContain("m");
  });

  it("asks another route to correct invalid JSON", async () => {
    process.env.GROQ_API_KEY = "g1";
    let n = 0;
    const w = world({ reply: () => Response.json({ choices: [{ message: { content: n++ === 0 ? "I can't do JSON today" : '{"ok":true}' } }] }) });
    setRouter(new Router({ fetch: w.fetch, now, file: null }));
    expect(await callJSON(prompt, Schema)).toEqual({ ok: true });
    expect(w.calls).toHaveLength(2);
    expect(w.calls[0].model).not.toBe(w.calls[1].model);
  });

  it("reports unavailable (so rounds fall back to offline) when every route is down", async () => {
    process.env.GROQ_API_KEY = "g1";
    const w = world({ reply: () => new Response(JSON.stringify({ error: { message: "Invalid API Key" } }), { status: 401 }) });
    setRouter(new Router({ fetch: w.fetch, now, file: null }));
    await expect(callJSON(prompt, Schema)).rejects.toMatchObject({ name: "LLMError", unavailable: true });
  });

  it("with no keys at all, says so", async () => {
    setRouter(new Router({ fetch: world().fetch, now, file: null }));
    await expect(callJSON(prompt, Schema)).rejects.toMatchObject({ unavailable: true, message: expect.stringContaining("No AI provider is set up") });
  });

  it("an unreachable provider is skipped for the rest of the request", async () => {
    process.env.GROQ_API_KEY = "g1";
    process.env.GROQ_API_KEY_2 = "g2";
    process.env.GEMINI_API_KEY = "m";
    const calls: string[] = [];
    const impl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/models")) return new Response("", { status: 500 });
      calls.push(url);
      if (url.includes("groq")) throw new TypeError("fetch failed");
      return Response.json({ choices: [{ message: { content: '{"ok":true}' } }] });
    });
    setRouter(new Router({ fetch: impl as unknown as typeof fetch, now, file: null }));
    expect(await callJSON(prompt, Schema)).toEqual({ ok: true });
    expect(calls.filter((u) => u.includes("groq")).length).toBeLessThanOrEqual(1);
  });

  it("sends pictures only to vision models, as data URLs", async () => {
    process.env.GROQ_API_KEY = "g1";
    let sent: unknown = null;
    const impl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).endsWith("/models")) return new Response("", { status: 500 });
      sent = JSON.parse(String(init?.body));
      return Response.json({ choices: [{ message: { content: '{"ok":true}' } }] });
    });
    setRouter(new Router({ fetch: impl as unknown as typeof fetch, now, file: null }));
    await callJSON({ ...prompt, images: [{ mediaType: "image/jpeg", data: "QUJD" }] }, Schema);
    const body = sent as { model: string; messages: { content: unknown }[] };
    expect(body.model).toBe("meta-llama/llama-4-scout-17b-16e-instruct");
    expect(JSON.stringify(body.messages[1].content)).toContain("data:image/jpeg;base64,QUJD");
  });
});
