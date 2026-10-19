import Link from "next/link";

interface Props {
  /** Small line above the headline, e.g. "Error 404 · No such file". */
  code: string;
  title: string;
  /** What happened and what's safe, in a sentence or two. */
  body: string;
  /** The rubber stamp across the sheet. */
  stamp: string;
  stampNote?: string;
  /** A note in pen at the foot of the sheet. */
  note?: string;
  /** Shown small, for matching a server log (an error's digest). */
  reference?: string;
  /** Buttons, links or both; a link back to the desk is always added. */
  children?: React.ReactNode;
}

/**
 * The page for when something goes wrong (404, 500): a sheet on the desk with a rubber stamp across it,
 * in the same paper, type and stamps as the rest of the app, and always a way back to the desk.
 */
export function DeadEnd({ code, title, body, stamp, stampNote, note, reference, children }: Props) {
  return (
    <main className="dead-end">
      <section className="paper dead-end__sheet rise" aria-labelledby="dead-end-title">
        <div className="paper-head label">
          <span>{code}</span>
          {reference && <span>Ref {reference}</span>}
        </div>
        <h1 id="dead-end-title" className="display dead-end__title">
          {title}
        </h1>
        <p className="dead-end__body">{body}</p>
        <div className="dead-end__actions">
          {children}
          <Link href="/" className="btn btn--ghost">
            Back to the desk
          </Link>
        </div>
        {note && <p className="hand dead-end__note">{note}</p>}
        <span className="stamp-mark dead-end__stamp" aria-hidden="true">
          {stamp}
          {stampNote && <small>{stampNote}</small>}
        </span>
      </section>
    </main>
  );
}
