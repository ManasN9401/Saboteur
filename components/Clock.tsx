"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { onOpenClock, openClock } from "@/lib/events";
import { HAND, handAngles, handScale, type HandArt } from "@/lib/clockHands";
import { plateToScreen } from "@/lib/desk";
import { reducedMotion } from "@/lib/prefs";
import { ringBell, tick, unlockSound } from "@/lib/sound";
import { subscribe } from "@/lib/storage/kv";
import {
  elapsedOf,
  finish,
  formatClock,
  freshTimer,
  isActive,
  isRunning,
  lap,
  leftOf,
  lengthOf,
  MODES,
  pause,
  PHASE_NAME,
  readTimer,
  reset,
  setMode,
  setSettings,
  setTimerLength,
  start,
  todayTally,
  updateTimer,
  writeTimer,
  type Mode,
  type Timer,
  type TimerSettings,
} from "@/lib/timer";
import { toast } from "@/lib/toast";

const SERVER = freshTimer();
export function useTimer(): Timer {
  return useSyncExternalStore(subscribe, readTimer, () => SERVER);
}

/**
 * The time now, refreshed every `every` ms (or not at all when null). 0 while prerendering: the time is
 * only ever read in the browser.
 */
export function useNow(every: number | null): number {
  const sub = useCallback(
    (cb: () => void) => {
      if (every === null) return () => {};
      const id = window.setInterval(cb, every);
      return () => window.clearInterval(id);
    },
    [every],
  );
  // Read to the tenth of a second, so a re-render for another reason (a timer starting) is never stale.
  return useSyncExternalStore(sub, () => Math.floor(Date.now() / 100) * 100, () => 0);
}

const MODE_NAME: Record<Mode, string> = { focus: "Focus", timer: "Timer", stopwatch: "Stopwatch" };
const TITLE_PREFIX = /^[\d:]+ (Focus|Short break|Long break|Timer) · /;
const PRESETS = [5, 10, 15, 25, 45, 60];

function label(t: Timer) {
  return t.mode === "focus" ? PHASE_NAME[t.phase] : MODE_NAME[t.mode];
}

/** What to say when a countdown ends. */
function endMessage(before: Timer, after: Timer): string {
  if (before.mode === "timer") return `Time's up: ${before.timerMin} min.`;
  if (before.phase === "focus") return after.phase === "long" ? `${before.settings.rounds} rounds done. Long break: ${before.settings.long} min.` : `Focus round done. Take ${before.settings.short}.`;
  return "Break's over. Back to it.";
}

/** The alarm goes off: the bell (if wanted), and the clock shakes for as long as it rings. */
function ring(sound: boolean) {
  if (sound) ringBell();
  const root = document.documentElement;
  root.dataset.ringing = "";
  window.setTimeout(() => delete root.dataset.ringing, 2800);
}

/**
 * Runs the timers for the whole app (mounted once, in the layout): rings and moves the focus cycle on
 * when a countdown ends, puts the time left in the tab's title, ticks if asked, and shows a small
 * chip in the corner while anything is under way, so it can be checked or paused from any page.
 */
export function TimerService() {
  const t = useTimer();
  const counting = t.mode !== "stopwatch" && t.endsAt !== null;
  const now = useNow(isActive(t) ? (isRunning(t) ? 250 : 1000) : null);

  // The end of a countdown. Several tabs may be open: only the first to see it still due acts.
  useEffect(() => {
    if (t.mode === "stopwatch" || t.endsAt === null) return;
    const endsAt = t.endsAt;
    const fire = () => {
      const before = readTimer();
      if (before.endsAt !== endsAt) return;
      const at = Date.now();
      // Ended while the app was closed: move on, but don't ring late or start the next phase unseen.
      const late = at - endsAt > 5000;
      let after = finish(before, late ? at : endsAt);
      if (late && isRunning(after)) after = pause(after, at);
      writeTimer(after);
      const message = (late ? "While you were away: " : "") + endMessage(before, after);
      toast(message, { tone: "info", ms: 7000 });
      if (!late) ring(before.settings.sound);
      if (before.settings.notify && document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification("Saboteur", { body: message, tag: "saboteur-timer" });
        } catch {
          /* notifications unavailable here */
        }
      }
    };
    const id = window.setTimeout(fire, Math.max(0, endsAt - Date.now()) + 30);
    return () => window.clearTimeout(id);
  }, [t.mode, t.endsAt]);

  // The time left in the tab title, and the optional tick while focusing.
  useEffect(() => {
    if (!counting) return;
    const update = () => {
      const cur = readTimer();
      const base = document.title.replace(TITLE_PREFIX, "");
      document.title = `${formatClock(leftOf(cur, Date.now()))} ${label(cur)} · ${base}`;
      if (cur.settings.tick && cur.mode === "focus" && cur.phase === "focus" && !document.hidden) tick();
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => {
      window.clearInterval(id);
      document.title = document.title.replace(TITLE_PREFIX, "");
    };
  }, [counting, t.phase, t.mode]);

  if (!isActive(t)) return null;
  const value = t.mode === "stopwatch" ? formatClock(elapsedOf(t, now)) : formatClock(leftOf(t, now));
  const running = isRunning(t);
  return (
    <button type="button" className="timer-chip paper" data-running={running || undefined} data-phase={t.mode === "focus" ? t.phase : t.mode} onClick={() => openClock()} aria-label={`${label(t)}: ${value}${running ? "" : ", paused"}. Open the clock`}>
      <i aria-hidden="true" />
      <span>{label(t)}</span>
      <b>{value}</b>
    </button>
  );
}

