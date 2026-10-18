"""Batch 12: the camera move from the desk to the clock (regenerated), and the suspect placard for v0.8.

    python3 -I scripts/assets/batch12.py SRC_DIR OUT_DIR [pan] [placard]

Pan (pan.mp4, Veo, 8 s at 1080p): starts on the night desk photo and comes down to the clock standing
on the desk, face on. The clock stays the same clock all the way (the batch 10 take turned it into
another one). Each frame has the sparkle and the "Veo" mark painted out, and a fleck of dust that
drifts into the top right corner near the end. The footage is a little darker and less blue than the
photo it starts from, so every frame gets the same per-channel gain, measured on the first frame, so
the photo hands over to the video without a jump. Sped up to about a second and a half (about 60 fps),
with a reversed copy for leaving.

Its last frame becomes the close-up the clock view holds on (clock/close.webp: the batch 11 still was
the brief for it, but the footage ends on its own frame, and the close-up has to be that frame). Its
hub and minute track are measured for CLOSE in components/Clock.tsx, and the first frame's alignment
with the night photo for PAN.

Placard (letterboard.jpg, on green): the black letter board, keyed and cropped. The letters are typed
in code; the loose ones in the photo aren't used.
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from batch10 import align, encode, frames  # noqa: E402
from batch11 import cut, rgba, track_circle  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SECONDS = 1.5
CORNER = (1660, 840, 1920, 1080)  # where the marks are (x0, y0, x1, y1): the sparkle and the "Veo" text
DUST = (1830, 3, 1900, 70)  # the fleck, from DUST_FROM on
DUST_FROM = 120


def mark_mask(fr: list[np.ndarray]) -> np.ndarray:
    """The marks sit still while the footage moves under them, so the darkest each pixel ever gets is
    the mark itself where there is one, and near black elsewhere (the move passes dark wood over it)."""
    x0, y0, x1, y1 = CORNER
    low = np.min([f[y0:y1, x0:x1].mean(2) for f in fr[::3]], axis=0)
    m = np.zeros(fr[0].shape[:2], np.uint8)
    m[y0:y1, x0:x1] = low > 30
    return cv2.dilate(m, np.ones((13, 13), np.uint8)) > 0  # and its dark anti-aliased rim


def smooth_fill(img: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Harmonic fill from the edge of the hole (as plates.fill, without added grain: the footage is soft)."""
    out = img.astype(np.float32)
    ys, xs = np.nonzero(mask)
    y0, y1, x0, x1 = max(ys.min() - 2, 0), ys.max() + 3, max(xs.min() - 2, 0), xs.max() + 3
    sub, m = out[y0:y1, x0:x1].copy(), mask[y0:y1, x0:x1]
    sub[m] = sub[~m].mean(axis=0)
    for _ in range(800):
        avg = (np.roll(sub, 1, 0) + np.roll(sub, -1, 0) + np.roll(sub, 1, 1) + np.roll(sub, -1, 1)) / 4
        sub[m] = avg[m]
    out[y0:y1, x0:x1] = sub
    return out


def unmark(f: np.ndarray, i: int, marks: np.ndarray) -> np.ndarray:
    m = marks.copy()
    if i >= DUST_FROM:
        x0, y0, x1, y1 = DUST
        m[y0:y1, x0:x1] = True
    out = f.astype(np.float32)
    n, lab = cv2.connectedComponents(m.astype(np.uint8))
    for k in range(1, n):  # each mark on its own, so a fill only spans its own hole
        out = smooth_fill(out, lab == k)
    return np.clip(out, 0, 255).astype(np.uint8)


def gain_to_photo(frame: np.ndarray, a: dict) -> np.ndarray:
    """Per-channel gain that makes the first frame match the night photo it was made from."""
    plate = cv2.imread(f"{ROOT}/public/assets/desk/desk-night.webp").astype(np.float32)
    m = np.float32([[a["scale"], 0, a["tx"]], [0, a["scale"], a["ty"]]])
    h, w = frame.shape[:2]
    warped = cv2.warpAffine(plate, m, (w, h))
    valid = cv2.warpAffine(np.ones(plate.shape[:2], np.float32), m, (w, h)) > 0.99
    return warped[valid].mean(0) / frame.astype(np.float32)[valid].mean(0)


def hub(gray: np.ndarray, near: tuple[int, int], r: tuple[int, int]) -> tuple[float, float]:
    x, y = near
    k = r[1] + 20
    sub = cv2.GaussianBlur(gray[y - k:y + k, x - k:x + k].astype(np.uint8), (0, 0), 1.2)
    c = cv2.HoughCircles(sub, cv2.HOUGH_GRADIENT, 1, 5, param1=60, param2=14, minRadius=r[0], maxRadius=r[1])
    return float(c[0][0][0] + x - k), float(c[0][0][1] + y - k)


def pan(src: str, out: str) -> dict:
    fr = frames(f"{src}/pan.mp4")
    marks = mark_mask(fr)
    used = [unmark(f, i, marks) for i, f in enumerate(fr)]
    start = align(used[0])
    g = gain_to_photo(used[0], start)
    used = [np.clip(f.astype(np.float32) * g, 0, 255).astype(np.uint8) for f in used]
    step = max(1, round(len(used) / SECONDS / 60))
    kept = used[::step]
    if kept[-1] is not used[-1]:
        kept.append(used[-1])
    fps = len(kept) / SECONDS
    os.makedirs(f"{out}/fx", exist_ok=True)
    encode(kept, fps, f"{out}/fx/clock-pan")
    encode(kept[::-1], fps, f"{out}/fx/clock-pan-back")
    last = used[-1]
    os.makedirs(f"{out}/clock", exist_ok=True)
    Image.fromarray(cv2.cvtColor(last, cv2.COLOR_BGR2RGB)).save(f"{out}/clock/close.webp", quality=90, method=6)
    gray = cv2.cvtColor(last, cv2.COLOR_BGR2GRAY).astype(np.float32)
    hx, hy = hub(gray, (962, 548), (22, 45))
    tx, ty, tr, n = track_circle(gray, hx, hy, 280, 320)
    return {
        "frames": len(kept), "fps": round(fps, 2), "gain_bgr": [round(float(v), 3) for v in g], "start": start,
        "close": {"w": last.shape[1], "h": last.shape[0], "hubX": round(hx, 1), "hubY": round(hy, 1), "track": round(tr, 1), "trackCentre": [round(tx, 1), round(ty, 1)], "trackPoints": n},
    }


def placard(src: str, out: str) -> dict:
    rgb = np.asarray(Image.open(f"{src}/letterboard.jpg").convert("RGB")).astype(np.float32)
    col, alpha = cut(rgb)
    alpha[:, 840:] = 0  # the loose letters
    ys, xs = np.nonzero(alpha > 0.5)
    x0, y0, x1, y1 = xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3
    os.makedirs(f"{out}/lineup", exist_ok=True)
    rgba(col[y0:y1, x0:x1], alpha[y0:y1, x0:x1]).save(f"{out}/lineup/placard.webp", quality=88, method=6)
    return {"w": int(x1 - x0), "h": int(y1 - y0)}


def main():
    src, out = sys.argv[1], sys.argv[2]
    which = set(sys.argv[3:]) or {"pan", "placard"}
    meta = {}
    if "pan" in which:
        meta["pan"] = pan(src, out)
    if "placard" in which:
        meta["placard"] = placard(src, out)
    print(json.dumps(meta, indent=1))


if __name__ == "__main__":
    main()
