// Picks a model for each request from every provider key that's set, learns which routes work, and moves
// on when one fails. Adapted from Reticle's Go router: a success score per task and route (moving
// average, optimistic start), per-key capacity that halves on a rate limit and creeps back up (AIMD),
// cooldowns that depend on why a route failed, and a plain explanation when nothing is left.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { modelsFor, type Fetch } from "./discovery";
import { keyVariants, PROVIDERS, type CatalogueModel, type ProviderId } from "./providers";
import type { FailureCategory } from "./transport";

export interface Route extends CatalogueModel {
  /** provider/model@KEY_ENV */
  key: string;
  model: string;
  keyEnv: string;
}

export interface Need {
  /** The prompt's name: scores are learned per task, since a model good at grading may be bad at planting. */
  task: string;
  /** Routes below this capability are only used if nothing else is left. */
  minCapability: number;
  /** 0–5: where in the capable range to pick (0 the smallest that will do, 5 the strongest). */
  effortTier: number;
  vision: boolean;
  /** An exact model to use when its route is available (the Claude model a prompt names). */
  preferredModel?: string;
}

export interface Policy {
  /** Routes already tried for this request. */
  tried: Set<string>;
  /** Providers that already failed this request with a provider-wide problem. */
  avoid: Set<ProviderId>;
}

export const newPolicy = (): Policy => ({ tried: new Set(), avoid: new Set() });

/** Starting score for a route nobody has tried: optimistic, so new routes get a chance. */
const PRIOR = 0.9;
/** Below this score a route is only used when nothing better is available. */
const CONFIDENCE = 0.5;
const ALPHA = 0.2;
const START_CAPACITY = 8;
const MAX_CAPACITY = 32;
const MINUTE = 60_000;
const COOLDOWN: Record<FailureCategory, number> = {
  rate_limit: MINUTE,
  quota: 15 * MINUTE,
  auth: 24 * 60 * MINUTE,
  not_found: 6 * 60 * MINUTE,
  bad_request: 0,
  server: 20_000,
  invalid_output: 0,
  refusal: 0,
};

interface KeyState {
  capacity: number;
  inFlight: number;
  /** One halving per rate-limit window, however many requests hit the 429 at once. */
  penaltyUntil: number;
  unavailableUntil: number;
  why: string;
}

interface RouteState {
  cooldownUntil: number;
  why: string;
  lastUsed: number;
}

export interface RouterOptions {
  env?: Record<string, string | undefined>;
  fetch?: Fetch;
  now?: () => number;
  /** Where learned scores are kept between restarts (null: don't). */
  file?: string | null;
}

