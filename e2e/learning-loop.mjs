// v0.6 learning loop, end to end (V06-08): seeded profile → dossier numbers → Drill this → targeted round →
// reveal insight → Review case from the menu.
// Run against a dev or production server started with SABOTEUR_ENGINE=offline:
//   BASE=http://localhost:3000 node e2e/learning-loop.mjs /tmp/shots
// Playwright is resolved from PLAYWRIGHT (a path to its index.mjs) or the "playwright" package.
// Running it again within a minute hits the rate limits: start the server with RATE_LIMIT_SCALE=10.
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
import { applySeed } from './seed.mjs';
const BASE = process.env.BASE ?? 'http://localhost:3000', out = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
const bodies = [];
p.on('request', r => r.url().endsWith('/api/saboteur/generate') && bodies.push(JSON.parse(r.postData())));
const ok = (cond, msg) => { console.log(cond ? '✓' : '✗', msg); if (!cond) process.exitCode = 1; };

await applySeed(p, BASE);
// 1. Dossier numbers from the seeded history.
await p.goto(BASE + '/dossier?skip=1'); await p.waitForTimeout(1500);
await p.getByRole('tab', { name: 'Calibration' }).click(); await p.waitForTimeout(800);
const cal = await p.locator('#dossier-panel').innerText();
ok(/36 bets/i.test(cal), 'calibration: 36 bets'); ok(/\+38/.test(cal), 'calibration: +38 points overconfident'); ok(/Biology/.test(cal) && /Economics/.test(cal), 'calibration: subjects listed');
await p.getByRole('tab', { name: 'Weak spots' }).click(); await p.waitForTimeout(800);
const first = await p.locator('.weak-card__label').first().innerText();
ok(first === 'Photosynthesis happens in the mitochondria', `weak spots: strongest is "${first}"`);
ok(await p.locator('.weak-card').count() === 7, `weak spots: 7 cards (${await p.locator('.weak-card').count()})`);

// 2. Drill this → a targeted round.
await p.locator('.weak-card').first().click(); await p.waitForTimeout(500);
await p.getByRole('button', { name: 'Drill this' }).click();
await p.waitForURL(/\/play\/rnd_/, { timeout: 30000 }); await p.waitForTimeout(1500);
ok(bodies.at(-1)?.targets?.[0]?.label === 'Photosynthesis happens in the mitochondria', 'drill: generate request carries the target');
const roundId = p.url().split('/').pop();
const rec = await p.evaluate((id) => { const k = Object.keys(localStorage).find(k => k.endsWith(':rounds')); return JSON.parse(localStorage.getItem(k))[id]; }, roundId);
ok(Array.isArray(rec?.targets) && rec.targets.length === 1, 'drill: round record keeps its target');
await p.screenshot({ path: `${out}/e2e-01-drill-round.png` });

// 3. Play it badly (flag one sentence, bet high) → the reveal's insight line.
await (await p.$$('.sentence'))[0].click(); await p.waitForTimeout(300);
await p.keyboard.type('not sure'); await p.waitForTimeout(300);
await p.click('text=Submit my flags'); await p.waitForTimeout(500);
await p.locator('#found-all').fill('90');
await p.click('text=Reveal the errors');
await p.waitForURL(/\/results\/rnd_/, { timeout: 30000 }); await p.waitForTimeout(6000);
const insight = await p.locator('.reveal-insight').innerText().catch(() => '');
ok(insight.length > 10, `reveal: insight line "${insight.replace(/\s+/g, ' ')}"`);
await p.screenshot({ path: `${out}/e2e-02-reveal.png` });
const stats = await p.evaluate(() => { const k = Object.keys(localStorage).find(k => k.endsWith(':stats')); return JSON.parse(localStorage.getItem(k)); });
ok(stats.learning && stats.learning.counted.length === 15, `learning: 15 rounds counted (${stats.learning?.counted.length})`);

// 4. The menu's Review case folder → a review round.
await p.goto(BASE + '/?skip=1'); await p.waitForTimeout(2000); await p.keyboard.press('Space'); await p.waitForTimeout(1500);
const review = p.locator('.folder', { hasText: 'Review case' });
ok(await review.count() === 1, 'menu: Review case folder');
await review.hover(); await p.waitForTimeout(400);
ok(/due/i.test(await p.locator('#front-hint').innerText()), `menu: hint "${await p.locator('#front-hint').innerText()}"`);
await p.screenshot({ path: `${out}/e2e-03-menu.png` });
await review.click();
await p.waitForURL(/\/play/, { timeout: 15000 }); await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/e2e-04-review-setup.png` });
await p.waitForURL(/\/play\/rnd_/, { timeout: 30000 });
const rid = p.url().split('/').pop();
const rrec = await p.evaluate((id) => { const k = Object.keys(localStorage).find(k => k.endsWith(':rounds')); return JSON.parse(localStorage.getItem(k))[id]; }, rid);
ok(rrec?.review === true && rrec.targets?.length >= 1, `review: round marked review with ${rrec?.targets?.length} target(s)`);
ok(bodies.at(-1)?.targets?.length >= 1, 'review: request carries targets');
console.log('errors', errs);
await b.close();
