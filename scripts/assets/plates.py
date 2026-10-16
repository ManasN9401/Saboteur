"""Desk plates: remove the generator's sparkle mark, then export AVIF + WebP (roadmap V04-03).

    python3 -I scripts/assets/plates.py SRC_DIR OUT_DIR name [name...]

The sparkle sits in the same place on every 1376×768 render (bottom-right). It is filled by a
harmonic (Laplace) fill from its surroundings, then re-grained so the patch doesn't look smooth.
"""
import sys

import numpy as np
from PIL import Image, ImageFilter

STAR = (1277.5, 671.0, 27.0)  # centre x, centre y, arm length in source pixels
WIDTHS = (1376, 2048)  # 1376 = native; 2048 is a gentle upscale for large screens


def star_mask(w: int, h: int) -> np.ndarray:
    cx, cy, r = STAR
    yy, xx = np.mgrid[0:h, 0:w]
    dx, dy = np.abs(xx - cx) / r, np.abs(yy - cy) / r
    m = (dx ** (2 / 3) + dy ** (2 / 3) <= 1.0) | (np.hypot(dx, dy) < 0.32)
    m_img = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))
    return np.asarray(m_img) > 0


def fill(img: np.ndarray, mask: np.ndarray) -> np.ndarray:
    out = img.copy()
    ys, xs = np.nonzero(mask)
    y0, y1, x0, x1 = ys.min() - 2, ys.max() + 3, xs.min() - 2, xs.max() + 3
    sub, m = out[y0:y1, x0:x1].copy(), mask[y0:y1, x0:x1]
    sub[m] = sub[~m].mean(axis=0)
    for _ in range(1500):
        avg = (np.roll(sub, 1, 0) + np.roll(sub, -1, 0) + np.roll(sub, 1, 1) + np.roll(sub, -1, 1)) / 4
        sub[m] = avg[m]
    # Borrow the grain from the ring around the hole so the fill matches the photo's texture.
    ring = np.asarray(Image.fromarray(m.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(9))) > 0
    ring &= ~m
    src = out[y0:y1, x0:x1]
    smooth = np.asarray(Image.fromarray(np.clip(src, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32)
    grain_sd = (src - smooth)[ring].std(axis=0)
    rng = np.random.default_rng(7)
    sub[m] += rng.normal(0, 1, (m.sum(), 3)) * grain_sd
    out[y0:y1, x0:x1] = sub
    return out


def main():
    src_dir, out_dir, names = sys.argv[1], sys.argv[2], sys.argv[3:]
    for name in names:
        im = Image.open(f"{src_dir}/{name}.jpg").convert("RGB")
        arr = np.asarray(im).astype(np.float32)
        clean = Image.fromarray(np.clip(fill(arr, star_mask(im.width, im.height)), 0, 255).astype(np.uint8))
        for w in WIDTHS:
            size = (w, round(im.height * w / im.width))
            plate = clean if w == im.width else clean.resize(size, Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.2, 40, 2))
            suffix = "" if w == WIDTHS[0] else f"@{w}"
            plate.save(f"{out_dir}/{name}{suffix}.avif", quality=58)
            plate.save(f"{out_dir}/{name}{suffix}.webp", quality=80, method=6)
        print(name, "done")


if __name__ == "__main__":
    main()
