"use client";

import { useMemo } from "react";
import { dayKey } from "@/lib/progress/day";
import { FREEZE_EVERY, liveStreak, MILESTONES } from "@/lib/progress/streak";
import { useActiveProfile, useRounds, useStats } from "@/lib/useStore";
import { Cross, Ring, Snowflake } from "./PenMarks";

// Geometry of public/assets/props/calendar.webp (760 × 629): the 7 × 5 day grid and the title line.
const GRID = { x: 40, y: 192, pitchX: 98, pitchY: 79.6, w: 89, h: 71 };
const TITLE = { x: 432, y: 76, w: 285, h: 31 };
const IMG = { w: 760, h: 629 };

const pct = (v: number, of: number) => `${(v / of) * 100}%`;
const key = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * The flip calendar on the desk: this month, with a red-pen cross on every day a case was closed,
 * a stamped snowflake where a streak freeze covered a day, a dot for daily cases, and today ringed.
 * Hovering it shows the streak. Days that don't fit five rows wrap into the empty boxes of the first row, the
 * way printed calendars do.
 */
export function DeskCalendar() {
  const rounds = useRounds();
  const stats = useStats();
  const profile = useActiveProfile();
  const [now] = useMemo(() => [new Date()], []);
  const year = now.getFullYear();
  const month = now.getMonth();

  // Days with a closed case: the profile's day log, plus any saved rounds older than the log.
  const played = useMemo(() => {
    const days = new Set<string>(Object.keys(stats?.days ?? {}));
    for (const r of Object.values(rounds ?? {})) if (r.result && r.playedAt) days.add(dayKey(r.playedAt));
    return days;
  }, [rounds, stats]);
  const frozen = useMemo(() => new Set(stats?.streak.frozenDays ?? []), [stats]);
  const dailies = stats?.daily ?? {};
  const showStreak = profile?.prefs.showStreak ?? true;
  const streak = stats ? liveStreak(stats.streak, dayKey(now), profile?.prefs.restDays ?? []) : null;
  const toFreeze = streak ? FREEZE_EVERY - (streak.current % FREEZE_EVERY) : FREEZE_EVERY;
  const nextMilestone = streak ? MILESTONES.find((m) => m > streak.current) : undefined;
  const tip =
    showStreak && streak
      ? `${streak.current}-day streak${stats!.streak.freezes ? ` · ${stats!.streak.freezes} freeze${stats!.streak.freezes === 1 ? "" : "s"} saved` : ""} · next freeze in ${toFreeze} day${toFreeze === 1 ? "" : "s"}${nextMilestone ? ` · ${nextMilestone}-day milestone next` : ""}`
      : undefined;

  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const length = new Date(year, month + 1, 0).getDate();
  const monthName = first.toLocaleDateString("en-GB", { month: "long" });
  const closed = Array.from({ length }, (_, i) => played.has(key(year, month, i + 1))).filter(Boolean).length;

  return (
    <figure className="desk-cal" title={tip} aria-label={`${monthName}: ${closed} ${closed === 1 ? "day" : "days"} with a closed case${tip ? `. ${tip}` : ""}`}>
      <span className="desk-cal__title" style={{ left: pct(TITLE.x, IMG.w), top: pct(TITLE.y, IMG.h), width: pct(TITLE.w, IMG.w), height: pct(TITLE.h, IMG.h) }} aria-hidden="true">
        {monthName}
      </span>
      {Array.from({ length }, (_, i) => {
        const day = i + 1;
        let cell = offset + i;
        if (cell >= 35) cell -= 35; // wrap the overflow into the first row's empty boxes
        const col = cell % 7;
        const row = Math.floor(cell / 7);
        const isToday = day === now.getDate();
        const k = key(year, month, day);
        const wasPlayed = played.has(k);
        return (
          <span
            key={day}
            className="desk-cal__day"
            data-today={isToday || undefined}
            style={{ left: pct(GRID.x + col * GRID.pitchX, IMG.w), top: pct(GRID.y + row * GRID.pitchY, IMG.h), width: pct(GRID.w, IMG.w), height: pct(GRID.h, IMG.h) }}
            aria-hidden="true"
          >
            <i>{day}</i>
            {wasPlayed && <Cross seed={day} className="desk-cal__mark" />}
            {!wasPlayed && frozen.has(k) && <Snowflake className="desk-cal__frost" />}
            {dailies[k] && <span className="desk-cal__daily" />}
            {isToday && <Ring className="desk-cal__ring" />}
          </span>
        );
      })}
    </figure>
  );
}
