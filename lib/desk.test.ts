import { describe, expect, it } from "vitest";
import { PLATE, plateToScreen } from "./desk";

describe("plateToScreen", () => {
  it("maps the photo centre to the viewport centre", () => {
    for (const [vw, vh] of [[1440, 900], [390, 844], [2560, 1080]]) {
      const c = plateToScreen(PLATE.w / 2, PLATE.h / 2, vw, vh);
      expect(c.x).toBeCloseTo(vw / 2, 6);
      expect(c.y).toBeCloseTo(vh / 2, 6);
    }
  });

  it("covers the viewport: photo corners are at or beyond the edges", () => {
    const tl = plateToScreen(0, 0, 1440, 900);
    const br = plateToScreen(PLATE.w, PLATE.h, 1440, 900);
    expect(tl.x).toBeLessThanOrEqual(0);
    expect(tl.y).toBeLessThanOrEqual(0);
    expect(br.x).toBeGreaterThanOrEqual(1440);
    expect(br.y).toBeGreaterThanOrEqual(900);
  });
});
