// Turning settings into the page: every visual option becomes a data attribute or CSS variable on
// <html> (the tokens live in globals.css). The same values are cached under one small key so the
// pre-paint script in layout.tsx can apply them before the first frame: no flash of the wrong theme.
import type { DevicePrefs, ProfilePrefs } from "./profile/schema";
import { PREFIX } from "./storage/keys";

export const PAINT_KEY = `${PREFIX}paint`;

/** What the pre-paint script reads: short keys, because the script is inlined into every page. */
export interface PaintCache {
  t: ProfilePrefs["theme"];
  m: DevicePrefs["motion"];
  ts: DevicePrefs["titleScreen"];
  desk: ProfilePrefs["desk"];
  pen: ProfilePrefs["pen"];
  ink: ProfilePrefs["ink"];
  density: ProfilePrefs["density"];
  font: ProfilePrefs["font"];
  /** Text size in percent. */
  x: number;
}

export function resolveTheme(theme: ProfilePrefs["theme"], hour: number, systemDark: boolean): "light" | "dark" {
  if (theme === "day") return "light";
  if (theme === "night") return "dark";
  if (theme === "auto") return hour >= 7 && hour < 19 ? "light" : "dark";
  return systemDark ? "dark" : "light";
}

export function resolveMotion(motion: DevicePrefs["motion"], systemReduced: boolean): "reduced" | "full" {
  if (motion === "system") return systemReduced ? "reduced" : "full";
  return motion;
}

export function paintCache(p: ProfilePrefs, d: DevicePrefs): PaintCache {
  return { t: p.theme, m: d.motion, ts: d.titleScreen, desk: p.desk, pen: p.pen, ink: p.ink, density: p.density, font: p.font, x: p.textSize };
}

const media = (q: string) => typeof window !== "undefined" && window.matchMedia(q).matches;

export function applyPrefs(p: ProfilePrefs, d: DevicePrefs) {
  const root = document.documentElement;
  const set = (k: string, v: string) => root.dataset[k] !== v && (root.dataset[k] = v);
  set("theme", resolveTheme(p.theme, new Date().getHours(), media("(prefers-color-scheme: dark)")));
  set("motion", resolveMotion(d.motion, media("(prefers-reduced-motion: reduce)")));
  set("desk", p.desk);
  set("pen", p.pen);
  set("ink", p.ink);
  set("density", p.density);
  set("font", p.font);
  root.style.setProperty("--text-scale", String(p.textSize / 100));
  root.style.setProperty("--round-text", String(p.roundText));
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) meta.content = root.dataset.theme === "dark" ? "#22160c" : "#d9c8ac";
  try {
    window.localStorage.setItem(PAINT_KEY, JSON.stringify(paintCache(p, d)));
  } catch {
    /* the next load just starts from the defaults */
  }
}

/** Whether animations should be skipped: the player's choice, else the system's. */
export function reducedMotion(): boolean {
  if (typeof document === "undefined") return false;
  const m = document.documentElement.dataset.motion;
  return m ? m === "reduced" : media("(prefers-reduced-motion: reduce)");
}

/**
 * The inline script that applies the cached settings before first paint. Also sets the desk's
 * daypart (dusk is 17:00–19:59; "?daypart=" overrides it for previews), and leaves the night lamp off
 * for the title card so it can switch on.
 */
export const PAINT_SCRIPT = `try{var d=document.documentElement,s=d.dataset,h=new Date().getHours(),M=function(q){return matchMedia(q).matches},p={};try{p=JSON.parse(localStorage.getItem("${PAINT_KEY}"))||{}}catch(e){}var t=p.t;s.daypart=new URLSearchParams(location.search).get("daypart")||(h>=17&&h<20?"dusk":"day");s.theme=t=="night"||(t=="auto"&&(h<7||h>=19))||((!t||t=="system")&&M("(prefers-color-scheme: dark)"))?"dark":"light";s.motion=p.m=="full"||p.m=="reduced"?p.m:M("(prefers-reduced-motion: reduce)")?"reduced":"full";["desk","pen","ink","density","font"].forEach(function(k){p[k]&&(s[k]=p[k])});p.x&&d.style.setProperty("--text-scale",p.x/100);if(s.theme=="dark"&&location.pathname=="/"&&p.ts!="never"&&(p.ts=="always"||sessionStorage.getItem("saboteur:v1:title-seen")!="1"))s.lamp="off"}catch(e){}`;
