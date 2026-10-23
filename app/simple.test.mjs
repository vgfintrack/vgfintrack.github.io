import { chromium } from 'playwright';
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const b = await chromium.launch();
const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
p.on('dialog', (d) => d.accept());
await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'REPLACE_ME';" }));
await p.addInitScript(() => {
  if (!sessionStorage.x) { localStorage.setItem('mt:lang', 'bn'); sessionStorage.x = 1; }
  window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { setTimeout(() => this.onresult({ results: [[{ transcript: 'চাল সাতশো বিশ আর তেল একশো নব্বই' }]] }), 300); } stop() {} };
});
await p.goto('http://localhost:8090/AmrPotli/');
// setup as "Running a home": cash 2000, bKash 1500
await p.waitForSelector('[data-start], [data-track], #welcome-import', { state: 'attached' }); if (await p.$('[data-start]')) await p.click('[data-start]'); await p.click('[data-track=personal]'); await p.click('[data-persona=home]'); await p.click('[data-next]');
await p.click('[data-wallet=bkash]'); await p.click('[data-next]');
await p.fill('[data-bal=cash]', '2000'); await p.fill('[data-bal=bkash]', '1500'); await p.click('[data-next]');
await p.click('[data-next]'); await p.click('[data-next]'); await p.click('[data-goal="0"]'); await p.click('[data-next]');
await p.click('[data-finish=""]');
await p.waitForSelector('.hand');
await p.evaluate(() => document.querySelector('#demo-banner').hidden = true);
const hand = () => p.textContent('.hand-v');
ok((await hand()).includes('3,500'), 'simple screen: হাতে আছে ৳3,500');
ok(!(await p.$('.kpis')) && !(await p.$('.quick')) && !(await p.$('canvas')), 'no charts, KPIs or icon grid');
ok((await p.$$eval('.big-actions button', (e) => e.map((x) => x.innerText.replace(/\n/g, ' ')))).join(' | ') === '💰 টাকা পেলাম | 🛒 খরচ করলাম | 💎 জমালাম | 🤝 লোন', 'four big buttons in Bangla');
await p.screenshot({ path: 'simple1.png' });
// got money from son
await p.click('[data-simple-act=Income]');
ok(await p.$eval('#txn-type button[data-type=Income]', (e) => e.classList.contains('active')), 'টাকা পেলাম opens Income');
await p.fill('#txn-amount', '5000'); await p.click('#txn-form button[type=submit]'); await p.waitForTimeout(300);
ok((await hand()).includes('8,500'), 'in hand now 8,500');
// speak a bazar
await p.click('[data-simple-act=speak]');
await p.waitForFunction(() => document.querySelector('#txn-note').value.includes('তেল'));
ok((await p.inputValue('#txn-amount')) === '720+190' && (await p.textContent('#calc-result')) === '= 910', 'spoke a bazar: 720+190 = 910');
await p.screenshot({ path: 'simple2-speak.png' });
await p.click('#txn-form button[type=submit]'); await p.waitForTimeout(300);
ok((await hand()).includes('7,590'), 'in hand now 7,590');
// save 1000
await p.click('[data-simple-act=save]');
ok((await p.inputValue('#txn-to')) === 'savings' && (await p.inputValue('#txn-account')) !== 'savings', 'জমালাম: moves money into Savings');
await p.fill('#txn-amount', '1000'); await p.click('#txn-form button[type=submit]'); await p.waitForTimeout(300);
ok((await hand()).includes('6,590') && (await p.textContent('.hand-month')).includes('1,000'), 'savings kept apart: in hand 6,590, saved 1,000');
const month = await p.textContent('.hand-month');
ok(month.includes('5,000') && month.includes('910'), 'this month: got 5,000, spent 910: ' + month);
const rows = await p.$$eval('.txn-list .txn', (e) => e.length);
ok(rows === 3, 'recent entries listed: ' + rows);
await p.screenshot({ path: 'simple3.png', fullPage: true });
// more details, then back
await p.click('#more-details');
ok(!!(await p.$('.kpis')), 'More details shows the full Dashboard');
ok(await p.isVisible('#back-simple'), 'a "Back to simple view" button is there');
await p.click('#back-simple'); await p.waitForTimeout(200);
ok(!!(await p.$('.hand')) && !(await p.$('.kpis')), 'button returns to the simple view');
await p.click('#more-details'); await p.waitForTimeout(100);
await p.goBack(); await p.waitForTimeout(300);
ok(!!(await p.$('.hand')) && p.url().includes('/AmrPotli/'), "phone's back button returns to the simple view (stays in the app)");
await p.click('#more-details');
await p.click('.tabbar button[data-view=transactions]'); await p.click('.tabbar button[data-view=dashboard]');
ok(!!(await p.$('.hand')), 'back to the simple screen next time');
// switch off in Setup
await p.click('.tabbar button[data-view=setup]');
await p.click('[data-simple="0"]'); await p.waitForTimeout(200);
await p.click('.tabbar button[data-view=dashboard]');
ok(!!(await p.$('.kpis')) && !(await p.$('.hand')), 'Setup → Detailed turns it off');
await p.click('.tabbar button[data-view=setup]'); await p.click('[data-simple="1"]'); await p.waitForTimeout(200);
await p.click('.tabbar button[data-view=dashboard]');
ok(!!(await p.$('.hand')), 'and back on');
ok(errs.length === 0, 'no page errors ' + errs.join('|'));
await b.close();
