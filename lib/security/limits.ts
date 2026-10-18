// Per-client rate limits and in-flight caps for the API, kept in memory (one server process: see
// docs/deploy.md). Every AI call costs real quota, so each route has its own allowance per minute and
// per hour, and the long streaming routes cap how many a client can hold open at once.

export type Bucket = "generate" | "grade" | "replay" | "diagnose" | "questions" | "normalise" | "health" | "info";

interface Limit {
  perMinute: number;
  perHour: number;
  /** Requests one client may have open at once (streams), if limited. */
  concurrent?: number;
}

/** Per client (IP). Generous for a student playing normally; tight enough that a script can't drain the keys. */
export const LIMITS: Record<Bucket, Limit> = {
  generate: { perMinute: 4, perHour: 30, concurrent: 2 },
  grade: { perMinute: 10, perHour: 60 },
  replay: { perMinute: 10, perHour: 60 },
  diagnose: { perMinute: 3, perHour: 15, concurrent: 1 },
  questions: { perMinute: 10, perHour: 60 },
  normalise: { perMinute: 10, perHour: 60 },
  health: { perMinute: 2, perHour: 6 },
  info: { perMinute: 120, perHour: 2000 },
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** Clients remembered at once; the least recently seen are forgotten first. */
const MAX_CLIENTS = 50_000;

/**
 * Sliding-window counter: the current window's count plus the previous window's, weighted by how much
 * of it still overlaps. Two numbers per window instead of a timestamp per request.
 */
interface Window {
  start: number;
  count: number;
  prev: number;
}

function hit(w: Window, size: number, now: number): number {
  const elapsed = now - w.start;
  if (elapsed >= 2 * size) {
    w.start = now - (elapsed % size);
    w.prev = 0;
    w.count = 0;
  } else if (elapsed >= size) {
    w.start += size;
    w.prev = w.count;
    w.count = 0;
  }
  const overlap = 1 - (now - w.start) / size;
  return w.count + w.prev * overlap;
}

interface Client {
  minute: Window;
  hour: Window;
  open: number;
  seen: number;
}

export interface Verdict {
  ok: boolean;
  /** Seconds until a retry could succeed. */
  retryAfter?: number;
  reason?: "rate" | "concurrent";
}

export class Limiter {
  private clients = new Map<string, Client>();
  constructor(
    private now: () => number = Date.now,
    /** Multiplies every allowance (RATE_LIMIT_SCALE): 10 for load tests, 0.5 under attack. */
    private scale = () => Number(process.env.RATE_LIMIT_SCALE ?? 1) || 1,
  ) {}

  /** Count a request from this client against this bucket, or refuse it. */
  take(bucket: Bucket, client: string): Verdict {
    const t = this.now();
    const key = `${bucket}:${client}`;
    let c = this.clients.get(key);
    if (!c) {
      if (this.clients.size >= MAX_CLIENTS) this.evict();
      c = { minute: { start: t, count: 0, prev: 0 }, hour: { start: t, count: 0, prev: 0 }, open: 0, seen: t };
      this.clients.set(key, c);
    }
    c.seen = t;
    const limit = LIMITS[bucket];
    const k = this.scale();
    if (limit.concurrent && c.open >= Math.max(1, Math.round(limit.concurrent * k))) return { ok: false, retryAfter: 10, reason: "concurrent" };
    const perMinute = Math.max(1, Math.floor(limit.perMinute * k));
    const perHour = Math.max(1, Math.floor(limit.perHour * k));
    if (hit(c.minute, MINUTE, t) + 1 > perMinute) return { ok: false, retryAfter: Math.ceil((c.minute.start + MINUTE - t) / 1000), reason: "rate" };
    if (hit(c.hour, HOUR, t) + 1 > perHour) return { ok: false, retryAfter: Math.ceil((c.hour.start + HOUR - t) / 1000), reason: "rate" };
    c.minute.count++;
    c.hour.count++;
    if (limit.concurrent) c.open++;
    return { ok: true };
  }

  /** A streaming request finished: free its slot. */
  done(bucket: Bucket, client: string) {
    const c = this.clients.get(`${bucket}:${client}`);
    if (c && c.open > 0) c.open--;
  }

  private evict() {
    const oldest = [...this.clients.entries()].sort((a, b) => a[1].seen - b[1].seen).slice(0, Math.ceil(MAX_CLIENTS / 10));
    for (const [k, c] of oldest) if (!c.open) this.clients.delete(k);
  }
}

/**
 * All AI calls on this server per day (AI_DAILY_BUDGET, default 2000), so that many clients together,
 * or one rotating its address, can't run up an unbounded bill. Past it, AI features act as if the AI
 * were unavailable: rounds are built offline, the autopsy offers manual logging.
 */
export class Budget {
  private day = "";
  private used = 0;
  constructor(private now: () => number = Date.now) {}

  private limit() {
    const n = Number(process.env.AI_DAILY_BUDGET ?? 2000);
    return Number.isFinite(n) && n > 0 ? n : 2000;
  }

  /** Spend one call, or say there's none left today. */
  spend(): boolean {
    const today = new Date(this.now()).toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.used = 0;
    }
    if (this.used >= this.limit()) return false;
    this.used++;
    return true;
  }

  remaining() {
    return Math.max(0, this.limit() - this.used);
  }
}

const g = globalThis as unknown as { __saboteurLimiter?: Limiter; __saboteurBudget?: Budget };
export const limiter = () => (g.__saboteurLimiter ??= new Limiter());
export const budget = () => (g.__saboteurBudget ??= new Budget());

/** For tests: start with clean counters. */
export function resetLimits(l: Limiter | null = null, b: Budget | null = null) {
  g.__saboteurLimiter = l ?? new Limiter();
  g.__saboteurBudget = b ?? new Budget();
}
