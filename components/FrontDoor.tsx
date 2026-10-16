"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { DeskCalendar } from "./DeskCalendar";
import { DeskDust } from "./DeskDust";
import { DeskLamp } from "./DeskLamp";
import { DeskSteam } from "./DeskSteam";
import { FolderArt } from "./FolderArt";
import { FolderOpen, preloadFolderOpen } from "./FolderOpen";
import { ProfileChip } from "./ProfileChip";
import { useRedactedNavigate } from "./RedactionTransition";
import { SettingsButton } from "./SettingsButton";
import { LEVELS, ROUND_TTL_MS } from "@/lib/config";
import { store } from "@/lib/store";
import { fetchDailyInfo, openDaily, today, type DailyInfo } from "@/lib/dailyClient";
import { reducedMotion } from "@/lib/prefs";
import { getDevicePrefs, setActive } from "@/lib/profile/profiles";
import { MAX_PROFILES } from "@/lib/profile/schema";
import { liveStreak } from "@/lib/progress/streak";
import { progressOf } from "@/lib/progress/xp";
import { toast } from "@/lib/toast";
import { useIsClient, useProfiles, useRounds, useStats } from "@/lib/useStore";

type Engine = { engine: "llm" | "offline"; reason: string; topics: string[] };

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
const FALLBACK_TOPICS = ["Photosynthesis", "The water cycle", "Newton's laws of motion", "Supply and demand", "Plate tectonics"];

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
  const [daily, setDaily] = useState<DailyInfo | null>(null);
  const [dailyBusy, setDailyBusy] = useState(false);
  const many = (all?.profiles.length ?? 0) > 1;
  const [focus, setFocus] = useState(0);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [opening, setOpening] = useState(false);
  const router = useRouter();
  const openNewCase = useCallback(() => router.push("/play"), [router]);
  // Next keeps this page alive after you leave it; close the folder so it isn't open when you return.
  useEffect(() => () => setOpening(false), []);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const touch = useMemo(() => window.matchMedia("(hover: none)").matches, []);
  const [openedAt] = useState(() => Date.now());

  // The home page shows more of the desk than the reading pages do.
  useEffect(() => {
    document.documentElement.dataset.scene = "home";
    return () => {
      delete document.documentElement.dataset.scene;
    };
  }, []);

  // Today's daily case (the player's local date).
  useEffect(() => {
    const ctrl = new AbortController();
    void fetchDailyInfo(today(), ctrl.signal).then((d) => d && setDaily(d));
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/engine")
      .then((r) => r.json())
      .then((e: Engine) => alive && setEngine(e))
      .catch(() => {});
    return () => {
      alive = false;
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

  const unfinished = useMemo(() => {
    if (!rounds) return null;
    const cutoff = openedAt - ROUND_TTL_MS; // older rounds have expired on the server
    return (
      Object.values(rounds)
        .filter((r) => !r.result && Date.parse(r.round.createdAt) > cutoff)
        .sort((a, b) => b.round.createdAt.localeCompare(a.round.createdAt))[0] ?? null
    );
  }, [rounds, openedAt]);
  const closedCount = rounds ? Object.values(rounds).filter((r) => r.result).length : 0;

  const restDays = all?.profiles.find((p) => p.id === all.activeId)?.prefs.restDays ?? [];
  const streakNow = stats ? liveStreak(stats.streak, today(), restDays).current : 0;
  const todaysDaily = daily ? rounds?.[daily.id] : undefined;

  function dailyHint() {
    if (dailyBusy) return "Opening the file…";
    if (!daily) return "Today's case for everyone";
    const scored = stats?.daily[daily.date];
    if (scored) return `Closed · ${scored.score} / ${scored.max} · new case tomorrow`;
    if (todaysDaily && !todaysDaily.result) return `${daily.topic} · in progress`;
    return `${daily.topic} · ${daily.difficulty}`;
  }

  async function playDaily() {
    if (!daily || dailyBusy) return;
    const label = `DAILY CASE · ${daily.topic.toUpperCase()}`;
    if (todaysDaily?.result) return navigate(`/results/${daily.id}`, "VERDICT");
    if (todaysDaily) return navigate(`/play/${daily.id}`, label);
    setDailyBusy(true);
    try {
      const round = await openDaily(daily.date);
      navigate(`/play/${round.id}`, label);
    } catch (err) {
      toast(err instanceof Error ? err.message : "The daily case couldn't be opened.", { tone: "warn" });
    } finally {
      setDailyBusy(false);
    }
  }

  const items: Item[] = useMemo(() => {
    const list: Item[] = [];
    if (unfinished) {
      const flags = store.getDraft(unfinished.round.id).length;
      list.push({
        id: "continue",
        label: "Continue",
        hint: `${unfinished.round.topic} · ${flags} flagged`,
        run: () => navigate(`/play/${unfinished.round.id}`, `CASE FILE · ${unfinished.round.topic.toUpperCase()}`),
      });
    }
    list.push(
      {
        id: "new",
        label: "New case",
        hint: "Any topic, your notes, your level",
        // The folder opens and its blank sheet becomes the setup form.
        run: () => (reducedMotion() ? navigate("/play", "NEW CASE FILE") : setOpening(true)),
      },
      {
        id: "quick",
        label: "Quick play",
        hint: "A random case, straight in",
        run: () => {
          const topics = engine?.topics.length ? engine.topics : FALLBACK_TOPICS;
          const saved = store.getSettings();
          const pool = topics.filter((t) => t !== saved?.topic);
          const topic = pool[Math.floor(Math.random() * pool.length)] ?? topics[0];
          store.saveSettings({ topic, level: saved?.level ?? LEVELS[1], difficulty: saved?.difficulty ?? "subtle", notes: "" });
          store.requestAutostart();
          navigate("/play", `CASE FILE · ${topic.toUpperCase()}`);
        },
      },
      {
        id: "daily",
        label: "Daily case",
        hint: dailyHint(),
        run: () => void playDaily(),
      },
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
    );
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dailyHint/playDaily read the values listed
  }, [unfinished, closedCount, engine, navigate, daily, dailyBusy, rounds, stats, streakNow]);

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
  }, [stage, current, items, open, choose, pick, all, many]);

  // Put keyboard focus on the menu when it opens, and get the folder-opening pieces ready.
  useEffect(() => {
    if (stage === "profiles") {
      const i = Math.max(0, all?.profiles.findIndex((p) => p.id === all.activeId) ?? 0);
      picks.current[i]?.focus({ preventScroll: true }); // onFocus sets the highlight
    }
    if (stage === "menu") {
      buttons.current[current]?.focus({ preventScroll: true });
      preloadFolderOpen();
      router.prefetch("/play");
    }
    // Only when the stage changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  return (
    <main className="front" data-stage={stage} data-opening={opening || undefined}>
      <div className="front__glow" aria-hidden="true" />
      <DeskDust />
      <DeskSteam />
      <DeskLamp />
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
            <ul>
              {items.map((item, i) => (
                <li key={item.id} style={{ "--i": i } as React.CSSProperties}>
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
                    <FolderArt tabAt={TAB_POSITIONS[i % TAB_POSITIONS.length]} label={`No. ${String(i + 1).padStart(2, "0")}`} foot={i === items.length - 1} />
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
            <p id="front-hint" className="front__hint" aria-live="polite">
              {items[current]?.hint}
            </p>
          </nav>
        )}
      </div>

      {stage === "menu" && (
        <div className="front__corner">
          <ProfileChip />
          <SettingsButton />
        </div>
      )}

      {opening && <FolderOpen onNavigate={openNewCase} />}

      <p className="front__lamp" data-engine={engine?.engine ?? "unknown"} title={engine?.reason}>
        <span aria-hidden="true" />
        {engine ? (engine.engine === "llm" ? "AI online" : "Offline mode") : " "}
      </p>
    </main>
  );
}
