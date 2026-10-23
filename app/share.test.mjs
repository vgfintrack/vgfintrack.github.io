// An SMS shared to AmrPotli (Android's Share menu) or copied before opening it.
import { chromium } from 'playwright';
import fs from 'node:fs';
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const BASE = 'http://localhost:8090/AmrPotli/';
const PAY = 'Payment of Tk 200.00 to Grameenphone Ltd-MYGP-RM44473 is successful. Balance Tk 5,520.00. TrxID DJN9FCWT3X at 23/10/2026 15:40';
const GOT = 'You have received Tk 1,500.00 from 01711111111. Fee Tk 0.00. Balance Tk 3,500.00. TrxID 9KQ2LM7XZ1 at 23/10/2026 10:00';
const b = await chromium.launch();

const manifest = JSON.parse(fs.readFileSync(`${process.env.AMRPOTLI_SITE}/AmrPotli/manifest.json`, 'utf8'));
ok(manifest.share_target?.action === './?share' && manifest.share_target.method === 'GET' && manifest.share_target.params.text === 'text', 'the installed app offers itself in the Share menu');

async function phone({ clipboard = false } = {}) {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  if (clipboard) await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:8090' });
  await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'REPLACE_ME';" }));
  await ctx.addInitScript(() => { if (!sessionStorage.x) { localStorage.setItem('mt:lang', 'en'); localStorage.setItem('mt:district-later', String(Date.now() + 9e10)); sessionStorage.x = 1; } });
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  return { ctx, p };
}
async function setup(p) {
  await p.click('[data-start]'); await p.click('[data-track=personal]'); await p.click('[data-persona=job]'); await p.click('[data-next]');
  await p.click('[data-wallet=bkash]'); await p.click('[data-next]'); await p.click('[data-next]'); await p.click('[data-next]'); await p.click('[data-next]');
  await p.click('[data-goal="0"]'); await p.click('[data-next]'); await p.click('[data-finish=""]');
  await p.waitForSelector('.kpis');
}
const shareUrl = (text) => `${BASE}?share=&title=&text=${encodeURIComponent(text)}`;

// 1. shared before the app was set up: waits, then opens filled
{
  const { ctx, p } = await phone();
  await p.goto(shareUrl(PAY));
  await p.waitForSelector('[data-start]');
  ok(!(await p.$('#txn-dialog[open]')) && !p.url().includes('share'), 'a new phone: setup first, the address is cleaned');
  await setup(p);
  await p.waitForSelector('#txn-dialog[open]', { timeout: 5000 }).catch(() => {});
  ok(!!(await p.$('#txn-dialog[open]')) && /^200(\.0+)?$/.test(await p.inputValue('#txn-amount')) && (await p.inputValue('#txn-note')).includes('Grameenphone'), 'after setup, the shared SMS opens as a filled entry');
  ok((await p.inputValue('#txn-category')) === 'Mobile & Internet', 'Grameenphone → Mobile & Internet');
  await p.click('#txn-form button[type=submit]'); await p.waitForTimeout(300);
  // 2. shared again later, on an app already set up
  await p.goto(shareUrl(GOT));
  await p.waitForSelector('#txn-dialog[open]', { timeout: 8000 }).catch(() => {});
  ok((await p.$eval('#txn-type .active', (e) => e.dataset.type)) === 'Income' && /^1500/.test(await p.inputValue('#txn-amount')), 'money received shared → Income ৳1,500, filled');
  await p.keyboard.press('Escape');
  // 3. something that is not a money SMS
  await p.goto(shareUrl('Hello, see you at 5'));
  await p.waitForSelector('#txn-dialog[open]', { timeout: 8000 }).catch(() => {});
  ok((await p.isVisible('#sms-panel')) && (await p.inputValue('#sms-text')) === 'Hello, see you at 5' && (await p.textContent('#sms-info')).includes("Couldn't read"), 'not a money SMS: shown in the box with a note, to fix by hand');
  ok(p.errs.length === 0, 'no errors ' + p.errs.join('|'));
  await ctx.close();
}
// 4. smart paste, where pasting was allowed
{
  const { ctx, p } = await phone({ clipboard: true });
  await p.goto(BASE); await setup(p);
  await p.evaluate((t) => navigator.clipboard.writeText(t), PAY);
  await p.evaluate(() => window.dispatchEvent(new Event('focus')));
  await p.waitForSelector('.clip-card', { timeout: 5000 }).catch(() => {});
  ok((await p.textContent('.clip-card')).includes('Add the SMS you copied?') && (await p.textContent('.clip-card')).includes('200'), 'copied SMS: “Add the SMS you copied? ৳200 · Grameenphone”');
  await p.click('[data-clip-add]');
  ok(/^200/.test(await p.inputValue('#txn-amount')) && !(await p.$('.clip-card')), 'Add: the entry opens filled, the offer goes away');
  await p.click('#txn-form button[type=submit]'); await p.waitForTimeout(300);
  await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await p.waitForTimeout(1000);
  ok(!(await p.$('.clip-card')), 'not offered again once added');
  await p.evaluate((t) => navigator.clipboard.writeText(t), GOT);
  await p.evaluate(() => window.dispatchEvent(new Event('focus')));
  await p.waitForSelector('.clip-card', { timeout: 5000 }).catch(() => {});
  await p.click('[data-clip-no]');
  await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await p.waitForTimeout(1000);
  ok(!(await p.$('.clip-card')), 'No thanks: not offered again for that SMS');
  await p.evaluate(() => navigator.clipboard.writeText('Meeting at 5, bring the papers'));
  await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await p.waitForTimeout(1000);
  ok(!(await p.$('.clip-card')), 'ordinary copied text is ignored');
  ok(p.errs.length === 0, 'no errors ' + p.errs.join('|'));
  await ctx.close();
}
// 5. without permission to paste, nothing is read
{
  const { ctx, p } = await phone();
  await p.goto(BASE); await setup(p);
  await p.evaluate(() => { window.__reads = 0; const r = navigator.clipboard.readText.bind(navigator.clipboard); navigator.clipboard.readText = () => { window.__reads++; return r(); }; });
  await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await p.waitForTimeout(1000);
  ok((await p.evaluate(() => window.__reads)) === 0 && !(await p.$('.clip-card')), 'not allowed: the clipboard is never read on its own');
  await ctx.close();
}
await b.close();
