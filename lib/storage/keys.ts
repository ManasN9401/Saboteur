// The v2 key scheme (docs/roadmap/00-principles/data-and-storage.md). Everything a player owns sits
// under their own `p:<id>:` prefix, so one profile can never read another's data by accident.
export const PREFIX = "saboteur:v2:";
export const V1_PREFIX = "saboteur:v1:";

export const KEYS = {
  meta: `${PREFIX}meta`,
  device: `${PREFIX}device`,
  profilePrefix: (id: string) => `${PREFIX}p:${id}:`,
  profile: (id: string) => `${PREFIX}p:${id}:profile`,
  rounds: (id: string) => `${PREFIX}p:${id}:rounds`,
  stats: (id: string) => `${PREFIX}p:${id}:stats`,
  settings: (id: string) => `${PREFIX}p:${id}:settings`,
  topics: (id: string) => `${PREFIX}p:${id}:topics`,
  notes: (id: string) => `${PREFIX}p:${id}:notes`,
  draft: (id: string, roundId: string) => `${PREFIX}p:${id}:draft:${roundId}`,
};

/** sessionStorage: things that last for one tab's visit. */
export const SESSION = {
  autostart: `${PREFIX}autostart`,
  /** A round asked to target misconceptions ("Drill this", the review case), waiting for the setup page. */
  drill: `${PREFIX}drill`,
  /** The guest profile created in this browser session (any other guest is stale and gets wiped). */
  guest: `${PREFIX}guest`,
  delta: (roundId: string) => `${PREFIX}delta:${roundId}`,
  titleSeen: `${V1_PREFIX}title-seen`,
};

export const V1_KEYS = {
  rounds: `${V1_PREFIX}rounds`,
  settings: `${V1_PREFIX}settings`,
  draftPrefix: `${V1_PREFIX}draft:`,
};
