import { chromium } from 'playwright';
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const b = await chromium.launch();
async function start(lang = 'en', track = 'personal') {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'REPLACE_ME';" }));
  await p.addInitScript((l) => { if (!sessionStorage.x) { localStorage.setItem('mt:lang', l); sessionStorage.x = 1; } }, lang);
  await p.goto('http://localhost:8090/AmrPotli/');
  await p.click('[data-start]'); await p.click(`[data-track=${track}]`);
  await p.waitForSelector('.ob[data-step=who]');
  return { ctx, p };
}
// For business: after the business, "Just me (solo)".
const solo = async (p) => { await p.click('[data-next]'); await p.click('[data-team=solo]'); await p.click('[data-next]'); };
const chips = (p) => p.$$eval('.ob-chip.on', (e) => e.map((x) => x.dataset.chip));
async function finishSetup(p) {
  await p.click('[data-next]'); // where -> amounts
  await p.click('[data-next]'); // amounts -> spend
  const spend = await chips(p);
  await p.click('[data-next]'); // spend -> income
  const income = await chips(p);
  await p.click('[data-next]'); // income -> goal
  await p.click('[data-goal="0"]'); await p.click('[data-next]');
  await p.waitForSelector('.ob[data-step=done]');
  await p.click('[data-finish=""]');
  await p.waitForSelector('.kpis, .hand');
  const d = await p.evaluate(() => JSON.parse(localStorage.getItem('mt:demo')).doc);
  return { spend, income, d };
}
// 1. pharmacy by search
{
  const { ctx, p } = await start('en', 'business');
  ok(await p.$eval('[data-next]', (e) => e.disabled), 'Continue waits for an answer');
  await p.fill('#prof-input', 'pharm');
  const res = await p.$$eval('#prof-results button', (e) => e.map((x) => x.innerText.replace(/\n/g, ' ')));
  ok(res[0].includes('Pharmacy') && res.at(-1).includes('Other business'), 'typing "pharm" suggests: ' + res.join(' | '));
  await p.screenshot({ path: 'prof1-search.png' });
  await p.click('#prof-results [data-prof-id=pharmacy]');
  ok(!(await p.$eval('[data-next]', (e) => e.disabled)) && (await p.$eval('.biz-grid [data-prof-id=pharmacy]', (e) => e.classList.contains('on'))), 'pharmacy picked');
  await p.screenshot({ path: 'prof2-pharmacy.png' });
  await solo(p);
  ok((await p.textContent('[data-wallet=cash] strong')) === 'Cash box', 'cash box for the business');
  const { spend, income, d } = await finishSetup(p);
  ok(spend.includes('Medicine Purchase') && spend.includes('Drug Licence & Fees'), 'pharmacy costs: ' + spend.slice(0, 4).join(', '));
  ok(income.includes('Medicine Sales'), 'pharmacy income: ' + income.join(', '));
  ok(d.settings.mode === 'shop' && d.settings.productGroups.includes('Syrups') && d.settings.stockCategory === 'Medicine Purchase' && d.settings.profession.id === 'pharmacy', 'saved: shop mode, medicine products, profession');
  ok((await p.$$eval('.kpi .k', (e) => e.map((x) => x.textContent))).join() === 'Sales,Costs,Profit,Profit margin', 'business dashboard words');
  // a purchase goes to Medicine Purchase
  await p.click('[data-quick=buy]');
  await p.fill('#sup-name', 'Square Pharma'); await p.click('#sup-kind [data-kind=company]'); await p.click('#sup-form button[type=submit]');
  await p.waitForSelector('#buy-dialog[open]');
  ok(!!(await p.$('[data-product="Tablets & Capsules"]')), 'purchase shows medicine product groups');
  await p.click('[data-product="Syrups"]'); await p.fill('#buy-total', '3000'); await p.click('#buy-paid-none'); await p.click('#buy-form button[type=submit]');
  await p.waitForTimeout(300);
  const buy = await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('mt:demo')).doc.transactions).find((x) => x.purchase && x.type === 'Expense'));
  ok(buy.category === 'Medicine Purchase', 'purchase recorded as Medicine Purchase');
  ok(p.errs.length === 0, 'no errors ' + p.errs.join('|'));
  await ctx.close();
}
// 2. poultry farm in Bangla, single-product purchase goes to its own category
{
  const { ctx, p } = await start('bn', 'business');
  await p.fill('#prof-input', 'মুরগি');
  ok((await p.textContent('#prof-results')).includes('মুরগির খামার'), 'Bangla search: মুরগি → মুরগির খামার');
  await p.click('#prof-results [data-prof-id=poultry]');
  await solo(p);
  const { spend, income } = await finishSetup(p);
  ok(spend.includes('Chicks') && spend.includes('Feed') && income.includes('Egg Sales'), 'poultry: chicks, feed, egg sales');
  await p.click('[data-quick=buy]');
  await p.fill('#sup-name', 'Karim Feed Store'); await p.click('#sup-form button[type=submit]');
  await p.click('[data-product="Feed"]'); await p.fill('#buy-total', '8000'); await p.click('#buy-paid-all'); await p.click('#buy-form button[type=submit]');
  await p.waitForTimeout(300);
  const buy = await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('mt:demo')).doc.transactions).find((x) => x.purchase && x.type === 'Expense'));
  ok(buy.category === 'Feed', 'feed purchase recorded under Feed');
  await ctx.close();
}
// 3. teacher (personal), searched in Bangla
{
  const { ctx, p } = await start('bn');
  await p.fill('#prof-input', 'শিক্ষক');
  await p.click('[data-prof-id=teacher]');
  ok(!(await p.$eval('[data-next]', (e) => e.disabled)), 'teacher: can go on');
  await p.click('[data-next]');
  const { income, d } = await finishSetup(p);
  ok(income.includes('Salary') && income.includes('Tuition') && !d.settings.mode, 'teacher: salary + tuition, personal');
  await ctx.close();
}
// 4. a profession not in the list
{
  const { ctx, p } = await start();
  await p.fill('#prof-input', 'Wedding photographer');
  const res = await p.$$eval('#prof-results button', (e) => e.map((x) => x.innerText));
  ok(res.length === 1 && res[0].includes('Other profession: “Wedding photographer”'), 'no match: offers Other profession');
  await p.click('[data-prof-custom]');
  ok((await p.textContent('.ob-options .ob-option.on')).includes('Wedding photographer'), 'shows their own profession');
  await p.screenshot({ path: 'prof3-custom.png' });
  await p.click('[data-next]');
  const { income, d } = await finishSetup(p);
  ok(d.settings.profession.label === 'Wedding photographer' && income.includes('Main Income'), 'saved with a general setup');
  await ctx.close();
}
// 5. "Business owner" card -> business money -> kind of business
{
  const { ctx, p } = await start('en', 'business');
  ok(await p.$eval('[data-next]', (e) => e.disabled) && (await p.$$('.biz-grid [data-prof-id]')).length === 18, 'For business: all 18 kinds of business');
  await p.click('.biz-grid [data-prof-id=electronics]');
  await p.screenshot({ path: 'prof4-kind.png' });
  await solo(p);
  const { income } = await finishSetup(p);
  ok(income.includes('Repair Service'), 'electronics: repair service income');
  await ctx.close();
}
// 6. computer & photocopy shop
{
  const { ctx, p } = await start('bn', 'business');
  await p.fill('#prof-input', 'ফটোকপি');
  ok((await p.textContent('#prof-results')).includes('কম্পিউটার ও ফটোকপির দোকান'), 'ফটোকপি → কম্পিউটার ও ফটোকপির দোকান');
  await p.click('#prof-results [data-prof-id=cyber]'); await solo(p);
  const { spend, income, d } = await finishSetup(p);
  ok(income.includes('Online Application Charges') && income.includes('Photocopy') && income.includes('Govt Fees Collected'), 'services as income: ' + income.slice(0, 5).join(', '));
  ok(spend.includes('Govt Fees Paid') && spend.includes('Paper & Supplies') && spend.includes('Internet Bill'), 'costs: ' + spend.slice(0, 4).join(', '));
  ok(d.settings.productGroups.includes('Toner & Ink'), 'purchases: paper, toner, lamination sheets');
  await p.screenshot({ path: 'prof5-cyber.png' });
  await ctx.close();
}
// 7. personal use, but a pharmacist's own money
{
  const { ctx, p } = await start();
  await p.fill('#prof-input', 'pharm');
  await p.click('#prof-results [data-prof-id=pharmacy]');
  await p.click('[data-next]');
  ok((await p.getAttribute('.ob', 'data-step')) === 'where' && (await p.textContent('[data-wallet=cash] strong')) === 'Cash in hand', 'personal use: no team question, own cash');
  const { d } = await finishSetup(p);
  ok(!d.settings.mode && d.settings.profession.id === 'pharmacy', 'saved as personal money, profession pharmacy');
  await ctx.close();
}
await b.close();
