// One queue for every passing message (QoL Q9): badges earned, profile switched, file imported.
export interface Toast {
  id: number;
  text: string;
  /** An optional picture, e.g. the badge just earned. */
  art?: string;
  tone?: "info" | "good" | "warn";
}

const NONE: Toast[] = [];
let toasts: Toast[] = NONE;
let next = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string, opts: Omit<Toast, "id" | "text"> & { ms?: number } = {}) {
  const t: Toast = { id: next++, text, art: opts.art, tone: opts.tone ?? "info" };
  toasts = [...toasts, t].slice(-4);
  emit();
  window.setTimeout(() => dismiss(t.id), opts.ms ?? 4200);
}

export function dismiss(id: number) {
  const before = toasts.length;
  toasts = toasts.filter((t) => t.id !== id);
  if (toasts.length !== before) emit();
}

export const toastStore = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  snapshot: () => toasts,
  server: () => NONE,
};
