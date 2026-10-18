"""Batch 11: the clock close-up still, the line-up wall, the menu's wooden tray, the autopsy's steel tray
and the toe tag.

    python3 -I scripts/assets/batch11.py SRC_DIR OUT_DIR [clock] [lineup] [tray] [steel] [tag]

Clock (clock-close.jpg): the clock face-on on the desk, the brief for the camera move's last frame.
The close-up now comes from that footage (batch12.py), so this writes clock/close-still.webp, unused,
and runs only when asked for. The sparkle is painted out, the still is upscaled to 1920
wide, and its hub (the brass centre post) and minute track (a circle fitted to the track's inner line)
are measured for CLOSE in components/Clock.tsx.

Line-up wall (lineup-wall.jpg): a plate like the desk photos (1376 and 2048 wide) for v0.8, plus where
its five name plates are.

Trays (menu-tray.jpg, steel-tray.jpg, on chroma green): keyed and straightened so their rims are
rectangles (the photos are taken a little from the front, so the far end is narrower), then used as
9-slice frames (border-image) round the content. Each is relit by the light of the day, dusk and night
desk photos where it lies (as the desk props are), mirrored by day so its shading faces the window. Their brass plates are painted out, since the front
edge stretches: the page draws the wooden tray's label holder itself (it fits its text), and the steel
tray's plate is cut out as its own fixed-size piece.

Toe tag (toe-tag.jpg): a 9-slice of the card without its eyelet, and the eyelet with its string as a
separate piece, so the tag can grow with its text and the string never stretches.
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutout import despill, key, remove_specks  # noqa: E402
from plates import fill, star_mask  # noqa: E402

CLOSE_W = 1920  # the clock view's photo width (it was the 1080p footage's last frame)


def load(path: str) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB")).astype(np.float32)


def unstar(rgb: np.ndarray) -> np.ndarray:
    return fill(rgb, star_mask(rgb.shape[1], rgb.shape[0]))


def upscale(im: Image.Image, w: int) -> Image.Image:
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.2, 40, 2))


# ---------- clock ----------

def track_circle(gray: np.ndarray, cx: float, cy: float, r0: float, r1: float):
    """The minute track's inner line: darkest radius per angle (smoothed along the ring so ticks and
    specks don't win), then a least-squares circle with outliers (numerals, the triangles) dropped."""
    from scipy.ndimage import median_filter

    g = cv2.GaussianBlur(gray, (0, 0), 0.6)
    rs = np.arange(r0, r1, 0.2)
    ts = np.linspace(0, 2 * np.pi, 1440, endpoint=False)
    xs = (cx + rs[None] * np.cos(ts[:, None])).astype(np.float32)
    ys = (cy + rs[None] * np.sin(ts[:, None])).astype(np.float32)
    polar = median_filter(cv2.remap(g, xs, ys, cv2.INTER_LINEAR), size=(9, 1))
    r = rs[polar.argmin(1)]
    pts = np.stack([cx + r * np.cos(ts), cy + r * np.sin(ts)], 1)
    keep = np.ones(len(pts), bool)
    for _ in range(5):
        a = np.c_[2 * pts[keep], np.ones(keep.sum())]
        sx, sy, c = np.linalg.lstsq(a, (pts[keep] ** 2).sum(1), rcond=None)[0]
        rad = np.sqrt(c + sx ** 2 + sy ** 2)
        keep = np.abs(np.hypot(pts[:, 0] - sx, pts[:, 1] - sy) - rad) < 1.5
    return float(sx), float(sy), float(rad), int(keep.sum())


def hub_post(gray: np.ndarray, near: tuple[int, int]) -> tuple[float, float]:
    """The brass centre post: the strongest small circle near where it should be."""
    x, y = near
    sub = cv2.GaussianBlur(gray[y - 35:y + 35, x - 35:x + 35].astype(np.uint8), (0, 0), 1)
    c = cv2.HoughCircles(sub, cv2.HOUGH_GRADIENT, 1, 5, param1=60, param2=12, minRadius=8, maxRadius=22)
    return float(c[0][0][0] + x - 35), float(c[0][0][1] + y - 35)


