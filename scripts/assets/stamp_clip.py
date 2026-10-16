"""Prepare stamp footage for multiply blending (roadmap A-07/A-08, V04-12).

    python3 -I scripts/assets/stamp_clip.py SRC.mp4 OUT_BASENAME --crop X0,X1 --frames A,B --speed 1.4

Multiply only hides the background if it is pure white, but generated footage has an off-white,
vignetted sweep. Each frame is divided by a clean background frame (flat-field), which makes the
paper exactly white and keeps the stamp and its shadow. The clip is then trimmed, sped up,
cropped to the action and encoded as WebM (VP9) and MP4 (H.264).
"""
import argparse
import glob
import os
import subprocess
import tempfile

import numpy as np
from PIL import Image


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--crop", required=True, help="x0,x1 in source pixels")
    ap.add_argument("--frames", required=True, help="first,last source frame to keep")
    ap.add_argument("--bg-frames", default="-12,-1", help="frames that show only paper (python slice)")
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--fps", type=int, default=30)
    args = ap.parse_args()
    x0, x1 = map(int, args.crop.split(","))
    first, last = map(int, args.frames.split(","))

    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["ffmpeg", "-v", "error", "-i", args.src, f"{tmp}/%04d.png"], check=True)
        frames = sorted(glob.glob(f"{tmp}/*.png"))
        b0, b1 = map(int, args.bg_frames.split(","))
        bg_set = frames[b0:b1 + 1 if b1 != -1 else None]
        bg = np.mean([np.asarray(Image.open(f).convert("RGB")).astype(np.float32) for f in bg_set], axis=0)
        bg = np.maximum(bg, 1)

        out_dir = f"{tmp}/out"
        os.makedirs(out_dir)
        for i, f in enumerate(frames[first:last + 1]):
            a = np.asarray(Image.open(f).convert("RGB")).astype(np.float32)
            flat = np.clip(a / bg * 255 * 1.015, 0, 255)
            Image.fromarray(flat[:, x0:x1].astype(np.uint8)).save(f"{out_dir}/{i:04d}.png")

        rate = 24 * args.speed
        common = ["ffmpeg", "-v", "error", "-y", "-framerate", f"{rate}", "-i", f"{out_dir}/%04d.png", "-r", str(args.fps), "-an"]
        subprocess.run(common + ["-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0", "-pix_fmt", "yuv420p", f"{args.out}.webm"], check=True)
        subprocess.run(common + ["-c:v", "libx264", "-crf", "24", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", f"{args.out}.mp4"], check=True)

    n = last - first + 1
    print(f"{args.out}: {x1 - x0}px wide, {n / rate:.2f}s at {args.speed}x")


if __name__ == "__main__":
    main()
