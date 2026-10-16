"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRedactedNavigate } from "./RedactionTransition";
import { ProfileChip } from "./ProfileChip";
import { SettingsButton } from "./SettingsButton";

export function Nav() {
  const pathname = usePathname();
  const navigate = useRedactedNavigate();
  // The front door has its own wordmark and menu.
  if (pathname === "/") return null;
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
      <Link href="/" className="flex items-center gap-2.5 text-[21px] font-[760] tracking-tight text-desk no-underline" style={{ fontFamily: "var(--font-display)" }}>
        <span aria-hidden="true" className="relative inline-block h-[11px] w-[26px] rounded-[1px] bg-current">
          <span className="absolute inset-x-1 top-1/2 h-[2px] -translate-y-1/2 bg-pen" />
        </span>
        Saboteur
      </Link>
      <div className="flex items-center gap-2.5">
        {pathname !== "/play" && (
          <button type="button" className="btn btn--desk btn--small" onClick={() => navigate("/play", "NEW CASE FILE")}>
            New round
          </button>
        )}
        <ProfileChip />
        <SettingsButton />
      </div>
    </header>
  );
}
