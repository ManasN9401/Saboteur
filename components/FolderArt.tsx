import type { CSSProperties } from "react";

/**
 * A real manila folder (public/assets/folder, cut by scripts/assets/folder_kit.py), built from
 * pieces so the tab can sit anywhere along the top edge. The plain edge runs unbroken under the
 * whole width and the corners and tab are laid on top of it, so pieces never meet edge to edge
 * (side-by-side scaled images leave hairline seams). `tabAt` runs from 0 (left) to 1 (right);
 * `foot` adds the folder's bottom edge, for the last folder in a stack. Decorative only.
 */
export function FolderArt({ tabAt, label, foot = false }: { tabAt: number; label?: string; foot?: boolean }) {
  const p = Math.min(1, Math.max(0, tabAt));
  return (
    <span className="folder-art" aria-hidden="true" style={{ "--tab-at": p } as CSSProperties}>
      <span className="folder-art__top">{label && <b>{label}</b>}</span>
      {foot && <span className="folder-art__foot" />}
    </span>
  );
}
