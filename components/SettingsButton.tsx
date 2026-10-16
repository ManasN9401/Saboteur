"use client";

import { openSettings } from "@/lib/events";

/** The gear that opens Settings: in the nav, and in a corner of the home page. */
export function SettingsButton({ className = "" }: { className?: string }) {
  return (
    <button type="button" className={`icon-btn ${className}`} onClick={() => openSettings()} aria-label="Settings" title="Settings">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          fill="currentColor"
          d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-1.7-1l-.4-2.6h-4l-.4 2.6a7.3 7.3 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.7 1.7 1l.4 2.6h4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.4 1 2-3.4-2-1.6ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
        />
      </svg>
    </button>
  );
}
