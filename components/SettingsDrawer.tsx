"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { onOpenSettings, type SettingsTab } from "@/lib/events";
import { exportProfile, getStats, importProfile, ProfileError, saveDevicePrefs, saveStats, setActive, updatePrefs } from "@/lib/profile/profiles";
import { DevicePrefsSchema, emptyStats, ProfilePrefsSchema, type DevicePrefs, type ProfilePrefs } from "@/lib/profile/schema";
import { toast } from "@/lib/toast";
import { useActiveProfile, useDevicePrefs } from "@/lib/useStore";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "look", label: "Look" },
  { id: "play", label: "Play" },
  { id: "device", label: "Device" },
  { id: "data", label: "Data" },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A row of mutually exclusive choices, styled like the setup page's difficulty picker. */
function Choice<T extends string | number>({ name, label, value, options, onChange, hint }: { name: string; label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; hint?: ReactNode }) {
  return (
    <fieldset className="field">
      <legend className="label mb-2">{label}</legend>
      <div className="segmented" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <label key={String(o.value)}>
            <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
      {hint && <p className="mt-1.5 text-[13.5px] leading-snug text-ink-faint">{hint}</p>}
    </fieldset>
  );
}

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A tiny case file that shows the current look: pen, inks, reading font and size, all live. */
function Preview() {
  return (
    <div className="paper settings-preview" aria-hidden="true">
      <p className="label mb-2">Case file · sample</p>
      <p className="passage settings-preview__text">
        <span className="sentence" data-verdict="catch">
          Water boils at 100 °C at sea level.
        </span>{" "}
        <span className="sentence" data-verdict="miss">
          Ice is denser than water.
        </span>{" "}
        <span className="sentence" data-flagged="true">
          Steam is invisible.
        </span>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="verdict-tag" data-kind="catch">
          Caught
        </span>
        <span className="verdict-tag" data-kind="miss">
          Missed
        </span>
        <span className="verdict-tag" data-kind="false_flag">
          False alarm
        </span>
        <span className="hand ml-auto text-[22px] leading-none text-pen">your fix</span>
      </div>
    </div>
  );
}

