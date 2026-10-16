# Decisions (lightweight ADRs)

Write one when a choice is expensive to reverse or someone will ask "why did we do it this way?" later.
Copy the template and number it sequentially.

| # | Decision | Status |
|---|---|---|
| [001](001-local-first-profiles.md) | Profiles, streaks and settings are local-first; accounts only sync | Accepted |
| [002](002-no-baked-lighting-in-props.md) | Props are delivered as unlit layers; shadows and highlights are generated in code | Accepted |
| [003](003-no-threejs-by-default.md) | No Three.js in the default bundle | Accepted |

## Template
```md
# NNN · Title
Date: YYYY-MM-DD · Status: Proposed | Accepted | Superseded by NNN

## Context
What forces are at play.

## Decision
What we're doing.

## Consequences
What gets easier, what gets harder, what we'll watch.

## Alternatives considered
```
