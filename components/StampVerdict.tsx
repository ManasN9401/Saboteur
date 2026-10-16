"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Verdict } from "./SentencePassage";
import { reducedMotion } from "@/lib/prefs";

/**
 * Real stamp footage on blank white paper, played over the card with multiply blending so the white
 * disappears and only the stamp and its shadow show. The ink mark appears as the stamp lifts.
 * Wide screens get the hand (public/assets/stamp.*); phones get the floating stamp
 * (public/assets/fx/stamp-floating.*), which needs no arm reaching in from off-screen.
 * Set NEXT_PUBLIC_STAMP_VIDEO=0 to use the coded slam instead.
 */
interface Clip {
  sources: { src: string; type: string }[];
  /** Seconds into the clip when the stamp leaves the paper. */
  liftAt: number;
  /** Where the stamp's face sits in the frame (fractions of the video) and its width. */
  block: { x: number; y: number; width: number };
  /** Video height ÷ width. */
  aspect: number;
  /** Fade the frame's edges where the footage is cropped. */
  mask: string;
  /** Minimum gap between two stamps starting, so they land one after another. */
  slotMs: number;
}
const CLIPS: Record<"hand" | "floating", Clip> = {
  hand: {
    sources: [
      { src: "/assets/stamp.webm", type: "video/webm" },
      { src: "/assets/stamp.mp4", type: "video/mp4" },
    ],
    liftAt: 0.85,
    block: { x: 0.595, y: 0.517, width: 0.24 },
    aspect: 540 / 840,
    mask: "linear-gradient(to right, #000 78%, transparent), linear-gradient(to bottom, #000 80%, transparent)",
    slotMs: 1150,
  },
  floating: {
    sources: [
      { src: "/assets/fx/stamp-floating.webm", type: "video/webm" },
      { src: "/assets/fx/stamp-floating.mp4", type: "video/mp4" },
    ],
    liftAt: 1.13,
    block: { x: 0.497, y: 0.62, width: 0.453 },
    aspect: 720 / 700,
    // The stamp drops in from above the frame: fade it in rather than show a hard edge.
    mask: "linear-gradient(to bottom, transparent, #000 18%)",
    slotMs: 1300,
  },
};
const VIDEO_ENABLED = process.env.NEXT_PUBLIC_STAMP_VIDEO !== "0";
/** One hand at a time: stamps that start together queue up. */
let nextSlot = 0;

const TEXT: Record<Verdict, { main: string; sub: string }> = {
  catch: { main: "Caught\nred-handed", sub: "Error found" },
  miss: { main: "Slipped\npast you", sub: "Missed" },
  false_flag: { main: "False\nalarm", sub: "Was correct" },
};

interface Props {
  kind: Verdict;
  /** Start the animation (e.g. once the card is on screen). */
  play: boolean;
  size?: number;
  rotate?: number;
  onLand?: () => void;
}

