# v0.3 tasks

| ID | Task | Size | Depends | Done when |
|---|---|---|---|---|
| V03-01 | Storage v2: key scheme, Zod-parsed read/write, quarantine of corrupt blobs, quota guard | M | — | Unit tests; v1 store API kept as a thin adapter so existing pages work unchanged |
| V03-02 | v1 → v2 migration plus fixtures (empty, typical, corrupt) | S | 01 | Tests pass; manual migration of a real v1 browser verified |
| V03-03 | Profile schema, CRUD and active-profile store (`useProfile`) | M | 01 | Switching re-renders all consumers; isolation test |
| V03-04 | "Who's investigating?" picker plus Create profile flow (3 steps) plus Guest mode | M | 03, v0.2 | Keyboard and touch; 6-profile cap; guest data wiped on close |
| V03-05 | Profile chip and switcher in the nav | S | 03 | — |
| V03-06 | `lib/progress`: streak, freezes, rest days, XP, rank, badge evaluation. **Pure** with ~60 tests incl. DST/timezones | L | 01 | Coverage 100% branches |
| V03-07 | Hook progress into round submission (one event: `roundCompleted`) and return a `ProgressDelta` for the UI | S | 06 | Idempotent: refreshing the reveal doesn't double-award |
| V03-08 | Round-end progress strip (XP bar, calendar cross-off, badge pops) | M | 07 | ≤ 2.5 s, skippable, reduced-motion version |
| V03-09 | Seeded offline generation (`seed` param through `generateOffline`/`chooseErrors`) | S | — | Same date gives an identical round on two devices (test) |
| V03-10 | Daily case: seed, topic rotation, difficulty by weekday, one scored attempt, menu folder live | M | 09, v0.2 | Menu shows today's state (unopened / done with score) |
| V03-11 | Grow the offline library to ≥ 30 hand-checked topics (see backlog B-01 for format and checking procedure) | L | — | Each entry has ≥ 3 curated errors and a reviewer note |
| V03-12 | `/dossier`: Record tab (rank, XP, streak heat-map calendar, totals), Badges tab (corkboard), Profile tab | L | 06 | Empty states designed |
| V03-13 | `lib/prefs.ts` plus pre-paint script plus `applyPrefs`; theme, desk, pen, stamp ink, text size, density, passage font, motion | M | 01 | No theme flash (verified with a throttled reload recording) |
| V03-14 | Settings drawer full UI with live preview | M | 13 | All options apply live |
| V03-15 | Colour-blind-safe stamp set and shape cues on verdict marks | S | 13 | Passes simulated deuteranopia/protanopia checks |
| V03-16 | QoL Q1: leave warning plus cross-tab lock | S | — | Second tab shows "open in another tab" |
| V03-17 | QoL Q2: keyboard play plus `?` cheat sheet | M | — | Full round playable without a mouse |
| V03-18 | QoL Q3: undo/redo reducer for flags | S | — | Tests |
| V03-19 | QoL Q4: retry other difficulty; replay case (no double XP) | S | 07 | — |
| V03-20 | QoL Q5/Q6: recent topics, favourites, autocomplete, saved notes per topic | M | 03 | — |
| V03-21 | QoL Q9: unified toast queue plus `aria-live` region | S | — | — |
| V03-22 | *(flexible)* Q7 export/import/print · Q8 share card · Q10 offline queue · Q11 session timer · Q12 text size in round | L total | — | Each can slip to v0.5 individually |
| V03-23 | e2e: two profiles, daily case, streak increments (with a mocked clock), switch, export/import | M | all | Green |