/** Tally marks in pen: four strokes, the fifth across them. */
function Tally({ n }: { n: number }) {
  const groups = Array.from({ length: Math.floor(n / 5) }, (_, i) => <s key={i}>||||</s>);
  return (
    <span className="clock-card__tally-marks hand" aria-hidden="true">
      {groups}
      {"|".repeat(n % 5)}
    </span>
  );
}

function NumberSetting({ name, label: text, value, min, max, onChange }: { name: string; label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="clock-card__num">
      <span>{text}</span>
      <input
        type="number"
        name={name}
        inputMode="numeric"
        min={min}
        max={max}
        defaultValue={value}
        onBlur={(e) => {
          const v = Number(e.currentTarget.value);
          if (Number.isFinite(v) && v >= min && v <= max) onChange(Math.round(v));
          else e.currentTarget.value = String(value);
        }}
      />
    </label>
  );
}

function Toggle({ label: text, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="clock-card__check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span>{text}</span>
    </label>
  );
}

// The close-up of the alarm clock (public/assets/clock/close.webp): the last frame of the camera move
// from the desk (scripts/assets/batch12.py). Its hub (the centre post), and the radius of its minute
// track, in its pixels.
const CLOSE = { w: 1920, h: 1080, hubX: 962.5, hubY: 551.5, track: 305.2 };
// The camera move (public/assets/fx/clock-pan*.{webm,mp4}): its first frame is the night desk photo,
// scaled by `scale` and shifted by (tx, ty) (measured by batch12.py), so it starts exactly on the desk.
const PAN = { w: 1920, h: 1080, scale: 1.3948, tx: 0.1, ty: 4.5 };
// The move plays at night with the lamp on (it starts on that photo); otherwise opening the clock zooms.
export const PAN_ON = true;
/** Seconds the footage takes to fade in over the desk (and away again at the end of the way back). */
const PAN_FADE = 0.5;

interface ViewLayout {
  wide: boolean;
  /** Scale of the close-up photo, and where its hub lands on screen. */
  s: number;
  hubX: number;
  hubY: number;
}

interface Rect {
  left: number;
  top: number;
  width: number;
}

/**
 * Where the close-up sits. Wide screens: the clock fills the left of the screen and the controls sit on
 * the blurred desk to its right. Narrow ones: the clock at the top, the controls below. Either way the
 * photo is scaled up only as far as it must be to fill the screen around the clock.
 */
function viewLayout(vw: number, vh: number): ViewLayout {
  const wide = vw >= 1000 && vw / vh >= 1.2;
  const hubX = wide ? vw * 0.34 : vw / 2;
  const hubY = wide ? vh / 2 : Math.min(vh * 0.3, vw * 0.62);
  const fill = [hubX / CLOSE.hubX, (vw - hubX) / (CLOSE.w - CLOSE.hubX), hubY / CLOSE.hubY];
  if (wide) fill.push((vh - hubY) / (CLOSE.h - CLOSE.hubY));
  const s = Math.max(...fill, wide ? 0 : (vw * 0.42) / CLOSE.track);
  return { wide, s, hubX, hubY };
}

/** The camera move plays on the night desk with the lamp on (it was made from that photo). */
function panRect(): Rect | null {
  const root = document.documentElement;
  if (!PAN_ON || !document.querySelector(".desk-clock-hit") || root.dataset.theme !== "dark" || root.dataset.lamp === "off" || root.dataset.desk === "plain" || reducedMotion()) return null;
  const origin = plateToScreen(-PAN.tx / PAN.scale, -PAN.ty / PAN.scale);
  return { left: origin.x, top: origin.y, width: (PAN.w / PAN.scale) * origin.scale };
}

