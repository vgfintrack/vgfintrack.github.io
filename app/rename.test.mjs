// AmrPotli became FinnBlu: the new name, logo and colours, and a one-time note
// for people who used the app before. The web address stays /AmrPotli/.
import { chromium } from 'playwright';
import fs from 'node:fs';
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const BASE = 'http://localhost:8090/AmrPotli/';
const SITE = process.env.AMRPOTLI_SITE;
const b = await chromium.launch();

// 1. the installed app's name, colours and icons
const manifest = JSON.parse(fs.readFileSync(`${SITE}/AmrPotli/manifest.json`, 'utf8'));
ok(manifest.name === 'FinnBlu' && manifest.short_name === 'FinnBlu', 'home-screen name is FinnBlu');
ok(manifest.theme_color === '#0E2B49' && manifest.id === './' && manifest.start_url === './', 'navy theme colour; same app id and address');
ok(manifest.icons.every((i) => fs.existsSync(`${SITE}/AmrPotli/${i.src}`)), 'every manifest icon exists');
const sw = fs.readFileSync(`${SITE}/AmrPotli/sw.js`, 'utf8');
ok(['icons/lockup.svg', 'icons/lockup-dark.svg', 'icons/symbol.svg', 'icons/symbol-dark.svg'].every((f) => sw.includes(`'${f}'`)), 'logos are saved for offline use');

async function phone({ lang = 'en', dark = false } = {}) {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, colorScheme: dark ? 'dark' : 'light' });
  await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'REPLACE_ME';" }));
  await ctx.addInitScript((l) => { if (!sessionStorage.x) { localStorage.setItem('mt:lang', l); localStorage.setItem('mt:district-later', String(Date.now() + 9e10)); sessionStorage.x = 1; } }, lang);
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  await p.goto(BASE);
  return { ctx, p };
}
const oldName = /AmrPotli|আমার পোটলি|Potli|পোটলি/;

// 2. someone with entries from before the new name sees the note once
for (const lang of ['en', 'bn']) {
  const { ctx, p } = await phone({ lang });
  ok((await p.title()) === 'FinnBlu', `${lang}: page title`);
  await p.waitForSelector('[data-start], [data-track], #welcome-import', { state: 'attached' });
  if (await p.$('[data-start]')) await p.click('[data-start]');
  await p.setInputFiles('#welcome-import', '../fixtures/demo.json');
  await p.waitForSelector('.kpis');
  const note = await p.textContent('.renamed-card').catch(() => '');
  ok(lang === 'en' ? note.includes('AmrPotli is now FinnBlu') && note.includes('Same app, same data') : note.includes('AmrPotli এখন FinnBlu') && note.includes('একই হিসাব'), `${lang}: old user is told about the new name`);
  ok(!(await p.$('.clip-card')), `${lang}: the note is not an SMS offer`);
  const rest = await p.evaluate(() => { const c = document.querySelector('.renamed-card'); const t = document.body.innerText; return c ? t.replace(c.innerText, '') : t; });
  ok(!oldName.test(rest), `${lang}: no old name anywhere else on the Dashboard`);
  ok((await p.getAttribute('.topbar .brand img', 'alt')) === 'FinnBlu' && (await p.getAttribute('.topbar .brand img', 'src')).endsWith('lockup.svg'), `${lang}: FinnBlu logo in the top bar`);
  await p.click('[data-renamed-ok]');
  ok(!(await p.$('.renamed-card')), `${lang}: OK hides it`);
  await p.reload(); await p.waitForSelector('.kpis');
  ok(!(await p.$('.renamed-card')), `${lang}: and it stays hidden`);
  ok(!p.errs.length, `${lang}: no errors ` + p.errs.join('|'));
  await ctx.close();
}

// 3. a new user never sees it; the start screens use the new name
{
  const { ctx, p } = await phone();
  await p.waitForSelector('[data-start]');
  ok(!oldName.test(await p.evaluate(() => document.body.innerText)), 'greeting: no old name');
  await p.click('[data-start]');
  ok(!oldName.test(await p.evaluate(() => document.body.innerText)), 'start choices: no old name');
  await p.click('[data-track=personal]'); await p.click('[data-persona=job]'); await p.click('[data-next]');
  for (let i = 0; i < 4; i++) await p.click('[data-next]');
  await p.click('[data-goal="0"]'); await p.click('[data-next]');
  ok((await p.textContent('.ob-title')).includes('FinnBlu is ready'), 'last step: “FinnBlu is ready”');
  await p.click('[data-finish=""]'); await p.waitForSelector('.kpis');
  ok(!(await p.$('.renamed-card')), 'a new user is not told about the old name');
  await ctx.close();
}

// 4. night: the reversed logo
{
  const { ctx, p } = await phone({ dark: true });
  await p.waitForSelector('.topbar .brand img', { state: 'attached' });
  const content = await p.evaluate(() => getComputedStyle(document.querySelector('.topbar .brand img')).content);
  ok(content.includes('lockup-dark.svg'), 'night: reversed logo ' + content.slice(0, 80));
  await p.evaluate(() => { localStorage.setItem('mt:theme', 'light'); document.documentElement.dataset.theme = 'light'; });
  ok(!(await p.evaluate(() => getComputedStyle(document.querySelector('.topbar .brand img')).content)).includes('lockup-dark'), 'Day chosen on a dark phone: primary logo');
  await ctx.close();
}

await b.close();
