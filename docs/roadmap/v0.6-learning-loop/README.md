# v0.6 · Learning loop: calibration, Misconception Profile, personalisation

> Status: ☐ · Estimate: ~6 days · Track: product · Depends on: v0.3 (profiles and storage v2) · Spec: Phase 2, §5, §6.2

## Goal
Turn the data we already collect (confidence bets, error types, misconception labels) into something the
student **sees and benefits from**. Show calibration ("you're overconfident on dates"), build the
Misconception Profile (spec §5), and feed it back so the next rounds target what they get wrong.

## Scope

**Fixed** (from spec Phase 2)
- **Misconception Profile** per profile, built from every graded item. Per misconception label it tracks
  times seen, caught, missed, confident-wrong and last seen, with a decaying strength score. The
  aggregation is pure, in `lib/profile/misconceptions.ts`.
- **Calibration view** (dossier tab):
  - a reliability diagram (confidence bucket vs actual accuracy) using the existing `calibrationBuckets`;
  - the Brier score over time;
  - an "overconfidence index";
  - per-subject and per-error-type breakdowns.
  - It's drawn as an instrument: a brass gauge for the headline number, and a hand-drawn-style SVG chart
    for the detail.
- **Corkboard** (dossier tab): the top misconceptions as index cards pinned on a board, strings linking
  ones with the same subject or error type. Clicking a card gives the history, the explanation from the
  original rounds, and a "**Drill this**" button.
- **Personalised generation:** `GenerateRequest` gains an optional `targets: { label, errorType }[]`.
  - The planter prompt (`lib/prompts/plantErrors.ts`) receives "This student has repeatedly fallen for:
    … Plant at least one error exploiting one of these, if it fits the topic."
  - The offline engine biases `chooseErrors` toward the matching rule types.
- **"Review case"** in the menu (a new folder): a spaced-repetition queue of misconceptions due for review
  (Leitner boxes: 1d, 3d, 7d, 16d). It builds a round targeting 1–2 due items.
- **Post-round insight line** on the reveal: one sentence from the profile, e.g. "That's the 3rd time
  a swapped term has got past you in biology."

**Flexible**
- The strength-score formula (start with exponential decay, half-life 10 days).
- The Leitner intervals.
- The chart style (hand-drawn SVG vs clean).

**Open**
- Should the grader (Haiku) also cluster free-text misconception labels into canonical ones? Recommended:
  yes, a cheap normalisation call that maps labels to a per-profile canonical set, cached. Offline mode
  uses the curated labels as-is.

## Acceptance criteria
- After 5 seeded rounds (fixture), the dossier shows correct calibration buckets, a Brier score and the
  top-3 misconceptions, matching hand-computed values in tests.
- A personalised round includes at least one targeted error in ≥ 70% of LLM generations (measured with a
  20-round eval script against mock and real models) and in 100% of offline ones where a matching rule
  applies.
- The review queue schedules correctly (pure tests with a fake clock).
- Charts are accessible: a data table alternative and text summaries.

## Tasks
| ID | Task | Size |
|---|---|---|
| V06-01 | Misconception aggregation (pure) plus schema in stats; backfill from existing rounds on first run | M |
| V06-02 | Label normalisation (LLM, cached) with offline passthrough | M |
| V06-03 | Calibration tab: gauge, reliability diagram, Brier over time, breakdowns, table alternative | L |
| V06-04 | Corkboard tab: cards, strings, detail drawer, "Drill this" | L |
| V06-05 | `targets` in `GenerateRequest`, planter prompt changes, offline bias, plus an eval script `scripts/eval/targeting.ts` | M |
| V06-06 | Review queue (Leitner) plus "Review case" menu folder plus badge hooks | M |
| V06-07 | Reveal insight line | S |
| V06-08 | e2e: seeded profile → dossier numbers → drill → targeted round | M |
