// Money to or from family is spending or income, not a transfer.
import { chromium } from 'playwright';
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const b = await chromium.launch();
async function fresh(persona, lang = 'en', answer = 'Money from Family') {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'REPLACE_ME';" }));
  await ctx.addInitScript((l) => { if (!sessionStorage.x) { localStorage.setItem('mt:lang', l); localStorage.setItem('mt:district-later', String(Date.now() + 9e10)); sessionStorage.x = 1; } }, lang);
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? answer : undefined));
  await p.goto('http://localhost:8090/FinnBlu/');
  await p.click('[data-start]'); await p.click('[data-track=personal]'); await p.click(`[data-persona=${persona}]`); await p.click('[data-next]');
  for (let i = 0; i < 4; i++) await p.click('[data-next]');
  await p.click('[data-goal="0"]'); await p.click('[data-next]'); await p.click('[data-finish=""]');
  await p.waitForSelector('.kpis, .hand');
  return { ctx, p };
}
const doc = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('mt:demo')).doc);
const live = (d) => Object.values(d.transactions).filter((x) => !x.deleted);
const openForm = async (p, type) => {
  await p.evaluate(() => document.querySelector('#fab').click());
  await p.waitForSelector('#txn-dialog[open]');
  await p.click(`#txn-type [data-type=${type}]`);
};

// 1. a job holder sends ৳10,000 to his mother
{
  const { ctx, p } = await fresh('job');
  await openForm(p, 'Transfer');
  ok(await p.isVisible('#txn-other') && (await p.textContent('#txn-other')).includes('like your mother'), 'Transfer explains: money to or from someone else is not a transfer');
  await p.fill('#txn-amount', '10000'); await p.fill('#txn-note', 'For Ammu');
  await p.click('#txn-other [data-other=Expense]');
  ok((await p.$eval('#txn-type .active', (e) => e.dataset.type)) === 'Expense' && (await p.inputValue('#txn-category')) === 'Family Support', '“I sent it” → Expense, Family Support');
  ok((await p.inputValue('#txn-note')) === 'For Ammu' && /10000|10,000/.test(await p.inputValue('#txn-amount')), 'amount and note are kept');
  ok(!(await p.isVisible('#txn-other')), 'the note goes away on Expense');
  await p.click('#txn-form button[type=submit]'); await p.waitForTimeout(300);
  const x = live(await doc(p)).find((t) => t.amount === 10000);
  ok(x?.type === 'Expense' && x.category === 'Family Support', 'saved as spending on Family Support');
  // money received from family: a job holder has no such category yet → + New category…
  await openForm(p, 'Income');
  ok(await p.$('#txn-category option[value="__newcat"]') && !(await p.$('#txn-cat-grid [data-cat="__newcat"]')), '“+ New category…” is in the list, not in the tiles');
  await p.selectOption('#txn-category', '__newcat'); await p.waitForTimeout(300);
  ok((await p.inputValue('#txn-category')) === 'Money from Family', 'typed “Money from Family”: added and picked');
  await p.fill('#txn-amount', '2000'); await p.click('#txn-form button[type=submit]'); await p.waitForTimeout(300);
  const d = await doc(p);
  ok(d.settings.incomeCategories.includes('Money from Family') && live(d).some((t) => t.type === 'Income' && t.category === 'Money from Family' && t.amount === 2000), 'saved as income; the category stays for next time');
  // help
  await p.evaluate(() => document.querySelector('.tabbar [data-view=setup]').click());
  await p.click('#view-setup [data-help-open]'); await p.fill('#help-q', 'send money to mother');
  ok((await p.textContent('#help-results .help-item')).includes('Send money to family, or receive it'), 'help: “send money to mother” finds the answer');
  ok(p.errs.length === 0, 'no errors ' + p.errs.join('|'));
  await ctx.close();
}
// 2. his mother (running a home) records what she received, in Bangla
{
  const { ctx, p } = await fresh('home', 'bn');
  ok((await doc(p)).settings.incomeCategories.includes('Money from Family'), 'running a home starts with “Money from Family”');
  await p.evaluate(() => { const b = document.querySelector('#back-simple, [data-simple-act="details"]'); });
  await openForm(p, 'Transfer');
  ok((await p.textContent('#txn-other')).includes('মাকে') && (await p.textContent('#txn-other')).includes('আমি পেয়েছি → আয়'), 'Bangla: অন্য কাউকে (যেমন মাকে)… আমি পেয়েছি → আয়');
  await p.click('#txn-other [data-other=Income]');
  ok((await p.inputValue('#txn-category')) === 'Money from Family', '“I received it” → Income, Money from Family');
  await p.keyboard.press('Escape');
  await p.evaluate(() => document.querySelector('.tabbar [data-view=setup]').click());
  await p.click('#view-setup [data-help-open]'); await p.fill('#help-q', 'মা টাকা পাঠালাম');
  ok((await p.textContent('#help-results .help-item')).includes('পরিবারকে টাকা পাঠালে'), 'Bangla help: মা টাকা পাঠালাম → the family answer');
  ok(p.errs.length === 0, 'no errors ' + p.errs.join('|'));
  await ctx.close();
}
// 3. the category limit still holds
{
  const { ctx, p } = await fresh('job');
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('mt:demo')); d.doc.settings.incomeCategories = Array.from({ length: 20 }, (_, i) => 'Income ' + i); localStorage.setItem('mt:demo', JSON.stringify(d)); });
  await p.reload(); await p.waitForSelector('.kpis');
  await openForm(p, 'Income');
  await p.selectOption('#txn-category', '__newcat'); await p.waitForTimeout(300);
  ok((await p.textContent('#toast')).includes('24') && (await p.inputValue('#txn-category')) !== '__newcat', 'at 24 categories: explained, nothing added');
  await ctx.close();
}
await b.close();
