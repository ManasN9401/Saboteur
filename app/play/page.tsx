"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { landFolderSheet } from "@/components/FolderOpen";
import { CaseFolder, CoverNotes } from "@/components/CaseFolder";
import { LoupeLoader, type LoaderStep } from "@/components/LoupeLoader";
import { useRedactedNavigate } from "@/components/RedactionTransition";
import { DIFFICULTIES, LEVELS } from "@/lib/config";
import type { Difficulty, GenerateEvent, PipelineStep } from "@/lib/schemas";
import { getDevicePrefs } from "@/lib/profile/profiles";
import { store, type Drill, type SetupSettings } from "@/lib/store";
import { useIsClient, useTopics } from "@/lib/useStore";

const DIFFICULTY_HELP: Record<Difficulty, string> = {
  obvious: "Anyone who revised would catch these.",
  subtle: "You need a solid grasp of the topic.",
  devious: "Built on well-known, stubborn misconceptions.",
};

const EXAMPLES = ["Photosynthesis: light-dependent reactions", "The water cycle", "Causes of the First World War", "Differentiation: the chain rule", "Supply and demand"];

/** Topic chips shown before "All topics": the built-in library is 30 strong, too many to list by default. */
const CHIP_LIMIT = 8;

const STEP_LABELS: Record<PipelineStep, string> = {
  write: "Writing the briefing",
  plant: "Planting the errors",
  verify: "Checking our cover story",
};

// The reveal screen's "another round" buttons ask for an immediate start. Read the request once
// per page load (React may mount effects twice in development).
let autostartRequest = false;
function consumeAutostart() {
  if (!autostartRequest) autostartRequest = store.takeAutostart();
  return autostartRequest;
}

export default function SetupPage() {
  const isClient = useIsClient();
  // Saved settings live in this browser, so the form is filled in only once we are running there.
  if (!isClient) return <main className="min-h-[70vh]" aria-busy="true" />;
  const saved = store.getSettings();
  // Notes belong to one topic: only carry them over for an "another round" follow-up.
  return <SetupForm initial={saved && (autostartRequest || store.peekAutostart()) ? saved : saved && { ...saved, notes: "" }} />;
}

