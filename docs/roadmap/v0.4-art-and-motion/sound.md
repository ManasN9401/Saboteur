# Sound

Off by default. A speaker toggle on the title screen asks once ("Sound adds to the desk: turn it on?").

## Kit (≤ 120 KB total, Opus in WebM with an AAC/M4A fallback, mono, 48 kHz)
| ID | Sound | Length | Trigger |
|---|---|---|---|
| ui-focus | Soft paper slide | 80 ms | Menu focus change (throttled to 1 per 60 ms) |
| ui-select | Folder thump | 140 ms | Menu select |
| ui-back | Folder close | 120 ms | Esc / back |
| pen-flag | Felt-tip squeak | 180 ms | Flag a sentence |
| pen-strike | Pen strike | 160 ms | Remove a flag |
| type | Single typewriter key (3 variants) | 40 ms | Title type-on |
| lamp | Switch click | 90 ms | Title lamp on / theme toggle |
| stamp | Stamp thud + ink | 220 ms | Synced to `STAMP_LIFT_AT − 0.12 s` |
| redact | Marker swipe | 260 ms | Redaction transition |
| promote | Two stamps + chime | 600 ms | Rank up |
| ambience-room | Room tone loop | 20 s | Seamless loop at −30 LUFS |
| ambience-rain | Rain on glass loop | 20 s | Weather setting |

## Engine (`lib/sound.ts`)
- One `AudioContext`, created on the first user gesture. Decoded buffers are cached, and samples load
  lazily after the menu is interactive.
- Gain buses: master → ui / fx / ambience, plus ducking (ambience −6 dB while the loupe loader runs).
- Pitch variation ±4% on repeated UI sounds to avoid the machine-gun effect.
- Sound is independent of motion settings (reduced motion doesn't mute). It follows only the sound
  settings and pauses on `visibilitychange`.

## Sources
Generate with an audio model (e.g. ElevenLabs SFX), or use CC0 sources (freesound.org CC0 only). Log
each one in `public/assets/CREDITS.md`.
