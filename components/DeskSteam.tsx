"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { plateToScreen } from "@/lib/desk";
import { reducedMotion } from "@/lib/prefs";

// Every desk photo has the mug in the same place: coffee centred here, this radius (photo pixels).
const MUG = { x: 1236, y: 618, r: 74 };
// public/assets/fx/steam.* (640 × 360, built by scripts/assets/steam_loop.py): where its coffee is.
const CLIP = { w: 640, h: 360, x: 318, y: 186, r: 128 };

type Geometry = { mugX: number; mugY: number; mugR: number; left: number; top: number; width: number };

/**
 * An easter egg on the desk photo's coffee mug: hover it and steam curls up; click it and it
 * steams properly for a few seconds. The steam is a seamless loop of real steam, screened over the
 * photo and lined up with the mug wherever the photo's cover-crop puts it.
 */
export function DeskSteam() {
  const video = useRef<HTMLVideoElement>(null);
  const timer = useRef(0);
  const [geo, setGeo] = useState<Geometry | null>(null);
  const [level, setLevel] = useState<"off" | "wisp" | "pour">("off");

  useEffect(() => {
    const place = () => {
      const { x: mugX, y: mugY, scale } = plateToScreen(MUG.x, MUG.y);
      const k = (MUG.r * scale) / CLIP.r;
      setGeo({ mugX, mugY, mugR: MUG.r * scale * 1.35, left: mugX - CLIP.x * k, top: mugY - CLIP.y * k, width: CLIP.w * k });
    };
    place();
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("resize", place);
      window.clearTimeout(timer.current);
    };
  }, []);

  // Only decode video while the steam is showing.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (level === "off") {
      const t = window.setTimeout(() => v.pause(), 900); // after the fade-out
      return () => window.clearTimeout(t);
    }
    v.playbackRate = level === "pour" ? 0.9 : 0.65;
    void v.play().catch(() => {});
  }, [level]);

  const settle = useCallback((ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLevel("off"), ms);
  }, []);

  if (!geo) return null;
  const reduce = reducedMotion();
  if (reduce) return null;

  return (
    <>
      <video
        ref={video}
        className="desk-steam"
        data-level={level}
        style={{ left: geo.left, top: geo.top, width: geo.width }}
        loop
        muted
        playsInline
        preload="none"
        aria-hidden="true"
      >
        <source src="/assets/fx/steam.webm" type="video/webm" />
        <source src="/assets/fx/steam.mp4" type="video/mp4" />
      </video>
      <div
        className="mug-egg"
        aria-hidden="true"
        style={{ left: geo.mugX - geo.mugR, top: geo.mugY - geo.mugR, width: geo.mugR * 2, height: geo.mugR * 2 }}
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          window.clearTimeout(timer.current);
          setLevel((l) => (l === "pour" ? l : "wisp"));
        }}
        onPointerLeave={(e) => e.pointerType === "mouse" && settle(level === "pour" ? 4000 : 1200)}
        onPointerUp={(e) => {
          e.stopPropagation(); // don't also open the menu from the title card
          setLevel("pour");
          settle(6000);
        }}
      />
    </>
  );
}
