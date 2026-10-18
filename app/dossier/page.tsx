"use client";
/* eslint-disable @next/next/no-img-element -- pre-sized pin art */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Calibration } from "@/components/Calibration";
import { Cross, Ring, Snowflake } from "@/components/PenMarks";
import { useRedactedNavigate } from "@/components/RedactionTransition";
import { WeakSpots } from "@/components/WeakSpots";
import { buildLearning } from "@/lib/learning/model";
import { openSettings } from "@/lib/events";
import { deleteProfile, updateProfile } from "@/lib/profile/profiles";
import { AVATARS, PROFILE_COLOURS, type Profile, type Stats } from "@/lib/profile/schema";
import { badgeArt, BADGES } from "@/lib/progress/badges";
import { addDays, dayKey, weekday } from "@/lib/progress/day";
import { FREEZE_EVERY, liveStreak, MAX_FREEZES } from "@/lib/progress/streak";
import { progressOf, RANKS, xpFor } from "@/lib/progress/xp";
import { toast } from "@/lib/toast";
import { useActiveProfile, useIsClient, useRounds, useStats } from "@/lib/useStore";

type Tab = "record" | "calibration" | "weak" | "badges" | "profile";
const TABS: Tab[] = ["record", "calibration", "weak", "badges", "profile"];
const WEEKS = 12;

export default function DossierPage() {
  const isClient = useIsClient();
  const profile = useActiveProfile();
  const stats = useStats();
  const rounds = useRounds();
  const [tab, setTab] = useState<Tab>(() => (typeof window !== "undefined" && TABS.includes(window.location.hash.slice(1) as Tab) ? (window.location.hash.slice(1) as Tab) : "record"));
  // Profiles that haven't closed a case since v0.6 learn from their saved rounds on the fly.
  const learning = useMemo(() => (stats ? (stats.learning ?? buildLearning(rounds ?? {})) : null), [stats, rounds]);
  // Links can open a tab directly (/dossier#weak), including from this page.
  useEffect(() => {
    const follow = () => {
      const h = window.location.hash.slice(1) as Tab;
      if (TABS.includes(h)) setTab(h);
    };
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, []);
  const [now] = useState(() => (typeof window === "undefined" ? "" : new Date().toISOString()));
  if (!isClient || !profile || !stats || !learning) return <main className="min-h-[70vh]" aria-busy="true" />;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-24 pt-4 sm:px-8">
      <header className="rise mb-6 flex flex-wrap items-center gap-5">
        <Avatar avatar={profile.avatar} name={profile.name} size={84} className="dossier__avatar" />
        <div>
          <p className="eyebrow mb-1">Dossier{profile.guest ? " · guest" : ""}</p>
          <h1 className="display text-[clamp(40px,6vw,68px)] text-desk">{profile.name}</h1>
        </div>
      </header>

      <div className="dossier rise" style={{ animationDelay: "60ms" }}>
        <div className="dossier__tabs" role="tablist" aria-label="Dossier sections">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`dossier-tab-${t}`}
              aria-selected={tab === t}
              aria-controls="dossier-panel"
              className="dossier__tab"
              onClick={() => {
                setTab(t);
                history.replaceState(null, "", t === "record" ? location.pathname : `#${t}`);
              }}
            >
              {{ record: "Record", calibration: "Calibration", weak: "Weak spots", badges: `Badges · ${Object.keys(stats.badges).length}/${BADGES.length}`, profile: "Profile" }[t]}
            </button>
          ))}
        </div>
        <section id="dossier-panel" role="tabpanel" aria-labelledby={`dossier-tab-${tab}`} className="paper paper--manila dossier__body">
          {tab === "record" && <Record profile={profile} stats={stats} />}
          {tab === "calibration" && <Calibration learning={learning} />}
          {tab === "weak" && <WeakSpots learning={learning} now={now} />}
          {tab === "badges" && <Corkboard stats={stats} />}
          {tab === "profile" && <ProfileTab profile={profile} />}
        </section>
      </div>
    </main>
  );
}

