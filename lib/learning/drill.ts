// "Drill this" and the review case: set up a round that targets misconceptions, then open the setup page.
import { LEVELS } from "../config";
import { store } from "../store";
import type { Misconception } from "./schema";

/** Queue a targeted round on the topic where the first misconception was last seen. Returns the topic. */
export function prepareDrill(ms: Misconception[], review = false): string {
  const [first] = ms;
  const saved = store.getSettings();
  const topic = first.topics[0] ?? saved?.topic ?? first.label;
  store.saveSettings({
    topic,
    level: first.level ?? saved?.level ?? LEVELS[1],
    difficulty: saved?.difficulty ?? "subtle",
    // Notes saved for the topic keep the briefing grounded, as they did the first time.
    notes: store.getSavedNotes(topic) ?? "",
  });
  store.requestDrill({ targets: ms.slice(0, 3).map((m) => ({ key: m.key, label: m.label, errorType: m.errorType })), review });
  store.requestAutostart();
  return topic;
}
