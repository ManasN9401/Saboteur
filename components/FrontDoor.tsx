"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { DeskCalendar } from "./DeskCalendar";
import { DeskDust } from "./DeskDust";
import { DeskClock } from "./DeskClock";
import { DeskLamp } from "./DeskLamp";
import { DeskPen } from "./DeskPen";
import { DeskSteam } from "./DeskSteam";
import { FolderArt } from "./FolderArt";
import { openCases } from "./CaseChoices";
import { FolderOpen, preloadFolderOpen } from "./FolderOpen";
import { ProfileChip } from "./ProfileChip";
import { useRedactedNavigate } from "./RedactionTransition";
import { SettingsButton } from "./SettingsButton";
import { today } from "@/lib/dailyClient";
import { reducedMotion } from "@/lib/prefs";
import { getDevicePrefs, setActive } from "@/lib/profile/profiles";
import { MAX_PROFILES } from "@/lib/profile/schema";
import { liveStreak } from "@/lib/progress/streak";
import { progressOf } from "@/lib/progress/xp";
import { useIsClient, useProfiles, useRounds, useStats } from "@/lib/useStore";

interface Item {
  id: string;
  label: string;
  /** One short line shown under the menu for the focused item. */
  hint: string;
  locked?: boolean;
  run?: () => void;
}

const SEEN_KEY = "saboteur:v1:title-seen";
// Where each folder's tab sits along its top edge, staggered like a filing drawer.
const TAB_POSITIONS = [0.62, 0.92, 0.36, 0.78, 0.12, 0.5, 1];
// How each folder lies in the tray: a few px off true and a fraction of a degree, so the pile's side
// edges step like real folders rather than one cut-out column. Fixed, so it never shuffles.
const LIE = [
  [-3, -0.35],
  [2, 0.25],
  [-1, -0.15],
  [3, 0.3],
  [-2, -0.25],
  [1, 0.15],
  [0, 0],
];

