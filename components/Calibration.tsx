"use client";

import Link from "next/link";
import { useId } from "react";
import type { Learning } from "@/lib/learning/schema";
import { brierOf, brierTrend, calibrationWord, errorTypeRows, hitRate, meanConfidence, MIN_BETS, overconfidence, reliability, subjectRows } from "@/lib/learning/views";

const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);
const signed = (n: number | null) => (n === null ? "–" : n > 0 ? `+${n}` : `${n}`);
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The dossier's Calibration tab (V06-03): does the player's confidence match their accuracy? A brass
 * gauge gives the headline (points over- or underconfident), then the detail as pen-drawn charts on
 * the manila, each with a sentence and a table for anyone not reading the picture.
 */
export function Calibration({ learning }: { learning: Learning }) {
  const all = learning.calibration.all;
  if (!all.bets)
    return (
      <div className="py-6 text-center">
        <p className="label mb-2">No bets on file</p>
        <h2 className="display mb-3 text-[34px]">Calibration needs a few cases</h2>
        <p className="mx-auto mb-6 max-w-[46ch] text-[16px]">Every flag is a bet that a sentence is wrong, and the last question is a bet that you found them all. Close a case and this page shows how far to trust your own certainty.</p>
        <Link href="/play" className="btn">
          Open a case
        </Link>
      </div>
    );

  const over = overconfidence(all);
  const trend = brierTrend(learning);
  const early = all.bets < MIN_BETS;
  return (
    <div className="grid gap-10">
      <div className="grid items-center gap-8 md:grid-cols-[minmax(240px,320px)_1fr]">
        <Gauge points={over ?? 0} />
        <div>
          <p className="label mb-1">Calibration</p>
          <p className="display text-[40px] leading-none">{calibrationWord(over)}</p>
          <p className="mt-3 max-w-[52ch] text-[16.5px]">
            Your bets average <b>{pct(meanConfidence(all))}</b> sure, and they’re right <b>{pct(hitRate(all))}</b> of the time
            {over !== null && over !== 0 ? (
              <>
                : <b>{Math.abs(over)} points</b> {over > 0 ? "more confident than your record" : "less confident than your record"}.
              </>
            ) : (
              "."
            )}
          </p>
          <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.08em]">
            {all.bets} bets · Brier {brierOf(all)!.toFixed(2)} overall
            {trend.recent !== null && ` · last 5 cases ${trend.recent.toFixed(2)}`}
            {trend.before !== null && trend.recent !== null && (trend.recent < trend.before - 0.01 ? " ↓ sharper" : trend.recent > trend.before + 0.01 ? " ↑ looser" : " · steady")}
          </p>
          {early && <p className="mt-3 text-[15px] text-ink-soft">Early days: {all.bets} bets so far. The numbers settle after about {MIN_BETS}.</p>}
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <Reliability learning={learning} />
        <BrierChart learning={learning} />
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <SubjectTable learning={learning} />
        <ErrorTypeTable learning={learning} />
      </div>
    </div>
  );
}

