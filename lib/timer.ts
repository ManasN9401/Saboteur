// The desk clock's timers: a focus timer (pomodoro: focus, short break, and a long break every few
// rounds), a plain countdown and a stopwatch. One shared state per device, kept in localStorage, so a
// timer keeps running while you play a round, across pages, reloads and tabs. Running countdowns are
// stored as the moment they end, never as a ticking number, so a sleeping tab can't drift.
import { z } from "zod";
import { dayKey } from "./progress/day";
import { PREFIX } from "./storage/keys";
import { getRaw, setRaw } from "./storage/kv";

export const TIMER_KEY = `${PREFIX}timer`;

export const TimerSettingsSchema = z.object({
  focus: z.number().int().min(1).max(180).default(25),
  short: z.number().int().min(1).max(60).default(5),
  long: z.number().int().min(1).max(90).default(15),
  /** Focus rounds before a long break. */
  rounds: z.number().int().min(2).max(12).default(4),
  /** Start the next phase by itself when one ends. */
  autoStart: z.boolean().default(true),
  sound: z.boolean().default(true),
  /** A quiet tick while focusing, like the clock itself. */
  tick: z.boolean().default(false),
  /** A system notification when a phase ends and the tab isn't in view. */
  notify: z.boolean().default(false),
  hour24: z.boolean().default(true),
});
export type TimerSettings = z.infer<typeof TimerSettingsSchema>;

export const MODES = ["focus", "timer", "stopwatch"] as const;
export type Mode = (typeof MODES)[number];
export type Phase = "focus" | "short" | "long";

export const TimerSchema = z.object({
  mode: z.enum(MODES).default("focus"),
  phase: z.enum(["focus", "short", "long"]).default("focus"),
  /** Which focus round of the cycle (1 … settings.rounds). */
  round: z.number().int().min(1).default(1),
  /** Running countdown: when it ends (ms since 1970). */
  endsAt: z.number().nullable().default(null),
  /** Paused countdown: ms left. Null with no endsAt: idle, at full length. */
  left: z.number().min(0).nullable().default(null),
  /** The countdown timer's length, in minutes. */
  timerMin: z.number().min(1).max(600).default(10),
  /** Stopwatch: running since; time banked before that; laps (ms since start). */
  swFrom: z.number().nullable().default(null),
  swBank: z.number().min(0).default(0),
  laps: z.array(z.number()).max(99).default([]),
  /** Focus rounds finished, per local day. */
  tally: z.record(z.string(), z.number().int()).default({}),
  settings: TimerSettingsSchema.prefault({}),
});
export type Timer = z.infer<typeof TimerSchema>;

export const freshTimer = (): Timer => TimerSchema.parse({});

/* ---------- Pure transitions (tested in timer.test.ts) ---------- */

const MIN = 60_000;

/** Full length of the current countdown, in ms. */
export function lengthOf(t: Timer): number {
  if (t.mode === "timer") return t.timerMin * MIN;
  return t.settings[t.phase] * MIN;
}

/** Ms left on the countdown (focus or timer mode). */
export function leftOf(t: Timer, now: number): number {
  if (t.endsAt !== null) return Math.max(0, t.endsAt - now);
  return t.left ?? lengthOf(t);
}

export const isRunning = (t: Timer) => (t.mode === "stopwatch" ? t.swFrom !== null : t.endsAt !== null);
/** Something is under way: running, or paused part-way. */
export const isActive = (t: Timer) => (t.mode === "stopwatch" ? t.swFrom !== null || t.swBank > 0 : t.endsAt !== null || t.left !== null);

export function elapsedOf(t: Timer, now: number): number {
  return t.swBank + (t.swFrom !== null ? now - t.swFrom : 0);
}

export function start(t: Timer, now: number): Timer {
  if (t.mode === "stopwatch") return t.swFrom !== null ? t : { ...t, swFrom: now };
  if (t.endsAt !== null) return t;
  return { ...t, endsAt: now + leftOf(t, now), left: null };
}

