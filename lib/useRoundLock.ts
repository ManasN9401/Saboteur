"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Message = { type: "hello" | "here" | "take" | "bye"; roundId: string; tab: string };

/**
 * One tab per case (QoL Q1). Tabs on the same case find each other over a BroadcastChannel; the newest
 * one takes over and the others go quiet, so the same flags can't be submitted twice.
 */
export function useRoundLock(roundId: string) {
  const [elsewhere, setElsewhere] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const [tab] = useState(() => Math.random().toString(36).slice(2));

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel("saboteur-rounds");
    channel.current = ch;
    const send = (type: Message["type"]) => ch.postMessage({ type, roundId, tab } satisfies Message);
    ch.onmessage = (e: MessageEvent<Message>) => {
      const m = e.data;
      if (m.roundId !== roundId || m.tab === tab) return;
      // A newer tab opened this case: it takes over, this one steps back.
      if (m.type === "hello" || m.type === "take") setElsewhere(true);
      if (m.type === "bye") setElsewhere(false);
    };
    send("hello");
    const bye = () => send("bye");
    window.addEventListener("pagehide", bye);
    return () => {
      bye();
      window.removeEventListener("pagehide", bye);
      ch.close();
      channel.current = null;
    };
  }, [roundId, tab]);

  const takeOver = useCallback(() => {
    channel.current?.postMessage({ type: "take", roundId, tab } satisfies Message);
    setElsewhere(false);
  }, [roundId, tab]);

  return { elsewhere, takeOver };
}
