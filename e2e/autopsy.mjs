// Wrong Answer Autopsy, end to end (v0.7): paste → examine → toe tags → check questions → report →
// corkboard, then a photo of marked work, on a phone. Run against a server started with SABOTEUR_MOCK=1:
//   BASE=http://localhost:3000 node e2e/autopsy.mjs /tmp/shots
// Playwright is resolved from PLAYWRIGHT (a path to its index.mjs) or the "playwright" package.
// Running it again within a minute hits the rate limits: start the server with RATE_LIMIT_SCALE=10.
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
import { applySeed } from './seed.mjs';
const BASE = process.env.BASE ?? 'http://localhost:3000', out = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };
await applySeed(p, BASE);
await p.goto(BASE + '/autopsy'); await p.waitForTimeout(2000); console.log('errs so far', errs, (await p.locator('main').innerText()).slice(0, 80));
await p.getByRole('button', { name: 'Show an example' }).click();
await p.locator('textarea').fill(await p.locator('textarea').inputValue() + `\n\nQ: What is the unit of charge?\nMy answer: Columbs\nCorrect answer: Coulombs\n\nQ: What is 7 × 8?\nMy answer: 56\nCorrect answer: 56`);
await p.waitForTimeout(400);
ok(/3 wrong answers/.test(await p.locator('.autopsy-tray__parsed').innerText()), 'intake: 3 wrong answers, matching one left out');
await p.screenshot({ path: `${out}/01-intake.png`, fullPage: true });
await p.getByRole('button', { name: 'Examine' }).click();
await p.waitForTimeout(300); await p.screenshot({ path: `${out}/02-examining.png` });
await p.waitForSelector('.toe-tag', { timeout: 20000 }); await p.waitForTimeout(600);
ok(await p.locator('.toe-tag').count() === 3, 'findings: 3 toe tags');
await p.screenshot({ path: `${out}/03-findings.png`, fullPage: true });
const tags = p.locator('.toe-tag-wrap');
await tags.nth(0).getByRole('button', { name: "That's it" }).click();
await tags.nth(1).getByRole('button', { name: 'Not quite' }).click();
await tags.nth(2).getByRole('button', { name: 'Agreed, a slip' }).click();
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/04-decided.png`, fullPage: true });
await p.getByRole('button', { name: /Check you/ }).click();
await p.waitForSelector('.check-q__option', { timeout: 20000 });
for (let i = 0; i < 3; i++) {
  const opts = p.locator('.check-q__option');
  // pick the right answer: the mock puts the correct text "3 Ω" among options
  const texts = await opts.allInnerTexts();
  const idx = texts.findIndex(t => t.includes('3 Ω') && !t.includes('13'));
  await opts.nth(idx).click();
  if (i === 0) await p.screenshot({ path: `${out}/05-question.png`, fullPage: true });
  await p.getByRole('button', { name: 'Answer', exact: true }).click(); await p.waitForTimeout(300);
  if (i === 0) await p.screenshot({ path: `${out}/06-answered.png`, fullPage: true });
  await p.getByRole('button', { name: i === 2 ? 'Done' : 'Next question' }).click(); await p.waitForTimeout(300);
}
await p.waitForSelector('.autopsy-report');
const rep = await p.locator('.autopsy-report').innerText();
ok(/3 of 3 check questions right/i.test(rep) && /resolved/i.test(rep), `report: "${rep.replace(/\s+/g, ' ').slice(0, 160)}"`);
await p.screenshot({ path: `${out}/07-report.png`, fullPage: true });
const stats = await p.evaluate(() => { const k = Object.keys(localStorage).find(k => k.endsWith(':stats')); return JSON.parse(localStorage.getItem(k)); });
const ms = Object.values(stats.learning.misconceptions).filter(m => m.autopsy);
ok(ms.some(m => m.autopsy.status === 'resolved') && ms.some(m => m.autopsy.status === 'rejected'), `profile: statuses ${ms.map(m => m.autopsy.status)}`);
ok(!!stats.badges.coroner, 'badge: Coroner');
await p.goto(BASE + '/dossier'); await p.waitForTimeout(1200);
await p.getByRole('tab', { name: 'Weak spots' }).click(); await p.waitForTimeout(1000);
await p.screenshot({ path: `${out}/08-corkboard.png`, fullPage: true });
ok(await p.locator('.weak-card__tag').count() >= 1, 'corkboard: autopsy tag shown');
// mobile tags
const m = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
const mp = await m.newPage(); await applySeed(mp, BASE);
await mp.goto(BASE + '/autopsy'); await mp.waitForTimeout(1500);
// A photo of marked work (any picture: the mock answers as if it had read the circuits worksheet).
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAADwAAAAoCAIAAAAt2Q6oAAAA+UlEQVR4nO3YSw6EIBAEUHruf2dm4QaLNmmwP0Vi7SYZsSQvKEjvvZ2WX3WBnXyls6KVFkmvsZap9NVYhLn6vTQUZe0typI3dyVbFjXT6mMwzfrD6tG7Xp0jGg/8C50WwzrNp8X2ciHTYuCBV9RrWX+NE2jZ+vao1rLOAwco0PL6K69Ci8enabqW1zxwvAwt3puAFC0BO5d4Ld48cPgQLcF7xBgt8RvbAC3BPPBuPlpyjxCctKSfe3hoyeWBN9/UUnrCtKul+lhsS0spD4hZS/VMjzFrYSrdrFqYeECetZDN9BiYzeEncek2aLk/AHfpKxPgE0pPObL0H197dyVNGpa9AAAAAElFTkSuQmCC', 'base64');
await mp.locator('input[type=file]').setInputFiles({ name: 'marked.png', mimeType: 'image/png', buffer: png });
await mp.waitForTimeout(300);
ok(await mp.locator('.autopsy-tray__thumb').count() === 1, 'photo: preview shown');
let sent = null;
mp.on('request', (r) => r.url().endsWith('/api/autopsy/diagnose') && (sent = JSON.parse(r.postData())));
await mp.getByRole('button', { name: 'Examine' }).click();
await mp.waitForSelector('.toe-tag', { timeout: 20000 }); await mp.waitForTimeout(500);
ok(sent?.image?.mediaType === 'image/jpeg' && sent.items.length === 0, 'photo: sent once, re-encoded as JPEG');
ok(await mp.locator('.toe-tag').count() === 4, 'photo: four wrong answers read from it');
const kept = await mp.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
ok(!kept.includes(sent.image.data.slice(0, 64)), 'photo: no image bytes in browser storage');
await mp.screenshot({ path: `${out}/09-phone-findings.png`, fullPage: true });
console.log('phone scrollWidth', await mp.evaluate(() => [document.documentElement.scrollWidth, innerWidth]));
console.log('errors', errs);
await b.close();
