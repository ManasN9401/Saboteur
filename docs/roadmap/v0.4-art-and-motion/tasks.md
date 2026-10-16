# v0.4 tasks

| ID | Task | Size | Depends | Done when |
|---|---|---|---|---|
| V04-01 | **Generate assets** A-01, A-02, A-05, A-07, A-09, A-11, A-13 (week 1, in parallel with v0.2) | L (wall-clock) | — | Picked files in `assets-src/` (gitignored) |
| V04-02 | `scripts/assets/cutout.py`: chroma key, despill, 1 px erode, alpha feather, fringe check (fail if any edge pixel has G > R+B+40) | M | — | Runs on all props; CI-able |
| V04-03 | `scripts/assets/build.mjs` (sharp/ffmpeg): AVIF/WebP 1×/2×, blur placeholders, video transcode, SSIM loop check. `lib/assets.ts` registry with anchors | M | 02 | `npm run assets` is reproducible |
| V04-04 | `lib/motion/path.ts`: reading path, carriage returns, closed loop, centripetal Catmull-Rom, arc-length table, speed profile. ~20 tests | M | — | Tests incl. a continuity test (no Δposition > speed×dt×1.5) |
| V04-05 | New `Loupe` component: layered albedo/spec, lens glass (clone + displacement + tint), specular sweep | L | 01, 04 | Matches loupe-rebuild §2 |
| V04-06 | Procedural loupe shadow (offscreen silhouette, blur/offset from height and light). Benchmark CSS vs canvas and keep the faster | M | 05 | ≤ 1 ms per frame desktop |
| V04-07 | Swap `LoupeLoader` to the new `Loupe`. Preserve the arc fraction on resize. Reduced-motion rest state | S | 05, 06 | 120 s recording shows no jump |
| V04-08 | Scene engine (`sceneClock`, visibility/IO pause, perf tier detection, `--ambient`) | M | — | One rAF in the Performance panel regardless of how many effects |
| V04-09 | `DeskScene` layers: plate (next/image, parallax), light canvas, FX canvas, vignette and grain | M | 08 | Replaces the current `desk` plate in `layout.tsx` |
| V04-10 | Effects: dust motes, lamp flicker, clock, window drift (plus lamp-follows-focus on the menu) | M | 09 | Budget ≤ 4 ms per frame |
| V04-11 | Day/dusk/night auto crossfade plus surface variants from v0.3 settings | S | 09, V03-13 | — |
| V04-12 | Stamp: per-verdict clips plus floating variant, a single shared `<video>` per clip (pool), mobile default floating | M | 01 | Memory stable over 10 reveals |
| V04-13 | Menu skin: folder textures, tab 9-slice, desk calendar and lamp props wired to state | M | 01, v0.2 | — |
| V04-14 | Avatars and badge art integrated (v0.3 placeholders replaced) | S | 01, v0.3 | — |
| V04-15 | Sound engine plus kit plus settings wiring plus title-screen opt-in | M | — | All sounds ≤ budget; mute works instantly |
| V04-16 | Title wordmark polish (letterpress mask, redaction peel) | S | — | — |
| V04-17 | `public/assets/CREDITS.md` plus README asset section updated | S | all | — |
| V04-18 | Visual regression snapshots (Playwright screenshots, motion disabled) for menu, setup, round, reveal × day/night × 360/1440 | M | all | Baselines committed |
