# v0.9 · Accounts, database and sync

> Status: ☐ · Estimate: ~5 days · Track: platform · Depends on: v0.3 data model · **Can move earlier** (see "When to pull forward")

## Goal
Rounds survive server restarts and deploys. Students can optionally sign in to sync their profile across
devices. The daily case gains shared global stats. Local-first still works without an account.

## When to pull this forward
- If the app is deployed somewhere serverless (Vercel): the `globalThis` round store **won't survive**
  between function instances. A round generated on one instance can't be graded on another. This is a
  correctness bug in production, so do **V09-03 (durable round store)** before the first public deploy,
  even if the rest waits.

## Scope

**Fixed**
- **Durable round store** (V09-03): planted errors in a KV/Redis (Upstash) or Postgres row with a TTL,
  behind the existing `roundStore.server.ts` interface. The in-memory store stays for local dev and tests.
- **Database:** Postgres (Neon/Supabase) with Drizzle ORM. Tables follow spec §8: `users`, `profiles`,
  `rounds`, `submissions`, `results`, `misconceptions`, `stats`, `daily_cases`, `daily_results`.
- **Auth:** Auth.js (email magic link plus Google), or Supabase Auth if Supabase is the database.
  Sign-in is optional and offered at natural moments ("Back up your 7-day streak?").
- **Sync:**
  - local stays the source of truth while signed out;
  - on sign-in, the server merges local profiles (newest-wins per record, union for rounds and badges,
    max for streak best, and streak current recomputed from the merged day log);
  - after that, writes go local first and then upload through a queue with retry;
  - pure merge functions with tests.
- **Rate limiting** on generate/grade per IP and per user (Upstash ratelimit), with a daily cap for
  anonymous users to control LLM cost.
- **Daily case v2:** generated once per day by AI (cron), cached, the same for everyone. Global stats on
  the reveal ("41% missed this one").

**Flexible**
- Provider choices (Neon vs Supabase, Auth.js vs Clerk).
- Whether guests can see global daily stats.

**Open**
- Classroom/teacher features (spec stretch) need this foundation. Decide after v1.0 (backlog B-03).
- Data retention: default delete rounds older than 12 months, keep the aggregated profile.

## Acceptance criteria
- Kill the server between generate and grade, and grading still works.
- Two devices signed into one account converge within 5 s of each other's changes (online).
- Signing out leaves a usable local copy. Deleting the account deletes all server data (GDPR) within one
  request plus a background job, with confirmation.
- Load test: 50 concurrent generates degrade gracefully (queueing messages, no 500s).

## Tasks
| ID | Task | Size |
|---|---|---|
| V09-01 | Choose providers; ADR in `decisions/` | S |
| V09-02 | Drizzle schema plus migrations plus seed | M |
| V09-03 | **Durable round store** behind the existing interface (pull forward before any serverless deploy) | S |
| V09-04 | Auth plus sign-in UI on the dossier plus "back up" prompts | M |
| V09-05 | Sync queue plus merge (pure, tested) plus conflict UI for rare cases | L |
| V09-06 | Rate limits plus anonymous caps plus friendly "come back tomorrow / use offline mode" | S |
| V09-07 | Daily case v2 (cron generate, cache, global stats) | M |
| V09-08 | Account deletion plus data export (server) | S |
| V09-09 | Load test script (k6 or autocannon) | S |