/** One of the photographed hands, turned about its pivot, which sits on the hub. */
function Hand({ art, scale, angle, className }: { art: HandArt; scale: number; angle: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small fixed pictures, sized here
    <img
      className={className}
      src={art.src}
      alt=""
      draggable={false}
      style={{
        left: -art.px * scale,
        top: -art.py * scale,
        width: art.w * scale,
        height: art.h * scale,
        transformOrigin: `${art.px * scale}px ${art.py * scale}px`,
        transform: `rotate(${angle}deg)`,
      }}
    />
  );
}

/** The live hands on the close-up: hour, minute, ticking seconds, the alarm hand, and the nut over them. */
function CloseHands({ now, alarm, track }: { now: number; alarm: number | null; track: number }) {
  const a = handAngles(now);
  const k = handScale(track);
  return (
    <>
      {alarm !== null && <Hand art={HAND.alarm} scale={k.set} angle={alarm} />}
      <Hand art={HAND.hour} scale={k.set} angle={a.hour} />
      <Hand art={HAND.minute} scale={k.set} angle={a.minute} />
      <Hand art={HAND.second} scale={k.second} angle={a.second} className="clock-view__second" />
      <Hand art={HAND.nut} scale={k.set} angle={0} />
    </>
  );
}

type Stage = "pan-in" | "in" | "settle-out" | "pan-out" | "out";

/**
 * The clock: what the desk clock opens (and the timer chip, on any page). At night on the home desk the
 * camera moves in from the desk to the clock (real footage, aligned with the desk photo) and settles on
 * a close-up of it; elsewhere it zooms or fades in. The close-up has live hands, and the controls sit
 * beside it: the time and date, a focus timer (pomodoro rounds with short and long breaks, counted in
 * tally marks), a plain countdown and a stopwatch. While a countdown runs, the alarm hand marks the
 * minute it will ring, here and on the desk.
 */
