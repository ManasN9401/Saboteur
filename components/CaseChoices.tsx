"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CaseFolder } from "./CaseFolder";
import { landFolderSheet } from "./FolderOpen";
import { useRedactedNavigate } from "./RedactionTransition";
import { LEVELS, ROUND_TTL_MS } from "@/lib/config";
import { fetchDailyInfo, openDaily, today, type DailyInfo } from "@/lib/dailyClient";
import { prepareDrill } from "@/lib/learning/drill";
import { buildLearning } from "@/lib/learning/model";
import type { Learning } from "@/lib/learning/schema";
import { dueReviews, nextReview, queued, relativeDay, reviewBatch } from "@/lib/learning/views";
import { progressOf } from "@/lib/progress/xp";
import { store } from "@/lib/store";
import { toast } from "@/lib/toast";
import { useActiveProfile, useIsClient, useRounds, useStats } from "@/lib/useStore";

/** How many open cases the Continue folder lists. */
export const CONTINUE_MAX = 4;
const FALLBACK_TOPICS = ["Photosynthesis", "The water cycle", "Newton's laws of motion", "Supply and demand", "Plate tectonics"];

type Rounds = ReturnType<typeof useRounds>;

/** Rounds started and not finished (and not yet expired on the server), newest first. */
export function openCases(rounds: Rounds, now: number) {
  if (!rounds) return [];
  const cutoff = now - ROUND_TTL_MS;
  return Object.values(rounds)
    .filter((r) => !r.result && Date.parse(r.round.createdAt) > cutoff)
    .sort((a, b) => b.round.createdAt.localeCompare(a.round.createdAt))
    .slice(0, CONTINUE_MAX);
}

/** Quick play: a library topic other than the last one, at the player's usual settings, started at once. */
function quickPlay(topics: string[], navigate: (to: string, label: string) => void) {
  const all = topics.length ? topics : FALLBACK_TOPICS;
  const saved = store.getSettings();
  const pool = all.filter((t) => t !== saved?.topic);
  const topic = pool[Math.floor(Math.random() * pool.length)] ?? all[0];
  store.saveSettings({ topic, level: saved?.level ?? LEVELS[1], difficulty: saved?.difficulty ?? "subtle", notes: "" });
  store.requestAutostart();
  navigate("/play", `CASE FILE · ${topic.toUpperCase()}`);
}

interface Choice {
  id: string;
  label: string;
  hint?: string;
  /** Typed on the index card on the cover while this is the current choice: what happens next. */
  detail: string[];
  /** A small rubber stamp beside it (the daily case's date, how many reviews are due). */
  tag?: string;
  run: () => void;
}

/**
 * The New case and Continue folders: the same open folder as the setup form (CaseFolder), reached by the
 * same opening on the home page, whose lifted sheet lands here. The sheet lists the choices: the ways to
 * start a round, or the rounds left open. Keys 1–9 pick, arrows move, Esc goes back to the desk.
 */
export function ChoiceFolder({ kind }: { kind: "new" | "continue" }) {
  const isClient = useIsClient();
  if (!isClient) return <main className="mx-auto w-full max-w-[1240px] px-2 pb-24 pt-2 sm:px-6" aria-busy="true" />;
  return <ChoiceFolderInner kind={kind} />;
}

