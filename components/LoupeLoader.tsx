"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { buildReadingLoop, wobble, type Line, type ReadingLoop } from "@/lib/motion/path";
import { reducedMotion } from "@/lib/prefs";

export interface LoaderStep {
  label: string;
  state: "pending" | "active" | "done";
}

interface Props {
  eyebrow: string;
  title: string;
  /** The text the magnifier reads while we wait: the student's own passage or brief. */
  children: ReactNode;
  steps: LoaderStep[];
  error?: string | null;
  actions?: ReactNode;
  /** Change this when the text being read changes, so the magnifier re-measures its path. */
  contentKey?: string;
}

const LENS_R = 70; // on-screen lens radius in px
const ZOOM = 1.9;
// Geometry of /assets/props/loupe.webp (640 × 506, cut by scripts/assets/cutout.py): lens centre
// and inner radius in image pixels. The prop is rendered at its display angle, lit from the
// upper left like the desk, so it is never rotated in CSS (that is what made the old one look wrong).
const IMG = { w: 640, h: 506, cx: 164.7, cy: 166.1, r: 141.3 };
const SCALE = LENS_R / IMG.r;
// Shadows are drawn from the prop's own silhouette, falling away from the lamp (down and right).
// One sharp copy for when it's low over the page and one soft copy for when it lifts; mixing their
// opacity is far cheaper than animating a blur.
const SHADOW_NEAR = { dx: 5, dy: 8, blur: 3, opacity: 0.32 };
const SHADOW_FAR = { dx: 24, dy: 34, blur: 14, opacity: 0.24 };
const HOVER = 0.2; // resting height while reading
const SHADOW_CLASS = "pointer-events-none absolute left-0 top-0 max-w-none opacity-0 will-change-transform";

/**
 * Loading screen: a brass magnifier works its way along the lines of the student's text, showing a
 * live magnified copy, while the real pipeline steps tick off underneath. The path is a closed
 * loop (lib/motion/path.ts), so it reads line after line and swings back to the top without a jump.
 */
