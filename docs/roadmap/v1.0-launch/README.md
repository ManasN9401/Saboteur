# v1.0 · Launch

> Status: ☐ · Estimate: ~5 days · Depends on: everything before it (v0.8 Root Gap may be cut) · Spec: Phase 5, §13–§15

## Goal
Make it safe to put in front of strangers, judges and teachers: accessible, reliable, legally covered,
measurable, and with a demo mode that can't fail on stage.

## Checklist

### Accessibility (WCAG 2.2 AA)
- [ ] An axe-core scan in CI on every route plus manual screen-reader passes (VoiceOver iOS/macOS, NVDA).
- [ ] Every animation has a reduced-motion version. Nothing flashes more than 3 times per second (redaction bars checked).
- [ ] Colour contrast in all themes and pen colours. The colour-blind stamp set is verified.
- [ ] Touch targets ≥ 44 px. **Fix the known issue:** the mobile flag sheet covers the sentence being
      flagged. Scroll the sentence above the sheet, or use a half-height sheet with the sentence pinned.
- [ ] Focus management on every overlay (loader, submit dialog, settings, tutorial, profile picker).

### Content quality (spec §15)
- [ ] Generate rounds on 10 diverse topics × 3 difficulties with the real models and check them by hand.
      Log failures in `docs/quality/round-review.md` and tune the prompts.
- [ ] The "dispute this" button (spec §14) for both planted errors and "correct" sentences. A dispute
      removes the penalty and is logged for review.
- [ ] Offline library: ≥ 60 topics, each reviewed by a second person (backlog B-01).
- [ ] Rule-based sabotage audit: run 500 seeded offline rounds and flag term swaps that might still be
      true. Add a deny-list.

### Demo mode (spec §13)
- [ ] `?demo=1` or `SABOTEUR_DEMO=1` loads pre-generated rounds from `data/demo/*.json`, a seeded demo
      profile with realistic history (calibration chart not empty, 3 misconceptions, a 12-day streak) and
      a personalised round that visibly targets a tracked misconception.
- [ ] Works with Wi-Fi off (PWA plus demo data).
- [ ] A presenter shortcut panel (`Shift+D`): jump to reveal, reset profile, toggle offline.

### Reliability and operations
- [ ] An uptime check on `/api/health`. Alerting on error-rate spikes (from v0.5 monitoring).
- [ ] LLM cost dashboard: tokens per round and per day, alert at a threshold. Model and effort settings reviewed.
- [ ] Graceful degradation drills: bad API key, 429, 529 overload, slow network. Each lands in offline or
      a friendly retry. Document this in `docs/runbook.md`.
- [ ] Back-ups of the database (provider snapshots) and a tested restore.

### Legal and trust
- [ ] Privacy policy (what's stored locally vs on the server, no image retention, LLM processing by
      Anthropic), terms, and cookie notice if analytics needs it.
- [ ] Age guidance (students under 13: no account without guardian consent; local-only works).
- [ ] An "AI wrote this, deliberately with mistakes" disclaimer on every shared or printed reveal, so
      sabotaged text never circulates without its corrections.

### Launch surface
- [ ] `/about` landing polished: real screenshots and a 20 s capture video.
- [ ] OG images per route (dynamic OG for shared results).
- [ ] Changelog page (`/changelog`) fed from `docs/roadmap/` status lines.
- [ ] A feedback button (in-app form going to an email or issue tracker).
- [ ] README rewritten for contributors plus `docs/architecture.md`.

## Exit criteria
- All checklist items ticked, or explicitly deferred with a reason in [backlog](../backlog/).
- Lighthouse ≥ 90/95/95/95 (Perf/A11y/BP/SEO) on mobile for `/`, `/menu`, `/play`, `/results/[id]`.
- 5 external testers complete onboarding → 3 rounds → dossier without help, with SUS score ≥ 75.
- The demo script (spec §13) runs end-to-end 3 times in a row with no network.
