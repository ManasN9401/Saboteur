"use client";

import { useEffect, useRef } from "react";

const KEYS: [string, string][] = [
  ["J  /  K", "Next / previous sentence"],
  ["F  or  Enter", "Flag or unflag; a new flag opens its fix box"],
  ["Enter", "In a fix box: save it and go back to the passage"],
  ["E", "Edit the fix for the current flag again"],
  ["1 – 6", "Confidence 50% – 100% for the current flag"],
  ["Ctrl + Z", "Undo (Ctrl + Shift + Z to redo)"],
  ["Ctrl + Enter", "Submit your flags"],
  ["?", "This sheet"],
];

/** The `?` cheat sheet for keyboard play (QoL Q2). */
export function KeyboardHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="paper m-auto w-[min(92vw,480px)] p-0 backdrop:bg-black/50"
      aria-labelledby="keys-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="p-6 sm:p-7">
        <p className="label mb-1">Keyboard</p>
        <h2 id="keys-title" className="display mb-4 text-[30px]">
          Play without a mouse
        </h2>
        <dl className="keys">
          {KEYS.map(([k, v]) => (
            <div key={v}>
              <dt>
                <kbd>{k}</kbd>
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="btn btn--ghost btn--small mt-5" onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  );
}
