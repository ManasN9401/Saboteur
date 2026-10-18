"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { boxStyle, CAL, marginStyle, propSrc, SHADOWS, useDeskProp, VERSIONS } from "@/lib/deskProps";
import { dayKey } from "@/lib/progress/day";
import { FREEZE_EVERY, liveStreak, MILESTONES } from "@/lib/progress/streak";
import type { RoundRecord } from "@/lib/store";
import { useActiveProfile, useRounds, useStats } from "@/lib/useStore";
import { Cross, Ring, Snowflake } from "./PenMarks";
import { useRedactedNavigate } from "./RedactionTransition";

// Geometry of the calendar texture (assets-src/props/calendar.webp, 760 × 629, the top of the lit block): the 7 × 5 day grid, the title lines,
// the blank top-left corner (where the streak is written) and the ring band across the top.
const GRID = { x: 40, y: 192, pitchX: 98, pitchY: 79.6, w: 89, h: 71 };
const TITLE = { x: 432, y: 76, w: 285, h: 31 };
const CORNER = { x: 44, y: 84, w: 360, h: 92 };
const IMG = { w: 760, h: 629 };
/** How far back the pages go. */
const MONTHS_BACK = 11;

const pct = (v: number, of: number) => `${(v / of) * 100}%`;
const key = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const monthIndex = (y: number, m: number) => y * 12 + m;

interface DayInfo {
  key: string;
  date: Date;
  rounds: RoundRecord[];
  /** Cases counted that day, including ones no longer kept in the archive. */
  count: number;
  frozen: boolean;
  daily: boolean;
}

type Flip = { from: number; dir: 1 | -1 } | null;

/**
 * The flip calendar on the desk. The block itself is composited into each desk photo's own light
 * (scripts/assets/desk_props.py, lib/deskProps.ts) and drawn under the scrim with the photo, so it sits
 * on the desk like the clock and the mug. Everything written on it is multiplied onto that lit paper,
 * so the ink takes the same light. It's a working calendar:
 * - a red-pen cross on every day a case was closed, a stamped snowflake where a streak freeze covered
 *   a day, a dot for daily cases, today ringed, and the streak written in pen in the corner;
 * - click (or Enter on) any day for a note tucked under it: that day's cases, with links to the verdicts;
 * - flip back through the last year's pages (the ‹ › by the month, or Page Up / Page Down).
 * What you see is drawn on the desk; what you click is a matching invisible layer above the scrim.
 */
