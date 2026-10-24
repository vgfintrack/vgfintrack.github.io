// The optional "Which district?" question: after the first entry, and in Setup.
import { chromium } from 'playwright';
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const b = await chromium.launch();
async function fresh(lang = 'en', persona = 'student') {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'REPLACE_ME';" }));
  await ctx.addInitScript((l) => { if (!sessionStorage.x) { localStorage.setItem('mt:lang', l); sessionStorage.x = 1; } }, lang);
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  await p.goto('http://localhost:8090/FinnBlu/');
  await p.click('[data-start]'); await p.click('[data-track=personal]'); await p.click(`[data-persona=${persona}]`); await p.click('[data-next]');
  for (let i = 0; i < 4; i++) await p.click('[data-next]');
  await p.click('[data-goal="0"]'); await p.click('[data-next]');
  await p.click('[data-finish=""]'); await p.waitForSelector('.kpis');
  return { ctx, p };
}
const doc = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('mt:demo')).doc);
async function addExpense(p) {
  await p.click('#fab'); await p.fill('#txn-amount', '60'); await p.click('#txn-form button[type=submit]'); await p.waitForTimeout(300);
}

// 1. asked after the first entry, saved to settings
{
  const { ctx, p } = await fresh();
  ok(!(await p.$('.district-tip')), 'not asked before the first entry');
  await addExpense(p);
  ok(await p.isVisible('.district-tip') && (await p.textContent('.district-tip')).includes('Which district do you live in?'), 'asked after the first entry');
  ok((await p.$$eval('#district-pick option', (o) => o.length)) === 65 && (await p.$$eval('#district-pick optgroup', (g) => g.map((x) => x.label))).includes('Sylhet division'), 'all 64 districts, by division');
  await p.click('#district-save');
  ok((await p.textContent('#toast')).includes('Choose your district'), 'Save without a choice asks for one');
  await p.selectOption('#district-pick', 'sylhet'); await p.click('#district-save'); await p.waitForTimeout(300);
  ok((await doc(p)).settings.district === 'sylhet' && !(await p.$('.district-tip')), 'saved: Sylhet; the question is gone');
  await p.click('.tabbar button[data-view=setup]');
  ok((await p.$eval('#setup-district', (e) => e.value)) === 'sylhet', 'Setup shows the district');
  await p.selectOption('#setup-district', 'dhaka'); await p.waitForTimeout(300);
  ok((await doc(p)).settings.district === 'dhaka', 'changed in Setup');
  await p.selectOption('#setup-district', ''); await p.waitForTimeout(300);
  ok(!(await doc(p)).settings.district, 'and can be removed');
  ok(p.errs.length === 0, 'no errors ' + p.errs.join('|'));
  await ctx.close();
}
// 2. "Not now" hides it for a month
{
  const { ctx, p } = await fresh();
  await addExpense(p);
  await p.click('#district-later'); await p.waitForTimeout(200);
  await p.reload(); await p.waitForSelector('.kpis');
  ok(!(await p.$('.district-tip')), 'Not now: not asked again for a while');
  await ctx.close();
}
// 3. Bangla, a shop
{
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'REPLACE_ME';" }));
  await ctx.addInitScript(() => { if (!sessionStorage.x) { localStorage.setItem('mt:lang', 'bn'); sessionStorage.x = 1; } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8090/FinnBlu/');
  await p.click('[data-start]'); await p.click('[data-track=business]'); await p.click('.biz-grid [data-prof-id=grocery]'); await p.click('[data-next]');
  await p.click('[data-team=solo]'); await p.click('[data-next]');
  for (let i = 0; i < 4; i++) await p.click('[data-next]');
  await p.click('[data-goal="0"]'); await p.click('[data-next]'); await p.click('[data-finish=""]'); await p.waitForSelector('.kpis');
  await p.click('[data-quick=Income]'); await p.fill('#txn-amount', '200'); await p.click('#txn-form button[type=submit]'); await p.waitForTimeout(300);
  const tip = await p.textContent('.district-tip');
  ok(tip.includes('দোকানটি কোন জেলায়?') && tip.includes('সিলেট') && (await p.$$eval('#district-pick optgroup', (g) => g.map((x) => x.label))).includes('সিলেট বিভাগ'), 'Bangla: দোকানটি কোন জেলায়? with Bangla names');
  await p.screenshot({ path: 'district-bn.png' });
  await ctx.close();
}
await b.close();
