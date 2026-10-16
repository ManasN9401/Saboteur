# 002 · No baked lighting or shadows in props
Date: 2026-10-15 · Status: Accepted

## Context
The v0.1 loupe is a photographed cut-out with its own lighting and a grey shadow fringe. Rotated by CSS,
its highlights point away from the desk lamp and its shadow doubles up with the CSS drop-shadow. It looks pasted on.

## Decision
Props are generated at their display angle on chroma green with no cast shadow, keyed with an edge erode,
and optionally split into albedo/spec layers. Shadows are produced in code from the alpha mask, using
the scene's light direction and the prop's "height". Photographic footage composited with multiply
(e.g. the stamp) is the exception, because it re-uses the desk underneath.

## Consequences
Props re-light correctly for day and night, shadows respond to motion, and assets need a pipeline step (`scripts/assets`).

## Alternatives considered
Full 3D models in Three.js (rejected for bundle size; see 003). Hand-painted shadows per angle (rejected: they don't move).
