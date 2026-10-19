"use client"; // error boundaries are Client Components

import { useEffect } from "react";
import { DeadEnd } from "@/components/DeadEnd";

/**
 * Something broke while showing a page (a 500). The desk, nav and settings still work around it. In
 * production the message is a generic one; the digest matches the server's log line.
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <DeadEnd
      code="Error 500 · Our fault"
      title="Something on our side broke."
      body="Your progress is saved on this device, so nothing is lost. Try again; if it keeps happening, go back to the desk and start from there."
      stamp="Damaged"
      stampNote="In transit"
      reference={error.digest}
    >
      <button type="button" className="btn btn--pen" onClick={() => retry()}>
        Try again
      </button>
    </DeadEnd>
  );
}
