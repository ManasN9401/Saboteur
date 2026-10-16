"use client";
/* eslint-disable @next/next/no-img-element -- pre-sized pin art */

import { useEffect, useState } from "react";
import { reducedMotion } from "@/lib/prefs";
import { BADGE_BY_ID, badgeArt } from "@/lib/progress/badges";
import { addDays, weekday } from "@/lib/progress/day";
import type { ProgressDelta } from "@/lib/progress/events";
import { takeDelta } from "@/lib/progress/record";
import { xpFor } from "@/lib/progress/xp";
import { useActiveProfile, useStats } from "@/lib/useStore";
import { Cross } from "./PenMarks";

const NOTES: Record<NonNullable<ProgressDelta["skipped"]>, string> = {
  "already-counted": "",
  replay: "Replays are for revision: no XP this time.",
  "daily-replay": "You've already filed today's daily case: this one is for practice.",
  clock: "Your device clock looks wrong, so this case earns no progress.",
};

/**
 * What a closed case earned, slid up from the bottom once the verdict is in: XP filling the bar, the
 * pen crossing off today on a mini calendar, and any badges. About two seconds; click to skip.
 */
export function ProgressStrip({ roundId, play }: { roundId: string; play: boolean }) {
  const [delta] = useState(() => takeDelta(roundId));
  const stats = useStats();
  const profile = useActiveProfile();
  const [phase, setPhase] = useState(0); // 0 hidden, 1 shown, 2 bar filling, 3 crossed off, 4 badges, 5 done
  const [closed, setClosed] = useState(false);
  const [xpShown, setXpShown] = useState(0);

  useEffect(() => {
    if (!play || !delta) return;
    const skip = reducedMotion();
    const steps = skip ? [[0, 5]] : [[0, 1], [350, 2], [1250, 3], [1650, 4], [2400, 5]];
    const timers = steps.map(([ms, p]) => window.setTimeout(() => setPhase(p), ms));
    let raf = 0;
    if (!skip) {
      const t0 = performance.now() + 350;
      const tick = (now: number) => {
        const k = Math.max(0, Math.min(1, (now - t0) / 900));
        setXpShown(Math.round(delta.xp * (1 - (1 - k) ** 3)));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    return () => {
      timers.forEach(window.clearTimeout);
      cancelAnimationFrame(raf);
    };
  }, [play, delta]);

  if (!delta || closed || (delta.skipped === "already-counted")) return null;
  const finish = () => {
    setPhase(5);
    setXpShown(delta.xp);
  };
  const shown = phase >= 1;
  const xp = phase >= 5 ? delta.xp : xpShown;

  if (delta.skipped)
    return (
      <aside className="pstrip paper" data-shown={shown} role="status">
        <p className="m-0 text-[15.5px]">{NOTES[delta.skipped]}</p>
        <button type="button" className="pstrip__close" onClick={() => setClosed(true)} aria-label="Close">
          ×
        </button>
      </aside>
    );

  // The bar: within the old level until it fills; a level-up fills it and turns the page.
  const levelled = delta.levelAfter > delta.levelBefore;
  const level = phase >= 2 && levelled ? delta.levelAfter : delta.levelBefore;
  const frac = (x: number, l: number) => Math.min(1, Math.max(0, (x - xpFor(l)) / (xpFor(l + 1) - xpFor(l))));
  const width = phase < 2 ? frac(delta.xpBefore, delta.levelBefore) : levelled ? frac(delta.xpAfter, delta.levelAfter) : frac(delta.xpAfter, delta.levelBefore);
  const promoted = delta.rankAfter !== delta.rankBefore;

  // This week, Monday first, with the days already played crossed off.
  const monday = addDays(delta.day, -((weekday(delta.day) + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const s = delta.streak;
  const streakLine = s.repaired
    ? `Streak repaired: ${s.after} days`
    : s.frozen.length
      ? `A freeze covered ${s.frozen.length === 1 ? "a missed day" : `${s.frozen.length} missed days`}: ${s.after}-day streak`
      : s.broke
        ? "A new streak starts today"
        : s.extended
          ? `${s.after}-day streak`
          : `${s.after}-day streak · today already counted`;

  return (
    <aside className="pstrip paper" data-shown={shown} data-phase={phase} onClick={finish} aria-label="Progress from this case">
      <div className="pstrip__xp">
        <p className="display m-0 text-[40px] leading-none">+{xp}</p>
        <p className="label m-0">XP</p>
      </div>

      <div className="pstrip__bar">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-ink-soft">
            Level {level} · {phase >= 2 ? delta.rankAfter : delta.rankBefore}
          </span>
          <span className="truncate text-[13px] text-ink-faint">{delta.parts.map((p) => `${p.label} +${p.xp}`).join(" · ")}</span>
        </div>
        <div className="xpbar mt-2">
          <span style={{ width: `${width * 100}%` }} />
        </div>
      </div>

      {(profile?.prefs.showStreak ?? true) && (
        <div className="pstrip__week">
          <div className="pstrip__days" aria-hidden="true">
            {week.map((d, i) => {
              const today = d === delta.day;
              const before = !today && (stats?.days[d] ?? 0) > 0;
              return (
                <span key={d} className="pstrip__day" data-today={today || undefined}>
                  <i>{"MTWTFSS"[i]}</i>
                  {before && <Cross seed={i + 3} className="pstrip__cross" />}
                  {today && phase >= 3 && <Cross seed={i + 3} className="pstrip__cross pstrip__cross--draw" />}
                </span>
              );
            })}
          </div>
          <p className="m-0 mt-1 text-[13px]">
            {streakLine}
            {s.freezeEarned ? " · freeze earned" : ""}
          </p>
        </div>
      )}

      {delta.badges.length > 0 && (
        <ul className="pstrip__badges" aria-label="Badges earned">
          {delta.badges.map((id, i) => (
            <li key={id} data-in={phase >= 4} style={{ transitionDelay: `${i * 120}ms` }} title={BADGE_BY_ID[id]?.description}>
              <img src={badgeArt(id)} alt="" width={52} height={52} />
              <span>{BADGE_BY_ID[id]?.name ?? id}</span>
            </li>
          ))}
        </ul>
      )}

      {promoted && phase >= 2 && (
        <span className="pstrip__promoted stamp-mark" aria-live="polite">
          Promoted
          <small>{delta.rankAfter}</small>
        </span>
      )}

      <button
        type="button"
        className="pstrip__close"
        onClick={(e) => {
          e.stopPropagation();
          setClosed(true);
        }}
        aria-label="Close"
      >
        ×
      </button>
    </aside>
  );
}
