# 001 · Local-first profiles
Date: 2026-10-15 · Status: Accepted

## Context
Students want to start immediately. Accounts add friction, legal obligations (minors) and backend work.
Streaks and profiles must still feel durable.

## Decision
Profiles, stats, streaks and settings live in versioned localStorage (v0.3), with JSON export/import.
Accounts (v0.9) are optional and only sync the same data. The local copy remains usable when signed out.

## Consequences
- Easier: zero-friction start, offline play, simple privacy story.
- Harder: data loss if browser storage is cleared before sign-in (mitigated by backup prompts and
  export), and a merge on first sign-in.
- Watch: storage quota on heavy users (quota guard plus caps).

## Alternatives considered
Accounts required from day one (rejected: friction and minors). IndexedDB instead of localStorage
(possible later if data outgrows ~4 MB; the store interface hides it).
