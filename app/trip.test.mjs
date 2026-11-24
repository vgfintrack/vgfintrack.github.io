// A group trip: Rahim starts "Bandarban", adds Karim (Gmail) and Sumi (name
// only). Both phones add money and expenses; FinnBlu shows who owes whom.
// Made-up people, fake Google.
import { chromium } from 'playwright';
import { fakeDrive, phone } from '../lib/fake-google.mjs';
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const BASE = 'http://localhost:8090/FinnBlu/';
const b = await chromium.launch();
const drive = fakeDrive();
const files = () => Object.entries(drive.files);
const synced = (p) => p.waitForFunction(() => document.querySelector('#sync')?.textContent.includes('Saved to Drive'), null, { timeout: 8000 });
const sync = (p) => p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

async function personal(p) {
  await p.goto(BASE);
  await p.click('[data-start]'); await p.click('[data-track=personal]'); await p.click('[data-persona=student]'); await p.click('[data-next]');
  await p.click('[data-wallet=bkash]'); for (let i = 0; i < 4; i++) await p.click('[data-next]');
  await p.click('[data-goal="0"]'); await p.click('[data-next]');
  await p.waitForSelector('[data-signin]'); await p.click('[data-signin]');
  await p.waitForSelector('[data-finish]'); await p.click('[data-finish=""]');
  await p.waitForSelector('.kpis'); await synced(p);
}
async function entry(p, { kind = 'Expense', amount, cat, paid, only, note }) {
  await p.click(`[data-trip-add=${kind}]`);
  await p.waitForSelector('#trip-dialog[open]');
  await p.fill('#trip-amount', String(amount));
  if (cat) await p.click(`#trip-cats [data-cat="${cat}"]`);
  if (paid) await p.selectOption('#trip-paid', { label: paid });
  if (only) {
    const chips = await p.$$eval('#trip-split [data-split]', (e) => e.map((x) => [x.dataset.split, x.textContent]));
    for (const [id, name] of chips) if (!name.includes(only)) await p.click(`#trip-split [data-split="${id}"]`);
  }
  if (note) await p.fill('#trip-note', note);
  await p.click('#trip-form button[type=submit]');
  await p.waitForFunction(() => !document.querySelector('#trip-dialog').open);
  await p.waitForTimeout(150);
}
const owe = (p) => p.$$eval('#trip-owe .trip-person', (rows) => Object.fromEntries(rows.map((r) => [r.querySelector('.name').firstChild.textContent.trim(), r.querySelector('b').textContent.trim()])));
const pays = (p) => p.$$eval('#trip-pays .li', (rows) => rows.map((r) => r.textContent.replace(/\s+/g, ' ').trim()));

// ---------------------------------------------------------------- 1. Rahim starts the trip
const R = await phone(b, 'rahim', drive);
const p = R.p;
await personal(p);
await p.click('#fab'); await p.fill('#txn-amount', '120'); await p.click('#txn-form button[type=submit]'); await p.waitForTimeout(300);
await synced(p);
await p.click('.tabbar button[data-view=setup]');
ok((await p.textContent('#trip-card')).includes('Group trips'), 'Setup has Group trips');
await p.click('[data-trip-start]');
await p.fill('#trip-start-name', 'Bandarban'); await p.fill('#trip-start-days', '3'); await p.fill('#trip-start-guide', '800'); await p.fill('#trip-start-me', 'Rahim');
await p.click('#trip-start-go');
await p.waitForSelector('.trip-head', { timeout: 8000 });
const [tripId, tripFile] = files().find(([, f]) => f.appProperties?.amrpotli === 'trip') || [];
ok(tripFile?.name === 'FinnBlu trip - Bandarban.json' && tripFile.owner === 'rahim' && !tripFile.parents.includes('appDataFolder'), 'the trip is a file in Rahim’s Drive: ' + tripFile?.name);
ok((await p.textContent('.trip-head')).includes('Bandarban') && (await p.textContent('.trip-head')).includes('1 friends'), 'trip screen: Bandarban, Rahim in it');
ok(!(await p.isVisible('.tabbar')) && !(await p.isVisible('#fab')), 'one screen: no tab bar, no + button');
const own = Object.values(drive.doc(files().find(([, f]) => f.owner === 'rahim' && f.name === 'amrpotli.json')[0]).transactions);
ok(own.length === 1 && own[0].amount === 120, 'Rahim’s own money is untouched');

// friends
await p.click('[data-trip-friend]');
await p.fill('#trip-friend-name', 'Karim'); await p.fill('#trip-friend-email', 'Karim@Gmail.com');
await p.click('#trip-friend-go'); await p.waitForFunction(() => !document.querySelector('#trip-friend-dialog').open, null, { timeout: 8000 });
await p.click('[data-trip-friend]');
await p.fill('#trip-friend-name', 'Sumi'); await p.click('#trip-friend-go');
await p.waitForFunction(() => !document.querySelector('#trip-friend-dialog').open);
ok(tripFile.perms.length === 1 && tripFile.perms[0].email === 'karim@gmail.com', 'shared with Karim only (Sumi is a name)');
ok(drive.mails.at(-1)?.to === 'karim@gmail.com' && drive.mails.at(-1).message.includes('Open a trip shared with me'), 'Google emails Karim how to open it');
ok((await p.textContent('#trip-friends')).includes('Sumi') && (await p.textContent('.trip-head')).includes('3 friends'), '3 friends');

