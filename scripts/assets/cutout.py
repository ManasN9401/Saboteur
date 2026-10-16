"""Cut a prop out of a chroma-green render (roadmap V04-02).

    python3 -I scripts/assets/cutout.py SRC.jpg OUT.png [--erode 1] [--json OUT.json]

Steps: key on green excess, despill, pull the edge in so no green fringe survives, crop to the
object. It never adds a shadow: shadows are drawn in code (decisions/002). With --json it also
measures the lens hole (the largest enclosed transparent region) for the loupe's anchor points.
"""
import argparse
import json
from collections import deque

import numpy as np
from PIL import Image, ImageFilter


def key(rgb: np.ndarray) -> np.ndarray:
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    excess = g - np.maximum(r, b)  # pure screen ≈ 200+, brass and wood ≤ 10
    return 1 - np.clip((excess - 18) / 60, 0, 1)


def despill(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    out = rgb.copy()
    cap = np.maximum(out[..., 0], out[..., 2]) * 1.02  # brass may be slightly greener than red
    out[..., 1] = np.minimum(out[..., 1], cap)
    # Semi-transparent edge pixels are a mix of object and screen: remove the screen's share.
    screen = np.array([10, 225, 10], np.float32)
    a = np.clip(alpha, 1e-3, 1)[..., None]
    mixed = (rgb - screen * (1 - a)) / a
    edge = ((alpha > 0.02) & (alpha < 0.98))[..., None]
    out = np.where(edge, np.clip(mixed, 0, 255), out)
    out[..., 1] = np.minimum(out[..., 1], np.maximum(out[..., 0], out[..., 2]) * 1.02)
    return out


def remove_specks(alpha: np.ndarray, min_size: int = 400) -> np.ndarray:
    """Keep only opaque regions bigger than min_size (drops the generator's sparkle mark)."""
    solid = alpha > 0.5
    seen = np.zeros_like(solid)
    h, w = solid.shape
    out = alpha.copy()
    for y0, x0 in zip(*np.nonzero(solid)):
        if seen[y0, x0]:
            continue
        q, comp = deque([(y0, x0)]), []
        seen[y0, x0] = True
        while q:
            y, x = q.popleft()
            comp.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and solid[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        if len(comp) < min_size:
            ys, xs = zip(*comp)
            y_lo, y_hi, x_lo, x_hi = max(min(ys) - 4, 0), max(ys) + 5, max(min(xs) - 4, 0), max(xs) + 5
            out[y_lo:y_hi, x_lo:x_hi] = 0
    return out


def lens_hole(alpha: np.ndarray) -> dict:
    """Centre and radius of the transparent region enclosed by the rim."""
    clear = alpha < 0.5
    h, w = clear.shape
    outside = np.zeros_like(clear)
    q = deque((y, x) for y in range(h) for x in (0, w - 1) if clear[y, x])
    q.extend((y, x) for x in range(w) for y in (0, h - 1) if clear[y, x])
    for y, x in q:
        outside[y, x] = True
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and clear[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True
                q.append((ny, nx))
    hole = clear & ~outside
    ys, xs = np.nonzero(hole)
    cx, cy = xs.mean(), ys.mean()
    r = float(np.sqrt(hole.sum() / np.pi))
    return {"cx": round(float(cx), 1), "cy": round(float(cy), 1), "r": round(r, 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--erode", type=int, default=1)
    ap.add_argument("--json")
    ap.add_argument("--max-width", type=int, default=0)
    args = ap.parse_args()

    rgb = np.asarray(Image.open(args.src).convert("RGB")).astype(np.float32)
    alpha = remove_specks(key(rgb))
    a_img = Image.fromarray((alpha * 255).astype(np.uint8))
    for _ in range(args.erode):
        a_img = a_img.filter(ImageFilter.MinFilter(3))
    a_img = a_img.filter(ImageFilter.GaussianBlur(0.6))
    alpha = np.asarray(a_img).astype(np.float32) / 255
    col = despill(rgb, alpha)

    rgba = Image.fromarray(np.dstack([col, alpha * 255]).astype(np.uint8), "RGBA")
    box = rgba.getbbox()
    rgba = rgba.crop(box)
    if args.max_width and rgba.width > args.max_width:
        rgba = rgba.resize((args.max_width, round(rgba.height * args.max_width / rgba.width)), Image.LANCZOS)
    rgba.save(args.out)

    # Fringe check: no visible pixel on the edge may still be green.
    arr = np.asarray(rgba).astype(int)
    vis = arr[..., 3] > 20
    green = vis & (arr[..., 1] > np.maximum(arr[..., 0], arr[..., 2]) + 40)
    print(f"{args.out}: {rgba.size}, green fringe pixels: {int(green.sum())}")

    if args.json:
        meta = {"width": rgba.width, "height": rgba.height, "lens": lens_hole(np.asarray(rgba)[..., 3] / 255)}
        with open(args.json, "w") as f:
            json.dump(meta, f, indent=2)
        print(meta)


if __name__ == "__main__":
    main()
