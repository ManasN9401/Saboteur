/**
 * The autopsy diagnoser against the fifteen fixture worksheets (V07 acceptance).
 *
 *     SABOTEUR_MOCK=1 npm run eval:autopsy    # pipeline check against the canned answers
 *     npm run eval:autopsy                    # the real models (any provider key, see docs/router.md; 15 calls)
 *
 * Prints how often the kind (misconception or slip) matches, how many planted slips were called slips
 * (target ≥ 70%), and writes a side-by-side report (expected vs diagnosed label and explanation) to
 * eval-out/autopsy-<date>.md for the manual "sensible in ≥ 80% of items" review.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { diagnose } from "../../lib/autopsy/diagnose";
import { WORKSHEETS } from "../../lib/autopsy/fixtures";

let items = 0;
let kindMatch = 0;
let slips = 0;
let slipsCaught = 0;
const lines = [`# Autopsy eval, ${new Date().toISOString().slice(0, 16)}${process.env.SABOTEUR_MOCK === "1" ? " (mock)" : ""}`, "", "Mark each row ✓ (sensible) or ✗ in the last column.", ""];

for (const w of WORKSHEETS) {
  const req = { level: w.level, subject: w.subject, items: w.items.map((i, n) => ({ id: `a${n + 1}`, question: i.question, answer: i.answer, correct: i.correct })) };
  const out = await diagnose(req, () => {});
  lines.push(`## ${w.subject}: ${w.title}`, "", "| # | Wrong answer | Expected | Diagnosed | ✓/✗ |", "|---|---|---|---|---|");
  w.items.forEach((item, n) => {
    const d = out.diagnoses.find((x) => x.itemId === `a${n + 1}`);
    items++;
    if (d?.kind === item.expect.kind) kindMatch++;
    if (item.expect.kind === "careless_slip") {
      slips++;
      if (d?.kind === "careless_slip") slipsCaught++;
    }
    const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
    const exp = `${item.expect.kind === "careless_slip" ? "SLIP: " : ""}${item.expect.label}`;
    const got = d ? `${d.kind === "careless_slip" ? "SLIP: " : ""}${d.label} (${Math.round(d.confidence * 100)}%)${d.probe ? ` · probe: ${d.probe}` : ""}<br>${d.explanation}` : "(no diagnosis)";
    lines.push(`| ${n + 1} | ${cell(item.question)} → ${cell(item.answer)} (✓ ${cell(item.correct)}) | ${cell(exp)} | ${cell(got)} | |`);
  });
  lines.push("");
  console.log(`${w.subject.padEnd(10)} ${w.title}: ${out.diagnoses.length}/${w.items.length} diagnosed`);
}

const pct = (a: number, b: number) => `${a}/${b} = ${Math.round((a / b) * 100)}%`;
const summary = [`Kind matches: ${pct(kindMatch, items)}`, `Slips called slips: ${pct(slipsCaught, slips)} (target ≥ 70%)`];
lines.splice(2, 0, ...summary.map((s) => `- ${s}`), "");
mkdirSync("eval-out", { recursive: true });
const file = `eval-out/autopsy-${new Date().toISOString().slice(0, 10)}${process.env.SABOTEUR_MOCK === "1" ? "-mock" : ""}.md`;
writeFileSync(file, lines.join("\n"));
console.log(summary.join("\n"));
console.log(`Report for manual review: ${file}`);
