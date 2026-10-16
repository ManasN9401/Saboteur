# Saboteur

Study by catching the lies. Saboteur writes a clear explanation of any topic, hides 2–4 believable
mistakes in it, and makes you find and fix them while betting on your confidence.

This is Phase 0 + Phase 1 of `saboteur-context.md`: the generate → plant → verify pipeline, the round
screen, grading, and the reveal screen.

## Run it

```bash
npm install
cp .env.local.example .env.local   # then set ANTHROPIC_API_KEY
npm run dev                        # http://localhost:3000
```

No key? It still works: see **Offline mode** below. (`SABOTEUR_MOCK=1` is a separate test switch that
runs the AI pipeline against canned answers.)

Other commands:

```bash
npm test            # Vitest: scoring, diff, pipeline (mock LLM), JSON parsing
npm run typecheck
npm run lint
npm run build && npm start
```

`GET /api/health` is the Phase 0 smoke test: one validated JSON round trip through `callJSON`.

## How it fits together

- `lib/llm.ts`: `callJSON(prompt, schema)` calls Claude, extracts the JSON, validates it with Zod, and
  retries once with the validation error appended.
- `lib/prompts/`: the four prompts from spec section 10 (writer, planter, verifier, grader).
- `lib/pipeline.ts`: write → plant → verify, with up to two verifier-driven retries. Accidental errors in
  "correct" sentences are cut (or the passage rewritten); invalid or too-obvious errors are replanted, then
  dropped if needed as long as two remain.
- `lib/roundStore.server.ts`: planted errors stay in server memory until you submit. A server restart
  loses open rounds; the grade route then asks you to start a new one.
- `lib/scoring.ts`: pure scoring and calibration (points, multipliers, Brier, buckets).
- `lib/storage/` and `lib/profile/`: versioned, per-profile storage (`saboteur:v2:p:<id>:…`). Every blob
  is read back through Zod, and an unreadable one is set aside as `…:corrupt:<time>` rather than thrown.
  v1 data migrates into "Player 1" once, with its streak and badges rebuilt from the old rounds.
  `lib/store.ts` keeps the old API on top of the active profile.
- `lib/progress/`: streaks (freezes, rest days, repairs), XP, ranks and the 20 badges, as pure functions
  of one event: a round completed. A round counts once, however often the reveal is reloaded.
- `lib/daily.ts`: the daily case, chosen from the date (no subject twice in four days, difficulty by
  weekday) and rebuilt by the server on demand, so it is the same everywhere and never expires.
- `lib/prefs.ts`: settings become attributes on `<html>` (`data-theme`, `data-pen`, `data-ink`,
  `data-motion`…), applied before first paint by an inline script, so a chosen theme never flashes.
- Models, effort levels and point values live in `lib/config.ts`.

## Offline mode (no AI)

When there is no `ANTHROPIC_API_KEY`, when `SABOTEUR_ENGINE=offline`, or when the AI can't be reached
mid-request (bad key, rate limit, outage, no network), Saboteur builds and marks rounds with rules:

- **Source text** (must be correct, since every unchanged sentence counts as true), in this order: the
  student's pasted notes; a built-in library of 30 topics across ten subjects (`lib/offline/library.ts`
  and `library-extra.ts`, with hand-written errors); the opening of the matching Wikipedia article, credited on the round.
- **Planting** (`lib/offline/sabotage.ts`): reverses a direction (increases↔decreases, absorbs↔releases,
  left↔right, before↔after), shifts a year, date, percentage or count, turns "usually/can/most" into
  "always/all", drops an "except…" clause, or swaps in a term from elsewhere in the passage. Each comes with
  an explanation and a "why it's tempting". Rules are chosen to spread error types and match the difficulty.
- **Checking**: rule-based sanity checks stand in for the AI fact-checker.
- **Marking** (`lib/offline/grade.ts`): a correction that names the restored word or number is correct;
  one that names the planted word is partly right; anything else is the wrong reason.

Offline rounds are labelled on screen with their source. Rule-based errors are less varied and less subtle
than the AI's, and a term swap can occasionally land on something still true, so the AI remains the
better experience when available.

## Art assets

Generated in Google Flow, processed by the scripts in `scripts/assets/` (sources in `assets-src/`,
credits in `public/assets/CREDITS.md`):

- **Desk photos** (`public/assets/desk/`): day, dusk (17:00–19:59 local time) and night (dark mode), in
  AVIF and WebP, with a larger file for wide screens. `?daypart=dusk` previews dusk.
- **Loupe** (`public/assets/props/loupe.*`): cut out with no baked shadow and drawn at its real angle.
  Its shadow comes from its own silhouette, and its path (`lib/motion/path.ts`) is a closed loop that
  reads each line and swings back without a jump.
- **Stamps**: wide screens get the hand (`public/assets/stamp.*`), phones get the floating stamp
  (`public/assets/fx/stamp-floating.*`). Both play with multiply blending over the card; the ink mark
  appears as the stamp lifts. Set `NEXT_PUBLIC_STAMP_VIDEO=0` to use the coded animation instead.

## Troubleshooting

If a style change doesn't show up in `npm run dev`, stop the server, delete `.next/dev` and start it
again: Turbopack's on-disk cache sometimes keeps serving an old stylesheet.

## Roadmap

The plan from here to v1.0 (front-door menu, profiles and streaks, art and motion rebuild, performance,
the learning loop and the remaining spec modes) lives in [`docs/roadmap/`](docs/roadmap/README.md).
