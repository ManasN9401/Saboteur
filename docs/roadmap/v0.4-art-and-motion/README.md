# v0.4 · Art and motion

> Status: ◐ (asset batch 1 integrated) · Estimate: ~6–7 days of code, plus asset generation that **starts in week 1** · Track: craft · Depends on: v0.2

## Goal
Make the desk feel like a real, lit, living place, and make every prop look like it belongs in that
light. Fix the specific problems with today's assets, add ambient life to the background, and add sound.

## Known defects being fixed

| Defect | Root cause (in the current code) | Fix |
|---|---|---|
| Magnifier shading looks wrong | `loupe.webp` is a photo lit from its own top-left. `LoupeLoader` rotates the whole image by −40°, so its highlights point the wrong way relative to the desk lamp | Rebuild the loupe as layers lit in world space. See [loupe-rebuild.md](loupe-rebuild.md) |
| Shadow is part of the picture | The cut-out kept a grey contact fringe and soft shadow from the source photo. CSS then adds a second `drop-shadow` on top | Re-generate on chroma green with "no cast shadow", erode the edge, and produce the shadow procedurally from the alpha mask |
| Loupe loop jumps | `dist % total` teleports from the end of the last line back to the start. Per-segment ease-in-out stops dead at every line end, and line-to-line moves are straight diagonals | A closed, smoothed path with a return stroke and constant-speed arc-length sampling. See [loupe-rebuild.md §3](loupe-rebuild.md#3-the-motion) |
| Lens contents look flat | The magnified clone has no distortion, no chromatic edge and no glass tint | Barrel distortion via an SVG `feDisplacementMap` (cheap), rim darkening, a slight warm tint, and a specular sweep that stays put as the loupe moves |
| Background is a still photo | Only `desk-day.webp` / `desk-night.webp` | A layered desk scene with ambient motion. See [background-scenes.md](background-scenes.md) |
| Stamp video shows a hand (debated) and is one clip for three verdicts | Single footage file | Keep the hand (it sells the physicality) but add three ink colours and a **floating-stamp** alternative as a setting. See asset briefs A-07/A-08 |
| No sound | — | A small WebAudio sound kit, off by default. See [sound.md](sound.md) |

## Scope

**Fixed**
- New loupe (layers plus procedural shadow plus smooth path).
- Desk scene engine: one rAF loop, layered plates, ambient effects, parallax, pause when hidden.
- New desk plates for day and night (and the v0.3 surfaces) **without baked props** in the centre, so UI
  never sits on top of a photographed object.
- An asset pipeline script (`scripts/assets/`) and `lib/assets.ts` registry.
- Sound kit (≤ 120 KB total) plus settings wiring.
- Production-grade images for the menu: folders, desk calendar, lamp, ID badges and avatars.

**Flexible**
- Whether ambient effects are DOM/CSS or a single `<canvas>`. Recommendation: one full-screen canvas
  behind the UI for particles and light, with DOM for props that are interactive.
- Three.js only if a prop needs real 3D (e.g. a rotating loupe). Default: **no Three.js**, which stays
  within the JS budget.
- The exact list of ambient effects. Pick 4–6 from [background-scenes.md](background-scenes.md).

**Open**
- Hand vs floating stamp as the default. Recommendation: hand on desktop, floating on mobile (smaller,
  cheaper, no arm cut off by a narrow viewport).

## Acceptance criteria
- The loupe moves continuously with **no visible jump** across a 2-minute recording; the speed variation
  stays under 15% except at line ends.
- Loupe highlights stay in a fixed screen-space position (the lamp side) while the loupe moves. Its
  shadow offset grows and blurs when it "lifts" between lines.
- Ambient scene: ≤ 4 ms per frame main-thread at 60 fps on the reference desktop; 0 ms when the tab is hidden.
- Every prop passes the 400% edge check: no green, white or grey fringe.
- All loops pass the SSIM seam check (≥ 0.98, first vs last frame).
- Sound off by default; when on, every UI sound ≤ 250 ms and ≤ −14 LUFS, and there's a master mute.

## Risks
| Risk | Mitigation |
|---|---|
| Generated assets inconsistent in lighting | One lighting description re-used verbatim in every brief (see "Lighting bible" in asset-briefs) and generation from the same reference image |
| Generation takes many attempts | Start week 1. Coded fallbacks exist for every asset (the current UI keeps working) |
| Ambient motion distracts during a round | Ambient intensity drops to 20% inside a round and pauses while typing |

See [loupe-rebuild.md](loupe-rebuild.md), [background-scenes.md](background-scenes.md),
[sound.md](sound.md), [asset-briefs.md](asset-briefs.md) and [tasks.md](tasks.md).

## Progress

**Batch 1 (15 Oct):** desk day/dusk/night, loupe still, floating stamp, loupe pass-by clip.
- ☑ V04-02 `cutout.py` (green key, despill, erode, fringe check, lens measurement), plus `plates.py` and `stamp_clip.py`.
- ☑ V04-04 closed reading loop in `lib/motion/path.ts`. Tested: max speed change 4 px/s per frame, never below reading speed, no jump at the wrap.
- ◐ V04-05 new loupe: layered prop at its real angle, warm glass, lagging reflection. Barrel distortion not done yet.
- ☑ V04-06 procedural shadow (sharp and soft silhouettes, mixed by height).
- ☑ V04-07 loader uses the new loupe. The loupe may now overhang the paper.
- ◐ V04-11 dusk plate by local hour (`data-daypart`). Surface variants wait for v0.3 settings.
- ◐ V04-12 floating stamp on phones. Per-verdict clips are still to come.
- Not used: the loupe pass-by clip (`assets-src/batch1/loupe-pass.mp4`). The lens has to show the student's real text magnified, which a video can't do. It could become a title-screen flourish later.
- The desk scrim is now radial (lighter at the edges), so the photos actually show.

**Batch 2 (16 Oct):** two folders, three paper textures, coffee steam.
- ☑ A-09 folders: the menu uses the aged folder, sliced so each tab sits at a different spot (filing-drawer stagger), with the number typed in the tab's label window. Corners and tab sit on top of an unbroken edge; side-by-side pieces left hairline seams.
- ☑ Paper grain on every card (`.paper`), and manila index cards in the archive.
- ☑ A-10 steam: isolated from the mug, a 3 s seamless loop (seam step = normal frame step), screened over the photo's mug on the home page, positioned from the photo's cover-crop.
- ☐ `folder-clean.jpg` is lined up for V02-16 (setup page as an open folder). `tex-kraft.jpg` is spare.

**Batch 3 (16 Oct):** 12 avatar pins, 12 badge pins, desk calendar, ink smear.
- ☑ Avatars and badges cut into single pins (`public/assets/avatars`, `public/assets/badges`), ready for v0.3 profiles and badges. 8 badges still to generate (brief A-12b).
- ☑ Desk calendar on the home page (wide screens): this month, red-pen crosses on days with a closed case, today ringed.
- ☑ Verdict stamps use the real ink smear as their wear mask.
- ☑ Steam is now an easter egg: hover the mug for a wisp, click for a proper pour; video only decodes while showing.
- ☐ Lamp: generate the night photo with the lamp off (brief A-13b) instead of a separate lamp prop.

**Batch 4 (16 Oct):** the night desk with the lamp off.
- ☑ At night the title card starts dark and the lamp flickers on (the lamp-off photo crossfades away); clicking the lamp on the home page switches it off and on again. Dust, glow, folders and calendar dim with it. Day and dusk are unaffected.

**Batch 6 (16 Oct):** the last 8 badges, the lamp switch-on clip, closed and open folders.
- ☑ All 20 badge pins now have art.
- ☑ The title card's lamp switch-on is real footage played exactly over the photo (aligned by feature matching), then handed back to the photo; clicking the lamp on again replays it. The coded flicker remains the fallback.
- ☑ New case: the folder opens in 3D (built from the two stills; the generated opening clip cut to a different folder halfway). The sheet inside lifts and the setup form appears in its place.
- ☐ Per-verdict stamp clips and the calendar page flip are still optional.
- ☑ Folder opening fixes: the menu stack, title and calendar now clear away instead of showing under the folder; no full-folder `filter` (it flattened the 3D flip); the open folder is held across navigation and the sheet flies onto the setup form's exact spot, then fades to reveal it (no dark gap, no double dimming, no form popping in late).
