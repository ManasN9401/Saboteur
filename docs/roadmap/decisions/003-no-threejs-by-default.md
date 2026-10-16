# 003 · No Three.js in the default bundle
Date: 2026-10-15 · Status: Accepted

## Context
Three.js adds ~150 KB gzip, more than the whole per-route JS budget. The desk is viewed top-down, so
2D layers with procedural light and shadow give most of the effect.

## Decision
Ambient scenes use one 2D canvas plus DOM props. Three.js may be used only for an optional, lazy-loaded
title "hero" (backlog B-14) that is never on the critical path.

## Consequences
Smaller bundles and better low-end performance. Some effects (true 3D rotation of props) aren't possible.
Revisit if a feature truly needs 3D.
