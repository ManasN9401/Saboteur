"use client";

import type { ReactNode } from "react";
import { progressOf } from "@/lib/progress/xp";
import { useActiveProfile, useStats } from "@/lib/useStore";

/**
 * The open case folder the setup form lives in: the same folder that opened on the home page
 * (public/assets/folder/open-*.webp), now lying open on the desk. The inside of the cover is on the
 * left, the back panel with its tab on the right, and the form is the sheet on the back panel. Both
 * panels are 9-sliced (globals.css), so they grow with the form without stretching the tab or corners.
 * On phones only the back panel shows.
 */
export function CaseFolder({ label, cover, children }: { label: string; cover: ReactNode; children: ReactNode }) {
  return (
    <div className="casefolder rise" data-casefolder>
      <div className="casefolder__cover">{cover}</div>
      <div className="casefolder__back">
        <span className="casefolder__tab" aria-hidden="true">
          <b>{label}</b>
        </span>
        <p className="casefolder__note hand" aria-hidden="true">
          What should we <span>sabotage</span> today?
        </p>
        {children}
      </div>
    </div>
  );
}

/** A steel paper clip (public/assets/props/paperclip.webp) holding the routing slip to the cover. */
function PaperClip() {
  // eslint-disable-next-line @next/next/no-img-element -- a 61 × 240 prop, already sized
  return <img className="paperclip" src="/assets/props/paperclip.webp" alt="" width={61} height={240} aria-hidden="true" />;
}

/** What HQ has left on the inside of the cover: a note in pen, the routing slip and the procedure card. */
export function CoverNotes() {
  const profile = useActiveProfile();
  const stats = useStats();
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return (
    <div className="cover-notes">
      <div className="routing-slip">
        <PaperClip />
        <p className="routing-slip__head">Assignment</p>
        <dl>
          <dt>Agent</dt>
          <dd>{profile?.name ?? "—"}</dd>
          <dt>Rank</dt>
          <dd>{profile?.guest ? "Guest" : stats ? progressOf(stats.xp).rank : "—"}</dd>
          <dt>Date</dt>
          <dd>{today}</dd>
          <dt>Re</dt>
          <dd>New case</dd>
        </dl>
      </div>

      <p className="cover-notes__pen hand">
        What should we <span>sabotage</span> today?
      </p>

      <div className="index-card">
        <p className="index-card__head">Procedure</p>
        <ol>
          <li>Name a topic, or paste your notes.</li>
          <li>We write a clear explanation and hide two to four believable mistakes in it.</li>
          <li>A fact-checker makes sure everything else is right.</li>
        </ol>
      </div>

      <span className="stamp-mark cover-notes__stamp" aria-hidden="true">
        Confidential
      </span>
    </div>
  );
}
