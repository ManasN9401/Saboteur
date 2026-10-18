"use client";
/* eslint-disable @next/next/no-img-element -- a local preview of the student's own photo */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckQuestions, type CheckAnswer } from "@/components/autopsy/CheckQuestions";
import { ToeTag, type Verdict } from "@/components/autopsy/ToeTag";
import { LoupeLoader, type LoaderStep } from "@/components/LoupeLoader";
import { parseIntake } from "@/lib/autopsy/parse";
import type { AutopsyEvent, AutopsyImage, Diagnosis, IntakeItemInput, QuestionsRequest } from "@/lib/autopsy/schema";
import { LEVELS } from "@/lib/config";
import type { Finding } from "@/lib/learning/autopsy";
import { currentLearning, fileCheck, fileFinding } from "@/lib/learning/client";
import { resolveKey } from "@/lib/learning/labels";
import { relativeDay } from "@/lib/learning/views";
import type { ErrorType } from "@/lib/schemas";
import { store } from "@/lib/store";
import { newId } from "@/lib/text";
import { useActiveProfile, useIsClient } from "@/lib/useStore";

type Stage = "intake" | "examining" | "findings" | "treatment" | "report";
type Step = "read" | "examine" | "write";

const EXAMPLE = `Q: Two 6 Ω resistors are connected in parallel. What is the total resistance?
My answer: 12 Ω
Correct answer: 3 Ω

Q: What happens to the current in a series circuit as it passes through a bulb?
My answer: It gets used up, so it's smaller after the bulb
Correct answer: It stays the same all the way round`;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const SUBJECTS = ["maths", "physics", "chemistry", "biology", "history", "geography", "economics", "computer science", "english", "psychology"];
const MAX_SIDE = 1600;

/** Shrink a photo to at most 1600 px and re-encode it as JPEG, in the browser. Only this copy is sent. */
async function readImage(file: File): Promise<AutopsyImage> {
  const bitmap = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * k);
  canvas.height = Math.round(bitmap.height * k);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { mediaType: "image/jpeg", data: url.slice(url.indexOf(",") + 1) };
}

interface Result {
  item: IntakeItemInput;
  diagnosis: Diagnosis | null;
}

export default function AutopsyPage() {
  const isClient = useIsClient();
  if (!isClient) return <main className="min-h-[70vh]" aria-busy="true" />;
  return <Autopsy />;
}