export function pause(t: Timer, now: number): Timer {
  if (t.mode === "stopwatch") return t.swFrom === null ? t : { ...t, swFrom: null, swBank: elapsedOf(t, now) };
  if (t.endsAt === null) return t;
  return { ...t, endsAt: null, left: leftOf(t, now) };
}

export function reset(t: Timer): Timer {
  if (t.mode === "stopwatch") return { ...t, swFrom: null, swBank: 0, laps: [] };
  return { ...t, endsAt: null, left: null };
}

export function lap(t: Timer, now: number): Timer {
  if (t.mode !== "stopwatch" || !isActive(t)) return t;
  return { ...t, laps: [...t.laps, elapsedOf(t, now)].slice(-99) };
}

/** What comes after this phase of the focus cycle. */
export function nextPhase(t: Timer): { phase: Phase; round: number } {
  if (t.phase !== "focus") return { phase: "focus", round: t.phase === "long" ? 1 : t.round + 1 };
  return { phase: t.round >= t.settings.rounds ? "long" : "short", round: t.round };
}

/**
 * The countdown reached zero (or was skipped). Focus mode moves to the next phase, counting a finished
 * focus round for today, and starts it straight away if auto-start is on. The plain timer goes idle.
 */
export function finish(t: Timer, now: number, { skipped = false } = {}): Timer {
  if (t.mode === "timer") return { ...t, endsAt: null, left: null };
  if (t.mode !== "focus") return t;
  const tally = { ...t.tally };
  if (t.phase === "focus" && !skipped) {
    const day = dayKey(now);
    tally[day] = (tally[day] ?? 0) + 1;
  }
  const next = { ...t, ...nextPhase(t), tally, endsAt: null, left: null };
  return t.settings.autoStart && !skipped ? start(next, now) : next;
}

/** Switch mode. A countdown in progress keeps running only if it stays in its mode. */
export function setMode(t: Timer, mode: Mode): Timer {
  if (mode === t.mode) return t;
  const countdownBusy = t.mode !== "stopwatch" && (t.endsAt !== null || t.left !== null);
  return { ...t, mode, ...(countdownBusy ? { endsAt: null, left: null } : {}) };
}

export function setTimerLength(t: Timer, minutes: number): Timer {
  const timerMin = Math.min(600, Math.max(1, Math.round(minutes)));
  return { ...t, mode: "timer", timerMin, endsAt: null, left: null };
}

export function setSettings(t: Timer, patch: Partial<TimerSettings>): Timer {
  const settings = TimerSettingsSchema.parse({ ...t.settings, ...patch });
  // A new length applies to an idle countdown at once; one under way keeps its own end.
  return { ...t, settings };
}

export function todayTally(t: Timer, now: number): number {
  return t.tally[dayKey(now)] ?? 0;
}

/** "mm:ss", or "h:mm:ss" from an hour up. */
export function formatClock(ms: number, { tenths = false } = {}): string {
  const total = tenths ? Math.floor(ms / 100) : Math.ceil(ms / 1000);
  const s = tenths ? Math.floor(total / 10) : total;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mmss = `${String(m).padStart(h ? 2 : 1, "0")}:${String(sec).padStart(2, "0")}`;
  return `${h ? `${h}:` : ""}${mmss}${tenths ? `.${total % 10}` : ""}`;
}

export const PHASE_NAME: Record<Phase, string> = { focus: "Focus", short: "Short break", long: "Long break" };

/* ---------- The stored state ---------- */

let cacheRaw: string | null | undefined;
let cache: Timer = freshTimer();

/** The timer as stored (a stable object between changes, for useSyncExternalStore). */
export function readTimer(): Timer {
  const raw = getRaw(TIMER_KEY);
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try {
      cache = raw ? TimerSchema.parse(JSON.parse(raw)) : freshTimer();
    } catch {
      cache = freshTimer();
    }
  }
  return cache;
}

export function writeTimer(t: Timer) {
  setRaw(TIMER_KEY, JSON.stringify(t));
}

export function updateTimer(fn: (t: Timer) => Timer) {
  const before = readTimer();
  const after = fn(before);
  if (after !== before) writeTimer(after);
}
