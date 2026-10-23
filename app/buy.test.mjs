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
// shop setup: cash box 5000
await p.waitForSelector('[data-start], [data-track], #welcome-import', { state: 'attached' }); if (await p.$('[data-start]')) await p.click('[data-start]'); await p.click('[data-track=business]'); await p.click('.biz-grid [data-prof-id=grocery]'); await p.click('[data-next]'); await p.click('[data-team=solo]'); await p.click('[data-next]');
await p.click('[data-next]'); await p.fill('[data-bal=cash]', '5000'); await p.click('[data-next]');
await p.click('[data-next]'); await p.click('[data-next]'); await p.click('[data-goal="0"]'); await p.click('[data-next]');
await p.click('[data-finish=""]'); await p.waitForSelector('.kpis');
await p.evaluate(() => document.querySelector('#demo-banner').hidden = true);
const doc = () => p.evaluate(() => JSON.parse(localStorage.getItem('mt:demo')).doc);
const supRow = (name) => p.$$eval('#suppliers-card .sup-row', (els, n) => els.find((e) => e.innerText.includes(n))?.querySelector('.num')?.textContent, name);

// 1. first purchase with no suppliers: add a sales rep first
await p.click('[data-quick=buy]');
await p.waitForSelector('#sup-dialog[open]');
ok(true, 'no suppliers yet: asks to add one first');
await p.click('#sup-kind [data-kind=sr]');
ok((await p.textContent('#sup-name-label')) === "Sales rep's name" && (await p.isVisible('#sup-of')) && !(await p.isVisible('#sup-place')), 'sales rep: name + company fields');
await p.fill('#sup-name', 'Karim'); await p.fill('#sup-of', 'PRAN');
await p.screenshot({ path: 'buy1-supplier.png' });
await p.click('#sup-form button[type=submit]');
await p.waitForSelector('#buy-dialog[open]');
ok((await p.$eval('#buy-supplier option:checked', (e) => e.textContent)).includes('Karim'), 'then the purchase form opens with Karim');
// 2. products with amounts -> total adds up; part paid
await p.click('[data-product="Biscuits & Snacks"]'); await p.click('[data-product="Drinks"]');
await p.fill('[data-item="0"]', '500'); await p.fill('[data-item="1"]', '300');
ok((await p.inputValue('#buy-total')) === '800' && (await p.$eval('#buy-total', (e) => e.readOnly)), 'total = sum of items (800)');
await p.fill('#buy-paid', '500'); await p.fill('#buy-memo', 'M-1021');
ok((await p.textContent('#buy-hint')).includes('300 goes on baki'), 'hint: ' + (await p.textContent('#buy-hint')));
await p.screenshot({ path: 'buy2-form.png' });
await p.click('#buy-form button[type=submit]'); await p.waitForTimeout(300);
// 3. a wholesaler with old baki
await p.click('[data-sup-add]');
await p.click('#sup-kind [data-kind=wholesale]');
ok((await p.textContent('#sup-name-label')) === 'Shop name' && (await p.isVisible('#sup-place')) && !(await p.isVisible('#sup-of')), 'wholesaler: shop name + market');
await p.fill('#sup-name', 'Rahim Store'); await p.fill('#sup-place', 'Moulvibazar'); await p.fill('#sup-due', '2000');
await p.click('#sup-form button[type=submit]'); await p.waitForTimeout(200);
// 4. purchase from Rahim, total only, all on baki, new product
await p.click('[data-buy]');
await p.selectOption('#buy-supplier', { label: '🏬 Rahim Store' });
await p.click('[data-product="Rice & Grains"]');
await p.fill('#buy-new-product', 'Ice cream'); await p.click('#buy-add-product');
await p.fill('#buy-total', '5000'); await p.click('#buy-paid-none');
await p.click('#buy-form button[type=submit]'); await p.waitForTimeout(300);
// 5. dashboard
ok((await supRow('Rahim Store')) === '7,000' && (await supRow('Karim')) === '300', `suppliers: Rahim ${await supRow('Rahim Store')}, Karim ${await supRow('Karim')}`);
const pc = await p.$$eval('.card', (e) => e.map((x) => x.innerText).find((x) => x.includes('Purchases this month')) || '');
ok(pc.includes('5,800') && /Biscuits & Snacks\s*500/.test(pc) && /Drinks\s*300/.test(pc) && /Mixed, not split\s*5,000/.test(pc), 'purchases by product: ' + pc.replace(/\n/g, ' ').slice(0, 160));
const cash = await p.$$eval('.list .li', (els) => els.find((e) => e.innerText.includes('Cash Box'))?.querySelector('.num')?.textContent);
ok(cash === '4,500', 'cash box paid 500: ' + cash);
const k = await p.$$eval('.kpi .v', (e) => e.map((x) => x.textContent));
ok(k[1] === '5,800', 'costs include stock purchases: ' + k[1]);
ok(!(await p.$$eval('.card', (e) => e.some((x) => x.innerText.startsWith('Loans') && x.innerText.includes('Rahim')))), 'suppliers are not shown as loans');
await p.screenshot({ path: 'buy3-dash.png', fullPage: true });
// 6. supplier view + pay
await p.click('[data-sup] >> text=Karim');
await p.waitForSelector('#supv-dialog[open]');
const v = await p.textContent('#supv-body');
ok(v.includes('Sales rep') && v.includes('PRAN') && v.includes('300') && v.includes('Purchase · Karim') && v.includes('Paid Karim'), 'Karim: history shows purchase and payment');
await p.screenshot({ path: 'buy4-view.png' });
await p.click('[data-supv=pay]');
ok(await p.$eval('#txn-type button[data-type=Transfer]', (e) => e.classList.contains('active')) && (await p.inputValue('#txn-amount')) === '300', 'Pay: transfer filled with 300 (not a loan)');
await p.click('#txn-form button[type=submit]'); await p.waitForTimeout(300);
ok((await supRow('Karim')) === '0', 'Karim paid off: ' + (await supRow('Karim')) + ' ' + await p.evaluate(() => JSON.stringify(Object.values(JSON.parse(localStorage.getItem('mt:demo')).doc.transactions).filter((x) => x.type === 'Transfer').map((x) => [x.account, x.toAccount, x.amount]))));
// 7. edit Rahim's baki
await p.click('[data-sup] >> text=Rahim Store'); await p.click('[data-supv=edit]');
ok((await p.inputValue('#sup-due')) === '7000', 'edit shows current baki');
await p.fill('#sup-due', '6500'); await p.click('#sup-form button[type=submit]'); await p.waitForTimeout(200);
ok((await supRow('Rahim Store')) === '6,500', 'baki corrected to 6,500');
// 8. data + setup products
const d = await doc();
const buys = Object.values(d.transactions).filter((x) => !x.deleted && x.purchase && x.type === 'Expense');
ok(buys.length === 2 && buys.some((x) => x.memo === 'M-1021' && x.items.length === 2), 'purchases saved with items and memo');
ok(d.settings.productGroups.includes('Ice cream'), 'new product remembered');
await p.click('.tabbar button[data-view=setup]');
ok((await p.textContent('#products-card')).includes('Ice cream'), 'Setup lists products');
// 9. transactions list icons
await p.click('.tabbar button[data-view=transactions]');
const rows = await p.$$eval('#view-transactions .txn', (e) => e.map((x) => x.innerText.replace(/\n/g, ' ')));
ok(rows.some((r) => r.startsWith('📦 Purchase · Rahim Store')) && rows.some((r) => r.startsWith('💵 Paid Karim')), 'list: 📦 purchases, 💵 payments');
// 10. Bangla
await p.evaluate(() => localStorage.setItem('mt:lang', 'bn')); await p.reload(); await p.waitForSelector('.kpis');
ok((await p.textContent('#suppliers-card h3')).includes('সাপ্লায়ার'), 'Bangla suppliers card');
await p.click('[data-buy]');
ok((await p.textContent('#buy-dialog h2')).includes('মাল কেনা'), 'Bangla purchase form');
ok(errs.length === 0, 'no page errors ' + errs.join('|'));
await b.close();
