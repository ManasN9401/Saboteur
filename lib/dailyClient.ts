// Browser side of the daily case: what today's case is, and opening it.
import type { DailyInfo } from "./daily";
import { dayKey } from "./progress/day";
import type { GenerateEvent, Round } from "./schemas";
import { store } from "./store";

export type { DailyInfo };

/** Today's date where the player is: their daily case changes at their midnight. */
export const today = () => dayKey(new Date());

export async function fetchDailyInfo(date = today(), signal?: AbortSignal): Promise<DailyInfo | null> {
  try {
    const res = await fetch(`/api/daily?date=${date}`, { signal });
    return res.ok ? ((await res.json()) as DailyInfo) : null;
  } catch {
    return null;
  }
}

/** Build (or rebuild) the daily case on the server and save it here. It is offline and instant. */
export async function openDaily(date = today()): Promise<Round> {
  const res = await fetch("/api/saboteur/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: "Daily case", level: "A-level / high school", difficulty: "subtle", daily: date }),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "The daily case couldn't be opened.");
  for (const line of (await res.text()).split("\n")) {
    if (!line.trim()) continue;
    const event = JSON.parse(line) as GenerateEvent;
    if (event.type === "error") throw new Error(event.message);
    if (event.type === "done") {
      // Keep any progress already made on today's case (a reopened tab), only add what's missing.
      if (!store.getRound(event.round.id)) store.saveRound(event.round, undefined, { daily: date });
      return event.round;
    }
  }
  throw new Error("The daily case couldn't be opened.");
}
