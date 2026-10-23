import { chromium } from 'playwright';
const BASE = 'http://localhost:8090/';
const pages = ['', 'features.html', 'faq.html', 'about.html', 'guides/', 'guides/start.html', 'guides/student.html', 'guides/job.html', 'guides/freelancer.html', 'guides/home.html', 'guides/shop.html', 'guides/business.html', 'guides/how-to.html', 'nope/missing.html'];
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const b = await chromium.launch();
const links = new Set();
for (const lang of ['en', 'bn']) for (const w of [390, 1280]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  await ctx.addInitScript((l) => localStorage.setItem('mt:lang', l), lang);
  for (const path of pages) {
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('response', (r) => r.status() >= 400 && !r.url().endsWith('missing.html') && errs.push(r.status() + ' ' + r.url()));
    await p.goto(BASE + path, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => (i.loading = 'eager')));
    await p.waitForTimeout(300);
    const r = await p.evaluate((lang) => {
      const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      const imgs = [...document.images].filter(vis);
      const brokenImgs = imgs.filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src);
      const other = lang === 'en' ? 'bn' : 'en';
      const leaks = [...document.querySelectorAll(`[lang="${other}"]`)].filter((e) => e !== document.documentElement && vis(e)).length;
      const hrefs = [...document.querySelectorAll('a[href]')].map((a) => a.href);
      return { sw: document.documentElement.scrollWidth, imgs: imgs.length, brokenImgs, leaks, hrefs, title: document.title, h1: document.querySelector('h1')?.innerText };
    }, lang);
    r.hrefs.filter((h) => h.startsWith(BASE)).forEach((h) => links.add(h.split('#')[0] + (h.includes('#') ? '#' + h.split('#')[1] : '')));
    const bad = r.sw > w || r.brokenImgs.length || r.leaks || errs.length;
    if (bad || w === 390) ok(!bad, `${lang} ${w} /${path} "${r.h1?.slice(0, 40)}" imgs ${r.imgs}${r.sw > w ? ' SIDEWAYS ' + r.sw : ''}${r.brokenImgs.length ? ' BROKEN ' + r.brokenImgs : ''}${r.leaks ? ' LEAKS ' + r.leaks : ''}${errs.length ? ' ERR ' + errs.join(' | ') : ''}`);
    await p.close();
  }
  await ctx.close();
}
// every internal link and #anchor resolves
const p = await b.newPage();
let badLinks = 0;
for (const href of links) {
  const [url, hash] = href.split('#');
  if (url.includes('/AmrPotli/') && !url.endsWith('.html')) continue; // the app itself
  const res = await p.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => null);
  if (!res || res.status() >= 400) { badLinks++; console.log('❌ link', href, res?.status()); continue; }
  if (hash && !(await p.$('#' + hash))) { badLinks++; console.log('❌ anchor', href); }
}
ok(badLinks === 0, `${links.size} internal links and anchors checked`);
await b.close();
