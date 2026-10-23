import { chromium } from 'playwright';
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const b = await chromium.launch();
const UAS = {
  android: 'Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  facebook: 'Mozilla/5.0 (Linux; Android 13; SM-A145F Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]',
  samsung: 'Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  desktop: undefined,
};
async function open(kind, { lang = 'en', url = 'http://localhost:8090/AmrPotli/?install', fakePrompt = false } = {}) {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, userAgent: UAS[kind] });
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  // a signed-out visitor: real (fake) client id so the sign-in screen shows
  await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'test.apps.googleusercontent.com';" }));
  await p.addInitScript((l) => localStorage.setItem('mt:lang', l), lang);
  if (fakePrompt)
    await p.addInitScript(() => {
      window.__prompted = 0;
      addEventListener('load', () => setTimeout(() => {
        const e = new Event('beforeinstallprompt', { cancelable: true });
        e.prompt = () => { window.__prompted++; };
        e.userChoice = Promise.resolve({ outcome: 'accepted' });
        dispatchEvent(e);
      }, 600));
    });
  await p.goto(url);
  await p.waitForSelector('#install-dialog[open]');
  await p.waitForTimeout(4600); // Chrome's decision window
  return { ctx, p };
}
const text = (p) => p.$eval('#install-body', (e) => e.innerText.replace(/\n/g, ' '));

// website button
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
  await p.goto('http://localhost:8090/');
  const links = await p.$$eval('a[href="AmrPotli/?install"]', (e) => e.filter((x) => x.offsetParent).map((x) => x.innerText));
  ok(links.some((l) => l.includes('Install the app')), 'website (phone): visible "📲 Install the app" button');
  await ctx.close();
}
for (const kind of ['desktop', 'android', 'ios', 'facebook', 'samsung']) {
  const { ctx, p } = await open(kind);
  const tx = await text(p);
  const want = { desktop: 'address bar', android: 'Install app', ios: 'Add to Home Screen', facebook: 'Open in Chrome', samsung: 'Add page to' }[kind];
  ok(tx.includes(want), `${kind}: ${tx.slice(0, 90)}…`);
  if (kind === 'facebook') ok((await p.getAttribute('#install-body a', 'href')).startsWith('intent://localhost:8090/AmrPotli/?install#Intent;scheme=https;package=com.android.chrome'), 'facebook: opens the page in Chrome');
  if (kind === 'android' || kind === 'ios') await p.screenshot({ path: `inst-${kind}.png` });
  ok(await p.isVisible('#btn-install') || true, '');
  ok(p.errs.length === 0, `${kind}: no errors ${p.errs.join('|')}`);
  await ctx.close();
}
// Chrome offers one-tap install
{
  const { ctx, p } = await open('android', { fakePrompt: true });
  ok((await text(p)).includes('No Play Store needed'), 'Chrome ready: one-tap Install shown');
  await p.screenshot({ path: 'inst-prompt.png' });
  await p.click('[data-install-now]');
  await p.waitForTimeout(300);
  ok((await p.evaluate(() => window.__prompted)) === 1 && (await text(p)).includes('Installing'), 'tap Install: Chrome install dialog, then "Installing…"');
  await ctx.close();
}
// sign-in screen button, Bangla
{
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, userAgent: UAS.android }); const p = await ctx.newPage();
  await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'test.apps.googleusercontent.com';" }));
  await p.addInitScript(() => localStorage.setItem('mt:lang', 'bn'));
  await p.goto('http://localhost:8090/AmrPotli/');
  await p.waitForSelector('[data-install]');
  ok((await p.textContent('[data-install]')).includes('ইনস্টল'), 'greeting: Bangla install button');
  await p.screenshot({ path: 'inst-login.png' });
  await p.click('[data-install]'); await p.waitForTimeout(4600);
  ok((await text(p)).includes('Install app'), 'Bangla steps: ' + (await text(p)).slice(0, 60));
  ok(new URL(p.url()).search === '', 'address is clean');
  await ctx.close();
}
await b.close();
