"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { FlagPanel } from "@/components/FlagPanel";
import { KeyboardHelp } from "@/components/KeyboardHelp";
import { LoupeLoader } from "@/components/LoupeLoader";
import { useRedactedNavigate } from "@/components/RedactionTransition";
import { RoundSource } from "@/components/RoundSource";
import { SentencePassage } from "@/components/SentencePassage";
import { SubmitDialog } from "@/components/SubmitDialog";
import { historyReducer, initHistory } from "@/lib/flagsHistory";
import { updatePrefs } from "@/lib/profile/profiles";
import { recordCompletion } from "@/lib/progress/record";
import type { Flag, RoundResult, Submission } from "@/lib/schemas";
import { store } from "@/lib/store";
import { useRoundLock } from "@/lib/useRoundLock";
import { useActiveProfile, useRoundRecord } from "@/lib/useStore";

export default function RoundPageShell() {
  // useParams is only known at request time; stream it in behind a Suspense boundary.
  return (
    <Suspense fallback={<main className="min-h-[60vh]" aria-busy="true" />}>
      <RoundPage />
    </Suspense>
  );
}

function RoundPage() {
  const { roundId } = useParams<{ roundId: string }>();
  const navigate = useRedactedNavigate();
  const record = useRoundRecord(roundId);
  const profile = useActiveProfile();
  // Drafts are only read in the browser; the server render shows the loading state anyway. Every
  // change goes through an undo history (Ctrl+Z).
  const [history, dispatch] = useReducer(historyReducer, roundId, (id) => initHistory(typeof window === "undefined" ? [] : store.getDraft(id)));
  const flags = history.present;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const lock = useRoundLock(roundId);
  const [asking, setAsking] = useState(false);
  const [foundAll, setFoundAll] = useState(0.7);
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState<{ message: string; expired?: boolean } | null>(null);
  const [startedAt] = useState(() => Date.now());

  const round = record?.round;
  const order = useMemo(() => new Map(round?.sentences.map((s, i) => [s.id, i]) ?? []), [round]);

  const updateFlags = useCallback(
    (next: Flag[], key?: string) => {
      const sorted = [...next].sort((a, b) => (order.get(a.sentenceId) ?? 0) - (order.get(b.sentenceId) ?? 0));
      dispatch({ type: "set", flags: sorted, key });
    },
    [order],
  );

  // The draft follows every change, undo and redo included, until the case is submitted.
  const open = !!record && !record.result;
  useEffect(() => {
    if (open) store.saveDraft(roundId, flags);
  }, [flags, roundId, open]);

  // Leaving while the marking request is in flight would lose it.
  useEffect(() => {
    if (!grading) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [grading]);

  const roundText = profile?.prefs.roundText ?? 1;
  const setRoundText = (v: number) => updatePrefs({ roundText: Math.round(Math.min(1.4, Math.max(0.85, v)) * 100) / 100 });

  const toggle = (id: string) => {
    if (flags.some((f) => f.sentenceId === id)) {
      updateFlags(flags.filter((f) => f.sentenceId !== id));
      if (activeId === id) setActiveId(null);
    } else {
      updateFlags([...flags, { sentenceId: id, correction: "", confidence: 0.7 }]);
      setActiveId(id);
    }
  };

  const focusSentence = (id: string) => document.querySelector<HTMLElement>(`.sentence[data-sid="${id}"]`)?.focus();
  const currentSentence = () => (document.activeElement as HTMLElement | null)?.dataset.sid ?? activeId ?? round?.sentences[0]?.id ?? null;

  // Keyboard play (QoL Q2). Typing in a box, or an open dialog, keeps its own keys.
  useEffect(() => {
    if (!round) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.closest("textarea, input, select, [contenteditable]");
      const mod = e.ctrlKey || e.metaKey;
      // Undo is the case's own history everywhere on the page, fix boxes included (a run of typing
      // in one box is one step), so it never splits between the browser's undo and ours.
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
        return;
      }
      if (mod && e.key === "Enter") {
        e.preventDefault();
        if (!lock.elsewhere) setAsking(true);
        return;
      }
      if (typing || mod || e.altKey || document.querySelector("dialog[open]")) return;
      const ids = round.sentences.map((x) => x.id);
      const cur = currentSentence();
      const at = cur ? ids.indexOf(cur) : -1;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const next = ids[Math.min(ids.length - 1, Math.max(0, at + (e.key === "j" ? 1 : -1)))];
        if (next) {
          focusSentence(next);
          if (flags.some((f) => f.sentenceId === next)) setActiveId(next);
        }
      } else if (e.key === "f" && cur) {
        e.preventDefault();
        toggle(cur);
      } else if (e.key === "e") {
        const id = activeId ?? (cur && flags.some((f) => f.sentenceId === cur) ? cur : null);
        const box = id && document.querySelector<HTMLTextAreaElement>(`#side-fix-${id}, #sheet-fix-${id}`);
        if (box) {
          e.preventDefault();
          setActiveId(id);
          box.focus();
        }
      } else if (/^[1-6]$/.test(e.key)) {
        const id = activeId ?? cur;
        if (id && flags.some((f) => f.sentenceId === id)) {
          e.preventDefault();
          updateFlags(
            flags.map((f) => (f.sentenceId === id ? { ...f, confidence: 0.4 + Number(e.key) / 10 } : f)),
            `conf:${id}`,
          );
        }
      } else if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function submit() {
    if (!round || lock.elsewhere) return;
    setAsking(false);
    setGrading(true);
    setGradeError(null);
    const submission: Submission = {
      roundId: round.id,
      flags,
      foundAllConfidence: foundAll,
      timeTakenSec: Math.round((Date.now() - startedAt) / 1000),
    };
    try {
      const res = await fetch("/api/saboteur/grade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(submission) });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setGradeError({ message: body?.error ?? "Grading failed. Try again.", expired: body?.expired });
        return;
      }
      // Progress counts once: only when this is the first result saved for the round.
      if (store.saveResult(round.id, submission, body as RoundResult)) recordCompletion(round.id);
      navigate(`/results/${round.id}`, "VERDICT");
    } catch {
      setGradeError({ message: "Couldn't reach the server. Check your connection and try again." });
    }
  }

  if (record === undefined) return <main className="min-h-[60vh]" aria-busy="true" />;

  if (!round) {
    return (
      <main className="mx-auto max-w-xl px-5 py-20">
        <div className="paper callout px-7 py-6">
          <h1 className="display mb-2 text-[34px]">This case file is missing.</h1>
          <p className="mb-5 text-ink-soft">Rounds are saved in this browser only. It may have been cleared, or opened on another device.</p>
          <Link href="/play" className="btn btn--pen">
            Start a new round
          </Link>
        </div>
      </main>
    );
  }

  if (record.result && !grading) {
    return (
      <main className="mx-auto max-w-xl px-5 py-20">
        <div className="paper px-7 py-6">
          <h1 className="display mb-2 text-[34px]">You&apos;ve already submitted this round.</h1>
          <Link href={`/results/${round.id}`} className="btn btn--pen mt-3">
            See the verdict
          </Link>
        </div>
      </main>
    );
  }

  const flaggedIds = new Set(flags.map((f) => f.sentenceId));
  const blank = flags.filter((f) => !f.correction.trim()).length;
  const flaggedSentences = round.sentences.filter((s) => flaggedIds.has(s.id));
  const countHint = profile?.prefs.countHint ?? "hidden";

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-40 pt-4 sm:px-8 lg:pb-24">
      <div className="rise mb-7 max-w-3xl">
        <p className="eyebrow mb-3">
          {round.level} · {round.difficulty}
        </p>
        <h1 className="display text-[clamp(36px,5.5vw,64px)] text-desk">{round.topic}</h1>
        <p className="mt-3 text-[18px] text-desk-soft">
          {countHint === "range" ? "Between two and four errors are hiding in here." : "Some errors are hiding in here."} Click a sentence you think is wrong, say what it should be, and bet on it.
        </p>
        <RoundSource round={round} />
      </div>

      {lock.elsewhere && (
        <div className="paper tab-lock" role="alert">
          <span>This case is open in another tab. Carry on there, or move it here.</span>
          <button type="button" className="btn btn--small" onClick={lock.takeOver}>
            Use this tab
          </button>
        </div>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.75fr)]">
        <article className="paper rise px-6 pb-7 pt-6 sm:px-10 sm:pb-9 sm:pt-8" style={{ animationDelay: "80ms" }}>
          <div className="paper-head label">
            <span>
              <b>Case file</b> · {round.id.slice(-6).toUpperCase()}
            </span>
            <span className="round-tools">
              <button type="button" onClick={() => dispatch({ type: "undo" })} disabled={!history.past.length} aria-label="Undo" title="Undo (Ctrl+Z)">
                ↶
              </button>
              <button type="button" onClick={() => dispatch({ type: "redo" })} disabled={!history.future.length} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
                ↷
              </button>
              <button type="button" onClick={() => setRoundText(roundText - 0.1)} disabled={roundText <= 0.85} aria-label="Smaller text" title="Smaller text">
                A−
              </button>
              <button type="button" onClick={() => setRoundText(roundText + 0.1)} disabled={roundText >= 1.4} aria-label="Larger text" title="Larger text">
                A+
              </button>
              <button type="button" onClick={() => setHelpOpen(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
                ?
              </button>
            </span>
          </div>
          <SentencePassage
            mode="play"
            label="The passage. Each sentence can be flagged."
            sentences={round.sentences}
            flaggedIds={flaggedIds}
            activeId={activeId}
            onToggle={toggle}
          />
          <p className="label mt-6">
            {round.sentences.length} sentences · arrows or J K move · Enter or F flags · press ? for every key
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--paper-edge)] pt-5">
            <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-soft" aria-live="polite">
              {flags.length} flagged{blank ? ` · ${blank} without a fix` : ""}
            </span>
            <button type="button" className="btn btn--pen" onClick={() => setAsking(true)} disabled={lock.elsewhere}>
              Submit my flags
            </button>
          </div>
        </article>

        <FlagPanel
          flags={flags}
          sentences={round.sentences}
          activeId={activeId}
          onActivate={setActiveId}
          onChange={(id, patch) => updateFlags(flags.map((f) => (f.sentenceId === id ? { ...f, ...patch } : f)), `${"correction" in patch ? "fix" : "conf"}:${id}`)}
          onRemove={(id) => toggle(id)}
          onDone={(id) => focusSentence(id)}
        />
      </div>

      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <SubmitDialog open={asking} flagCount={flags.length} blankCount={blank} value={foundAll} onChange={setFoundAll} onCancel={() => setAsking(false)} onConfirm={submit} />

      {grading && (
        <LoupeLoader
          eyebrow="Marking"
          title="Checking your work"
          contentKey={round.id}
          steps={[
            { label: "Matching your flags to the planted errors", state: "done" },
            { label: "Reading your corrections", state: gradeError ? "pending" : "active" },
            { label: "Explaining any false alarms", state: "pending" },
          ]}
          error={gradeError?.message}
          actions={
            gradeError?.expired ? (
              <Link href="/play" className="btn btn--pen">
                Start a new round
              </Link>
            ) : (
              <>
                <button type="button" className="btn btn--pen" onClick={submit}>
                  Try again
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setGrading(false)}>
                  Back to the passage
                </button>
              </>
            )
          }
        >
          <p className="passage text-[18px]">
            {(flaggedSentences.length ? flaggedSentences : round.sentences.slice(0, 4)).map((s) => (
              <span key={s.id} className={flaggedIds.has(s.id) ? "underline decoration-pen decoration-wavy decoration-[1.5px] underline-offset-[5px]" : ""}>
                {s.text}{" "}
              </span>
            ))}
          </p>
        </LoupeLoader>
      )}
    </main>
  );
}
