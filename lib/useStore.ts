"use client";

import { useMemo, useSyncExternalStore } from "react";
import { activeId, boot } from "./profile/profiles";
import { DevicePrefsSchema, emptyStats, ProfileSchema, StatsSchema, type DevicePrefs, type Profile, type Stats } from "./profile/schema";
import { KEYS } from "./storage/keys";
import { getRaw, parse, subscribe } from "./storage/kv";
import { MetaSchema, TopicsSchema, type Topics } from "./storage/schemas";
import { parseRounds, roundsSnapshot, type RoundRecord } from "./store";

const noop = () => () => {};

/** False during server rendering and hydration, true once running in the browser. */
export function useIsClient() {
  return useSyncExternalStore(noop, () => true, () => false);
}

/** All saved rounds of the active profile, or undefined while the page is still rendering on the server. */
export function useRounds(): Record<string, RoundRecord> | undefined {
  const raw = useSyncExternalStore(subscribe, roundsSnapshot, () => undefined);
  return useMemo(() => (raw === undefined ? undefined : parseRounds(raw)), [raw]);
}

/** One saved round: undefined while loading, null if this browser doesn't have it. */
export function useRoundRecord(id: string): RoundRecord | null | undefined {
  const rounds = useRounds();
  return rounds === undefined ? undefined : (rounds[id] ?? null);
}

/** Raw value of one key, re-read whenever storage changes. Undefined on the server. */
function useRaw(key: () => string): string | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => {
      boot();
      return getRaw(key());
    },
    () => undefined,
  );
}

const SEP = "\u0000";

/** Every profile on this device, in menu order. */
export function useProfiles(): { profiles: Profile[]; activeId: string } | undefined {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      boot();
      const meta = getRaw(KEYS.meta) ?? "";
      const m = parse(meta, MetaSchema);
      return [meta, ...(m ? m.profileOrder.map((id) => getRaw(KEYS.profile(id)) ?? "") : [])].join(SEP);
    },
    () => undefined,
  );
  return useMemo(() => {
    if (raw === undefined) return undefined;
    const [meta, ...rest] = raw.split(SEP);
    const m = parse(meta, MetaSchema);
    const profiles = rest.map((r) => parse(r, ProfileSchema)).filter((p): p is Profile => !!p);
    return { profiles, activeId: m?.activeProfileId ?? profiles[0]?.id ?? "" };
  }, [raw]);
}

export function useActiveProfile(): Profile | null | undefined {
  const raw = useRaw(() => KEYS.profile(activeId()));
  return useMemo(() => (raw === undefined ? undefined : (parse(raw, ProfileSchema) ?? null)), [raw]);
}

export function useStats(): Stats | undefined {
  const raw = useRaw(() => KEYS.stats(activeId()));
  return useMemo(() => (raw === undefined ? undefined : (parse(raw, StatsSchema) ?? emptyStats())), [raw]);
}

export function useDevicePrefs(): DevicePrefs | undefined {
  const raw = useRaw(() => KEYS.device);
  return useMemo(() => (raw === undefined ? undefined : (parse(raw, DevicePrefsSchema) ?? DevicePrefsSchema.parse({}))), [raw]);
}

const NO_TOPICS: Topics = { recent: [], favourites: [] };

/** The active profile's recent and favourite topics (QoL Q5). */
export function useTopics(): Topics {
  const raw = useRaw(() => KEYS.topics(activeId()));
  return useMemo(() => (raw ? (parse(raw, TopicsSchema) ?? NO_TOPICS) : NO_TOPICS), [raw]);
}
