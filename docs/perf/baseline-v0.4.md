# Performance baseline (v0.4, 17 Oct)

The first measurement for v0.5, taken before v0.6 adds anything. Production build (`next build && next
start`, offline engine), Chromium through Playwright, cold cache, `?skip=1` (no title sequence).

- **Desktop:** 1440 × 900, no throttling.
- **Phone:** 390 × 844 at 3×, 4× CPU throttle, about 1.6 Mbit/s down with 150 ms latency (close to
  Lighthouse "Slow 4G").

Sizes are bytes over the wire (compressed), in KB. Lighthouse and the bundle analyser aren't installed
yet; setting them up is part of v0.5.

## Results

| Route | Device | LCP | CLS | Long tasks | JS | Fonts | Images | Total |
|---|---|---|---|---|---|---|---|---|
| `/` (day) | desktop | 0.44 s | 0 | 0 | 203 | 440 | 440 | 1111 |
| `/` (day) | phone | **4.8 s** | 0 | 5 (558 ms) | 203 | 440 | 219 | 891 |
| `/` (night) | desktop | **2.9 s** | 0 | 2 (121 ms) | 203 | 440 | 512 (+266 video) | 1450 |
| `/play` | desktop | 0.11 s | 0 | 2 (138 ms) | 212 | 440 | 347 | 1031 |
| `/play` | phone | **5.0 s** | 0.001 | 3 (442 ms) | 212 | 440 | 162 | 846 |
| `/dossier` | desktop | 0.10 s | 0.001 | 1 (68 ms) | 216 | 440 | 235 | 926 |
| `/dossier` | phone | **5.0 s** | 0.001 | 3 (428 ms) | 216 | 440 | 138 | 828 |
| `/archive` | desktop | 0.24 s | 0.001 | 0 | 204 | 440 | 219 | 895 |
| `/archive` | phone | **4.9 s** | 0.001 | 4 (460 ms) | 204 | 440 | 121 | 797 |
| `/about` | desktop | 0.34 s | 0.001 | 1 (62 ms) | 204 | 440 | 254 | 931 |
| `/about` | phone | 2.0 s | 0.005 | 5 (690 ms) | 204 | 440 | 157 | 834 |

Not measured yet: the round and the reveal. They need a round in local storage, so they go into the v0.5
Playwright suite.

## Against the budgets

| Budget | Now | Verdict |
|---|---|---|
| LCP ≤ 1.8 s desktop | 0.1–0.4 s by day; **2.9 s at night** (the lamp switch-on clip and lamp-off plate are on the critical path) | ✗ at night |
| LCP ≤ 2.5 s low end | **4.8–5.0 s** on every desk route | ✗ |
| CLS ≤ 0.02 | ≤ 0.005 | ✓ |
| JS ≤ 140 KB per route | **203–216 KB** | ✗ |
| Images above the fold ≤ 180 KB on mobile | 121–219 KB | ✗ on home |

## Biggest wins, in order

1. **Fonts: 440 KB on every page.** Three files are 129–144 KB each: Bricolage Grotesque with its
   `wdth` and `opsz` axes, and Newsreader with `opsz` in roman and italic. Dropping the extra axes (or
   pinning a few static weights) should bring fonts under 120 KB. Reenie Beanie is preloaded on every
   route but only the desk props and the round-end strip use it.
2. **Every lighting state of every desk prop downloads.** Calendar, clock body and dial patches load in
   day, dusk, night and lamp-off versions, and only one of them is visible. Render only the current
   state, plus the lamp-off variant at night.
3. **JS ~205 KB on every route.** Three chunks (71, 44 and 42 KB) carry most of it. The clock view, the
   timer service, the settings drawer and the toasts are all in the root layout, so every route pays for
   them. Load the clock view and the settings drawer on demand (`next/dynamic`), then run the bundle
   analyser.
4. **The night home page.** The lamp switch-on clip (266 KB) starts with the page. Start it after the
   plate has painted, and keep the plate itself the LCP element.
5. **Phone long tasks (430–690 ms total).** Hydrating the desk layers and the menu. Re-measure after 1–3.
