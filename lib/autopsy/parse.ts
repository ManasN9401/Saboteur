// Intake for the Wrong Answer Autopsy (V07-03): turn whatever a student pastes (labelled blocks,
// numbered lists, tables copied from a document or spreadsheet, one line per answer) into items of
// question, their answer and the correct answer. Pure, so every messy format can be tested.

export interface IntakeItem {
  id: string;
  question: string;
  answer: string;
  correct: string;
}

export interface Intake {
  items: IntakeItem[];
  /** Items whose answer already matches the correct one: nothing to examine. */
  matching: IntakeItem[];
  /** Items with no correct answer given: the page asks for one. */
  incomplete: IntakeItem[];
  format: "table" | "labelled" | "blocks" | "lines" | "none";
}

type Field = "question" | "answer" | "correct";

const MAX_ITEMS = 20;
const MAX_FIELD = 1200;

// Labels, longest first so "correct answer" wins over "answer".
const LABELS: [RegExp, Field][] = [
  [/^(?:correct|right|model|expected|actual|true)\s+answers?\b/i, "correct"],
  [/^(?:answer\s+key|mark\s*scheme|markscheme|key|solution|teacher(?:'s)?(?:\s+answer)?|should\s+(?:be|have\s+been)|correction|correct(?:ion)?|ans(?:wer)?\s*key)\b/i, "correct"],
  [/^(?:my|student(?:'s)?|your|their|given)\s+(?:answer|response|working)s?\b/i, "answer"],
  [/^(?:i\s+(?:wrote|put|said|answered)|mine|response|attempt|student|a\d*|answer\s*\d*|ans\d*)\b/i, "answer"],
  [/^(?:q(?:uestion)?\s*\.?\s*\d*[a-z]?|problem\s*\d*|item\s*\d*)\b/i, "question"],
];
const SEP = /^\s*[:.)\-–—=]\s*/;
const BULLET = /^\s*(?:[-*•·◦]|\(?\d{1,2}[a-z]?[.)]|\(?[a-z][.)](?=\s))\s+/i;
// × is left alone: it's usually a multiplication sign.
const MARKS = /\s*[✗✘✕❌✓✔☑]\s*/gu;
// A teacher's verdict tacked on the end ("… wrong"), not the word inside an answer.
const VERDICT = /\s*[-–—(]?\s*\b(?:wrong|incorrect)\b[.)]?\s*$/i;
const INLINE_CORRECT = /\s*\((?:correct(?:\s+answer)?|should\s+be|answer|ans|key|actually)\s*[:=]?\s*([^)]+)\)\s*$/i;

const clean = (s: string) =>
  s
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, MAX_FIELD);
const unmark = (s: string) => clean(s.replace(MARKS, " ").replace(VERDICT, ""));
const same = (a: string, b: string) => {
  const n = (s: string) => s.toLowerCase().replace(/[\s.,;:!?'"`()[\]]+/g, "").replace(/×/g, "x");
  return !!a && !!b && n(a) === n(b);
};

/** Which field a line starts with, and the rest of it, if it starts with a label. */
function label(line: string): { field: Field; rest: string } | null {
  const body = line.trimStart().replace(/^[-*•]\s+/, "");
  for (const [re, field] of LABELS) {
    const m = body.match(re);
    if (!m) continue;
    const after = body.slice(m[0].length);
    // A label is followed by a separator ("Answer: 4", "Q1. Why…", "Q3) …"), not by more words of a sentence.
    if (SEP.test(after) || (field === "question" && /^\s*\d/.test(m[0].slice(1)) && /^\s/.test(after))) return { field, rest: after.replace(SEP, "") };
  }
  return null;
}

/** "Answer: 4. Correct: 5" on one line: split at each inline label. */
function inlineLabels(line: string): { field: Field; text: string }[] | null {
  const re = /\b(my answer|your answer|i wrote|answer|correct answer|correct|should be|answer key|key|mark scheme)\s*[:=]\s*/gi;
  const hits = [...line.matchAll(re)];
  if (hits.length < 1) return null;
  const parts: { field: Field; text: string }[] = [];
  const head = line.slice(0, hits[0].index).trim();
  if (head) parts.push({ field: "question", text: head });
  hits.forEach((h, i) => {
    const text = line.slice(h.index! + h[0].length, i + 1 < hits.length ? hits[i + 1].index : undefined).trim().replace(/[.;,]$/, "");
    const word = h[1].toLowerCase();
    const field: Field = /correct|should|key|scheme/.test(word) ? "correct" : "answer";
    parts.push({ field, text });
  });
  return parts.length >= 2 ? parts : null;
}

function finish(raw: Omit<IntakeItem, "id">[], format: Intake["format"]): Intake {
  const all = raw
    .map((r) => {
      let answer = r.answer;
      let correct = r.correct;
      // "x = 4 ✗ (should be 3)": the correct answer in brackets after the student's.
      const m = answer.match(INLINE_CORRECT);
      if (m && !correct) {
        correct = m[1];
        answer = answer.slice(0, m.index);
      }
      return { question: clean(r.question).replace(/^\(?\d{1,2}[a-z]?[.)]\s+/i, ""), answer: unmark(answer), correct: unmark(correct) };
    })
    .filter((r) => r.question || r.answer)
    .slice(0, MAX_ITEMS)
    .map((r, i) => ({ id: `a${i + 1}`, ...r }));
  const matching = all.filter((i) => same(i.answer, i.correct));
  const incomplete = all.filter((i) => !i.correct || !i.answer);
  const items = all.filter((i) => !matching.includes(i) && !incomplete.includes(i));
  return { items, matching, incomplete, format: all.length ? format : "none" };
}

/* ---------- Tables: markdown, tab-separated (copied from a document or spreadsheet), CSV ---------- */

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"' && quoted) {
      cur += '"';
      i++;
    } else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function headerMap(cells: string[]): Record<Field, number> | null {
  const find = (re: RegExp) => cells.findIndex((c) => re.test(c.trim()));
  const correct = find(/^(?:correct|right|model|expected)|key|scheme|solution|should/i);
  const answer = cells.findIndex((c, i) => i !== correct && /answer|response|wrote|\bput\b|mine|attempt|student|\bmy\b|\byour\b/i.test(c));
  const question = cells.findIndex((c, i) => i !== correct && i !== answer && /question|^q\b|problem|item|prompt/i.test(c.trim()));
  if (correct < 0 || answer < 0) return null;
  return { question: question < 0 ? [0, 1, 2].find((i) => i !== correct && i !== answer)! : question, answer, correct };
}

function table(lines: string[]): Intake | null {
  let rows: string[][] | null = null;
  if (lines.filter((l) => /^\s*\|.*\|\s*$/.test(l)).length >= 2) {
    rows = lines
      .filter((l) => /^\s*\|/.test(l) && !/^\s*\|?[\s:|-]+\|?\s*$/.test(l))
      .map((l) => l.trim().replace(/^\||\|$/g, "").split("|"));
  } else if (lines.filter((l) => (l.match(/\t/g) ?? []).length >= 2).length >= Math.max(2, lines.length * 0.6)) {
    rows = lines.filter((l) => l.includes("\t")).map((l) => l.split("\t"));
  } else if (lines.length >= 2 && headerMap(splitCsv(lines[0])) && splitCsv(lines[0]).length >= 3) {
    rows = lines.map(splitCsv);
  }
  if (!rows || rows.length < 1) return null;
  const header = headerMap(rows[0]);
  const body = header ? rows.slice(1) : rows;
  const map = header ?? { question: 0, answer: 1, correct: 2 };
  if (!body.every((r) => r.length >= 3)) return null;
  return finish(
    body.map((r) => ({ question: r[map.question] ?? "", answer: r[map.answer] ?? "", correct: r[map.correct] ?? "" })),
    "table",
  );
}

/* ---------- Labelled lines: "Q:", "My answer:", "Correct:", in blocks or numbered lists ---------- */

function labelled(lines: string[]): Intake | null {
  const items: Record<Field, string>[] = [];
  let cur: Record<Field, string> | null = null;
  let last: Field | null = null;
  let labels = 0;
  const start = (): Record<Field, string> => {
    const item = { question: "", answer: "", correct: "" };
    items.push(item);
    return item;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      last = null;
      continue;
    }
    const inline = inlineLabels(line.replace(BULLET, ""));
    const l = label(line);
    if (l) {
      labels++;
      // A question label, or a field that's already filled, starts the next item.
      if (!cur || l.field === "question" || cur[l.field]) cur = start();
      const sub = l.field === "question" ? inlineLabels(l.rest) : null;
      if (sub) {
        for (const p of sub) cur[p.field] = p.text;
        last = sub.at(-1)!.field;
        labels += sub.length - 1;
      } else {
        cur[l.field] = l.rest;
        last = l.field;
      }
    } else if (inline) {
      labels += inline.length;
      if (!cur || BULLET.test(line) || cur.answer || cur.correct) cur = start();
      for (const p of inline) cur[p.field] = cur[p.field] ? `${cur[p.field]} ${p.text}` : p.text;
      last = inline.at(-1)!.field;
    } else if (BULLET.test(line) && (!cur || cur.answer || cur.correct || !last)) {
      // A numbered or bulleted line with no label: the next question.
      cur = start();
      cur.question = line.replace(BULLET, "");
      last = "question";
    } else if (cur && last) {
      cur[last] = `${cur[last]} ${line.trim()}`;
    } else {
      cur = start();
      cur.question = line.trim();
      last = "question";
    }
  }
  if (labels < 2 || !items.some((i) => i.answer && (i.correct || INLINE_CORRECT.test(i.answer)))) return null;
  return finish(items, "labelled");
}

/* ---------- No labels at all ---------- */

/** Blocks of three lines (question, answer, correct) separated by blank lines. */
function blocks(text: string): Intake | null {
  const bs = text
    .split(/\n\s*\n/)
    .map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((b) => b.length);
  if (bs.length < 1 || !bs.every((b) => b.length === 3)) return null;
  return finish(bs.map(([question, answer, correct]) => ({ question: question.replace(BULLET, ""), answer, correct })), "blocks");
}

/** One answer per line: "question | my answer | correct", or with dashes or arrows between. */
function separated(lines: string[]): Intake | null {
  const seps = [/\s+\|\s+/, /\s+[—–]\s+/, /\s+->\s+|\s+→\s+/, /\s+-\s+/];
  const nonEmpty = lines.filter((l) => l.trim());
  for (const sep of seps) {
    const parts = nonEmpty.map((l) => l.replace(BULLET, "").split(sep));
    if (parts.length && parts.every((p) => p.length === 3)) return finish(parts.map(([question, answer, correct]) => ({ question, answer, correct })), "lines");
  }
  return null;
}

export function parseIntake(text: string): Intake {
  const normal = text.replace(/\r\n?/g, "\n").replace(/ /g, " ").trim();
  if (!normal) return { items: [], matching: [], incomplete: [], format: "none" };
  const lines = normal.split("\n");
  return table(lines) ?? labelled(lines) ?? blocks(normal) ?? separated(lines) ?? { items: [], matching: [], incomplete: [], format: "none" };
}
