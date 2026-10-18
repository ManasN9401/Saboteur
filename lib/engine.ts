import "server-only";
import { buildDaily, isDailyDate } from "./daily";
import { FriendlyError } from "./errors";
import { generateOffline } from "./offline/generate";
import { isMock, LLMError } from "./llm";
import { generateRound, type Progress } from "./pipeline";
import { router } from "./router/router";
import type { GenerateRequest, PlantedError, Round } from "./schemas";

export type Engine = "llm" | "offline";

/**
 * Which engine builds rounds. Offline (rules, no language model) is used when forced with
 * SABOTEUR_ENGINE=offline or when no API key is configured. LLM rounds also fall back to it
 * if the AI turns out to be unreachable.
 */
export function engineMode(): { engine: Engine; reason: string } {
  if (process.env.SABOTEUR_ENGINE === "offline") return { engine: "offline", reason: "Offline mode is switched on." };
  if (isMock()) return { engine: "llm", reason: "Connected to the stand-in AI (mock mode)." };
  const providers = router().providers();
  if (providers.length) {
    const names = providers.map((p) => p.name);
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
    return { engine: "llm", reason: names.length === 1 && names[0] === "Anthropic" ? "Connected to Claude." : `Connected through ${list}.` };
  }
  return { engine: "offline", reason: "No AI is connected." };
}

export async function buildRound(req: GenerateRequest, onProgress: Progress): Promise<{ round: Round; errors: PlantedError[] }> {
  if (req.daily) {
    if (!isDailyDate(req.daily)) throw new FriendlyError("That daily case isn't open yet.");
    onProgress("write", 0, "Opening today's case file…");
    return buildDaily(req.daily);
  }
  if (req.engine === "offline" || engineMode().engine === "offline") return generateOffline(req, onProgress);
  try {
    const result = await generateRound(req, onProgress);
    return { ...result, round: { ...result.round, engine: "llm" } };
  } catch (err) {
    if (!(err instanceof LLMError && err.unavailable)) throw err;
    console.warn("[engine] AI unavailable, switching to offline:", err.message);
    onProgress("write", 1, "The AI isn't reachable. Switching to offline mode…");
    return generateOffline(req, onProgress);
  }
}