/** Settings, in an index-card drawer. Everything applies the moment it changes. */
export function SettingsDrawer() {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<SettingsTab>("look");
  const profile = useActiveProfile();
  const device = useDevicePrefs();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(
    () =>
      onOpenSettings((t) => {
        setTab(t);
        if (ref.current && !ref.current.open) ref.current.showModal();
      }),
    [],
  );

  const p: ProfilePrefs = profile?.prefs ?? ProfilePrefsSchema.parse({});
  const d: DevicePrefs = device ?? DevicePrefsSchema.parse({});
  const setP = <K extends keyof ProfilePrefs>(k: K, v: ProfilePrefs[K]) => updatePrefs({ [k]: v } as Partial<ProfilePrefs>);
  const setD = <K extends keyof DevicePrefs>(k: K, v: DevicePrefs[K]) => saveDevicePrefs({ [k]: v } as Partial<DevicePrefs>);

  async function onImport(file: File) {
    try {
      const restored = importProfile(JSON.parse(await file.text()));
      setActive(restored.id);
      toast(`Welcome back, ${restored.name}. Profile restored.`, { tone: "good" });
    } catch (err) {
      toast(err instanceof ProfileError ? err.message : "That file couldn't be read.", { tone: "warn" });
    }
  }

  return (
    <dialog ref={ref} className="drawer" aria-labelledby="settings-title" onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <div className="drawer__card paper">
        <div className="drawer__tabs" role="tablist" aria-label="Settings sections">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" id={`settings-tab-${t.id}`} aria-selected={tab === t.id} aria-controls="settings-panel" className="drawer__tab" onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="drawer__head">
          <h2 id="settings-title" className="display text-[34px]">
            Settings
          </h2>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => ref.current?.close()}>
            Done
          </button>
        </div>
        <p className="label -mt-2 mb-5">{tab === "device" ? "This device" : `For ${profile?.name ?? "this profile"}`}</p>

        <div id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${tab}`} className="grid gap-6">
          {tab === "look" && (
            <>
              <Preview />
              <Choice name="theme" label="Desk lighting" value={p.theme} onChange={(v) => setP("theme", v)} options={[{ value: "system", label: "System" }, { value: "day", label: "Day" }, { value: "night", label: "Night" }, { value: "auto", label: "By time" }]} hint={p.theme === "auto" ? "Day from 7:00 to 19:00, night otherwise." : undefined} />
              <Choice name="desk" label="Desk" value={p.desk} onChange={(v) => setP("desk", v)} options={[{ value: "oak", label: "Oak" }, { value: "plain", label: "Plain" }]} hint="Plain drops the photograph: the fastest option on slow devices." />
              <Choice name="pen" label="Pen" value={p.pen} onChange={(v) => setP("pen", v)} options={[{ value: "red", label: "Red" }, { value: "blue", label: "Blue" }, { value: "green", label: "Green" }, { value: "violet", label: "Violet" }]} />
              <Choice name="ink" label="Stamp ink" value={p.ink} onChange={(v) => setP("ink", v)} options={[{ value: "classic", label: "Classic" }, { value: "safe", label: "Colour-safe" }, { value: "mono", label: "Black" }]} hint="Colour-safe uses blue and orange, which read apart with any colour vision. Verdicts always carry ✓ ✗ ⚠ as well." />
              <Choice name="text" label="Text size" value={p.textSize} onChange={(v) => setP("textSize", v)} options={[{ value: 90, label: "90%" }, { value: 100, label: "100%" }, { value: 115, label: "115%" }, { value: 130, label: "130%" }]} />
              <Choice name="density" label="Spacing" value={p.density} onChange={(v) => setP("density", v)} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} />
              <Choice name="font" label="Reading font" value={p.font} onChange={(v) => setP("font", v)} options={[{ value: "newsreader", label: "Newsreader" }, { value: "atkinson", label: "Atkinson" }]} hint="Atkinson Hyperlegible is designed to keep similar letters apart." />
            </>
          )}

          {tab === "play" && (
            <>
              <Choice name="count" label="Error count" value={p.countHint} onChange={(v) => setP("countHint", v)} options={[{ value: "hidden", label: "Hidden" }, { value: "range", label: "Show 2–4" }]} hint="Saboteur plants two to four errors. Hidden is the real test." />
              <Choice name="conf" label="Confidence input" value={p.confidenceInput} onChange={(v) => setP("confidenceInput", v)} options={[{ value: "slider", label: "Slider" }, { value: "buttons", label: "Buttons" }]} />
              <Choice name="streak" label="Streak" value={p.showStreak ? "on" : "off"} onChange={(v) => setP("showStreak", v === "on")} options={[{ value: "on", label: "Show" }, { value: "off", label: "Hide" }]} hint="Hidden streaks still count; they just stop nagging." />
              <fieldset className="field">
                <legend className="label mb-2">Rest days</legend>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((name, i) => {
                    const on = p.restDays.includes(i);
                    return (
                      <button key={name} type="button" className="chip" aria-pressed={on} onClick={() => setP("restDays", on ? p.restDays.filter((x) => x !== i) : [...p.restDays, i].sort())}>
                        {name}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[13.5px] leading-snug text-ink-faint">Rest days neither break nor extend your streak.</p>
              </fieldset>
            </>
          )}

          {tab === "device" && (
            <>
              <Choice name="motion" label="Motion" value={d.motion} onChange={(v) => setD("motion", v)} options={[{ value: "system", label: "System" }, { value: "reduced", label: "Reduced" }, { value: "full", label: "Full" }]} />
              <Choice name="title" label="Title screen" value={d.titleScreen} onChange={(v) => setD("titleScreen", v)} options={[{ value: "always", label: "Always" }, { value: "session", label: "Once a visit" }, { value: "never", label: "Never" }]} />
              <Choice name="engine" label="Case writer" value={d.engine} onChange={(v) => setD("engine", v)} options={[{ value: "auto", label: "AI when available" }, { value: "offline", label: "Always offline" }]} hint="Offline cases are built by rules from your notes, the built-in library or Wikipedia." />
            </>
          )}

          {tab === "data" && (
            <>
              <div className="field">
                <span>Back up</span>
                <p className="text-[15px] text-ink-soft">Everything in this profile (cases, progress, notes and settings) as one file. Import it on any browser to carry on.</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="btn btn--small"
                    onClick={() => {
                      const data = exportProfile();
                      if (!data) return;
                      download(`saboteur-${data.profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${data.exportedAt.slice(0, 10)}.json`, data);
                      toast("Profile exported.", { tone: "good" });
                    }}
                  >
                    Export profile
                  </button>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => fileInput.current?.click()}>
                    Import a profile…
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onImport(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
              <div className="field">
                <span>Start over</span>
                <p className="text-[15px] text-ink-soft">Reset XP, streak and badges. Saved cases stay in the archive.</p>
                <div>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => {
                      if (!window.confirm("Reset XP, streak and badges for this profile? This can't be undone.")) return;
                      const kept = getStats();
                      saveStats({ ...emptyStats(), awarded: kept.awarded });
                      toast("Progress reset.");
                    }}
                  >
                    Reset progress
                  </button>
                </div>
              </div>
              <p className="text-[14px] text-ink-faint">Renaming or deleting a profile is in the Dossier.</p>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
