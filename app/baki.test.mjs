import { chromium } from 'playwright';
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const b = await chromium.launch();
const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
p.on('dialog', (d) => d.accept());
await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'REPLACE_ME';" }));
await p.addInitScript(() => { if (!sessionStorage.x) { localStorage.setItem('mt:lang', 'en'); sessionStorage.x = 1; } });
await p.goto('http://localhost:8090/AmrPotli/');
await p.waitForSelector('[data-start], [data-track], #welcome-import', { state: 'attached' }); if (await p.$('[data-start]')) await p.click('[data-start]'); await p.click('[data-track=business]'); await p.click('.biz-grid [data-prof-id=grocery]'); await p.click('[data-next]'); await p.click('[data-team=solo]'); await p.click('[data-next]');
await p.click('[data-next]'); await p.fill('[data-bal=cash]', '1000'); await p.click('[data-next]');
await p.click('[data-next]'); await p.click('[data-next]'); await p.click('[data-goal="0"]'); await p.click('[data-next]');
await p.click('[data-finish=""]'); await p.waitForSelector('.kpis');
await p.evaluate(() => (document.querySelector('#demo-banner').hidden = true));
const tap = async (keys) => { for (const k of keys) await p.click(`#baki-calc-pad [data-k="${k}"]`); };
const custRow = (n) => p.$$eval('#baki-card .sup-row', (els, n) => els.find((e) => e.innerText.includes(n))?.querySelector('.num')?.textContent, n);
const cash = () => p.$$eval('.list .li', (els) => els.find((e) => e.innerText.includes('Cash Box'))?.querySelector('.num')?.textContent);
ok((await p.$$eval('[data-quick] span:last-child', (e) => e.slice(0, 3).map((x) => x.textContent))).join() === 'Sale,Baki sale,Got baki', 'shop grid: Sale, Baki sale, Got baki');
// 1. first baki sale: no customers -> add one
await p.click('[data-quick=baki]');
await p.waitForSelector('#cust-dialog[open]');
await p.fill('#cust-name', 'Rahim bhai'); await p.fill('#cust-phone', '01712-345678'); await p.fill('#cust-area', 'Polashi');
await p.click('#cust-form button[type=submit]');
await p.waitForSelector('#baki-dialog[open]');
ok((await p.inputValue('#baki-customer')) && (await p.$eval('#baki-customer option:checked', (e) => e.textContent)) === 'Rahim bhai', 'baki form opens with the new customer');
await tap(['6', '0', '+', '8', '0', '+', '1', '5', '0']);
ok((await p.textContent('#baki-calc-result')) === '= 290', 'calculator: 60+80+150 = 290');
await p.fill('#baki-items', 'rice, oil, eggs'); await p.fill('#baki-paid', '90');
ok((await p.textContent('#baki-hint')).includes('200 goes on baki'), 'hint: ' + (await p.textContent('#baki-hint')));
await p.screenshot({ path: 'baki1-form.png' });
await p.click('#baki-form button[type=submit]'); await p.waitForTimeout(300);
// 2. a second customer with old baki
await p.click('[data-cust-add]');
await p.fill('#cust-name', 'Karim (tea stall)'); await p.fill('#cust-due', '500');
await p.click('#cust-form button[type=submit]'); await p.waitForTimeout(200);
ok((await custRow('Rahim')) === '200' && (await custRow('Karim')) === '500', `khata: Rahim ${await custRow('Rahim')}, Karim ${await custRow('Karim')}`);
ok((await p.textContent('#baki-card .loan-head')).includes('700'), 'customers owe 700 in total');
const k = await p.$$eval('.kpi .v', (e) => e.map((x) => x.textContent));
ok(k[0] === '290', 'the whole sale counts as sales: ' + k[0]);
ok((await cash()) === '1,090', 'cash box got the 90 paid now: ' + (await cash()));
ok(!(await p.$$eval('.card h3', (e) => e.some((x) => x.textContent.startsWith('Loans') && x.closest('.card').innerText.includes('Rahim')))), 'customers are not shown as loans');
await p.screenshot({ path: 'baki2-dash.png', fullPage: true });
// 3. customer page + WhatsApp
await p.click('[data-cust] >> text=Rahim');
await p.waitForSelector('#custv-dialog[open]');
const wa = await p.getAttribute('[data-custv=wa]', 'href');
const msg = decodeURIComponent(wa.split('text=')[1]);
ok(wa.startsWith('https://wa.me/8801712345678?') && msg.includes('৳200') && msg.includes('Rahim bhai'), 'WhatsApp reminder: ' + msg);
const hist = await p.textContent('#custv-body');
ok(hist.includes('Baki sale · Rahim bhai') && hist.includes('Got baki from Rahim bhai'), 'history: baki sale and the 90 paid');
await p.screenshot({ path: 'baki3-customer.png' });
// 4. got payment
await p.click('[data-custv=paid]');
ok(await p.$eval('#txn-type button[data-type=Transfer]', (e) => e.classList.contains('active')) && (await p.inputValue('#txn-amount')) === '200', 'Got payment: 200 from Rahim into the cash box (not a loan)');
await p.click('#txn-form button[type=submit]'); await p.waitForTimeout(300);
ok(!(await custRow('Rahim')) && (await p.textContent('#baki-card')).includes('1 more customers with nothing due'), 'Rahim paid off and leaves the list');
ok((await cash()) === '1,290', 'cash box 1,290');
// 5. Got baki quick action opens who owes most
await p.click('[data-quick=getbaki]');
ok((await p.textContent('#custv-title')).includes('Karim'), 'Got baki opens the customer who owes most');
await p.click('#custv-dialog [data-close]');
// 6. list
await p.click('.tabbar button[data-view=transactions]');
const rows = await p.$$eval('#view-transactions .txn', (e) => e.map((x) => x.innerText.replace(/\n/g, ' ')));
ok(rows.some((r) => r.startsWith('📒 Baki sale · Rahim bhai')) && rows.some((r) => r.startsWith('💵 Got baki from Rahim bhai')), 'transactions list wording and icons');
// 7. Bangla
await p.evaluate(() => localStorage.setItem('mt:lang', 'bn')); await p.reload(); await p.waitForSelector('.kpis');
ok((await p.textContent('#baki-card h3')).includes('বাকির খাতা'), 'Bangla: বাকির খাতা');
await p.click('[data-cust] >> text=Karim');
ok(decodeURIComponent((await p.getAttribute('[data-custv=wa]', 'href')).split('text=')[1]).includes('আপনার বাকি ৳500'), 'Bangla WhatsApp message');
ok(errs.length === 0, 'no page errors ' + errs.join('|'));
await b.close();
