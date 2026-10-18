"""Batch 3: avatar pins, badge pins, desk calendar, stamp ink (roadmap A-11, A-12, A-13).

    python3 scripts/assets/batch3.py SRC_DIR OUT_DIR
    python3 scripts/assets/batch3.py SRC_DIR OUT_DIR --badge NAME   # one pin, SRC_DIR/NAME.jpg (later badges)

- Pin sheets (4 × 3 on green) are keyed, then split into single pins by the empty gaps between them.
- The calendar sits on a muted green, not chroma green, so it is keyed by colour distance instead.
- The ink smear becomes an alpha mask that gives stamped verdicts a real rubber-stamp texture.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutout import despill, key, remove_specks  # noqa: E402
from plates import fill, star_mask  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AVATARS = ["owl", "fox", "raven", "otter", "cat", "hound", "heron", "hare", "badger", "stag", "magpie", "tortoise"]
# The second badge sheet (batch 6) repeats its middle row as its last row: only the first 8 are used.
BADGES_2 = ["week-on-the-case", "stakeout", "centurion", "did-the-reading", "off-the-grid", "comeback", "coroner", "root-cause"]
BADGES = ["recruit", "first-case", "red-handed", "clean-hands", "devious-mind", "honest-doubt",
          "measured", "on-the-beat", "regular", "polymath", "night-owl", "line-up"]


def load(path: str) -> np.ndarray:
    im = Image.open(path).convert("RGB")
    return fill(np.asarray(im).astype(np.float32), star_mask(*im.size))


def finish(rgb: np.ndarray, alpha: np.ndarray, erode: int = 1) -> Image.Image:
    a = Image.fromarray((np.clip(alpha, 0, 1) * 255).astype(np.uint8))
    for _ in range(erode):
        a = a.filter(ImageFilter.MinFilter(3))
    alpha = np.asarray(a.filter(ImageFilter.GaussianBlur(0.6))).astype(np.float32) / 255
    return Image.fromarray(np.dstack([despill(rgb, alpha), alpha * 255]).astype(np.uint8), "RGBA")


def spans(profile: np.ndarray, min_gap: int = 12):
    """Runs of occupied positions in a 1-D occupancy profile, split by empty gaps."""
    occupied = profile > 0
    out, start, gap = [], None, 0
    for i, on in enumerate(occupied):
        if on:
            if start is None:
                start = i
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                out.append((start, i - gap + 1))
                start, gap = None, 0
    if start is not None:
        out.append((start, len(occupied)))
    return out


def split_sheet(path: str, names: list[str], out_dir: str, size: int = 256, expect: int | None = None):
    rgb = load(path)
    alpha = remove_specks(key(rgb))
    sheet = finish(rgb, alpha)
    solid = np.asarray(sheet)[..., 3] > 128
    rows = [r for r in spans(solid.sum(axis=1)) if r[1] - r[0] > 60]
    cells = []
    for y0, y1 in rows:
        cols = [c for c in spans(solid[y0:y1].sum(axis=0)) if c[1] - c[0] > 60]
        cells += [(x0, y0, x1, y1) for x0, x1 in cols]
    assert len(cells) == (expect or len(names)), f"{path}: found {len(cells)} pins, expected {expect or len(names)}"
    os.makedirs(out_dir, exist_ok=True)
    for name, (x0, y0, x1, y1) in zip(names, cells):
        pin = sheet.crop((x0 - 4, y0 - 4, x1 + 4, y1 + 4))
        side = max(pin.size)
        square = Image.new("RGBA", (side, side))
        square.paste(pin, ((side - pin.width) // 2, (side - pin.height) // 2))
        square.resize((size, size), Image.LANCZOS).save(f"{out_dir}/{name}.webp", quality=88, method=6)
    print(os.path.basename(path), "→", len(cells), "pins, kept", len(names))


def calendar(path: str, out: str):
    rgb = load(path)
    bg = np.median(np.concatenate([rgb[:20].reshape(-1, 3), rgb[-20:].reshape(-1, 3)]), axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    # Grey metal rings are only ~60 away from this muted green, so key gently and keep them opaque.
    alpha = remove_specks(np.clip((dist - 22) / 22, 0, 1))
    a = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    alpha = np.asarray(a).astype(np.float32) / 255
    # Neutralise the green the rings and edges reflect (cap green at the red/blue level: grey, not magenta).
    col = rgb.copy()
    col[..., 1] = np.minimum(col[..., 1], np.maximum(col[..., 0], col[..., 2]) + 4)
    im = Image.fromarray(np.dstack([col, alpha * 255]).astype(np.uint8), "RGBA")
    im = im.crop(im.getbbox())
    w = 760
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(out + ".webp", quality=88, method=6)
    print("calendar", im.size)


def ink(path: str, out: str):
    rgb = load(path)
    alpha = key(rgb)
    a = Image.fromarray((alpha * 255).astype(np.uint8))
    a = a.crop(a.getbbox())
    # Use the dense left two-thirds: stamps should be mostly solid with worn patches.
    a = a.crop((0, 0, int(a.width * 0.62), a.height)).resize((720, round(a.height * 720 / (a.width))), Image.LANCZOS)
    mask = Image.new("RGBA", a.size, (0, 0, 0, 0))
    mask.putalpha(a)
    mask.save(out + ".webp", quality=85, method=6)
    print("ink mask", a.size, "coverage", round(float((np.asarray(a) > 128).mean()), 2))


def main():
    src, out = sys.argv[1], sys.argv[2]
    if len(sys.argv) > 4 and sys.argv[3] == "--badge":
        split_sheet(f"{src}/{sys.argv[4]}.jpg", [sys.argv[4]], f"{out}/badges", expect=1)
        return
    if len(sys.argv) > 3 and sys.argv[3] == "--badges2":
        split_sheet(f"{src}/badges2.jpg", BADGES_2, f"{out}/badges", expect=12)
        return
    split_sheet(f"{src}/avatars.jpg", AVATARS, f"{out}/avatars")
    split_sheet(f"{src}/badges.jpg", BADGES, f"{out}/badges")
    # The keyed calendar is an input to desk_props.py, not served: it goes with the sources.
    os.makedirs(f"{ROOT}/assets-src/props", exist_ok=True)
    calendar(f"{src}/calendar.jpg", f"{ROOT}/assets-src/props/calendar")
    os.makedirs(f"{out}/texture", exist_ok=True)
    ink(f"{src}/ink.jpg", f"{out}/texture/ink")
    with open(f"{out}/manifest.json", "w") as f:
        json.dump({"avatars": AVATARS, "badges": BADGES}, f, indent=2)


if __name__ == "__main__":
    main()
