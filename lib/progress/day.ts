// Calendar days in the player's own time zone. Streaks count local days, and a day is a date, never
// "24 hours", so clocks changing for summer time can't break or extend anything.

/** "yyyy-mm-dd" for an instant, in a time zone (default: this device's). */
export function dayKey(instant: Date | string | number, tz?: string): string {
  const d = new Date(instant);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The local hour (0–23) of an instant in a time zone. */
export function localHour(instant: Date | string | number, tz?: string): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(new Date(instant));
  return Number(h) % 24;
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** A day as a whole number (days since 1970-01-01), for exact day arithmetic. */
export function dayNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function fromDayNumber(n: number): string {
  return new Date(n * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

export function addDays(key: string, n: number): string {
  return fromDayNumber(dayNumber(key) + n);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(key: string): number {
  return new Date(dayNumber(key) * 86_400_000).getUTCDay();
}

export const monthOf = (key: string) => key.slice(0, 7);
