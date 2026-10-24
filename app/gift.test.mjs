import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const salt = 's1';
const h = (e) => createHash('sha256').update(`${salt}:${e}`).digest('hex').slice(0, 32);
let grants = {};
const S = (v) => ({ stringValue: v });
const val = (v) => (typeof v === 'number' ? { integerValue: String(v) } : S(v));
const limitsDoc = () => ({ documents: [{ name: 'projects/p/databases/(default)/documents/public/limits', fields: { salt: S(salt), grants: { mapValue: { fields: Object.fromEntries(Object.entries(grants).map(([e, g]) => [h(e), { mapValue: { fields: Object.fromEntries(Object.entries(g).map(([k, v]) => [k, val(v)])) } }])) } } } }] });
const FAKE_GIS = `window.google = { accounts: { oauth2: { initTokenClient(cfg) { return { requestAccessToken() { setTimeout(() => cfg.callback({ access_token: window.__mockUser, expires_in: 3600, scope: cfg.scope }), 10); } }; }, hasGrantedAllScopes: () => true, revoke() {} } } };`;
const drive = {};
const b = await chromium.launch();
const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { window.__mockUser = 'nusrat.test'; if (!sessionStorage.x) { localStorage.setItem('mt:lang', 'en'); sessionStorage.x = 1; } });
await ctx.route('**/AmrPotli/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'test.apps.googleusercontent.com';\nexport const firebaseProject = { projectId: 'p', apiKey: 'k' };" }));
await ctx.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_GIS }));
await ctx.route('https://firestore.googleapis.com/**', (r) => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(r.request().method() === 'GET' ? limitsDoc() : {}) }));
await ctx.route('https://www.googleapis.com/**', async (r) => {
  const req = r.request(); const url = new URL(req.url()); const uid = (req.headers()['authorization'] || '').replace('Bearer ', ''); const files = (drive[uid] ||= {});
  if (url.pathname === '/oauth2/v3/userinfo') return r.fulfill({ json: { sub: uid, email: `${uid}@gmail.com`, name: 'Omayer' } });
  if (url.pathname === '/drive/v3/files' && req.method() === 'GET') return r.fulfill({ json: { files: Object.keys(files).map((id) => ({ id })) } });
  let m;
  if ((m = url.pathname.match(/^\/drive\/v3\/files\/(\w+)$/))) return r.fulfill({ contentType: 'application/json', body: files[m[1]] });
  if (url.pathname === '/upload/drive/v3/files') { const parts = req.postData().split(/--mt\w+/).filter((p) => p.includes('Content-Type')); files.f1 = parts[1].split('\r\n\r\n').slice(1).join('\r\n\r\n').trim(); return r.fulfill({ json: { id: 'f1' } }); }
  if ((m = url.pathname.match(/^\/upload\/drive\/v3\/files\/(\w+)$/))) { files[m[1]] = req.postData(); return r.fulfill({ json: { id: m[1] } }); }
  r.fulfill({ status: 500, body: '' });
});
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const reopen = async () => { await p.reload(); await p.waitForSelector('.kpis'); await p.waitForTimeout(2500); };
// not on the list: nothing shown
await p.goto('http://localhost:8090/AmrPotli/');
await p.waitForSelector('[data-start]'); await p.click('[data-start]'); await p.click('[data-signin]');
await p.waitForSelector('[data-start], [data-track], #welcome-import', { state: 'attached' });
await p.waitForSelector('[data-start], [data-track], #welcome-import', { state: 'attached' }); if (await p.$('[data-start]')) await p.click('[data-start]'); await p.setInputFiles('#welcome-import', '../fixtures/demo.json');
await p.waitForSelector('.kpis'); await p.waitForTimeout(2500);
ok(await p.isHidden('#gift-bar'), 'not on the list: no message');
// owner gives 50
grants = { 'nusrat.test@gmail.com': { limit: 50 } };
await reopen();
ok((await p.textContent('#gift-bar')).includes('Good news! The FinnBlu team gave you 50 categories.'), 'given 50: ' + (await p.textContent('#gift-bar')));
await p.screenshot({ path: 'gift-50.png' });
await p.click('#gift-bar button');
ok(await p.isHidden('#gift-bar'), 'OK closes it');
await p.click('.tabbar button[data-view=setup]');
ok(/of 50 categories used · 🎁 from the FinnBlu team/.test(await p.textContent('.cat-count')), 'Setup: ' + (await p.textContent('.cat-count')));
await reopen();
ok(await p.isHidden('#gift-bar'), 'shown once, not on every open');
// raised to unlimited with an end date
grants = { 'nusrat.test@gmail.com': { limit: 0, until: '2027-03-31' } };
await reopen();
ok((await p.textContent('#gift-bar')).includes('unlimited categories. Until 31 Mar 2027.'), 'raised: ' + (await p.textContent('#gift-bar')));
// taken back
grants = {};
await reopen();
ok((await p.textContent('#gift-bar')).includes('Your extra categories have ended'), 'ended: ' + (await p.textContent('#gift-bar')));
// Bangla
await p.evaluate(() => localStorage.setItem('mt:lang', 'bn'));
grants = { 'nusrat.test@gmail.com': { limit: 40 } };
await reopen();
ok((await p.textContent('#gift-bar')).includes('সুখবর! FinnBlu টিম আপনাকে 40টি ক্যাটাগরি দিয়েছে।'), 'Bangla: ' + (await p.textContent('#gift-bar')));
ok(errs.length === 0, 'no errors ' + errs.join('|'));
await b.close();
