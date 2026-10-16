# Data and storage

## Today
- `localStorage` uses the prefix `saboteur:v1:` and stores `rounds` (max 40), `settings` (last setup
  form) and `draft:<id>`.
- `sessionStorage` holds a one-shot `autostart`.
- The server keeps planted errors in a `globalThis` map with a 2 h TTL. They're lost on restart (fixed in v0.9).

## From v0.3: versioned, profile-scoped storage
```
saboteur:v2:meta                    { schemaVersion: 2, activeProfileId, profileOrder[] }
saboteur:v2:p:<profileId>:profile   Profile (name, avatar, createdAt, preferences)
saboteur:v2:p:<profileId>:rounds    Record<roundId, RoundRecord>
saboteur:v2:p:<profileId>:stats     Streak, XP, badges, daily-case log
saboteur:v2:p:<profileId>:draft:<roundId>
saboteur:v2:device                  device-wide prefs (motion, sound, volume): apply before any profile is picked
```
- **Migration v1 → v2** runs once on boot. It creates a "Player 1" profile, moves the v1 rounds and
  settings in, and keeps the v1 keys for one release as a backup. It's pure and unit-tested on fixtures.
- Every blob is parsed with Zod on read. A bad blob is quarantined under `…:corrupt:<ts>` and reported,
  never thrown.
- A storage quota guard trims the oldest rounds first and never touches the profile or stats.
- **Export/import** (v0.3 QoL) writes one JSON file per profile with the same schemas, so data can be
  backed up or moved between browsers before accounts exist.

## From v0.9: database
Server tables mirror the v2 shapes (spec section 8). The client store becomes a sync cache. See
[`v0.9-accounts-and-sync`](../v0.9-accounts-and-sync/).
