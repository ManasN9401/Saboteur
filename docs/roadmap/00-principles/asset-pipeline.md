# Asset pipeline

How generated images, video and sound become production files. The detailed briefs live in
[`v0.4-art-and-motion/asset-briefs.md`](../v0.4-art-and-motion/asset-briefs.md).

## The rule that fixes today's problems
**Never bake lighting-dependent effects into a cut-out.** Every prop is delivered as separate layers:

| Layer | Content | Format |
|---|---|---|
| `*-albedo` | The object, lit flat and evenly from straight above, no cast shadow, no background | PNG/WebP with alpha, 2× display size |
| `*-shade` (optional) | Self-shading / ambient occlusion only | greyscale, multiplied in code |
| `*-spec` (optional) | Specular highlights only | greyscale, added in code (`mix-blend-mode: screen`) |
| Shadow | **Not an image.** Generated in code from the alpha mask (blurred, offset by height and light angle) | CSS `filter: drop-shadow` on a mask, or SVG `feGaussianBlur` |

This means:
- the object can rotate while its highlights stay put (highlights are re-placed for the light angle, not rotated);
- the shadow changes with "height" (a loupe lifting off the page casts a softer, further shadow);
- day and night desks re-light the same prop.

Where a prop **must** be photographic and will be shown at a single angle (desk plates, the stamp
footage), generate it **at that angle** rather than rotating it in CSS.

## Generation → production steps
1. **Generate** in Flow / Nano Banana using the brief. Always request a "pure flat #00FF00 green
   background" (or pure white for multiply footage), "no cast shadow", "orthographic top-down", plus the
   lighting described in the brief.
2. **Pick** the best of 4. Check the edges at 400% zoom.
3. **Cut out.** Use `scripts/assets/cutout.py`, which replaces the scratchpad `cut.py` (task V04-02):
   chroma key, despill, then a 1 px edge erode so there's no green fringe and no grey halo.
4. **Split layers** where the brief asks for it. Generate the object twice: once with diffuse lighting, and
   once with the same lighting plus strong speculars. The difference is the spec layer.
5. **Export:**
   - `sharp` to AVIF (q 55) and WebP (q 80) at 1× and 2×;
   - video to WebM VP9 (CRF 34) and MP4 H.264 (CRF 26), muted, with `faststart`;
   - loops checked frame 0 vs frame N with an SSIM diff (`ffmpeg -lavfi ssim`), where ≥ 0.98 passes.
6. **Register** in `lib/assets.ts` (task V04-03) with dimensions, anchor points (e.g. lens centre),
   licence/source note and `blurDataURL`.
7. **Budget check:** the totals per route stay within [performance-budgets.md](performance-budgets.md).

## Naming
`public/assets/<area>/<thing>[-variant]@<scale>x.<ext>`. Examples: `props/loupe-albedo@2x.avif`,
`desk/night-plate@1x.webp`, `fx/stamp-catch.webm`.

## Licence log
Keep `public/assets/CREDITS.md` with the tool, date and prompt reference for each file.
