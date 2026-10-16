# Background scenes

## Scene engine (`lib/scene/`, `components/DeskScene.tsx`)
- One `requestAnimationFrame` loop app-wide (`sceneClock`). Subscribers get `(t, dt)`.
- The loop pauses on `visibilitychange`, when the scene is off-screen and under `data-motion="reduced"`.
  It caps to 30 fps when `data-perf="low"`, detected via a quick 30-frame benchmark on first load plus
  `navigator.hardwareConcurrency` and `deviceMemory`.
- Layers, back to front:
  1. **Plate**: the desk photo (AVIF/WebP, sized by `next/image` `sizes`), with a slight 2–6 px parallax.
  2. **Light**: a canvas with additive lamp light (radial gradient) plus window light (day: soft cool
     rectangle from the right; night: moonlight plus lamp).
  3. **Ambient FX**: a canvas (particles, rain streaks on the window reflection).
  4. **Props**: DOM. Interactive things (lamp, calendar, folders).
  5. **UI**: paper, menus.
  6. **Vignette and grain**: a CSS overlay with a 2-frame grain texture flipped at 12 fps (cheap).
- Intensity is controlled by `--ambient` (0–1). Rounds use 0.2, menus 1.0, the loader 0.6.

## Effect menu (pick 4–6 for v0.4; the rest go to the backlog)
| Effect | Day | Night | Cost | Notes |
|---|---|---|---|---|
| Dust motes in the lamp/window beam | ✓ | ✓ | low | ~60 particles, simplex drift, alpha by beam mask. **Recommended** |
| Lamp flicker | — | ✓ | trivial | ±3% brightness every 20–40 s, a 120 ms dip. **Recommended** |
| Clock second hand | ✓ | ✓ | trivial | Prop on the desk; ticks at real time. **Recommended** |
| Window light drift (clouds) | ✓ | — | low | Slow 40 s brightness modulation of the window layer by noise. **Recommended** |
| Rain on the window (reflection streaks) | opt | ✓ | medium | A weather setting; pairs with the rain ambience sound |
| Steam from a coffee mug | ✓ | ✓ | medium | Seamless 6 s loop video (A-10), or canvas curl noise |
| Pointer parallax / gyroscope | ✓ | ✓ | low | Max 6 px plate and 10 px props; disabled on reduced motion |
| Paper rustle when a card enters | ✓ | ✓ | trivial | A 2° skew wobble on enter |
| Time-of-day auto | ✓ | ✓ | trivial | Crossfade day → dusk → night plates over 2 s when the local hour crosses thresholds |
| Desk lamp follows the menu focus | ✓ | ✓ | low | The light cone centre eases toward the focused folder. A lovely menu touch |

## Seamless-loop rules
- Anything time-driven uses continuous functions of `t` (sine, simplex noise). Never use a modulo of a
  path with distinct endpoints.
- Videos that loop must be generated or edited so frame N ≈ frame 0 (SSIM ≥ 0.98). Otherwise do a 400 ms
  **crossfade loop**: two `<video>` elements offset by half the duration, alternating opacity. Use this
  as the fallback for any clip that won't loop cleanly.
- Particle systems respawn particles off-screen or at alpha 0, never visibly.

## Plates needed
Day, dusk and night, for each desk surface (oak first; walnut, baize and steel are flexible). The centre
60% of the frame must be **empty desk** so UI never fights photographed clutter. Props live at the edges:
lamp top-left, clock or calendar top-right, mug bottom-right, and pens/paperclips scattered at the edges.
See asset briefs A-01 to A-04.
