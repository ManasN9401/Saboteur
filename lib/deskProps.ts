"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { plateToScreen } from "./desk";

// The calendar and the felt-tip are composited into each desk photo's own light by
// scripts/assets/desk_props.py (public/assets/desk-props/). These are its numbers, in desk-photo
// pixels (1376 × 768): where each prop lies, how big, at what angle, the margin its image has around
// the prop's own frame (for the calendar's side and the pen's edges), and each shadow layer's box.
export interface PropSpec {
  cx: number;
  cy: number;
  w: number;
  hgt: number;
  rot: number;
  margin: number;
}
export const CAL: PropSpec = { cx: 1085, cy: 360, w: 250, hgt: 206.9078947368421, rot: 3, margin: 14 };
export const PEN: PropSpec = { cx: 1062, cy: 516, w: 185, hgt: 20.634615384615383, rot: -17, margin: 4 };

export const VERSIONS = ["day", "dusk", "night", "night-off"] as const;
export type Version = (typeof VERSIONS)[number];
type Box = readonly [number, number, number, number];
export const SHADOWS: Record<Version, { cal: Box; pen: Box }> = {
  day: { cal: [905, 195, 1250, 538], pen: [937, 400, 1178, 639] },
  dusk: { cal: [871, 195, 1250, 563], pen: [919, 400, 1178, 653] },
  night: { cal: [920, 195, 1287, 535], pen: [946, 400, 1198, 642] },
  "night-off": { cal: [920, 195, 1250, 525], pen: [946, 400, 1178, 632] },
};

export const propSrc = (name: string, v: Version) => `/assets/desk-props/${name}-${v}.webp`;

export interface Frame {
  style: CSSProperties;
  /** Screen bounds of the frame (unrotated). */
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A prop's frame on screen: its own box, centred where it lies on the desk, turned to its angle. */
export function frameOf(spec: PropSpec): Frame {
  const { x, y, scale } = plateToScreen(spec.cx, spec.cy);
  const width = spec.w * scale;
  const height = spec.hgt * scale;
  const left = x - width / 2;
  const top = y - height / 2;
  return { style: { left, top, width, height, rotate: `${spec.rot}deg` }, left, top, right: left + width, bottom: top + height };
}

/** A shadow layer's box on screen (not rotated: the script rendered it straight in photo pixels). */
export function boxStyle([x0, y0, x1, y1]: Box): CSSProperties {
  const a = plateToScreen(x0, y0);
  const b = plateToScreen(x1, y1);
  return { left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y };
}

/** The image around a frame, as percentages of the frame (it has `margin` photo px on every side). */
export function marginStyle(spec: PropSpec): CSSProperties {
  const mx = (spec.margin / spec.w) * 100;
  const my = (spec.margin / spec.hgt) * 100;
  return { left: `${-mx}%`, top: `${-my}%`, width: `${100 + 2 * mx}%`, height: `${100 + 2 * my}%` };
}

/** Half the menu's width: the props sit to its right, so they only take part when clear of it. */
const MENU_HALF = 290;

export interface DeskLayout {
  frame: Frame;
  /** The whole frame is on screen and clear of the menu: it can be used, not just seen. */
  usable: boolean;
  /** Worth drawing at all: on screen and not under the menu. */
  shown: boolean;
}

/**
 * Where a prop is on screen now, and the element the desk's props are drawn into (.desk__props, under
 * the scrim, so they're lit and dimmed exactly like the photo). Null until mounted, and again when the
 * page is hidden, so the props leave with it.
 */
export function useDeskProp(spec: PropSpec): { host: HTMLElement | null; layout: DeskLayout | null } {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [layout, setLayout] = useState<DeskLayout | null>(null);
  useEffect(() => {
    const place = () => {
      const frame = frameOf(spec);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const clearOfMenu = frame.left >= vw / 2 + MENU_HALF;
      const usable = clearOfMenu && frame.right <= vw - 12 && frame.top >= 64 && frame.bottom <= vh - 12;
      const shown = clearOfMenu && frame.left < vw && frame.top < vh;
      setLayout({ frame, usable, shown });
      setHost(document.querySelector<HTMLElement>(".desk__props"));
    };
    place();
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("resize", place);
      setHost(null);
    };
  }, [spec]);
  return { host, layout };
}
