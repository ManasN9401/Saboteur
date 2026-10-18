"use client";
/* eslint-disable @next/next/no-img-element -- desk layers, already sized */

import { useRef } from "react";
import { createPortal } from "react-dom";
import { boxStyle, marginStyle, PEN, propSrc, SHADOWS, useDeskProp, VERSIONS } from "@/lib/deskProps";
import { updatePrefs } from "@/lib/profile/profiles";
import type { Profile } from "@/lib/profile/schema";
import { reducedMotion } from "@/lib/prefs";
import { toast } from "@/lib/toast";
import { useActiveProfile } from "@/lib/useStore";

type Pen = Profile["prefs"]["pen"];
const PENS: Pen[] = ["red", "blue", "green", "violet"];
const NAME: Record<Pen, string> = { red: "Red", blue: "Blue", green: "Green", violet: "Violet" };

/**
 * The felt-tip lying below the calendar: the pen that crosses off the days and marks your fixes. Like
 * the calendar it's composited into each desk photo's light (scripts/assets/desk_props.py) and drawn
 * under the scrim with the photo, in each ink colour (the photo's red pen, recoloured before lighting),
 * and shows the profile's pen colour. Clicking it picks up the next pen: the same setting as
 * Settings → Pen, so every mark on the desk changes with it.
 */
export function DeskPen() {
  const profile = useActiveProfile();
  const body = useRef<HTMLDivElement>(null);
  const { host, layout } = useDeskProp(PEN);
  if (!profile || !layout?.shown) return null;
  const pen: Pen = profile.prefs.pen;

  const change = () => {
    const next = PENS[(PENS.indexOf(pen) + 1) % PENS.length];
    updatePrefs({ pen: next });
    toast(`${NAME[next]} pen`);
    if (!reducedMotion()) {
      // Knocked: it rolls a little across the desk and settles back.
      body.current?.animate({ translate: ["0 0", "1px -5px", "-0.5px 1.5px", "0 0"] }, { duration: 420, easing: "cubic-bezier(.3,.6,.3,1)" });
    }
  };

  return (
    <>
      {host &&
        createPortal(
          <>
            {VERSIONS.map((v) => (
              <img key={v} className="desk-prop-shadow desk-prop-v" data-v={v} src={propSrc("pen-shadow", v)} alt="" style={boxStyle(SHADOWS[v].pen)} />
            ))}
            <div className="desk-pen" style={layout.frame.style} aria-hidden="true">
              <div ref={body} className="desk-pen__body" style={marginStyle(PEN)}>
                {PENS.flatMap((c) => VERSIONS.map((v) => <img key={c + v} className="desk-pen__img desk-prop-v" data-v={v} data-colour={c} src={propSrc(`pen-${c}`, v)} alt="" />))}
              </div>
            </div>
          </>,
          host,
        )}
      {layout.usable && (
        <button type="button" className="desk-pen-hit" style={layout.frame.style} onClick={change} aria-label={`Pen colour: ${NAME[pen].toLowerCase()}. Change`} title="Change pen" />
      )}
    </>
  );
}
