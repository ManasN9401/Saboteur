# v0.8 build plan: the line-up (Confusables)

Written 18 Oct 2026, before starting. Root Gap (part B of the README) is planned after the line-up ships;
it may move past 1.0 as the README allows.

## What exists to build on
- **Art:** `public/assets/lineup/wall[@2048].{avif,webp}` (police line-up wall; its five name plates are
  measured in `scripts/assets/batch11.py`), `public/assets/lineup/placard.webp` (black letter board,
  letters typed in code).
- **Learning model (v0.6):** misconceptions keyed by label, sightings with a `source`, calibration
  tallies from confidence bets. A confused pair becomes a misconception like any other.
- **Offline library:** 30 topics, many with hand-written `swapped_terms` errors that already name the
  confusable pair (thylakoid/stroma, infiltration/run-off, shift/movement along a curve…). These seed the
  offline line-ups.
- **AI plumbing:** `lib/llm.ts` (`callJSON`, router failover, budget), `lib/security` (guard, limits),
  the `verify` pattern from the round pipeline, mock answers in `lib/mock.ts`.
- **Badge:** "Line-up" in `lib/progress/badges.ts`, waiting for a test.

## Data shapes (`lib/lineup/schema.ts`, Zod)
- **Suspect:** `id`, `name` (≤ 3 words, fits a placard), `features` (2–4 distinguishing features, each
  a short phrase), `hook` (one memory hook).
- **Group:** `id`, `suspects` (2–4; the wall has five plates, so never more than four plus a spare),
  `why` (why people mix them up).
- **Item:** `id`, `groupId`, `statement` (one sentence, no names given away), `answer` (suspect id),
  `feature` (the distinguishing feature that decides it), `explanation` (one sentence).
- **Lineup:** `topic`, `level`, `groups` (1–4 per session; the README's 3–8 is across sessions),
  `items` (10–15), `source` ("ai" | "library").

## Pieces, in build order
1. **V08-01 schema, prompt, verifier, route.**
   - `lib/prompts/lineupGenerate.ts`: from a topic or a list of the student's confused pairs, produces
     groups and items.
   - `lib/prompts/lineupVerify.ts`: a second pass answers each item blind. Items it gets wrong or calls
     ambiguous are dropped; under 8 left → regenerate once, then fail politely.
   - `app/api/lineup/route.ts` (guarded, new `lineup` rate-limit bucket), offline fallback, mock answers.
2. **V08-02 drill engine (`lib/lineup/drill.ts`, pure, fully tested).**
   - Queue: interleaved across groups, never the same answer three times running.
   - Scoring with the confidence bet (as rounds).
   - Confusion matrix per group, per-pair accuracy.
   - `confusedPairs`: a pair confused ≥ 2 times.
3. **V08-04 offline line-ups:** an optional `confusables` field on library topics, written by hand for
   ≥ 15 topics (marked `unreviewed` until B-01 review).
4. **V08-03 the UI (`app/lineup/page.tsx`).**
   - **Pick:** a topic, or "From my weak spots" (the confused pairs and swapped-terms misconceptions
     in the profile).
   - **The suspects:** the line-up wall with each suspect's placard at a name plate, typed in white
     peg letters; their features and hook on cards below. Study as long as you like.
   - **The drill:** one statement at a time; tap or drag it to a suspect, or press 1–4; then the
     confidence bet. Feedback names the deciding feature.
   - **Verdict:** accuracy per pair and a stamp. Confused pairs are filed to the profile.
5. **Profile hook.** Sightings with `source: "lineup"`; a confused pair files a `swapped_terms`
   misconception labelled "Confuses X with Y" (merging with the same label from rounds); bets feed
   calibration; it goes into the review queue like the rest.
6. **V08-09 menu, badge, e2e, docs.**
   - A "Line-up" folder in the menu tray, and the Line-up badge.
   - `e2e/lineup.mjs`: mock, offline, keyboard and phone.
   - `scripts/eval/lineup.ts`: 10 topics through the real models for the README's acceptance check
     (≥ 8/10 judged genuinely confusable).

## Decisions taken (change any before I start)
- **Prompt:** the spec's §10.8 prompt isn't in this repo, so the prompt is written from the README. If
  the spec text exists, it replaces this.
- **Tap first, drag as well:** tapping a placard (or 1–4) is the main input, because it works on phones
  and keyboards. Dragging the statement card to a placard is an extra on wide screens.
- **Session size:** 1–2 groups and 10–15 items, about five minutes.
- **The menu:** "Line-up" becomes a ninth folder. The tray grows by one stride (64 px), which still
  fits at 1440 × 900; on short screens the tray already scrolls.
- **Rapid line-up** (timer mode) and interleaving with earlier groups wait for v0.8.x.

## Estimate
About 3 days for the line-up, as in the README; Root Gap another 4.
