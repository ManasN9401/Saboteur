"use client";

import Link from "next/link";
import { useRounds } from "@/lib/useStore";
import { useRedactedNavigate } from "./RedactionTransition";

export function StartButton({ children, className = "btn btn--pen" }: { children: React.ReactNode; className?: string }) {
  const navigate = useRedactedNavigate();
  return (
    <button type="button" className={className} onClick={() => navigate("/play", "NEW CASE FILE")}>
      {children}
    </button>
  );
}

/** Every saved case, newest first. */
export function CaseArchive() {
  const all = useRounds();
  if (all === undefined) return <div className="min-h-[40vh]" aria-busy="true" />;
  const rounds = Object.values(all).sort((a, b) => b.round.createdAt.localeCompare(a.round.createdAt));
  if (!rounds.length) {
    return (
      <div className="paper max-w-md px-6 py-6">
        <p className="mb-4 text-[17px] text-ink-soft">No case files yet.</p>
        <StartButton>Open a new case</StartButton>
      </div>
    );
  }
  return (
    <section aria-label="Case files">
      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {rounds.map(({ round, result }) => (
          <li key={round.id}>
            <Link href={result ? `/results/${round.id}` : `/play/${round.id}`} className="paper paper--manila block px-5 py-4 text-ink no-underline transition-transform hover:-translate-y-0.5">
              <p className="label mb-1">
                {round.difficulty} · {new Date(round.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </p>
              <p className="text-[18px] font-semibold leading-snug" style={{ fontFamily: "var(--font-display)" }}>
                {round.topic}
              </p>
              <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.06em] text-ink-soft">
                {result ? `Score ${result.score} / ${result.maxScore}` : "In progress · continue"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