/** The grading animation: a rubber stamp comes down on the card and leaves the verdict in ink. */
export function StampVerdict({ kind, play, size = 22, rotate = -9, onLand }: Props) {
  const mark = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [videoOk, setVideoOk] = useState(VIDEO_ENABLED);
  const [videoWidth, setVideoWidth] = useState(0);
  // Page coordinates of the mark's centre, measured when the stamp starts.
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  const [landedState, setLanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [reduce] = useState(() => reducedMotion());
  const [clip] = useState(() => CLIPS[typeof window !== "undefined" && window.matchMedia("(max-width: 719px)").matches ? "floating" : "hand"]);
  const started = useRef(false);
  const landRef = useRef(onLand);
  useEffect(() => {
    landRef.current = onLand;
  }, [onLand]);
  const landed = landedState || (reduce && play);

  // Scale the footage so the stamp block in it is the same width as the ink mark.
  useEffect(() => {
    const el = mark.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setVideoWidth(el.offsetWidth / clip.block.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [clip]);

  useEffect(() => {
    if (!play || started.current || reduce) return;
    if (videoOk && !videoWidth) return; // wait until the footage is sized and mounted
    started.current = true;
    const timers: number[] = [];
    const after = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const land = () => {
      setLanded(true);
      landRef.current?.();
      mark.current?.animate(
        [
          { opacity: 0, transform: `rotate(${rotate}deg) scale(1.04)` },
          { opacity: 0.94, transform: `rotate(${rotate}deg) scale(1)` },
        ],
        { duration: 140, easing: "ease-out", fill: "forwards" },
      );
    };

    const now = performance.now();
    const wait = Math.max(0, nextSlot - now);
    nextSlot = now + wait + clip.slotMs;

    if (videoOk && video.current) {
      const v = video.current;
      after(wait, () => {
        const r = mark.current?.getBoundingClientRect();
        if (r) setSpot({ x: r.left + r.width / 2 + window.scrollX, y: r.top + r.height / 2 + window.scrollY });
        v.currentTime = 0;
        v.play()
          .then(() => {
            setPlaying(true);
            after(clip.liftAt * 1000, land);
          })
          .catch(() => {
            setVideoOk(false);
            land();
          });
      });
      return () => timers.forEach((t) => window.clearTimeout(t));
    }

    // Coded fallback: the stamp's shadow sharpens as it descends, then the ink lands with a squash.
    after(wait, () => {
      shadow.current?.animate(
        [
          { opacity: 0, transform: `rotate(${rotate}deg) scale(1.9) translate(18px, 22px)`, filter: "blur(14px)" },
          { opacity: 0.4, transform: `rotate(${rotate}deg) scale(1.2) translate(8px, 10px)`, filter: "blur(7px)", offset: 0.7 },
          { opacity: 0.55, transform: `rotate(${rotate}deg) scale(1) translate(2px, 3px)`, filter: "blur(2px)" },
        ],
        { duration: 380, easing: "cubic-bezier(.5,0,.9,.5)", fill: "forwards" },
      );
      after(380, () => {
        shadow.current?.animate([{ opacity: 0.55 }, { opacity: 0 }], { duration: 160, fill: "forwards" });
        land();
      });
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [play, videoOk, videoWidth, rotate, reduce, clip]);

  const { main, sub } = TEXT[kind];
  const h = videoWidth * clip.aspect;
  // The footage lives at the top of the page (not inside the card), so multiply blending sees the
  // card and the desk beneath it and the hand can reach past the card's edge without a white box.
  const footage =
    videoOk && !reduce && videoWidth > 0 && typeof document !== "undefined"
      ? createPortal(
        <video
          ref={video}
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          onEnded={() => setPlaying(false)}
          className="pointer-events-none absolute z-30 max-w-none mix-blend-multiply transition-opacity duration-150"
          style={{
            width: videoWidth,
            height: h,
            left: (spot?.x ?? -9999) - clip.block.x * videoWidth,
            top: (spot?.y ?? 0) - clip.block.y * h,
            opacity: playing ? 1 : 0,
            maskImage: clip.mask,
            maskComposite: "intersect",
            WebkitMaskImage: clip.mask,
            WebkitMaskComposite: "source-in",
          }}
        >
          {clip.sources.map((s, i) => (
            // If no source can play, fall back to the coded stamp.
            <source key={s.src} src={s.src} type={s.type} onError={i === clip.sources.length - 1 ? () => setVideoOk(false) : undefined} />
          ))}
        </video>,
        document.body,
      )
      : null;

  return (
    <div className="pointer-events-none relative grid place-items-center" style={{ fontSize: size }} aria-hidden={!landed}>
      {footage}
      <div ref={shadow} className="absolute h-[2.6em] w-[6.2em] rounded-md bg-black opacity-0" />
      <div
        ref={mark}
        className="stamp-mark relative whitespace-pre-line"
        data-kind={kind}
        style={{ opacity: landed && reduce ? 0.94 : 0, transform: `rotate(${rotate}deg)` }}
      >
        {main}
        <small>{sub}</small>
      </div>
    </div>
  );
}
