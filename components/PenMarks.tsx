// Hand-drawn marks shared by the desk calendar, the dossier's record and the round-end strip.

/** Deterministic wobble so a row of marks looks hand-made but never changes between renders. */
const wobble = (seed: number, n: number) => ((Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453) % 1) * 3;

/** A pen cross, slightly different every time. */
export function Cross({ seed, className }: { seed: number; className?: string }) {
  const j = (n: number) => wobble(seed, n);
  return (
    <svg viewBox="0 0 40 32" className={className} aria-hidden="true">
      <path d={`M${7 + j(1)} ${5 + j(2)} L${33 + j(3)} ${27 + j(4)}`} />
      <path d={`M${32 + j(5)} ${6 + j(6)} L${8 + j(7)} ${26 + j(8)}`} />
    </svg>
  );
}

/** A loose pen ring, for today. */
export function Ring({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 32" className={className} aria-hidden="true">
      <path d="M6 18 C 4 7, 22 3, 33 7 S 39 24, 28 28 S 6 30, 5 17 S 14 5, 24 6" />
    </svg>
  );
}

/** A small rubber-stamped snowflake: a day a streak freeze covered. */
export function Snowflake({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <g strokeLinecap="round">
        <path d="M16 4v24M5.6 10l20.8 12M5.6 22l20.8-12" />
        <path d="M13 6.5l3 2.5 3-2.5M13 25.5l3-2.5 3 2.5M6.5 13.6l3.7-1.2-.6-3.8M25.5 18.4l-3.7 1.2.6 3.8M6.5 18.4l3.7 1.2-.6 3.8M25.5 13.6l-3.7-1.2.6-3.8" />
      </g>
    </svg>
  );
}
