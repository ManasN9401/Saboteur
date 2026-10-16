"use client";
/* eslint-disable @next/next/no-img-element -- pre-sized pin art */

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { useRedactedNavigate } from "@/components/RedactionTransition";
import { LEVELS } from "@/lib/config";
import { createProfile, listProfiles, ProfileError, setActive, updateProfile } from "@/lib/profile/profiles";
import { AVATARS, MAX_PROFILES, PROFILE_COLOURS, type Avatar as AvatarData } from "@/lib/profile/schema";
import { badgeArt } from "@/lib/progress/badges";
import { earnBadge } from "@/lib/progress/record";
import { store } from "@/lib/store";
import { toast } from "@/lib/toast";
import { useIsClient } from "@/lib/useStore";

const SUBJECTS = ["Biology", "Chemistry", "Physics", "Maths", "History", "Geography", "Economics", "Computer science", "English", "Psychology"];
const GOALS = [3, 5, 7] as const;

const BRIEFING = [
  { title: "Spot the plant", text: "Every case is a short, convincing explanation. Two to four sentences in it are false. Click the ones you think are wrong." },
  { title: "Fix it, then bet", text: "Say what each flagged sentence should be, and how sure you are. Fixes earn points; honest confidence earns calibration." },
  { title: "Read the verdict", text: "The reveal stamps every catch, miss and false alarm, and explains the misconception behind each plant." },
];

export default function RecruitPage() {
  const isClient = useIsClient();
  if (!isClient) return <main className="min-h-[70vh]" aria-busy="true" />;
  return <Recruit />;
}

