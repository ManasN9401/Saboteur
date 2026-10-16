# Customisation

Settings drawer (index-card drawer) with tabs. **Device** settings apply before a profile is chosen.
**Profile** settings follow the player.

| Setting | Scope | Options | Default | Implementation |
|---|---|---|---|---|
| Theme | profile | Day desk · Night desk · Follow system · Auto by time (07–19 day) | Follow system | `data-theme` on `<html>`, set by an inline pre-paint script |
| Desk surface | profile | Oak (current) · Walnut · Green baize · Steel · Plain (no photo, fastest) | Oak | `--photo` swap; v0.4 supplies the plates |
| Pen colour | profile | Red · Blue · Green · Violet | Red | `--pen` plus the matching ink-underline SVG stroke |
| Stamp ink | profile | Classic (red/green) · Monochrome · Colour-blind safe (blue/orange + shape cues) | Classic | `--catch`/`--miss` tokens; stamp text already differs |
| Text size | profile | 90% · 100% · 115% · 130% | 100% | root `font-size` scale |
| Density | profile | Comfortable · Compact | Comfortable | spacing tokens |
| Passage font | profile | Newsreader (serif) · Atkinson Hyperlegible · OpenDyslexic | Newsreader | Load the font only on choice |
| Motion | device | System · Reduced · Full · Cinematic (extra ambient) | System | `data-motion`; components read a `useMotion()` hook |
| Ambient scene | device | On · Off | On (off when reduced) | scene engine pauses |
| Sound | device | Master on/off, volume, UI sounds, stamp, ambience (room tone, rain on window) | Off until first enabled | WebAudio, see v0.4 |
| Default difficulty / level | profile | — | Last used | setup pre-fill |
| Error count hint | profile | Hidden (spec) · Show "2–4" · Show exact | Hidden | gameplay |
| Confidence input | profile | Slider · 5 buttons | Slider | accessibility |
| Title screen | device | Always · Once per session · Never | Once per session | |
| Engine | device | Auto · Force offline | Auto | sends a header, honoured by `/api/saboteur/*` |
| Data | profile | Export · Import · Reset stats · Delete profile | — | |

## Implementation notes
- `lib/prefs.ts`: Zod schema with defaults, `usePrefs()` via `useSyncExternalStore`, `applyPrefs(prefs)`
  that writes CSS variables and data attributes.
- **No flash**: `app/layout.tsx` includes a tiny inline script (< 600 bytes) that reads `saboteur:v2:device`
  plus the active profile's theme and sets attributes before first paint.
- Every visual option is a token. Components never branch on theme names.
- Preview: the settings drawer shows a live mini "case file" sample on the right that updates as options change.