def clock(src: str, out: str) -> dict:
    rgb = unstar(load(f"{src}/clock-close.jpg"))
    gray = cv2.cvtColor(np.clip(rgb, 0, 255).astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
    hx, hy = hub_post(gray, (690, 386))
    tx, ty, tr, n = track_circle(gray, hx, hy, 158, 180)
    im = upscale(Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)), CLOSE_W)
    os.makedirs(f"{out}/clock", exist_ok=True)
    im.save(f"{out}/clock/close-still.webp", quality=90, method=6)
    k = CLOSE_W / rgb.shape[1]
    # The hands turn about the post; the track's centre is within a pixel or two of it.
    return {
        "w": im.width, "h": im.height, "hubX": round(hx * k, 1), "hubY": round(hy * k, 1), "track": round(tr * k, 1),
        "trackCentre": [round(tx * k, 1), round(ty * k, 1)], "trackPoints": n,
    }


# ---------- line-up wall ----------

def lineup(src: str, out: str) -> dict:
    rgb = unstar(load(f"{src}/lineup-wall.jpg"))
    im = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
    os.makedirs(f"{out}/lineup", exist_ok=True)
    for w in (1376, 2048):
        plate = im if w == im.width else upscale(im, w)
        suffix = "" if w == 1376 else f"@{w}"
        plate.save(f"{out}/lineup/wall{suffix}.avif", quality=58)
        plate.save(f"{out}/lineup/wall{suffix}.webp", quality=80, method=6)
    # The name plates: the near-black rectangles below the height chart.
    gray = cv2.cvtColor(np.clip(rgb, 0, 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)
    dark = ((gray < 22) * 255).astype(np.uint8)
    dark[:540] = 0
    dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, _, stats, _ = cv2.connectedComponentsWithStats(dark)
    plates = sorted([s[:4].tolist() for s in stats[1:n] if 100 < s[2] < 220 and 60 < s[3] < 130], key=lambda s: s[0])
    return {"w": im.width, "h": im.height, "plates": [{"x": x, "y": y, "w": w, "h": h} for x, y, w, h in plates]}


# ---------- trays ----------

def cut(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Key, despill and tighten the edge (as batch10's hands): returns colour and alpha."""
    rgb = rgb.copy()
    h, w = rgb.shape[:2]
    rgb[int(h * 0.8):, int(w * 0.86):] = (10, 225, 10)  # the sparkle mark
    alpha = remove_specks(key(rgb), 2000)
    alpha = np.clip((alpha - 0.5) * 2.5 + 0.5, 0, 1)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.6)
    col = despill(rgb, alpha)
    # Screen in shadow (under a bracket's lip) unmixes to magenta: that's screen, not prop.
    r, g, b = col[..., 0], col[..., 1], col[..., 2]
    alpha[(alpha < 0.97) & (r > g + 8) & (b > g + 8)] = 0
    alpha = cv2.erode(alpha, np.ones((2, 2), np.uint8))
    return col, alpha


def lab_shift(rgb: np.ndarray, region: np.ndarray, target_ab: tuple[float, float], gain: float = 1.0) -> np.ndarray:
    """Move a region's average colour (a*, b*) to target_ab, keeping its shading; region is a 0..1 weight."""
    lab = cv2.cvtColor(np.clip(rgb, 0, 255).astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
    m = region > 0.5
    da, db = target_ab[0] - lab[..., 1][m].mean(), target_ab[1] - lab[..., 2][m].mean()
    lab[..., 1] += da * region
    lab[..., 2] += db * region
    lab[..., 0] *= 1 + (gain - 1) * region
    return cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB).astype(np.float32)


def mean_ab(rgb: np.ndarray, m: np.ndarray) -> tuple[float, float]:
    lab = cv2.cvtColor(np.clip(rgb, 0, 255).astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
    return float(lab[..., 1][m].mean()), float(lab[..., 2][m].mean())


def edge_line(alpha: np.ndarray, rows: range, side: str) -> np.poly1d:
    """The outer edge of a side wall as a straight line x(y), fitted over rows clear of the brackets."""
    xs = []
    for y in rows:
        cols = np.nonzero(alpha[y] > 0.5)[0]
        xs.append(cols.min() if side == "left" else cols.max())
    return np.poly1d(np.polyfit(list(rows), xs, 1))


def straighten(rgb: np.ndarray, alpha: np.ndarray, quad: np.ndarray, size: tuple[int, int], pad: int, scale: float):
    """Warp so the rim (quad: TL, TR, BR, BL) becomes a size[0] × size[1] rectangle, with pad around it,
    at `scale` (premultiplied, so no screen colour bleeds into the edge)."""
    w, h = size
    dst = (np.float32([[0, 0], [w, 0], [w, h], [0, h]]) + pad) * scale
    m = cv2.getPerspectiveTransform(quad.astype(np.float32), dst)
    ow, oh = round((w + 2 * pad) * scale), round((h + 2 * pad) * scale + 120 * scale)
    pre = np.dstack([rgb * alpha[..., None], alpha * 255])
    warped = cv2.warpPerspective(pre, m, (ow, oh), flags=cv2.INTER_CUBIC, borderValue=0)
    a = np.clip(warped[..., 3] / 255, 0, 1)
    col = warped[..., :3] / np.maximum(a, 1e-3)[..., None]
    ys, xs = np.nonzero(a > 0.02)
    a, col = a[: ys.max() + 2], col[: ys.max() + 2]
    return np.clip(col, 0, 255), a, m


def rgba(col: np.ndarray, a: np.ndarray) -> Image.Image:
    return Image.fromarray(np.dstack([np.clip(col, 0, 255), np.clip(a * 255, 0, 255)]).astype(np.uint8), "RGBA")


def patch_over(col: np.ndarray, box: tuple[int, int, int, int], dx: int, feather: float = 6) -> np.ndarray:
    """Cover box with the same-sized patch dx pixels to the side, feathered in (wood grain runs along the
    front, so a shifted copy continues it)."""
    x0, y0, x1, y1 = box
    m = np.zeros(col.shape[:2], np.float32)
    m[y0:y1, x0:x1] = 1
    m = cv2.GaussianBlur(m, (0, 0), feather)[..., None]
    shifted = np.roll(col, dx, axis=1)
    return col * (1 - m) + shifted * m


def rows_across(col: np.ndarray, box: tuple[int, int, int, int], edge: int = 6) -> np.ndarray:
    """Paint box out of a rim that runs straight across it: each row blends from the colour just left of
    the box to the colour just right of it, with the rim's grain added back."""
    x0, y0, x1, y1 = box
    out = col.copy()
    lft = col[y0:y1, x0 - edge:x0].mean(1)
    rgt = col[y0:y1, x1:x1 + edge].mean(1)
    t = np.linspace(0, 1, x1 - x0)[None, :, None]
    fill_ = lft[:, None] * (1 - t) + rgt[:, None] * t
    near = col[y0:y1, x0 - 40:x0]
    sd = (near - cv2.GaussianBlur(near, (0, 0), 1.5)).std(axis=(0, 1))
    fill_ += np.random.default_rng(5).normal(0, 1, fill_.shape) * sd
    out[y0:y1, x0:x1] = cv2.GaussianBlur(fill_.astype(np.float32), (0, 0), 0.6)
    return out


def plate_piece(col: np.ndarray, a: np.ndarray, box: tuple[int, int, int, int]):
    """A brass plate on steel: the yellowest pixels in box, as an RGBA piece, and where it is."""
    x0, y0, x1, y1 = box
    lab = cv2.cvtColor(np.clip(col[y0:y1, x0:x1], 0, 255).astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
    m = (lab[..., 2] > 150).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab_img, stats, _ = cv2.connectedComponentsWithStats(m)
    big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    cnts, _ = cv2.findContours((lab_img == big).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    solid = np.zeros(m.shape, np.uint8)
    cv2.drawContours(solid, cnts, -1, 1, -1)
    soft = cv2.GaussianBlur(solid.astype(np.float32), (0, 0), 0.8)
    ys, xs = np.nonzero(solid)
    bx0, by0, bx1, by1 = xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3
    piece = rgba(col[y0:y1, x0:x1][by0:by1, bx0:bx1], soft[by0:by1, bx0:bx1])
    return piece, (int(x0 + bx0), int(y0 + by0), int(x0 + bx1), int(y0 + by1))


def drop_rows(col: np.ndarray, a: np.ndarray, y0: int, y1: int, feather: int):
    """Remove rows y0..y1, cross-fading `feather` rows across the join."""
    t = np.linspace(0, 1, feather)[:, None]
    def cut_(img):
        img = img if img.ndim == 3 else img[..., None]
        seam = img[y0 - feather:y0] * (1 - t[..., None]) + img[y1 - feather:y1] * t[..., None]
        out = np.concatenate([img[: y0 - feather], seam, img[y1:]])
        return out if out.shape[2] > 1 else out[..., 0]
    return cut_(col), cut_(a)


# Where each tray lies over the desk photo (1376 × 768 px), at a 1440 × 900 screen: the menu is centred
# under the logo, the autopsy tray fills the middle of the page.
REGION = {"wood": (453, 96, 922, 708), "steel": (282, 192, 1093, 767)}
LIGHTS = ("day", "dusk", "night")  # the lamp-off desk dims the whole menu instead (.front__stage)
STUDIO = 236.0  # what white looked like in the tray photos' own (bright, even) light


def light_field(state: str, region: tuple, size: tuple[int, int]) -> np.ndarray:
    """How a white sheet looks across `region` of this desk photo (desk_props.white_light), smoothed so
    the dusk's bars of sun don't print sharply (the tray moves with the screen, the bars don't), at `size`."""
    import desk_props as dp

    e = dp.white_light(dp.plate("day"), dp.plate(state), state)
    x0, y0, x1, y1 = (round(v * dp.S) for v in region)
    crop = cv2.GaussianBlur(e[y0:y1, x0:x1], (0, 0), 24)
    return cv2.resize(crop, size, interpolation=cv2.INTER_CUBIC)


def relight(col: np.ndarray, a: np.ndarray, name: str, out: str, quality: int):
    """The tray under each desk photo's light, as the desk props are (scripts/assets/desk_props.py).
    The tray photos are lit from the top left, like the lamp at night; by day and at dusk the light comes
    from the window, on the right, so the tray is mirrored to put its shading on the right side."""
    for state in LIGHTS:
        base = col[:, ::-1] if state != "night" else col
        alpha = a[:, ::-1] if state != "night" else a
        lit = base * light_field(state, REGION[name], (base.shape[1], base.shape[0])) / STUDIO
        # Roll off highlights rather than clip them (the lamp is bright on the near corner at night).
        knee = 205.0
        lit = np.where(lit < knee, lit, knee + 50 * (1 - np.exp(-(lit - knee) / 50)))
        rgba(lit, alpha).save(f"{out}/tray/{name}-{state}.webp", quality=quality, method=6)


def menu_tray(src: str, out: str, scale: float = 2.0) -> dict:
    rgb = load(f"{src}/menu-tray.jpg")
    col, alpha = cut(rgb)
    left = edge_line(alpha, range(80, 540, 5), "left")
    right = edge_line(alpha, range(80, 540, 5), "right")
    top = int(np.nonzero(alpha[:, 680] > 0.5)[0].min())
    rim = 627  # the front rim's top edge at the sides (outside the brackets): the rim rectangle's bottom
    face_top = 641  # where the rim's front edge turns down into the front face, mid-tray
    # The front face caught green light off the screen: give it the rim's wood colour, a little darker.
    face = np.zeros(alpha.shape, np.float32)
    face[face_top:] = 1
    face = cv2.GaussianBlur(face, (0, 0), 1.5) * (alpha > 0.5)
    wood = np.zeros(alpha.shape, bool)
    wood[150:560, :] = alpha[150:560, :] > 0.9
    wood[:, 470:900] = False  # the side rims only, not the floor
    col = lab_shift(col, face, mean_ab(col, wood), 0.92)
    quad = np.float32([[left(top), top], [right(top), top], [right(rim), rim], [left(rim), rim]])
    size, pad = (580, 600), 8
    tray, a, m = straighten(col, alpha, quad, size, pad, scale)
    # The front face's top, in the brackets' shadow, keys out with the screen: close the thin gap.
    closed = cv2.morphologyEx(a.astype(np.float32), cv2.MORPH_CLOSE, np.ones((round(9 * scale), 1), np.uint8))
    gap = (closed - a) > 0.15
    band = np.zeros_like(gap)
    band[round((size[1] + pad - 8) * scale):round((size[1] + pad + 22) * scale)] = True  # just under the front rim
    gap &= band
    todo = gap.copy()
    for k in range(1, round(12 * scale)):  # the wood just below, in the bracket's shadow
        below = np.roll(tray, -k, axis=0)
        take = todo & (np.roll(a, -k, axis=0) > 0.95)
        tray[take] = below[take] * 0.7
        todo &= ~take
    a = np.where(gap, 1.0, a)
    # The label holder on the front face is painted out (the front edge stretches; the page draws its
    # own holder, which fits its text): wood from beside it, where the grain carries straight on.
    hw, hh = tray.shape[1], tray.shape[0]
    box = (round(424 / 2 * scale), round(1266 / 2 * scale), round(762 / 2 * scale), round(1336 / 2 * scale))
    tray = patch_over(tray, box, round(-345 / 2 * scale))
    # Seen from a little in front, the back wall shows a tall inside face and the front wall a tall
    # outside one. The page looks straight down, so both are cut shorter (plain wood either side).
    k = scale / 2
    for y0, y1 in ((1255, 1300), (140, 250)):  # bottom first, so the top cut doesn't move it
        tray, a = drop_rows(tray, a, round(y0 * k), round(y1 * k), round(8 * k))
    os.makedirs(f"{out}/tray", exist_ok=True)
    relight(tray, a, "wood", out, 86)
    rim_px = [round((v + pad) * scale) for v in (0, 0, size[0], size[1])]
    return {"size": [hw, hh], "rim": rim_px, "scale": scale}


def steel_tray(src: str, out: str, scale: float = 2.0) -> dict:
    rgb = load(f"{src}/steel-tray.jpg")
    col, alpha = cut(rgb)
    left = edge_line(alpha, range(150, 600, 5), "left")
    right = edge_line(alpha, range(150, 600, 5), "right")
    rows = np.nonzero((alpha[:, 560:820] > 0.5).any(1))[0]
    top, bottom = int(rows.min()), int(rows.max())
    quad = np.float32([[left(top), top], [right(top), top], [right(bottom), bottom], [left(bottom), bottom]])
    w = round(right(bottom) - left(bottom))
    size, pad = (w, bottom - top), 6
    tray, a, m = straighten(col, alpha, quad, size, pad, scale)
    hw, hh = tray.shape[1], tray.shape[0]
    # Lit by the green screen and a warm lamp, the steel reads as bronze: take most of the colour out.
    lab = cv2.cvtColor(np.clip(tray, 0, 255).astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
    lab[..., 1:] = 128 + (lab[..., 1:] - 128) * 0.3 + np.float32([0, -2])
    neutral = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB).astype(np.float32)
    plate, pbox = plate_piece(tray, a, (int(hw * 0.3), int(hh - 70 * scale), int(hw * 0.7), hh))
    tray = rows_across(neutral, (pbox[0] - 6, pbox[1] - 6, pbox[2] + 6, pbox[3] + 6))
    os.makedirs(f"{out}/tray", exist_ok=True)
    relight(tray, a, "steel", out, 88)
    plate.save(f"{out}/tray/steel-plate.webp", quality=90, method=6)
    return {"size": [hw, hh], "rim": [round(v * scale) for v in (pad, pad, pad + size[0], pad + size[1])], "plate": {"box": pbox, "size": plate.size}, "scale": scale}


# ---------- toe tag ----------

def toe_tag(src: str, out: str) -> dict:
    rgb = load(f"{src}/toe-tag.jpg")
    col, alpha = cut(rgb)
    h, w = alpha.shape
    # The eyelet: the brass ring's centre.
    sub = cv2.GaussianBlur(cv2.cvtColor(np.clip(col[330:440, 380:500], 0, 255).astype(np.uint8), cv2.COLOR_RGB2GRAY), (0, 0), 1)
    c = cv2.HoughCircles(sub, cv2.HOUGH_GRADIENT, 1, 10, param1=60, param2=15, minRadius=12, maxRadius=30)
    ex, ey = float(c[0][0][0] + 380), float(c[0][0][1] + 330)
    disc_r = 50  # the paper reinforcement round it
    # The card's straight left edge, measured above and below the string that crosses it.
    rows = list(range(int(ey) - 80, int(ey) - 30)) + list(range(int(ey) + 30, int(ey) + 80))
    edge = int(round(np.median([np.nonzero(alpha[y, 300:700] > 0.5)[0].min() + 300 for y in rows])))
    sy0, sy1 = int(ey) - 17, int(ey) + 18  # the string's rows where it lies on the card
    # The card: the keyed shape, without the string beyond its edge, with the eyelet's hole filled.
    card = np.zeros_like(alpha)
    card[150:600, edge - 6:1100] = alpha[150:600, edge - 6:1100]
    card[sy0 - 25:sy1 + 25, : edge] = 0
    card[sy0 - 25:sy1 + 25, edge:edge + 2] = card[sy0 - 40, edge:edge + 2]
    solid = (card > 0.5).astype(np.uint8)
    cnts, _ = cv2.findContours(solid, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    filled = np.zeros_like(solid)
    cv2.drawContours(filled, cnts, -1, 1, -1)
    card = np.where(filled > 0, np.maximum(card, cv2.erode(filled, np.ones((3, 3), np.uint8)).astype(np.float32)), card)
    # Paint the eyelet and string out of the card, then put the paper's grain back.
    over = np.zeros((h, w), np.uint8)
    cv2.circle(over, (round(ex), round(ey)), disc_r + 3, 1, -1)
    over[sy0 - 3:sy1 + 3, edge - 6:round(ex)] = 1
    over[sy0 - 6:sy1 + 16, edge - 6:edge + 40] = 1  # and the knot's shadow
    hole = (over & filled).astype(np.uint8)
    # Off the card counts as paper, so the fill doesn't pull the string or the screen in from the edge.
    src_ = np.where(filled[..., None] > 0, col, np.median(col[filled > 0], axis=0))
    blank = cv2.inpaint(np.clip(src_, 0, 255).astype(np.uint8), hole, 15, cv2.INPAINT_TELEA).astype(np.float32)
    paper = (filled > 0) & (cv2.dilate(hole, np.ones((61, 61), np.uint8)) > 0) & (hole == 0)
    sd = (col - cv2.GaussianBlur(col, (0, 0), 1.5))[paper].std(axis=0)
    smooth = cv2.GaussianBlur(blank, (0, 0), 3)
    grain = np.random.default_rng(11).normal(0, 1, blank.shape).astype(np.float32) * sd
    blank = np.where(hole[..., None] > 0, smooth + cv2.GaussianBlur(grain, (0, 0), 0.6) * 1.6, blank)
    ys, xs = np.nonzero(card > 0.5)
    cx0, cy0, cx1, cy1 = xs.min() - 1, ys.min() - 1, xs.max() + 2, ys.max() + 2
    os.makedirs(f"{out}/tag", exist_ok=True)
    rgba(blank[cy0:cy1, cx0:cx1], card[cy0:cy1, cx0:cx1]).save(f"{out}/tag/card.webp", quality=88, method=6)
    # The eyelet piece: the disc, the string where it lies on the card (with a feathered strip of the
    # paper under it, which matches the card it's laid back on), and the loose string off the card.
    keep = np.zeros((h, w), np.float32)
    cv2.circle(keep, (round(ex), round(ey)), disc_r + 2, 1.0, -1)
    keep[sy0:sy1, edge - 2:round(ex)] = 1
    keep = cv2.GaussianBlur(keep, (0, 0), 1.5)
    keep[:, : edge] = 1
    piece = alpha * keep
    piece[: sy0 - 60] = 0  # nothing above the string but card
    ys, xs = np.nonzero(piece > 0.05)
    px0, py0, px1, py1 = xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3
    rgba(col[py0:py1, px0:px1], piece[py0:py1, px0:px1]).save(f"{out}/tag/eyelet.webp", quality=90, method=6)
    return {
        "card": {"x": int(cx0), "y": int(cy0), "w": int(cx1 - cx0), "h": int(cy1 - cy0)},
        "eyelet": {"x": int(px0), "y": int(py0), "w": int(px1 - px0), "h": int(py1 - py0)},
        "hole": {"x": round(ex, 1), "y": round(ey, 1)},
    }


def main():
    src, out = sys.argv[1], sys.argv[2]
    which = set(sys.argv[3:]) or {"lineup", "tray", "steel", "tag"}
    meta = {}
    if "clock" in which:
        meta["clock"] = clock(src, out)
    if "lineup" in which:
        meta["lineup"] = lineup(src, out)
    if "tray" in which:
        meta["tray"] = menu_tray(src, out)
    if "steel" in which:
        meta["steel"] = steel_tray(src, out)
    if "tag" in which:
        meta["tag"] = toe_tag(src, out)
    print(json.dumps(meta, indent=1))


if __name__ == "__main__":
    main()
