"use client";

import { useEffect } from "react";
import { applyPrefs } from "@/lib/prefs";
import { DevicePrefsSchema, ProfilePrefsSchema } from "@/lib/profile/schema";
import { useActiveProfile, useDevicePrefs } from "@/lib/useStore";

const DEFAULT_PROFILE = ProfilePrefsSchema.parse({});
const DEFAULT_DEVICE = DevicePrefsSchema.parse({});

/** Keeps <html>'s attributes in step with the active profile's settings, the system and the clock. */
export function PrefsSync() {
  const profile = useActiveProfile();
  const device = useDevicePrefs();

  useEffect(() => {
    if (profile === undefined || device === undefined) return;
    const p = profile?.prefs ?? DEFAULT_PROFILE;
    const d = device ?? DEFAULT_DEVICE;
    const apply = () => applyPrefs(p, d);
    apply();
    // "Follow system" and "Auto by time" can change while the page is open.
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    dark.addEventListener("change", apply);
    motion.addEventListener("change", apply);
    const tick = window.setInterval(apply, 5 * 60 * 1000);
    return () => {
      dark.removeEventListener("change", apply);
      motion.removeEventListener("change", apply);
      window.clearInterval(tick);
    };
  }, [profile, device]);

  return null;
}
