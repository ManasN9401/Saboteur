# Profiles

## Model (`lib/profile/schema.ts`, Zod)
```ts
Profile {
  id: string                 // "prf_xxx"
  name: string               // 1–24 chars
  avatar: { kind: "badge"; id: string } | { kind: "monogram"; initials: string; colour: string }
  accent: ThemeAccent        // pen colour etc. (see customisation.md)
  createdAt: string
  lastActiveAt: string
  preferences: Preferences   // per-profile; device prefs live separately
  tutorialDone: boolean
  onboarding: { level?: string; subjects?: string[]; goalPerWeek?: number }
}
Stats {
  xp: number
  streak: { current: number; best: number; lastDay: string | null; freezes: number; frozenDays: string[] }
  daily: Record<string /* yyyy-mm-dd */, { roundId: string; score: number; max: number }>
  badges: Record<BadgeId, { earnedAt: string }>
  totals: { rounds: number; catches: number; misses: number; falseFlags: number; perfectRounds: number }
}
```

## Screens
- **Who's investigating?** shows after the title screen when more than one profile exists, as ID badges
  on a lanyard rack. A single profile is picked automatically. "+ New recruit" opens creation.
- **Create profile** is a 3-step mini-onboarding on a dossier cover:
  1. name and avatar;
  2. level (pre-fills setup), subjects you study (chips) and a weekly goal (3/5/7 cases);
  3. optional tutorial.
- **Dossier** (`/dossier`) has these tabs:
  - **Record**: rank, XP bar, streak calendar (last 12 weeks heat map in red-pen crosses), totals and
    best round;
  - **Badges**: corkboard;
  - **Profile**: edit name and avatar, export/import, delete with typed confirmation.
  - v0.6 adds the **Misconceptions** and **Calibration** tabs.
- **Profile switcher** sits in the top-right (avatar chip) on every page except the title.

## Rules
- Max 6 profiles per device. Deleting needs the name typed. "Guest" mode is a temporary profile that is
  wiped on close (for demos and classrooms).
- Data isolation: each profile reads only its own `p:<id>:` keys. A cross-profile leak is a P1 bug, so
  write a test for it.
- Avatars are 12 illustrated "agent badges" (see asset briefs, flexible) plus monogram fallback in the
  profile colour.
