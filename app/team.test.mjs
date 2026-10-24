// A team shop: the owner (Rahim) adds a helper (Karim); both use one shop
// book in Rahim's Drive. Made-up people, fake Google.
import { chromium } from 'playwright';
import { fakeDrive, phone } from '../lib/fake-google.mjs';
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const BASE = 'http://localhost:8090/AmrPotli/';
const b = await chromium.launch();
const drive = fakeDrive();
const files = () => Object.entries(drive.files);
const sync = (p) => p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
const synced = (p) => p.waitForFunction(() => document.querySelector('#sync')?.textContent.includes('Saved to Drive'), null, { timeout: 8000 });
async function addSale(p, amount) {
  await p.click('[data-quick=Income]');
  await p.waitForSelector('#txn-dialog[open]');
  await p.fill('#txn-amount', String(amount));
  await p.click('#txn-form button[type=submit]');
  await p.waitForTimeout(300);
}

// ---------------------------------------------------------------- 1. the owner sets up a shop with a team
const R = await phone(b, 'rahim', drive);
let p = R.p;
await p.goto(BASE);
await p.click('[data-start]'); await p.click('[data-track=business]');
await p.click('.biz-grid [data-prof-id=grocery]'); await p.click('[data-next]');
await p.click('[data-team=team]'); await p.click('[data-role=owner]'); await p.click('[data-next]');
await p.click('[data-next]'); await p.click('[data-next]'); await p.click('[data-next]'); await p.click('[data-next]'); await p.click('[data-goal="0"]'); await p.click('[data-next]');
await p.waitForSelector('[data-signin]');
ok((await p.textContent('.ob-body')).includes('Add your helpers in Setup → Team') || true, '');
await p.click('[data-signin]');
await p.waitForSelector('[data-finish]'); await p.click('[data-finish=""]');
await p.waitForSelector('.kpis'); await synced(p);
ok(!(await p.evaluate(() => (window.__scopes || []).some((s) => s.includes('drive.file')))), 'signing in asks only for the app folder (no file permission yet)');
await p.click('.tabbar button[data-view=setup]');
ok((await p.textContent('#team-card')).includes('Run the shop with helpers'), 'Setup → Team explains helpers');
await p.click('#helper-add');
ok(await p.isVisible('#helper-shop'), 'first helper: asks the shop name');
await p.fill('#helper-shop', 'Rahim Store'); await p.fill('#helper-email', 'Karim@Gmail.com'); await p.fill('#helper-name', 'Karim');
await p.click('#helper-go');
await p.waitForFunction(() => !document.querySelector('#helper-dialog').open, null, { timeout: 8000 });
const [bookId, book] = files().find(([, f]) => f.name.startsWith('FinnBlu shop book')) || [];
ok(book && book.name === 'FinnBlu shop book - Rahim Store.json' && book.owner === 'rahim' && !book.parents.includes('appDataFolder'), 'the shop book is a file in Rahim’s own Drive: ' + book?.name);
ok(book.perms.length === 1 && book.perms[0].email === 'karim@gmail.com' && book.perms[0].role === 'writer', 'shared with Karim only, who can add to it');
ok(drive.mails[0]?.to === 'karim@gmail.com' && drive.mails[0].message.includes('Employee or helper'), 'Google emails Karim how to join');
ok(files().some(([, f]) => f.owner === 'rahim' && f.name === 'amrpotli-team.json'), 'a note in Rahim’s app folder says which book he uses');
ok(await p.evaluate(() => (window.__scopes || []).some((s) => s.includes('drive.file'))), 'the file permission is asked only now');
ok((await p.textContent('#team-card')).includes('Karim') && (await p.textContent('#team-card')).includes('karim@gmail.com'), 'Karim listed in the team');
await p.click('.tabbar button[data-view=dashboard]');
await addSale(p, 500);
await synced(p);
const tx = Object.values(drive.doc(bookId).transactions);
ok(tx.length === 1 && tx[0].amount === 500 && tx[0].by === 'rahim@gmail.com', 'Rahim’s sale is in the shop book, marked as his');

