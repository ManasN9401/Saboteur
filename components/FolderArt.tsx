import type { CSSProperties } from "react";

/**
 * A real manila folder (public/assets/folder, cut by scripts/assets/folder_kit.py), built from
 * pieces so the tab can sit anywhere along the top edge. The plain edge runs unbroken under the
 * whole width and the corners and tab are laid on top of it, so pieces never meet edge to edge
 * (side-by-side scaled images leave hairline seams). `tabAt` runs from 0 (left) to 1 (right).
 * Below the band the body carries on (side edges and plain fill, repeating) for as long as CSS says
 * (`--body-h`), so in a stack each folder really lies under the ones in front. Decorative only.
 */
export function FolderArt({ tabAt, label }: { tabAt: number; label?: string }) {
  const p = Math.min(1, Math.max(0, tabAt));
  return (
    <span className="folder-art" aria-hidden="true" style={{ "--tab-at": p } as CSSProperties}>
      <span className="folder-art__top">{label && <b>{label}</b>}</span>
      <span className="folder-art__body" />
    </span>
  );
}
