import { chromium } from 'playwright';
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const b = await chromium.launch();
for (const [lang, theme, w] of [['bn', 'light', 360], ['en', 'dark', 320], ['bn', 'dark', 1280]]) {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: w, height: w > 800 ? 800 : 700 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'REPLACE_ME';" }));
  await p.addInitScript(([l, th]) => { if (!sessionStorage.x) { localStorage.setItem('mt:lang', l); localStorage.setItem('mt:theme', th); sessionStorage.x = 1; } }, [lang, theme]);
  await p.goto('http://localhost:8090/AmrPotli/');
  const tag = `${lang}-${theme}-${w}`;
  const overflow = async (step) => { const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (o > 0) ok(false, `${tag} ${step}: page wider than screen by ${o}px`); return o; };
  let bad = 0;
  for (const step of ['hello', 'who', 'where', 'amounts', 'spend', 'income', 'goal', 'done']) {
    await p.waitForSelector(`.ob[data-step=${step}]`);
    bad += await overflow(step);
    if (step === 'who') await p.click('[data-persona=job]');
    if (step === 'where') await p.click('[data-wallet=bkash]');
    if (step === 'amounts') { await p.fill('[data-bal=cash]', '500'); await p.screenshot({ path: `obx-${tag}-amounts.png` }); }
    if (step === 'goal') await p.click('[data-goal="0"]');
    if (step === 'hello' || step === 'spend') await p.screenshot({ path: `obx-${tag}-${step}.png` });
    if (step === 'done') { await p.screenshot({ path: `obx-${tag}-done.png` }); break; }
    if (step === 'hello') {
      await p.click('[data-start]'); bad += await overflow('choices');
      // the business screens fit too, then back to personal use
      await p.click('[data-track=business]'); bad += await overflow('business');
      await p.click('.biz-grid [data-prof-id=cyber]'); await p.click('[data-next]'); await p.click('[data-team=team]'); await p.click('[data-role=helper]');
      bad += await overflow('team');
      await p.click('[data-back]'); await p.click('[data-back]');
      await p.click('[data-track=personal]');
      continue;
    }
    await p.click('[data-next]');
  }
  ok(!bad, `${tag}: fits the screen on every step`);
  if (lang === 'bn') ok((await p.textContent('.ob-title')).includes('পোটলি তৈরি'), `${tag}: Bangla text`);
  await p.click('[data-finish=""]');
  await p.waitForSelector('.guide');
  await p.screenshot({ path: `obx-${tag}-guide.png` });
  ok(errs.length === 0, `${tag}: no errors ${errs.join('|')}`);
  await ctx.close();
}
await b.close();
