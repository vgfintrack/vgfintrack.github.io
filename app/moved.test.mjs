// The app moved from /AmrPotli/ to /FinnBlu/. The old address forwards links,
// bookmarks and shared SMS; the old installed app is asked to install the new
// one; the old service worker clears its saved copy and removes itself.
import { chromium } from 'playwright';
import fs from 'node:fs';
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const HOST = 'http://localhost:8090';
const SITE = process.env.AMRPOTLI_SITE;
const b = await chromium.launch();

// the old installed app keeps its identity, with the new name and icons
const old = JSON.parse(fs.readFileSync(`${SITE}/AmrPotli/manifest.json`, 'utf8'));
ok(old.id === './' && old.start_url === './' && old.name === 'FinnBlu' && old.share_target?.action === './?share', 'old manifest: same app id, new name, Share still works');
ok(old.icons.every((i) => fs.existsSync(`${SITE}/AmrPotli/${i.src}`)), 'old manifest icons point at the new ones');
const neu = JSON.parse(fs.readFileSync(`${SITE}/FinnBlu/manifest.json`, 'utf8'));
ok(neu.name === 'FinnBlu' && neu.start_url === './' && neu.share_target?.action === './?share', 'new manifest at /FinnBlu/');
ok(/const CACHE = 'finnblu-app-v\d+'/.test(fs.readFileSync(`${SITE}/FinnBlu/sw.js`, 'utf8')), 'new saved copy has its own name, so the old worker cannot remove it');

async function phone({ installed = false, lang = 'en', sw = 'block' } = {}) {
  const ctx = await b.newContext({ serviceWorkers: sw, viewport: { width: 390, height: 844 } });
  await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'REPLACE_ME';" }));
  await ctx.addInitScript(([inst, l]) => {
    if (!sessionStorage.x) { localStorage.setItem('mt:lang', l); localStorage.setItem('mt:district-later', String(Date.now() + 9e10)); sessionStorage.x = 1; }
    if (inst) { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (q.includes('display-mode: standalone') ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q)); }
  }, [installed, lang]);
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  return { ctx, p };
}

// 1. links and bookmarks
{
  const { ctx, p } = await phone();
  await p.goto(`${HOST}/AmrPotli/`); await p.waitForURL('**/FinnBlu/'); await p.waitForSelector('[data-start]');
  ok(new URL(p.url()).pathname === '/FinnBlu/', 'old address opens the app at /FinnBlu/');
  await p.goto(`${HOST}/AmrPotli/?install`);
  await p.waitForSelector('#install-dialog[open]', { timeout: 8000 }).catch(() => {});
  ok(new URL(p.url()).pathname === '/FinnBlu/' && !!(await p.$('#install-dialog[open]')), '?install is kept: install help opens');
  await p.goto(`${HOST}/AmrPotli/privacy.html`); await p.waitForURL('**/FinnBlu/privacy.html');
  ok((await p.textContent('h1')).includes('Privacy'), 'old privacy link → /FinnBlu/privacy.html');
  await p.goto(`${HOST}/AmrPotli/terms.html#bn`); await p.waitForURL('**/FinnBlu/terms.html#bn');
  ok(p.url().endsWith('/FinnBlu/terms.html#bn'), 'old terms link keeps its #part');
  await p.goto(`${HOST}/finnblu/`); await p.waitForURL('**/FinnBlu/');
  ok(new URL(p.url()).pathname === '/FinnBlu/', 'lower-case /finnblu/ works too');
  await ctx.close();
}

// 2. an SMS shared to the old installed app still arrives, with no stop on the way
{
  const { ctx, p } = await phone({ installed: true });
  const sms = 'You have received Tk 1,500.00 from 01711111111. Fee Tk 0.00. Balance Tk 3,500.00. TrxID 9KQ2LM7XZ1 at 23/10/2026 10:00';
  await p.goto(`${HOST}/AmrPotli/?share=&title=&text=${encodeURIComponent(sms)}`);
  await p.waitForURL((u) => u.pathname === '/FinnBlu/'); await p.waitForSelector('[data-start]');
  ok((await p.evaluate(() => sessionStorage.getItem('mt:shared-sms'))) === sms, 'shared SMS reaches FinnBlu and waits for setup');
  await ctx.close();
}

// 3. the old installed app, opened from its icon
for (const lang of ['en', 'bn']) {
  const { ctx, p } = await phone({ installed: true, lang });
  await p.goto(`${HOST}/AmrPotli/`); await p.waitForTimeout(400);
  ok(new URL(p.url()).pathname === '/AmrPotli/' && (await p.isVisible('main')), `${lang}: installed old app stops to explain`);
  const txt = await p.textContent('main');
  ok(lang === 'en' ? (await p.isVisible('text=FinnBlu has a new home')) && txt.includes('Google Drive') : await p.isVisible('text=FinnBlu-র নতুন ঠিকানা'), `${lang}: “new home” message`);
  ok((await p.getAttribute('a.go', 'href')) === '../FinnBlu/?install', `${lang}: the button opens FinnBlu with install help`);
  if (lang === 'en') {
    await p.click('#later'); await p.waitForURL('**/FinnBlu/');
    await p.goto(`${HOST}/AmrPotli/`); await p.waitForURL('**/FinnBlu/');
    ok(true, 'Later: goes on, and skips the message for a week');
  }
  await ctx.close();
}

// 4. the old service worker removes itself and the old saved copy
{
  const { ctx, p } = await phone({ installed: true, sw: 'allow' });
  await p.goto(`${HOST}/AmrPotli/`); await p.waitForSelector('main');
  await p.evaluate(async () => { const c = await caches.open('amrpotli-app-v32'); await c.put('/AmrPotli/index.html', new Response('old app')); await caches.open('finnblu-app-v1'); });
  await p.evaluate(() => navigator.serviceWorker.register('sw.js')).catch(() => {});
  await p.waitForTimeout(2500); await p.waitForLoadState();
  const left = await p.evaluate(async () => ({ keys: await caches.keys(), regs: (await navigator.serviceWorker.getRegistrations()).length }));
  ok(!left.keys.includes('amrpotli-app-v32') && left.keys.includes('finnblu-app-v1') && left.regs === 0, 'old worker: old copy gone, new one kept, unregistered ' + JSON.stringify(left));
  await ctx.close();
}

await b.close();
