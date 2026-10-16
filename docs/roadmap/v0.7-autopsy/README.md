# v0.7 · Wrong Answer Autopsy

> Status: ☐ · Estimate: ~5 days · Track: product · Depends on: v0.6 (Misconception Profile) · Spec: §6.3, §10.6, §10.7, Phase 3

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