export function LoupeLoader({ eyebrow, title, children, steps, error, actions, contentKey }: Props) {
  const page = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLDivElement>(null);
  const zoomed = useRef<HTMLDivElement>(null);
  const glint = useRef<HTMLDivElement>(null);
  const prop = useRef<HTMLDivElement>(null);
  const near = useRef<HTMLImageElement>(null);
  const far = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (error) return;
    const reduce = reducedMotion();
    let raf = 0;
    let loop: ReadingLoop | null = null;
    let start = performance.now();

    const measure = () => {
      const host = page.current;
      const text = content.current;
      if (!host || !text) return;
      const box = host.getBoundingClientRect();
      // The magnified copy must wrap exactly like the page underneath it.
      if (zoomed.current) zoomed.current.style.width = `${host.clientWidth}px`;
      const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      const lines: Line[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) {
          if (r.width < 20) continue;
          const y = r.top + r.height / 2 - box.top;
          const same = lines.find((l) => Math.abs(l.y - y) < 4);
          if (same) {
            same.x0 = Math.min(same.x0, r.left - box.left);
            same.x1 = Math.max(same.x1, r.right - box.left);
          } else lines.push({ x0: r.left - box.left, x1: r.right - box.left, y });
        }
      }
      lines.sort((a, b) => a.y - b.y);
      // Keep the loupe where it was along the loop when the layout changes.
      const now = performance.now();
      const fraction = loop ? ((now - start) / 1000 / loop.duration) % 1 : 0;
      loop = buildReadingLoop(lines.slice(0, 14), { inset: 30 });
      if (loop) start = now - fraction * loop.duration * 1000;
    };

    const place = (x: number, y: number, height: number, vx: number) => {
      const lift = HOVER + height;
      const grow = 1 + 0.07 * height; // nearer the eye when lifted
      if (lens.current) lens.current.style.transform = `translate3d(${x - LENS_R}px, ${y - LENS_R}px, 0) scale(${grow})`;
      if (zoomed.current) zoomed.current.style.transform = `translate3d(${LENS_R - x * ZOOM}px, ${LENS_R - y * ZOOM}px, 0) scale(${ZOOM})`;
      // The reflection lags a little behind the movement, so it reads as light on glass.
      if (glint.current) glint.current.style.transform = `translate3d(${Math.max(-5, Math.min(5, -vx * 0.015))}px, 0, 0)`;
      const ox = x - IMG.cx * SCALE;
      const oy = y - IMG.cy * SCALE;
      if (prop.current) prop.current.style.transform = `translate3d(${ox}px, ${oy}px, 0) scale(${grow})`;
      const mix = Math.min(1, lift / (HOVER + 0.6));
      const shadow = (el: HTMLImageElement | null, s: typeof SHADOW_NEAR, opacity: number) => {
        if (!el) return;
        el.style.transform = `translate3d(${ox + s.dx * lift * 2}px, ${oy + s.dy * lift * 2}px, 0)`;
        el.style.opacity = String(opacity);
      };
      shadow(near.current, SHADOW_NEAR, SHADOW_NEAR.opacity * (1 - mix));
      shadow(far.current, SHADOW_FAR, SHADOW_FAR.opacity * mix);
    };

    const tick = (now: number) => {
      if (loop) {
        const t = (now - start) / 1000;
        const p = loop.at(t);
        const w = wobble(t);
        place(p.x + w.x, p.y + w.y, p.height, p.vx);
      }
      if (!reduce) raf = requestAnimationFrame(tick);
    };

    measure();
    raf = requestAnimationFrame(tick);
    const ro = new ResizeObserver(measure);
    if (page.current) ro.observe(page.current);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [error, contentKey]);

  const propStyle = { width: IMG.w * SCALE, transformOrigin: `${IMG.cx * SCALE}px ${IMG.cy * SCALE}px` };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden" role="status" aria-live="polite">
      <div className="desk__scrim absolute inset-0" style={{ background: "var(--scrim-solid)", backdropFilter: "blur(3px)" }} />
      <div className="relative mx-auto flex min-h-full max-w-2xl flex-col justify-center gap-6 px-5 py-10">
        <div className="rise">
          <p className="eyebrow mb-2">{eyebrow}</p>
          <h2 className="display text-[clamp(34px,6vw,54px)] text-desk">{title}</h2>
        </div>

        <div ref={page} className="paper rise relative px-7 py-6 sm:px-9 sm:py-8" style={{ animationDelay: "80ms" }}>
          <div ref={content}>{children}</div>
          {!error && (
            <>
              {/* Shadows first, under everything: the prop's silhouette, blacked out and blurred. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={near} src="/assets/props/loupe.webp" alt="" aria-hidden="true" className={SHADOW_CLASS} style={{ ...propStyle, filter: `brightness(0) blur(${SHADOW_NEAR.blur}px)` }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={far} src="/assets/props/loupe.webp" alt="" aria-hidden="true" className={SHADOW_CLASS} style={{ ...propStyle, filter: `brightness(0) blur(${SHADOW_FAR.blur}px)` }} />
              <div
                ref={lens}
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0 overflow-hidden rounded-full bg-[var(--paper)] will-change-transform"
                style={{ width: LENS_R * 2, height: LENS_R * 2 }}
              >
                <div ref={zoomed} className="absolute left-0 top-0 origin-top-left">
                  <div className="px-7 py-6 sm:px-9 sm:py-8">{children}</div>
                </div>
                {/* Glass: a faint warm tint, darker toward the rim, and a soft reflection of the lamp. */}
                <div className="absolute inset-0 rounded-full [background:radial-gradient(circle,rgba(255,236,200,0.05)_55%,rgba(60,40,10,0.16)_100%)]" />
                <div ref={glint} className="absolute inset-0">
                  <div className="absolute left-[14%] top-[10%] h-[38%] w-[46%] rotate-[-28deg] rounded-[50%] bg-[radial-gradient(ellipse,rgba(255,255,255,0.5),rgba(255,255,255,0)_70%)]" />
                </div>
              </div>
              <div ref={prop} className="pointer-events-none absolute left-0 top-0 will-change-transform" style={{ transformOrigin: propStyle.transformOrigin }} aria-hidden="true">
                <picture>
                  <source srcSet="/assets/props/loupe.avif" type="image/avif" />
                  <img src="/assets/props/loupe.webp" alt="" className="block max-w-none" style={{ width: propStyle.width }} />
                </picture>
              </div>
            </>
          )}
        </div>

        <ol className="rise grid gap-2" style={{ animationDelay: "160ms" }}>
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-3 font-mono text-[13px] uppercase tracking-[0.08em] text-desk" data-state={s.state}>
              <span
                aria-hidden="true"
                className={`grid size-5 place-items-center rounded-full text-[11px] ${
                  s.state === "done" ? "bg-catch text-white" : s.state === "active" ? "animate-pulse border-2 border-pen" : "border border-current opacity-40"
                }`}
              >
                {s.state === "done" ? "✓" : ""}
              </span>
              <span className={s.state === "pending" ? "opacity-45" : ""}>
                {s.label}
                <span className="sr-only">{s.state === "done" ? " (done)" : s.state === "active" ? " (in progress)" : ""}</span>
              </span>
            </li>
          ))}
        </ol>

        {error && (
          <div className="paper callout rise" role="alert">
            <p className="mb-3 text-[16px] text-ink">{error}</p>
            <div className="flex flex-wrap gap-3">{actions}</div>
          </div>
        )}
      </div>
    </div>
  );
}
