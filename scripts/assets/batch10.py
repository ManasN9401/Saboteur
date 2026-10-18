"""Batch 10: the clock's hands, and the camera move from the desk to the clock.

    python3 -I scripts/assets/batch10.py SRC_DIR OUT_DIR

Hands (hands.jpg, generated on chroma green): hour, minute, seconds, alarm, and the centre nut, laid out
pointing up. Each is keyed, cut out and exported at full size with its pivot measured: the centre of the
hole in its boss (the seconds hand has a solid boss, so its widest point), so the page can turn it about
the right spot. Printed as JSON for components/clockHands.ts.

Pan (pan.mp4, Veo, 8 s; upscaled to 1920 × 1080 in Flow): first frame the night desk, last frame the clock face on. The first
few frames are the generator settling (a blotchy lamp) and are dropped; its sparkle mark is painted out
of every frame; the move is sped up to about a second and a half (at about 60 fps); a reversed copy plays when you leave.
Its last frame should match the close-up the clock view holds on (clock/close.webp, now a still made by
batch11.py). Its alignment with the night desk photo is measured on the first frame used (scale and
offset, like the lamp footage).
"""
import json
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutout import despill, key, lens_hole, remove_specks  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# Where each piece lies in hands.jpg (x0, y0, x1, y1), pointing up.
PIECES = {"hour": (150, 190, 275, 590), "minute": (400, 105, 520, 615), "second": (660, 135, 720, 640), "alarm": (870, 225, 965, 560), "nut": (1095, 325, 1215, 445)}
START = 8  # first frame used: before it the lamp is still resolving
SECONDS = 1.5  # length of the move once sped up
SPARKLE = (1108, 548, 1228, 662)  # the generator's mark, in every frame (x0, y0, x1, y1), at 1280 wide


def hands(src: str, out: str) -> dict:
    rgb = np.asarray(Image.open(f"{src}/hands.jpg").convert("RGB")).astype(np.float32)
    h, w = rgb.shape[:2]
    rgb[int(h * 0.8):, int(w * 0.86):] = (10, 225, 10)  # the sparkle mark
    alpha = remove_specks(key(rgb))
    # The key's edge ramp is several pixels wide (green light wraps round the metal): tighten it to about
    # a pixel, then give the remaining half-transparent edge the colour of the metal just inside it
    # (removing green from a green-lit edge leaves it magenta). Only that thin band is refilled.
    alpha = np.clip((alpha - 0.5) * 3 + 0.5, 0, 1)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.5)
    clean = np.clip(despill(rgb, alpha), 0, 255).astype(np.uint8)
    solid = (alpha > 0.5).astype(np.uint8)
    band = cv2.dilate(solid, np.ones((5, 5), np.uint8)) - cv2.erode(solid, np.ones((7, 7), np.uint8))
    clean = cv2.inpaint(clean, band, 4, cv2.INPAINT_TELEA).astype(np.float32)
    alpha = cv2.erode(alpha, np.ones((3, 3), np.uint8))
    # Whatever soft edge is still magenta (red and blue both well above green) is screen, not metal.
    r, g, b = clean[..., 0], clean[..., 1], clean[..., 2]
    alpha[(alpha < 0.95) & (r > g + 10) & (b > g + 10)] = 0
    meta = {}
    for name, (x0, y0, x1, y1) in PIECES.items():
        a = alpha[y0:y1, x0:x1]
        im = np.dstack([clean[y0:y1, x0:x1], a * 255]).clip(0, 255).astype(np.uint8)
        ys, xs = np.nonzero(a > 0.5)
        bx0, by0, bx1, by1 = xs.min() - 3, ys.min() - 3, xs.max() + 4, ys.max() + 4
        im = im[by0:by1, bx0:bx1]
        ca = im[..., 3].astype(np.float32) / 255
        if name in ("hour", "minute", "alarm"):
            hole = lens_hole(ca)
            px, py = hole["cx"], hole["cy"]
        elif name == "second":
            # The boss: the widest row in the lower half.
            widths = (ca > 0.5).sum(axis=1)
            lower = np.arange(len(widths)) > len(widths) * 0.6
            py = float(np.argmax(np.where(lower, widths, 0)))
            px = float(np.nonzero(ca[int(py)] > 0.5)[0].mean())
        else:
            px, py = im.shape[1] / 2, im.shape[0] / 2
        tip = float(np.nonzero((ca > 0.5).any(axis=1))[0].min())
        Image.fromarray(im, "RGBA").save(f"{out}/clock/hand-{name}.webp", quality=92, method=6)
        meta[name] = {"w": im.shape[1], "h": im.shape[0], "px": round(px, 1), "py": round(py, 1), "len": round(py - tip, 1)}
    return meta


