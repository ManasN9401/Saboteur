# Backlog: ideas parking lot

Not scheduled. Pull an item into a version folder when it earns a slot. Items cut from versions land
here with a note saying where they came from.

| ID | Idea | Notes | Size |
|---|---|---|---|
| B-01 | **Library growth programme** to 60+ topics | Format: `{ title, aliases, subject, level, sentences[], errors{index: {sabotaged, type, explanation, tempting, label}}, confusables?, reviewer }`. Each entry checked by a second person against a textbook. Subject spread: bio, chem, phys, maths, history, geography, economics, CS, English, psychology. **Status (16 Oct):** 30 topics across all ten subjects; the 22 added in v0.3 are `reviewer: "unreviewed"` until checked | L (ongoing) |
| B-02 | **Versus mode**: two players, same passage, the fastest accurate finder wins | Needs v0.9 realtime (Supabase realtime / Pusher). Spec stretch | L |
| B-03 | **Teacher / classroom mode**: generate a case for a class and see aggregate misses | Needs v0.9 accounts plus roles. Spec stretch. Big potential | XL |
| B-04 | **Reverse mode**: "Bring your own sabotage". The student writes an explanation and the AI finds real errors | Spec stretch | M |
| B-05 | **Sabotaged worked examples**: errors in maths derivation steps, with KaTeX rendering | Spec stretch | L |
| B-06 | **Sabotaged diagrams**: a labelled diagram with a wrong label | Needs diagram assets or generation | L |
| B-07 | Hand-made root-gap trees for library topics (offline Root Gap) | After v0.8 | M |
| B-08 | **Exam-board alignment**: paste a spec and keep content within it, with tagging by spec point | Spec stretch | M |
| B-09 | Seasonal desk themes (Halloween candlelight, winter frost on the window) | Pure art. Fun for retention | S each |
| B-10 | **Case-file narrative / campaign**: a chain of cases with a light story ("the mole in the biology department"), unlocking desk props | Retention feature. Needs writing | L |
| B-11 | Native app shells (Capacitor) for app stores | After the PWA proves itself | M |
| B-12 | i18n (the spec mentions a language topic). UI strings extracted to a messages file | Do the extraction early (cheap), translations later | M |
| B-13 | Voice mode: read the passage aloud with TTS, flag by voice | Accessibility plus novelty | M |
| B-14 | Three.js "hero" scene for the title (a real 3D desk with a lamp you can switch) | Only if the JS budget allows. Lazy-loaded, title only | L |
| B-15 | Leaderboards for the daily case (opt-in, friends only) | Needs v0.9. Careful with pressure on students | M |
| B-16 | Browser push reminders for streaks (opt-in, one per day max, never guilt) | Needs the PWA (v0.5) | S |
| B-17 | Anki / CSV export of misconceptions as flashcards | Easy win for serious students | S |
| B-18 | Rain/weather synced to the user's real local weather | Cute. Needs a weather API | S |
