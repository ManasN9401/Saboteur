// Undo and redo for a round's flags (QoL Q3). Pure, so it is easy to test. Typing in one correction
// box is one step, not one step per keystroke: edits with the same `key` merge into the last entry.
import type { Flag } from "./schemas";

export const HISTORY_LIMIT = 30;

export interface FlagHistory {
  past: Flag[][];
  present: Flag[];
  future: Flag[][];
  /** What the last change was, so a run of the same kind of change merges. */
  lastKey: string | null;
}

export type HistoryAction = { type: "set"; flags: Flag[]; key?: string } | { type: "undo" } | { type: "redo" } | { type: "reset"; flags: Flag[] };

export const initHistory = (flags: Flag[]): FlagHistory => ({ past: [], present: flags, future: [], lastKey: null });

export function historyReducer(h: FlagHistory, a: HistoryAction): FlagHistory {
  switch (a.type) {
    case "set": {
      if (a.key && a.key === h.lastKey) return { ...h, present: a.flags, future: [] };
      return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: a.flags, future: [], lastKey: a.key ?? null };
    }
    case "undo": {
      if (!h.past.length) return h;
      return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], lastKey: null };
    }
    case "redo": {
      if (!h.future.length) return h;
      return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: h.future[0], future: h.future.slice(1), lastKey: null };
    }
    case "reset":
      return initHistory(a.flags);
  }
}
