"use client"; // error boundaries are Client Components

import { useEffect } from "react";
import { PAINT_SCRIPT } from "@/lib/prefs";
import "./globals.css";

/**
 * When the root layout itself fails, this replaces it, so it brings its own document: the stylesheet,
 * the reader's theme (the same paint script as the layout) and the bare desk photo. Links are plain
 * anchors, so leaving reloads the app from scratch rather than through the broken one.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        <title>Something broke · Saboteur</title>
        <script dangerouslySetInnerHTML={{ __html: PAINT_SCRIPT }} />
      </head>
      <body>
        <div className="desk" aria-hidden="true">
          <div className="desk__photo" />
          <div className="desk__scrim" />
        </div>
        <main className="dead-end">
          <section className="paper dead-end__sheet" aria-labelledby="dead-end-title">
            <div className="paper-head label">
              <span>Error 500 · Our fault</span>
              {error.digest && <span>Ref {error.digest}</span>}
            </div>
            <h1 id="dead-end-title" className="display dead-end__title">
              Saboteur couldn’t start.
            </h1>
            <p className="dead-end__body">Your progress is saved on this device, so nothing is lost. Try again, or reload the desk.</p>
            <div className="dead-end__actions">
              <button type="button" className="btn btn--pen" onClick={() => retry()}>
                Try again
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload, past the broken layout */}
              <a href="/" className="btn btn--ghost">
                Reload the desk
              </a>
            </div>
            <span className="stamp-mark dead-end__stamp" aria-hidden="true">
              Damaged
              <small>In transit</small>
            </span>
          </section>
        </main>
      </body>
    </html>
  );
}
