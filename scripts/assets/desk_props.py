"""The desk calendar and the felt-tip, composited into the desk photos' own light (v0.3 batch 9).

    python3 -I scripts/assets/desk_props.py OUT_DIR [--preview DIR]

Lit cut-outs pasted over the photo never quite sit on it: wrong brightness, wrong colour of light, a
shadow from the wrong lamp. So nothing here is lit by hand. For each version of the desk (day, dusk,
night, night with the lamp off) the props are lit by the light the photo itself shows at that spot:

- Light. The four photos are the same desk, aligned to the pixel, so one divided by the day photo
  cancels the wood's grain and leaves only the change of light. A white sheet's colour is set once for
  the day photo; every other version follows from the ratio. At dusk the bars of sunlight through the
  window fall across the calendar exactly as they fall across the desk.
- Shape. The camera looks straight down through a wide lens, so things standing on the desk show the
  side that faces the middle of the frame (the mug shows its left side). The calendar is a 2 cm block:
  its left side, a stack of page edges on a board back, shows; the top is assets-src/props/calendar.webp
  (the keyed calendar from batch3.py; the pen is assets-src/props/pen.webp from batch8.py).
- Shadows. A contact shadow everywhere, and a cast shadow away from that photo's light: soft and short
  by day, long and hard from the low sun at dusk, away from the lamp at night, none with the lamp off.
  In the shadow the desk drops to the photo's own ambient level (sampled in the clock's shadow), so the
  shadow has the right colour, and only darkens where that light actually falls.

Output (OUT_DIR/desk-props/): per version, the calendar block (`cal-<v>.webp`), its top page alone for
page turns (`page-<v>.webp`), the pen in each ink colour (`pen-<colour>-<v>.webp`), and their shadows as multiply layers
(`cal-shadow-<v>.webp`, `pen-shadow-<v>.webp`). Geometry, in desk-photo pixels (1376 × 768), is printed
as JSON for lib/deskProps.ts.
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PLATE_W, PLATE_H = 1376, 768
S = 2048 / PLATE_W  # output pixels per photo pixel: matches the @2048 photos
CENTRE = np.array([PLATE_W / 2, PLATE_H / 2])
CAMERA = 900.0  # camera height in photo pixels (≈ 0.07 cm each): sets how much side shows
STATES = ["day", "dusk", "night", "night-off"]

# A white sheet under the day photo's light, where the calendar lies (warm daylight off the window).
WHITE_DAY = np.array([247, 245, 240], np.float32)
# Per version, a trim on the light ratio: the photos are generated, so their light isn't exactly physical.
GAIN = {"day": 1.0, "dusk": 1.0, "night": 1.3, "night-off": 1.2}

CAL = {"cx": 1085.0, "cy": 360.0, "w": 250.0, "rot": 3.0, "h": 28.0}  # h: 2 cm thick
CAL["hgt"] = CAL["w"] * 629 / 760
PEN = {"cx": 1062.0, "cy": 516.0, "w": 185.0, "rot": -17.0, "h": 15.0}
PEN["hgt"] = PEN["w"] * 58 / 520

# Light per version: where a point h above the desk throws its shadow, as a multiple of h
# (a direction from the photo's shadows), how soft (photo px) and how dark the side facing left is.
LIGHT = {
    "day": {"cast": (-0.55, 0.45), "soft": 9.0, "side": 0.62, "ambient": None, "shade": 0.62},
    "dusk": {"cast": (-1.75, 1.35), "soft": 1.6, "side": 0.42, "ambient": (1530, 236, 1590, 262), "shade": None},
    "night": {"lamp": (250.0, 130.0, 640.0), "soft": 5.0, "side": 1.0, "ambient": (1905, 300, 1960, 340), "shade": None},
    "night-off": {"cast": (0.0, 0.0), "soft": 0.0, "side": 0.8, "ambient": None, "shade": 1.0},
}


def plate(state: str) -> np.ndarray:
    return np.asarray(Image.open(f"{ROOT}/public/assets/desk/desk-{state}@2048.webp").convert("RGB")).astype(np.float32)


def wood_light(im: np.ndarray) -> np.ndarray:
    """The desk's brightness at each point: grain lines closed, then lightly blurred."""
    closed = cv2.morphologyEx(im, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
    return cv2.GaussianBlur(closed, (0, 0), 5)


def white_light(day: np.ndarray, im: np.ndarray, state: str) -> np.ndarray:
    """How a white sheet would look at each point of the desk in this version of the photo.

    The photos are the same desk under different light, aligned to the pixel, so dividing one by the
    day photo cancels the wood's grain and figure and leaves only the change of light (the bars of sun
    at dusk, the lamp's falloff at night). The day light itself is smooth: the day photo, heavily blurred.
    """
    day_smooth = cv2.GaussianBlur(cv2.morphologyEx(day, cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8)), (0, 0), 30)
    # Dusk keeps its bars of sunlight fairly sharp; the lamp's light at night is smooth, so blur that more.
    soft = 9 if state == "dusk" else 26
    ratio = cv2.GaussianBlur(im, (0, 0), soft) / np.maximum(cv2.GaussianBlur(day, (0, 0), soft), 1)
    light = day_smooth * ratio
    ys, xs = slice(round((CAL["cy"] - 60) * S), round((CAL["cy"] + 60) * S)), slice(round((CAL["cx"] - 90) * S), round((CAL["cx"] + 90) * S))
    ref = np.median(day_smooth[ys, xs].reshape(-1, 3), axis=0)
    return light / ref * WHITE_DAY * GAIN[state]