function Recruit() {
  const navigate = useRedactedNavigate();
  const [full] = useState(() => listProfiles().length >= MAX_PROFILES);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<AvatarData>(() => {
    const used = new Set(listProfiles().map((p) => (p.avatar.kind === "pin" ? p.avatar.id : "")));
    return { kind: "pin", id: AVATARS.find((a) => !used.has(a)) ?? "owl" };
  });
  const [guest, setGuest] = useState(false);
  const [level, setLevel] = useState<string>(LEVELS[1]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [goal, setGoal] = useState<number>(5);
  const [brief, setBrief] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function finish(tutorial: boolean) {
    try {
      const p = createProfile({ name: name.trim() || "Agent", avatar, guest, onboarding: { level, subjects, goalPerWeek: goal } });
      setActive(p.id);
      // Their level fills in the setup form from the start.
      store.saveSettings({ topic: "", level, difficulty: "subtle", notes: "" });
      if (tutorial) {
        updateProfile(p.id, { tutorialDone: true });
        if (earnBadge("recruit")) toast("Badge earned: Recruit", { art: badgeArt("recruit"), tone: "good" });
      }
      toast(`Welcome aboard, ${p.name}.`, { tone: "good" });
      navigate("/", "HEADQUARTERS");
    } catch (err) {
      setError(err instanceof ProfileError ? err.message : "Couldn't create the profile. Try again.");
    }
  }

  if (full)
    return (
      <main className="mx-auto w-full max-w-xl px-5 pb-24 pt-10 sm:px-8">
        <div className="paper paper--manila p-8">
          <p className="label mb-2">Personnel</p>
          <h1 className="display mb-3 text-[40px]">The office is full</h1>
          <p className="mb-6">This device already has {MAX_PROFILES} investigators. Delete one in their Dossier to make room.</p>
          <button type="button" className="btn" onClick={() => navigate("/dossier", "DOSSIER")}>
            Open the Dossier
          </button>
        </div>
      </main>
    );

  const steps = ["Identity", "Assignment", "Briefing"];
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-24 pt-6 sm:px-8">
      <p className="eyebrow mb-3">Personnel file · New recruit</p>
      <ol className="recruit-steps mb-5" aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} data-done={i < step}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <form
        className="paper paper--manila recruit rise px-6 py-7 sm:px-10 sm:py-9"
        onSubmit={(e) => {
          e.preventDefault();
          if (step === 0 && !name.trim()) return setError("Every investigator needs a name.");
          setError(null);
          if (step < 2) setStep(step + 1);
        }}
      >
        {step === 0 && (
          <div className="grid gap-7">
            <h1 className="display text-[clamp(34px,6vw,52px)]">Who are you?</h1>
            <label className="field">
              <span>Name</span>
              <input className="input" value={name} maxLength={24} autoFocus autoComplete="nickname" placeholder="e.g. Sam" onChange={(e) => setName(e.target.value)} />
            </label>
            <fieldset className="field">
              <legend className="label mb-3">Badge</legend>
              <div className="recruit-pins">
                {AVATARS.map((id) => (
                  <label key={id} className="recruit-pin" data-on={avatar.kind === "pin" && avatar.id === id}>
                    <input type="radio" name="avatar" className="sr-only" checked={avatar.kind === "pin" && avatar.id === id} onChange={() => setAvatar({ kind: "pin", id })} />
                    <img src={`/assets/avatars/${id}.webp`} alt={id} width={64} height={64} />
                  </label>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="label mr-1">Or initials</span>
                {PROFILE_COLOURS.map((c) => (
                  <label key={c} className="recruit-swatch" data-on={avatar.kind === "monogram" && avatar.colour === c} style={{ background: c }}>
                    <input type="radio" name="avatar" className="sr-only" checked={avatar.kind === "monogram" && avatar.colour === c} onChange={() => setAvatar({ kind: "monogram", colour: c })} aria-label={`Initials on ${c}`} />
                  </label>
                ))}
                <span className="ml-2">
                  <Avatar avatar={avatar} name={name || "?"} size={36} />
                </span>
              </div>
            </fieldset>
            <label className="flex items-start gap-3 text-[15px]">
              <input type="checkbox" className="mt-1" checked={guest} onChange={(e) => setGuest(e.target.checked)} />
              <span>
                <b>Just visiting.</b> A guest profile is wiped when this browser session ends: handy for demos and shared classroom machines.
              </span>
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-7">
            <h1 className="display text-[clamp(34px,6vw,52px)]">Your assignment</h1>
            <label className="field">
              <span>Level</span>
              <select className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
                {LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <fieldset className="field">
              <legend className="label mb-2">Subjects you study</legend>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map((s) => {
                  const on = subjects.includes(s);
                  return (
                    <button key={s} type="button" className="chip" aria-pressed={on} onClick={() => setSubjects(on ? subjects.filter((x) => x !== s) : [...subjects, s])}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <fieldset className="field">
              <legend className="label mb-2">Cases a week</legend>
              <div className="segmented">
                {GOALS.map((g) => (
                  <label key={g}>
                    <input type="radio" name="goal" checked={goal === g} onChange={() => setGoal(g)} />
                    {g}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-6">
            <h1 className="display text-[clamp(34px,6vw,52px)]">The briefing</h1>
            <div key={brief} className="recruit-brief paper" aria-live="polite">
              <p className="label mb-1">
                {brief + 1} of {BRIEFING.length}
              </p>
              <h2 className="display mb-2 text-[28px]">{BRIEFING[brief].title}</h2>
              <p className="text-[16.5px] text-ink-soft">{BRIEFING[brief].text}</p>
            </div>
            <p className="text-[14px]">Finish the briefing to earn your Recruit badge.</p>
          </div>
        )}

        {error && (
          <p className="mt-5 text-[15px] font-medium text-pen" role="alert">
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {step < 2 && (
            <button type="submit" className="btn">
              Next
            </button>
          )}
          {step === 2 &&
            (brief < BRIEFING.length - 1 ? (
              <button type="button" className="btn" onClick={() => setBrief(brief + 1)}>
                Next card
              </button>
            ) : (
              <button type="button" className="btn btn--pen" onClick={() => finish(true)}>
                Finish briefing
              </button>
            ))}
          {step === 2 && (
            <button type="button" className="btn btn--ghost" onClick={() => finish(false)}>
              Skip, start now
            </button>
          )}
          {step > 0 && (
            <button type="button" className="ml-auto text-[15px] underline underline-offset-4" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
