"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js, which serves the offline page when there's no network. Production only: in
 * development a worker would sit between the dev server and its hot reloads.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    // After load, so it never competes with the page for the network.
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
