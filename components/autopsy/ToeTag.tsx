"use client";

import { useState } from "react";
import type { Diagnosis, IntakeItemInput } from "@/lib/autopsy/schema";
import { ERROR_TYPE_LABEL } from "@/lib/errorTypes";
import { ERROR_TYPES, type ErrorType } from "@/lib/schemas";

export type Verdict = "confirmed" | "rejected" | "slip";

const STAMP: Record<Verdict, string> = {
  confirmed: "Confirmed",
  rejected: "Not quite",
  slip: "Just a slip",
};

interface Props {
  n: number;
  item: IntakeItemInput;
  /** Null when there's no diagnosis (offline): the student names the belief themselves. */
  diagnosis: Diagnosis | null;
  verdict?: Verdict;
  onVerdict: (v: Verdict, manual?: { label: string; errorType: ErrorType | null }) => void;
}

/**
 * One wrong answer, as a toe tag (V07-04): the question, what the student wrote, the right answer, and
 * the diagnosis, with three ways to answer it. A careless slip is shown greyed and filed as nothing.
 */
export function ToeTag({ n, item, diagnosis, verdict, onVerdict }: Props) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<ErrorType | "">("");
  // No diagnosis (offline), or the student says a "slip" was really something they didn't know.
  const [manual, setManual] = useState(!diagnosis);
  const slip = diagnosis?.kind === "careless_slip";
  const probing = !!diagnosis?.probe;
  return (
    // The shadow sits on a wrapper, round the card and its string together.
    <div className="toe-tag-wrap" data-slip={slip || undefined} data-verdict={verdict}>
      <article className="toe-tag" aria-labelledby={`tag-${item.id}`}>
        <span className="toe-tag__eyelet" aria-hidden="true" />
        <header className="toe-tag__head">
          <span className="label">No. {String(n).padStart(2, "0")}</span>
          {diagnosis && <span className="label">{slip ? "Slip" : diagnosis.errorType ? ERROR_TYPE_LABEL[diagnosis.errorType] : "Misconception"}</span>}
        </header>
        <h3 id={`tag-${item.id}`} className="toe-tag__q">
          {item.question}
        </h3>
        <dl className="toe-tag__answers">
          <div>
            <dt className="label">You wrote</dt>
            <dd className="toe-tag__wrong">{item.answer}</dd>
          </div>
          <div>
            <dt className="label">Answer</dt>
            <dd>{item.correct}</dd>
          </div>
        </dl>

        {diagnosis && slip && !manual && (
          <div className="toe-tag__finding">
            <p className="toe-tag__label">No misconception, just a slip.</p>
            <p className="text-[15px]">
              {diagnosis.label}. {diagnosis.explanation}
            </p>
          </div>
        )}
        {diagnosis && !slip && (
          <div className="toe-tag__finding">
            {probing ? (
              <>
                <p className="label mb-1">Not sure yet. Tell us:</p>
                <p className="toe-tag__label">{diagnosis.probe}</p>
                <p className="mt-1 text-[14.5px] text-ink-soft">
                  If so, the belief is: “{diagnosis.label}”. {diagnosis.explanation}
                </p>
              </>
            ) : (
              <>
                <p className="label mb-1">Cause of error</p>
                <p className="toe-tag__label">{diagnosis.label}</p>
                <p className="mt-1 text-[15px]">{diagnosis.explanation}</p>
              </>
            )}
            <p className="mt-2 text-[15px]">
              <b>The right idea.</b> {diagnosis.correction}
            </p>
          </div>
        )}
        {manual && !verdict && (
          <div className="toe-tag__finding grid gap-3">
            <label className="field">
              <span>What did you believe when you wrote it?</span>
              <input className="input" value={label} maxLength={160} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Resistances in parallel add up" />
            </label>
            <label className="field">
              <span>What kind of mistake (optional)</span>
              <select className="input" value={type} onChange={(e) => setType(e.target.value as ErrorType | "")}>
                <option value="">Not sure</option>
                {ERROR_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ERROR_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {verdict ? (
          <p className="toe-tag__stamp stamp-mark" role="status">
            {STAMP[verdict]}
          </p>
        ) : (
          <div className="toe-tag__actions">
            {manual ? (
              <>
                <button
                  type="button"
                  className="btn btn--pen btn--small"
                  disabled={label.trim().length < 3}
                  onClick={() =>
                    onVerdict("confirmed", {
                      label: label.trim(),
                      errorType: type || null,
                    })
                  }
                >
                  Log it
                </button>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => onVerdict("slip")}>
                  Just a slip
                </button>
              </>
            ) : slip ? (
              <>
                <button type="button" className="btn btn--small" onClick={() => onVerdict("slip")}>
                  Agreed, a slip
                </button>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => setManual(true)}>
                  No, I didn&rsquo;t know it
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn--pen btn--small" onClick={() => onVerdict("confirmed")}>
                  {probing ? "Yes, that's it" : "That's it"}
                </button>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => onVerdict("rejected")}>
                  Not quite
                </button>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => onVerdict("slip")}>
                  Just a slip
                </button>
              </>
            )}
          </div>
        )}
      </article>
    </div>
  );
}
