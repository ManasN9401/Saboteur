"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ERROR_TYPE_LABEL } from "@/lib/errorTypes";
import { prepareDrill } from "@/lib/learning/drill";
import { RETIRED_BOX } from "@/lib/learning/model";
import type { Learning, Misconception, Outcome } from "@/lib/learning/schema";
import { topMisconceptions } from "@/lib/learning/views";
import { useRedactedNavigate } from "./RedactionTransition";

const SHOWN = 12;
const OUTCOME: Record<Outcome, string> = { caught: "Caught", half: "Flagged, wrong fix", missed: "Slipped past" };
const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Card = Misconception & { now: number };
interface Link_ {
  from: number;
  to: number;
  kind: "subject" | "type";
}

/** Strings run between neighbours on the board that share a subject (red) or a kind of error (black). */
function strings(cards: Card[]): Link_[] {
  const out: Link_[] = [];
  const chain = (kind: Link_["kind"], keyOf: (c: Card) => string) => {
    const last = new Map<string, number>();
    cards.forEach((c, i) => {
      const k = keyOf(c);
      if (last.has(k) && !out.some((l) => l.from === last.get(k) && l.to === i)) out.push({ from: last.get(k)!, to: i, kind });
      last.set(k, i);
    });
  };
  chain("subject", (c) => c.subjects[0] ?? "");
  chain("type", (c) => c.errorType);
  return out;
}

/**
 * The dossier's Weak spots tab (V06-04): the misconceptions that keep getting past the player, as index
 * cards pinned to a corkboard, strongest first. A card opens its history and a "Drill this" button.
 */
