// Small app-wide signals between components that don't share a parent.
export type SettingsTab = "look" | "play" | "device" | "data";

const SETTINGS = "saboteur:settings";

export function openSettings(tab: SettingsTab = "look") {
  window.dispatchEvent(new CustomEvent<SettingsTab>(SETTINGS, { detail: tab }));
}

export function onOpenSettings(fn: (tab: SettingsTab) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<SettingsTab>).detail);
  window.addEventListener(SETTINGS, handler);
  return () => window.removeEventListener(SETTINGS, handler);
}

const CLOCK = "saboteur:clock";

/** Open the clock card (the desk clock, or the running-timer chip on any page). */
export function openClock() {
  window.dispatchEvent(new CustomEvent(CLOCK));
}

export function onOpenClock(fn: () => void) {
  window.addEventListener(CLOCK, fn);
  return () => window.removeEventListener(CLOCK, fn);
}
