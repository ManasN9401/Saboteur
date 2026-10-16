# Asset briefs (Flow / Veo / Nano Banana)

Copy-paste prompts. Each lists its **use**, **deliverable** and **checks**. Generate 4 and pick 1.

## Lighting bible (paste into every image prompt)
> Lighting: a single warm tungsten desk lamp from the **upper-left**, about 45° elevation, colour
> temperature 3200K, plus a soft cool fill from the right at a quarter of the intensity. Soft-edged
> highlights. Realistic material response. Photographic, 85mm lens look, shallow but not extreme depth of field.

For **cut-out props** add:
> Isolated object on a perfectly flat pure chroma green (#00FF00) background, evenly lit background, **no
> cast shadow, no contact shadow, no reflection on the ground**, no vignette. Sharp clean silhouette edges.
> Orthographic top-down view, camera directly above.

For **multiply-blend footage** use a pure white (#FFFFFF) background instead of green.

---

## A-01 · Desk plate, oak, night (replaces `desk-night.webp`)
**Use:** background plate on every page in night theme. **Deliverable:** 2560×1600 and 1440×2560
(portrait, mobile) AVIF and WebP.
> Top-down photograph of a dark oak detective's desk at night. The centre 60% of the frame is **clear,
> empty wood grain**, with nothing on it. Around the edges only: a brass banker's lamp (top-left corner, partly out of
> frame, its light pooling warmly toward the centre), a small brass desk clock (top-right), a ceramic
> coffee mug with a faint ring stain (bottom-right, partially cropped), two pencils, a paperclip and a
> folded newspaper corner (bottom-left, cropped). Moody, warm, cinematic, low-key lighting; edges fall off
> into deep shadow. [Lighting bible.] No text, no logos, no people.

**Checks:** the centre is truly empty; the lamp position matches the bible; there are no readable words.

## A-02 · Desk plate, oak, day
Same as A-01, but: "daytime; soft daylight from a window to the right is the main light, the lamp is
switched off; brighter, airy, neutral-warm tones". Keep the prop layout identical. Generate from A-01 as
a reference image so they line up for crossfading.

## A-03 · Desk plate, dusk (optional, for time-of-day auto)
A-01 composition, "golden hour, orange sunlight raking from the right, the lamp just switched on".

## A-04 · Alternative surfaces (flexible)
Same composition on walnut, green baize/leather writing pad, and brushed steel. One prompt each. Use A-01
as a reference.

## A-05 · Magnifying glass, rebuild (replaces `loupe.webp`)
**Use:** loader loupe, layers per [loupe-rebuild.md](loupe-rebuild.md). **Deliverable:** 1024 px
long-edge PNG with alpha (after keying), two lighting passes.
> A vintage brass magnifying glass lying flat, seen from directly above, **rotated so the handle points
> toward the lower-right at about 35 degrees**. Polished brass rim with a fine knurled edge and slight
> patina, turned wooden or brass handle with a ball end. **The lens is completely clear and empty, showing only
> the green background through it, with no reflection or refraction of anything.** [Lighting bible.] [Cut-out
> addendum.]

Pass 2 (spec layer), with the same prompt plus: "studio lighting identical but with **strong, crisp
specular highlights** on the rim and handle". Diff the passes for the `-spec` layer.

**Checks:**
- the lens interior keys out completely (it becomes our live glass);
- the highlights are on the **upper-left** of the rim;
- there's zero shadow on the green;
- the rim is a near-perfect circle (measure the lens centre and radius, and record them in `lib/assets.ts`).

## A-06 · Loupe "lift" reference (optional)
A 2 s Veo clip of the same loupe lifting 3 cm off paper and setting down, on white, for timing reference
only. It's not shipped.

## A-07 · Stamp footage, per verdict (extends `stamp.mp4`)
**Use:** reveal verdicts. **Deliverable:** 3 clips, each 1.2–1.5 s, 1080×1680, white background.
> Top-down, locked-off camera. A hand in a dark navy shirt cuff holds a wooden rubber stamp with a red
> rubber face, presses it firmly onto a sheet of pure white paper, holds 4 frames, and lifts cleanly out of
> frame toward the lower-right. **The paper stays pure white: no ink mark is left** (we draw the mark in
> code). Even, shadowless, overhead lighting except a soft natural shadow from the hand. 24 fps. No text.

Variants: the stamp handle is red (catch), grey (miss), amber (false flag), so the object hints at the verdict.
**Checks:** the frame before and after the hand is pure white (≥ 250 in every channel) so multiply hides it.

## A-08 · Floating stamp (no hand), the mobile alternative
> Top-down, a wooden rubber stamp with no hand floats down from above into frame, rotates slightly,
> presses onto pure white paper with a tiny squash, then rises and leaves. Soft shadow under the stamp
> that sharpens as it approaches the paper. Pure white background, 24 fps, 1.2 s.

The shadow here is acceptable **because** it's footage composited with multiply (white disappears, the
shadow darkens the card naturally). Keep it soft and short.

## A-09 · Menu folders and paper textures
**Use:** v0.2 menu skins. **Deliverable:** tileable textures at 1024² WebP.
1. "Seamless tileable texture of a manila folder card stock, subtle fibres, slight wear, flat even
   lighting, no shadows, no edges visible" (tileable).