/** Skip the title card? Settings → Device chooses always, once per session (default) or never. */
function seenTitle(): boolean {
  const pref = getDevicePrefs().titleScreen;
  if (pref !== "session") return pref === "never";
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The front door: a title card on the desk ("press any key"), which opens into a stack of case
 * folders. Almost no copy: the desk, the wordmark and the folder labels carry it.
 */
export function FrontDoor() {
  const isClient = useIsClient();
  if (!isClient) return <main className="front" aria-busy="true" />;
  return <FrontDoorInner startInMenu={seenTitle()} />;
}

function FrontDoorInner({ startInMenu }: { startInMenu: boolean }) {
  const navigate = useRedactedNavigate();
  const rounds = useRounds();
  const [stage, setStage] = useState<"title" | "profiles" | "menu">(startInMenu ? "menu" : "title");
  const all = useProfiles();
  const stats = useStats();
  const [pick, setPick] = useState(0);
  const many = (all?.profiles.length ?? 0) > 1;
  const [focus, setFocus] = useState(0);
  // The folder opening on the desk, and the page it opens into (the New case or Continue folder).
  const [opening, setOpening] = useState<null | "/new" | "/continue">(null);
  const router = useRouter();
  const openFolder = useCallback(() => opening && router.push(opening), [router, opening]);
  // Next keeps this page alive after you leave it; close the folder so it isn't open when you return.
  useEffect(() => () => setOpening(null), []);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const touch = useMemo(() => window.matchMedia("(hover: none)").matches, []);
  const [openedAt] = useState(() => Date.now());
  // For the "AI online" lamp in the corner.
  const [engine, setEngine] = useState<{ engine: "llm" | "offline"; reason: string } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/engine")
      .then((r) => r.json())
      .then((e) => alive && setEngine(e))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // The home page shows more of the desk than the reading pages do.
  useEffect(() => {
    document.documentElement.dataset.scene = "home";
    return () => {
      delete document.documentElement.dataset.scene;
    };
  }, []);

  const open = useCallback(() => {
    try {
      window.sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* the title just shows again next time */
    }
    // Several people share this device: ask who's investigating first.
    setStage(many ? "profiles" : "menu");
  }, [many]);

  // Rounds started and not finished, newest first (the Continue folder lists them).
  const unfinished = useMemo(() => openCases(rounds, openedAt), [rounds, openedAt]);
  const closedCount = rounds ? Object.values(rounds).filter((r) => r.result).length : 0;

  const restDays = all?.profiles.find((p) => p.id === all.activeId)?.prefs.restDays ?? [];
  const streakNow = stats ? liveStreak(stats.streak, today(), restDays).current : 0;
  const resume = useCallback(
    (r: (typeof unfinished)[number]) => navigate(`/play/${r.round.id}`, `CASE FILE · ${r.round.topic.toUpperCase()}`),
    [navigate],
  );

  const folder = (to: "/new" | "/continue") => (reducedMotion() ? navigate(to, to === "/new" ? "NEW CASE" : "CONTINUE") : setOpening(to));

  const items: Item[] = useMemo(
    () => [
      {
        id: "continue",
        label: "Continue",
        hint: unfinished.length ? `${unfinished[0].round.topic}${unfinished.length > 1 ? ` · +${unfinished.length - 1} more` : ""}` : "Nothing in progress",
        // One open case: straight back into it. Several: the folder lists the latest. None: an empty folder.
        run: () => (unfinished.length === 1 ? resume(unfinished[0]) : folder("/continue")),
      },
      { id: "new", label: "New case", hint: "Custom, quick, daily, review or autopsy", run: () => folder("/new") },
      {
        id: "archive",
        label: "Archive",
        hint: closedCount ? `${closedCount} closed ${closedCount === 1 ? "case" : "cases"}` : "Nothing filed yet",
        run: () => navigate("/archive", "CASE ARCHIVE"),
      },
      {
        id: "dossier",
        label: "Dossier",
        hint: stats ? `${progressOf(stats.xp).rank} · ${stats.xp} XP${streakNow ? ` · ${streakNow}-day streak` : ""}` : "Your record",
        run: () => navigate("/dossier", "DOSSIER"),
      },
      { id: "about", label: "How it works", hint: "Ninety seconds, no spoilers", run: () => navigate("/about", "BRIEFING") },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- folder only sets state
    [unfinished, closedCount, navigate, stats, streakNow, resume],
  );

  const canRecruit = (all?.profiles.length ?? 0) < MAX_PROFILES;
  const picks = useRef<(HTMLButtonElement | null)[]>([]);
  function choosePlayer(i: number) {
    const p = all?.profiles[i];
    if (!p) return navigate("/recruit", "NEW RECRUIT");
    setActive(p.id);
    setFocus(0);
    setStage("menu");
  }

  const current = Math.min(focus, items.length - 1);
  const choose = useCallback((i: number) => items[i] && !items[i].locked && items[i].run?.(), [items]);

  // Keyboard: any key opens the title; in the menu, arrows / W S move, Enter picks, 1–9 jump, Esc goes back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (opening) return; // the open folder has the keyboard
      // The desk calendar and the profile chip have keys of their own.
      if ((e.target as HTMLElement | null)?.closest?.(".desk-cal-hit, .desk-pen-hit, .desk-clock-hit, .clock-card, .profile-chip, dialog")) return;
      if (stage === "title") {
        if (e.key === "Tab" || e.key === "Shift") return;
        e.preventDefault();
        open();
        return;
      }
      if (stage === "profiles") {
        const count = (all?.profiles.length ?? 0) + (canRecruit ? 1 : 0);
        const go = (i: number) => {
          e.preventDefault();
          setPick(i);
          picks.current[i]?.focus();
        };
        if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "d" || e.key === "D") go((pick + 1) % count);
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "a" || e.key === "A") go((pick - 1 + count) % count);
        else if (e.key === "Escape") setStage("title");
        else if (/^[1-9]$/.test(e.key) && Number(e.key) <= count) {
          go(Number(e.key) - 1);
          choosePlayer(Number(e.key) - 1);
        }
        return;
      }
      const move = (d: number) => {
        e.preventDefault();
        const next = (current + d + items.length) % items.length;
        setFocus(next);
        buttons.current[next]?.focus();
      };
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") move(1);
      else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") move(-1);
      else if (e.key === "Escape") setStage(many ? "profiles" : "title");
      else if (/^[1-9]$/.test(e.key) && Number(e.key) <= items.length) {
        const i = Number(e.key) - 1;
        setFocus(i);
        buttons.current[i]?.focus();
        choose(i);
      }
    };
    // On the title, a click or tap anywhere opens the menu too.
    const onPointer = () => stage === "title" && open();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerup", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerup", onPointer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- choosePlayer reads the values listed
  }, [stage, current, items, open, choose, pick, all, many, opening]);

  // Put keyboard focus on the menu when it opens, and get the folder-opening pieces ready.
  useEffect(() => {
    if (stage === "profiles") {
      const i = Math.max(0, all?.profiles.findIndex((p) => p.id === all.activeId) ?? 0);
      picks.current[i]?.focus({ preventScroll: true }); // onFocus sets the highlight
    }
    if (stage === "menu") {
      buttons.current[current]?.focus({ preventScroll: true });
      preloadFolderOpen();
      router.prefetch("/new");
      router.prefetch("/continue");
    }
    // Only when the stage changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  return (
    <main className="front" data-stage={stage} data-opening={opening ? "" : undefined}>
      <div className="front__glow" aria-hidden="true" />
      <DeskDust />
      <DeskSteam />
      <DeskLamp />
      <DeskClock />
      <DeskPen />
      <DeskCalendar />

      <div className="front__stage">
        <h1 className="front__mark" aria-label="Saboteur">
          <span className="front__word" aria-hidden="true">
            Sabo<span className="front__struck">teur</span>
          </span>
          <span className="front__bar" aria-hidden="true" />
        </h1>

        {stage === "title" ? (
          <button type="button" className="front__begin" onClick={open} autoFocus>
            {touch ? "Tap to begin" : "Press any key"}
          </button>
        ) : stage === "profiles" ? (
          <section className="front__who" aria-labelledby="who-title">
            <h2 id="who-title" className="front__who-title">
              Who&apos;s investigating?
            </h2>
            <ul className="lanyards">
              {all?.profiles.map((p, i) => (
                <li key={p.id} style={{ "--i": i } as React.CSSProperties}>
                  <button
                    ref={(el) => {
                      picks.current[i] = el;
                    }}
                    type="button"
                    className="idcard"
                    data-focus={i === pick}
                    onMouseEnter={() => setPick(i)}
                    onFocus={() => setPick(i)}
                    onClick={() => choosePlayer(i)}
                  >
                    <span className="idcard__clip" aria-hidden="true" />
                    <Avatar avatar={p.avatar} name={p.name} size={74} />
                    <span className="idcard__name">{p.name}</span>
                    <span className="idcard__rank">{p.guest ? "Guest" : p.id === all.activeId && stats ? progressOf(stats.xp).rank : "Agent"}</span>
                  </button>
                </li>
              ))}
              {canRecruit && (
                <li style={{ "--i": all?.profiles.length ?? 0 } as React.CSSProperties}>
                  <button
                    ref={(el) => {
                      picks.current[all?.profiles.length ?? 0] = el;
                    }}
                    type="button"
                    className="idcard idcard--new"
                    data-focus={pick === (all?.profiles.length ?? 0)}
                    onMouseEnter={() => setPick(all?.profiles.length ?? 0)}
                    onFocus={() => setPick(all?.profiles.length ?? 0)}
                    onClick={() => navigate("/recruit", "NEW RECRUIT")}
                  >
                    <span className="idcard__plus" aria-hidden="true">
                      +
                    </span>
                    <span className="idcard__name">New recruit</span>
                  </button>
                </li>
              )}
            </ul>
          </section>
        ) : (
          <nav className="front__menu" aria-label="Main menu">
            {/* The folders lie in an open wooden tray: its front rail cuts the pile off. */}
            <div className="tray">
              <div className="tray__wood" aria-hidden="true" />
              <ul style={{ "--n": items.length } as React.CSSProperties}>
                {items.map((item, i) => (
                  <li
                    key={item.id}
                    style={{ "--i": i, "--dx": `${LIE[i % LIE.length][0]}px`, "--rot": `${LIE[i % LIE.length][1]}deg` } as React.CSSProperties}
                  >
                    <button
                      ref={(el) => {
                        buttons.current[i] = el;
                      }}
                      type="button"
                      className="folder"
                      data-focus={i === current}
                      aria-current={i === current ? "true" : undefined}
                      aria-disabled={item.locked || undefined}
                      aria-describedby="front-hint"
                      onMouseEnter={(e) => {
                        setFocus(i);
                        e.currentTarget.focus({ preventScroll: true });
                      }}
                      onFocus={() => setFocus(i)}
                      onClick={() => choose(i)}
                    >
                      <FolderArt tabAt={TAB_POSITIONS[i % TAB_POSITIONS.length]} label={`No. ${String(i + 1).padStart(2, "0")}`} />
                      <span className="folder__label">{item.label}</span>
                      {item.locked && (
                        <svg className="folder__lock" viewBox="0 0 16 16" aria-label="Locked" role="img">
                          <path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                          <rect x="3" y="7" width="10" height="7.5" rx="1.2" fill="currentColor" />
                        </svg>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              {/* The brass label holder on the front rail says what the chosen folder is for. */}
              <p id="front-hint" className="tray__plate" aria-live="polite">
                <span>{items[current]?.hint}</span>
              </p>
            </div>
          </nav>
        )}
      </div>

      {stage === "menu" && (
        <div className="front__corner">
          <ProfileChip />
          <SettingsButton />
        </div>
      )}

      {opening && <FolderOpen onNavigate={openFolder} />}

      <p className="front__lamp" data-engine={engine?.engine ?? "unknown"} title={engine?.reason}>
        <span aria-hidden="true" />
        {engine ? (engine.engine === "llm" ? "AI online" : "Offline mode") : " "}
      </p>
    </main>
  );
}
