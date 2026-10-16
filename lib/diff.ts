// Word-level diff between the sabotaged and the original sentence, for the reveal screen.

export type DiffPart = { kind: "same" | "removed" | "added"; text: string };

const tokenize = (s: string) => s.match(/\s+|[^\s]+/g) ?? [];

/** Longest-common-subsequence diff over words (whitespace kept as its own token). */
export function wordDiff(from: string, to: string): DiffPart[] {
  const a = tokenize(from);
  const b = tokenize(to);
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const parts: DiffPart[] = [];
  const push = (kind: DiffPart["kind"], text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.kind === kind) last.text += text;
    else parts.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) push("removed", a[i++]);
    else push("added", b[j++]);
  }
  while (i < a.length) push("removed", a[i++]);
  while (j < b.length) push("added", b[j++]);
  return mergeIslands(parts);
}

/**
 * A lone shared space or short word between two edits reads badly ("~~warms~~ cools ~~and~~ and").
 * Fold such islands into the surrounding edit so each change shows as one swap.
 */
function mergeIslands(parts: DiffPart[]): DiffPart[] {
  // Mark short shared islands between two edits as part of both sides of the swap.
  const marked: DiffPart[] = [];
  parts.forEach((p, k) => {
    const prev = parts[k - 1];
    const next = parts[k + 1];
    const island = p.kind === "same" && prev && prev.kind !== "same" && next && next.kind !== "same" && p.text.trim().length <= 3;
    if (island) marked.push({ kind: "removed", text: p.text }, { kind: "added", text: p.text });
    else marked.push(p);
  });
  // Show each run of edits as one removal followed by one addition.
  const out: DiffPart[] = [];
  let run: DiffPart[] = [];
  const flush = () => {
    const removed = run.filter((x) => x.kind === "removed").map((x) => x.text).join("");
    const added = run.filter((x) => x.kind === "added").map((x) => x.text).join("");
    if (removed) out.push({ kind: "removed", text: removed });
    if (added) out.push({ kind: "added", text: added });
    run = [];
  };
  for (const p of marked) {
    if (p.kind === "same") {
      flush();
      const last = out[out.length - 1];
      if (last && last.kind === "same") last.text += p.text;
      else out.push({ ...p });
    } else run.push(p);
  }
  flush();
  return out;
}
