// Potli tips and the "How do I…?" help. Made-up people, fixed dates.
import { chromium } from 'playwright';
import { personal, shop } from '../fixtures/tips-people.mjs';
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const b = await chromium.launch();
async function open(doc, day, lang = 'en') {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'REPLACE_ME';" }));
  await ctx.addInitScript(([d, l]) => {
    if (!sessionStorage.x) {
      localStorage.setItem('mt:lang', l);
      localStorage.setItem('mt:district-later', String(Date.now() + 9e10));
      localStorage.setItem('mt:demo', JSON.stringify({ doc: d, dirty: false }));
      sessionStorage.x = 1;
    }
  }, [doc, lang]);
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date(`${day}T10:00:00`));
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  await p.goto('http://localhost:8090/AmrPotli/');
  await p.waitForSelector('.potli-tips', { timeout: 10000 }).catch(() => {});
  return { ctx, p };
}
const tipsText = (p) => p.$$eval('.pt-tip p', (e) => e.map((x) => x.textContent.trim()));

// ---------------------------------------------------------------- 1. Nusrat, a job holder (Sunday 11 Oct 2026)
{
  const { ctx, p } = await open(personal, '2026-10-11');
  const tips = await tipsText(p);
  ok(tips.length === 2 && (await p.textContent('.potli-tips')).includes('Potli says'), 'Potli says: 2 tips on the dashboard');
  await p.click('[data-tips-more]');
  const all = await tipsText(p);
  const has = (s) => all.some((x) => x.includes(s));
  ok(has('House rent ৳8,000 is due tomorrow, but Cash in Hand has only'), 'rent due tomorrow, and the account is short');
  ok(has('Loan from Karim: you owe ৳3,000, due in 3 days') || has('Karim: you owe ৳3,000, due in 3 days'), 'loan due soon');
  ok(has('Food budget: 88% used, 20 days left'), 'budget pace: Food 88% used');
  ok(has('Food so far this month: ৳2,650') && has('more than by this day last month'), 'Food up versus last month');
  ok(has('Charges for cash-out and sending money cost you ৳125'), 'charges this month');
  ok(has('Last week you spent'), 'last week summary (a new week started yesterday)');
  ok(has('No entries for 4 days'), 'no entries for 4 days, with a button to add');
  ok(has('Savings goal ৳5,000') && has('behind'), 'savings goal: behind, with how much less a day');
  ok(all[0].includes('due tomorrow'), 'the most urgent tip comes first');
  // "not useful" hides one tip and remembers it
  const before = all.length;
  await p.click('.pt-tip:has-text("Charges for cash-out") [data-tip-hide]');
  ok((await tipsText(p)).length === before - 1 && (await p.textContent('#toast')).includes('fewer tips like this'), 'Not useful: the tip goes away');
  await p.reload(); await p.waitForSelector('.potli-tips'); await p.click('[data-tips-more]');
  ok(!(await tipsText(p)).some((x) => x.includes('Charges for cash-out')), '…and stays hidden after a reload');
  // the add button
  await p.click('.pt-tip:has-text("No entries") [data-tip-act=add]');
  ok(!!(await p.$('#txn-dialog[open]')), 'the tip’s button opens a new entry');
  await p.keyboard.press('Escape');
  // help
  await p.click('.potli-tips [data-help-open]');
  await p.waitForSelector('#help-dialog[open]');
  ok((await p.$$('#help-results .help-item')).length === 6, 'How do I…?: six popular answers to start');
  await p.fill('#help-q', 'bkash sms');
  const first = await p.$eval('#help-results .help-item', (e) => e.innerText);
  ok(first.includes('Add from a bKash, Nagad or bank SMS') && first.includes('Paste SMS') && (await p.getAttribute('#help-results .help-item a', 'href')) === '../guides/how-to.html#sms', 'search “bkash sms” finds the SMS answer and its guide');
  await p.fill('#help-q', 'karmochari');
  ok((await p.textContent('#help-results')).includes('Let my employee or family add sales'), 'Banglish works: karmochari → helpers');
  await p.fill('#help-q', 'xyzzy');
  ok((await p.textContent('#help-results')).includes('Nothing found'), 'nothing found: offers feedback');
  ok(p.errs.length === 0, 'no errors ' + p.errs.join('|'));
  await ctx.close();
}
// Bangla
{
  const { ctx, p } = await open(personal, '2026-10-11', 'bn');
  const t = await p.textContent('.potli-tips');
  ok(t.includes('পোটলি বলছে') && t.includes('আগামীকাল'), 'Bangla: পোটলি বলছে … আগামীকাল');
  await p.screenshot({ path: 'tips-bn.png' });
  await p.click('.potli-tips [data-help-open]');
  await p.fill('#help-q', 'লোন');
  ok((await p.textContent('#help-results .help-item')).includes('ধার বা কিস্তি কীভাবে লিখব?'), 'Bangla search: লোন → ধার বা কিস্তি first');
  await p.fill('#help-q', 'বাকি');
  ok((await p.textContent('#help-results .help-item')).includes('বাকিতে বিক্রি'), 'Bangla search: বাকি → baki sale first');
  await ctx.close();
}
// ---------------------------------------------------------------- 2. a shop (Thursday 15 Oct 2026)
{
  const { ctx, p } = await open(shop, '2026-10-15');
  await p.click('[data-tips-more]').catch(() => {});
  const all = await tipsText(p);
  const has = (s) => all.some((x) => x.includes(s));
  ok(has('Your best sales day is Friday') && has('than Tuesday'), 'best sales day Friday, slowest Tuesday');
  ok(has('Profit margin so far this month') && has('Stock Purchase'), 'profit margin down, stock purchase rose most');
  ok(has('Rafiq owes ৳2,500 baki'), 'old baki: Rafiq');
  ok(!has('Stock Purchase so far this month'), 'no separate “stock purchase grew” tip next to the margin tip');
  await p.click('.pt-tip:has-text("Rafiq") [data-tip-act=customer]');
  ok(!!(await p.$('#custv-dialog[open]')), 'the baki tip opens Rafiq');
  ok(p.errs.length === 0, 'no errors ' + p.errs.join('|'));
  await ctx.close();
}
await b.close();
