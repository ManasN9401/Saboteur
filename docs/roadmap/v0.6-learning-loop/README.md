# v0.6 · Learning loop: calibration, Misconception Profile, personalisation

> Status: ☑ (17 Oct; real-model targeting eval outstanding, see Progress) · Estimate: ~6 days · Track: product · Depends on: v0.3 (profiles and storage v2) · Spec: Phase 2, §5, §6.2

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

## Progress

**Shipped (17 Oct).** Exit path verified end to end on a seeded profile (`e2e/learning-loop.mjs`): dossier
numbers → Drill this → targeted round → reveal insight → Review case from the menu.

| Task | State | Notes |
|---|---|---|
| V06-01 aggregation | ☑ | `lib/learning/` (not `lib/profile/misconceptions.ts`): `schema.ts`, `model.ts` (pure `learnFromRound`), `views.ts`. Stored as `stats.learning`, so export/import carry it. Profiles from before v0.6 learn from their saved rounds the first time. Strength: miss +1, wrong fix +0.5, catch −0.5, confident miss +0.5 extra, half-life 10 days. Hand-computed 5-round fixture in `learning.test.ts` |
| V06-02 normalisation | ☑ | Keys fold case, punctuation, filler words and plurals (`labels.ts`). After each round, unchecked labels go to `/api/learning/normalise` (grading model, low effort) and duplicates are merged (`mergeInto`). Offline, mock or on failure: passthrough |
| V06-03 calibration tab | ☑ | Brass gauge (points over/underconfident), reliability chart, Brier per case, by subject, by kind of error; each with a sentence, charts with a table alternative |
| V06-04 corkboard | ☑ | "Weak spots" tab: index cards on cork, string between cards sharing a subject (red) or kind of error (black), drawn behind the cards and dropped on one column. Card → history drawer → Drill this |
| V06-05 targets | ◐ | `targets` in `GenerateRequest`; planter prompt; offline bias (library label/type first, rule fallback). `npm run eval:targeting`: offline 20/20 exact, 11/11 where the type was possible; mock LLM 20/20. **Not yet run against the real model** (no API key in this environment): run `npm run eval:targeting -- llm` |
| V06-06 review queue | ☑ | Leitner boxes 1/3/7/16 days, then retired; a catch moves up a box only once due. "Review case" folder appears in the menu while anything is queued; targets the most overdue misconception plus one more on the same topic. Badge hook: **Reformed** (retire one), art from batch 11 |
| V06-07 insight line | ☑ | Handwritten under the verdict headline, straight after a round: repeat miss → comeback catch → error type in this subject → error type overall → calibration |
| V06-08 e2e | ☑ | `e2e/learning-loop.mjs` + `e2e/seed.mjs` (13 checks) |

Open question resolved: label clustering is on (as recommended), cached per profile as `aliases`.