/** A brass instrument: −40 (underconfident) to +40 (overconfident) points, needle in pen. */
function Gauge({ points }: { points: number }) {
  const id = useId().replace(/:/g, "");
  const clamped = Math.max(-40, Math.min(40, points));
  const angle = (clamped / 40) * 80; // ±80° from straight up
  const tick = (v: number, long: boolean) => {
    const a = ((v / 40) * 80 - 90) * (Math.PI / 180);
    const r0 = long ? 76 : 82;
    return <line key={v} x1={100 + r0 * Math.cos(a)} y1={110 + r0 * Math.sin(a)} x2={100 + 90 * Math.cos(a)} y2={110 + 90 * Math.sin(a)} className="gauge__tick" data-long={long || undefined} />;
  };
  const arc = (from: number, to: number) => {
    const p = (v: number) => {
      const a = ((v / 40) * 80 - 90) * (Math.PI / 180);
      return `${100 + 86 * Math.cos(a)} ${110 + 86 * Math.sin(a)}`;
    };
    return `M ${p(from)} A 86 86 0 0 1 ${p(to)}`;
  };
  return (
    <figure className="gauge m-0" aria-label={`Gauge: ${signed(points)} points. ${calibrationWord(points)}.`}>
      <svg viewBox="0 0 200 150" role="img" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-brass`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className="gauge__brass-hi" />
            <stop offset="0.45" className="gauge__brass" />
            <stop offset="1" className="gauge__brass-lo" />
          </linearGradient>
          <radialGradient id={`${id}-face`} cx="0.45" cy="0.35" r="0.8">
            <stop offset="0" className="gauge__face-hi" />
            <stop offset="1" className="gauge__face" />
          </radialGradient>
        </defs>
        <path d="M 4 118 A 96 96 0 0 1 196 118 L 196 146 L 4 146 Z" fill={`url(#${id}-brass)`} className="gauge__bezel" />
        <path d="M 12 118 A 88 88 0 0 1 188 118 L 188 140 L 12 140 Z" fill={`url(#${id}-face)`} />
        <path d={arc(-40, -15)} className="gauge__zone" />
        <path d={arc(15, 40)} className="gauge__zone" />
        {[-40, -30, -20, -10, 0, 10, 20, 30, 40].map((v) => tick(v, v % 20 === 0))}
        {[-35, -25, -15, -5, 5, 15, 25, 35].map((v) => tick(v, false))}
        <text x="22" y="134" className="gauge__word">Under</text>
        <text x="178" y="134" className="gauge__word" textAnchor="end">
          Over
        </text>
        <text x="100" y="44" className="gauge__word" textAnchor="middle">
          0
        </text>
        <g className="gauge__needle" style={{ transform: `rotate(${angle}deg)` }}>
          <path d="M 98.2 110 L 100 30 L 101.8 110 Z" />
        </g>
        <circle cx="100" cy="110" r="7" fill={`url(#${id}-brass)`} className="gauge__hub" />
        <text x="100" y="134" className="gauge__value" textAnchor="middle">
          {signed(points)}
        </text>
      </svg>
      <figcaption className="label mt-1 text-center">Points over- or underconfident</figcaption>
    </figure>
  );
}

const CHART = { w: 320, h: 220, l: 40, r: 12, t: 12, b: 34 };

/** Confidence (x) against how often bets at that confidence were right (y). The diagonal is perfect. */
function Reliability({ learning }: { learning: Learning }) {
  const rows = reliability(learning);
  const { w, h, l, r, t, b } = CHART;
  const x = (c: number) => l + ((c - 50) / 50) * (w - l - r);
  const y = (a: number) => t + (1 - a) * (h - t - b);
  const pts = rows.filter((p) => p.accuracy !== null);
  const slope = (Math.atan2(y(1) - y(0.5), x(100) - x(50)) * 180) / Math.PI;
  const max = Math.max(1, ...rows.map((p) => p.bets));
  const worst = pts.filter((p) => p.bets >= 3).sort((a, c) => Math.abs(c.confidence / 100 - c.accuracy!) - Math.abs(a.confidence / 100 - a.accuracy!))[0];
  const summary = worst
    ? `When you bet ${worst.confidence}%, you were right ${pct(worst.accuracy)} of the time (${worst.bets} bets).`
    : "Not enough bets at any one confidence level to read yet.";
  return (
    <figure className="chart m-0">
      <p className="label mb-2">Reliability: how sure vs how right</p>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Reliability chart. ${summary}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((a) => (
          <g key={a}>
            <line x1={l} x2={w - r} y1={y(a)} y2={y(a)} className="chart__grid" />
            <text x={l - 6} y={y(a) + 4} textAnchor="end" className="chart__axis">
              {a * 100}%
            </text>
          </g>
        ))}
        {[50, 60, 70, 80, 90, 100].map((c) => (
          <text key={c} x={x(c)} y={h - b + 16} textAnchor="middle" className="chart__axis">
            {c}%
          </text>
        ))}
        <text x={(l + w - r) / 2} y={h - 2} textAnchor="middle" className="chart__axis">
          How sure you said you were
        </text>
        <line x1={x(50)} y1={y(0.5)} x2={x(100)} y2={y(1)} className="chart__ideal" />
        <text x={x(84)} y={y(0.84) - 8} className="chart__note" transform={`rotate(${slope} ${x(84)} ${y(0.84) - 8})`}>
          spot on
        </text>
        {pts.length > 1 && <polyline points={pts.map((p) => `${x(p.confidence)},${y(p.accuracy!)}`).join(" ")} className="chart__line" />}
        {pts.map((p) => (
          <circle key={p.confidence} cx={x(p.confidence)} cy={y(p.accuracy!)} r={3 + 6 * Math.sqrt(p.bets / max)} className="chart__dot" />
        ))}
      </svg>
      <figcaption className="mt-2 text-[15px]">{summary} Dots above the line mean you could trust yourself more; below it, less. Bigger dots are more bets.</figcaption>
      <details className="chart__table">
        <summary className="label cursor-pointer">Show as a table</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Confidence</th>
              <th scope="col">Bets</th>
              <th scope="col">Right</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.confidence}>
                <th scope="row">{p.confidence}%</th>
                <td>{p.bets}</td>
                <td>{pct(p.accuracy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Brier score per case, oldest to newest. Lower is better; 0.25 is what always saying "50%" earns. */
function BrierChart({ learning }: { learning: Learning }) {
  const pts = learning.calibration.brier.slice(-30);
  const { w, h, l, r, t, b } = CHART;
  const top = 0.5;
  const x = (i: number) => l + (pts.length > 1 ? (i / (pts.length - 1)) * (w - l - r) : (w - l - r) / 2);
  const y = (v: number) => t + (1 - Math.min(v, top) / top) * (h - t - b);
  const trend = brierTrend(learning);
  const summary =
    trend.recent === null
      ? "No scored cases yet."
      : `Your last ${Math.min(5, pts.length)} cases average ${trend.recent.toFixed(2)}${trend.before !== null ? `, against ${trend.before.toFixed(2)} for the five before` : ""}.`;
  return (
    <figure className="chart m-0">
      <p className="label mb-2">Brier score per case · lower is better</p>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Brier score over time. ${summary}`}>
        {[0, 0.1, 0.2, 0.3, 0.4, 0.5].map((v) => (
          <g key={v}>
            <line x1={l} x2={w - r} y1={y(v)} y2={y(v)} className="chart__grid" />
            <text x={l - 6} y={y(v) + 4} textAnchor="end" className="chart__axis">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        <line x1={l} x2={w - r} y1={y(0.25)} y2={y(0.25)} className="chart__ideal" />
        <text x={w - r} y={y(0.25) - 6} textAnchor="end" className="chart__note">
          coin-toss guessing
        </text>
        <text x={(l + w - r) / 2} y={h - 2} textAnchor="middle" className="chart__axis">
          {pts.length > 1 ? `Your last ${pts.length} cases, oldest first` : "Your cases"}
        </text>
        {pts.length > 1 && <polyline points={pts.map((p, i) => `${x(i)},${y(p.brier)}`).join(" ")} className="chart__line" />}
        {pts.map((p, i) => (
          <circle key={p.roundId} cx={x(i)} cy={y(p.brier)} r={3.2} className="chart__dot" />
        ))}
      </svg>
      <figcaption className="mt-2 text-[15px]">{summary}</figcaption>
      <details className="chart__table">
        <summary className="label cursor-pointer">Show as a table</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Case</th>
              <th scope="col">Date</th>
              <th scope="col">Bets</th>
              <th scope="col">Brier</th>
            </tr>
          </thead>
          <tbody>
            {pts.map((p, i) => (
              <tr key={p.roundId}>
                <th scope="row">{i + 1}</th>
                <td>{new Date(p.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
                <td>{p.bets}</td>
                <td>{p.brier.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function SubjectTable({ learning }: { learning: Learning }) {
  const rows = subjectRows(learning);
  const loud = rows.filter((r) => r.bets >= 5 && r.over !== null).sort((a, b) => b.over! - a.over!)[0];
  return (
    <section>
      <p className="label mb-2">By subject</p>
      {loud && loud.over! >= 6 && (
        <p className="mb-3 text-[15.5px]">
          You’re most overconfident in <b>{capital(loud.subject)}</b>: {loud.over} points.
        </p>
      )}
      <table className="ledger">
        <thead>
          <tr>
            <th scope="col">Subject</th>
            <th scope="col">Bets</th>
            <th scope="col">Sure</th>
            <th scope="col">Right</th>
            <th scope="col">Over</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.subject}>
              <th scope="row">{capital(r.subject)}</th>
              <td>{r.bets}</td>
              <td>{pct(r.confidence)}</td>
              <td>{pct(r.accuracy)}</td>
              <td data-tone={r.over === null ? undefined : r.over >= 10 ? "over" : r.over <= -10 ? "under" : undefined}>{signed(r.over)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ErrorTypeTable({ learning }: { learning: Learning }) {
  const rows = errorTypeRows(learning);
  const weakest = rows.find((r) => r.seen >= 3 && r.rate !== null && r.rate < 0.75);
  return (
    <section>
      <p className="label mb-2">By kind of error</p>
      {weakest && (
        <p className="mb-3 text-[15.5px]">
          <b>{weakest.label}</b> errors get past you most: {weakest.caught} of {weakest.seen} caught.
        </p>
      )}
      <table className="ledger">
        <thead>
          <tr>
            <th scope="col">Kind</th>
            <th scope="col">Planted</th>
            <th scope="col">Caught</th>
            <th scope="col">
              <span className="sr-only">Catch rate</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.type}>
              <th scope="row">{r.label}</th>
              <td>{r.seen}</td>
              <td>{pct(r.rate)}</td>
              <td className="ledger__bar" aria-hidden="true">
                <span style={{ width: `${(r.rate ?? 0) * 100}%` }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
