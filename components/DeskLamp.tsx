"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { plateToScreen } from "@/lib/desk";
import { reducedMotion } from "@/lib/prefs";

// The banker's lamp in the desk photos (photo pixels): roughly the shade and base.
const LAMP = { x: 175, y: 120, r: 165 };
// public/assets/fx/lamp-on.* is real footage of this desk's lamp switching on (Flow/Veo, trimmed to
// 2 s). Measured against the photo it is the photo scaled by 0.9373 and shifted (−4.9, 0.2) px, with
// no rotation and under half a pixel of drift, so it can play exactly over the photo.
const CLIP = { w: 1280, h: 720, scale: 0.9373, tx: -4.9, ty: 0.2, settledAt: 1.65 };
// The generator's sparkle mark sits on the mug in the footage: a soft hole lets the photo show through.
const CLIP_MARK = { x: 1152, y: 614, r: 46 };

export type LampState = "off" | "flicker" | "on";
// Read once per page load: the pre-paint script in layout.tsx leaves the lamp off for the title card.
// (Kept outside React so a remount, or development's double-run of effects, can't lose it.)
let introPending = typeof document !== "undefined" && document.documentElement.dataset.lamp === "off";


/** Switch the night desk's lamp. "flicker" is the coded switch-on, which settles to "on". */
export function setLamp(state: LampState) {
  const root = document.documentElement;
  if (state === "flicker" && reducedMotion()) state = "on";
  root.dataset.lamp = state;
  if (state === "flicker") window.setTimeout(() => root.dataset.lamp === "flicker" && (root.dataset.lamp = "on"), 1200);
}

/**
 * The lamp in the night desk photo is real: the title card switches it on, and clicking it turns it
 * off and on again (another little easter egg). Off is a lamp-off copy of the night photo laid over
 * the lit one; switching on plays footage of the lamp flickering on, then hands back to the photo.
 */
export function DeskLamp() {
  const [hit, setHit] = useState<{ x: number; y: number; r: number } | null>(null);
  const [clipBox, setClipBox] = useState<{ left: number; top: number; width: number } | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [showClip, setShowClip] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const timers = useRef<number[]>([]);

  const switchOn = useCallback(() => {
    const v = video.current;
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    if (!v || reducedMotion() || v.readyState < 3) return setLamp("flicker"); // footage not ready: coded flicker
    v.currentTime = 0;
    void v
      .play()
      .then(() => {
        setShowClip(true);
        // Once the lamp has settled in the footage, hand back to the lit photo underneath.
        timers.current.push(
          window.setTimeout(() => {
            document.documentElement.dataset.lamp = "on";
            setShowClip(false);
          }, CLIP.settledAt * 1000),
        );
      })
      .catch(() => setLamp("flicker"));
  }, []);

  useEffect(() => {
    // The night desk is the dark theme (data-theme on <html>, from settings or the system).
    const isDark = () => document.documentElement.dataset.theme === "dark";
    const place = () => {
      setHost(document.querySelector<HTMLElement>(".desk__fx"));
      if (!isDark()) {
        setHit(null); // the day and dusk photos have their own light
        setClipBox(null);
        return;
      }
      const { x, y, scale } = plateToScreen(LAMP.x, LAMP.y);
      setHit({ x, y, r: LAMP.r * scale });
      // Footage pixel (0, 0) is photo pixel (−tx, −ty) / scale.
      const origin = plateToScreen(-CLIP.tx / CLIP.scale, -CLIP.ty / CLIP.scale);
      setClipBox({ left: origin.x, top: origin.y, width: (CLIP.w / CLIP.scale) * origin.scale });
    };
    place();
    window.addEventListener("resize", place);
    const themeWatch = new MutationObserver(place);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    // The title card switches the lamp on a moment after the page appears; otherwise it's just on.
    let intro = 0;
    if (introPending && isDark()) {
      document.documentElement.dataset.lamp = "off";
      intro = window.setTimeout(() => {
        introPending = false;
        switchOn();
      }, 450);
    } else if (!document.documentElement.dataset.lamp) {
      document.documentElement.dataset.lamp = "on";
    }
    const pending = timers.current;
    return () => {
      window.clearTimeout(intro);
      pending.forEach(window.clearTimeout);
      window.removeEventListener("resize", place);
      themeWatch.disconnect();
      delete document.documentElement.dataset.lamp;
    };
  }, [switchOn]);

  if (!hit) return null;
  const hole = `radial-gradient(circle at ${(CLIP_MARK.x / CLIP.w) * 100}% ${(CLIP_MARK.y / CLIP.h) * 100}%, transparent ${(CLIP_MARK.r / CLIP.w) * 55}%, #000 ${(CLIP_MARK.r / CLIP.w) * 110}%)`;
  return (
    <>
      {host &&
        clipBox &&
        createPortal(
          <video
            ref={video}
            className="desk-lamp-clip"
            data-show={showClip}
            style={{ left: clipBox.left, top: clipBox.top, width: clipBox.width, maskImage: hole, WebkitMaskImage: hole }}
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
          >
            <source src="/assets/fx/lamp-on.webm" type="video/webm" />
            <source src="/assets/fx/lamp-on.mp4" type="video/mp4" />
          </video>,
          host,
        )}
      <div
        className="lamp-egg"
        aria-hidden="true"
        style={{ left: hit.x - hit.r, top: hit.y - hit.r, width: hit.r * 2, height: hit.r * 2 }}
        onPointerUp={(e) => {
          e.stopPropagation(); // don't also open the menu from the title card
          if (document.documentElement.dataset.lamp === "off") switchOn();
          else setLamp("off");
        }}
      />
    </>
  );
}
