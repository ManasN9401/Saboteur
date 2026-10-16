# v0.2 · Front door

> Status: ◐ (title and menu shipped) · Estimate: ~4–5 days · Track: product · Depends on: nothing

## Goal
Replace the marketing-style home page with a **title screen and main menu** that feels like opening a
game. You arrive at the desk, the lamp clicks on, a stack of folders is waiting, and you pick where to go.
Starting a round is one choice among several, not the only thing on the page.

## Why
The home page currently reads as a landing page with one "Start a round" button. Returning players get
nothing: no continue, no daily case, no record. It's the first impression and it says "prototype".

## Scope

**Fixed**
- `/` becomes the **title screen**: wordmark, "press any key / tap to begin", and an ambient desk. It hands
  over to the **main menu** at `/menu`, or the same route in a menu state, see open question 1.
- Main menu items, in this order:
  1. **Continue**: resume the newest unfinished round. Shown only if one exists, with the case title and a progress hint.
  2. **New case**: the existing setup flow, re-skinned as a folder.
  3. **Daily case**: one shared round per day, a placeholder until v0.3.
  4. **Quick play**: a one-click round on a random library topic at the saved difficulty.
  5. **Case archive**: history of rounds (today's RecentRounds, made a proper page).
  6. **Dossier**: profile and stats, a placeholder until v0.3/v0.6.
  7. **Modes**: Autopsy, Confusables and Root Gap, shown as **locked** folders with "coming soon" until v0.7/v0.8.
  8. **Settings**: index-card drawer, minimal in v0.2 (motion, sound, theme), full in v0.3.
  9. **How to play**: interactive 45-second tutorial on a fixed sample case.
  10. **Credits / About**.
- Full keyboard and controller-style navigation: arrows or W/S move, Enter selects, Esc goes back, and number keys jump to items.
- The engine status (AI / offline) is shown on the menu as a desk object (a lamp, green or amber), not a banner.
- The marketing content (How it works) moves to `/about`, linked from the menu and footer, so SEO is kept.

**Flexible**
- The visual treatment of the menu: fanned folders (preferred), a filing-cabinet drawer, or index cards
  on a corkboard. See [menu-spec.md](menu-spec.md) for the preferred design and a cheaper fallback.
- Whether the title screen is skipped for returning visitors (default: skip after the first visit in a
  session, and keep a setting to always show it).
- The order of items 3–5.

**Open**
1. `/` vs `/menu`. Recommendation: `/` shows the title, then transitions in place to the menu state
   (no navigation, so it's instant), and deep links go straight to `/menu`.
2. Should Quick play skip setup entirely (recommended) or open it pre-filled?

## Acceptance criteria
- Cold load to an interactive title screen within the LCP budget (≤ 1.8 s desktop).
- From the title, a returning player can be in their unfinished round in **2 inputs** (any key → Enter on Continue).
- A new player can reach a live round in **3 inputs** (any key → Quick play → confirm).
- Every menu item is reachable by keyboard, mouse, touch and screen reader. The menu is a `nav` with
  `aria-current`, and locked items are announced as "locked, coming in a later update".
- Reduced motion: the folders appear without fanning, and the lamp is simply on.
- Lighthouse a11y ≥ 95 on `/` and `/menu`.

## Risks
| Risk | Mitigation |
|---|---|
| A title screen adds friction | Skip after first visit per session. Any key or click skips. `?skip=1` for deep links |
| Folder fan looks cheap without good art | Ship the CSS/SVG folders first. The v0.4 art pass replaces textures only, so the layout stays |
| Locked modes frustrate people | Show what each will do and its target version. One locked row, not three big tiles |

## Exit demo
Open the site in a fresh profile, see the title, press a key, browse the menu by keyboard, run the How to
play tutorial, Quick play a round, abandon it, return to the menu and see **Continue**.

See [menu-spec.md](menu-spec.md) and [tasks.md](tasks.md).

## Progress (15 Oct)
- ☑ `/` is the title card: wordmark revealed from under a redaction bar, a red-pen strike, the lamp switching on, and dust in the lamp light. Any key, click or tap opens the menu (shown once per session).
- ☑ Folder menu: Continue (newest unfinished round under 2 h old), New case, Quick play, Daily case 🔒, Archive, Dossier 🔒, How it works. Arrows, W/S, 1–9, Enter and Esc work. Hover and keyboard share one focus.
- ☑ Quick play picks a random topic and starts straight away, even when the setup page is still mounted in the background.
- ☑ `/about` (the old home content) and `/archive`. The nav is hidden on `/`.
- ☐ Interactive How to play tutorial (V02-14), settings drawer (V02-13), previews beyond the one-line hint (V02-05), and the setup page as a folder (V02-16).
- Note: Turbopack silently dropped every rule after a second `@media (prefers-reduced-motion)` block, so `globals.css` keeps exactly one.
