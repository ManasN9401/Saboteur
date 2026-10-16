// The loupe's reading path (roadmap v0.4 loupe-rebuild §3). Pure, so it can be tested without a DOM.
//
// The path is a closed loop: read each line left to right, then swing back to the start of the next
// line on a curve, and from the last line back to the first the same way. Position and velocity are
// continuous everywhere, so the loop never jumps or stops dead.

export interface Line {
  x0: number;
  x1: number;
  y: number;
}

export interface Pose {
  x: number;
  y: number;
  /** 0 = resting on the page while reading, up to ~0.6 at the top of a return swing. */
  height: number;
  /** Horizontal velocity in px/s, for effects that lag behind the movement. */
  vx: number;
}

export interface LoopOptions {
  /** Reading speed in px/s. */
  speed?: number;
  /** Keep this far in from each end of a line. */
  inset?: number;
  /** How far above the lines the loupe arcs on its way back. */
  arc?: number;
  /** Peak height during a return. */
  lift?: number;
}

type Vec = { x: number; y: number };
type Curve = [Vec, Vec, Vec, Vec];

interface Segment {
  kind: "read" | "return";
  curves: Curve[];
  length: number;
  duration: number;
  /** Arc length at evenly spaced curve parameters (SAMPLES per curve), for distance → point. */
  table: number[];
}

const SAMPLES = 64;
const RETURN_PACE = 1.6;
/** A cubic with handles of 2/3 × diameter, perpendicular to it, traces close to a half circle. */
const HALF_TURN = 2 / 3;

function bezier([p0, c1, c2, p1]: Curve, u: number): Vec {
  const v = 1 - u;
  const a = v * v * v;
  const b = 3 * v * v * u;
  const c = 3 * v * u * u;
  const d = u * u * u;
  return { x: a * p0.x + b * c1.x + c * c2.x + d * p1.x, y: a * p0.y + b * c1.y + c * c2.y + d * p1.y };
}

/** Point at parameter k ∈ [0, curves.length] across the chained curves. */
function chain(curves: Curve[], k: number): Vec {
  const i = Math.min(Math.floor(k), curves.length - 1);
  return bezier(curves[i], k - i);
}

function makeSegment(kind: Segment["kind"], curves: Curve[], speed: number): Segment {
  const s: Segment = { kind, curves, length: 0, duration: 0, table: [0] };
  const steps = SAMPLES * curves.length;
  let prev = curves[0][0];
  for (let i = 1; i <= steps; i++) {
    const p = chain(curves, i / SAMPLES);
    s.length += Math.hypot(p.x - prev.x, p.y - prev.y);
    s.table.push(s.length);
    prev = p;
  }
  // A return runs 1.6× faster on average than reading, peaking at 2.2× mid-swing (see distanceAt).
  s.duration = kind === "read" ? s.length / speed : s.length / (RETURN_PACE * speed);
  return s;
}

/** Point at arc length `d` along the segment. */
function pointAt(s: Segment, d: number): Vec {
  const t = s.table;
  if (d <= 0) return s.curves[0][0];
  if (d >= s.length) return s.curves[s.curves.length - 1][3];
  let lo = 0;
  let hi = t.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid] < d) lo = mid;
    else hi = mid;
  }
  const k = (d - t[lo]) / (t[hi] - t[lo] || 1);
  return chain(s.curves, (lo + k) / SAMPLES);
}

/**
 * Distance travelled `tau` seconds into a segment. Reading is constant speed. A return starts and
 * ends at reading speed and speeds up smoothly in between: d(τ) = vτ + (L − vT)(τ/T − sin(2πτ/T)/2π),
 * whose derivative is v at both ends, so there is no change of speed at the joins.
 */
function distanceAt(s: Segment, tau: number, speed: number): number {
  if (s.kind === "read") return speed * tau;
  const T = s.duration;
  const extra = s.length - speed * T;
  return speed * tau + extra * (tau / T - Math.sin((2 * Math.PI * tau) / T) / (2 * Math.PI));
}

export interface ReadingLoop {
  /** Seconds for one full pass over every line and back to the start. */
  duration: number;
  /** Pose at time t (any t; the loop repeats). */
  at(t: number): Pose;
}

export function buildReadingLoop(lines: Line[], opts: LoopOptions = {}): ReadingLoop | null {
  const speed = opts.speed ?? 140;
  const inset = opts.inset ?? 24;
  const arc = opts.arc ?? 36;
  const lift = opts.lift ?? 0.6;

  const usable = lines.filter((l) => l.x1 - l.x0 > inset * 2 + 8);
  if (!usable.length) return null;

  const segs: Segment[] = [];
  const starts = usable.map((l) => ({ x: l.x0 + inset, y: l.y }));
  const ends = usable.map((l) => ({ x: l.x1 - inset, y: l.y }));
  for (let i = 0; i < usable.length; i++) {
    const a = starts[i];
    const b = ends[i];
    segs.push(makeSegment("read", [[a, { x: a.x + (b.x - a.x) / 3, y: a.y }, { x: a.x + (2 * (b.x - a.x)) / 3, y: b.y }, b]], speed));
    // The return lifts the loupe and carries it back in a loop: a round turn up off the end of the
    // line, a glide back above the text, and a round turn down onto the next line. Each turn is a
    // half circle, so direction changes smoothly and the loupe never stops or hooks back.
    const next = starts[(i + 1) % usable.length];
    const topY = Math.min(b.y, next.y) - arc;
    const k1 = (b.y - topY) * HALF_TURN; // handle length for a half circle of that diameter
    const k2 = (next.y - topY) * HALF_TURN;
    const t1 = { x: b.x, y: topY };
    const t2 = { x: next.x, y: topY };
    segs.push(
      makeSegment(
        "return",
        [
          [b, { x: b.x + k1, y: b.y }, { x: t1.x + k1, y: t1.y }, t1],
          [t1, { x: t1.x + (t2.x - t1.x) / 3, y: topY }, { x: t1.x + (2 * (t2.x - t1.x)) / 3, y: topY }, t2],
          [t2, { x: t2.x - k2, y: t2.y }, { x: next.x - k2, y: next.y }, next],
        ],
        speed,
      ),
    );
  }

  const duration = segs.reduce((sum, s) => sum + s.duration, 0);

  return {
    duration,
    at(t: number): Pose {
      let rem = ((t % duration) + duration) % duration;
      for (const s of segs) {
        if (rem <= s.duration || s === segs[segs.length - 1]) {
          const tau = Math.min(rem, s.duration);
          const d = distanceAt(s, tau, speed);
          const p = pointAt(s, d);
          const ahead = pointAt(s, distanceAt(s, Math.min(tau + 1 / 120, s.duration), speed));
          const behind = pointAt(s, distanceAt(s, Math.max(tau - 1 / 120, 0), speed));
          const vx = (ahead.x - behind.x) / (2 / 120);
          const height = s.kind === "return" ? lift * Math.sin((Math.PI * tau) / s.duration) ** 2 : 0;
          return { x: p.x, y: p.y, height, vx };
        }
        rem -= s.duration;
      }
      return { x: starts[0].x, y: starts[0].y, height: 0, vx: 0 };
    },
  };
}

/** A gentle hand-held wobble: continuous in t, so it never has a seam. */
export function wobble(t: number): Vec {
  return {
    x: 1.1 * Math.sin(t * 1.7) + 0.6 * Math.sin(t * 3.1 + 1.3),
    y: 0.9 * Math.sin(t * 1.3 + 0.7) + 0.5 * Math.sin(t * 2.6 + 2.1),
  };
}
