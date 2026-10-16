/** "Photosynthesis — light-dependent reactions" → "photosynthesis-light-dependent-reactions" */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "topic";
}

export function newId(prefix: string): string {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rand}`;
}
