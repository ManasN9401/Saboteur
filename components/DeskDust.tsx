"use client";

import { useEffect, useRef } from "react";
import { reducedMotion } from "@/lib/prefs";

const COUNT = 46;

/**
 * Dust drifting through the lamp light, top left. One small canvas, drawn only while the page is
 * visible; off entirely with reduced motion. Motion is continuous (sines of time), so it has no loop seam.
 */
export function DeskDust() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || reducedMotion()) return;

    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    // Each mote orbits slowly around a home point inside the lamp's cone.
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const motes = Array.from({ length: COUNT }, () => {
      const along = Math.random() ** 0.7; // denser near the lamp
      return {
        u: along,
        v: rand(-1, 1),
        r: rand(0.6, 1.9),
        speed: rand(0.05, 0.16),
        phase: rand(0, Math.PI * 2),
        drift: rand(14, 46),
        alpha: rand(0.25, 0.75),
      };
    });

    let raf = 0;
    const draw = (now: number) => {
      const t = now / 1000;
      ctx.clearRect(0, 0, w, h);
      const lamp = { x: w * 0.06, y: h * 0.08 };
      const reach = Math.hypot(w, h) * 0.62;
      for (const m of motes) {
        // Cone from the lamp toward the middle of the desk.
        const dist = m.u * reach;
        const spread = 0.12 + m.u * 0.38;
        const angle = 0.62 + m.v * spread;
        const x = lamp.x + Math.cos(angle) * dist + Math.sin(t * m.speed + m.phase) * m.drift;
        const y = lamp.y + Math.sin(angle) * dist + Math.cos(t * m.speed * 0.8 + m.phase * 1.7) * m.drift * 0.7;
        const fade = (1 - m.u) * (0.55 + 0.45 * Math.sin(t * m.speed * 2.3 + m.phase));
        ctx.globalAlpha = Math.max(0, m.alpha * fade);
        ctx.beginPath();
        ctx.arc(x, y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    ctx.fillStyle = "rgba(255, 236, 196, 1)";

    const start = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };
    const onResize = () => {
      resize();
      ctx.fillStyle = "rgba(255, 236, 196, 1)";
    };
    start();
    document.addEventListener("visibilitychange", start);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", start);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvas} className="pointer-events-none fixed inset-0 h-full w-full" aria-hidden="true" />;
}
