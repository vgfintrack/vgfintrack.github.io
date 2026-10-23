import { chromium } from 'playwright';
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const b = await chromium.launch();
async function run(said, { support = true, fail = null, lang = 'bn' } = {}) {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  p.reqs = []; p.on('request', (r) => p.reqs.push(r.url()));
  await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'REPLACE_ME';" }));
  await p.addInitScript(([said, support, fail, lang]) => {
    if (!sessionStorage.x) { localStorage.setItem('mt:lang', lang); sessionStorage.x = 1; }
    if (!support) { delete window.webkitSpeechRecognition; delete window.SpeechRecognition; return; }
    window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { window.__lang = this.lang; setTimeout(() => (fail ? this.onerror({ error: fail }) : this.onresult({ results: [[{ transcript: said }]] })), 300); } stop() {} };
  }, [said, support, fail, lang]);
  await p.goto('http://localhost:8090/AmrPotli/');
  await p.waitForSelector('[data-start], [data-track], #welcome-import', { state: 'attached' }); if (await p.$('[data-start]')) await p.click('[data-start]'); await p.click('[data-track=personal]'); await p.click('[data-persona=home]'); await p.click('[data-next]');
  await p.click('[data-next]'); await p.click('[data-next]'); await p.click('[data-next]'); await p.click('[data-next]');
  await p.click('[data-goal="0"]'); await p.click('[data-next]'); await p.click('[data-finish=""]');
  await p.waitForSelector('.hand'); // "Running a home" opens the simple screen
  await p.click('#fab');
  return { ctx, p };
}
{
  const { ctx, p } = await run('ডিম দেড়শো মাছ সাড়ে চারশো সবজি আশি');
  ok(!p.reqs.some((u) => u.endsWith('/voice.js')), 'voice code not loaded until 🎤 is tapped');
  ok(await p.isVisible('#voice-btn'), 'Bangla: 🎤 button shown: ' + (await p.textContent('#voice-btn')));
  await p.click('#voice-btn');
  await p.waitForTimeout(100);
  ok((await p.textContent('#voice-btn')).includes('শুনছি'), 'shows listening');
  await p.waitForFunction(() => !document.querySelector('#voice-btn').classList.contains('listening'));
  ok((await p.evaluate(() => window.__lang)) === 'bn-BD', 'listens in Bangla (bn-BD)');
  ok((await p.inputValue('#txn-amount')) === '150+450+80' && (await p.textContent('#calc-result')) === '= 680', 'amount 150+450+80 = 680');
  ok((await p.inputValue('#txn-note')) === 'ডিম 150 + মাছ 450 + সবজি 80', 'note lists the items');
  ok((await p.inputValue('#txn-category')) === 'Bazar & Groceries', 'category Bazar & Groceries');
  await p.screenshot({ path: 'voice1.png' });
  await p.click('#txn-form button[type=submit]'); await p.waitForTimeout(300);
  const d = await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('mt:demo')).doc.transactions).filter((x) => !x.deleted)[0]);
  ok(d.amount === 680 && d.note === 'ডিম 150 + মাছ 450 + সবজি 80', 'saved ৳680 once, with the items (not repeated)');
  ok(p.errs.length === 0, 'no errors ' + p.errs.join('|'));
  await ctx.close();
}
{
  const { ctx, p } = await run('ছেলে পাঁচ হাজার টাকা পাঠাইছে পেলাম');
  await p.click('#voice-btn'); await p.waitForFunction(() => !document.querySelector('#voice-btn').classList.contains('listening'));
  ok(await p.$eval('#txn-type button[data-type=Income]', (e) => e.classList.contains('active')) && (await p.inputValue('#txn-amount')) === '5000' && (await p.inputValue('#txn-category')) === 'Household Money', 'পেলাম: income 5000, Household Money');
  await ctx.close();
}
{
  const { ctx, p } = await run('', { fail: 'not-allowed' });
  await p.click('#voice-btn'); await p.waitForFunction(() => !document.querySelector('#voice-btn').classList.contains('listening'));
  ok((await p.textContent('#sms-info')).includes('মাইক্রোফোনের অনুমতি') && (await p.textContent('#voice-btn')).includes('বলুন'), 'mic blocked: explained, button back');
  await ctx.close();
}
{
  const { ctx, p } = await run('', { support: false });
  ok(!(await p.isVisible('#voice-btn')), 'no speech support: no 🎤 button (typing only)');
  await ctx.close();
}
await b.close();
