import { chromium } from 'playwright';
const BASE = 'http://localhost:8090/FinnBlu/';
const drive = {}; // uid -> { id -> content }
let nextId = 1;
const log = (...a) => console.log(...a);
const assert = (c, m) => { if (!c) { console.log('❌ FAIL:', m); process.exitCode = 1; } else console.log('✅', m); };

const FAKE_GIS = `window.google = { accounts: { oauth2: {
  initTokenClient(cfg) { return { requestAccessToken() {
    setTimeout(() => cfg.callback({ access_token: window.__mockUser, expires_in: 3600, scope: cfg.scope }), 10); } }; },
  hasGrantedAllScopes: () => true, revoke() {} } } };`;

async function device(browser, user) {
  const ctx = await browser.newContext({ serviceWorkers: 'block',  viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((u) => (window.__mockUser = u), user);
  await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'test.apps.googleusercontent.com';" }));
  await ctx.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_GIS }));
  await ctx.route('https://www.googleapis.com/**', async (r) => {
    const req = r.request();
    const uid = (req.headers()['authorization'] || '').replace('Bearer ', '');
    const url = new URL(req.url());
    const files = (drive[uid] ||= {});
    if (url.pathname === '/oauth2/v3/userinfo') return r.fulfill({ json: { sub: uid, email: `${uid}@gmail.com`, name: uid } });
    if (url.pathname === '/drive/v3/files' && req.method() === 'GET') {
      if (url.searchParams.get('spaces') !== 'appDataFolder') return r.fulfill({ status: 400, body: 'wrong space' });
      return r.fulfill({ json: { files: Object.keys(files).map((id) => ({ id })) } });
    }
    let m;
    if ((m = url.pathname.match(/^\/drive\/v3\/files\/(\w+)$/)) && url.searchParams.get('alt') === 'media') {
      if (!(m[1] in files)) return r.fulfill({ status: 404, body: 'not found' });
      return r.fulfill({ contentType: 'application/json', body: files[m[1]] });
    }
    if (url.pathname === '/upload/drive/v3/files' && req.method() === 'POST') {
      const body = req.postData();
      const parts = body.split(/--mt\w+/).filter((p) => p.includes('Content-Type'));
      const meta = JSON.parse(parts[0].split('\r\n\r\n')[1]);
      if (!meta.parents?.includes('appDataFolder')) return r.fulfill({ status: 400, body: 'not appdata' });
      const id = 'f' + nextId++;
      files[id] = parts[1].split('\r\n\r\n').slice(1).join('\r\n\r\n').trim();
      return r.fulfill({ json: { id } });
    }
    if ((m = url.pathname.match(/^\/upload\/drive\/v3\/files\/(\w+)$/)) && req.method() === 'PATCH') {
      files[m[1]] = req.postData();
      return r.fulfill({ json: { id: m[1] } });
    }
    log('UNHANDLED', req.method(), req.url());
    return r.fulfill({ status: 500, body: 'unhandled' });
  });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  page.on('dialog', (d) => d.accept());

  return { ctx, page };
}

const kpi = (p) => p.$$eval('.kpi .v', (els) => els.map((e) => e.textContent));
const syncText = (p) => p.$eval('#sync', (e) => (e.hidden ? '(hidden)' : e.textContent));
const waitSynced = (p) => p.waitForFunction(() => document.querySelector('#sync')?.textContent.includes('Saved to Drive'), null, { timeout: 8000 });
const remoteDoc = (uid) => JSON.parse(Object.values(drive[uid] || {})[0] || 'null');
const ok = assert;
const browser = await chromium.launch();
const vis = (p, sel) => p.isVisible(sel);
const opts = (p) => p.$$eval('.ob-option strong', (e) => e.map((x) => x.textContent));

// 1. a new person: greeting, Tap to start, three choices, no login screen
const A = await device(browser, 'rina');
const p = A.page;
await p.goto(BASE);
await p.waitForSelector('[data-start]');
ok(!(await vis(p, '#login')) && !(await vis(p, '.tabbar')), 'opens on the greeting, not the login screen');
await p.click('[data-start]');
ok((await opts(p)).join('|') === 'For personal use|For business|I already use FinnBlu', 'three choices: ' + (await opts(p)).join('|'));
// personal → professions as before
await p.click('[data-track=personal]');
ok(await p.isVisible('[data-persona=job]') && !(await p.$('.biz-grid')), 'personal: professions');
await p.click('[data-persona=job]'); await p.click('[data-next]');
ok((await p.getAttribute('.ob', 'data-step')) === 'where', 'no solo/team question for personal use');
await p.click('[data-next]'); await p.fill('[data-bal=cash]', '1200'); await p.click('[data-next]');
await p.click('[data-next]'); await p.click('[data-next]'); await p.click('[data-goal="0"]'); await p.click('[data-next]');
await p.waitForSelector('[data-signin]');
ok(!(await p.$('[data-finish]')) && (await p.textContent('.ob-body')).includes('Sign in with Google to save it'), 'end of setup: must sign in, no way into the app');
ok(!drive.rina, 'nothing in Drive yet');
await p.reload();
await p.waitForSelector('[data-signin]');
ok((await p.textContent('.ob-summary')).includes('1,200') && !(await vis(p, '.kpis')), 'after a reload: still the sign-in screen, with the setup kept');
await p.click('[data-signin]');
await p.waitForSelector('.kpis');
await waitSynced(p);
const rd = remoteDoc('rina');
ok(rd?.settings?.profession?.id === 'job' && Object.values(rd.accounts).some((a) => a.opening === 1200), 'signed in: setup saved to her Drive');
ok(await p.evaluate(() => !localStorage.getItem('mt:data:local') && !localStorage.getItem('mt:onb:local')), 'nothing left in the not-signed-in copy');
ok(A.page.errors.length === 0, 'no errors ' + A.page.errors.join('|'));

