// Where things in the desk photos land on screen. The photos (1376 × 768) are drawn by .desk__photo,
// inset -2% on every side and cover-cropped, so a point in the photo moves with the viewport's shape.
export const PLATE = { w: 1376, h: 768 } as const;
const BLEED = 0.02;

/** Photo pixels → viewport pixels for the current window size, plus the photo's scale. */
export function plateToScreen(px: number, py: number, vw = window.innerWidth, vh = window.innerHeight) {
  const W = vw * (1 + 2 * BLEED);
  const H = vh * (1 + 2 * BLEED);
  const scale = Math.max(W / PLATE.w, H / PLATE.h);
  const x0 = -vw * BLEED + (W - PLATE.w * scale) / 2;
  const y0 = -vh * BLEED + (H - PLATE.h * scale) / 2;
  return { x: x0 + px * scale, y: y0 + py * scale, scale };
}
