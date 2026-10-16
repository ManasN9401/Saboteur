"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { reducedMotion } from "@/lib/prefs";

type Phase = "idle" | "cover" | "hold" | "reveal";
type Navigate = (href: string, label?: string) => void;

const RedactionContext = createContext<Navigate | null>(null);

const BAR_LABELS = ["CLASSIFIED", "", "EYES ONLY", "", "TRUST NOTHING", "", "FILE CLOSED"];
const COVER_MS = 420 + 6 * 40;
const REVEAL_MS = 500 + 6 * 40;

/**
 * Page transition: black redaction bars sweep across the screen, the route changes behind them,
 * then they pull away. Navigation still works instantly with reduced motion.
 */
export function RedactionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pathname, setPathname] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [label, setLabel] = useState("CLASSIFIED");
  const target = useRef<string | null>(null);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const navigate = useCallback<Navigate>(
    (href, nextLabel) => {
      const reduce = reducedMotion();
      if (reduce) {
        router.push(href);
        return;
      }
      clear();
      target.current = href;
      setLabel(nextLabel ?? "CLASSIFIED");
      setPhase("cover");
      timers.current.push(
        window.setTimeout(() => {
          setPhase("hold");
          router.push(href);
          // If the route never changes (same page), don't leave the screen covered.
          timers.current.push(window.setTimeout(() => setPhase((p) => (p === "hold" ? "reveal" : p)), 4000));
        }, COVER_MS),
      );
    },
    [router],
  );

  // The new page has rendered: pull the bars away.
  useEffect(() => {
    if (phase !== "hold" || !target.current || target.current.split(/[?#]/)[0] !== pathname) return;
    const t = window.setTimeout(() => setPhase("reveal"), 120);
    return () => window.clearTimeout(t);
  }, [pathname, phase]);

  useEffect(() => {
    if (phase !== "reveal") return;
    const t = window.setTimeout(() => {
      setPhase("idle");
      target.current = null;
    }, REVEAL_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => clear, []);

  return (
    <RedactionContext.Provider value={navigate}>
      {children}
      <Suspense fallback={null}>
        <PathWatcher onChange={setPathname} />
      </Suspense>
      <div className="redaction" data-phase={phase} aria-hidden="true">
        {BAR_LABELS.map((l, i) => (
          <i key={i} data-label={i === 0 ? label : l} style={{ transitionDelay: `${i * 40}ms` }} />
        ))}
      </div>
    </RedactionContext.Provider>
  );
}

/** Reports route changes. Kept in its own Suspense boundary so dynamic routes can still prerender. */
function PathWatcher({ onChange }: { onChange: (path: string) => void }) {
  const pathname = usePathname();
  useEffect(() => onChange(pathname), [pathname, onChange]);
  return null;
}

export function useRedactedNavigate(): Navigate {
  const navigate = useContext(RedactionContext);
  if (!navigate) throw new Error("useRedactedNavigate must be used inside RedactionProvider");
  return navigate;
}
