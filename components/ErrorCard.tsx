"use client";

import { useEffect, useRef, useState } from "react";
import { ERROR_TYPE_LABEL } from "@/lib/errorTypes";
import type { Flag, GradedItem, PlantedError } from "@/lib/schemas";
import { confidenceWord } from "./ConfidenceSlider";
import { RevealDiff } from "./RevealDiff";
import { StampVerdict } from "./StampVerdict";

const GRADE_LABEL = { correct: "Correct fix", partially_correct: "Partly right", incorrect: "Wrong reason" } as const;

/** Stamp once, when at least half the card is on screen. */
function useOnScreen<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen] as const;
}

interface ErrorCardProps {
  error: PlantedError;
  item: GradedItem;
  flag?: Flag;
  number: number;
  delay: number;
  ready: boolean;
}

export function ErrorCard({ error, item, flag, number, delay, ready }: ErrorCardProps) {
  const [ref, seen] = useOnScreen<HTMLElement>();
  const caught = item.kind === "catch";
  return (
    <article ref={ref} className="paper flip-in relative px-6 pb-6 pt-5 sm:px-7" style={{ animationDelay: `${delay}ms` }} aria-labelledby={`err-${error.sentenceId}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label">
            Planted error {number} · {ERROR_TYPE_LABEL[error.errorType]}
          </p>
          <h3 id={`err-${error.sentenceId}`} className="mt-1 font-[var(--font-display)] text-[21px] font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            {caught ? "✓ Caught red-handed" : "✗ Slipped past you"}
          </h3>
        </div>
        <div className="-mr-1 -mt-1 shrink-0">
          <StampVerdict kind={item.kind} play={ready && seen} size={15} rotate={caught ? -8 : 7} />
        </div>
      </div>

      <div className="mt-4 rounded-sm bg-[var(--paper-sunk)] px-4 py-3">
        <RevealDiff sabotaged={error.sabotagedSentence} original={error.originalSentence} />
      </div>

      <dl className="mt-4 grid gap-3">
        <div>
          <dt className="label">Why it&apos;s wrong</dt>
          <dd className="m-0 mt-0.5 text-[16px] leading-snug text-ink-soft">{error.explanation}</dd>
        </div>
        <div>
          <dt className="label">Why it was tempting</dt>
          <dd className="m-0 mt-0.5 text-[16px] leading-snug text-ink-soft">{error.whyTempting}</dd>
        </div>
        <div>
          <dt className="label">The misconception</dt>
          <dd className="m-0 mt-0.5 text-[16px] leading-snug text-ink-soft">{error.misconceptionLabel}</dd>
        </div>
      </dl>

      {caught && flag && (
        <div className="mt-4 border-t border-dashed border-[var(--paper-edge)] pt-3">
          <p className="hand text-[25px] leading-[1.05] text-pen">your fix: {flag.correction.trim() || "(left blank)"}</p>
          <p className="mt-1 text-[15px] text-ink-soft">
            <strong className="text-ink">{GRADE_LABEL[item.correctionGrade ?? "incorrect"]}, +{item.points}.</strong> {item.feedback}{" "}
            <span className="text-ink-faint">You bet {Math.round((flag.confidence ?? 0.5) * 100)}% ({confidenceWord(flag.confidence)}).</span>
          </p>
        </div>
      )}
    </article>
  );
}

export function FalseFlagCard({ item, text, delay, ready }: { item: GradedItem; text: string; delay: number; ready: boolean }) {
  const [ref, seen] = useOnScreen<HTMLElement>();
  return (
    <article ref={ref} className="paper flip-in relative px-6 pb-6 pt-5 sm:px-7" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label">Your flag</p>
          <h3 className="mt-1 text-[21px] font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            ⚠ False alarm
          </h3>
        </div>
        <StampVerdict kind="false_flag" play={ready && seen} size={15} rotate={6} />
      </div>
      <p className="mt-4 rounded-sm bg-[var(--paper-sunk)] px-4 py-3 text-[17px] leading-relaxed">{text}</p>
      <p className="label mt-4">This sentence was actually correct</p>
      <p className="mt-0.5 text-[16px] leading-snug text-ink-soft">{item.feedback}</p>
      <p className="hand mt-3 text-[24px] leading-none text-pen">
        {item.points} points · you bet {Math.round((item.confidence ?? 0.5) * 100)}%
      </p>
    </article>
  );
}