export function DeskCalendar() {
  const rounds = useRounds();
  const stats = useStats();
  const profile = useActiveProfile();
  const navigate = useRedactedNavigate();
  const [now] = useState(() => new Date());
  const today = dayKey(now);
  const thisMonth = monthIndex(now.getFullYear(), now.getMonth());
  const [shown, setShown] = useState(thisMonth);
  const [flip, setFlip] = useState<Flip>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [focusDay, setFocusDay] = useState(now.getDate());
  const [hover, setHover] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const { host, layout } = useDeskProp(CAL);

  // Everything known about each day: rounds closed (from the archive) and the profile's day log.
  const days = useMemo(() => {
    const map = new Map<string, { rounds: RoundRecord[]; count: number }>();
    for (const r of Object.values(rounds ?? {})) {
      if (!r.result || !r.playedAt) continue;
      const k = dayKey(r.playedAt);
      const entry = map.get(k) ?? { rounds: [], count: 0 };
      entry.rounds.push(r);
      map.set(k, entry);
    }
    for (const [k, n] of Object.entries(stats?.days ?? {})) {
      const entry = map.get(k) ?? { rounds: [], count: 0 };
      entry.count = Math.max(n, entry.rounds.length);
      map.set(k, entry);
    }
    for (const entry of map.values()) {
      entry.count = Math.max(entry.count, entry.rounds.length);
      entry.rounds.sort((a, b) => (a.playedAt ?? "").localeCompare(b.playedAt ?? ""));
    }
    return map;
  }, [rounds, stats]);
  const frozen = useMemo(() => new Set(stats?.streak.frozenDays ?? []), [stats]);
  const dailies = stats?.daily ?? {};

  const info = (y: number, m: number, d: number): DayInfo => {
    const k = key(y, m, d);
    const entry = days.get(k);
    return { key: k, date: new Date(y, m, d), rounds: entry?.rounds ?? [], count: entry?.count ?? 0, frozen: frozen.has(k), daily: !!dailies[k] };
  };

  const showStreak = profile?.prefs.showStreak ?? true;
  const streak = stats ? liveStreak(stats.streak, today, profile?.prefs.restDays ?? []) : null;
  const toFreeze = streak ? FREEZE_EVERY - (streak.current % FREEZE_EVERY) : FREEZE_EVERY;
  const nextMilestone = streak ? MILESTONES.find((m) => m > streak.current) : undefined;

  const goMonth = (dir: 1 | -1) => {
    const next = shown + dir;
    if (next > thisMonth || next < thisMonth - MONTHS_BACK || flip) return;
    setOpen(null);
    setFlip({ from: shown, dir });
    setShown(next);
    setFocusDay(1);
  };

  // A note closes on Escape or a click anywhere else.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const y = Math.floor(shown / 12);
  const m = shown % 12;
  const monthName = new Date(y, m, 1).toLocaleDateString("en-GB", { month: "long", year: y === now.getFullYear() ? undefined : "numeric" });
  const length = new Date(y, m + 1, 0).getDate();
  const closedDays = Array.from({ length }, (_, i) => info(y, m, i + 1).count > 0).filter(Boolean).length;

  // Keyboard on the day grid: arrows move, Page Up / Down flip months, Enter opens the note.
  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
    if (e.key in moves) {
      e.preventDefault();
      e.stopPropagation();
      const d = Math.min(length, Math.max(1, focusDay + moves[e.key]));
      setFocusDay(d);
      root.current?.querySelector<HTMLButtonElement>(`[data-day="${d}"]`)?.focus();
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      goMonth(e.key === "PageUp" ? -1 : 1);
    }
  };

  // "leaving": the old page lifting away (flipping forward); "under": the old page lying beneath while
  // the earlier one drops onto it (flipping back). The hit layer only has the live page, without ink.
  const page = (month: number, role: "live" | "leaving" | "under", hit = false) => {
    const py = Math.floor(month / 12);
    const pm = month % 12;
    const first = new Date(py, pm, 1);
    const offset = (first.getDay() + 6) % 7; // Monday first
    const len = new Date(py, pm + 1, 0).getDate();
    const live = role === "live";
    const turn = (dir: 1 | -1) => {
      const disabled = dir === -1 ? month <= thisMonth - MONTHS_BACK : month >= thisMonth;
      return hit ? (
        <button type="button" className="desk-cal__turn" onClick={() => goMonth(dir)} disabled={disabled} aria-label={dir === -1 ? "Previous month" : "Next month"}>
          {dir === -1 ? "‹" : "›"}
        </button>
      ) : (
        <span className="desk-cal__turn" data-disabled={disabled || undefined}>
          {live ? (dir === -1 ? "‹" : "›") : ""}
        </span>
      );
    };
    return (
      <div
        className="desk-cal__page"
        data-role={role}
        data-arriving={(!hit && live && flip?.dir === -1) || undefined}
        key={`${role}-${month}`}
        onAnimationEnd={hit ? undefined : (e) => e.target === e.currentTarget && (role === "leaving" || (live && flip?.dir === -1)) && setFlip(null)}
      >
        <span className="desk-cal__title" style={{ left: pct(TITLE.x, IMG.w), top: pct(TITLE.y, IMG.h), width: pct(TITLE.w, IMG.w), height: pct(TITLE.h, IMG.h) }}>
          {turn(-1)}
          <span>{first.toLocaleDateString("en-GB", { month: "long", year: py === now.getFullYear() ? undefined : "numeric" })}</span>
          {turn(1)}
        </span>
        {!hit && live && month === thisMonth && showStreak && streak && (
          <span className="desk-cal__streak" style={{ left: pct(CORNER.x, IMG.w), top: pct(CORNER.y, IMG.h), width: pct(CORNER.w, IMG.w), height: pct(CORNER.h, IMG.h) }}>
            <b>{streak.current ? `${streak.current}-day streak` : "No streak yet"}</b>
            <small>
              {stats!.streak.freezes ? `❄ ×${stats!.streak.freezes} · ` : ""}
              {streak.atRisk ? "play today to keep it" : nextMilestone ? `${nextMilestone} next · freeze in ${toFreeze}` : `freeze in ${toFreeze}`}
            </small>
          </span>
        )}
        <div className="desk-cal__grid" role={hit ? "grid" : undefined} aria-label={hit ? `${monthName}: ${closedDays} ${closedDays === 1 ? "day" : "days"} with a closed case` : undefined} onKeyDown={hit ? onGridKey : undefined}>
          {Array.from({ length: len }, (_, i) => {
            const day = i + 1;
            let cell = offset + i;
            if (cell >= 35) cell -= 35; // wrap the overflow into the first row's empty boxes, as printed calendars do
            const col = cell % 7;
            const row = Math.floor(cell / 7);
            const d = info(py, pm, day);
            const isToday = d.key === today;
            const future = d.key > today;
            const style = { left: pct(GRID.x + col * GRID.pitchX, IMG.w), top: pct(GRID.y + row * GRID.pitchY, IMG.h), width: pct(GRID.w, IMG.w), height: pct(GRID.h, IMG.h) };
            if (!hit)
              return (
                <span key={day} className="desk-cal__day" data-future={future || undefined} data-hover={(live && (hover === day || open === d.key)) || undefined} style={style}>
                  <i>{day}</i>
                  {d.count > 0 && <Cross seed={day} className="desk-cal__mark" />}
                  {d.count > 2 && <Cross seed={day + 40} className="desk-cal__mark desk-cal__mark--2" />}
                  {!d.count && d.frozen && <Snowflake className="desk-cal__frost" />}
                  {d.daily && <span className="desk-cal__daily" />}
                  {isToday && <Ring className="desk-cal__ring" />}
                </span>
              );
            if (future) return null;
            const label = `${d.date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}: ${d.count ? `${d.count} ${d.count === 1 ? "case" : "cases"} closed` : d.frozen ? "covered by a streak freeze" : "no cases"}${d.daily ? ", daily case filed" : ""}`;
            return (
              <button
                key={day}
                type="button"
                className="desk-cal__day"
                data-day={day}
                data-today={isToday || undefined}
                data-open={open === d.key || undefined}
                style={style}
                tabIndex={day === focusDay ? 0 : -1}
                aria-label={label}
                aria-expanded={open === d.key}
                onFocus={() => setFocusDay(day)}
                onPointerEnter={() => setHover(day)}
                onPointerLeave={() => setHover((h) => (h === day ? null : h))}
                onClick={() => setOpen(open === d.key ? null : d.key)}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const note = (() => {
    if (!open) return null;
    const [ny, nm, nd] = open.split("-").map(Number);
    const d = info(ny, nm - 1, nd);
    const missing = d.count - d.rounds.length;
    return (
      <div className="desk-cal__note paper" role="dialog" aria-label={d.date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}>
        <button type="button" className="desk-cal__note-close" onClick={() => setOpen(null)} aria-label="Close">
          ×
        </button>
        <p className="desk-cal__note-date hand">{d.date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</p>
        {d.rounds.length > 0 && (
          <ul>
            {d.rounds.map((r) => (
              <li key={r.round.id}>
                <button type="button" onClick={() => navigate(`/results/${r.round.id}`, "VERDICT")}>
                  <b>{r.round.topic}</b>
                  <span>
                    {r.result!.score} / {r.result!.maxScore}
                    {r.daily ? " · daily" : r.replayOf ? " · replay" : ""} · {r.round.difficulty}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {missing > 0 && (
          <p className="desk-cal__note-line">
            {d.rounds.length ? `+ ${missing} more` : `${missing} ${missing === 1 ? "case" : "cases"} closed`}, no longer in the archive.
          </p>
        )}
        {!d.count && d.frozen && <p className="desk-cal__note-line">❄ A streak freeze covered this day.</p>}
        {!d.count && !d.frozen && d.key === today && (
          <>
            <p className="desk-cal__note-line">Nothing filed yet today.</p>
            <button type="button" className="btn btn--pen btn--small mt-2" onClick={() => navigate("/play", "NEW CASE FILE")}>
              Open a case
            </button>
          </>
        )}
        {!d.count && !d.frozen && d.key !== today && <p className="desk-cal__note-line">No cases this day.</p>}
      </div>
    );
  })();

  const tip = showStreak && streak ? `${streak.current}-day streak · next freeze in ${toFreeze} day${toFreeze === 1 ? "" : "s"}` : undefined;
  if (!layout?.shown) return null;
  return (
    <>
      {host &&
        createPortal(
          <>
            {VERSIONS.map((v) => (
              // eslint-disable-next-line @next/next/no-img-element -- a light layer, already sized
              <img key={v} className="desk-prop-shadow desk-prop-v" data-v={v} src={propSrc("cal-shadow", v)} alt="" style={boxStyle(SHADOWS[v].cal)} />
            ))}
            <div className="desk-cal" style={layout.frame.style} data-flipping={flip ? flip.dir : undefined} aria-hidden="true">
              <div className="desk-cal__pad">
                {VERSIONS.map((v) => (
                  // eslint-disable-next-line @next/next/no-img-element -- the lit block, already sized
                  <img key={v} className="desk-cal__block desk-prop-v" data-v={v} src={propSrc("cal", v)} alt="" style={marginStyle(CAL)} />
                ))}
                {/* Flipping forward, the old page lifts away over the rings; flipping back, the earlier page drops onto this one. */}
                {flip?.dir === -1 && page(flip.from, "under")}
                {page(shown, "live")}
                {flip?.dir === 1 && page(flip.from, "leaving")}
              </div>
            </div>
          </>,
          host,
        )}
      {layout.usable && (
        <div className="desk-cal-hit" ref={root} style={layout.frame.style} title={open ? undefined : tip}>
          {page(shown, "live", true)}
          {note}
        </div>
      )}
    </>
  );
}
