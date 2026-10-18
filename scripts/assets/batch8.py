"""Batch 8: the red felt-tip pen.

    python3 -I scripts/assets/batch8.py SRC_DIR

The pen is on chroma green: mask the sparkle, key, despill, crop, export about 520 px long. It's the
source texture for scripts/assets/desk_props.py, which lights it into the desk photos.

Batch 8 also had a night-lit render of the calendar. It was aligned and used for a day, then replaced
by desk_props.py, which lights the calendar from the photos themselves (see git history for the
alignment code).
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutout import despill, key, remove_specks  # noqa: E402


def pen(src: str, out: str):
    rgb = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
    h, w = rgb.shape[:2]
    rgb[int(h * 0.8):, int(w * 0.86):] = (10, 225, 10)  # the sparkle mark
    alpha = remove_specks(key(rgb))
    a = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    alpha = np.asarray(a).astype(np.float32) / 255
    im = Image.fromarray(np.dstack([despill(rgb, alpha), alpha * 255]).astype(np.uint8), "RGBA")
    im = im.crop(im.getbbox())
    im = im.resize((520, round(im.height * 520 / im.width)), Image.LANCZOS)
    im.save(out, quality=88, method=6)
    print("pen", im.size)


def main():
    src = sys.argv[1]
    # The pen is an input to desk_props.py (which lights it into the desk photos), not served.
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    os.makedirs(f"{root}/assets-src/props", exist_ok=True)
    pen(f"{src}/pen.jpg", f"{root}/assets-src/props/pen.webp")


if __name__ == "__main__":
    main()
