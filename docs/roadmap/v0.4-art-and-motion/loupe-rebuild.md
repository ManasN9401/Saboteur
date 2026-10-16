# Loupe rebuild

## 1. What's wrong today (`components/LoupeLoader.tsx`)
- `glass.style.transform = … rotate(-40deg)` rotates a **photo with baked lighting**. The highlights end
  up on the lower-left of the rim, while the desk lamp is upper-left. The brain reads that as "pasted on".
- The image has a soft grey halo from the source photo. CSS adds `drop-shadow(14px 22px 14px …)`, so the
  result is a double, mismatched shadow.
- The path is a list of points; `dist % total` jumps from the last point to the first. Each segment eases
  in and out, so it stops at every point including the diagonal "carriage return".
- The lens interior is a flat 1.9× clone with a single radial highlight. There's no glass.

## 2. The new loupe: layers

```
 ┌───────────────── loupe group (translate only, NO rotate of lit layers) ─────────────────┐
 │  6 specular sweep  (screen blend, fixed light angle; offset inversely with movement)    │
 │  5 rim highlight   (screen, pre-rendered for the fixed display angle)                   │
 │  4 rim + handle albedo (generated AT the display angle: -35°, handle to lower-right)    │
 │  3 lens glass: magnified clone + barrel distortion + edge darkening + warm tint         │
 │  2 contact/AO shadow (procedural, tight, under rim only when "down")                    │
 │  1 cast shadow (procedural from rim+handle alpha; offset/blur from height & light)      │
 └─────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Generate the prop at its display angle** (handle pointing to the lower-right at about 35°) so no CSS
  rotation is needed. If we want a little wobble (±3°), it's small enough that the baked lighting still
  reads correctly.
- **Shadows (procedural):**
  - one `<canvas>` (or SVG) draws the alpha silhouette in black;
  - blur = `4 + height × 18` px;
  - offset = `lightDir × (2 + height × 22)` px, where `lightDir` is the unit vector away from the lamp
    (upper-left lamp, so the shadow falls lower-right);
  - opacity `0.38 − height × 0.18`;
  - `height` ∈ [0, 1]: 0.15 while reading and 0.6 during the carriage-return "lift". The silhouette is
    pre-rendered once into an offscreen canvas, so per-frame cost is one `drawImage` with a cached blur
    (or CSS `filter` on a pre-masked div, measured in V04-06).
- **Lens glass:**
  - the magnified clone stays (it's what makes it feel alive);
  - add an SVG filter: `feImage` radial map → `feDisplacementMap scale=10` for barrel bulge;
  - add an inset radial gradient for edge darkening and `rgba(255,236,200,0.06)` for a warm tint;
  - measure the cost: if it exceeds 2 ms per frame on low end, drop the displacement there (`data-perf="low"`).
- **Specular sweep:** a soft elliptical highlight at a fixed upper-left position inside the lens. It
  shifts by `−velocity × 0.02` so it lags and feels like a reflection rather than a sticker.

## 3. The motion
1. Build the **reading path** from line rects, as now. For each line, add a point at the start and the end,
   inset 24 px.
2. Insert a **carriage return** between lines: a curve that lifts (height → 0.6), arcs back left above the
   next line and lands. Close the loop with the same kind of curve from the last line back to the first.
   That way the path is a **closed loop** with no teleport.
3. Smooth with a **centripetal Catmull-Rom spline** (α = 0.5, no overshoot), sampled into a polyline of
   about 4 px steps.
4. Re-parameterise by **arc length** and drive with a time-based speed profile:
   - reading speed 140 px/s (a reading pace);
   - carriage return 420 px/s with a smoothstep in and out;
   - a 250 ms dwell at the end of every third line, "re-reading".
5. Add **micro-jitter** (1–2 px simplex noise, 0.3 Hz) so it looks hand-held. It's continuous, so there
   are no seams.
6. On resize or text change, rebuild the path but keep the **current arc-length fraction**, so the loupe
   doesn't jump when the layout changes.
7. Reduced motion: the loupe rests over line 1 with a slow 4 s breathing highlight, and nothing travels.

All path maths go in `lib/motion/path.ts` (pure, tested): `buildReadingPath`, `catmullRom`,
`arcLengthTable`, `sampleAt`.

## 4. Acceptance
- Record 120 s at 60 fps and plot loupe x/y velocity. No discontinuities (|Δv| between consecutive frames
  < 30 px/s except at planned dwell starts).
- The highlight always faces the lamp. The shadow always falls away from it.
- On a 4× throttled CPU, the loupe frame cost stays ≤ 6 ms.
