"use client";

import { useEffect, useRef } from "react";
import type { Flag, Sentence } from "@/lib/schemas";
import { ConfidenceSlider } from "./ConfidenceSlider";

interface Props {
  flags: Flag[];
  sentences: Sentence[];
  activeId: string | null;
  onActivate: (id: string | null) => void;
  onChange: (id: string, patch: Partial<Flag>) => void;
  onRemove: (id: string) => void;
  /** Enter in a correction box: done with this flag, back to the passage. */
  onDone?: (id: string) => void;
}

function FlagCard({
  flag,
  sentence,
  index,
  active,
  autoFocus,
  onActivate,
  onChange,
  onRemove,
  onDone,
  idPrefix,
}: {
  flag: Flag;
  sentence?: Sentence;
  index: number;
  active: boolean;
  autoFocus: boolean;
  onActivate: () => void;
  onChange: (patch: Partial<Flag>) => void;
  onRemove: () => void;
  onDone?: () => void;
  idPrefix: string;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus) box.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  return (
    <div className="paper flag-card" data-active={active} onFocusCapture={onActivate}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="label">Flag {index + 1}</span>
        <button type="button" onClick={onRemove} className="label cursor-pointer underline decoration-dotted underline-offset-4 hover:text-pen">
          Unflag
        </button>
      </div>
      <p className="mb-3 text-[15px] italic leading-snug text-ink-soft">“{sentence?.text}”</p>
      <label htmlFor={`${idPrefix}-fix-${flag.sentenceId}`} className="label mb-1 block">
        What&apos;s wrong?
      </label>
      <textarea
        ref={box}
        id={`${idPrefix}-fix-${flag.sentenceId}`}
        className="input min-h-[64px] text-[16px]"
        rows={2}
        maxLength={1000}
        placeholder="It should say…"
        value={flag.correction}
        onChange={(e) => onChange({ correction: e.target.value })}
        onKeyDown={(e) => {
          // Enter saves the fix and goes back to the passage; Shift+Enter is a new line.
          if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && onDone) {
            e.preventDefault();
            onDone();
          }
        }}
      />
      <div className="mt-4">
        <ConfidenceSlider
          id={`${idPrefix}-conf-${flag.sentenceId}`}
          label="This is wrong, and I'm"
          value={flag.confidence}
          onChange={(confidence) => onChange({ confidence })}
        />
      </div>
    </div>
  );
}

/** Side panel on wide screens; a bottom sheet holding the active flag on phones. */
export function FlagPanel({ flags, sentences, activeId, onActivate, onChange, onRemove, onDone }: Props) {
  const byId = new Map(sentences.map((s) => [s.id, s]));
  const active = flags.find((f) => f.sentenceId === activeId) ?? null;
  const activeIndex = active ? flags.indexOf(active) : -1;

  return (
    <>
      <aside aria-label="Your flags" className="hidden lg:block">
        <div className="sticky top-6 flex max-h-[calc(100dvh-3rem)] flex-col gap-3.5 overflow-y-auto pb-6 [perspective:900px]">
          {flags.length === 0 ? (
            <p className="hand -rotate-2 px-1 py-5 text-[30px] leading-none text-desk-soft">Nothing flagged yet. Trust nothing.</p>
          ) : (
            flags.map((f, i) => (
              <FlagCard
                key={f.sentenceId}
                idPrefix="side"
                flag={f}
                sentence={byId.get(f.sentenceId)}
                index={i}
                active={f.sentenceId === activeId}
                autoFocus={f.sentenceId === activeId}
                onActivate={() => onActivate(f.sentenceId)}
                onChange={(patch) => onChange(f.sentenceId, patch)}
                onRemove={() => onRemove(f.sentenceId)}
                onDone={onDone && (() => onDone(f.sentenceId))}
              />
            ))
          )}
        </div>
      </aside>

      {active && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden" role="dialog" aria-label="Edit flag">
          <div className="mx-auto max-w-xl">
            <FlagCard
              idPrefix="sheet"
              flag={active}
              sentence={byId.get(active.sentenceId)}
              index={activeIndex}
              active
              autoFocus={false}
              onActivate={() => {}}
              onChange={(patch) => onChange(active.sentenceId, patch)}
              onRemove={() => onRemove(active.sentenceId)}
            />
            <button type="button" className="btn mt-2 w-full" onClick={() => onActivate(null)}>
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