function SetupForm({ initial }: { initial: SetupSettings | null }) {
  const navigate = useRedactedNavigate();
  const knownLevel = !initial || (LEVELS as readonly string[]).includes(initial.level);
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [level, setLevel] = useState<string>(knownLevel ? (initial?.level ?? LEVELS[1]) : "other");
  const [customLevel, setCustomLevel] = useState(knownLevel ? "" : (initial?.level ?? ""));
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? "subtle");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [notesOpen, setNotesOpen] = useState(Boolean(initial?.notes));
  const [formError, setFormError] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<{ step: PipelineStep; message: string } | null>(null);
  const [done, setDone] = useState<Set<PipelineStep>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const [engine, setEngine] = useState<{ engine: "llm" | "offline"; reason: string; topics: string[] } | null>(null);
  // "Drill this" or a review case: the next round targets these misconceptions (V06-05).
  const [drill, setDrill] = useState<Drill | null>(() => store.peekDrill());

  // Next keeps this page alive (hidden) after we leave it, and runs effect cleanups when it hides.
  // Reset the loader then, or coming back via "New topic" shows the finished loader forever.
  useEffect(
    () => () => {
      abort.current?.abort();
      setRunning(false);
      setCurrent(null);
      setDone(new Set());
      setLoadError(null);
    },
    [],
  );

  // Arriving from the home page's folder: its lifted sheet lands where this form sits.
  useLayoutEffect(() => {
    if (form.current) landFolderSheet(form.current);
  }, []);

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
  const offline = engine?.engine === "offline";

  // Runs whenever the page is shown. Next keeps this page alive after you leave it, so the form may
  // still hold an old topic: take the request's settings fresh from storage, not from the form.
  useEffect(() => {
    if (!consumeAutostart()) return;
    const saved = store.getSettings();
    if (!saved?.topic) return;
    const t = window.setTimeout(() => {
      autostartRequest = false;
      const known = (LEVELS as readonly string[]).includes(saved.level);
      setTopic(saved.topic);
      setLevel(known ? saved.level : "other");
      setCustomLevel(known ? "" : saved.level);
      setDifficulty(saved.difficulty);
      setNotes(saved.notes);
      setNotesOpen(Boolean(saved.notes));
      void start(undefined, saved);
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveLevel = level === "other" ? customLevel.trim() : level;

  async function start(e?: FormEvent, use?: SetupSettings) {
    e?.preventDefault();
    const req = use ?? { topic: topic.trim(), level: effectiveLevel, difficulty, notes };
    if (req.topic.length < 2) return setFormError("Tell us what to sabotage: a topic of at least a couple of words.");
    if (req.level.length < 2) return setFormError("Describe the level, for example “first-year biology”.");
    setFormError(null);
    store.saveSettings(req);
    // Pasted notes are kept per topic, ready for next time (QoL Q6).
    if (req.notes.trim()) store.saveNotes(req.topic, req.notes.trim());

    setRunning(true);
    setLoadError(null);
    setDone(new Set());
    setCurrent({ step: "write", message: "Writing the briefing…" });
    abort.current = new AbortController();

    try {
      const res = await fetch("/api/saboteur/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: req.topic, level: req.level, difficulty: req.difficulty, notes: req.notes.trim() || undefined, engine: getDevicePrefs().engine, targets: drill?.targets }),
        signal: abort.current.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "The server couldn't start a round. Try again.");
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      const order: PipelineStep[] = ["write", "plant", "verify"];
      for (;;) {
        const { value, done: finished } = await reader.read();
        if (value) buffer += value;
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const event = JSON.parse(line) as GenerateEvent;
          if (event.type === "progress") {
            setCurrent({ step: event.step, message: event.message });
            setDone(new Set(order.slice(0, order.indexOf(event.step))));
          } else if (event.type === "error") {
            throw new Error(event.message);
          } else if (event.type === "done") {
            setDone(new Set(order));
            store.saveRound(event.round, req.notes.trim() || undefined, drill ? { review: drill.review || undefined, targets: drill.targets.map((t) => t.key) } : undefined);
            store.clearDrill();
            navigate(`/play/${event.round.id}`, `CASE FILE · ${event.round.topic.toUpperCase()}`);
            return;
          }
        }
        if (finished) break;
      }
      throw new Error("The connection closed before the round was ready. Try again.");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setLoadError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    }
  }

  // Topic shortcuts (QoL Q5): favourites, then recent topics, then examples or the built-in library.
  const topics = useTopics();
  const library = offline ? engine.topics : EXAMPLES;
  const recentFirst = [...topics.favourites, ...topics.recent.filter((t) => !topics.favourites.some((f) => f.toLowerCase() === t.toLowerCase()))].slice(0, 8);
  const [allTopics, setAllTopics] = useState(false);
  const quick = recentFirst.length ? { label: "Your topics", topics: recentFirst } : { label: "Example topics", topics: library };
  const suggestions = [...new Set([...recentFirst, ...(engine?.topics ?? []), ...EXAMPLES])];
  const isFavourite = topics.favourites.some((f) => f.toLowerCase() === topic.trim().toLowerCase());
  const savedNotes = topic.trim().length >= 2 ? store.getSavedNotes(topic.trim()) : null;

  const steps: LoaderStep[] = (["write", "plant", "verify"] as PipelineStep[]).map((s) => ({
    label: current?.step === s && !done.has(s) ? current.message.replace(/…$/, "") + "…" : STEP_LABELS[s],
    state: done.has(s) ? "done" : current?.step === s ? "active" : "pending",
  }));

  return (
    <main className="mx-auto w-full max-w-[1240px] px-2 pb-24 pt-2 sm:px-6">
      <h1 className="sr-only">New case: what should we sabotage today?</h1>
      {/* The folder that opened on the home page, lying open: notes on the cover, the form on the back panel. */}
      <CaseFolder label="No. 01 · New case" cover={<CoverNotes />}>
        <form ref={form} onSubmit={start} className="paper casefolder__sheet px-6 py-7 sm:px-9 sm:py-9" noValidate>
          <div className="paper-head label">
            <span>
              <b>Briefing request</b>
            </span>
            <span>Form S-1</span>
          </div>

          <div className="grid gap-7">
            {drill && (
              <div className="callout -mt-1 flex flex-wrap items-baseline justify-between gap-3 bg-[var(--pen-wash)] text-[15px] leading-snug" role="note">
                <span>
                  <strong>{drill.review ? "Review case." : "Drill."}</strong> This case tries to plant{" "}
                  {drill.targets.map((t, i) => (
                    <span key={t.key}>
                      {i ? " or " : ""}“{t.label}”
                    </span>
                  ))}{" "}
                  again, if the topic allows.
                </span>
                <button
                  type="button"
                  className="label cursor-pointer underline underline-offset-4 hover:text-ink"
                  onClick={() => {
                    store.clearDrill();
                    setDrill(null);
                  }}
                >
                  Plain case instead
                </button>
              </div>
            )}
            {offline && (
              <div className="callout -mt-1 bg-[var(--paper-sunk)] text-[15px] leading-snug text-ink-soft" role="note">
                <strong className="text-ink">Offline mode.</strong> {engine.reason} Rounds are built without AI: the text comes from your notes,
                a built-in topic below, or Wikipedia, and the errors are planted and marked by rules.
              </div>
            )}
            <div className="field">
              <label htmlFor="topic" className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">
                Topic
              </label>
              <div className="flex items-end gap-2">
                <input
                  id="topic"
                  className="input flex-1"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Photosynthesis: light-dependent reactions"
                  maxLength={200}
                  list="topic-suggestions"
                  autoComplete="off"
                  aria-invalid={Boolean(formError && topic.trim().length < 2)}
                />
                <button
                  type="button"
                  className="fav-star"
                  aria-pressed={isFavourite}
                  disabled={topic.trim().length < 2}
                  onClick={() => store.toggleFavourite(topic.trim())}
                  aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
                  title={isFavourite ? "Remove from favourites" : "Add to favourites"}
                >
                  {isFavourite ? "★" : "☆"}
                </button>
              </div>
              <datalist id="topic-suggestions">
                {suggestions.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className="-mt-4 flex flex-wrap gap-2" aria-label={quick.label}>
              {(allTopics ? quick.topics : quick.topics.slice(0, CHIP_LIMIT)).map((ex) => (
                <button key={ex} type="button" className="chip" data-fav={topics.favourites.includes(ex) || undefined} onClick={() => setTopic(ex)}>
                  {topics.favourites.includes(ex) && <span aria-hidden="true">★ </span>}
                  {ex}
                </button>
              ))}
              {quick.topics.length > CHIP_LIMIT && (
                <button type="button" className="label cursor-pointer self-center px-1 underline underline-offset-4 hover:text-ink" aria-expanded={allTopics} onClick={() => setAllTopics((v) => !v)}>
                  {allTopics ? "Fewer" : `All ${quick.topics.length} topics`}
                </button>
              )}
            </div>
            {savedNotes && !notes.trim() && (
              <p className="-mt-3 flex flex-wrap items-center gap-3 text-[15px] text-ink-soft">
                You saved notes for this topic.
                <button
                  type="button"
                  className="label cursor-pointer underline underline-offset-4 hover:text-ink"
                  onClick={() => {
                    setNotes(savedNotes);
                    setNotesOpen(true);
                  }}
                >
                  Use them
                </button>
              </p>
            )}

            <div className="grid gap-7 sm:grid-cols-2">
              <label className="field">
                <span>Level</span>
                <select className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                  <option value="other">Other…</option>
                </select>
              </label>
              {level === "other" && (
                <label className="field">
                  <span>Describe the level</span>
                  <input className="input" value={customLevel} onChange={(e) => setCustomLevel(e.target.value)} placeholder="e.g. first-year medicine" maxLength={80} />
                </label>
              )}
            </div>

            <fieldset className="field m-0 border-0 p-0">
              <legend className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">Difficulty</legend>
              <div className="segmented">
                {DIFFICULTIES.map((d) => (
                  <label key={d}>
                    <input type="radio" name="difficulty" value={d} checked={difficulty === d} onChange={() => setDifficulty(d)} />
                    {d[0].toUpperCase() + d.slice(1)}
                  </label>
                ))}
              </div>
              <p className="text-[15px] text-ink-soft">{DIFFICULTY_HELP[difficulty]}</p>
            </fieldset>

            <div>
              <button
                type="button"
                className="label flex cursor-pointer items-center gap-2 text-ink-soft hover:text-ink"
                aria-expanded={notesOpen}
                aria-controls="notes"
                onClick={() => setNotesOpen((o) => !o)}
              >
                <span aria-hidden="true" className={`inline-block transition-transform ${notesOpen ? "rotate-90" : ""}`}>
                  ▸
                </span>
                {offline ? "Paste your notes (works for any topic offline)" : "Paste your notes (recommended)"}
              </button>
              {notesOpen && (
                <label className="field mt-3" id="notes">
                  <span className="sr-only">Your notes</span>
                  <textarea
                    className="input min-h-[140px] text-[16px]"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Paste class notes or a syllabus section. The explanation will stay inside what's here, which makes it more accurate."
                    maxLength={12000}
                  />
                </label>
              )}
            </div>

            {formError && (
              <p role="alert" className="text-[15px] text-pen">
                {formError}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--paper-edge)] pt-5">
              <p className="label">2–4 errors · hidden count</p>
              <button type="submit" className="btn btn--pen" disabled={running && !loadError}>
                Sabotage it
              </button>
            </div>
          </div>
        </form>
      </CaseFolder>

      {running && (
        <LoupeLoader
          eyebrow={`Case file · ${difficulty}`}
          title="Preparing your briefing"
          steps={steps}
          error={loadError}
          contentKey={topic + notes}
          actions={
            <>
              <button type="button" className="btn btn--pen" onClick={() => start()}>
                Try again
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setRunning(false)}>
                Change the topic
              </button>
            </>
          }
        >
          <p className="label mb-3">
            Subject: <b className="text-ink">{topic}</b> · {effectiveLevel}
          </p>
          <p className="text-[18px] leading-[1.7]">
            {notes.trim()
              ? notes.trim().slice(0, 420) + (notes.trim().length > 420 ? "…" : "")
              : `A briefing on ${topic.trim()} for a ${effectiveLevel} student. One writer drafts an accurate explanation, a saboteur rewrites two to four sentences around real misconceptions, and a separate fact-checker confirms every planted error is wrong and every other sentence is right.`}
          </p>
        </LoupeLoader>
      )}
    </main>
  );
}