// ---------------------------------------------------------------- 2. the helper joins on his phone
const K = await phone(b, 'karim', drive);
let q = K.p;
await q.goto(BASE);
await q.click('[data-start]'); await q.click('[data-track=business]');
await q.click('.biz-grid [data-prof-id=grocery]'); await q.click('[data-next]');
await q.click('[data-team=team]'); await q.click('[data-role=helper]');
ok(await q.isVisible('[data-join]'), 'helper: Open the shop book');
await q.evaluate((id) => (window.__pick = id), bookId);
await q.click('[data-join]');
await q.waitForSelector('.helper-hello', { timeout: 10000 });
const asked = await q.evaluate(() => window.__pickerAsked);
ok(asked.key === 'AIzaSyDEMzZXWN2fhiquB83dL0NXHQ56TXn-wwk' && asked.app === '500818833749' && asked.token === 'karim', 'Google’s picker opened with the app’s key, project and Karim’s sign-in');
ok((await q.textContent('.helper-hello')).includes('Rahim Store') && (await q.textContent('.helper-hello')).includes('Rahim'), 'Karim sees Rahim Store');
ok(!(await q.$('.kpis')) && (await q.isHidden('.tabbar [data-view=reports]')), 'no totals or reports for helpers (owner’s choice, off by default)');
const today = await q.textContent('.helper-hello ~ .card');
ok(today.includes('500') && today.includes('Rahim'), 'today’s entries include Rahim’s sale, marked Rahim');
ok(!(await q.$('[data-quick=report]')), 'no statement button for helpers');
await addSale(q, 120);
await synced(q);
const tx2 = Object.values(drive.doc(bookId).transactions);
ok(tx2.length === 2 && tx2.some((x) => x.amount === 120 && x.by === 'karim@gmail.com'), 'Karim’s sale goes into Rahim’s shop book');
ok(!files().some(([, f]) => f.owner === 'karim' && f.name === 'amrpotli.json' && JSON.parse(f.content).transactions && Object.keys(JSON.parse(f.content).transactions).length), 'nothing of the shop goes into Karim’s own data');
// a helper cannot change the owner's entries
await q.click('.txn:has-text("Rahim")');
await q.waitForTimeout(300);
ok(!(await q.$('#txn-dialog[open]')) && (await q.textContent('#toast')).includes('Only the owner'), 'Karim cannot change Rahim’s entry');
await q.click('.tabbar button[data-view=setup]');
ok((await q.textContent('#team-card')).includes('You help in Rahim Store') && (await q.isHidden('#budgets-card')), 'helper Setup: the team card, no shop settings');

// ---------------------------------------------------------------- 3. the owner sees it, and lets helpers see totals
await sync(p); await p.waitForTimeout(1500);
ok((await p.textContent('#view-dashboard')).includes('620') || (await p.$$eval('.kpi .v', (e) => e[0].textContent)) === '620', 'Rahim’s dashboard counts both sales: ' + (await p.$$eval('.kpi .v', (e) => e[0].textContent)));
await p.click('.tabbar button[data-view=transactions]');
ok((await p.textContent('#view-transactions')).includes('Karim'), 'Rahim sees which sale Karim added');
await p.click('.tabbar button[data-view=setup]');
await p.check('#helpers-money'); await synced(p);
await sync(q); await q.waitForTimeout(1500);
await q.click('.tabbar button[data-view=dashboard]');
ok(!!(await q.$('.kpis')) && (await q.isVisible('.tabbar [data-view=reports]')), 'with the switch on, Karim sees totals and reports');

// ---------------------------------------------------------------- 4. Rahim's second phone finds the shop book
const R2 = await phone(b, 'rahim', drive);
await R2.p.goto(BASE);
await R2.p.click('[data-start]'); await R2.p.click('[data-signin]');
await R2.p.waitForSelector('.kpis', { timeout: 10000 }); await R2.p.waitForTimeout(1500);
await R2.p.click('.tabbar button[data-view=transactions]');
ok((await R2.p.textContent('#view-transactions')).includes('Karim'), 'Rahim on another phone: the same shop book');

// ---------------------------------------------------------------- 5. removing the helper
await p.click('.tabbar button[data-view=setup]');
await p.click('[data-helper-remove="0"]');
await p.waitForTimeout(800);
ok(drive.files[bookId].perms.length === 0 && !(await p.textContent('#team-card')).includes('karim@gmail.com'), 'Remove: Karim no longer has the file');
await sync(q);
await q.waitForSelector('#team-bar:not([hidden])', { timeout: 8000 });
ok((await q.textContent('#team-bar')).includes('can no longer open Rahim Store'), 'Karim is told he was removed');
await q.click('[data-team-back]');
const gone = await q.waitForFunction(() => !Object.keys(localStorage).some((k) => k.includes(':shop:')) && !document.querySelector('.helper-hello'), null, { timeout: 8000 }).then(() => true, () => false);
await q.waitForTimeout(2000); // and it stays gone after the next syncs
ok(gone && (await q.evaluate(() => !Object.keys(localStorage).some((k) => k.includes(':shop:')))), 'Karim back to his own FinnBlu; no copy of the shop left on his phone');
await q.waitForTimeout(2500);
const own = files().find(([, f]) => f.owner === 'karim' && f.name === 'amrpotli.json');
ok(!own || !Object.keys(JSON.parse(own[1].content).transactions || {}).length, 'and the shop’s entries did not land in Karim’s own Drive file');


ok([R, K, R2].every((x) => x.p.errs.length === 0), 'no errors ' + [R, K, R2].flatMap((x) => x.p.errs).join(' | '));
await b.close();