function Record({ profile, stats }: { profile: Profile; stats: Stats }) {
  const p = progressOf(stats.xp);
  const today = dayKey(new Date());
  const streak = liveStreak(stats.streak, today, profile.prefs.restDays);
  const t = stats.totals;
  const flagged = t.catches + t.falseFlags;
  const accuracy = flagged ? Math.round((t.catches / flagged) * 100) : null;
  const nextRank = RANKS.find((r) => r.from > p.level);

  if (!t.rounds)
    return (
      <div className="py-6 text-center">
        <p className="label mb-2">No cases on file</p>
        <h2 className="display mb-3 text-[34px]">The record starts with your first case</h2>
        <p className="mx-auto mb-6 max-w-[44ch] text-[16px]">Close a case and it lands here: XP towards your next rank, a cross on the calendar, and your first badge.</p>
        <Link href="/play" className="btn">
          Open a case
        </Link>
      </div>
    );

  return (
    <div className="grid gap-9">
      <div className="grid items-end gap-6 md:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="label mb-1">Rank</p>
          <p className="display text-[44px] leading-none">{p.rank}</p>
          <div className="xpbar mt-4" role="meter" aria-label="XP towards the next level" aria-valuemin={p.floor} aria-valuemax={p.ceiling} aria-valuenow={p.xp}>
            <span style={{ width: `${p.fraction * 100}%` }} />
          </div>
          <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.08em]">
            Level {p.level} · {p.xp} XP · {p.ceiling - p.xp} to level {p.level + 1}
            {nextRank ? ` · ${nextRank.name} at level ${nextRank.from} (${xpFor(nextRank.from)} XP)` : ""}
          </p>
        </div>
        {profile.prefs.showStreak && (
          <div className="dossier__streak">
            <p className="display text-[56px] leading-none">{streak.current}</p>
            <p className="label">day streak{streak.atRisk ? " · play today to keep it" : ""}</p>
            <p className="mt-2 text-[14.5px]">
              Best {stats.streak.best} · {stats.streak.freezes}/{MAX_FREEZES} freezes · next freeze in {FREEZE_EVERY - (streak.current % FREEZE_EVERY)} days
            </p>
          </div>
        )}
      </div>

      <HeatMap stats={stats} today={today} />

      <dl className="dossier__totals">
        {[
          ["Cases closed", t.rounds],
          ["Errors caught", t.catches],
          ["Slipped past", t.misses],
          ["False alarms", t.falseFlags],
          ["Perfect cases", t.perfectRounds],
          ["Flag accuracy", accuracy === null ? "–" : `${accuracy}%`],
          ["Daily cases", Object.keys(stats.daily).length],
          ["Subjects", stats.subjects.length],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="label">{k}</dt>
            <dd className="display text-[30px]">{v}</dd>
          </div>
        ))}
      </dl>

      {stats.best && (
        <p className="text-[16px]">
          Best case: <b>{stats.best.topic}</b>, {stats.best.score} / {stats.best.max}.{" "}
          <Link href={`/results/${stats.best.roundId}`} className="underline underline-offset-4">
            Read the verdict
          </Link>
        </p>
      )}
    </div>
  );
}

/** Twelve weeks of red-pen crosses, Monday to Sunday, like a wall planner. */
function HeatMap({ stats, today }: { stats: Stats; today: string }) {
  const days = useMemo(() => {
    // Start on the Monday eleven weeks before this week's Monday.
    const monday = addDays(today, -((weekday(today) + 6) % 7));
    const start = addDays(monday, -7 * (WEEKS - 1));
    return Array.from({ length: WEEKS * 7 }, (_, i) => addDays(start, i));
  }, [today]);
  const frozen = new Set(stats.streak.frozenDays);
  const played = Object.values(stats.days).length;
  return (
    <figure className="heatmap" aria-label={`The last ${WEEKS} weeks: ${played} days with a closed case`}>
      <div className="heatmap__grid">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="heatmap__dow" style={{ gridRow: i + 1 }} aria-hidden="true">
            {d}
          </span>
        ))}
        {days.map((d, i) => {
          const future = d > today;
          const count = stats.days[d] ?? 0;
          return (
            <span key={d} className="heatmap__day" data-future={future || undefined} style={{ gridRow: (i % 7) + 1, gridColumn: Math.floor(i / 7) + 2 }} title={future ? undefined : `${d}${count ? `: ${count} case${count === 1 ? "" : "s"}` : frozen.has(d) ? ": covered by a freeze" : ""}`}>
              {count > 0 && <Cross seed={i + 1} className="heatmap__cross" />}
              {count > 2 && <Cross seed={i + 50} className="heatmap__cross heatmap__cross--2" />}
              {!count && frozen.has(d) && <Snowflake className="heatmap__frost" />}
              {stats.daily[d] && <span className="heatmap__daily" />}
              {d === today && <Ring className="heatmap__ring" />}
            </span>
          );
        })}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] uppercase tracking-[0.08em]">
        <span>✕ case closed</span>
        <span>✕✕ three or more</span>
        <span>❄ freeze</span>
        <span>● daily case</span>
      </figcaption>
    </figure>
  );
}

