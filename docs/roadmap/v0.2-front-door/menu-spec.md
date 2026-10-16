# Title screen and main menu: design spec

## 1. Title screen (`/`)

```
┌───────────────────────────────────────────────────────────────┐
│  [night desk plate, slow parallax on pointer, dust in lamp beam] │
│                                                               │
│            S A B O T E U R                                    │
│            ───────────────  (wordmark; one letter redacted    │
│            study by catching the lies   and un-redacts on load)│
│                                                               │
│                  ▸ press any key ◂   (blinks 1.2 s, mono label) │
│                                                               │
│  v0.2 · AI online ●                          © / about / credits│
└───────────────────────────────────────────────────────────────┘
```

**Sequence**, about 1.6 s total and skippable at any point:
1. 0 ms: the desk is dark and the scrim is at 90%.
2. 150 ms: lamp click (sound if enabled). A warm radial light blooms from the top-left over 500 ms.
3. 400 ms: the wordmark types on in IBM Plex Mono, then morphs to Bricolage display. One letter is covered
   by a redaction bar that peels off at 1.1 s.
4. 1.2 s: "press any key" fades in.
5. On input: redaction bars sweep (the existing RedactionTransition, in-page variant) and the menu state slides in.

**Ambient while idle**, all from one scene loop (V04):
- dust motes drift in the lamp cone;
- the clock second hand ticks;
- the lamp flickers subtly every 20–40 s;
- 2° parallax on pointer or gyroscope.

## 2. Main menu (menu state, also `/menu`)

### Preferred: fanned folders
```
 desk ──────────────────────────────────────────────────────────────
 │  ┌Lamp┐                                   ┌ Desk calendar ┐       │
 │  │ ●  │ AI online                         │ 🔥 4-day streak│ (v0.3)│
 │                                                                   │
 │   ┌─────────┐                                                     │
 │   │CONTINUE │  Case 0417 · Photosynthesis · 2 of ? flagged        │
 │   ├─────────┴┐                                                    │
 │   │ NEW CASE │                                                    │
 │   ├──────────┴─┐            ┌──────────────────────────┐          │
 │   │ DAILY CASE │  ◂ focused │  preview card for focused │          │
 │   ├────────────┴┐           │  item: what it is, last   │          │
 │   │ QUICK PLAY  │           │  played, best score, etc. │          │
 │   ├─────────────┴┐          └──────────────────────────┘          │
 │   │ CASE ARCHIVE │                                                │
 │   ├──────────────┴┐                                               │
 │   │ DOSSIER       │                                               │
 │   ├───────────────┴┐                                              │
 │   │ MODES 🔒        │                                             │
 │   └────────────────┘   Settings ⚙  ·  How to play  ·  Credits     │
 ────────────────────────────────────────────────────────────────────
```
- Each item is a **folder tab** with a stacked manila folder behind it. The focused one slides out 24 px
  and tilts 1°. The preview card on the right is a paper sheet that **deals** in (the existing `deal`
  keyframe) with details:

| Item | Preview card content |
|---|---|
| Continue | case title, topic, flags placed, time since paused, difficulty |
| New case | last used level and difficulty, plus "3 topics you studied this week" |
| Daily case | today's date stamp, topic (hidden until opened), global solve count (v0.9) |
| Quick play | "Random library topic · Subtle", with a reroll button |
| Case archive | last 3 results as mini stamps, plus the total cases closed |
| Dossier | avatar, streak, XP level, calibration grade |
| Modes | three locked sub-folders with one-line descriptions and target versions |

- Mobile (< 720 px): the folders stack vertically at full width, and the preview opens as a bottom sheet
  on focus or long-press. Tap = select.

### Cheaper fallback (if time runs short)
A vertical list of index cards with a mono label and a one-line description, hover lift and the same
keyboard model. Same data, same routes. Swap the visuals in later.

## 3. Interaction model
- `MenuController` (client) holds `focusedIndex` and the items. Items are data:
  `{ id, label, hint, href | action, enabled, badge?, preview: () => ReactNode, hotkey }`.
- Keys:
  - ↑/↓, W/S or Tab move focus;
  - Enter or Space selects;
  - Esc goes back to the title (or closes settings);
  - 1–9 select directly;
  - `?` opens How to play.
- Pointer: hover focuses, click selects. Touch: tap selects, and the preview appears in the sheet before
  navigating only for Modes (locked).
- The **sound** layer (V04) gives a soft paper slide on focus and a folder thump on select. Off by default
  until the user enables it on the title screen (a speaker icon).
- Focus restoration: returning to the menu re-focuses the last chosen item.

## 4. How to play (interactive tutorial)
A guided 5-step overlay on a fixed sample case (offline library "photosynthesis"), with no API calls:
1. "This is a briefing. Some of it is lies." A highlight sweeps the passage.
2. "Tap a sentence you don't trust." It waits for the click. The red-pen ring is drawn.
3. "Say what it should say." A pre-filled correction appears with a typing effect, and the user presses Enter.
4. "How sure are you?" The confidence slider wiggles, then the user drags it.
5. "Submit and face the stamp." A real stamp plays on the result.

The tutorial can be skipped and replayed from the menu. Completion is stored (v0.3 awards a "Recruit" badge).

## 5. Components to build
- `TitleScreen` (client): the sequence, any-key listener, skip logic.
- `MainMenu`, `MenuItem`, `MenuPreview`, `useMenuKeys`.
- `DeskLamp` (engine status as object).
- `SettingsDrawer` (shell only in v0.2).
- `Tutorial` and `TutorialStep` (overlay with a spotlight cut-out, using an SVG mask).
- `ArchivePage` (`/archive`), replacing RecentRounds on the home page.
- `AboutPage` (`/about`), which takes over the old home content.