2. "Seamless tileable off-white typing paper texture, faint fibres, very subtle." (Replaces the CSS noise
   if it's better.)
3. "A manila folder **tab** top-down, cut-out, with a slightly dog-eared corner, blank label area."
   [Cut-out addendum.] Used as a 9-slice border image.

## A-10 · Coffee steam loop
> Close top-down view into a black coffee mug, thin wisps of steam rising and curling slowly, dark
> background, **seamless 6-second loop**, 24 fps, 720×720.

**Check:** the SSIM seam is ≥ 0.98. Otherwise use the crossfade loop.

## A-11 · Agent badge avatars (12)
**Use:** profile avatars. **Deliverable:** 512² PNG with alpha.
> A set of flat-illustrated enamel pin badges for a detective agency, each a different animal silhouette
> (owl, fox, raven, cat, hound, heron, otter, hare, badger, stag, magpie, tortoise) inside a circular brass
> border, limited palette (brass, oxblood red, navy, cream), subtle enamel shine, centred, plain
> background. Consistent style across all twelve.

Generate as one sheet for a consistent style, then slice it.

## A-12 · Badges / achievement pins (20)
Same style as A-11, with symbols instead of animals (magnifier, stamp, flame, snowflake, calendar,
crossed pens, eye, lightbulb, compass, scale, …). See the badge list in [v0.3 streaks](../v0.3-identity/streaks.md#badges).

## A-13 · Desk calendar and lamp props (interactive)
Top-down cut-outs on green, no shadow, each a separate image:
- a flip desk calendar with blank date page;
- a green banker's lamp seen from above, with shade, both "off" and "on" (the bulb glow on the shade
  interior only).

## A-14 · Title wordmark texture (optional)
"Rubber-stamped letterpress ink texture, red, slightly uneven coverage, on transparent", used as a mask
over the SVG wordmark.

---

## Video settings for Flow (Veo)
- Aspect: 9:16 for the stamps, 1:1 for loops, 16:9 for plates.
- Use **Start frame + End frame** for loops: generate the start image in Nano Banana, then use the
  **same image as both start and end** to force a seamless loop.
- Use "Camera: locked-off, static, no zoom, no pan" in every prompt.
- Export at the highest quality. We transcode ourselves.

---

## Batch 4 briefs (16 Oct)

### A-13b · Desk lamp: edit the desk photo, don't generate a separate lamp
Top-down lamps on their own keep coming out wrong (warped shades, impossible arms). The lamp is
already in the desk photos, lit correctly, so make an **edited copy of the night photo with the lamp
off**. The app then crossfades off → on when the title card opens, and the light pool appears
exactly where the real lamp is.

Nano Banana, **edit mode**, attach `assets-src/batch1/desk-night.jpg`:
> Edit this photo. Switch the green banker's lamp in the top-left corner OFF: the green glass shade is
> unlit and darker, with only a faint cool reflection from the room; remove the warm pool of lamplight
> on the desk and the warm glow on the lamp's brass base. The room is now lit only by dim, cool
> moonlight from the right. Keep everything else exactly the same: same camera, same framing, same
> objects in the same places, same wood grain. Do not add or move anything.

If it changes the composition, add: "Pixel-aligned with the original; only the lighting changes."
Then (optional, for flicker) in Flow/Veo use **Start frame = lamp off, End frame = the original night
photo**: "Locked-off camera. The desk lamp clicks on: the bulb flickers twice, then warms up to full
brightness over one second. Nothing moves." 1.5 s.

### A-12b · The other 8 badge pins
Same style as the first sheet, one sheet of 8 (4 × 2) on pure #00FF00. Spell the text exactly:
> A set of eight enamel pin badges for a detective agency, same style as the reference: circular brass
> border, limited palette of brass, oxblood red, navy and cream, subtle enamel shine, curved text around
> the top edge. 1) "WEEK ON THE CASE" with a magnifying glass over a calendar; 2) "STAKEOUT" with a
> crescent moon over binoculars; 3) "CENTURION" with a laurel wreath around the number 100;
> 4) "DID THE READING" with an open notebook and pen; 5) "OFF THE GRID" with a candle; 6) "COMEBACK"
> with a phoenix feather; 7) "CORONER" with a toe tag on string; 8) "ROOT CAUSE" with tree roots.
> Isolated on a perfectly flat pure green #00FF00 background, no cast shadow, top-down.

Attach the first badge sheet as a style reference.

### Worth animating (Veo, start/end frames)
| Asset | Clip | Why |
|---|---|---|
| Lamp off → on | as above, 1.5 s | the title card's "lamp clicks on" moment, real flicker |
| Folder opening | Start = closed `folder-clean.jpg`, End = an open folder top-down (generate first): "the front cover lifts and folds back to reveal blank paper inside", 1.2 s, pure green background | transition from **New case** into the setup form |
| Calendar page flip | Start = calendar, End = same calendar: "the top page flips up over the spiral binding and falls away, revealing an identical blank page", 1 s, green background | new month / streak milestone |
| Stamp per verdict (A-07) | as briefed | three verdict colours |

Not worth a video (done better in code): badges and avatars (a code glint and drop), the loupe, clock
hands, steam (already done), dust.
