import type { Round } from "@/lib/schemas";

/** Offline rounds say where their text came from (and credit Wikipedia, as its licence requires). */
export function RoundSource({ round }: { round: Round }) {
  if (round.engine !== "offline" || !round.source) return null;
  return (
    <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.08em] text-desk-soft">
      Offline round · rule-based errors · Source:{" "}
      {round.source.url ? (
        <a href={round.source.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
          {round.source.label}
        </a>
      ) : (
        round.source.label
      )}
      {round.source.url?.includes("wikipedia.org") && <span className="normal-case tracking-normal"> (CC BY-SA 4.0)</span>}
    </p>
  );
}
