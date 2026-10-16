"use client";

import { useEffect, useRef, useState } from "react";
import { openSettings } from "@/lib/events";
import { setActive } from "@/lib/profile/profiles";
import { MAX_PROFILES } from "@/lib/profile/schema";
import { progressOf } from "@/lib/progress/xp";
import { toast } from "@/lib/toast";
import { useProfiles, useStats } from "@/lib/useStore";
import { Avatar } from "./Avatar";
import { useRedactedNavigate } from "./RedactionTransition";

/** Who's playing, top right: their pin and rank, with a menu to switch, add a recruit or open the Dossier. */
export function ProfileChip({ onDesk = true }: { onDesk?: boolean }) {
  const all = useProfiles();
  const stats = useStats();
  const navigate = useRedactedNavigate();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!all) return null;
  const me = all.profiles.find((p) => p.id === all.activeId);
  if (!me) return null;
  const rank = progressOf(stats?.xp ?? 0).rank;
  const go = (href: string, label: string) => {
    setOpen(false);
    navigate(href, label);
  };

  return (
    <div className="profile-chip" ref={root} data-desk={onDesk}>
      <button type="button" className="profile-chip__button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Avatar avatar={me.avatar} name={me.name} size={30} />
        <span className="profile-chip__text">
          <b>{me.name}</b>
          <small>{me.guest ? "Guest" : rank}</small>
        </span>
      </button>
      {open && (
        <div className="profile-chip__menu paper" role="menu" aria-label="Profiles">
          {all.profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitemradio"
              aria-checked={p.id === me.id}
              className="profile-chip__item"
              onClick={() => {
                setOpen(false);
                if (p.id === me.id) return;
                setActive(p.id);
                toast(`Now investigating: ${p.name}`);
              }}
            >
              <Avatar avatar={p.avatar} name={p.name} size={26} />
              <span>{p.name}</span>
              {p.id === me.id && <span className="ml-auto text-[12px] text-ink-faint">playing</span>}
            </button>
          ))}
          <hr />
          {all.profiles.length < MAX_PROFILES && (
            <button type="button" role="menuitem" className="profile-chip__item" onClick={() => go("/recruit", "NEW RECRUIT")}>
              + New recruit
            </button>
          )}
          <button type="button" role="menuitem" className="profile-chip__item" onClick={() => go("/dossier", "DOSSIER")}>
            Dossier
          </button>
          <button
            type="button"
            role="menuitem"
            className="profile-chip__item"
            onClick={() => {
              setOpen(false);
              openSettings();
            }}
          >
            Settings
          </button>
        </div>
      )}
    </div>
  );
}
