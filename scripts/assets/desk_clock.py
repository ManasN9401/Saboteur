"""The desk clock's face without its painted hands, so live hands can be drawn on it (v0.3 batch 9).

    python3 -I scripts/assets/desk_clock.py OUT_DIR [--preview DIR]

The alarm clock in the desk photos shows a fixed time. For each version of the photo (day, dusk, night,
lamp off) the hands and hub are painted out of the dial (OpenCV inpainting, inside a hand-traced mask:
the four photos are edits of one image, so the hands are in the same place in all of them). Only the
painted-out pixels are exported, feathered, as a patch laid over the photo (desk-props/clock-<v>.webp),
and the whole clock is cut out with a soft edge for the alarm's shake (desk-props/clock-body-<v>.webp);
components/DeskClock.tsx draws the live hands on top.

The dial, measured on the 2048-px photos: an ellipse centred (1792, 214), semi-axes 93 × 45, turned 34°.
The face is tilted back, so 12–6 runs along the short axis (12 towards the handle, up and right) and
3–9 along the long one. The hub is at (1797, 207). These numbers are also in components/DeskClock.tsx.
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STATES = ["day", "dusk", "night", "night-off"]
BOX = (1680, 140, 1900, 290)  # the dial and its bezel, in 2048-px photo pixels
HUB = (1797, 207)
# The whole clock (body, bezel, handle and base) for the ringing shake: a box and a soft ellipse in it.
BODY = (1570, 30, 1940, 370)
CLOCK_C, CLOCK_R, CLOCK_TURN = (1752, 200), (172, 132), 34
# The painted hands, traced on the photos: hour hand up and left, minute hand down and right.
HANDS = [((1797, 207), (1765, 156)), ((1797, 207), (1871, 251))]


def mask() -> np.ndarray:
    x0, y0, x1, y1 = BOX
    m = np.zeros((y1 - y0, x1 - x0), np.uint8)
    for (ax, ay), (bx, by) in HANDS:
        cv2.line(m, (ax - x0, ay - y0), (bx - x0, by - y0), 255, 6, cv2.LINE_AA)
    cv2.circle(m, (HUB[0] - x0, HUB[1] - y0), 8, 255, -1, cv2.LINE_AA)
    return cv2.dilate(m, np.ones((3, 3), np.uint8))


def main():
    out = sys.argv[1]
    preview = sys.argv[sys.argv.index("--preview") + 1] if "--preview" in sys.argv else None
    os.makedirs(f"{out}/desk-props", exist_ok=True)
    x0, y0, x1, y1 = BOX
    m = mask()
    bx0, by0, bx1, by1 = BODY
    body_alpha = np.zeros((by1 - by0, bx1 - bx0), np.uint8)
    cv2.ellipse(body_alpha, ((CLOCK_C[0] - bx0) * 4, (CLOCK_C[1] - by0) * 4), (CLOCK_R[0] * 4, CLOCK_R[1] * 4), CLOCK_TURN, 0, 360, 255, -1, cv2.LINE_AA, shift=2)
    body_alpha = cv2.GaussianBlur(body_alpha, (0, 0), 9)
    alpha = cv2.GaussianBlur(cv2.dilate(m, np.ones((5, 5), np.uint8)), (0, 0), 2).astype(np.float32) / 255
    for state in STATES:
        im = np.asarray(Image.open(f"{ROOT}/public/assets/desk/desk-{state}@2048.webp").convert("RGB"))
        roi = np.ascontiguousarray(im[y0:y1, x0:x1])
        clean = cv2.inpaint(roi, (m > 0).astype(np.uint8), 6, cv2.INPAINT_TELEA)
        rgba = np.dstack([clean, (alpha * 255).astype(np.uint8)])
        Image.fromarray(rgba, "RGBA").save(f"{out}/desk-props/clock-{state}.webp", quality=92, method=6)
        # The whole clock, its dial already clean, cut out with a soft edge: shaken when the alarm rings.
        # Its edge is desk, the same as the photo underneath, so only the clock seems to move.
        bx0, by0, bx1, by1 = BODY
        body = im[by0:by1, bx0:bx1].copy()
        body[y0 - by0:y1 - by0, x0 - bx0:x1 - bx0] = (body[y0 - by0:y1 - by0, x0 - bx0:x1 - bx0] * (1 - alpha[..., None]) + clean * alpha[..., None]).astype(np.uint8)
        Image.fromarray(np.dstack([body, body_alpha]), "RGBA").save(f"{out}/desk-props/clock-body-{state}.webp", quality=88, method=6)
        if preview:
            comp = roi * (1 - alpha[..., None]) + clean * alpha[..., None]
            Image.fromarray(comp.astype(np.uint8)).resize(((x1 - x0) * 3, (y1 - y0) * 3), Image.LANCZOS).save(f"{preview}/clean-{state}.png")
    print("clock patches", (x1 - x0, y1 - y0), "box", BOX)


if __name__ == "__main__":
    main()
