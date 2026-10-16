# v0.2 tasks

| ID | Task | Size | Depends | Done when |
|---|---|---|---|---|
| V02-01 | Move the current home content to `/about`. Add `metadata` there and keep the OG tags | S | — | `/about` renders the old hero plus How it works; the nav and footer link to it |
| V02-02 | `lib/menu.ts`: the menu item model, item list builder (reads store: has unfinished round? tutorial done?) and pure helpers. Unit tests | S | — | Tests cover Continue hidden/shown, locked items and hotkeys |
| V02-03 | `useMenuKeys` hook: arrows/WS/Tab/Enter/Esc/1–9/`?`, wrap-around, ignores input when typing in a field | S | 02 | Playwright: keyboard-only reaches every item |
| V02-04 | `MainMenu` and `MenuItem` (folder tabs, CSS/SVG). Focus slide-out and tilt. `aria-current` | M | 02, 03 | Matches menu-spec §2 at 360/768/1440 px; axe has no violations |
| V02-05 | `MenuPreview` cards per item (data from store), dealt in on focus change, debounced 80 ms | M | 04 | Previews correct for empty and populated stores |
| V02-06 | `TitleScreen` sequence (lamp bloom, wordmark type-on, redaction peel, any-key). Session skip flag. `?skip=1` | M | — | Under 1.6 s, skippable from frame 1; reduced motion is a static title |
| V02-07 | In-place title → menu transition, reusing the RedactionTransition bars without a route change | S | 04, 06 | No route change; the back button doesn't return to the title |
| V02-08 | **Continue**: detect the newest round with no result. Show flags placed from its draft. Resume | S | 02 | Abandon a round, return, and Continue opens it with the flags restored |
| V02-09 | **Quick play**: random library or recent topic at the saved difficulty, auto-start generation, skipping setup | S | — | One click to the loupe loader |
| V02-10 | **Daily case** placeholder folder ("opens in v0.3") with the date stamp art | S | 04 | Visible and announced as coming soon |
| V02-11 | `/archive` page: sortable list of past cases (date, topic, score, verdict mini-stamps), filters by topic and difficulty, search box. Replaces RecentRounds | M | — | 40 fixture rounds render in under 50 ms with no layout jank |
| V02-12 | `DeskLamp` engine indicator plus tooltip (reason from `/api/engine`). Retry button when offline | S | — | Shows AI/offline; the tooltip is reachable by keyboard |
| V02-13 | `SettingsDrawer` v0: motion (system / reduced / full), sound on/off, theme (day/night/system). Writes to the `device` prefs | M | — | Settings persist and apply without a reload |
| V02-14 | Interactive **How to play** tutorial (5 steps, fixed sample, spotlight mask) | L | 04 | Completable by keyboard and touch; skippable; the done flag is stored |
| V02-15 | Locked **Modes** sub-menu with descriptions and target versions | S | 04 | — |
| V02-16 | Re-skin `/play` setup as an opened folder (the same form, plus a folder tab header and paper-clip). Back goes to the menu | M | 04 | Visual only; no behaviour change; the existing e2e still passes |
| V02-17 | Nav rework: inside a round the top nav shrinks to "◂ Menu" plus the case title. On the menu it hides | S | 04 | No duplicate navigation on the menu |
| V02-18 | e2e: title → menu → tutorial → quick play → abandon → continue | S | all | Green in CI (v0.5 sets up CI; until then run from the scratchpad) |

**Suggested order:** 01 → 02 → 03 → 04 → 06 → 07 → 08 → 09 → 05 → 11 → 12 → 13 → 16 → 17 → 14 → 10/15 → 18.
