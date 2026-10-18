"use client";

import { useEffect, useState } from "react";
import type { CheckQuestion, QuestionsRequest } from "@/lib/autopsy/schema";
import { ConfidenceSlider } from "../ConfidenceSlider";

export interface CheckAnswer {
  right: boolean;
  confidence: number;
}

const LETTERS = ["A", "B", "C", "D"];

/**
 * Treatment (V07-05): two or three multiple-choice questions aimed at one confirmed misconception, each
 * with a confidence bet. After answering, the right option and the trap (the answer the misconception
 * leads to) are both explained.
 */
export function CheckQuestions({ request, onDone }: { request: QuestionsRequest; onDone: (answers: CheckAnswer[]) => void }) {
  const [questions, setQuestions] = useState<CheckQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [confidence, setConfidence] = useState(0.7);
  const [answered, setAnswered] = useState(false);
  const [answers, setAnswers] = useState<CheckAnswer[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/autopsy/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal: ctrl.signal })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok || !body?.questions) throw new Error(body?.error ?? "The check questions couldn't be written.");
        setQuestions(body.questions);
      })
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => ctrl.abort();
  }, [request]);

  if (error)
    return (
      <div className="callout text-[15px]" role="alert">
        {error}{" "}
        <button type="button" className="label cursor-pointer underline underline-offset-4" onClick={() => onDone([])}>
          Skip this one
        </button>
      </div>
    );
  if (!questions) return <p className="label" aria-busy="true">Writing check questions…</p>;

  const q = questions[n];
  const last = n === questions.length - 1;
  const submit = () => {
    if (choice === null) return;
    setAnswered(true);
    setAnswers((a) => [...a, { right: choice === q.answer, confidence }]);
  };
  const next = () => {
    if (last) return onDone(answers);
    setN(n + 1);
    setChoice(null);
    setAnswered(false);
    setConfidence(0.7);
  };

  return (
    <div className="check-q">
      <p className="label mb-2">
        Question {n + 1} of {questions.length}
      </p>
      <fieldset className="m-0 border-0 p-0" disabled={answered}>
        <legend className="mb-3 text-[18px] leading-snug">{q.stem}</legend>
        <div className="grid gap-2">
          {q.options.map((o, i) => (
            <label key={i} className="check-q__option" data-state={answered ? (i === q.answer ? "right" : i === choice ? "wrong" : i === q.trap ? "trap" : undefined) : choice === i ? "chosen" : undefined}>
              <input type="radio" name={`q${n}`} checked={choice === i} onChange={() => setChoice(i)} className="sr-only" />
              <b aria-hidden="true">{LETTERS[i]}</b>
              <span>{o}</span>
              {answered && i === q.trap && <em className="check-q__trap">the trap</em>}
            </label>
          ))}
        </div>
      </fieldset>
      {!answered ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <ConfidenceSlider id={`check-${n}`} label="How sure are you?" value={confidence} onChange={setConfidence} />
          <button type="button" className="btn btn--pen" disabled={choice === null} onClick={submit}>
            Answer
          </button>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 text-[15.5px]" aria-live="polite">
          <p>
            <b>{choice === q.answer ? "Right." : choice === q.trap ? "That's the trap." : "Not this time."}</b> {q.explanation}
          </p>
          <p className="text-ink-soft">
            <b>Why {LETTERS[q.trap]} tempts:</b> {q.trapExplanation}
          </p>
          <div>
            <button type="button" className="btn" onClick={next}>
              {last ? "Done" : "Next question"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
