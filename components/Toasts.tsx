"use client";
/* eslint-disable @next/next/no-img-element -- small badge art, already sized */

import { useSyncExternalStore } from "react";
import { dismiss, toastStore } from "@/lib/toast";

/** The one place passing messages appear: top right, clear of every submit button, read out politely. */
export function Toasts() {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.snapshot, toastStore.server);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} type="button" className="toast paper" data-tone={t.tone} onClick={() => dismiss(t.id)} aria-label={`${t.text}. Dismiss`}>
          {t.art && <img src={t.art} alt="" width={40} height={40} />}
          <span>{t.text}</span>
        </button>
      ))}
    </div>
  );
}
