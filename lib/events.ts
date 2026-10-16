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
