# 00 · Principles

These hold for every version. Each file is short on purpose: link to it from tickets instead of repeating it.

| File | What it covers |
|---|---|
| [definition-of-done.md](definition-of-done.md) | What "finished" means for any ticket |
| [performance-budgets.md](performance-budgets.md) | Hard numbers each page must hit (enforced in v0.5, respected from v0.2) |
| [design-language.md](design-language.md) | The desk metaphor, tokens, type, motion rules and voice |
| [asset-pipeline.md](asset-pipeline.md) | How images, video and sound get from Flow / Nano Banana into `public/` |
| [data-and-storage.md](data-and-storage.md) | Versioned local storage, migrations and the path to a database |

## The five rules

1. **The desk is the interface.** Every screen is something on or above a desk: paper, folders, stamps,
   a loupe, a lamp. No generic dashboards, cards-on-grey or stock UI kits. If a screen can't be described
   as an object, rethink it.
2. **Motion means something.** An animation either shows cause and effect (stamp → verdict), covers a wait
   (loupe), or moves you between places (redaction). Decoration-only motion is ambient and pausable.
3. **Works without the AI.** Every feature has an offline path or degrades with a clear message. Never a
   blank screen or a spinner that never ends.
4. **Local first, then sync.** Profiles, streaks and settings work fully in the browser. The database
   (v0.9) syncs them and never becomes the only copy without the student choosing to sign in.
5. **Honest feedback.** Streaks, XP and badges reward real study. No dark patterns, no guilt notifications,
   no fake urgency. A streak freeze exists because life happens.
