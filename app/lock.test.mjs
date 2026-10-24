// App lock (PIN). Opening the app fresh always asks; "Lock after" (1 minute)
// only covers switching to another app and back, or a refresh.
import { chromium } from 'playwright';
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const BASE = 'http://localhost:8090/FinnBlu/';
const b = await chromium.launch();
const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'REPLACE_ME';" }));
await ctx.addInitScript(() => {
  if (!localStorage.getItem('mt:lang')) { localStorage.setItem('mt:lang', 'en'); localStorage.setItem('mt:district-later', String(Date.now() + 9e10)); }
  addEventListener('DOMContentLoaded', () => new MutationObserver(() => { if (document.querySelector('.lock')) window.__sawLock = true; }).observe(document.body, { childList: true, subtree: true }));
});
const errs = [];
const open = async () => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(BASE);
  return p;
};
const pin = async (p, s) => { for (const k of s) await p.click(`.lock-pad [data-k="${k}"]`); await p.waitForTimeout(350); };
const locked = (p) => p.$('.lock').then(Boolean);
const seenAgo = (p, s) => p.evaluate((ms) => localStorage.setItem('mt:lock-seen:demo', String(Date.now() - ms)), s * 1000);
const hide = (p) => p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
const show = (p) => p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });

let p = await open();
await p.waitForSelector('[data-start], [data-track], #welcome-import', { state: 'attached' });
if (await p.$('[data-start]')) await p.click('[data-start]');
await p.setInputFiles('#welcome-import', '../fixtures/demo.json');
await p.waitForSelector('.kpis');

// turn the lock on
await p.click('.tabbar button[data-view=setup]');
await p.click('[data-lock-on]'); await p.waitForSelector('.lock');
await pin(p, '2580'); await pin(p, '2580');
ok(!(await locked(p)), 'PIN set');
const cfg = await p.evaluate(() => JSON.parse(localStorage.getItem('mt:lock:demo')));
ok(cfg?.hash && !JSON.stringify(cfg).includes('2580') && cfg.after === 60, 'only a salted hash is kept; locks after 1 minute');

// a refresh within the minute: no PIN
await p.evaluate(() => (window.__sawLock = false));
await p.reload(); await p.waitForSelector('.kpis'); await p.waitForTimeout(600);
ok(!(await p.evaluate(() => !!window.__sawLock)), 'refresh within 1 minute: no PIN');

// switch to another app and back within the minute: no PIN
await hide(p); await seenAgo(p, 20); await show(p); await p.waitForTimeout(400);
ok(!(await locked(p)), 'back after 20 seconds in another app: no PIN');

// away for longer than the minute: PIN
await hide(p); await seenAgo(p, 75); await show(p);
await p.waitForSelector('.lock', { timeout: 3000 }).catch(() => {});
ok(await locked(p), 'back after 75 seconds: asks for the PIN');
await pin(p, '1111');
ok(await locked(p) && (await p.textContent('.lock-msg')).length > 0, 'wrong PIN: still locked, with a message');
await pin(p, '2580');
ok(!(await locked(p)), 'right PIN opens');

// the report: closed and opened again within the minute. A fresh start always asks.
await hide(p); await p.close();
const q = await open();
await q.waitForSelector('.lock', { timeout: 5000 }).catch(() => {});
ok(await locked(q), 'closed and reopened within the minute: asks for the PIN');
ok(await q.$eval('#app', (e) => getComputedStyle(e).visibility === 'hidden' || e.hidden || document.documentElement.classList.contains('locked')), 'money hidden behind the lock');
await pin(q, '2580');
ok(!(await locked(q)) && !!(await q.$('.kpis')), 'unlocked with the PIN');
await q.reload(); await q.waitForSelector('.kpis'); await q.waitForTimeout(600);
ok(!(await locked(q)), 'and a refresh after that does not ask again');
ok(!errs.length, 'no errors ' + errs.join('|'));
await b.close();
