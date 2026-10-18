"use client";
/* eslint-disable @next/next/no-img-element -- desk layers, already sized */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { plateToScreen } from "@/lib/desk";
import { boxStyle, propSrc, VERSIONS } from "@/lib/deskProps";
import { openClock } from "@/lib/events";
import { reducedMotion } from "@/lib/prefs";
import { leftOf } from "@/lib/timer";
import { HAND, handAngles, handScale, type HandArt } from "@/lib/clockHands";
import { PAN_ON, useNow, useTimer } from "./Clock";

// The alarm clock in the desk photos (top right). Its painted hands are removed by
// scripts/assets/desk_clock.py (desk-props/clock-<v>.webp patches over this box); the live hands are
// drawn here, on the dial as the camera sees it. Measured on the 2048-px photos: the dial is an ellipse
// with semi-axes 93 × 45 turned 34°, hub at (1797, 207). The face is tilted back, so 12 o'clock lies
// along the short axis, towards the handle.
const S = 1376 / 2048; // 2048-px photo pixels → desk-photo pixels
const PATCH = [1680, 140, 1900, 290] as const;
// The whole clock, cut out with a soft edge (desk-props/clock-body-<v>.webp): shaken when the alarm rings.
const BODY = [1570, 30, 1940, 370] as const;
const HUB = { x: 1797, y: 207 };
const DIAL = { a: 93, b: 45, turn: (34 * Math.PI) / 180 };
// Unit dial (x towards 3 o'clock, y towards 6) → photo pixels.
const MATRIX = [
  DIAL.a * Math.cos(DIAL.turn),
  DIAL.a * Math.sin(DIAL.turn),
  -DIAL.b * Math.sin(DIAL.turn),
  DIAL.b * Math.cos(DIAL.turn),
  HUB.x,
  HUB.y,
].map((n) => +n.toFixed(3));

// The hands on the unit dial (radius 1 = the dial's edge); the minute track is a little inside it.
const k = handScale(0.88);

/** One photographed hand on the unit dial, turned about its pivot (lib/clockHands.ts). */
function hand(art: HandArt, scale: number, angle: number) {
  return <image href={art.src} x={-art.px * scale} y={-art.py * scale} width={art.w * scale} height={art.h * scale} transform={`rotate(${angle})`} />;
}

let fetched = false;
/** Fetch the camera move's footage (both ways) when the clock is first pointed at, so it plays at once. */
function prefetchPan() {
  if (!PAN_ON || fetched || document.documentElement.dataset.theme !== "dark") return;
  fetched = true;
  const ext = document.createElement("video").canPlayType("video/webm") ? "webm" : "mp4";
  for (const name of ["clock-pan", "clock-pan-back"]) fetch(`/assets/fx/${name}.${ext}`, { priority: "low" } as RequestInit).catch(() => {});
}

const box = (b: readonly [number, number, number, number]) => [b[0] * S, b[1] * S, b[2] * S, b[3] * S] as const;

/**
 * The desk clock keeps real time: hour, minute and seconds hands on its own dial. While a focus round
 * or timer runs, its red alarm hand points to the minute it will ring, and when it rings the clock shakes.
 * Clicking it opens the clock (the camera pushes in to a close-up: Clock.tsx).
 */
export function DeskClock() {
  const t = useTimer();
  const now = useNow(1000);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [hit, setHit] = useState<{ x: number; y: number; r: number } | null>(null);

  useEffect(() => {
    const place = () => {
      setHost(document.querySelector<HTMLElement>(".desk__props"));
      const { x, y, scale } = plateToScreen(HUB.x * S, HUB.y * S);
      const onScreen = x > 0 && x < window.innerWidth - 24 && y > 0 && y < window.innerHeight;
      // Where the camera pushes in when the clock is opened (globals.css, :root[data-clock]).
      document.documentElement.style.setProperty("--clock-x", `${x}px`);
      document.documentElement.style.setProperty("--clock-y", `${y}px`);
      setHit(onScreen ? { x, y, r: 92 * S * scale } : null);
    };
    place();
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("resize", place);
      setHost(null);
    };
  }, []);

  const d = new Date(now);
  const a = handAngles(now);
  // The alarm hand: the minute the countdown will end (running, or if resumed now).
  const counting = t.mode !== "stopwatch" && (t.endsAt !== null || t.left !== null);
  const ends = counting ? new Date(now + leftOf(t, now)) : null;
  const alarm = ends ? (ends.getMinutes() + ends.getSeconds() / 60) * 6 : null;
  const [x0, y0, x1, y1] = PATCH;
  const showSeconds = !reducedMotion();

  return (
    <>
      {host &&
        createPortal(
          <div className="desk-clock">
            {VERSIONS.map((v) => (
              <img key={`b${v}`} className="desk-clock-body desk-prop-v" data-v={v} src={propSrc("clock-body", v)} alt="" style={boxStyle(box(BODY))} />
            ))}
            {VERSIONS.map((v) => (
              <img key={v} className="desk-clock-face desk-prop-v" data-v={v} src={propSrc("clock", v)} alt="" style={boxStyle(box(PATCH))} />
            ))}
            <svg className="desk-clock-hands" style={boxStyle(box(PATCH))} viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} aria-hidden="true">
              <defs>
                {/* The hands' shadow on the dial: their silhouette, darkened and softened. */}
                <filter id="desk-clock-shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feColorMatrix type="matrix" values="0 0 0 0 0.08  0 0 0 0 0.05  0 0 0 0 0.02  0 0 0 0.55 0" />
                  <feGaussianBlur stdDeviation="0.8" />
                </filter>
              </defs>
              {/* The same photographed hands as the close-up, on the dial as the camera sees it: the shadow, then the hands. */}
              {[true, false].map((shadow) => (
                <g key={String(shadow)} transform={shadow ? "translate(1.2 1.6)" : undefined} filter={shadow ? "url(#desk-clock-shadow)" : undefined}>
                  <g transform={`matrix(${MATRIX.join(" ")})`}>
                    {alarm !== null && hand(HAND.alarm, k.set, alarm)}
                    {hand(HAND.hour, k.set, a.hour)}
                    {hand(HAND.minute, k.set, a.minute)}
                    {showSeconds && hand(HAND.second, k.second, a.second)}
                    {hand(HAND.nut, k.set, 0)}
                  </g>
                </g>
              ))}
            </svg>
          </div>,
          host,
        )}
      {hit && (
        <button
          type="button"
          className="desk-clock-hit"
          style={{ left: hit.x - hit.r, top: hit.y - hit.r * 0.75, width: hit.r * 2, height: hit.r * 1.5 }}
          onPointerEnter={prefetchPan}
          onFocus={prefetchPan}
          onClick={() => openClock()}
          aria-label={`Clock: ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}. Open the timers`}
          title="Clock and timers"
        />
      )}
    </>
  );
}