function Corkboard({ stats }: { stats: Stats }) {
  return (
    <ul className="corkboard">
      {BADGES.map((b, i) => {
        const earned = stats.badges[b.id];
        return (
          <li key={b.id} className="corkboard__pin" data-earned={!!earned} style={{ "--r": `${((i * 37) % 9) - 4}deg` } as React.CSSProperties}>
            <img src={badgeArt(b.id)} alt="" width={96} height={96} />
            <b>{b.name}</b>
            <span>{earned ? `Earned ${new Date(earned.earnedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : (b.later ?? b.description)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function ProfileTab({ profile }: { profile: Profile }) {
  const navigate = useRedactedNavigate();
  const [name, setName] = useState(profile.name);
  const [confirm, setConfirm] = useState("");
  const avatar = profile.avatar;
  return (
    <div className="grid gap-9">
      <form
        className="grid max-w-md gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          updateProfile(profile.id, { name: name.trim() });
          toast("Name updated.", { tone: "good" });
        }}
      >
        <label className="field">
          <span>Name</span>
          <input className="input bg-transparent" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
        </label>
        <div>
          <button type="submit" className="btn btn--small" disabled={!name.trim() || name.trim() === profile.name}>
            Save name
          </button>
        </div>
      </form>

      <fieldset className="field">
        <legend className="label mb-3">Badge</legend>
        <div className="recruit-pins">
          {AVATARS.map((id) => (
            <label key={id} className="recruit-pin" data-on={avatar.kind === "pin" && avatar.id === id}>
              <input type="radio" name="avatar" className="sr-only" checked={avatar.kind === "pin" && avatar.id === id} onChange={() => updateProfile(profile.id, { avatar: { kind: "pin", id } })} />
              <img src={`/assets/avatars/${id}.webp`} alt={id} width={64} height={64} />
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="label mr-1">Or initials</span>
          {PROFILE_COLOURS.map((c) => (
            <label key={c} className="recruit-swatch" data-on={avatar.kind === "monogram" && avatar.colour === c} style={{ background: c }}>
              <input type="radio" name="avatar" className="sr-only" checked={avatar.kind === "monogram" && avatar.colour === c} onChange={() => updateProfile(profile.id, { avatar: { kind: "monogram", colour: c } })} aria-label={`Initials on ${c}`} />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <span>Back up or move</span>
        <p className="text-[15px]">Export this profile as a file, or bring one back, from Settings.</p>
        <div>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => openSettings("data")}>
            Open backup settings
          </button>
        </div>
      </div>

      <form
        className="field max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (confirm.trim() !== profile.name) return;
          deleteProfile(profile.id);
          toast(`${profile.name}'s file was shredded.`);
          navigate("/", "HEADQUARTERS");
        }}
      >
        <span>Delete this profile</span>
        <p className="text-[15px]">
          Every case, badge and setting of <b>{profile.name}</b> goes, on this device. Type the name to confirm.
        </p>
        <input className="input bg-transparent" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={profile.name} aria-label={`Type ${profile.name} to confirm`} />
        <div>
          <button type="submit" className="btn btn--pen btn--small" disabled={confirm.trim() !== profile.name}>
            Delete profile
          </button>
        </div>
      </form>
    </div>
  );
}
