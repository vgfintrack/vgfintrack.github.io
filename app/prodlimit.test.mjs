import { chromium } from 'playwright';
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const b = await chromium.launch();
const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'REPLACE_ME';" }));
await p.addInitScript(() => { if (!sessionStorage.x) { localStorage.setItem('mt:lang', 'en'); sessionStorage.x = 1; } });
await p.goto('http://localhost:8090/FinnBlu/');
await p.waitForSelector('[data-start], [data-track], #welcome-import', { state: 'attached' }); if (await p.$('[data-start]')) await p.click('[data-start]'); await p.click('[data-track=business]'); await p.click('.biz-grid [data-prof-id=grocery]'); await p.click('[data-next]'); await p.click('[data-team=solo]'); await p.click('[data-next]');
await p.click('[data-next]'); await p.click('[data-next]'); await p.click('[data-next]'); await p.click('[data-next]'); await p.click('[data-goal="0"]'); await p.click('[data-next]');
await p.click('[data-finish=""]'); await p.waitForSelector('.kpis');
await p.click('.tabbar button[data-view=setup]');
const count = () => p.textContent('#products-card .cat-count');
ok((await count()).includes('12 of 15 products used'), 'grocery starts with: ' + (await count()));
for (const name of ['Ice cream', 'Frozen food', 'Bread']) { await p.fill('#new-prod', name); await p.click('#add-prod'); await p.waitForTimeout(150); }
ok((await count()).includes('15 of 15') && !(await p.$('#new-prod')) && (await p.textContent('#products-card .limit-note')).includes('up to 15 products'), 'full at 15: add box replaced by the note');
// purchase "Other product" is blocked too
await p.click('.tabbar button[data-view=dashboard]');
await p.click('[data-quick=buy]');
await p.waitForSelector('#sup-dialog[open]'); await p.fill('#sup-name', 'Karim'); await p.click('#sup-form button[type=submit]');
await p.waitForSelector('#buy-dialog[open]');
await p.fill('#buy-new-product', 'Noodles'); await p.click('#buy-add-product'); await p.waitForTimeout(200);
const prods = await p.evaluate(() => JSON.parse(localStorage.getItem('mt:demo')).doc.settings.productGroups);
ok(prods.length === 15 && !prods.includes('Noodles') && (await p.textContent('#toast')).includes('up to 15 products'), 'purchase cannot add a 16th: ' + (await p.textContent('#toast')));
await p.fill('#buy-new-product', 'bread'); await p.click('#buy-add-product'); await p.waitForTimeout(150);
ok((await p.$$eval('#buy-products .ob-chip.on', (e) => e.map((x) => x.textContent))).some((t) => t.includes('Bread')), 'an existing product can still be picked');
// removing one makes room
await p.keyboard.press('Escape');
await p.click('.tabbar button[data-view=setup]');
await p.click('[data-del-prod="0"]'); await p.waitForTimeout(200);
ok(!!(await p.$('#new-prod')) && (await count()).includes('14 of 15'), 'remove one → room again');
// simple screen: no pig
await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('mt:demo')); d.doc.settings.simple = true; d.doc.settings.mode = undefined; localStorage.setItem('mt:demo', JSON.stringify(d)); });
await p.reload(); await p.waitForTimeout(800);
const html = await p.content();
ok(!html.includes('🐷'), 'no pig anywhere on the screen');
ok(errs.length === 0, 'no errors ' + errs.join('|'));
await b.close();