export class Router {
  readonly env: Record<string, string | undefined>;
  /** The fetch every request on this router goes through (swapped in tests). */
  readonly fetchImpl: Fetch;
  private now: () => number;
  private file: string | null;
  /** task → route key → score */
  scores: Record<string, Record<string, number>> = {};
  private keys = new Map<string, KeyState>();
  private routes = new Map<string, RouteState>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: RouterOptions = {}) {
    this.env = opts.env ?? process.env;
    this.fetchImpl = opts.fetch ?? ((...a) => fetch(...a));
    this.now = opts.now ?? Date.now;
    this.file = opts.file === undefined ? path.join(process.cwd(), ".saboteur", "routing.json") : opts.file;
    this.load();
  }

  /** Providers with at least one key set. */
  providers(): { id: ProviderId; name: string; keys: number }[] {
    return PROVIDERS.map((p) => ({ id: p.id, name: p.name, keys: keyVariants(p.keyEnv, this.env).length })).filter((p) => p.keys > 0);
  }

  hasRoutes(): boolean {
    return this.providers().length > 0 || this.extraRoutes().length > 0;
  }

  /** SABOTEUR_ROUTES adds routes by hand: "provider:model:capability[:vision]", comma-separated. */
  private extraRoutes(): CatalogueModel[] {
    return (this.env.SABOTEUR_ROUTES ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .flatMap((s) => {
        const [provider, ...rest] = s.split(":");
        const flags = rest.slice(-2);
        const vision = flags.at(-1) === "vision";
        const capEnd = vision ? rest.length - 2 : rest.length - 1;
        const capability = Number(rest[capEnd]);
        const id = rest.slice(0, Number.isFinite(capability) ? capEnd : rest.length).join(":");
        if (!PROVIDERS.some((p) => p.id === provider) || !id) return [];
        return [{ provider: provider as ProviderId, id, capability: Number.isFinite(capability) ? capability : 3, vision, cost: 0 }];
      });
  }

  /** Every route: each model of each provider, once per key that's set. */
  async allRoutes(): Promise<Route[]> {
    const extra = this.extraRoutes();
    const out: Route[] = [];
    for (const p of PROVIDERS) {
      for (const keyEnv of keyVariants(p.keyEnv, this.env)) {
        const models = [...(await modelsFor(p, keyEnv, this.fetchImpl, this.env)), ...extra.filter((m) => m.provider === p.id)];
        const seen = new Set<string>();
        for (const m of models) {
          if (seen.has(m.id)) continue;
          seen.add(m.id);
          out.push({ ...m, model: m.id, keyEnv, key: `${p.id}/${m.id}@${keyEnv}` });
        }
      }
    }
    return out;
  }

  private key(env: string): KeyState {
    let k = this.keys.get(env);
    if (!k) {
      k = { capacity: START_CAPACITY, inFlight: 0, penaltyUntil: 0, unavailableUntil: 0, why: "" };
      this.keys.set(env, k);
    }
    return k;
  }

  private route(key: string): RouteState {
    let r = this.routes.get(key);
    if (!r) {
      r = { cooldownUntil: 0, why: "", lastUsed: 0 };
      this.routes.set(key, r);
    }
    return r;
  }

  /** How many requests a key may have in flight right now. */
  capacity(keyEnv: string): number {
    return this.key(keyEnv).capacity;
  }

  score(task: string, routeKey: string): number {
    return this.scores[task]?.[routeKey] ?? PRIOR;
  }

  private open(r: Route, policy: Policy, t: number): boolean {
    const k = this.key(r.keyEnv);
    return !policy.tried.has(r.key) && !policy.avoid.has(r.provider) && this.route(r.key).cooldownUntil <= t && k.unavailableUntil <= t && k.inFlight < k.capacity;
  }

  /**
   * Choose a route, or null (see explain()). Hard limits: images need a vision model; a cooling route,
   * a key that's out, a full key and a route already tried are skipped. Soft: capability and score fall
   * back when nothing meets them.
   */
  async select(need: Need, policy: Policy): Promise<Route | null> {
    const t = this.now();
    const all = (await this.allRoutes()).filter((r) => (!need.vision || r.vision) && this.open(r, policy, t));
    if (!all.length) return null;

    const preferred = need.preferredModel ? all.filter((r) => r.model === need.preferredModel && this.score(need.task, r.key) >= CONFIDENCE) : [];
    let pool = preferred.length ? preferred : all.filter((r) => r.capability >= need.minCapability && this.score(need.task, r.key) >= CONFIDENCE);
    if (!pool.length) pool = all.filter((r) => r.capability >= need.minCapability);
    if (!pool.length) pool = all;

    // Smallest capability first, then cheapest, then best learned score; the effort tier picks a point
    // along that line. Keys of the same model take turns.
    const models = [...new Map(pool.map((r) => [`${r.provider}/${r.model}`, r])).values()].sort(
      (a, b) => a.capability - b.capability || a.cost - b.cost || this.score(need.task, b.key) - this.score(need.task, a.key) || a.key.localeCompare(b.key),
    );
    const idx = Math.min(models.length - 1, Math.max(0, Math.round(Math.min(need.effortTier, 5) * 0.2 * (models.length - 1))));
    const pick = models[idx];
    const sameModel = pool.filter((r) => r.provider === pick.provider && r.model === pick.model).sort((a, b) => this.route(a.key).lastUsed - this.route(b.key).lastUsed);
    const chosen = sameModel[0];
    this.route(chosen.key).lastUsed = t;
    this.key(chosen.keyEnv).inFlight++;
    return chosen;
  }

  /** The request on this route finished well. */
  succeeded(route: Route, task: string) {
    const k = this.key(route.keyEnv);
    const busy = k.inFlight;
    k.inFlight = Math.max(0, k.inFlight - 1);
    // Additive increase, only when the key was actually being pushed.
    if (busy >= k.capacity / 2 && k.capacity < MAX_CAPACITY) k.capacity++;
    k.unavailableUntil = 0;
    this.learn(task, route.key, 1);
  }

  /** The request on this route failed: cool what the failure says to cool, and learn from it. */
  failed(route: Route, task: string, category: FailureCategory, why = "", retryAt?: number) {
    const t = this.now();
    const k = this.key(route.keyEnv);
    k.inFlight = Math.max(0, k.inFlight - 1);
    const until = Math.max(t + COOLDOWN[category], retryAt ?? 0);
    switch (category) {
      case "rate_limit":
        // Multiplicative decrease, once per window; the whole key rests.
        if (k.penaltyUntil <= t) {
          k.capacity = Math.max(1, Math.floor(k.capacity / 2));
          k.penaltyUntil = until;
        }
        k.unavailableUntil = Math.max(k.unavailableUntil, until);
        k.why = `rate limited: ${why}`;
        break;
      case "quota":
      case "auth":
        k.unavailableUntil = until;
        k.why = `${category === "auth" ? "key refused" : "quota or credit exhausted"}: ${why}`;
        break;
      case "not_found":
      case "server": {
        const r = this.route(route.key);
        r.cooldownUntil = until;
        r.why = `${category === "server" ? "unavailable" : "model not served"}: ${why}`;
        break;
      }
      default:
        break;
    }
    // Only the model's own failures count against its score; a busy or broken key says nothing about the model.
    if (category === "invalid_output" || category === "refusal" || category === "bad_request" || category === "not_found") this.learn(task, route.key, 0);
  }

  /** Give back a slot without judging the route (the caller gave up). */
  release(route: Route) {
    const k = this.key(route.keyEnv);
    k.inFlight = Math.max(0, k.inFlight - 1);
  }

  private learn(task: string, routeKey: string, target: number) {
    const now = this.score(task, routeKey);
    (this.scores[task] ??= {})[routeKey] = +((1 - ALPHA) * now + ALPHA * target).toFixed(4);
    this.save();
  }

  /** Why no route is available right now, for logs and error messages. Changes nothing. */
  async explain(need: Pick<Need, "vision">, policy: Policy): Promise<string> {
    const t = this.now();
    const all = await this.allRoutes();
    if (!all.length) return "no AI provider keys are set (see docs/router.md)";
    let vision = 0;
    let tried = 0;
    let avoided = 0;
    let cooling = 0;
    let keyOut = 0;
    let full = 0;
    for (const r of all) {
      const k = this.key(r.keyEnv);
      if (need.vision && !r.vision) vision++;
      else if (policy.tried.has(r.key)) tried++;
      else if (policy.avoid.has(r.provider)) avoided++;
      else if (k.unavailableUntil > t) keyOut++;
      else if (this.route(r.key).cooldownUntil > t) cooling++;
      else if (k.inFlight >= k.capacity) full++;
    }
    return `no route left (routes=${all.length}, tried=${tried}, key unavailable=${keyOut}, cooling down=${cooling}, at capacity=${full}, no image support=${vision}, provider avoided=${avoided})`;
  }

  /** Health of every key and cooling route, for /api/engine. */
  status() {
    const t = this.now();
    return {
      providers: this.providers(),
      keys: [...this.keys.entries()].filter(([, k]) => k.unavailableUntil > t).map(([env, k]) => ({ key: env, until: new Date(k.unavailableUntil).toISOString(), why: k.why })),
      routes: [...this.routes.entries()].filter(([, r]) => r.cooldownUntil > t).map(([key, r]) => ({ route: key, until: new Date(r.cooldownUntil).toISOString(), why: r.why })),
    };
  }

  private load() {
    if (!this.file) return;
    try {
      const data = JSON.parse(readFileSync(this.file, "utf8")) as { scores?: Router["scores"] };
      if (data.scores && typeof data.scores === "object") this.scores = data.scores;
    } catch {
      // first run, or unreadable: start fresh
    }
  }

  /** Learned scores survive restarts where the disk is writable (not on serverless hosts, which is fine). */
  private save() {
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        mkdirSync(path.dirname(this.file!), { recursive: true });
        writeFileSync(this.file!, JSON.stringify({ scores: this.scores }, null, 1));
      } catch {
        // read-only disk: scores live for this process only
      }
    }, 2000);
    this.saveTimer.unref?.();
  }
}

let shared: Router | null = null;
/** The process-wide router. */
export function router(): Router {
  return (shared ??= new Router());
}
/** For tests: swap in a router with fake keys, fetch and clock. */
export function setRouter(r: Router | null) {
  shared = r;
}