function Autopsy() {
  const profile = useActiveProfile();
  const [stage, setStage] = useState<Stage>("intake");
  const [text, setText] = useState("");
  const [fills, setFills] = useState<Record<string, string>>({});
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState(() => profile?.onboarding.level ?? store.getSettings()?.level ?? LEVELS[1]);
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [engine, setEngine] = useState<"llm" | "offline" | null>(null);
  const [steps, setSteps] = useState<Record<Step, LoaderStep["state"]>>({ read: "pending", examine: "pending", write: "pending" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [offlineNote, setOfflineNote] = useState<string | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [confirmed, setConfirmed] = useState<Finding[]>([]);
  const [treating, setTreating] = useState(0);
  const [checks, setChecks] = useState<Record<string, CheckAnswer[]>>({});
  const examId = useRef(newId("aut"));
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/engine")
      .then((r) => r.json())
      .then((e) => alive && setEngine(e.engine))
      .catch(() => {});
    return () => {
      alive = false;
      abort.current?.abort();
    };
  }, []);
  // The local preview of a photo is released when it's replaced or the page goes.
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );

  const intake = useMemo(() => parseIntake(text), [text]);
  const ready = [...intake.items, ...intake.incomplete.filter((i) => i.answer && fills[i.id]?.trim()).map((i) => ({ ...i, correct: fills[i.id].trim() }))];
  const offline = engine === "offline";

  async function examine() {
    setError(null);
    setStage("examining");
    setSteps({ read: image ? "active" : "done", examine: image ? "pending" : "active", write: "pending" });
    abort.current = new AbortController();
    try {
      const picture = image ? await readImage(image.file).catch(() => Promise.reject(new Error("That picture couldn't be opened. Try a PNG or JPEG photo or screenshot."))) : undefined;
      const body = JSON.stringify({ items: ready, image: picture, subject: subject.trim() || undefined, level });
      const res = await fetch("/api/autopsy/diagnose", { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: abort.current.signal });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? "The examination couldn't start.");
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (value) buffer += value;
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as AutopsyEvent;
          if (ev.type === "progress") {
            const order: Step[] = ["read", "examine", "write"];
            setSteps(Object.fromEntries(order.map((s) => [s, order.indexOf(s) < order.indexOf(ev.step) ? "done" : s === ev.step ? "active" : "pending"])) as Record<Step, LoaderStep["state"]>);
            setMessage(ev.message);
          } else if (ev.type === "error") throw new Error(ev.message);
          else if (ev.type === "offline") return manual(ev.message);
          else if (ev.type === "done") {
            const items = ev.result.items ?? ready;
            setResults(items.map((item) => ({ item, diagnosis: ev.result.diagnoses.find((d) => d.itemId === item.id) ?? null })));
            setStage("findings");
            return;
          }
        }
        if (done) break;
      }
      throw new Error("The connection closed before the findings were ready. Try again.");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "The examination failed. Try again.");
    }
  }

  /** No AI: every wrong answer gets a blank tag for the student to fill in. */
  function manual(note: string | null) {
    if (image && !ready.length) {
      setStage("intake");
      setError("Reading a photo needs the AI, and it isn't connected. Paste the answers as text instead, and you can log them yourself.");
      return;
    }
    setOfflineNote(note);
    setResults(ready.map((item) => ({ item, diagnosis: null })));
    setStage("findings");
  }

  function decide(r: Result, v: Verdict, own?: { label: string; errorType: ErrorType | null }) {
    setVerdicts((all) => ({ ...all, [r.item.id]: v }));
    if (v === "slip") return;
    const d = r.diagnosis;
    const f: Finding = {
      id: `${examId.current}-${r.item.id}`,
      at: new Date().toISOString(),
      label: own?.label ?? d?.label ?? r.item.question,
      errorType: own ? own.errorType : (d?.errorType ?? null),
      subject: (d?.subject || subject.trim() || "general").toLowerCase(),
      topic: d?.topic ?? r.item.question.slice(0, 80),
      level,
      question: r.item.question,
      answer: r.item.answer,
      correct: r.item.correct,
      explanation: d?.explanation ?? "Logged by you from your marked work.",
      correction: d?.correction ?? `The answer is ${r.item.correct}.`,
    };
    fileFinding(f, v);
    if (v === "confirmed") setConfirmed((c) => [...c, f]);
  }

  const decided = results.length > 0 && results.every((r) => verdicts[r.item.id]);
  const current = confirmed[treating];
  const request = useMemo<QuestionsRequest | null>(
    () =>
      current
        ? { label: current.label, errorType: current.errorType, explanation: current.explanation, correction: current.correction, subject: current.subject, level: current.level, example: { question: current.question, answer: current.answer, correct: current.correct } }
        : null,
    [current],
  );

  function checked(answers: CheckAnswer[]) {
    if (answers.length) fileCheck(resolveKey(currentLearning(), current.label), answers, current.subject);
    setChecks((c) => ({ ...c, [current.id]: answers }));
    if (treating + 1 < confirmed.length) setTreating(treating + 1);
    else setStage("report");
  }

  function reset() {
    examId.current = newId("aut");
    setText("");
    setFills({});
    setImage(null);
    setResults([]);
    setVerdicts({});
    setConfirmed([]);
    setChecks({});
    setTreating(0);
    setOfflineNote(null);
    setStage("intake");
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-28 pt-4 sm:px-8">
      <header className="rise mb-7">
        <p className="eyebrow mb-2">Autopsy · wrong answers, examined</p>
        <h1 className="display text-[clamp(40px,6vw,72px)] text-desk">
          {stage === "intake" ? "Bring out your dead." : stage === "findings" ? "Findings." : stage === "treatment" ? "Treatment." : stage === "report" ? "Report." : "Examining."}
        </h1>
      </header>

      {stage === "intake" && (
        <section className="autopsy-tray rise" aria-label="Marked work">
          <div className="autopsy-tray__steel" aria-hidden="true" />
          <span className="autopsy-tray__plate" aria-hidden="true">
            Pathology
          </span>
          <div className="paper autopsy-tray__sheet">
            <Intro />
            <p className="max-w-[60ch] text-[16.5px]">
              Paste questions you got wrong, with your answer and the right one. Each wrong answer gets examined for the belief behind it. Slips are just slips. Anything you confirm goes on your corkboard and into review.
            </p>
            {offline && (
              <p className="callout mt-4 bg-[var(--paper-sunk)] text-[15px]" role="note">
                <strong>Offline.</strong> Diagnosing needs the AI, which isn&rsquo;t connected. You can still log what you believed for each wrong answer yourself.
              </p>
            )}
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <label className="field">
                <span>Subject (optional)</span>
                <input className="input" list="autopsy-subjects" value={subject} maxLength={60} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. physics" />
                <datalist id="autopsy-subjects">
                  {[...new Set([...(profile?.onboarding.subjects ?? []), ...SUBJECTS])].map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>
              <label className="field">
                <span>Level</span>
                <select className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
                  {[...new Set([level, ...LEVELS])].map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="field mt-5">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="autopsy-text" className="field__label">
                  Your wrong answers
                </label>
                <button type="button" className="label cursor-pointer underline underline-offset-4" onClick={() => setText(EXAMPLE)}>
                  Show an example
                </button>
              </div>
              <textarea
                id="autopsy-text"
                className="input min-h-[190px] text-[16px]"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={20000}
                placeholder={"Q: …\nMy answer: …\nCorrect answer: …\n\nOr paste a table from your document or spreadsheet."}
              />
            </div>
            {text.trim() && (
              <div className="autopsy-tray__parsed mt-3 text-[15px]" aria-live="polite">
                {intake.format === "none" ? (
                  <p>We can&rsquo;t find question / your answer / correct answer in that yet. Try one per block, labelled like the example.</p>
                ) : (
                  <p>
                    <b>{ready.length}</b> wrong answer{ready.length === 1 ? "" : "s"} to examine
                    {intake.matching.length > 0 && ` · ${intake.matching.length} already ${intake.matching.length === 1 ? "matches" : "match"} the right answer, so ${intake.matching.length === 1 ? "it's" : "they're"} left out`}.
                  </p>
                )}
                {intake.incomplete.filter((i) => i.answer).map((i) => (
                  <label key={i.id} className="field mt-3">
                    <span>Correct answer for “{i.question.slice(0, 80)}”</span>
                    <input className="input" value={fills[i.id] ?? ""} onChange={(e) => setFills((f) => ({ ...f, [i.id]: e.target.value }))} />
                  </label>
                ))}
              </div>
            )}

            {!offline && (
              <div className="mt-6 grid gap-2 border-t border-[var(--paper-edge)] pt-5">
                <span className="label">Or a photo of your marked work</span>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="btn btn--ghost btn--small cursor-pointer">
                    {image ? "Change photo" : "Add a photo"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) setImage({ file, url: URL.createObjectURL(file) });
                      }}
                    />
                  </label>
                  {image && (
                    <>
                      <img src={image.url} alt="Your marked work" className="autopsy-tray__thumb" />
                      <button type="button" className="label cursor-pointer underline underline-offset-4" onClick={() => setImage(null)}>
                        Remove
                      </button>
                    </>
                  )}
                </div>
                <p className="text-[14px] text-ink-soft">The photo is read once to find your wrong answers and is never kept: not on this device, not on our server. Only the text of the findings is saved. PDF pages: take a screenshot for now.</p>
              </div>
            )}

            {error && (
              <p role="alert" className="mt-4 text-[15px] text-pen">
                {error}
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              {offline ? (
                <button type="button" className="btn btn--pen" disabled={!ready.length} onClick={() => manual(null)}>
                  Log them myself
                </button>
              ) : (
                <button type="button" className="btn btn--pen" disabled={!ready.length && !image} onClick={() => void examine()}>
                  Examine
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {stage === "examining" && (
        <LoupeLoader
          eyebrow="Autopsy"
          title="Examining your answers"
          steps={(["read", "examine", "write"] as Step[])
            .filter((s) => s !== "read" || image)
            .map((s) => ({ label: steps[s] === "active" && message ? message.replace(/…$/, "") + "…" : { read: "Reading your marked work", examine: "Examining each wrong answer", write: "Writing up the findings" }[s], state: steps[s] }))}
          error={error}
          contentKey={text}
          actions={
            <>
              <button type="button" className="btn btn--pen" onClick={() => void examine()}>
                Try again
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setStage("intake")}>
                Back to the tray
              </button>
            </>
          }
        >
          <p className="text-[17px] leading-[1.7] whitespace-pre-line">{ready.length ? ready.map((i) => `${i.question}\nYou wrote: ${i.answer}. Answer: ${i.correct}.`).join("\n\n") : "Reading the photo of your marked work for the questions you got wrong, then looking for the belief behind each one."}</p>
        </LoupeLoader>
      )}

      {stage === "findings" && (
        <section aria-label="Findings">
          {offlineNote && (
            <p className="callout mb-5 bg-[var(--paper-sunk)] text-[15px]" role="note">
              {offlineNote}
            </p>
          )}
          {!results.length && <p className="paper callout text-[16px]">No wrong answers could be read from that. Try a clearer photo, or paste them as text.</p>}
          <div className="toe-tags">
            {results.map((r, i) => (
              <ToeTag key={r.item.id} n={i + 1} item={r.item} diagnosis={r.diagnosis} verdict={verdicts[r.item.id]} onVerdict={(v, own) => decide(r, v, own)} />
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <p className="text-[15px] text-desk-soft">{decided ? `${confirmed.length} confirmed · ${plural(Object.values(verdicts).filter((v) => v === "slip").length, "slip")}` : `${Object.keys(verdicts).length} of ${results.length} answered`}</p>
            {confirmed.length > 0 && !offlineNote && !offline ? (
              <button type="button" className="btn btn--pen" disabled={!decided} onClick={() => setStage("treatment")}>
                Check you&rsquo;ve got it
              </button>
            ) : (
              <button type="button" className="btn btn--pen" disabled={!decided} onClick={() => setStage("report")}>
                File the report
              </button>
            )}
          </div>
        </section>
      )}

      {stage === "treatment" && current && request && (
        <section className="paper autopsy-treatment" aria-label="Check questions">
          <p className="label mb-1">
            Misconception {treating + 1} of {confirmed.length}
          </p>
          <h2 className="display mb-5 text-[28px]">{current.label}</h2>
          <CheckQuestions key={current.id} request={request} onDone={checked} />
        </section>
      )}

      {stage === "report" && <Report confirmed={confirmed} checks={checks} slips={Object.values(verdicts).filter((v) => v === "slip").length} onAgain={reset} />}
    </main>
  );
}

const INTRO_KEY = "saboteur:v2:autopsy-intro";

/** First visit only (per device): how an autopsy goes, in three steps. */
function Intro() {
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(INTRO_KEY) === "1";
    } catch {
      return true;
    }
  });
  if (seen) return null;
  return (
    <aside className="autopsy-intro" aria-label="How an autopsy works">
      <ol>
        <li>
          <b>Bring the body.</b> Paste the questions you got wrong, or add a photo of the marked page.
        </li>
        <li>
          <b>Read the tags.</b> Each wrong answer gets a cause. Say whether it&rsquo;s right, not quite, or just a slip.
        </li>
        <li>
          <b>Check the cure.</b> A few new questions on each belief you confirm. Get them all and it&rsquo;s resolved.
        </li>
      </ol>
      <button
        type="button"
        className="label cursor-pointer underline underline-offset-4"
        onClick={() => {
          try {
            localStorage.setItem(INTRO_KEY, "1");
          } catch {
            /* shows again next time */
          }
          setSeen(true);
        }}
      >
        Got it
      </button>
    </aside>
  );
}

function Report({ confirmed, checks, slips, onAgain }: { confirmed: Finding[]; checks: Record<string, CheckAnswer[]>; slips: number; onAgain: () => void }) {
  const learning = currentLearning();
  const now = new Date().toISOString();
  return (
    <section className="paper autopsy-report">
      {confirmed.length ? (
        <>
          <p className="text-[16.5px]">
            {confirmed.length} misconception{confirmed.length === 1 ? "" : "s"} pinned to your corkboard{slips ? `, and ${slips} slip${slips === 1 ? "" : "s"} let go` : ""}.
          </p>
          <ul className="mt-5 grid gap-4">
            {confirmed.map((f) => {
              const m = learning.misconceptions[resolveKey(learning, f.label)];
              const a = checks[f.id] ?? [];
              const right = a.filter((x) => x.right).length;
              return (
                <li key={f.id} className="autopsy-report__row">
                  <b className="text-[17px]">{f.label}</b>
                  <span className="label">
                    {a.length ? `${right} of ${a.length} check questions right · ` : ""}
                    {m?.autopsy?.status === "resolved" ? "resolved" : "confirmed"}
                    {m?.review?.due ? ` · review ${relativeDay(m.review.due, now)}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="text-[16.5px]">Nothing pinned: {slips ? "only slips this time." : "none of the diagnoses fitted."} That&rsquo;s good news, or a sign to try another batch.</p>
      )}
      <div className="mt-7 flex flex-wrap gap-3">
        <Link href="/dossier#weak" className="btn btn--pen">
          See your corkboard
        </Link>
        <button type="button" className="btn btn--ghost" onClick={onAgain}>
          Examine more work
        </button>
      </div>
    </section>
  );
}