def sample(img: np.ndarray, xs: np.ndarray, ys: np.ndarray) -> np.ndarray:
    """Bilinear sample of an output-scale image at photo-pixel coordinates."""
    return cv2.remap(img, (xs * S).astype(np.float32), (ys * S).astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def rot(deg: float) -> np.ndarray:
    a = np.radians(deg)
    return np.array([[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]])


def cast(state: str, at: np.ndarray) -> np.ndarray:
    """Where the shadow of a point 1 px above the desk at `at` falls, relative to it."""
    L = LIGHT[state]
    if "lamp" in L:
        lx, ly, lh = L["lamp"]
        return (at - np.array([lx, ly])) / lh
    return np.array(L["cast"], float)


def local_grid(spec: dict, margin: float):
    """Output pixels of a prop's frame (unrotated, margin around it) and their photo coordinates."""
    w, h = spec["w"], spec["hgt"]
    nw, nh = round((w + 2 * margin) * S), round((h + 2 * margin) * S)
    u = (np.arange(nw) + 0.5) / S - margin
    v = (np.arange(nh) + 0.5) / S - margin
    uu, vv = np.meshgrid(u, v)
    r = rot(spec["rot"])
    du, dv = uu - w / 2, vv - h / 2
    px = spec["cx"] + r[0, 0] * du + r[0, 1] * dv
    py = spec["cy"] + r[1, 0] * du + r[1, 1] * dv
    return uu, vv, px, py


def to_local(spec: dict, px, py):
    r = rot(-spec["rot"])
    dx, dy = px - spec["cx"], py - spec["cy"]
    return r[0, 0] * dx + r[0, 1] * dy + spec["w"] / 2, r[1, 0] * dx + r[1, 1] * dy + spec["hgt"] / 2


def tex_sample(tex: np.ndarray, spec: dict, u, v) -> np.ndarray:
    """Sample a prop texture (RGBA, float) at local photo-pixel coordinates."""
    th, tw = tex.shape[:2]
    return cv2.remap(tex, (u / spec["w"] * tw - 0.5).astype(np.float32), (v / spec["hgt"] * th - 0.5).astype(np.float32),
                     cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)


def page_edges(z: np.ndarray, thick: float, seed: int = 3) -> np.ndarray:
    """Albedo of the calendar's side at height z (0 = desk): a board back, then a stack of page edges."""
    rng = np.random.default_rng(seed)
    sheets = rng.uniform(0.86, 0.97, 400)
    board = z < thick * 0.22
    idx = np.clip(((z - thick * 0.22) / 0.55).astype(int), 0, 399)
    paper = sheets[idx][..., None] * np.array([0.97, 0.95, 0.9])
    card = np.array([0.42, 0.36, 0.3])
    out = np.where(board[..., None], card, paper)
    # The topmost sheets sit a hair proud and catch the light; the seam above the board is dark.
    out = np.where((np.abs(z - thick * 0.22) < 0.5)[..., None], out * 0.55, out)
    return out


def light_at(E: np.ndarray, state: str, px, py, height: float):
    """Light reaching a surface `height` above the desk: the desk's light where that ray would land."""
    c = cast(state, np.stack([px, py], -1))
    return sample(E, px + c[..., 0] * height, py + c[..., 1] * height)


def render_block(state: str, E: np.ndarray, tex: np.ndarray, margin: float):
    spec = CAL
    uu, vv, px, py = local_grid(spec, margin)
    h = spec["h"]
    body = tex[..., 3].copy()
    body[: int(0.04 * tex.shape[0])] = 0  # the ring band isn't part of the block
    # Highest level of the block that lands on each output pixel (painter's order, top down).
    out = np.zeros(uu.shape + (4,), np.float32)
    covered = np.zeros(uu.shape, bool)
    top = tex_sample(tex, spec, uu, vv)
    lit_top = light_at(E, state, px, py, h)
    alpha_top = top[..., 3] / 255
    out[..., :3] = top[..., :3] / 255 * lit_top
    out[..., 3] = alpha_top
    covered |= alpha_top > 0.5
    side_light = light_at(E, state, px, py, h * 0.5) * LIGHT[state]["side"]
    for z in np.linspace(h, 0, 90)[1:]:
        # A point at height z seen at p came from the top-frame position scaled away from the centre.
        f = (CAMERA - z) / (CAMERA - h)
        qx, qy = CENTRE[0] + (px - CENTRE[0]) * f, CENTRE[1] + (py - CENTRE[1]) * f
        lu, lv = to_local(spec, qx, qy)
        th, tw = body.shape
        a = cv2.remap(body, (lu / spec["w"] * tw - 0.5).astype(np.float32), (lv / spec["hgt"] * th - 0.5).astype(np.float32),
                      cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0) / 255
        new = (a > 0.5) & ~covered
        if new.any():
            col = page_edges(np.full(uu.shape, z), h) * side_light
            out[new, :3] = col[new]
            out[new, 3] = np.maximum(out[new, 3], a[new])
            covered |= new
    return out, (uu, vv, px, py)


def grain(rgb: np.ndarray, seed: int) -> np.ndarray:
    """The photos' fine grain, and their softness, so the props don't look sharper than the desk."""
    n = np.random.default_rng(seed).normal(0, 1.6, rgb.shape[:2])[..., None]
    soft = cv2.GaussianBlur(rgb, (0, 0), 0.45)
    return soft + n


def footprint_mask(spec: dict, alpha_tex: np.ndarray, box, lift: np.ndarray) -> np.ndarray:
    """A prop's footprint on the desk (shifted by `lift`, photo px), on an output-scale grid over box."""
    x0, y0, x1, y1 = box
    xs = (np.arange(round((x1 - x0) * S)) + 0.5) / S + x0
    ys = (np.arange(round((y1 - y0) * S)) + 0.5) / S + y0
    gx, gy = np.meshgrid(xs, ys)
    lu, lv = to_local(spec, gx - lift[0], gy - lift[1])
    th, tw = alpha_tex.shape
    return cv2.remap(alpha_tex, (lu / spec["w"] * tw - 0.5).astype(np.float32), (lv / spec["hgt"] * th - 0.5).astype(np.float32),
                     cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0) / 255, gx, gy


def render_shadow(state: str, im: np.ndarray, E: np.ndarray, spec: dict, alpha_tex: np.ndarray, pad: float, ao: float):
    """A multiply layer: white where nothing changes, the shadowed desk colour ÷ the lit one elsewhere."""
    L = LIGHT[state]
    centre = np.array([spec["cx"], spec["cy"]])
    base = -(centre - CENTRE) * spec["h"] / CAMERA  # the footprint sits a little towards the middle
    c = cast(state, centre) * spec["h"]
    half = max(spec["w"], spec["hgt"]) / 2 + pad
    box = (spec["cx"] - half + min(0, c[0]), spec["cy"] - half + min(0, c[1]), spec["cx"] + half + max(0, c[0]), spec["cy"] + half + max(0, c[1]))
    box = tuple(float(round(b)) for b in box)
    foot, gx, gy = footprint_mask(spec, alpha_tex, box, base)
    # Cast shadow: the footprint swept from the base up to the top along the light.
    sweep = np.zeros_like(foot)
    for t in np.linspace(0, 1, 24):
        f, _, _ = footprint_mask(spec, alpha_tex, box, base + c * t)
        sweep = np.maximum(sweep, f)
    if L["soft"]:
        sweep = cv2.GaussianBlur(sweep, (0, 0), L["soft"] * S)
    mult = np.ones(foot.shape + (3,), np.float32)
    if np.abs(c).sum() > 0.5:
        if L["ambient"]:
            x0, y0, x1, y1 = L["ambient"]
            amb = np.median(wood_light(im)[y0:y1, x0:x1].reshape(-1, 3), axis=0)
            lit = sample(wood_light(im), gx, gy)
            dark = np.clip(amb / np.maximum(lit, 1), 0.2, 1)
        else:
            dark = np.full(foot.shape + (3,), L["shade"], np.float32)
        mult = 1 - sweep[..., None] * (1 - dark)
    # Contact shadow: close in under the edges.
    contact = cv2.GaussianBlur(cv2.dilate(foot, np.ones((3, 3))), (0, 0), 3.2 * S)
    mult *= 1 - ao * contact[..., None]
    return np.clip(mult, 0, 1), box


def render_pen(state: str, E: np.ndarray, tex: np.ndarray, margin: float):
    uu, vv, px, py = local_grid(PEN, margin)
    t = tex_sample(tex, PEN, uu, vv)
    lit = light_at(E, state, px, py, PEN["h"])
    out = np.zeros(uu.shape + (4,), np.float32)
    # The photo is a studio shot, brighter than any desk: scale it to a sheet's whiteness first.
    out[..., :3] = t[..., :3] / 255 * 0.92 * lit
    out[..., 3] = t[..., 3] / 255
    return out


# The pen colours of Settings → Pen (globals.css --pen): the pen on the desk is the one you write with.
PEN_COLOURS = {"red": None, "blue": (31, 86, 184), "green": (30, 122, 68), "violet": (107, 63, 160)}


def recolour(tex: np.ndarray, rgb) -> np.ndarray:
    """The red pen in another colour: same shading and highlights (value, and saturation relative to the
    red body), with the hue and depth of the new ink."""
    if rgb is None:
        return tex
    hsv = cv2.cvtColor((tex[..., :3] / 255).astype(np.float32), cv2.COLOR_RGB2HSV)
    body = (tex[..., 3] > 200) & (hsv[..., 1] > 0.5)
    s_ref, v_ref = np.median(hsv[..., 1][body]), np.median(hsv[..., 2][body])
    t = cv2.cvtColor(np.array([[rgb]], np.float32) / 255, cv2.COLOR_RGB2HSV)[0, 0]
    out = hsv.copy()
    out[..., 0] = t[0]
    out[..., 1] = np.clip(hsv[..., 1] / s_ref * t[1], 0, 1)
    out[..., 2] = np.clip(hsv[..., 2] / v_ref * t[2], 0, 1)
    return np.dstack([cv2.cvtColor(out, cv2.COLOR_HSV2RGB) * 255, tex[..., 3]])


def save_rgba(arr: np.ndarray, path: str, seed: int):
    rgb = grain(arr[..., :3], seed)
    Image.fromarray(np.dstack([np.clip(rgb, 0, 255), np.clip(arr[..., 3] * 255, 0, 255)]).astype(np.uint8), "RGBA").save(path, quality=90, method=6)


def main():
    out = sys.argv[1]
    preview = sys.argv[sys.argv.index("--preview") + 1] if "--preview" in sys.argv else None
    os.makedirs(f"{out}/desk-props", exist_ok=True)
    cal_tex = np.asarray(Image.open(f"{ROOT}/assets-src/props/calendar.webp").convert("RGBA")).astype(np.float32)
    pen_tex = np.asarray(Image.open(f"{ROOT}/assets-src/props/pen.webp").convert("RGBA")).astype(np.float32)
    margin, pen_margin = 14.0, 4.0
    geo = {}
    day = plate("day")
    for i, state in enumerate(STATES):
        im = plate(state)
        E = white_light(day, im, state)
        block, _ = render_block(state, E, cal_tex, margin)
        save_rgba(block, f"{out}/desk-props/cal-{state}.webp", i)
        # The top page alone (for page turns): the same pixels as the block's top face.
        uu, vv, px, py = local_grid(CAL, 0)
        top = tex_sample(cal_tex, CAL, uu, vv)
        page = np.dstack([top[..., :3] / 255 * light_at(E, state, px, py, CAL["h"]), top[..., 3] / 255])
        save_rgba(page, f"{out}/desk-props/page-{state}.webp", i)
        for colour, rgb in PEN_COLOURS.items():
            p = render_pen(state, E, recolour(pen_tex, rgb), pen_margin)
            save_rgba(p, f"{out}/desk-props/pen-{colour}-{state}.webp", 10 + i)
            if colour == "red":
                pen = p
        cal_sh, cal_box = render_shadow(state, im, E, CAL, cal_tex[..., 3].copy(), 40, 0.5)
        pen_sh, pen_box = render_shadow(state, im, E, PEN, pen_tex[..., 3].copy(), 24, 0.55)
        Image.fromarray((cal_sh * 255).astype(np.uint8)).save(f"{out}/desk-props/cal-shadow-{state}.webp", quality=88, method=6)
        Image.fromarray((pen_sh * 255).astype(np.uint8)).save(f"{out}/desk-props/pen-shadow-{state}.webp", quality=88, method=6)
        geo[state] = {"calShadow": cal_box, "penShadow": pen_box}
        if preview:
            comp = im.copy()
            for sh, box in ((cal_sh, cal_box), (pen_sh, pen_box)):
                x0, y0 = round(box[0] * S), round(box[1] * S)
                hh, ww = sh.shape[:2]
                comp[y0:y0 + hh, x0:x0 + ww] *= sh
            for arr, spec, m in ((block, CAL, margin), (pen, PEN, pen_margin)):
                rgba = np.dstack([grain(arr[..., :3], 1), arr[..., 3]])
                # local output pixel -> photo output pixel
                r = rot(spec["rot"])
                c = np.array([spec["cx"], spec["cy"]]) * S
                off = np.array([spec["w"] / 2 + m, spec["hgt"] / 2 + m]) * S
                A = np.hstack([r, (c - r @ off)[:, None]])
                warped = cv2.warpAffine(rgba.astype(np.float32), A, (comp.shape[1], comp.shape[0]), flags=cv2.INTER_LINEAR)
                a = warped[..., 3:4]
                comp = comp * (1 - a) + np.clip(warped[..., :3], 0, 255) * a
            Image.fromarray(np.clip(comp, 0, 255).astype(np.uint8)).save(f"{preview}/comp-{state}.png")
    geo["cal"] = {k: CAL[k] for k in ("cx", "cy", "w", "hgt", "rot")} | {"margin": margin}
    geo["pen"] = {k: PEN[k] for k in ("cx", "cy", "w", "hgt", "rot")} | {"margin": pen_margin}
    print(json.dumps(geo, indent=1))


if __name__ == "__main__":
    main()
