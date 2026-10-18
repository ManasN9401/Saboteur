# Saboteur roadmap: prototype → production

Where Saboteur goes over the next ~8 weeks, from "working hackathon build" (v0.1, today) to a public
v1.0. Each version has its own folder with goals, specs, tasks and acceptance criteria.

**This is a plan, not a contract.** Every folder marks what is **fixed** (needed for the version to
make sense), what is **flexible** (good default, change freely) and what is **open** (needs a decision).
When something changes, edit the folder and log big calls in [`decisions/`](decisions/).

## Where we are (v0.1, commit `6b8411d`)

Working: the write → plant → verify pipeline, offline rule-based engine, round and reveal screens,
grading, scoring with calibration maths, loupe loader, stamp footage, redaction transitions, local
history. 49 unit tests.

What makes it feel like a prototype:

| Problem | Where it's fixed |
|---|---|
| The home page is a marketing page with one button. No menu, no sense of a "game" you return to | v0.2 |
| No identity: no profiles, names, avatars, streaks or goals. Every visit starts from zero | v0.3 |
| Nothing to customise: theme, desk, sounds, motion, font size, default difficulty | v0.3 |
| The magnifier is a rotated photo: lighting is wrong, the shadow and fringe are baked in, and the loop teleports | v0.4 |
| The background is a still photo. No ambient life, no time of day, no parallax | v0.4 |
| No performance budget. Big client components, a full-res photo on every route, video decoded per card | v0.5 |
| The data collected (confidence, misconceptions) is never shown back to the student | v0.6 |
| Spec modes (Autopsy, Confusables, Root Gap) don't exist | v0.7–v0.8 |
| Rounds live in server memory and are lost on restart. No accounts, no sync | v0.9 |
| No accessibility audit, no error monitoring, no legal pages, no demo mode | v1.0 |

## Versions at a glance

| Version | Theme | Rough timing | Depends on | Folder |
|---|---|---|---|---|
| — | Principles, budgets, definition of done | applies throughout | — | [00-principles](00-principles/) |
| **v0.2** | Front door: a real title screen and main menu | Week 1 | — | [v0.2-front-door](v0.2-front-door/) |
| **v0.3** | Identity: profiles, streaks, daily case, customisation, QoL | Weeks 1–2 | v0.2 shell | [v0.3-identity](v0.3-identity/) |
| **v0.4** | Art and motion: rebuilt props, living desk, sound | Weeks 2–3 (assets start in week 1) | v0.2 | [v0.4-art-and-motion](v0.4-art-and-motion/) |
| **v0.5** | Performance: budgets enforced, smooth on a cheap phone | Week 3–4 (ongoing) | v0.4 | [v0.5-performance](v0.5-performance/) |
| **v0.6** ☑ | Learning loop: calibration, Misconception Profile, personalised rounds (spec Phase 2) | Weeks 4–5 | v0.3 profiles | [v0.6-learning-loop](v0.6-learning-loop/) |
| **v0.7** ☑ | Wrong Answer Autopsy (spec Phase 3) | Week 5–6 | v0.6 profile | [v0.7-autopsy](v0.7-autopsy/) |
| **v0.8** | Confusables Trainer and Root Gap Finder (spec Phase 4) | Weeks 6–7 | v0.6 | [v0.8-confusables-rootgap](v0.8-confusables-rootgap/) |
| **v0.9** | Accounts, database, sync, durable rounds | Week 7 (can move earlier) | v0.3 data model | [v0.9-accounts-and-sync](v0.9-accounts-and-sync/) |
| **v1.0** | Launch: a11y, reliability, demo mode, legal, analytics | Week 8 | everything | [v1.0-launch](v1.0-launch/) |
| — | Ideas parking lot | whenever | — | [backlog](backlog/) |
| — | Lightweight decision records | as needed | — | [decisions](decisions/) |

Dated week-by-week plan: [timeline.md](timeline.md).

```
v0.2 front door ──► v0.3 identity ──► v0.6 learning loop ──► v0.7 autopsy ──► v0.8 confusables/root gap ──► v1.0
       │                  └──────────► v0.9 accounts & sync ─────────────────────────────────────────────┘
       └──► v0.4 art & motion ──► v0.5 performance ─────────────────────────────────────────────────────┘
```

Two tracks run in parallel. **Product** (v0.2 → v0.3 → v0.6 → v0.7 → v0.8) is code-heavy. **Craft**
(v0.4 → v0.5) is asset- and motion-heavy and mostly waits on Flow / Nano Banana output, so start its
asset generation in week 1.

## How to read a version folder

Every version folder has:

- `README.md`: goal, why it matters, scope (fixed / flexible / open), acceptance criteria, risks, exit demo.
- `tasks.md`: numbered tickets (`V02-07`) with size (S ≤ ½ day, M ≤ 1½ days, L ≤ 3 days), dependencies
  and done-when checks. Copy them into an issue tracker if you like; the IDs stay stable.
- Extra spec files where a feature needs one (e.g. `menu-spec.md`, `streaks.md`, `loupe-rebuild.md`).

## Status legend

`☐` not started · `◐` in progress · `☑` done · `✗` cut, with the reason noted beside it.

Update the status in the version's `README.md` header line as things move.

## Rules for changing the plan

1. **Re-ordering is fine.** v0.9 (accounts) can move before v0.6 if a real database is needed sooner, e.g.
   for a public demo with multiple users.
2. **Cutting is fine if you write down why.** Mark it `✗` with one line, then move it to `backlog/`.
3. **Don't merge versions.** Each version ends with something you can show. A version that can't be demoed
   is too big: split it.
4. **Weeks are estimates.** If a version overruns by more than half its estimate, stop and re-plan the rest
   rather than squeezing later versions.
5. **The spec (`saboteur-context.md`) still wins on product behaviour.** This roadmap wins on order and polish.
