# v0.7 · Wrong Answer Autopsy

> Status: ☑ (17 Oct; real-model eval and the manual review outstanding, see Progress) · Estimate: ~5 days · Track: product · Depends on: v0.6 (Misconception Profile) · Spec: §6.3, §10.6, §10.7, Phase 3

## Goal
The student brings marked work they got wrong (pasted text first, then a photo, screenshot or PDF page).
Saboteur diagnoses the **misconception behind each wrong answer**, the student confirms or rejects it,
and confirmed ones go into the profile with targeted check questions.

## Experience (desk metaphor: the coroner's tray)
1. **Intake**: a tray labelled "Bring out your dead". Paste "question / my answer / correct answer"
   blocks, or drop an image (v0.7b). Subject and level are pre-filled from the profile.
2. **Examination**: the loupe loader (reused) reads the submitted work.
3. **Findings**: each wrong answer becomes a **toe-tag card**:
   - the question, your answer and the correct answer;
   - the diagnosis, or for low confidence a question ("Did you think resistance adds up in parallel?");
   - buttons: **That's it** / **Not quite** / **Just a slip**.
   - `careless_slip` items are shown greyed, "No misconception, just a slip", and are never forced into the profile.
4. **Treatment**: for each confirmed misconception, 2–3 targeted multiple-choice questions (spec §10.7).
   One option in each is the trap answer, and it's marked as such in the explanation.
5. **Report**: the confirmed misconceptions are pinned to the corkboard (v0.6) with status `confirmed`.
   Passing the check questions moves them toward `resolved`.

## Scope

**Fixed**
- Text intake. A parser that copes with numbered lists, "Q:/A:" formats and tables pasted from a doc.
- Diagnoser prompt (§10.6) and question writer (§10.7) with Zod schemas, through `callJSON`.
- The confirm/reject flow and the profile updates (`confirmed`, `rejected`, `resolved` states, with history).
- **Privacy:** images are never stored; only the extracted text and diagnoses are kept. Say this on the intake screen.
- **Offline fallback:** without an LLM there's no diagnosis, so give an honest message and offer
  "log this as a misconception yourself" (manual entry). Fixed, because it's principle 3.

**Flexible**
- **v0.7b image intake:** a vision call (Sonnet with image input), PDF page rendering client-side with
  pdf.js into an image. It can slip to v0.8 if time is short.
- Number of check questions (2–3).

**Open**
- Should check questions recur in the v0.6 Review queue? Recommended: yes, as a second item type
  alongside targeted Saboteur rounds.

## Acceptance criteria
- 15 hand-made fixture worksheets (maths, physics, chemistry, biology, economics) produce sensible
  diagnoses in ≥ 80% of items by manual review. Slips are flagged as slips in ≥ 70% of the planted slip cases.
- No image bytes persist anywhere: no server memory after the request, no localStorage, no logs. There's a test on the route.
- Full flow by keyboard. Toe-tag cards work on mobile.

## Tasks
| ID | Task | Size |
|---|---|---|
| V07-01 | Schemas plus prompts (`autopsyDiagnose.ts`, `targetedQuestions.ts`) plus mock fixtures | M |
| V07-02 | `/api/autopsy/diagnose` and `/api/autopsy/questions` routes (NDJSON progress, `connection()`) | M |
| V07-03 | Intake parser (pure, tested on 10 messy paste formats) | M |
| V07-04 | Intake UI (tray), findings (toe-tag cards), confirm/reject | L |
| V07-05 | Treatment: MCQ component with confidence bet, trap-answer explanations | M |
| V07-06 | Profile integration (status transitions, history, badge "Coroner") | S |
| V07-07 | Offline manual-entry path | S |
| V07-08 | *(flexible, v0.7b)* Image/PDF intake with vision; privacy test | L |
| V07-09 | Menu: unlock the Autopsy folder; tutorial card | S |
| V07-10 | Eval script plus fixtures (`scripts/eval/autopsy.ts`) | M |

## Progress

**Shipped (17 Oct).** Verified end to end against the mock model (`e2e/autopsy.mjs`, 10 checks: paste →
toe tags → check questions → report → corkboard, then a photo on a phone) and offline (manual logging).

| Task | State | Notes |
|---|---|---|
| V07-01 schemas, prompts, mocks | ☑ | `lib/autopsy/schema.ts`; `lib/prompts/autopsyDiagnose.ts` (Sonnet, medium effort; reads a picture when one is sent) and `targetedQuestions.ts`. Diagnoses: misconception or slip, label, error type, explanation, the right idea, confidence, a probe question below 0.6, subject and a short revision topic. `tidy()` enforces one per item and drops probes the model shouldn't have asked |
| V07-02 routes | ☑ | `/api/autopsy/diagnose` (NDJSON progress) and `/api/autopsy/questions`. Offline, or if the AI is unreachable, both say so plainly |
| V07-03 intake parser | ☑ | `lib/autopsy/parse.ts`, 10 formats tested (labelled blocks, numbered lists, tab/markdown/CSV tables with columns in any order, separators, inline labels, bracketed corrections, bare three-line blocks, multi-line questions). Matching answers and missing corrections are set aside |
| V07-04 tray and toe tags | ☑ | `/autopsy`: steel tray (CSS until the generated tray arrives), loupe while examining, toe tags with That's it / Not quite / Just a slip; a disputed slip lets the student name the belief |
| V07-05 treatment | ☑ | `components/autopsy/CheckQuestions.tsx`: one question at a time, confidence bet, right answer and trap both explained |
| V07-06 profile | ☑ | `lib/learning/autopsy.ts`: confirmed / rejected / resolved with history on each misconception. Confirmed = a miss weighted like a confident one, into review box 0. Check questions all right = resolved and up a box; their bets count towards calibration. Coroner badge on the first confirmation |
| V07-07 offline | ☑ | Blank tags: "What did you believe?" plus an optional kind of mistake |
| V07-08 photo intake | ◐ | Photos and screenshots: shrunk to 1600 px and re-encoded as JPEG in the browser, read once by the model, never stored or logged (tests on success and failure paths; e2e checks browser storage). **PDF pages not yet** (pdf.js rendering): the page suggests a screenshot |
| V07-09 menu | ☑ | Autopsy folder in the menu; a three-step first-visit card on the page |

**Acceptance still to run with a real key:** `npm run eval:autopsy` diagnoses the 15 fixture worksheets
(`lib/autopsy/fixtures.ts`, 50 wrong answers, 8 planted slips) and writes a side-by-side report to
`eval-out/` for the manual "sensible in ≥ 80%" review; it prints the slip rate (target ≥ 70%). Against
the mock: 50/50 kinds, 8/8 slips (a pipeline check only).

**Open question:** check questions don't recur in the Review queue yet. Confirmed misconceptions do join the
queue, and a review case targets them with a planted round.