export function WeakSpots({ learning, now }: { learning: Learning; now: string }) {
  const cards = useMemo(() => topMisconceptions(learning, now, SHOWN), [learning, now]);
  const [open, setOpen] = useState<Card | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const [pins, setPins] = useState<{ x: number; y: number }[]>([]);
  const links = useMemo(() => strings(cards), [cards]);

  // Where each card's pin sits, for the strings. Measured after layout and whenever the board resizes.
  useLayoutEffect(() => {
    const el = board.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      setPins([...el.querySelectorAll<HTMLElement>(".weak-card__pin")].map((p) => {
        const r = p.getBoundingClientRect();
        return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
      }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cards]);

  if (!cards.length)
    return (
      <div className="py-6 text-center">
        <p className="label mb-2">Nothing pinned yet</p>
        <h2 className="display mb-3 text-[34px]">No misconceptions on file</h2>
        <p className="mx-auto mb-6 max-w-[46ch] text-[16px]">When a planted error gets past you, the wrong belief behind it is pinned here, with the cases it came from. Catch it later and it fades.</p>
        <Link href="/play" className="btn">
          Open a case
        </Link>
      </div>
    );

  // One column (phones): strings would only run straight down through every card, so leave them off.
  const columns = new Set(pins.map((p) => Math.round(p.x / 40))).size;
  const stringPaths =
    pins.length === cards.length && columns > 1
      ? links.map((l) => {
          const a = pins[l.from];
          const b = pins[l.to];
          const sag = Math.min(60, Math.hypot(b.x - a.x, b.y - a.y) * 0.18);
          return <path key={`${l.from}-${l.to}-${l.kind}`} d={`M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 + sag} ${b.x} ${b.y}`} data-kind={l.kind} />;
        })
      : null;
  const due = cards.filter((c) => c.review && c.review.box < RETIRED_BOX && c.review.due && c.review.due <= now).length;
  return (
    <div className="grid gap-5">
      <p className="max-w-[62ch] text-[16px]">
        The wrong beliefs that got past you, strongest first. Each fades by half after ten days unless it catches you again.
        {due > 0 && (
          <>
            {" "}
            <b>{due === 1 ? "One is" : `${due} are`} due for review.</b>
          </>
        )}
      </p>
      <div ref={board} className="weak-board">
        {/* Twice: strong under the cards (seen in the gaps), faint over them, so text stays readable. */}
        {(["under", "over"] as const).map((layer) => (
          <svg key={layer} className="weak-board__strings" data-layer={layer} aria-hidden="true">
            {stringPaths}
          </svg>
        ))}
        <ul className="weak-board__cards">
          {cards.map((c, i) => {
            const isDue = !!c.review && c.review.box < RETIRED_BOX && !!c.review.due && c.review.due <= now;
            return (
              <li key={c.key} style={{ "--r": `${((i * 47) % 7) - 3}deg` } as React.CSSProperties}>
                <button type="button" className="weak-card paper" onClick={() => setOpen(c)} aria-haspopup="dialog">
                  <span className="weak-card__pin" aria-hidden="true" />
                  <span className="weak-card__type label">
                    {ERROR_TYPE_LABEL[c.errorType]} · {capital(c.subjects[0] ?? "")}
                  </span>
                  <span className="weak-card__label">{c.label}</span>
                  <span className="weak-card__tally">
                    Got past you {c.missed + c.half} of {c.seen} · last {date(c.lastSeen)}
                  </span>
                  <span className="weak-card__strength" aria-label={`Strength ${c.now.toFixed(1)}`}>
                    <span style={{ width: `${Math.min(100, (c.now / 3) * 100)}%` }} />
                  </span>
                  {isDue && <span className="weak-card__due">Due</span>}
                  {c.autopsy?.status === "confirmed" && <span className="weak-card__tag">Autopsy: confirmed</span>}
                  {c.autopsy?.status === "resolved" && <span className="weak-card__tag weak-card__tag--resolved">Resolved</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.08em]">
        {stringPaths && (
          <>
            <span>
              <i className="weak-legend" data-kind="subject" /> same subject
            </span>
            <span>
              <i className="weak-legend" data-kind="type" /> same kind of error
            </span>
          </>
        )}
        <span>Bar: how firmly it holds</span>
      </p>
      <CardDetail card={open} now={now} onClose={() => setOpen(null)} />
    </div>
  );
}

function CardDetail({ card, now, onClose }: { card: Card | null; now: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const navigate = useRedactedNavigate();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (card && !d.open) d.showModal();
    if (!card && d.open) d.close();
  }, [card]);
  const last = card?.history.at(-1);
  const review = card?.review;
  return (
    <dialog
      ref={ref}
      className="drawer weak-detail"
      aria-labelledby="weak-detail-title"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      {card && (
        <div className="paper weak-detail__body">
          <div className="flex items-start justify-between gap-4">
            <p className="label">
              {ERROR_TYPE_LABEL[card.errorType]} · {card.subjects.map(capital).join(", ")}
            </p>
            <button type="button" className="label cursor-pointer underline underline-offset-4" onClick={() => ref.current?.close()}>
              Close
            </button>
          </div>
          <h2 id="weak-detail-title" className="display mt-2 text-[32px]">
            {card.label}
          </h2>
          <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.08em]">
            Seen {card.seen} · caught {card.caught} · slipped past {card.missed}
            {card.half ? ` · right sentence, wrong fix ${card.half}` : ""}
            {card.confidentWrong ? ` · ${card.confidentWrong} while sure you'd found them all` : ""}
          </p>
          {review && (
            <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.08em]">
              {review.box >= RETIRED_BOX ? "Retired from review" : review.due && review.due <= now ? "Due for review now" : `Review box ${review.box + 1} of 4 · due ${date(review.due!)}`}
            </p>
          )}
          {last && (
            <div className="mt-5 grid gap-3 text-[16px]">
              {last.whyTempting && (
                <p>
                  <b>Why it’s tempting.</b> {last.whyTempting}
                </p>
              )}
              <p>
                <b>{last.source === "autopsy" ? "How it showed up." : "Why it’s wrong."}</b> {last.explanation}
              </p>
              {card.correction && (
                <p>
                  <b>The right idea.</b> {card.correction}
                </p>
              )}
            </div>
          )}
          <ol className="weak-detail__history">
            {[...card.history].reverse().map((h) => (
              <li key={h.roundId + h.at}>
                <p className="label">
                  {date(h.at)} · {h.source === "autopsy" ? "Your marked work" : h.topic} · <span data-outcome={h.outcome}>{h.source === "autopsy" ? "Confirmed in an autopsy" : OUTCOME[h.outcome]}</span>
                  {h.confidence ? ` at ${Math.round(h.confidence * 100)}%` : ""}
                </p>
                <p className="weak-detail__sab">{h.sabotaged}</p>
                <p className="weak-detail__orig">{h.original}</p>
                {h.source !== "autopsy" && (
                  <Link href={`/results/${h.roundId}`} className="label underline underline-offset-4">
                    Read the verdict
                  </Link>
                )}
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--paper-edge)] pt-5">
            <button
              type="button"
              className="btn btn--pen"
              onClick={() => {
                const topic = prepareDrill([card]);
                ref.current?.close();
                navigate("/play", `DRILL · ${topic.toUpperCase()}`);
              }}
            >
              Drill this
            </button>
            <p className="text-[14.5px] text-ink-soft">A new case on {card.topics[0]}, with this misconception planted again if the topic allows.</p>
          </div>
        </div>
      )}
    </dialog>
  );
}
