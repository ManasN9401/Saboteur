"use client";
/* eslint-disable @next/next/no-img-element -- decorative pieces of one animation, already sized WebP */

import { useEffect, useRef } from "react";

// Pieces cut from the generated closed and open folders (public/assets/folder/open-*.webp).
// Base is 805 × 647; the front cover starts 33 px down (below the back panel's tab).
const BASE = { w: 805, h: 647, coverTop: 33 };
// When the sheet has lifted (see the fopen-* keyframes in globals.css).
const NAVIGATE_AT = 1150;
const PIECES = ["open-base", "open-cover", "open-inside", "open-paper"].map((n) => `/assets/folder/${n}.webp`);

/** Fetch the pieces ahead of time so the first opening doesn't wait on them. */
export function preloadFolderOpen() {
  for (const src of PIECES) new Image().src = src;
}

/**
 * The transition into a new case: a manila folder lands on the desk, its cover swings open on the
 * spine, and the blank sheet inside lifts towards you. Built in code from two stills (a 3D flip),
 * since generated footage of a folder opening wasn't usable.
 *
 * The home page is hidden the moment we navigate, so the open folder is copied out to <body> and
 * held there until the setup page calls `landFolderSheet`, which flies the sheet onto the form.
 */
export function FolderOpen({ onNavigate }: { onNavigate: () => void }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const go = window.setTimeout(() => {
      const node = root.current;
      if (node) hold(node);
      document.documentElement.dataset.arrive = "folder"; // the setup form skips its entrance (see globals.css)
      onNavigate();
    }, NAVIGATE_AT);
    return () => window.clearTimeout(go);
  }, [onNavigate]);

  return (
    <div ref={root} className="fopen" aria-hidden="true">
      <div className="fopen__dim" />
      <div className="fopen__folder" style={{ aspectRatio: `${BASE.w} / ${BASE.h}` }}>
        <img className="fopen__base" src="/assets/folder/open-base.webp" alt="" />
        <div className="fopen__paper">
          <img src="/assets/folder/open-paper.webp" alt="" />
        </div>
        <div className="fopen__cover" style={{ top: `${(BASE.coverTop / BASE.h) * 100}%` }}>
          <img className="fopen__front" src="/assets/folder/open-cover.webp" alt="" />
          <img className="fopen__back" src="/assets/folder/open-inside.webp" alt="" />
        </div>
      </div>
    </div>
  );
}

let held: HTMLElement | null = null;
let giveUp = 0;

/** Copy the open folder, frozen in its final pose, to <body> so it outlives the home page. */
function hold(node: HTMLElement) {
  release();
  held = node.cloneNode(true) as HTMLElement;
  held.classList.add("fopen--held");
  document.body.append(held);
  node.style.visibility = "hidden"; // one copy on screen, or the dimming doubles up
  // If the setup page never claims it (navigation failed, or went elsewhere), fade it away.
  giveUp = window.setTimeout(() => {
    held?.animate({ opacity: [1, 0] }, { duration: 250, fill: "forwards" }).finished.then(release, release);
  }, 6000);
}

function release() {
  window.clearTimeout(giveUp);
  held?.remove();
  held = null;
  delete document.documentElement.dataset.arrive;
}

/**
 * Called by the setup page as it appears: the lifted sheet travels to where the form sits, the folder
 * and the dimming fade away, and the form fades in over the sheet, so the sheet becomes the form.
 */
export function landFolderSheet(form: HTMLElement) {
  if (!held) return;
  const scene = held;
  const sheet = scene.querySelector<HTMLElement>(".fopen__paper");
  const folder = scene.querySelector<HTMLElement>(".fopen__folder");
  const dim = scene.querySelector<HTMLElement>(".fopen__dim");
  if (!sheet || !folder || !dim) return release();
  window.clearTimeout(giveUp);

  const from = sheet.getBoundingClientRect();
  const to = form.getBoundingClientRect();
  // Travel on its own, outside the folder's 3D transforms: a box the size of the form, started
  // scaled down to the sheet. The sheet is blank, so the slight change in proportions doesn't show.
  const fly = document.createElement("div");
  fly.className = "fopen__fly";
  fly.append(sheet.querySelector("img")!.cloneNode());
  Object.assign(fly.style, { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px` });
  scene.append(fly);
  sheet.style.visibility = "hidden";
  form.style.opacity = "0";

  const travel = { duration: 520, easing: "cubic-bezier(.3,0,.15,1)", fill: "forwards" } as const;
  const start = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
  fly.animate({ transform: [start, "none"], boxShadow: ["0 22px 36px rgba(0,0,0,.38)", "0 2px 6px rgba(0,0,0,.18)"] }, travel);
  folder.animate({ opacity: [1, 0], scale: [1, 0.97] }, { duration: 180, easing: "ease-out", fill: "forwards" });
  dim.animate({ opacity: [Number(getComputedStyle(dim).opacity), 0] }, { duration: 520, easing: "ease-out", fill: "forwards" });

  window.setTimeout(() => {
    // The form is solid paper under the sheet: fading only the sheet keeps the desk from showing through.
    form.style.opacity = "";
    // Clearing data-arrive restarts the form's entrance; it has already arrived, so skip to the end.
    const done = () => {
      release();
      for (const a of form.getAnimations()) a.finish();
    };
    fly.animate({ opacity: [1, 0] }, { duration: 240, easing: "ease-in-out", fill: "forwards" }).finished.then(done, done);
  }, 400);
}
