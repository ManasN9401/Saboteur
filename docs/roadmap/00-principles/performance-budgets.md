# Performance budgets

**Reference devices.** Desktop is a 2020 MacBook Air in Chrome. Low end is a Moto G Power-class Android
in Chrome with 4× CPU throttle, plus Lighthouse "Slow 4G".

| Metric | Budget | How measured |
|---|---|---|
| LCP (title screen, cold) | ≤ 1.8 s desktop, ≤ 2.5 s low end | Lighthouse CI, median of 3 |
| INP (any page) | ≤ 150 ms | Web Vitals in the browser plus a Playwright trace |
| CLS | ≤ 0.02 | Lighthouse |
| JS per route (gzip, first load) | ≤ 140 KB for menu, setup and round; ≤ 180 KB for reveal | `next build` output plus `@next/bundle-analyzer` |
| Images above the fold | ≤ 180 KB total on mobile | DevTools network |
| Ambient animation | Holds 60 fps desktop and ≥ 50 fps low end; ≤ 4 ms main thread per frame | Performance panel |
| Loupe / stamp | No frame over 16 ms during the animation on desktop | Performance panel |
| Memory | No growth over 10 rounds (no leaked videos, observers or rAF loops) | Heap snapshot before and after |
| Time to first progress event (generate) | ≤ 400 ms | Server log |

## Rules of thumb

- Animate only `transform`, `opacity` and `filter` on small elements. Never animate layout properties.
- One `requestAnimationFrame` loop for ambient motion app-wide (the scene engine in v0.4), not one per component.
- Pause all ambient motion when the tab is hidden or the element is off-screen (`IntersectionObserver`).
- Video: `preload="metadata"` unless it's about to play. Load it on demand. Use one shared `<video>` per
  asset and reuse it rather than mounting one per card.
- Images: AVIF first with a WebP fallback through `next/image` or `<picture>`. Serve them at the size they
  display. Give every hero image a blurred placeholder.
- Fonts: at most 4 families and subset to Latin. Load the hand-lettering font (Reenie Beanie) only on
  routes that use it.
- Server: stream (NDJSON) anything over 1 s. Cache `/api/engine` for 60 s.
