"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { confidenceWord } from "@/components/ConfidenceSlider";
import { ErrorCard, FalseFlagCard } from "@/components/ErrorCard";
import { useRedactedNavigate } from "@/components/RedactionTransition";
import { RoundSource } from "@/components/RoundSource";
import { SentencePassage, type RedactState, type Verdict } from "@/components/SentencePassage";
import { DIFFICULTIES, DIFFICULTY_MULTIPLIER } from "@/lib/config";
import { brierGrade, brierScore, confidentMistakes, roundJudgements } from "@/lib/scoring";
import { store, type RoundRecord } from "@/lib/store";
import { useRoundRecord } from "@/lib/useStore";
import type { Round, RoundResult, Submission } from "@/lib/schemas";
import { reducedMotion } from "@/lib/prefs";
import { ProgressStrip } from "@/components/ProgressStrip";
import { takeDelta } from "@/lib/progress/record";
import { toast } from "@/lib/toast";

const PEEL_START = 450;
const PEEL_STEP = 170;

export default function ResultsPageShell() {
  // useParams is only known at request time; stream it in behind a Suspense boundary.
  return (
    <Suspense fallback={<main className="min-h-[60vh]" aria-busy="true" />}>
      <ResultsPage />
    </Suspense>
  );
}

function ResultsPage() {
  const { roundId } = useParams<{ roundId: string }>();
  const record = useRoundRecord(roundId);

  if (record === undefined) return <main className="min-h-[60vh]" aria-busy="true" />;
  if (!record?.result || !record.submission) {
    return (
      <main className="mx-auto max-w-xl px-5 py-20">
        <div className="paper callout px-7 py-6">
          <h1 className="display mb-2 text-[34px]">No verdict for this round yet.</h1>
          <p className="mb-5 text-ink-soft">Results are saved in this browser after you submit.</p>
          <Link href={record ? `/play/${record.round.id}` : "/play"} className="btn btn--pen">
            {record ? "Back to the round" : "Start a new round"}
          </Link>
        </div>
      </main>
    );
  }
  return <Reveal record={record} result={record.result} submission={record.submission} />;
}

