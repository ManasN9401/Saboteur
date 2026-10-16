"use client";

import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import type { GradedItem, Sentence } from "@/lib/schemas";

export type Verdict = GradedItem["kind"];
export type RedactState = "redacted" | "unredacting";

const VERDICT_TAG: Record<Verdict, string> = { catch: "✓ Caught", miss: "✗ Missed", false_flag: "⚠ False alarm" };

interface Props {
  sentences: Sentence[];
  /** "play" makes sentences flaggable; "review" is read-only. */
  mode: "play" | "review";
  flaggedIds?: Set<string>;
  activeId?: string | null;
  onToggle?: (id: string) => void;
  onActivate?: (id: string) => void;
  verdicts?: Record<string, Verdict>;
  redaction?: Record<string, RedactState>;
  /** Sentences to underline in red ink. Defaults to the flagged ones. */
  inkIds?: Set<string>;
  label?: string;
}

/** Reads like normal prose, but every sentence is its own target. Arrow keys move, Enter flags. */
export function SentencePassage({ sentences, mode, flaggedIds, activeId, onToggle, onActivate, verdicts, redaction, inkIds, label }: Props) {
  const refs = useRef(new Map<string, HTMLSpanElement>());
  const [focusId, setFocusId] = useState<string>(sentences[0]?.id ?? "");
  const inked = inkIds ?? flaggedIds ?? new Set<string>();

  const moveFocus = (from: number, delta: number) => {
    const next = sentences[Math.min(sentences.length - 1, Math.max(0, from + delta))];
    if (!next) return;
    setFocusId(next.id);
    refs.current.get(next.id)?.focus();
    onActivate?.(next.id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLSpanElement>, index: number, id: string) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      moveFocus(index, 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      moveFocus(index, -1);
    } else if (e.key === "Home") {
      e.preventDefault();
      moveFocus(0, 0);
    } else if (e.key === "End") {
      e.preventDefault();
      moveFocus(sentences.length - 1, 0);
    } else if ((e.key === "Enter" || e.key === " ") && mode === "play") {
      e.preventDefault();
      onToggle?.(id);
    }
  };

  return (
    <div className="relative">
      <p className="passage" aria-label={label}>
        {sentences.map((s, i) => {
          const verdict = verdicts?.[s.id];
          const red = redaction?.[s.id];
          const flagged = flaggedIds?.has(s.id) ?? false;
          return (
            <span key={s.id}>
              <span
                ref={(el) => {
                  if (el) refs.current.set(s.id, el);
                  else refs.current.delete(s.id);
                }}
                className={`sentence${red === "redacted" ? " is-redacted" : red === "unredacting" ? " is-unredacting" : ""}`}
                data-flagged={mode === "play" && flagged}
                data-active={mode === "play" && activeId === s.id}
                data-static={mode === "review"}
                data-verdict={red ? undefined : verdict}
                role={mode === "play" ? "button" : undefined}
                aria-pressed={mode === "play" ? flagged : undefined}
                data-sid={s.id}
                tabIndex={focusId === s.id ? 0 : -1}
                onFocus={() => setFocusId(s.id)}
                onClick={() => {
                  if (mode !== "play") return;
                  setFocusId(s.id);
                  onToggle?.(s.id);
                }}
                onKeyDown={(e) => onKeyDown(e, i, s.id)}
              >
                {s.text}
                {verdict && red !== "redacted" && (
                  <span className="verdict-tag" data-kind={verdict}>
                    {VERDICT_TAG[verdict]}
                  </span>
                )}
                {mode === "play" && flagged && <span className="sr-only"> (flagged)</span>}
              </span>{" "}
            </span>
          );
        })}
      </p>
      <InkMarks ids={inked} refs={refs} dependency={sentences} />
    </div>
  );
}

/* ---------- Hand-drawn ink underlines ---------- */

function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** A slightly wavy pen stroke under one line of text, ending in a small flick. */
function underline(x1: number, x2: number, y: number, rand: () => number) {
  const dip = 1.5 + rand() * 2;
  const mid = (x1 + x2) / 2;
  const start = `M${(x1 + rand() * 3).toFixed(1)} ${(y + rand() * 2).toFixed(1)}`;
  const curve = `Q${mid.toFixed(1)} ${(y + dip).toFixed(1)} ${(x2 - 2).toFixed(1)} ${(y - 0.5 + rand() * 2).toFixed(1)}`;
  const flick = `q4 -1 7 -${(4 + rand() * 3).toFixed(1)}`;
  return `${start} ${curve} ${flick}`;
}

interface Mark {
  key: string;
  d: string;
  len: number;
  fresh: boolean;
}

function InkMarks({ ids, refs, dependency }: { ids: Set<string>; refs: RefObject<Map<string, HTMLSpanElement>>; dependency: unknown }) {
  const svg = useRef<SVGSVGElement>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const drawn = useRef(new Set<string>());
  const idKey = [...ids].sort().join(",");

  const measure = useCallback(() => {
    const host = svg.current?.parentElement;
    if (!host) return;
    const box = host.getBoundingClientRect();
    const next: Mark[] = [];
    for (const id of idKey ? idKey.split(",") : []) {
      const el = refs.current.get(id);
      if (!el) continue;
      const rand = seeded(id);
      [...el.getClientRects()].forEach((r, line) => {
        if (r.width < 8) return;
        const y = r.bottom - box.top - 1;
        const d = underline(r.left - box.left, r.right - box.left, y, rand);
        const key = `${id}:${line}`;
        next.push({ key, d, len: r.width + 20, fresh: !drawn.current.has(key) });
      });
    }
    // Remember what has been drawn so a resize redraws instantly, but unflagging then re-flagging animates again.
    drawn.current = new Set(next.map((m) => m.key));
    setMarks(next);
  }, [idKey, refs]);

  useLayoutEffect(() => {
    measure();
    const host = svg.current?.parentElement;
    if (!host) return;
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [measure, dependency]);

  return (
    <svg ref={svg} className="ink-layer" aria-hidden="true">
      {marks.map((m) => (
        <path key={m.key} d={m.d} className={m.fresh ? "draw" : undefined} style={{ strokeDasharray: m.len, ["--len" as string]: m.len }} />
      ))}
    </svg>
  );
}