// 2. business, team: owner / helper
const B = await device(browser, 'karim');
const q = B.page;
await q.goto(BASE);
await q.click('[data-start]'); await q.click('[data-track=business]');
const biz = await q.$$eval('.biz-grid .ob-option strong', (e) => e.map((x) => x.textContent));
ok(biz.includes('Pharmacy') && biz.includes('Computer & photocopy shop') && biz.includes('Grocery shop') && !biz.includes('Business owner') && biz.length >= 15, `business: all businesses (${biz.length})`);
await q.fill('#prof-input', 'photocopy');
ok((await q.$$eval('#prof-results [data-prof-id]', (e) => e.map((x) => x.dataset.profId))).every((id) => id !== 'student'), 'search lists businesses');
await q.click('.biz-grid [data-prof-id=pharmacy]'); await q.click('[data-next]');
ok((await q.getAttribute('.ob', 'data-step')) === 'team', 'then: solo or team');
ok((await opts(q)).join('|') === 'Just me (solo)|A team', 'solo / team');
await q.click('[data-team=team]');
ok((await opts(q)).includes('Owner') && (await opts(q)).includes('Employee or helper'), 'team: owner or helper');
await q.click('[data-role=helper]');
ok((await q.isVisible('.ob-note')) && (await q.isDisabled('[data-next]')), 'helper: explained, opens the shop book instead of Continue');
await q.click('[data-role=owner]'); await q.click('[data-next]');
await q.click('[data-next]'); await q.click('[data-next]'); await q.click('[data-next]'); await q.click('[data-next]'); await q.click('[data-goal="0"]'); await q.click('[data-next]');
await q.click('[data-signin]');
await q.waitForSelector('[data-finish]');
ok((await q.textContent('.ob-body')).includes('Add your helpers in Setup'), 'owner: told where to add helpers');
await q.click('[data-finish=""]'); await q.waitForSelector('.kpis'); await waitSynced(q);
const kd = remoteDoc('karim');
ok(kd.settings.mode === 'shop' && kd.settings.profession.business === 'pharmacy' && kd.settings.team?.role === 'owner', 'saved: pharmacy shop, team owner');

// 3. "I already use FinnBlu": straight into an existing account
const C = await device(browser, 'rina');
await C.page.goto(BASE);
await C.page.click('[data-start]'); await C.page.click('[data-signin]');
await C.page.waitForSelector('.kpis');
ok(true, 'returning user: signs in and lands on the dashboard');

// 4. setup on a phone, then signing in to an account that already has data
const D = await device(browser, 'rina');
const r = D.page;
await r.goto(BASE);
await r.click('[data-start]'); await r.click('[data-track=personal]'); await r.click('[data-persona=student]'); await r.click('[data-next]');
await r.click('[data-next]'); await r.click('[data-next]'); await r.click('[data-next]'); await r.click('[data-next]'); await r.click('[data-goal="0"]'); await r.click('[data-next]');
await r.click('[data-signin]'); await r.waitForSelector('[data-finish]'); await r.click('[data-finish=""]'); await r.waitForSelector('.kpis'); await waitSynced(r);
ok(remoteDoc('rina').settings.profession.id === 'job', 'existing account kept as it was (the new setup is not mixed in)');

// 5. Start over
const E = await device(browser, 'nila');
const e = E.page;
await e.goto(BASE);
await e.click('[data-start]'); await e.click('[data-track=personal]'); await e.click('[data-persona=home]'); await e.click('[data-next]');
await e.click('[data-next]'); await e.click('[data-next]'); await e.click('[data-next]'); await e.click('[data-next]'); await e.click('[data-goal="0"]'); await e.click('[data-next]');
await e.click('[data-restart]');
await e.waitForSelector('[data-start]');
ok(await e.evaluate(() => !localStorage.getItem('mt:data:local')), 'Start over: back to the greeting, setup removed');
ok([B, C, D, E].every((x) => x.page.errors.length === 0), 'no errors ' + [B, C, D, E].flatMap((x) => x.page.errors).join('|'));
await browser.close();
