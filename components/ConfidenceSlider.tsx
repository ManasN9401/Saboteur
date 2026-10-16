"use client";

import { useActiveProfile } from "@/lib/useStore";

const WORDS: Record<number, string> = { 50: "pure guess", 60: "pretty unsure", 70: "fairly sure", 80: "confident", 90: "very sure", 100: "certain" };

export function confidenceWord(value: number) {
  return WORDS[Math.round(value * 10) * 10] ?? "";
}

interface Props {
  id: string;
  label: string;
  value: number; // 0.5–1.0
  onChange: (value: number) => void;
  disabled?: boolean;
}

const STEPS = [50, 60, 70, 80, 90, 100];

/** 50–100% in steps of 10, with the meaning spelled out next to the number. A slider, or a row of buttons (Settings → Play). */
export function ConfidenceSlider({ id, label, value, onChange, disabled }: Props) {
  const pct = Math.round(value * 100);
  const buttons = useActiveProfile()?.prefs.confidenceInput === "buttons";
  if (buttons)
    return (
      <fieldset disabled={disabled}>
        <legend className="label mb-2 flex w-full items-baseline justify-between gap-3">
          <span>{label}</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-faint">{confidenceWord(value)}</span>
        </legend>
        <div className="segmented" style={{ gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))` }}>
          {STEPS.map((n) => (
            <label key={n} className="!px-0 font-mono !text-[13px]">
              <input type="radio" name={id} checked={pct === n} onChange={() => onChange(n / 100)} aria-label={`${n}%, ${confidenceWord(n / 100)}`} />
              {n}
            </label>
          ))}
        </div>
      </fieldset>
    );
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="label">
          {label}
        </label>
        <output htmlFor={id} className="font-mono text-[13px] tabular-nums text-ink">
          {pct}% <span className="ml-1 text-[11px] uppercase tracking-[0.06em] text-ink-faint">{confidenceWord(value)}</span>
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="confidence"
        min={50}
        max={100}
        step={10}
        value={pct}
        disabled={disabled}
        aria-valuetext={`${pct}%, ${confidenceWord(value)}`}
        style={{ ["--fill" as string]: `${((pct - 50) / 50) * 100}%` }}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      <div aria-hidden="true" className="flex justify-between font-mono text-[10px] text-ink-faint">
        {STEPS.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
    </div>
  );
}
