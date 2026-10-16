import { describe, expect, it } from "vitest";
import { buildReadingLoop, wobble, type Line } from "./path";

const LINES: Line[] = [
  { x0: 20, x1: 560, y: 30 },
  { x0: 20, x1: 540, y: 60 },
  { x0: 20, x1: 580, y: 90 },
  { x0: 20, x1: 300, y: 120 },
];

describe("buildReadingLoop", () => {
  const loop = buildReadingLoop(LINES)!;

  it("returns null when there is nothing to read", () => {
    expect(buildReadingLoop([])).toBeNull();
    expect(buildReadingLoop([{ x0: 0, x1: 20, y: 10 }])).toBeNull();
  });

  it("starts at the first line and is periodic", () => {
    const a = loop.at(0);
    expect(a.x).toBeCloseTo(44);
    expect(a.y).toBeCloseTo(30);
    const b = loop.at(loop.duration);
    expect(b.x).toBeCloseTo(a.x, 3);
    expect(b.y).toBeCloseTo(a.y, 3);
    expect(loop.at(-1).x).toBeCloseTo(loop.at(loop.duration - 1).x, 6);
  });

  it("never jumps: position is continuous at 60 fps, including the wrap back to the top", () => {
    const dt = 1 / 60;
    let prev = loop.at(0);
    let maxStep = 0;
    for (let t = dt; t <= loop.duration * 2; t += dt) {
      const p = loop.at(t);
      maxStep = Math.max(maxStep, Math.hypot(p.x - prev.x, p.y - prev.y));
      prev = p;
    }
    // Peak speed is 2.2 × 140 px/s, so a frame can't move more than ~5 px.
    expect(maxStep).toBeLessThan(140 * 2.2 * dt * 1.15);
  });

  it("never changes speed abruptly", () => {
    const dt = 1 / 60;
    const speedAt = (t: number) => {
      const a = loop.at(t - dt / 2);
      const b = loop.at(t + dt / 2);
      return Math.hypot(b.x - a.x, b.y - a.y) / dt;
    };
    let prev = speedAt(dt);
    let maxJump = 0;
    for (let t = 2 * dt; t <= loop.duration; t += dt) {
      const v = speedAt(t);
      maxJump = Math.max(maxJump, Math.abs(v - prev));
      prev = v;
    }
    expect(maxJump).toBeLessThan(10);
  });

  it("reads at reading speed on the line and lifts only between lines", () => {
    const p = loop.at(1);
    expect(p.y).toBeCloseTo(30);
    expect(p.height).toBe(0);
    expect(p.vx).toBeCloseTo(140, 0);
    const heights = Array.from({ length: 600 }, (_, i) => loop.at((i / 600) * loop.duration).height);
    expect(Math.max(...heights)).toBeGreaterThan(0.5);
    expect(Math.min(...heights)).toBe(0);
  });
});

describe("wobble", () => {
  it("stays within a couple of pixels", () => {
    for (let t = 0; t < 60; t += 0.37) {
      const w = wobble(t);
      expect(Math.abs(w.x)).toBeLessThan(2);
      expect(Math.abs(w.y)).toBeLessThan(1.5);
    }
  });
});
