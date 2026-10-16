# v0.3 · Identity: profiles, streaks, customisation, quality of life

> Status: ☑ (16 Oct; library review and three flexible QoL items outstanding, see Progress) · Estimate: ~7–8 days · Track: product · Depends on: v0.2 menu shell

## Goal
Make Saboteur somewhere you **come back to**. Several people can share a device, each with their own
profile. Daily play is rewarded honestly with streaks, a daily case, XP and badges. The look and feel can
be tuned. Lots of small conveniences remove friction.

## Scope

**Fixed**
- **Profiles**: local multi-profile (up to 6 per device) with a name, avatar, colour and per-profile data.
  See [profiles.md](profiles.md).
- **Storage v2** with a tested v1 → v2 migration ([data-and-storage](../00-principles/data-and-storage.md)).
- **Daily streak** plus **streak freezes**, and a **Daily case** everyone gets on the same date. See [streaks.md](streaks.md).
- **XP and rank**: investigator ranks (Recruit → Constable → Detective → Inspector → Chief Inspector →
  Spymaster), with XP from points, the daily case and streak milestones.
- **Badges**: 20 at launch, defined as data. See the list in [streaks.md](streaks.md#badges).
- **Customisation**: theme, desk, pen colour, stamp ink, typography size and density, motion, sound and
  defaults. See [customisation.md](customisation.md).
- **QoL pack** below.

**Flexible**
- The XP curve numbers, badge list and rank names.
- The number of avatar options (the 12 illustrated badges suggested in asset briefs, or monogram only).
- Whether streaks count the daily case only or any completed round (default: **any completed round**;
  the daily case gives bonus XP).

**Open**
- Profile PIN locks (useful on shared family devices). Default: no PIN in v0.3 and revisit after feedback.
- Notifications/reminders: browser notifications need a PWA (v0.5) and an opt-in. Default: in-app only for v0.3.

## QoL pack
| # | Feature | Notes |
|---|---|---|
| Q1 | **Resume anything**: drafts already autosave; add "Unsaved flags" warnings on leave and a cross-tab lock (BroadcastChannel) | Prevents double-submits |
| Q2 | **Keyboard play**: J/K to move between sentences, F to flag, 1–5 for confidence, Enter to save the correction, Ctrl+Enter to submit | Shown in a `?` cheat sheet overlay |
| Q3 | **Undo**: Ctrl+Z on flag add/remove/edit within the round (bounded stack of 30) | Pure reducer, tested |
| Q4 | **Retry same topic** at a different difficulty from the reveal, and "**Replay this case**" (same sentences, errors hidden again) for revision | Replay doesn't award XP twice |
| Q5 | **Recent topics and favourites** on the setup screen, plus topic autocomplete from history plus the library | |
| Q6 | **Notes library**: save pasted notes per topic and reuse them | Per profile; size-capped |
| Q7 | **Export / import profile** (JSON) and **Print/PDF** a reveal as a revision sheet | `@media print` stylesheet |
| Q8 | **Share a result** as an image card (canvas render of the stamp grid, no answers) | Web Share API, falls back to download |
| Q9 | **Toasts and inline status** done properly: one toast queue, `aria-live`, never covering the submit button | |
| Q10 | **Connection-aware**: offline banner when `navigator.onLine` is false. Rounds already loaded stay playable; grading queues until online, or uses offline grading for offline rounds | |
| Q11 | **Session timer** (optional, setting) and "take a break" nudge after 45 min | Gentle and dismissible |
| Q12 | **Text size controls** in a round (A−/A+), remembered | Separate from the global density setting |

## Acceptance criteria
- Existing v1 data migrates into "Player 1" with nothing lost. Covered by unit tests with 3 fixtures
  (empty, typical, corrupt).
- Switching profile takes < 150 ms and changes everything profile-scoped (rounds, stats, theme if per profile).
- Streak maths is pure, timezone-safe (local calendar day) and covered by tests for DST changes, midnight
  edges, freezes and a time-travelling device clock.
- All customisation applies live, survives reload and never causes a flash of the wrong theme (an inline
  pre-hydration script sets `data-theme` before paint).
- QoL items Q1–Q6 and Q9 are required. Q7, Q8 and Q10–Q12 are flexible and can slip to v0.5.

## Risks
| Risk | Mitigation |
|---|---|
| Streak anxiety / dark patterns | Freezes, a "rest days" setting (e.g. weekends off), no guilt copy, streak hidden if the user turns it off |
| Daily case needs the same content for everyone without a backend | Seed = date; pick the topic deterministically from the library and use the offline engine's seeded sabotage. Identical on every device, no server state. v0.9 can switch it to AI-generated cached-per-day |
| localStorage quota with many profiles | Per-profile round cap (40), notes cap (200 KB), and a quota guard |

## Exit demo
Create two profiles with different avatars and themes. Play the daily case on one and see the streak go
to 1, a badge pop and XP fill. Switch profile and everything changes. Export the profile, clear storage,
import it, and it's all back.

## Progress

**Shipped (16 Oct).** Exit demo passes on the production build (two profiles with different themes, daily
case → streak 1 + XP + badges, switch, export → clear → import), at desktop and phone sizes.

| Task | State | Notes |
|---|---|---|
| V03-01/02 storage v2 + migration | ☑ | `lib/storage/`, fixtures empty/typical/corrupt, quarantine, quota trimming never touches profile/stats. Migrated players get stats rebuilt from their old rounds |
| V03-03 profiles + isolation | ☑ | `lib/profile/`, isolation test, 6-profile cap, guests wiped with their session |
| V03-04 picker + recruit flow | ☑ | "Who's investigating?" ID cards (stage between title and menu, 2+ profiles); `/recruit` 3 steps, briefing earns Recruit; guest option |
| V03-05 profile chip | ☑ | Nav and home corner; switch, new recruit, Dossier, Settings |
| V03-06 progress maths | ☑ | `lib/progress/`, 52 tests incl. time zones, both summer-time changes, freezes, rest days, repairs, backwards clock |
| V03-07 one event, counted once | ☑ | `saveResult` returns true only the first time; stats keep counted round ids too |
| V03-08 round-end strip | ☑ | XP bar, pen crosses off today, badge pops, PROMOTED stamp; ~2.4 s, click to skip, reduced-motion version |
| V03-09/10 seeded engine + daily case | ☑ | `lib/daily.ts`; `/api/daily`; server rebuilds `daily-YYYY-MM-DD` for grading; one scored attempt, replays unscored |
| V03-11 library ≥ 30 topics | ◐ | 30 topics, 10 subjects, 4 curated errors each, all pass the fairness check. **The 22 new ones are marked `reviewer: "unreviewed"`**: they still need the second-person textbook check (B-01) |
| V03-12 Dossier | ☑ | Record (rank, XP, 12-week pen calendar, totals, best case), Badges corkboard, Profile (rename, badge, delete by typing the name) |
| V03-13/14 prefs + drawer | ☑ | Theme (system/day/night/by time), desk (oak/plain), pen, stamp ink, text size, spacing, reading font (Atkinson), motion, title screen, engine, error-count hint, confidence buttons, rest days, streak visibility, backups. Pre-paint script is ~780 bytes (target was 600) |
| V03-15 colour-safe inks | ☑ | Okabe–Ito blue/vermillion set and a black set; verdict tags already carry ✓ ✗ ⚠ |
| V03-16 Q1 | ☑ | One tab per case (BroadcastChannel): the newer tab takes over, the older one can't submit. Leaving warns only while marking is in flight (drafts autosave) |
| V03-17 Q2 | ☑ | J/K, F, E, 1–6, Enter in a fix box, Ctrl+Enter, `?` sheet |
| V03-18 Q3 | ☑ | `lib/flagsHistory.ts` (8 tests); a run of typing is one step; works inside fix boxes |
| V03-19 Q4 | ☑ | Easier/harder retries; "Replay this case" (unscored) via `/api/saboteur/replay` |
| V03-20 Q5/Q6 | ☑ | Favourites (★), recent topics, autocomplete, notes saved per topic (200 KB cap) |
| V03-21 Q9 | ☑ | One toast queue, `aria-live`, top right |
| V03-22 flexible | ◐ | Done: Q7 export/import + print revision sheet, Q12 A−/A+. Slipped to v0.5: Q8 share card, Q10 offline queue, Q11 session timer |
| V03-23 e2e | ◐ | Run as Playwright scripts against the production build (exit demo, keyboard play, tab lock, replay, phone layouts). Moving them into `e2e/` is part of v0.5 |

**Changes on the way.** Dark mode and reduced motion are now attributes set before paint (not media
queries), so the player's choice wins and there's no flash. Verdicts got their own `--miss` ink, so a blue
pen never reads as "missed". A pre-existing overflow in "Your bets" (long sentences widened the page on
phones) was fixed.