export function ClockCard() {
  const [stage, setStage] = useState<Stage | null>(null);
  const [layout, setLayout] = useState<ViewLayout | null>(null);
  const [pan, setPan] = useState<Rect | null>(null);
  // The way back's last half second: the footage fades away as the desk comes back.
  const [leaving, setLeaving] = useState(false);
  const t = useTimer();
  const open = stage === "in";
  // Refresh often enough that the seconds change on time (a countdown's seconds aren't the clock's).
  const now = useNow(stage ? (t.mode === "stopwatch" && isRunning(t) ? 100 : isRunning(t) ? 250 : 1000) : null);
  const card = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(
    () =>
      onOpenClock(() => {
        const p = panRect();
        setLayout(viewLayout(window.innerWidth, window.innerHeight));
        setPan(p);
        setStage(p ? "pan-in" : "in");
      }),
    [],
  );

  const close = () => setStage((st) => (st === "in" ? (pan ? "settle-out" : "out") : st));

  // The camera move: the footage starts on the bare desk photo, so it fades in over the desk while the
  // menu, the props and the scrim fade out under it (its first half second barely moves, so the two
  // don't ghost). Played backwards (a reversed copy) on the way out, handing back the same way: over its
  // last half second it fades away as everything fades back in.
  useEffect(() => {
    if (stage !== "pan-in" && stage !== "pan-out") return;
    const root = document.documentElement;
    root.dataset.clock = "pan";
    const v = video.current;
    let handBack = 0;
    const next = () => (stage === "pan-in" ? setStage("in") : finishPan());
    const finishPan = () => {
      delete root.dataset.clock;
      setStage(null);
    };
    v?.play()
      .then(() => {
        if (stage !== "pan-out" || !v) return;
        handBack = window.setTimeout(() => {
          root.dataset.clock = "back"; // the desk fades back in (globals.css) under the fading footage
          setLeaving(true);
        }, Math.max(0, (v.duration - PAN_FADE) * 1000));
      })
      .catch(next);
    // If the footage can't play (not loaded, or blocked), don't leave anyone stranded on the desk.
    const safety = window.setTimeout(next, 4000);
    v?.addEventListener("ended", next);
    return () => {
      window.clearTimeout(handBack);
      window.clearTimeout(safety);
      v?.removeEventListener("ended", next);
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== "settle-out") return;
    const id = window.setTimeout(() => {
      setLeaving(false);
      setStage("pan-out");
    }, 400);
    return () => window.clearTimeout(id);
  }, [stage]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    // On the home desk the camera pushes in on the clock in the photo (globals.css); elsewhere it just opens.
    if (!pan) root.dataset.clock = document.querySelector(".desk-clock-hit") ? "zoom" : "in";
    card.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onResize = () => setLayout(viewLayout(window.innerWidth, window.innerHeight));
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      if (!pan) root.dataset.clock = "out"; // the desk pulls back while the close-up fades
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `pan` is fixed while open
  }, [open]);

  useEffect(() => {
    if (stage !== "out") return;
    const id = window.setTimeout(() => {
      setStage(null);
      delete document.documentElement.dataset.clock;
    }, reducedMotion() ? 0 : 560);
    return () => window.clearTimeout(id);
  }, [stage]);

  if (stage && pan && (stage === "pan-in" || stage === "pan-out")) {
    const forward = stage === "pan-in";
    return (
      <div className="clock-view" data-pan="" data-stage={stage} data-leaving={leaving || undefined} aria-hidden="true">
        <video
          key={stage}
          ref={video}
          className="clock-view__pan"
          style={{ left: pan.left, top: pan.top, width: pan.width }}
          muted
          playsInline
          preload="auto"
        >
          <source src={`/assets/fx/clock-pan${forward ? "" : "-back"}.webm`} type="video/webm" />
          <source src={`/assets/fx/clock-pan${forward ? "" : "-back"}.mp4`} type="video/mp4" />
        </video>
      </div>
    );
  }

  if (!stage || !layout) return null;

  const s = t.settings;
  const set = (patch: Partial<TimerSettings>) => updateTimer((x) => setSettings(x, patch));
  const go = () => {
    unlockSound();
    updateTimer((x) => (isRunning(x) ? pause(x, Date.now()) : start(x, Date.now())));
  };
  const running = isRunning(t);
  const startLabel = running ? "Pause" : isActive(t) ? "Resume" : "Start";
  const left = leftOf(t, now);
  const done = t.mode === "stopwatch" ? 0 : 1 - left / lengthOf(t);
  const date = new Date(now);
  const today = todayTally(t, now);

  const counting = t.mode !== "stopwatch" && isActive(t);
  const ends = counting ? new Date(now + left) : null;
  const alarm = ends ? (ends.getMinutes() + ends.getSeconds() / 60) * 6 : null;
  const { s: k, hubX, hubY, wide } = layout;
  const photo = { left: hubX - CLOSE.hubX * k, top: hubY - CLOSE.hubY * k, width: CLOSE.w * k };
  const vars: Record<string, string> = { "--hub-x": `${hubX}px`, "--hub-y": `${hubY}px` };
  if (pan) {
    // Where the footage left the close-up: the scene settles from there into its place (and back).
    const f = pan.width / photo.width;
    vars["--from"] = `translate(${pan.left - photo.left * f}px, ${pan.top - photo.top * f}px) scale(${f})`;
  }

  return (
    <div className="clock-view" data-stage={stage} data-landing={pan ? "" : undefined} data-layout={wide ? "wide" : "stacked"} style={vars as React.CSSProperties}>
      <div className="clock-view__scene" onPointerDown={close} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- one fixed photo, sized by the layout */}
        <img className="clock-view__photo" src="/assets/clock/close.webp" alt="" style={{ ...photo, transformOrigin: `${CLOSE.hubX * k}px ${CLOSE.hubY * k}px` }} />
        <div className="clock-view__hands" style={{ left: hubX, top: hubY }}>
          <CloseHands now={now} alarm={alarm} track={CLOSE.track * k} />
        </div>
      </div>
      <section ref={card} className="clock-card" role="dialog" aria-label="Clock and timers" tabIndex={-1}>
        <button type="button" className="clock-card__close" onClick={close} aria-label="Close">
          ×
        </button>
        <header className="clock-card__now">
          <time dateTime={date.toISOString()}>
            {date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: !s.hour24 })}
            <small>{String(date.getSeconds()).padStart(2, "0")}</small>
          </time>
          <span>{date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
          <button type="button" className="clock-card__fmt" onClick={() => set({ hour24: !s.hour24 })} aria-label={s.hour24 ? "Show 12-hour time" : "Show 24-hour time"}>
            {s.hour24 ? "24h" : "12h"}
          </button>
        </header>

        <div className="clock-card__tabs" role="tablist" aria-label="Timer">
          {MODES.map((m) => (
            <button key={m} type="button" role="tab" aria-selected={t.mode === m} className="clock-card__tab" onClick={() => updateTimer((x) => setMode(x, m))}>
              {MODE_NAME[m]}
            </button>
          ))}
        </div>

        <div className="clock-card__panel" role="tabpanel" aria-label={MODE_NAME[t.mode]}>
          {t.mode === "focus" && (
            <p className="clock-card__phase" data-phase={t.phase}>
              {PHASE_NAME[t.phase]}
              {t.phase === "focus" ? ` · round ${t.round} of ${s.rounds}` : ""}
            </p>
          )}
          {t.mode === "timer" && (
            <div className="clock-card__presets" aria-label="Length">
              {PRESETS.map((m) => (
                <button key={m} type="button" className="clock-card__preset" aria-pressed={t.timerMin === m} onClick={() => updateTimer((x) => setTimerLength(x, m))}>
                  {m} min
                </button>
              ))}
              <NumberSetting key={`t${t.timerMin}`} name="timer-min" label="Other" value={t.timerMin} min={1} max={600} onChange={(v) => updateTimer((x) => setTimerLength(x, v))} />
            </div>
          )}

          <p className="clock-card__big" aria-live="off">
            {t.mode === "stopwatch" ? formatClock(elapsedOf(t, now), { tenths: true }) : formatClock(left)}
          </p>
          {t.mode !== "stopwatch" && (
            <div className="clock-card__bar" aria-hidden="true">
              <span style={{ width: `${Math.min(100, Math.max(0, done * 100))}%` }} />
            </div>
          )}

          <div className="clock-card__controls">
            <button type="button" className="clock-btn clock-btn--brass" onClick={go}>
              {startLabel}
            </button>
            {t.mode === "stopwatch" && (
              <button type="button" className="clock-btn" onClick={() => updateTimer((x) => lap(x, Date.now()))} disabled={!running}>
                Lap
              </button>
            )}
            <button type="button" className="clock-btn" onClick={() => updateTimer(reset)} disabled={!isActive(t)}>
              Reset
            </button>
            {t.mode === "focus" && (
              <button type="button" className="clock-btn" onClick={() => updateTimer((x) => finish(x, Date.now(), { skipped: true }))}>
                Skip
              </button>
            )}
          </div>

          {t.mode === "stopwatch" && t.laps.length > 0 && (
            <ol className="clock-card__laps">
              {t.laps
                .map((l, i) => ({ l, i, split: l - (t.laps[i - 1] ?? 0) }))
                .reverse()
                .map(({ l, i, split }) => (
                  <li key={i}>
                    <span>Lap {i + 1}</span>
                    <b>{formatClock(split, { tenths: true })}</b>
                    <span>{formatClock(l, { tenths: true })}</span>
                  </li>
                ))}
            </ol>
          )}

          {t.mode === "focus" && (
            <>
              <p className="clock-card__tally">
                <span>Today</span>
                <Tally n={today} />
                <span>
                  {today} {today === 1 ? "round" : "rounds"}
                </span>
              </p>
              <details className="clock-card__more">
                <summary>Lengths and sound</summary>
                <div className="clock-card__nums">
                  <NumberSetting key={`f${s.focus}`} name="focus" label="Focus" value={s.focus} min={1} max={180} onChange={(v) => set({ focus: v })} />
                  <NumberSetting key={`s${s.short}`} name="short" label="Short break" value={s.short} min={1} max={60} onChange={(v) => set({ short: v })} />
                  <NumberSetting key={`l${s.long}`} name="long" label="Long break" value={s.long} min={1} max={90} onChange={(v) => set({ long: v })} />
                  <NumberSetting key={`r${s.rounds}`} name="rounds" label="Rounds" value={s.rounds} min={2} max={12} onChange={(v) => set({ rounds: v })} />
                </div>
                <Toggle label="Start the next phase by itself" checked={s.autoStart} onChange={(v) => set({ autoStart: v })} />
                <Toggle label="Tick while focusing" checked={s.tick} onChange={(v) => (unlockSound(), set({ tick: v }))} />
                <Toggle label="Ring when time's up" checked={s.sound} onChange={(v) => (unlockSound(), set({ sound: v }))} />
                <Toggle
                  label="Notify me when the tab isn't open"
                  checked={s.notify}
                  onChange={(v) => {
                    set({ notify: v });
                    if (v && typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(() => {});
                  }}
                />
              </details>
            </>
          )}
          {t.mode === "timer" && <Toggle label="Ring when time's up" checked={s.sound} onChange={(v) => (unlockSound(), set({ sound: v }))} />}
        </div>
        {t.mode !== "stopwatch" && running && <p className="clock-card__foot">The red hand marks the minute it rings.</p>}
      </section>
    </div>
  );
}
