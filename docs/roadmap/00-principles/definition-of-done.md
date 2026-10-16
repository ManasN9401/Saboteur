# Definition of done

A ticket is done when all of these hold. If one doesn't apply, say so in the PR.

## Code
- [ ] `npm run typecheck`, `npm run lint` and `npm test` pass. `npm run build` succeeds.
- [ ] Pure logic (scoring, streaks, XP, profile maths, migrations) has unit tests. Aim for 100% of
      branches in `lib/` files with no I/O.
- [ ] No new `any`. Data crossing a boundary (API, storage, LLM) is parsed with Zod.
- [ ] Storage access goes through `lib/store` (or its successor) and survives a throwing `localStorage`.
- [ ] Next 16 rules respected: client hooks reading route data are inside `<Suspense>`, and route
      handlers that must be dynamic call `await connection()`. Check `node_modules/next/dist/docs` for
      anything unfamiliar.

## Experience
- [ ] Works at 360 px wide with no horizontal scroll, and at 1440 px without looking stretched.
- [ ] Works with keyboard alone. Focus is visible and the order is logical. Escape closes overlays.
- [ ] `prefers-reduced-motion` gives a calm version: no parallax, no loops, crossfades instead of slides.
- [ ] Dark ("night desk") and light ("day desk") both checked.
- [ ] Empty, loading, error and offline states designed, not left as defaults.
- [ ] Copy follows the voice in [design-language.md](design-language.md).

## Verification
- [ ] A Playwright script exercises the happy path (scratchpad or `e2e/` once it exists, see v0.5).
- [ ] Screenshot at phone and desktop sizes attached to the PR, plus a short screen recording if it moves.
- [ ] Performance budget checked for any page touched (see [performance-budgets.md](performance-budgets.md)).
