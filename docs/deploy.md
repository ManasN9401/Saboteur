# Hosting and security

## Shape of a deployment

**One long-running Node server.** Open rounds (the planted errors, until the student submits) live in
that process's memory for two hours, so grading must reach the process that generated the round. Use
one always-on container or VM, not serverless functions or several instances, until v0.9 moves rounds
into a database. Student data lives in their browser, so there's no database to run yet.

**Always behind a reverse proxy or a platform edge** (Fly.io, Render, Railway, Cloudflare, or Caddy or
nginx in front of a VPS). It terminates HTTPS, and it supplies the visitor's address, which the rate
limits key on. Next.js keeps whatever `X-Forwarded-For` a request arrives with, so a server exposed
directly would let a client choose its own address. The proxy should:

- not buffer responses (`proxy_buffering off;` in nginx, or send `X-Accel-Buffering: no`): generation
  and the autopsy stream their progress;
- allow requests of at least 300 s;
- accept bodies up to 8 MB (autopsy photos).

Set `TRUSTED_IP_HEADER` to your host's client-address header (`fly-client-ip` on Fly, `cf-connecting-ip`
behind Cloudflare, `x-real-ip` for a typical nginx setup). Without it, the right-most `X-Forwarded-For`
entry is used, which is right for a single proxy that appends to it.

Health checks: point them at `GET /api/live` (no work). `/api/health` makes a real model call and, in
production, answers only with `x-health-token: $HEALTH_TOKEN`.

## What's protected, and how

| Risk | Protection | Where |
|---|---|---|
| A script spending the AI keys | Per-client allowances per route (below), and a cap on simultaneous streams per client | `lib/security/limits.ts`, every `app/api/*` route |
| Many clients, or one rotating its address, running up a bill | `AI_DAILY_BUDGET` model calls per server per day (default 2000). Past it the AI counts as unavailable: rounds are built offline, the autopsy offers manual logging | `lib/llm.ts` |
| Another website using the API through its visitors | Browser requests from other origins are refused (403). `ALLOWED_ORIGINS` adds exceptions | `lib/security/guard.ts` |
| Huge request bodies | Bodies are read only up to a per-route cap (16 KB to 8 MB) and refused with 413 past it, before parsing | `readJson` in `lib/security/guard.ts` |
| Filling server memory with rounds | At most 5000 open rounds, oldest dropped first; each round's size is capped by its route | `lib/roundStore.server.ts` |
| Cross-site scripting | React escapes all model output; the only raw HTML is the fixed pre-paint script. A CSP allows scripts, styles, fonts, media and connections only from this origin | `next.config.ts` |
| Clickjacking | `frame-ancestors 'none'` and `X-Frame-Options: DENY` | `next.config.ts` |
| Leaking setup details | `/api/engine`'s routing detail is development-only; errors shown to users are written for them; logs never include request bodies or pictures (tested) | `app/api/engine`, `lib/autopsy/privacy.test.ts` |
| Autopsy photos | Re-encoded in the browser, sent once, never stored or logged on either side | `app/autopsy/page.tsx`, `lib/autopsy` |
| Downgrade to HTTP | `Strict-Transport-Security` (two years) and `upgrade-insecure-requests`, in production | `next.config.ts` |

Other headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
a `Permissions-Policy` turning off camera, microphone, geolocation and payments,
`Cross-Origin-Opener-Policy: same-origin`, no `X-Powered-By`, and `Cache-Control: no-store` on the API.

The CSP keeps `'unsafe-inline'` for scripts: nonces would need every page rendered per request, which
the app's partial prerendering rules out (see Next's CSP guide). It still blocks every third-party
script, frame and connection.

### Per-client allowances

| Route | Per minute | Per hour | At once |
|---|---|---|---|
| New round (`/api/saboteur/generate`) | 4 | 30 | 2 |
| Grading (`/api/saboteur/grade`) | 10 | 60 | |
| Replay (`/api/saboteur/replay`) | 10 | 60 | |
| Autopsy (`/api/autopsy/diagnose`) | 3 | 15 | 1 |
| Check questions (`/api/autopsy/questions`) | 10 | 60 | |
| Label tidying (`/api/learning/normalise`) | 10 | 60 | |
| Health (`/api/health`) | 2 | 6 | |
| Engine and daily info | 120 | 2000 | |

Over the limit: `429` with `Retry-After` and a message the page shows. `RATE_LIMIT_SCALE` multiplies
them all. Counters are in memory: a restart clears them, and they assume the single process above.

## Before going public

- Set provider keys as secrets on the host (never in the image), and `NODE_ENV=production`.
- Decide `AI_DAILY_BUDGET` from your providers' free quotas or your spending limit, and set spending
  caps at the providers themselves too.
- Set `TRUSTED_IP_HEADER` for your host and check `curl -I` shows the security headers.
- Privacy and legal pages (v1.0), since students upload their work.
