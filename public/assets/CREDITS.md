# Asset credits

| File | Source | Processing |
|---|---|---|
| `desk/desk-{day,dusk,night}[@2048].{avif,webp}` | Generated in Google Flow (Nano Banana), batch 1, 15 Oct 2026, briefs A-01/A-02/A-03; upscaled to 2000 px in Flow, 16 Oct | `scripts/assets/plates_hd.py`: both sparkle marks removed (handle mark patched from the 1376-px original, rim mark inpainted); AVIF + WebP at 1376 and 2048 px; checked aligned with the originals (<1 px) |
| `props/loupe.{avif,webp}` | Generated in Google Flow (Nano Banana), batch 1, brief A-05 | `scripts/assets/cutout.py`: green key, despill, 1 px erode, no shadow; resized to 640 px |
| `fx/stamp-floating.{webm,mp4}` | Generated in Google Flow (Veo), batch 1, brief A-08 | `scripts/assets/stamp_clip.py`: flat-fielded to pure white, frames 0–80, 1.4× speed, cropped to x 300–1000 |
| `folder/folder-*.webp` | Google Flow (Nano Banana), batch 2, 16 Oct 2026, brief A-09 (aged manila folder) | `scripts/assets/folder_kit.py`: green key, mark filled, sliced into corners/edge/tab/foot; edges mirrored so they tile |
| `texture/grain-{paper,manila}.webp` | Google Flow (Nano Banana), batch 2, brief A-09 | `folder_kit.py`: mark filled, flattened to white so only fibres remain (multiplied over the theme colour) |
| `fx/steam.{webm,mp4}` | Google Flow (Veo), batch 2, brief A-10 | `scripts/assets/steam_loop.py`: steam isolated from the mug (min/median), 3 s seamless crossfade loop |
| `desk/desk-night-off[@2048].{avif,webp}` | Nano Banana edit of the night desk photo, lamp switched off, 16 Oct 2026, brief A-13b; upscaled in Flow | `plates_hd.py`, as above; aligned with the lit night photo (<1 px) so they crossfade |
| `avatars/*.webp` (12) | Google Flow (Nano Banana), batch 3, 16 Oct 2026, brief A-11 | `scripts/assets/batch3.py`: keyed, split by the gaps between pins, 256 px squares |
| `badges/*.webp` (12) | Google Flow (Nano Banana), batch 3, brief A-12 | `batch3.py`: as avatars. Note: "polymath" also reads "Did the reading" |
| `props/calendar.webp` | Google Flow (Nano Banana), batch 3, brief A-13 | `batch3.py`: keyed by colour distance from its muted green; ring reflections neutralised |
| `texture/ink.webp` | Google Flow (Nano Banana), batch 3 | `batch3.py`: alpha mask from the ink smear; masks the verdict stamps |
| `badges/*.webp` (8 more) | Google Flow (Nano Banana), batch 6, 16 Oct 2026, brief A-12b | `batch3.py --badges2`: the sheet repeats its middle row, so the first 8 of 12 are used |
| `fx/lamp-on.{webm,mp4}` | Google Flow (Veo), batch 6: start frame lamp-off photo, end frame night photo | Trimmed to 0.3–2.3 s. Measured against the photo: scale 0.9373, offset (−4.9, 0.2) px, no rotation, <0.5 px drift; its sparkle mark is masked in CSS |
| `folder/open-{base,cover,inside,paper}.webp` | Google Flow (Nano Banana), batch 6: closed and open manila folders | Keyed; cut into the closed folder, its cover, the inside of the cover and the sheet, for the code-built opening (`components/FolderOpen.tsx`) |
| `stamp.{webm,mp4}` | Generated in Google Flow (Veo), earlier upload | Hand stamping blank paper; used on wide screens |

Sources live in `assets-src/` (not committed). Batch 2 extras not used yet: `folder-clean.jpg` (lined up for the setup page as an open folder) and `tex-kraft.jpg`.
