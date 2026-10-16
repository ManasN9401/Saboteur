// Where offline rounds get their (correct) text: the student's notes, the built-in library, or Wikipedia.
import { FriendlyError } from "../errors";
import { findLibraryEntry, LIBRARY, type LibraryEntry } from "./library";
import { notesToSentences, selectSentences, splitSentences } from "./sentences";

export interface SourceText {
  sentences: string[];
  label: string;
  url?: string;
  library?: LibraryEntry;
}

export class SourceError extends FriendlyError {}

const MIN_SENTENCES = 6;
const UA = "SaboteurStudyApp/0.1 (educational hackathon project)";

/* ---------- Wikipedia ---------- */

export function parseSearch(json: unknown): string | null {
  const hits = (json as { query?: { search?: { title?: string }[] } })?.query?.search;
  return hits?.[0]?.title ?? null;
}

export function parseExtract(json: unknown): { title: string; text: string } | null {
  const pages = (json as { query?: { pages?: Record<string, { title?: string; extract?: string; missing?: string }> } })?.query?.pages;
  const page = pages && Object.values(pages)[0];
  if (!page || page.missing !== undefined || !page.extract) return null;
  return { title: page.title ?? "", text: page.extract };
}

/** Wikipedia prose with pronunciations, headings and dangling parentheses removed. */
export function cleanWikiText(text: string): string {
  return text
    .split("\n")
    .filter((line) => line.trim() && !/^=+.*=+$/.test(line.trim()))
    .join(" ")
    .replace(/\s*\((?:[^()]*(?:listen|pronounced|\/|ˈ|ː)[^()]*)\)/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function getJSON(url: string, timeoutMs: number) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fromWikipedia(topic: string): Promise<SourceText | null> {
  const api = "https://en.wikipedia.org/w/api.php";
  try {
    const title = parseSearch(await getJSON(`${api}?action=query&list=search&srlimit=1&format=json&srsearch=${encodeURIComponent(topic)}`, 5000));
    if (!title) return null;
    const page = parseExtract(
      await getJSON(`${api}?action=query&prop=extracts&explaintext=1&exsectionformat=plain&redirects=1&format=json&titles=${encodeURIComponent(title)}`, 6000),
    );
    if (!page) return null;
    // Use the opening of the article: the lead plus the start of the first section.
    const sentences = selectSentences(splitSentences(cleanWikiText(page.text)).slice(0, 40), 14);
    if (sentences.length < MIN_SENTENCES) return null;
    return { sentences, label: `Wikipedia: ${page.title}`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}` };
  } catch {
    return null; // offline, blocked or slow: fall through to the next source
  }
}

/* ---------- Choosing a source ---------- */

export async function findSource(topic: string, notes?: string): Promise<SourceText> {
  if (notes?.trim()) {
    const sentences = selectSentences(notesToSentences(notes), 14);
    if (sentences.length >= MIN_SENTENCES) return { sentences, label: "Your notes" };
    throw new SourceError(`Your notes gave only ${sentences.length} usable sentences. Paste at least ${MIN_SENTENCES} full sentences, or clear the notes to use a built-in topic.`);
  }
  const library = findLibraryEntry(topic);
  if (library) return { sentences: library.sentences, label: `Built-in topic: ${library.title}`, library };
  const wiki = await fromWikipedia(topic);
  if (wiki) return wiki;
  throw new SourceError(
    `Without the AI, Saboteur needs a source it can trust. Paste your notes (6+ sentences), or pick one of the ${LIBRARY.length} built-in topics, such as ${LIBRARY.slice(0, 4).map((e) => e.title.toLowerCase()).join(", ")} or ${LIBRARY[4].title.toLowerCase()}.`,
  );
}
