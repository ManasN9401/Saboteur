"""2K desk photos: remove the generator's sparkle marks, then export the plate sizes (roadmap A-01…03).

    python3 -I scripts/assets/plates_hd.py SRC_DIR ORIGINALS_DIR OUT_DIR name [name...]

Upscaled renders carry two marks: a small new sparkle on the mug handle, and (on some) the old mark
from the 1376-px original, enlarged, on the mug's rim. Each is found by how much brighter it is than
its blurred surroundings, then:
- the small one is patched from the 1376-px original, which is clean at that spot;
- the large one is inpainted from its surroundings and re-grained.
Outputs keep the existing names: NAME.{avif,webp} at 1376 px and NAME@2048.{avif,webp}.
"""
import sys

import cv2
import numpy as np
from PIL import Image

ORIG_W = 1376
# Search windows (in 2000-px coordinates) and the expected size of each mark.
MARKS = [
    {"name": "handle", "box": (1860, 980, 1975, 1090), "centre": (1917, 1033), "patch_from_original": True},
    # Only some renders have this one: the 1376-px original's mark (1277.5, 671) scaled to 2000 px.
    {"name": "rim", "box": (1790, 905, 1930, 1045), "centre": (1857, 975), "patch_from_original": False},
]


def find_mark(gray: np.ndarray, box, centre) -> np.ndarray:
    x0, y0, x1, y1 = box
    region = gray[y0:y1, x0:x1].astype(np.float32)
    bg = cv2.medianBlur(gray, 61)[y0:y1, x0:x1].astype(np.float32)
    excess = region - bg
    m = (excess > 22).astype(np.uint8)
    # Keep the largest bright blob: the star. Small specular glints on the mug are ignored.
    n, labels, stats, centroids = cv2.connectedComponentsWithStats(m)
    full = np.zeros(gray.shape, np.uint8)
    if n <= 1:
        return full
    biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    if stats[biggest, cv2.CC_STAT_AREA] < 120:
        return full
    # A bright blob somewhere else (the mug's rim catching light) is not the mark.
    cx, cy = centroids[biggest]
    if abs(x0 + cx - centre[0]) > 12 or abs(y0 + cy - centre[1]) > 12:
        return full
    blob = (labels == biggest).astype(np.uint8)
    blob = cv2.morphologyEx(blob, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    blob = cv2.dilate(blob, np.ones((7, 7), np.uint8))
    full[y0:y1, x0:x1] = blob
    return full


def regrain(img: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Inpainting is smooth; borrow the surrounding grain so the fill doesn't look painted."""
    ring = cv2.dilate(mask, np.ones((15, 15), np.uint8)) & ~mask.astype(bool)
    ring = ring.astype(bool)
    smooth = cv2.GaussianBlur(img, (0, 0), 1.5).astype(np.float32)
    sd = (img.astype(np.float32) - smooth)[ring].std(axis=0)
    rng = np.random.default_rng(11)
    out = img.astype(np.float32)
    m = mask.astype(bool)
    out[m] += rng.normal(0, 1, (m.sum(), 3)) * sd * 0.9
    return np.clip(out, 0, 255).astype(np.uint8)


def clean(src: np.ndarray, original: np.ndarray, name: str) -> np.ndarray:
    img = src.copy()
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    for mark in MARKS:
        mask = find_mark(gray, mark["box"], mark["centre"])
        if not mask.any():
            print(f"  {name}: no {mark['name']} mark")
            continue
        ys, xs = np.nonzero(mask)
        print(f"  {name}: {mark['name']} mark at ({xs.mean():.0f}, {ys.mean():.0f}), {mask.sum()} px")
        if mark["patch_from_original"]:
            up = cv2.resize(original, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_CUBIC)
            # Match the original's colour to this render around the patch, then feather it in.
            ring = (cv2.dilate(mask, np.ones((21, 21), np.uint8)) - mask).astype(bool)
            gain = (img[ring].astype(np.float32).mean(axis=0) + 1) / (up[ring].astype(np.float32).mean(axis=0) + 1)
            patch = np.clip(up.astype(np.float32) * gain, 0, 255)
            soft = cv2.GaussianBlur(cv2.dilate(mask, np.ones((5, 5), np.uint8)).astype(np.float32), (0, 0), 3)[..., None]
            img = np.clip(img * (1 - soft) + patch * soft, 0, 255).astype(np.uint8)
            img = regrain(img, mask)
        else:
            img = cv2.inpaint(img, mask, 9, cv2.INPAINT_TELEA)
            img = regrain(img, mask)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return img


def main():
    src_dir, orig_dir, out_dir, names = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]
    for name in names:
        src = cv2.imread(f"{src_dir}/{name}.jpg")
        original = cv2.imread(f"{orig_dir}/{name}.jpg")
        cleaned = Image.fromarray(cv2.cvtColor(clean(src, original, name), cv2.COLOR_BGR2RGB))
        cleaned.save(f"{src_dir}/{name}.clean.png")
        for w, suffix in ((ORIG_W, ""), (2048, "@2048")):
            plate = cleaned.resize((w, round(cleaned.height * w / cleaned.width)), Image.LANCZOS)
            plate.save(f"{out_dir}/{name}{suffix}.avif", quality=60)
            plate.save(f"{out_dir}/{name}{suffix}.webp", quality=82, method=6)
        print(name, "done")


if __name__ == "__main__":
    main()