// money in, spending
await entry(p, { kind: 'Income', amount: 3000, paid: 'Rahim' });
await entry(p, { kind: 'Income', amount: 3000, paid: 'Sumi' });
await entry(p, { amount: 6000, cat: 'Bus & train', note: 'Dhaka to Bandarban' });
await entry(p, { amount: 2400, cat: 'Guide fee' });
await synced(p);

// ---------------------------------------------------------------- 2. Karim opens it on his phone
const K = await phone(b, 'karim', drive);
const q = K.p;
await personal(q);
await q.click('.tabbar button[data-view=setup]');
await q.evaluate((id) => (window.__pick = id), tripId);
await q.click('[data-trip-join]');
await q.waitForSelector('.trip-head', { timeout: 8000 });
ok((await q.textContent('.trip-head')).includes('Trip by Rahim'), 'Karim sees Rahim’s trip');
ok((await q.textContent('#trip-entries')).includes('Dhaka to Bandarban'), 'and what Rahim added');
ok(!(await q.$('[data-trip-friend]')), 'only Rahim adds friends');
await entry(q, { kind: 'Income', amount: 3000 }); // Karim himself, by default
await entry(q, { amount: 900, cat: 'Food', paid: 'Karim' });
await entry(q, { amount: 300, cat: 'Shopping', paid: 'Karim', only: 'Karim', note: 'my cap' });
await synced(q);
const tx = Object.values(drive.doc(tripId).transactions);
ok(tx.length === 7 && tx.filter((x) => x.by === 'karim@gmail.com').length === 3, 'all 7 entries in the trip file, Karim’s marked as his');

// ---------------------------------------------------------------- 3. who owes whom
await sync(p); await p.waitForTimeout(1500); await synced(p);
ok((await p.textContent('#trip-entries')).includes('added by Karim'), 'Rahim sees Karim’s entries');
// spent 6000+2400+900 shared (3100 each) + Karim's cap 300; fund 9000 in, 8400 out, 600 left with Rahim
const o = await owe(p);
ok(o.Rahim === '−৳100' && o.Karim === '+৳800' && o.Sumi === '−৳100', 'balances: ' + JSON.stringify(o));
const pp = await pays(p);
ok(pp.length === 2 && pp.some((x) => x.includes('Rahim → Karim') && x.includes('৳700')) && pp.some((x) => x.includes('Sumi → Karim') && x.includes('৳100')), 'settle up: ' + JSON.stringify(pp));
ok((await p.textContent('#trip-owe')).includes('৳600 is left in the fund, kept by Rahim'), 'fund cash left, with Rahim');
const kp = await p.$$eval('.kpi .v', (e) => e.map((x) => x.textContent));
ok(kp[0] === '৳9,600' && kp[2] === '৳9,000' && kp[3] === '৳600', 'total spent, fund collected, left: ' + kp);
const guide = await p.textContent('.card:has(h3:text("Guide"))');
ok(guide.includes('৳2,400') && guide.includes('Fee still to pay'), 'guide: ৳800 × 3 days, paid');
ok((await q.$$eval('#trip-owe .trip-person', (r) => r.length)) === 3, 'Karim sees the same table');
await p.screenshot({ path: 'trip-owner.png', fullPage: true });
await q.click('[data-trip-add=Expense]'); await q.waitForSelector('#trip-dialog[open]');
await q.screenshot({ path: 'trip-entry.png' });
await q.click('#trip-dialog [data-close]');

// change an entry: the food was ৳1,200
await q.click('#trip-entries [data-trip-edit]:has-text("Food")');
await q.fill('#trip-amount', '1200'); await q.click('#trip-form button[type=submit]');
await q.waitForFunction(() => !document.querySelector('#trip-dialog').open);
ok((await owe(q)).Karim === '+৳1,000', 'edited: Karim now gets back ৳1,000');

// ---------------------------------------------------------------- 4. back to their own money
await p.click('[data-trip-back]');
await p.waitForSelector('.kpis:not(.trip)'); await p.waitForTimeout(400);
ok(await p.isVisible('.tabbar') && !(await p.$('.trip-head')), 'Rahim is back in his own FinnBlu');
await p.click('.tabbar button[data-view=setup]');
await p.waitForFunction(() => document.querySelector('#trip-card')?.textContent.includes('Bandarban'), null, { timeout: 5000 });
ok((await p.textContent('#trip-card')).includes('Your trip'), 'Setup lists the trip to open again');
await p.click('[data-trip-open]');
await p.waitForSelector('.trip-head');
ok((await p.textContent('#trip-entries')).includes('Dhaka to Bandarban'), 'and it opens again');

await q.click('[data-trip-back]'); await q.waitForSelector('.tabbar button[data-view=setup]:visible');
ok(!(await q.evaluate((id) => Object.keys(localStorage).some((k) => k.includes(id)), tripId)), 'Karim’s phone keeps no copy of the trip');
await q.click('.tabbar button[data-view=setup]');
await q.waitForTimeout(800);
if (await q.$('[data-trip-find]')) await q.click('[data-trip-find]'); // a phone that never opened a trip asks first
await q.waitForFunction(() => document.querySelector('#trip-card')?.textContent.includes('Shared with you'), null, { timeout: 5000 });
ok(true, 'Karim finds the trip again: shared with him');

ok(!p.errs.length && !q.errs.length, 'no errors ' + [...p.errs, ...q.errs].join('|'));
await b.close();
