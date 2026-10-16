"use client";

import { useEffect, useRef } from "react";
import { ConfidenceSlider } from "./ConfidenceSlider";

interface Props {
  open: boolean;
  flagCount: number;
  blankCount: number;
  value: number;
  onChange: (v: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/** The "I found them all" bet, asked right before submitting. */
export function SubmitDialog({ open, flagCount, blankCount, value, onChange, onCancel, onConfirm }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="paper m-auto w-[min(92vw,460px)] p-0 backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
      aria-labelledby="submit-title"
    >
      <div className="p-6 sm:p-7">
        <p className="label mb-2">Before the reveal</p>
        <h2 id="submit-title" className="display mb-2 text-[30px]">
          How sure are you that you found them all?
        </h2>
        <p className="mb-5 text-[15.5px] text-ink-soft">
          {flagCount === 0
            ? "You haven't flagged anything. Submitting now bets that this passage is clean."
            : `You flagged ${flagCount} sentence${flagCount === 1 ? "" : "s"}.`}{" "}
          {blankCount > 0 && `${blankCount} flag${blankCount === 1 ? " has" : "s have"} no correction yet, which caps those at the lowest catch score. `}
          This bet feeds your calibration, not your score.
        </p>
        <ConfidenceSlider id="found-all" label="I found them all, and I'm" value={value} onChange={onChange} />
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn btn--pen" onClick={onConfirm}>
            Reveal the errors
          </button>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Keep looking
          </button>
        </div>
      </div>
    </dialog>
  );
}
