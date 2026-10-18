"""Batch 7: the paper clip and the ruled index card on the New case folder's cover.

    python3 -I scripts/assets/batch7.py SRC_DIR OUT_DIR

Both were generated on chroma green. The generator's sparkle mark (bottom right) is masked out first,
then each prop is keyed, despilled, cropped to its outline and exported as WebP. For the index card it
also prints where the printed red line and blue rules fall, as fractions of the card's height, so the
CSS can sit typed text exactly on them.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutout import despill, key, remove_specks  # noqa: E402


def load(path: str) -> np.ndarray:
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    h, w = rgb.shape[:2]
    # The sparkle mark sits in the bottom-right corner, away from both props: paint it screen green.
    rgb[int(h * 0.8):, int(w * 0.86):] = (10, 225, 10)
    return rgb


def cut(rgb: np.ndarray, erode: int = 1) -> Image.Image:
    alpha = remove_specks(key(rgb))
    a = Image.fromarray((alpha * 255).astype(np.uint8))
    for _ in range(erode):
        a = a.filter(ImageFilter.MinFilter(3))
    alpha = np.asarray(a.filter(ImageFilter.GaussianBlur(0.6))).astype(np.float32) / 255
    im = Image.fromarray(np.dstack([despill(rgb, alpha), alpha * 255]).astype(np.uint8), "RGBA")
    return im.crop(im.getbbox())


def paperclip(src: str, out: str):
    im = cut(load(src)).rotate(90, expand=True, resample=Image.BICUBIC)
    # Steel is grey: dropping the colour also removes the faint magenta that green removal leaves on edges.
    px = np.asarray(im).astype(np.float32)
    grey = px[..., :3] @ np.array([0.3, 0.59, 0.11], np.float32)
    px[..., :3] = np.stack([grey * 1.02, grey, grey * 0.97], axis=-1).clip(0, 255)
    im = Image.fromarray(px.astype(np.uint8), "RGBA")
    im = im.crop(im.getbbox())
    im = im.resize((round(im.width * 240 / im.height), 240), Image.LANCZOS)
    im.save(out, quality=90, method=6)
    print("paperclip", im.size)


def index_card(src: str, out: str):
    im = cut(load(src))
    w = 900
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(out, quality=86, method=6)
    rgb = np.asarray(im.convert("RGB")).astype(np.float32)
    # The printed rules are faint: find them as rows darker than their neighbourhood, across the middle.
    lum = rgb[:, int(w * 0.3):int(w * 0.7)].mean(axis=2).mean(axis=1)
    local = np.convolve(lum, np.ones(15) / 15, mode="same")
    h = im.height
    rows = [y for y in range(3, h - 3) if local[y] - lum[y] > 6 and lum[y] <= lum[y - 1] and lum[y] <= lum[y + 1]]
    red, blue = rows[0], rows[1:]
    pitch = float(np.diff(blue).mean())
    print("index card", im.size, f"red line {red / h:.4f}h · first rule {blue[0] / h:.4f}h · pitch {pitch / h:.4f}h ({len(blue)} rules)")


def main():
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(f"{out}/props", exist_ok=True)
    paperclip(f"{src}/paperclip.jpg", f"{out}/props/paperclip.webp")
    index_card(f"{src}/index-card.jpg", f"{out}/props/index-card.webp")


if __name__ == "__main__":
    main()
