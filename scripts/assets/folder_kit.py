"""Folder pieces and paper textures for the menu and cards (roadmap A-09).

    python3 scripts/assets/folder_kit.py BATCH_DIR OUT_DIR

Folder: the aged manila folder (keyed with cutout.py) is sliced so the tab can sit anywhere along
the top edge: left corner | plain edge (repeats) | tab | plain edge | right corner, plus a bottom
edge for the last folder in a stack. Coordinates are in the keyed image (1202 × 579).

Textures: the generator's sparkle mark is filled, then each texture is divided by its own blurred
average so only the fibres remain; cards keep their themed colour and get real paper grain on top.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutout import despill, key, remove_specks  # noqa: E402
from plates import fill, star_mask  # noqa: E402

SCALE = 0.75  # export size relative to the source; displayed at about half that, so crisp at 2×
TOP_H = 262  # tab plus enough body that the next folder in the stack covers the cut
SLICES = {"left": (0, 140), "edge": (160, 340), "tab": (350, 850), "right": (1060, 1202)}
FOOT = (500, 579)


def keyed(path: str) -> Image.Image:
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    rgb = fill(rgb, star_mask(*Image.open(path).size))  # the mark sits on the folder's corner
    alpha = remove_specks(key(rgb))
    a = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    alpha = np.asarray(a).astype(np.float32) / 255
    im = Image.fromarray(np.dstack([despill(rgb, alpha), alpha * 255]).astype(np.uint8), "RGBA")
    return im.crop(im.getbbox())


def mirrored(im: Image.Image) -> Image.Image:
    """A tile followed by its mirror image: repeats with no visible join."""
    out = Image.new("RGBA", (im.width * 2, im.height))
    out.paste(im, (0, 0))
    out.paste(im.transpose(Image.FLIP_LEFT_RIGHT), (im.width, 0))
    return out


def save(im: Image.Image, path: str):
    im = im.resize((max(1, round(im.width * SCALE)), max(1, round(im.height * SCALE))), Image.LANCZOS)
    im.save(path + ".webp", quality=86, method=6)
    print(os.path.basename(path), im.size)


def texture(src: str, out: str, width: int = 1024, strength: float = 1.0):
    rgb = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
    rgb = fill(rgb, star_mask(*Image.open(src).size))
    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
    avg = np.asarray(img.filter(ImageFilter.GaussianBlur(40))).astype(np.float32)
    detail = rgb / np.maximum(avg, 1)  # 1.0 = average paper, < 1 = fibres and creases
    flat = np.clip(255 * (1 - (1 - detail) * strength), 0, 255).astype(np.uint8)
    t = Image.fromarray(flat).convert("L").resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    t.save(out + ".webp", quality=82, method=6)
    print(os.path.basename(out), t.size)


def main():
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    folder = keyed(f"{src}/folder-aged.jpg")
    assert folder.size[0] > 1150, folder.size
    top = folder.crop((0, 0, folder.width, TOP_H))
    for name, (x0, x1) in SLICES.items():
        piece = top.crop((x0, 0, min(x1, folder.width), TOP_H))
        save(mirrored(piece) if name == "edge" else piece, f"{out}/folder-{name}")
    foot = folder.crop((0, FOOT[0], folder.width, folder.height))
    save(foot.crop((0, 0, 140, foot.height)), f"{out}/folder-foot-left")
    save(mirrored(foot.crop((160, 0, 340, foot.height))), f"{out}/folder-foot-edge")
    save(foot.crop((1060, 0, foot.width, foot.height)), f"{out}/folder-foot-right")

    texture(f"{src}/tex-paper.jpg", f"{out}/grain-paper", strength=1.4)
    texture(f"{src}/tex-manila.jpg", f"{out}/grain-manila")


if __name__ == "__main__":
    main()
