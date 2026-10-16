# v0.5 · Performance, efficiency and installability

> Status: ☐ · Estimate: ~4–5 days, plus ongoing checks · Track: craft · Depends on: v0.4 (measure after the art lands)

## Goal
Hit every number in [performance-budgets.md](../00-principles/performance-budgets.md) on a cheap phone,
make it installable (PWA), and put guard rails in CI so later versions can't regress.

## Scope

**Fixed**
- **Measure first:** a baseline Lighthouse, a bundle analyser and a performance trace of each route,
  committed as `docs/perf/baseline-v0.4.md`.
- **CI** (GitHub Actions):
  - typecheck, lint and unit tests;
  - build;
  - Playwright e2e (mock and offline engines);
  - Lighthouse CI with budgets (fail on regression > 10%);
  - bundle-size check per route;
  - visual regression.
- **Bundle:**
  - split heavy client components (`RevealDiff`, `StampVerdict`, settings drawer, tutorial) with
    `next/dynamic`;
  - move static parts of pages to Server Components, now that the menu and archive are data-driven;
  - check that Zod isn't shipped to pages that don't need it (zod/mini or server-only parsing);
  - tree-shake the date utilities.
- **Rendering:**
  - `content-visibility: auto` on long archive lists;
  - virtualise the archive above 100 rows;
  - memoise the sentence list so typing a correction doesn't re-render every sentence (measure INP before and after).
- **Assets:**
  - AVIF/WebP with `sizes`, priority only on the plate;
  - lazy-load video and sound after first interaction or idle (`requestIdleCallback`);
  - preconnect hints;
  - `fetchPriority` on the LCP image.
- **Fonts:** subset; `display: swap` where needed; drop unused weights; load the hand font on demand.
- **Server:**
  - the generate stream sends its first byte at once;
  - `/api/engine` is cached;
  - LLM prompt caching (`cache_control` on the system prompts, which are long and static);
  - parallelise where the pipeline allows (verify can start per-error);
  - timeouts and abort on client disconnect, so tokens aren't wasted.
- **PWA:**
  - manifest and icons;
  - a service worker (Serwist or a hand-rolled one) that pre-caches the app shell, plates, fonts, offline
    library and offline engine code, so **offline mode works with no network at all** for library topics
    and pasted notes;
  - an "install" option in settings.
- **Runtime health:**
  - an error boundary per route with friendly desk-themed screens;
  - `reportWebVitals` to a lightweight endpoint (or Vercel Analytics);
  - Sentry (or similar) for client and server errors, with PII scrubbing.

**Flexible**
- PWA tooling choice. Sentry vs Highlight vs self-hosted. Vercel Analytics vs Plausible.
- Moving the offline engine into a Web Worker (do it only if generation blocks the main thread > 50 ms).

**Open**
- Hosting: Vercel (simplest, matches Next 16), or a container (needed if the in-memory round store
  persists before v0.9). Recommendation: Vercel plus a KV store for rounds, pulled forward from v0.9 if
  needed (see V09-03).

## Acceptance criteria
- All budgets met on the reference low-end profile for `/`, `/menu`, `/play`, `/play/[id]` and `/results/[id]`.
- Lighthouse Performance ≥ 90 mobile and ≥ 98 desktop, Best Practices ≥ 95, PWA installable.
- A round on a library topic can be played and graded **with the network disabled** after one prior visit.
- CI is green and blocks merges on budget regressions.
- 10 consecutive rounds in one tab: heap within +10% of round 1, and no growth in detached DOM nodes or
  active rAF loops.

## Tasks
| ID | Task | Size |
|---|---|---|
| V05-01 | Baseline measurements doc plus bundle analyser script | S |
| V05-02 | GitHub Actions: check, test, build, e2e (mock and offline), Lighthouse CI, size-limit | M |
| V05-03 | Promote the scratchpad Playwright scripts into `e2e/` with fixtures and visible-only locators | M |
| V05-04 | Dynamic imports for heavy client components; RSC conversion of static sections | M |
| V05-05 | Round-screen render profiling plus memoisation; INP before/after | S |
| V05-06 | Archive virtualisation plus `content-visibility` | S |
| V05-07 | Image/video/sound loading strategy (priorities, idle loading, preload hints) | S |
| V05-08 | Font subsetting and on-demand hand font | S |
| V05-09 | Prompt caching plus abort-on-disconnect plus per-step timeouts in `lib/llm.ts`/pipeline | M |
| V05-10 | PWA: manifest, icons, service worker, offline pre-cache, update prompt ("New edition of Saboteur available") | L |
| V05-11 | Error boundaries plus desk-themed 404/500/offline pages | S |
| V05-12 | Error monitoring plus web-vitals reporting with PII scrubbing | S |
| V05-13 | Memory soak test (10 rounds) in Playwright with `performance.memory` / CDP heap | S |
| V05-14 | Carry-over: any v0.3 flexible QoL items that slipped | M |
