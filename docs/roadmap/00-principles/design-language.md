# Design language

## The metaphor
You are an investigator at a desk. The app hands you **case files** (briefings) that a saboteur has
tampered with. You mark them in **red pen**, a **stamp** gives the verdict, and your record lives in a
**dossier** (profile). Menus are **folders and index cards**. Transitions are **redaction bars**. The
loading screen is a **loupe** reading the page.

New features must find their object first:

| Feature | Object |
|---|---|
| Main menu | Manila folders fanned on the desk, each with a tab label |
| Profiles | ID badges / dossier covers with a photo slot |
| Streak | A desk calendar with days crossed off in red pen |
| Daily case | A sealed envelope marked with today's date |
| Settings | An index-card drawer |
| Badges | Enamel pins / rubber stamps collected on a corkboard |
| Misconception Profile | A corkboard with string between linked misconceptions |
| Calibration | A dial or gauge on a brass instrument |
| Autopsy | A morgue toe-tag and a dissection tray (kept tasteful) |
| Confusables | Two suspects in a line-up |
| Root Gap | An evidence tree / family tree pinned to the board |

## Tokens (existing, in `app/globals.css`)
- Colours: `--paper`, `--paper-sunk`, `--paper-edge`, `--ink`, `--ink-soft`, `--pen` (red),
  `--catch` (green), `--miss`, `--desk`, `--desk-soft`, `--scrim`, `--photo`.
- Type:
  - Bricolage Grotesque for display, condensed via `font-stretch`;
  - Newsreader for passage text;
  - IBM Plex Mono for labels and stamps;
  - Reenie Beanie for handwriting.
- v0.3 adds themes on top of these. Never hard-code a colour in a component.

## Motion
| Kind | Duration | Easing | Example |
|---|---|---|---|
| Micro (hover, press) | 120–180 ms | `cubic-bezier(.2,.8,.2,1)` | Folder tab lifts 4 px |
| Object move | 280–450 ms | spring (stiffness 300, damping 26) | Folder slides out of the stack |
| Scene change | 600–900 ms | redaction bars | Route change |
| Verdict | 1.1–1.4 s | footage-timed | Stamp |
| Ambient | 6–40 s loops, **seamless** | sine / noise | Lamp flicker, dust motes, clock hand |

Ambient loops must have **no visible seam**: first frame equals last frame, or they're driven by
continuous maths (time → sine/noise), never `t % duration` on a path with distinct start and end points.

## Voice
- Plain, dry, a little noir. Short sentences. "Slipped past you." not "Oops! You missed one 😅".
- Never mock the student. Mock the saboteur.
- Use numbers rather than adjectives: "3 of 4 caught" beats "Great job!".
- Use British spelling in the UI (the existing copy is British).
