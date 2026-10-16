import "server-only";
import { ROUND_TTL_MS } from "./config";
import type { PlantedError, Round } from "./schemas";

/**
 * Planted errors stay on the server until the student submits. This is an in-memory map, so a
 * server restart (or a second serverless instance) loses open rounds; the grade route then asks the
 * student to start a new round. Fine for a hackathon; swap for a database or signed token later.
 */
interface StoredRound {
  round: Round;
  errors: PlantedError[];
  expiresAt: number;
}

const globalStore = globalThis as unknown as { __saboteurRounds?: Map<string, StoredRound> };
const rounds = (globalStore.__saboteurRounds ??= new Map());

function sweep(now = Date.now()) {
  for (const [id, entry] of rounds) if (entry.expiresAt < now) rounds.delete(id);
}

export function saveRound(round: Round, errors: PlantedError[]) {
  sweep();
  rounds.set(round.id, { round, errors, expiresAt: Date.now() + ROUND_TTL_MS });
}

export function getRound(id: string): StoredRound | undefined {
  sweep();
  return rounds.get(id);
}
