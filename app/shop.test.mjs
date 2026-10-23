import { chromium } from 'playwright';
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const b = await chromium.launch();
for (const mode of ['shop', 'personal']) {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'REPLACE_ME';" }));
  await p.addInitScript(() => { if (!sessionStorage.x) { localStorage.setItem('mt:lang', 'en'); sessionStorage.x = 1; } });
  await p.goto('http://localhost:8090/AmrPotli/');
  await p.waitForSelector('.ob[data-step=hello]');
  await p.click('[data-start]');
  // "For business" → the shop's money; "For personal use" → Business owner = own money.
  await p.click(mode === 'shop' ? '[data-track=business]' : '[data-track=personal]');
  if (mode === 'shop') {
    ok(await p.$eval('[data-next]', (e) => e.disabled), 'shop: pick a business first');
    await p.click('.biz-grid [data-prof-id=grocery]');
    await p.screenshot({ path: 'shop1-who.png' });
    await p.click('[data-next]');
    await p.click('[data-team=solo]');
  } else {
    await p.click('[data-persona=business]');
    ok(!(await p.$eval('[data-next]', (e) => e.disabled)), 'personal: Business owner needs no more questions');
  }
  await p.click('[data-next]');
  await p.waitForSelector('.ob[data-step=where]');
  const cashLabel = await p.$eval('[data-wallet=cash] strong', (e) => e.textContent);
  ok(mode === 'shop' ? cashLabel === 'Cash box' : cashLabel === 'Cash in hand', `${mode}: cash called "${cashLabel}"`);
  await p.click('[data-wallet=bkash]'); await p.click('[data-next]');
  await p.fill('[data-bal=cash]', '5000'); await p.click('[data-next]');
  const spend = await p.$$eval('.ob-chip.on', (e) => e.map((x) => x.dataset.chip));
  ok(mode === 'shop' ? spend.includes('Stock Purchase') && !spend.includes('Family Support') : spend.includes('Family Support') && !spend.includes('Stock Purchase'), `${mode}: costs ${spend.slice(0, 4).join(', ')}…`);
  if (mode === 'shop') await p.screenshot({ path: 'shop2-spend.png' });
  await p.click('[data-next]');
  const inc = await p.$$eval('.ob-chip.on', (e) => e.map((x) => x.dataset.chip));
  ok(mode === 'shop' ? inc.includes('Sales') : inc.includes('Business Profit'), `${mode}: money in ${inc.join(', ')}`);
  await p.click('[data-next]');
  ok((await p.textContent('.ob-bubble strong')).includes(mode === 'shop' ? 'profit' : 'save'), `${mode}: goal wording`);
  await p.click('[data-goal="5000"]'); await p.click('[data-next]');
  await p.waitForSelector('.ob[data-step=done]');
  await p.click('[data-finish=""]');
  await p.waitForSelector('.kpis');
  const k = await p.$$eval('.kpi .k', (e) => e.map((x) => x.textContent));
  ok(mode === 'shop' ? k.join() === 'Sales,Costs,Profit,Profit margin' : k.join() === 'Income,Expenses,Net saved,Savings rate', `${mode}: dashboard says ${k.join(', ')}`);
  const q = await p.$$eval('[data-quick] span:last-child', (e) => e.slice(0, 2).map((x) => x.textContent));
  ok(mode === 'shop' ? q.join() === 'Sale,Baki sale' : q.join() === 'Expense,Income', `${mode}: quick actions ${q.join(', ')}`);
  const d = await p.evaluate(() => JSON.parse(localStorage.getItem('mt:demo')).doc);
  ok(mode === 'shop' ? d.settings.mode === 'shop' && Object.values(d.accounts).some((a) => a.name === 'Cash Box') : !d.settings.mode, `${mode}: saved settings`);
  if (mode === 'shop') {
    await p.evaluate(() => document.querySelector('#demo-banner').hidden = true);
    await p.screenshot({ path: 'shop3-dash.png' });
    await p.evaluate(() => localStorage.setItem('mt:lang', 'bn')); await p.reload(); await p.waitForSelector('.kpis');
    ok((await p.$$eval('.kpi .k', (e) => e.map((x) => x.textContent))).join() === 'বিক্রি,খরচ,লাভ,লাভের হার', 'shop in Bangla: বিক্রি, খরচ, লাভ');
  }
  ok(errs.length === 0, `${mode}: no page errors ${errs.join('|')}`);
  await ctx.close();
}
await b.close();
