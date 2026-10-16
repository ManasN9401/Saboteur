"""Steam rising off the desk mug: isolate the steam and make it loop (roadmap A-10).

    python3 -I scripts/assets/steam_loop.py SRC.mp4 OUT_BASENAME [--start 1.8 --fade 1.2 --width 640]

Steam only ever adds light, so the per-pixel minimum over the whole clip is the empty mug. Subtracting
it leaves grey steam on black, which disappears under `mix-blend-mode: screen`. The clip starts with no
steam, so the loop uses the steady part and crossfades its end into its start: no visible seam.
"""
import argparse
import os
import subprocess
import tempfile

import numpy as np
from PIL import Image


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--start", type=float, default=1.8)
    ap.add_argument("--fade", type=float, default=1.2)
    ap.add_argument("--width", type=int, default=640)
    ap.add_argument("--fps", type=int, default=24)
    args = ap.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["ffmpeg", "-v", "error", "-i", args.src, "-vf", f"scale={args.width}:-2,format=gray", f"{tmp}/%04d.png"], check=True)
        names = sorted(f for f in os.listdir(tmp) if f.endswith(".png"))
        frames = np.stack([np.asarray(Image.open(f"{tmp}/{n}")) for n in names]).astype(np.int16)
        clean = frames.min(axis=0)
        steam = np.clip((frames - clean - 5) * 1.5, 0, 255).astype(np.float32)
        # Anything that doesn't move (the mug's rim catching light) is not steam: remove it.
        steam = np.clip(steam - np.median(steam, axis=0) * 1.2, 0, 255)
        # Hide the generator's sparkle mark (bottom right) and soften the frame edges.
        h, w = steam.shape[1:]
        yy, xx = np.mgrid[0:h, 0:w]
        edge = np.clip(np.minimum.reduce([xx, w - 1 - xx, yy, h - 1 - yy]) / (0.08 * w), 0, 1)
        steam *= edge[None]
        steam[:, int(h * 0.78):, int(w * 0.86):] = 0

        a = round(args.start * args.fps)
        d = round(args.fade * args.fps)
        n = len(steam) - a - d  # loop length in frames
        out = []
        for t in range(n):
            base = steam[a + d + t] if a + d + t < len(steam) else steam[-1]
            if t >= n - d:
                k = (t - (n - d)) / d
                k = k * k * (3 - 2 * k)  # smoothstep
                base = base * (1 - k) + steam[a + (t - (n - d))] * k
            out.append(base)
        os.makedirs(f"{tmp}/o")
        for i, f in enumerate(out):
            Image.fromarray(np.clip(f, 0, 255).astype(np.uint8)).save(f"{tmp}/o/{i:04d}.png")
        common = ["ffmpeg", "-v", "error", "-y", "-framerate", str(args.fps), "-i", f"{tmp}/o/%04d.png", "-an"]
        subprocess.run(common + ["-c:v", "libvpx-vp9", "-crf", "36", "-b:v", "0", "-pix_fmt", "yuv420p", f"{args.out}.webm"], check=True)
        subprocess.run(common + ["-c:v", "libx264", "-crf", "26", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", f"{args.out}.mp4"], check=True)

        # Seam check: the last frame should lead straight into the first.
        def diff(x, y):
            return float(np.abs(x - y).mean())

        print(f"{args.out}: {n} frames ({n / args.fps:.2f}s); seam diff {diff(out[-1], out[0]):.2f} vs typical step {diff(out[10], out[11]):.2f}")


if __name__ == "__main__":
    main()