function Reveal({ record, result, submission }: { record: RoundRecord; result: RoundResult; submission: Submission }) {
  const { round } = record;
  const navigate = useRedactedNavigate();
  const [reduce] = useState(() => reducedMotion());
  const [peeled, setPeeled] = useState(reduce ? round.sentences.length + 4 : -1);
  const [shownScore, setShownScore] = useState(reduce ? result.score : 0);
  // What the Misconception Profile makes of this case, written in the margin (only straight after playing it).
  const [insight] = useState(() => takeDelta(round.id)?.insight ?? null);

  // Every sentence starts blacked out; the bars peel away one by one with the verdict underneath.
  useEffect(() => {
    if (reduce) return;
    const timers = round.sentences.map((_, i) => window.setTimeout(() => setPeeled(i), PEEL_START + i * PEEL_STEP));
    const end = PEEL_START + round.sentences.length * PEEL_STEP;
    timers.push(window.setTimeout(() => setPeeled(round.sentences.length + 4), end + 500));
    let raf = 0;
    timers.push(
      window.setTimeout(() => {
        const t0 = performance.now();
        const tick = (now: number) => {
          const k = Math.min(1, (now - t0) / 1100);
          setShownScore(Math.round(result.score * (1 - (1 - k) ** 3)));
          if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }, end),
    );
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      cancelAnimationFrame(raf);
    };
  }, [reduce, round, result]);

  const verdicts = useMemo(() => Object.fromEntries(result.items.map((i) => [i.sentenceId, i.kind as Verdict])), [result]);

  const redaction: Record<string, RedactState> = {};
  round.sentences.forEach((s, i) => {
    if (i > peeled) redaction[s.id] = "redacted";
    else if (peeled <= round.sentences.length) redaction[s.id] = "unredacting";
  });
  const ready = peeled > round.sentences.length;

  const flagById = new Map(submission.flags.map((f) => [f.sentenceId, f]));
  const itemById = new Map(result.items.map((i) => [i.sentenceId, i]));
  const textById = new Map(round.sentences.map((s) => [s.id, s.text]));
  const catches = result.items.filter((i) => i.kind === "catch").length;
  const misses = result.items.filter((i) => i.kind === "miss").length;
  const falseFlags = result.items.filter((i) => i.kind === "false_flag");

  const judgements = roundJudgements(result.items, submission.foundAllConfidence);
  const brier = brierScore(judgements);
  const confident = confidentMistakes(result.items, submission.foundAllConfidence);
  const harder = DIFFICULTIES[DIFFICULTIES.indexOf(round.difficulty) + 1];
  const easier = DIFFICULTIES[DIFFICULTIES.indexOf(round.difficulty) - 1];
  const [replaying, setReplaying] = useState(false);

  // The same case with the errors hidden again, for revision: never scored (QoL Q4).
  async function replay() {
    setReplaying(true);
    try {
      const res = await fetch("/api/saboteur/replay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ round, errors: result.errors }) });
      const body = (await res.json().catch(() => null)) as { round?: Round; error?: string } | null;
      if (!res.ok || !body?.round) throw new Error(body?.error ?? "That case couldn't be replayed.");
      store.saveRound(body.round, record.notes, { replayOf: record.replayOf ?? round.id, daily: undefined });
      navigate(`/play/${body.round.id}`, `REPLAY · ${round.topic.toUpperCase()}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "That case couldn't be replayed.", { tone: "warn" });
      setReplaying(false);
    }
  }

  const again = (difficulty = round.difficulty) => {
    store.saveSettings({ topic: round.topic, level: round.level, difficulty, notes: record.notes ?? "" });
    store.requestAutostart();
    navigate("/play", "NEW CASE FILE");
  };

  const headline = misses === 0 && falseFlags.length === 0 ? "Clean sweep." : catches === 0 ? "They got past you." : misses === 0 ? "All caught." : "Some slipped through.";

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-28 pt-4 sm:px-8">
      <ProgressStrip roundId={round.id} play={ready} />
      <div className="rise mb-8 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="eyebrow mb-3">
            {record.replayOf ? "Replay · not scored" : record.daily ? `Daily case · ${record.daily}` : "Verdict"} · {round.topic} · {round.difficulty}
          </p>
          <h1 className="display text-[clamp(40px,6vw,76px)] text-desk">{headline}</h1>
          <RoundSource round={round} />
          {insight && (
            <p className="reveal-insight" data-in={ready || undefined}>
              {insight}{" "}
              <Link href="/dossier#weak" className="reveal-insight__link">
                Weak spots →
              </Link>
            </p>
          )}
        </div>
        <div className="paper flex items-center gap-5 px-6 py-4" aria-live="polite">
          <div>
            <p className="label">Score</p>
            <p className="font-[var(--font-display)] text-[54px] font-extrabold leading-none tabular-nums" style={{ fontFamily: "var(--font-display)", fontStretch: "80%" }}>
              {ready ? shownScore : 0}
              <span className="text-[22px] font-semibold text-ink-faint"> / {result.maxScore}</span>
            </p>
          </div>
          <ul className="m-0 grid list-none gap-1 p-0 font-mono text-[12px] uppercase tracking-[0.06em] text-ink-soft">
            <li>
              <span className="text-catch">✓</span> {catches} caught
            </li>
            <li>
              <span className="text-pen">✗</span> {misses} missed
            </li>
            <li>
              <span className="text-alarm">⚠</span> {falseFlags.length} false alarm{falseFlags.length === 1 ? "" : "s"}
            </li>
            <li>×{DIFFICULTY_MULTIPLIER[round.difficulty]} {round.difficulty}</li>
          </ul>
        </div>
      </div>

      <article className="paper rise px-6 pb-7 pt-6 sm:px-10 sm:pb-9 sm:pt-8" style={{ animationDelay: "60ms" }}>
        <div className="paper-head label">
          <span>
            <b>Case file, declassified</b>
          </span>
          <span>
            {result.errors.length} planted · {submission.flags.length} flagged
          </span>
        </div>
        <SentencePassage mode="review" sentences={round.sentences} verdicts={verdicts} redaction={redaction} inkIds={ready ? new Set(flagById.keys()) : new Set()} label="The passage with verdicts" />
        <p className="label mt-6 flex flex-wrap gap-x-5 gap-y-1">
          <span>
            <span className="text-catch">✓</span> Caught: you flagged a planted error
          </span>
          <span>
            <span className="text-pen">✗</span> Missed: a planted error you didn&apos;t flag
          </span>
          <span>
            <span className="text-alarm">⚠</span> False alarm: flagged, but correct
          </span>
        </p>
      </article>

      {ready && (confident.falseFlags.length > 0 || confident.missedWhileSure.length > 0) && (
        <aside className="paper callout rise mt-8 max-w-3xl">
          <p className="label mb-1">The one to remember</p>
          {confident.falseFlags[0] ? (
            <p className="text-[18px]">
              You were <strong>{Math.round((confident.falseFlags[0].confidence ?? 0) * 100)}% sure</strong> “{textById.get(confident.falseFlags[0].sentenceId)}” was wrong. It wasn&apos;t. Remember this one: confident mistakes, once fixed, tend to stick.
            </p>
          ) : (
            <p className="text-[18px]">
              You were <strong>{Math.round(confident.foundAllConfidence * 100)}% sure</strong> you&apos;d found them all, and {confident.missedWhileSure.length === 1 ? "one slipped" : `${confident.missedWhileSure.length} slipped`} past you. Confident mistakes, once fixed, tend to stick. That gap is where surprise exam marks are lost.
            </p>
          )}
        </aside>
      )}

      {ready && (
        <>
          <h2 className="display mb-5 mt-14 text-[clamp(30px,4vw,46px)] text-desk">What was planted</h2>
          <div className="grid gap-6 [perspective:1400px] md:grid-cols-2">
            {result.errors.map((e, i) => {
              const item = itemById.get(e.sentenceId);
              return item ? <ErrorCard key={e.sentenceId} error={e} item={item} flag={flagById.get(e.sentenceId)} number={i + 1} delay={i * 140} ready={ready} /> : null;
            })}
          </div>

          {falseFlags.length > 0 && (
            <>
              <h2 className="display mb-5 mt-14 text-[clamp(30px,4vw,46px)] text-desk">False alarms</h2>
              <div className="grid gap-6 [perspective:1400px] md:grid-cols-2">
                {falseFlags.map((item, i) => (
                  <FalseFlagCard key={item.sentenceId} item={item} text={textById.get(item.sentenceId) ?? ""} delay={i * 140} ready={ready} />
                ))}
              </div>
            </>
          )}

          <section className="paper rise mt-14 max-w-3xl px-6 py-6 sm:px-8" aria-labelledby="bets-h">
            <h2 id="bets-h" className="mb-1 text-[22px] font-bold" style={{ fontFamily: "var(--font-display)" }}>
              Your bets this round
            </h2>
            <p className="mb-4 text-[15px] text-ink-soft">
              Confidence is kept apart from your score. Calibration this round: <strong className="text-ink">{brierGrade(brier)}</strong>
              {brier !== null && <span className="text-ink-faint"> (Brier {brier.toFixed(2)}; 0 is perfect, 0.25 is a coin flip)</span>}.
            </p>
            <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0">
              {submission.flags.map((f) => {
                const hit = itemById.get(f.sentenceId)?.kind === "catch";
                return (
                  <li key={f.sentenceId} className="flex items-baseline gap-3 text-[15.5px]">
                    <span className={`font-mono text-[12px] ${hit ? "text-catch" : "text-alarm"}`}>{hit ? "✓ RIGHT" : "⚠ WRONG"}</span>
                    <span className="min-w-0 flex-1 truncate text-ink-soft">“{textById.get(f.sentenceId)}”</span>
                    <span className="font-mono text-[12px] tabular-nums">{Math.round(f.confidence * 100)}%</span>
                  </li>
                );
              })}
              <li className="flex items-baseline gap-3 border-t border-dashed border-[var(--paper-edge)] pt-2 text-[15.5px]">
                <span className={`font-mono text-[12px] ${misses === 0 ? "text-catch" : "text-pen"}`}>{misses === 0 ? "✓ RIGHT" : "✗ WRONG"}</span>
                <span className="flex-1 text-ink-soft">“I found them all” ({confidenceWord(submission.foundAllConfidence)})</span>
                <span className="font-mono text-[12px] tabular-nums">{Math.round(submission.foundAllConfidence * 100)}%</span>
              </li>
            </ul>
          </section>

          <div className="rise mt-12 flex flex-wrap gap-3">
            <button type="button" className="btn btn--pen" onClick={() => again()}>
              Another round on this topic
            </button>
            {harder && (
              <button type="button" className="btn btn--desk" onClick={() => again(harder)}>
                Same topic, harder ({harder})
              </button>
            )}
            {easier && (
              <button type="button" className="btn btn--desk" onClick={() => again(easier)}>
                Same topic, easier ({easier})
              </button>
            )}
            <button type="button" className="btn btn--desk" onClick={() => navigate("/play", "NEW CASE FILE")}>
              New topic
            </button>
            <button type="button" className="btn btn--desk" onClick={replay} disabled={replaying} title="The same sentences with the errors hidden again. Not scored.">
              Replay this case
            </button>
            <button type="button" className="btn btn--desk" onClick={() => window.print()} title="A clean copy with every correction, for revision">
              Print revision sheet
            </button>
          </div>
        </>
      )}
    </main>
  );
}
