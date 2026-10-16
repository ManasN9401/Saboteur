# v0.8 · Confusables Trainer and Root Gap Finder

> Status: ☐ · Estimate: ~7 days (Confusables 3, Root Gap 4) · Track: product · Depends on: v0.6 · Spec: §6.4, §6.5, §10.8, §10.9, Phase 4

Ship **Confusables first**. Root Gap is the stretch and can move to post-1.0 without hurting the launch.

## A. Confusables Trainer: "the line-up"

**Experience**
1. Pick a topic (or "from my weak spots", using v0.6 confusion items).
2. **The suspects**: 3–8 groups shown as line-up cards (mitosis | meiosis), each with its distinguishing
   features and memory hook. Study for as long as you like.
3. **The drill**: 10–15 short statements, one at a time. Classify each by dragging it to a suspect (or
   pressing 1/2/3), with a confidence bet. Instant feedback names the **distinguishing feature** that
   decided it.
4. **Verdict**: accuracy per pair. A pair confused ≥ 2 times becomes a `confusion` misconception in the profile.

**Scope**
- Fixed:
  - the §10.8 prompt and Zod schema;
  - the drill engine (pure: queue, scoring, confusion matrix);
  - profile integration;
  - keyboard and touch.
- Flexible: drag vs tap; a timer mode ("rapid line-up"); interleaving with previous groups.
- Offline: the library gets an optional `confusables` field per topic. Offline Confusables uses only
  those (target ≥ 15 topics with confusables by v1.0). Otherwise show a clear "needs AI" message.

**Acceptance**
- 10 topics produce groups a subject expert agrees are genuinely confusable (manual review ≥ 8/10).
- Each drill item is decidable by the stated feature (a verifier pass, reusing the `verify` pattern, rejects ambiguous items).

## B. Root Gap Finder: "the evidence tree"

**Experience**
1. "I'm stuck on ___". The level is pre-filled.
2. The prerequisite tree is generated (depth ≤ 3, ≤ 3 children) and pinned on the corkboard as cards with
   string. It's hidden at first and revealed as you go.
3. A diagnostic question at the top prerequisite. Right → move sideways; wrong → go deeper. The traversal
   lives in **code** (`lib/rootgap/traverse.ts`, pure, tested), not the LLM.
4. **Gap found**: the path is highlighted in red string ("Integration by parts → Product rule →
   Differentiating products ← gap"). The root-gap card gets stamped.
5. **Fix**: a short Saboteur round on the gap concept, then "retry the original".

**Scope**
- Fixed: the §10.9 prompt, Zod tree schema with depth/width validation, traversal engine, evidence-board
  UI, chaining into Saboteur.
- Flexible: the tree layout algorithm (a simple tidy-tree vs a force layout; tidy-tree recommended for
  determinism); free-text vs multiple-choice diagnostics (MCQ is easier to grade offline and with Haiku).
- Offline: not available ("needs AI"), unless it's a library topic with a hand-made tree (backlog B-07).

**Acceptance**
- The traversal engine has 100% branch coverage including "all pass" and "depth limit".
- 10 concepts across maths and science give trees a tutor agrees with (≥ 7/10).

## Tasks
| ID | Task | Size |
|---|---|---|
| V08-01 | Confusables schema, prompt, verifier, route | M |
| V08-02 | Drill engine (pure) plus confusion matrix plus profile hook | M |
| V08-03 | Line-up UI (suspect cards, drag/tap classify, feature-based feedback) | L |
| V08-04 | Offline confusables data for ≥ 15 library topics | M |
| V08-05 | Root Gap schema, prompt, route | M |
| V08-06 | Traversal engine (pure, tested) | M |
| V08-07 | Evidence-board UI (tidy tree, string SVG, reveal animation) | L |
| V08-08 | Chain into a Saboteur round on the gap concept, then a retry | S |
| V08-09 | Menu unlocks plus tutorial cards plus badges | S |
