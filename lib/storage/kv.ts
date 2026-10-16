// The one place that touches localStorage. Every read and write is wrapped: storage can be full,
// blocked or missing (private mode, server rendering). Reads are parsed with Zod; a blob that doesn't
// parse is moved aside to `<key>:corrupt:<time>` and reported, never thrown.
import type { z } from "zod";

function area(kind: "local" | "session" = "local"): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/* ---------- Change notifications, for useSyncExternalStore ---------- */
const listeners = new Set<() => void>();
let quiet = 0;
export function notify() {
  if (!quiet) listeners.forEach((l) => l());
}
/** Run writes without notifying (boot-time migration runs while React is rendering). */
export function silently<T>(fn: () => T): T {
  quiet++;
  try {
    return fn();
  } finally {
    quiet--;
  }
}
export function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => (e.key === null || e.key.startsWith("saboteur:")) && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getRaw(key: string, kind: "local" | "session" = "local"): string | null {
  try {
    return area(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function setRaw(key: string, value: string, kind: "local" | "session" = "local"): boolean {
  const store = area(kind);
  if (!store) return false;
  try {
    store.setItem(key, value);
    if (kind === "local") notify();
    return true;
  } catch {
    return false;
  }
}

export function remove(key: string, kind: "local" | "session" = "local") {
  try {
    area(kind)?.removeItem(key);
    if (kind === "local") notify();
  } catch {
    /* nothing to clean up */
  }
}

export function keys(prefix = ""): string[] {
  const store = area();
  if (!store) return [];
  const out: string[] = [];
  try {
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k !== null && k.startsWith(prefix)) out.push(k);
    }
  } catch {
    /* unreadable: treat as empty */
  }
  return out;
}

export function write(key: string, value: unknown): boolean {
  return setRaw(key, JSON.stringify(value));
}

/** Parse a raw blob. Returns undefined if it is missing, null if it is unreadable. */
export function parse<S extends z.ZodType>(raw: string | null, schema: S): z.output<S> | undefined | null {
  if (raw === null) return undefined;
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function quarantine(key: string, raw: string, why: string) {
  console.warn(`[saboteur] ${key} could not be read (${why}); kept a copy and started fresh.`);
  silently(() => {
    setRaw(`${key}:corrupt:${Date.now()}`, raw);
    remove(key);
  });
}

/** Read and validate one key. A corrupt value is quarantined and the fallback returned. */
export function read<S extends z.ZodType, F = z.output<S>>(key: string, schema: S, fallback: F): z.output<S> | F {
  const raw = getRaw(key);
  const value = parse(raw, schema);
  if (value === undefined) return fallback;
  if (value === null) {
    quarantine(key, raw!, "failed validation");
    return fallback;
  }
  return value;
}
