import { wordDiff } from "@/lib/diff";

/** Sabotaged sentence → original: removed words struck through in red, restored words in green. */
export function RevealDiff({ sabotaged, original }: { sabotaged: string; original: string }) {
  return (
    <p className="diff text-[17.5px] leading-relaxed">
      <span className="sr-only">Change from the sabotaged sentence to the original: </span>
      {wordDiff(sabotaged, original).map((part, i) =>
        part.kind === "same" ? (
          <span key={i}>{part.text}</span>
        ) : part.kind === "removed" ? (
          <del key={i}>
            <span className="sr-only">removed: </span>
            {part.text}
          </del>
        ) : (
          <ins key={i}>
            <span className="sr-only">original: </span>
            {part.text}
          </ins>
        ),
      )}
    </p>
  );
}
