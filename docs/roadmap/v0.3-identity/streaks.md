# Streaks, daily case, XP and badges

All of this lives in `lib/progress/` as **pure functions** over `(stats, event, now, tz)` and is
exhaustively unit-tested. UI reads the results and never computes progress itself.

## Streak rules
- A **day** is the player's local calendar day (`Intl.DateTimeFormat().resolvedOptions().timeZone`,
  stored on the event, so moving timezone doesn't break history).
- A day **counts** when at least one round is completed (submitted and graded). Abandoned rounds don't count.
- `current` increments on the first counted round of a new day, if the last counted day was yesterday or
  if every day in between is covered by a freeze or a rest day.
- **Freezes:**
  - earn 1 per 7-day streak milestone, holding a maximum of 2;
  - when a day is missed and a freeze is available, it's consumed automatically and the calendar shows a
    snowflake-stamped day.
- **Rest days**: an optional setting (e.g. Sat/Sun). Rest days neither break nor extend a streak.
- **Clock sanity**: if the device clock goes backwards more than 1 day, don't award anything that day and log it.
- **Repair** (flexible): within 48 h of breaking a streak, completing 3 rounds in one day restores it, at most once a month.

## Daily case
- `dailySeed(date) = hash("saboteur-daily|" + yyyy-mm-dd)`.
- The topic is picked by the seed from the offline library. Rotate subjects so no subject repeats within
  4 days. The difficulty cycles Mon/Tue = obvious, Wed/Thu = subtle, Fri–Sun = devious.
- The round is built by `generateOffline` with the seed injected, so it's deterministic. Add a
  `seed` param to `generateOffline` and `chooseErrors` (they already use mulberry32).
- One scored attempt per day and profile. Replays are allowed but unscored.
- Rewards: +50 XP, plus a "daily stamp" in the calendar.
- v0.9 adds a server-cached AI daily case and global stats ("31% caught error #2").
- **Library growth is needed**: 8 topics is too few for daily rotation. Target 60 hand-checked entries by
  v1.0 (see backlog B-01), and at least 30 by the end of v0.3.

## XP
| Event | XP |
|---|---|
| Round completed | `max(10, round(points × 0.5))` |
| Perfect round (all caught, no false flags) | +40 |
| Daily case | +50 |
| Streak milestones 3/7/14/30/60/100 | +30/+75/+150/+300/+600/+1000 |
| Good calibration in a round (Brier ≤ 0.15, at least 3 judgements) | +20 |

Rank thresholds follow a gentle curve `xpFor(level) = 100 × level^1.6` (flexible). The rank is shown on
the dossier and the profile chip. A level-up gets a full-width stamp "PROMOTED".

## Badges
Data-driven (`lib/progress/badges.ts`): `{ id, name, description, icon, test(stats, lastRound) }`.

| ID | Name | Earned for |
|---|---|---|
| recruit | Recruit | Finish the tutorial |
| first-case | First case | Complete a round |
| red-handed | Red-handed | Catch every error in a round |
| clean-hands | Clean hands | A round with no false flags |
| devious-mind | Devious mind | A perfect round on Devious |
| honest-doubt | Honest doubt | Brier ≤ 0.10 over 5 rounds |
| no-overconfidence | Measured | No confident mistakes in 10 rounds |
| streak-3/7/30/100 | On the beat / Week on the case / Month-long stakeout / Centurion | Streaks |
| daily-7 | Regular | 7 daily cases |
| polymath | Polymath | Rounds in 5 different subjects |
| own-notes | Did the reading | 5 rounds from your own notes |
| offline-op | Off the grid | Complete an offline round |
| night-owl | Night owl | Complete a round between 00:00 and 04:00 |
| comeback | Comeback | Restore a broken streak |
| autopsy-1 | Coroner | First Autopsy (v0.7) |
| line-up | Line-up | First Confusables drill (v0.8) |
| root-cause | Root cause | First Root Gap trace (v0.8) |

## Moments (UI)
- **Round end**: after the stamps, a progress strip slides up: XP gained with a bar fill, streak day
  cross-off on a mini calendar (pen draws an X), and any badges. Total ≤ 2.5 s and skippable.
- **Menu**: the desk calendar shows the streak. Hovering shows the next freeze and milestone.