function ChoiceFolderInner({ kind }: { kind: "new" | "continue" }) {
  const navigate = useRedactedNavigate();
  const router = useRouter();
  const rounds = useRounds();
  const stats = useStats();
  const profile = useActiveProfile();
  const [now] = useState(() => Date.now());
  const nowIso = useMemo(() => new Date(now).toISOString(), [now]);
  const [daily, setDaily] = useState<DailyInfo | null>(null);
  const [dailyBusy, setDailyBusy] = useState(false);
  const [topics, setTopics] = useState<string[]>([]);
  const sheet = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);

  // Arriving from the home page's folder: its lifted sheet lands on this one.
  useLayoutEffect(() => {
    if (sheet.current) landFolderSheet(sheet.current);
  }, []);

  useEffect(() => {
    if (kind !== "new") return;
    const ctrl = new AbortController();
    void fetchDailyInfo(today(), ctrl.signal).then((d) => d && setDaily(d));
    fetch("/api/engine", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((e: { topics: string[] }) => setTopics(e.topics ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [kind]);

  const learning = useMemo(() => (stats ? (stats.learning ?? buildLearning(rounds ?? {})) : null), [stats, rounds]);
  const open = useMemo(() => openCases(rounds, now), [rounds, now]);
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

  function reviewHint(l: Learning) {
    const due = dueReviews(l, nowIso);
    if (due.length) return `${due.length} due · “${due[0].label}”`;
    const next = nextReview(l, nowIso);
    return next ? `Nothing due · next ${relativeDay(next, nowIso)}` : "Nothing due";
  }

  const choices: Choice[] = [];
  if (kind === "new") {
    // The setup form is the same folder: no transition needed, the sheet just becomes the form.
    choices.push({
      id: "custom",
      label: "Custom case",
      hint: "Any topic, your notes, your level",
      detail: ["Name any topic, or paste your notes.", "Choose the level and how sneaky.", "We write it and plant the lies."],
      run: () => router.push("/play"),
    });
    choices.push({
      id: "quick",
      label: "Quick play",
      hint: "A random case, straight in",
      detail: ["A topic from the library, picked for you.", "Your usual level and difficulty.", "Straight into the briefing."],
      run: () => quickPlay(topics, navigate),
    });
    const dailyDone = daily ? stats?.daily[daily.date] : undefined;
    choices.push({
      id: "daily",
      label: "Daily case",
      hint: dailyHint(),
      detail: [daily ? `Today: ${daily.topic}.` : "Today's case for everyone.", "Every agent gets the same one.", dailyDone ? "Closed. A new one tomorrow." : "One go. It keeps your streak."],
      tag: dailyDone ? "Closed" : "Today",
      run: () => void playDaily(),
    });
    if (learning && queued(learning)) {
      const due = dueReviews(learning, nowIso).length;
      choices.push({
        id: "review",
        label: "Review case",
        hint: reviewHint(learning),
        detail: ["Built from your own mistakes.", due ? `${due} due for another look.` : "Nothing due just yet.", "Catch them to file them away."],
        tag: due ? `${due} due` : undefined,
        run: () => {
          const batch = reviewBatch(learning, nowIso);
          if (!batch.length) {
            const next = nextReview(learning, nowIso);
            return toast(next ? `Nothing due yet. The next review comes up ${relativeDay(next, nowIso)}.` : "Nothing due for review.");
          }
          const topic = prepareDrill(batch, true);
          navigate("/play", `REVIEW CASE · ${topic.toUpperCase()}`);
        },
      });
    }
    choices.push({
      id: "autopsy",
      label: "Autopsy",
      hint: "Bring your wrong answers: find the belief behind each",
      detail: ["Paste or photograph marked work.", "Each wrong answer gets a cause.", "Confirm it, then check the cure."],
      run: () => navigate("/autopsy", "AUTOPSY"),
    });
  } else {
    for (const r of open) {
      const flags = store.getDraft(r.round.id).length;
      choices.push({
        id: r.round.id,
        label: r.round.topic,
        hint: `${r.round.level} · ${r.round.difficulty}`,
        detail: [`${r.round.level}, ${r.round.difficulty}.`, `Opened ${relativeDay(r.round.createdAt, nowIso)}.`, `${flags} ${flags === 1 ? "sentence" : "sentences"} flagged so far.`],
        tag: `${flags} flagged`,
        run: () => navigate(`/play/${r.round.id}`, `CASE FILE · ${r.round.topic.toUpperCase()}`),
      });
    }
  }

  // One current choice, moved by the mouse and the keys alike (as the drawer's folders are), so there's
  // never a hover highlight left behind on one row and a focus highlight on another.
  const [cur, setCur] = useState(0);
  const at = Math.min(cur, Math.max(0, choices.length - 1));
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const goTo = (i: number) => {
    setCur(i);
    rows.current[i]?.focus({ preventScroll: true });
  };
  useEffect(() => {
    rows.current[0]?.focus({ preventScroll: true });
  }, []);

  // Keys: 1–9 pick, arrows (or W/S) move, Enter picks the current one, Esc back to the desk.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select, dialog, .clock-card")) return;
      const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>(".choice-sheet__choice") ?? [])];
      const now = Math.max(0, buttons.findIndex((b) => b.hasAttribute("data-current")));
      const go = (i: number) => {
        setCur(i);
        buttons[i]?.focus({ preventScroll: true });
      };
      const move = (d: number) => {
        e.preventDefault();
        if (buttons.length) go((now + d + buttons.length) % buttons.length);
      };
      if (e.key === "Escape") navigate("/", "THE DESK");
      else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") move(1);
      else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") move(-1);
      else if (/^[1-9]$/.test(e.key) && Number(e.key) <= buttons.length) {
        go(Number(e.key) - 1);
        buttons[Number(e.key) - 1].click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const title = kind === "new" ? "New case" : "Continue";
  const dateStr = new Date(now).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return (
    <main className="mx-auto w-full max-w-[1240px] px-2 pb-24 pt-2 sm:px-6">
      <h1 className="sr-only">{title}</h1>
      <CaseFolder
        label={kind === "new" ? "No. 02 · New case" : "No. 01 · Continue"}
        note={kind === "new" ? "How shall we start?" : "Where were we?"}
        cover={
          <div className="cover-notes">
            <div className="routing-slip">
              <p className="routing-slip__head">{kind === "new" ? "Case assignment" : "Open files"}</p>
              <dl>
                <dt>Agent</dt>
                <dd>{profile?.name ?? "—"}</dd>
                <dt>Rank</dt>
                <dd>{profile?.guest ? "Guest" : stats ? progressOf(stats.xp).rank : "—"}</dd>
                <dt>Date</dt>
                <dd>{dateStr}</dd>
                <dt>Re</dt>
                <dd>{kind === "new" ? "New case" : `${open.length} open`}</dd>
              </dl>
            </div>
            <p className="cover-notes__pen hand">{kind === "new" ? "How shall we start?" : "Where were we?"}</p>
            {/* What the current choice involves, typed on the ruled card. */}
            <div className="index-card" aria-live="polite">
              <p className="index-card__head">{choices[at]?.label ?? "Nothing open"}</p>
              <ol>
                {(choices[at]?.detail ?? ["No cases in progress.", "Open one from New case."]).map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ol>
            </div>
          </div>
        }
      >
        <div ref={sheet} className="paper casefolder__sheet choice-sheet px-6 py-7 sm:px-9 sm:py-9">
          <div className="paper-head label">
            <span>
              <b>Form C-{kind === "new" ? "2" : "3"}</b> · {kind === "new" ? "Case requisition" : "Cases in progress"}
            </span>
            <span>{choices.length ? "Tick one" : "Nothing to tick"}</span>
          </div>
          {choices.length ? (
            <ul ref={list} className="choice-sheet__list">
              {choices.map((c, i) => (
                <li key={c.id}>
                  <button
                    ref={(el) => {
                      rows.current[i] = el;
                    }}
                    type="button"
                    className="choice-sheet__choice"
                    data-current={i === at || undefined}
                    aria-current={i === at || undefined}
                    onPointerEnter={() => goTo(i)}
                    onFocus={() => setCur(i)}
                    onClick={c.run}
                  >
                    <span className="choice-sheet__box" aria-hidden="true">
                      <svg viewBox="0 0 28 28">
                        <path d="M5 15 C 8 17, 10 20, 11.5 23 C 14 15, 19 8, 26 2" />
                      </svg>
                    </span>
                    <span className="choice-sheet__text">
                      <span className="choice-sheet__label">
                        <b className="choice-sheet__no">{String(i + 1).padStart(2, "0")}</b>
                        {c.label}
                      </span>
                      {c.hint && <span className="choice-sheet__hint">{c.hint}</span>}
                    </span>
                    {c.tag && <span className="stamp-mark choice-sheet__tag">{c.tag}</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="choice-sheet__empty">
              <p className="hand">No cases in progress.</p>
              <button type="button" className="btn btn--pen" onClick={() => router.push("/new")}>
                Open a new case
              </button>
            </div>
          )}
          <div className="choice-sheet__foot">
            <span className="choice-sheet__sign">
              <span className="label">Requested by</span>
              <span className="hand">{profile?.name ?? "Agent"}</span>
            </span>
            <span className="label choice-sheet__keys">{choices.length ? `1–${choices.length} pick · ↑↓ move · Esc desk` : "Esc · back to the desk"}</span>
          </div>
        </div>
      </CaseFolder>
    </main>
  );
}