def frames(path: str) -> list[np.ndarray]:
    cap = cv2.VideoCapture(path)
    out = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        out.append(f)
    return out


def unmark(f: np.ndarray) -> np.ndarray:
    k = f.shape[1] / 1280  # the mark scales with the frame (the footage comes at 720p or 1080p)
    x0, y0, x1, y1 = (round(v * k) for v in SPARKLE)
    m = np.zeros(f.shape[:2], np.uint8)
    m[y0:y1, x0:x1] = 255
    return cv2.inpaint(f, m, 9, cv2.INPAINT_TELEA)


def align(frame: np.ndarray) -> dict:
    """Where the night desk photo (1376 × 768) sits in this frame: frame = photo × scale + offset."""
    plate = cv2.imread(f"{ROOT}/public/assets/desk/desk-night.webp")
    g1, g2 = cv2.cvtColor(plate, cv2.COLOR_BGR2GRAY), cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    orb = cv2.ORB_create(5000)
    k1, d1 = orb.detectAndCompute(g1, None)
    k2, d2 = orb.detectAndCompute(g2, None)
    good = [m for m, n in (p for p in cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(d1, d2, k=2) if len(p) == 2) if m.distance < 0.75 * n.distance]
    p1 = np.float32([k1[m.queryIdx].pt for m in good])
    p2 = np.float32([k2[m.trainIdx].pt for m in good])
    m, inl = cv2.estimateAffinePartial2D(p1, p2, method=cv2.RANSAC, ransacReprojThreshold=2.5)
    inl = inl.ravel().astype(bool)
    res = np.linalg.norm(p1[inl] @ m[:, :2].T + m[:, 2] - p2[inl], axis=1)
    return {
        "scale": round(float(np.hypot(*m[0, :2])), 4),
        "rot": round(float(np.degrees(np.arctan2(m[1, 0], m[0, 0]))), 3),
        "tx": round(float(m[0, 2]), 1),
        "ty": round(float(m[1, 2]), 1),
        "inliers": int(inl.sum()),
        "residual": round(float(res.mean()), 2),
    }


def encode(fr: list[np.ndarray], fps: float, out: str):
    """WebM (VP9) and MP4 (H.264), no sound."""
    h, w = fr[0].shape[:2]
    raw = b"".join(f.tobytes() for f in fr)
    base = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", f"{fps}", "-i", "-"]
    subprocess.run(base + ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-row-mt", "1", "-pix_fmt", "yuv420p", f"{out}.webm"], input=raw, check=True)
    subprocess.run(base + ["-c:v", "libx264", "-crf", "22", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", f"{out}.mp4"], input=raw, check=True)


def pan(src: str, out: str) -> dict:
    fr = frames(f"{src}/pan.mp4")
    used = [unmark(f) for f in fr[START:]]
    # Sped up to SECONDS at about 60 frames a second: every other frame of the 24 fps source.
    step = max(1, round(len(used) / SECONDS / 60))
    kept = used[::step]
    if kept[-1] is not used[-1]:
        kept.append(used[-1])
    fps = len(kept) / SECONDS
    encode(kept, fps, f"{out}/fx/clock-pan")
    encode(kept[::-1], fps, f"{out}/fx/clock-pan-back")
    return {"frames": len(kept), "fps": round(fps, 2), "size": [used[0].shape[1], used[0].shape[0]], "start": align(used[0])}


def main():
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(f"{out}/clock", exist_ok=True)
    os.makedirs(f"{out}/fx", exist_ok=True)
    meta = {"hands": hands(src, out)}
    if "--hands-only" not in sys.argv:
        meta["pan"] = pan(src, out)
    print(json.dumps(meta, indent=1))


if __name__ == "__main__":
    main()
