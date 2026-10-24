import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, setDoc, getDocs, collection, getDoc } from 'firebase/firestore';

const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const SHOTS = ''; // screenshots go to out/
const env = await initializeTestEnvironment({ projectId: 'demo-amrpotli', firestore: { rules: readFileSync(`${process.env.AMRPOTLI_SITE}/firebase/firestore.rules`, 'utf8'), host: '127.0.0.1', port: 8085 } });
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();

// seed what the dashboard would have published
const salt = 'test-salt';
const h = (e) => createHash('sha256').update(`${salt}:${e}`).digest('hex').slice(0, 32);
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'public/limits'), { salt, free: 24, grants: { [h('rina@gmail.com')]: { limit: 0 }, [h('sabbir@gmail.com')]: { limit: 40 }, [h('old@gmail.com')]: { limit: 0, until: '2020-01-01' } } });
  await setDoc(doc(db, 'public/notice'), {
    app: { on: true, en: 'New: receipt photos', bn: 'নতুন: রসিদের ছবি', link: 'https://vgfintrack.github.io/guides/how-to.html#receipt', id: 11 },
    site: { on: true, en: 'FinnBlu is looking for testers in Polashi', bn: 'পলাশীতে টেস্টার খুঁজছি', link: 'https://vgfintrack.github.io/contact.html#tester', id: 12 },
  });
});
const read = async (fn) => { let out; await env.withSecurityRulesDisabled(async (c) => { out = await fn(c.firestore()); }); return out; };
// All days added together: phones in Dhaka and Riyadh can be on different dates.
const stats = () =>
  read(async (db) => {
    const out = {};
    for (const d of (await getDocs(collection(db, 'stats'))).docs) for (const [k, v] of Object.entries(d.data())) out[k] = (out[k] || 0) + v;
    return out;
  });

const FAKE_GIS = `window.google = { accounts: { oauth2: {
  initTokenClient(cfg) { return { requestAccessToken() { setTimeout(() => cfg.callback({ access_token: window.__mockUser, expires_in: 3600, scope: cfg.scope }), 10); } }; },
  hasGrantedAllScopes: () => true, revoke() {} } } };`;
const b = await chromium.launch();
const drive = {};
async function device(user, { lang = 'en', tz = 'Asia/Dhaka' } = {}) {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: tz });
  await ctx.addInitScript(([u, l]) => { window.__mockUser = u; if (!sessionStorage.x) { localStorage.setItem('mt:lang', l); sessionStorage.x = 1; } }, [user, lang]);
  await ctx.route('**/AmrPotli/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'test.apps.googleusercontent.com';\nexport const firebaseProject = { projectId: 'demo-amrpotli', apiKey: 'demo' };" }));
  await ctx.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_GIS }));
  // Firestore REST -> the local emulator
  await ctx.route('https://firestore.googleapis.com/**', async (r) => {
    const req = r.request();
    const url = req.url().replace('https://firestore.googleapis.com', 'http://127.0.0.1:8085');
    const res = await fetch(url, { method: req.method(), headers: { 'Content-Type': 'application/json' }, body: req.postData() || undefined });
    r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text(), headers: { 'access-control-allow-origin': '*' } });
  });
  await ctx.route('https://www.googleapis.com/**', async (r) => {
    const req = r.request();
    const uid = (req.headers()['authorization'] || '').replace('Bearer ', '');
    const url = new URL(req.url());
    const files = (drive[uid] ||= {});
    if (url.pathname === '/oauth2/v3/userinfo') return r.fulfill({ json: { sub: uid, email: `${uid}@gmail.com`, name: uid[0].toUpperCase() + uid.slice(1) } });
    if (url.pathname === '/drive/v3/files' && req.method() === 'GET') return r.fulfill({ json: { files: Object.keys(files).map((id) => ({ id, name: 'amrpotli.json' })) } });
    let m;
    if ((m = url.pathname.match(/^\/drive\/v3\/files\/(\w+)$/))) return r.fulfill({ contentType: 'application/json', body: files[m[1]] });
    if (url.pathname === '/upload/drive/v3/files' && req.method() === 'POST') {
      const parts = req.postData().split(/--mt\w+/).filter((p) => p.includes('Content-Type'));
      const id = 'f' + Object.keys(files).length;
      files[id] = parts[1].split('\r\n\r\n').slice(1).join('\r\n\r\n').trim();
      return r.fulfill({ json: { id } });
    }
    if ((m = url.pathname.match(/^\/upload\/drive\/v3\/files\/(\w+)$/))) { files[m[1]] = req.postData(); return r.fulfill({ json: { id: m[1] } }); }
    return r.fulfill({ status: 500, body: 'unhandled' });
  });
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto('http://localhost:8090/AmrPotli/');
  await p.click('[data-start]'); await p.click('[data-signin]');
  await p.waitForSelector('#welcome-import', { state: 'attached' });
  await p.setInputFiles('#welcome-import', '../fixtures/demo-prof.json');
  await p.waitForSelector('.kpis');
  return { ctx, p };
}
const setupCounter = (p) => p.textContent('#view-setup .cat-count');

// ---------------------------------------------------------------- Rina: unlimited
const R = await device('rina');
let p = R.p;
await p.waitForSelector('#notice-bar:not([hidden])', { timeout: 6000 });
ok((await p.textContent('#notice-bar')).includes('New: receipt photos'), 'the team notice shows under the top bar');
await p.screenshot({ path: SHOTS + 'company-notice.png' });
await p.waitForTimeout(800);
let st = await stats();
ok(st.active === 1 && st.new === 1 && st.en === 1 && st.drive === 1 && st.personal === 1, 'one anonymous count for today: ' + JSON.stringify(st));
ok(!JSON.stringify(st).includes('rina'), 'the count has nothing about who she is');
const prof = { n: await read(async (db) => (await getDocs(collection(db, 'profs'))).docs.filter((d) => d.id.endsWith('~pharmacy')).reduce((t, d) => t + d.data().n, 0)) };
ok(prof.n === 1, 'and +1 for her kind of work (pharmacy): ' + JSON.stringify(prof));
await p.click('.tabbar button[data-view=setup]');
ok((await setupCounter(p)).includes('no limit for you'), 'Rina (on the list, unlimited): ' + (await setupCounter(p)));
// closing the notice keeps it closed
await p.click('#notice-bar button');
await p.reload(); await p.waitForSelector('.kpis'); await p.waitForTimeout(2500);
ok(await p.isHidden('#notice-bar'), 'a closed notice stays closed');
st = await stats();
ok(st.active === 1, 'opening again the same day sends nothing more');
// feedback
await p.click('.tabbar button[data-view=setup]');
await p.click('[data-feedback="setup"]');
await p.click('#fb-kind [data-kind="problem"]');
await p.fill('#fb-text', 'SMS from Dutch-Bangla Bank is not read');
await p.fill('#fb-contact', '01711111111');
await p.screenshot({ path: SHOTS + 'company-feedback.png' });
await p.click('#fb-send');
await p.waitForFunction(() => !document.querySelector('#fb-dialog').open);
const fbs = await read(async (db) => (await getDocs(collection(db, 'feedback'))).docs.map((d) => d.data()));
ok(fbs.some((f) => f.kind === 'problem' && f.text.includes('Dutch-Bangla') && f.contact === '01711111111' && f.from === 'setup' && f.at), 'feedback arrives in the team inbox');
// stay in touch
await p.click('#stay-in-touch');
ok((await p.inputValue('#optin-email')) === 'rina@gmail.com' && (await p.inputValue('#optin-name')) === 'Rina', 'stay in touch: name and email filled from Google');
await p.selectOption('#optin-why', 'tester');
await p.fill('#optin-code', 'polashi-50');
await p.click('#optin-send');
await p.waitForFunction(() => !document.querySelector('#optin-dialog').open);
const opts = await read(async (db) => (await getDocs(collection(db, 'optins'))).docs.map((d) => d.data()));
ok(opts.some((o) => o.email === 'rina@gmail.com' && o.why === 'tester' && o.code === 'POLASHI50' && o.mode === 'personal'), 'contact arrives, promo code cleaned');
// counts off
await p.uncheck('#counts-on');
await p.evaluate(() => localStorage.removeItem('mt:counted'));
await p.reload(); await p.waitForSelector('.kpis'); await p.waitForTimeout(2500);
ok((await stats()).active === 1, 'with "Help improve" off, nothing is counted');
ok(R.p.errs.length === 0, 'no errors ' + R.p.errs.join('|'));
await R.ctx.close();

// ---------------------------------------------------------------- Sabbir: 40; a stranger: 24; an ended grant: 24
for (const [user, want] of [['sabbir', '40 categories used'], ['random', 'of 24 categories used'], ['old', 'of 24 categories used']]) {
  // Sabbir works in Riyadh: his phone's time zone says Saudi Arabia.
  const D = await device(user, { lang: user === 'sabbir' ? 'bn' : 'en', tz: user === 'sabbir' ? 'Asia/Riyadh' : 'Asia/Dhaka' });
  await D.p.waitForTimeout(2500);
  await D.p.click('.tabbar button[data-view=setup]');
  const txt = await setupCounter(D.p);
  ok(user === 'sabbir' ? /৪০|40/.test(txt) : txt.includes(want), `${user}: ${txt}`);
  if (user === 'sabbir') ok((await D.p.textContent('#notice-bar')).includes('রসিদের ছবি'), 'notice in Bangla for Bangla users');
  await D.ctx.close();
}
st = await stats();
ok(st.active === 4 && st.bn === 1, 'four phones counted today: ' + JSON.stringify(st));
// weekly and monthly users, country and district (summed over ids, whatever today's date is)
const sum = async (col, test) => read(async (db) => (await getDocs(collection(db, col))).docs.filter((d) => test(d.id)).reduce((t, d) => t + (d.data().n || 0), 0));
ok((await sum('actives', (id) => id.startsWith('w-'))) === 4 && (await sum('actives', (id) => id.startsWith('m-'))) === 4, 'weekly and monthly users: 4 phones each');
ok((await sum('where', (id) => id.endsWith('~c-bd'))) === 3 && (await sum('where', (id) => id.endsWith('~c-sa'))) === 1, 'countries from the time zone: 3 Bangladesh, 1 Saudi Arabia');
ok((await sum('where', (id) => id.endsWith('~d-sylhet'))) === 4, 'district only because they chose Sylhet');
const ids = await read(async (db) => [...(await getDocs(collection(db, 'where'))).docs, ...(await getDocs(collection(db, 'actives'))).docs].map((d) => JSON.stringify(d.data()) + d.id).join(' '));
ok(!/rina|sabbir|random|old@|gmail/i.test(ids), 'nothing about who they are');

// ---------------------------------------------------------------- website: notice and contact forms
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route('**/AmrPotli/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'x';\nexport const firebaseProject = { projectId: 'demo-amrpotli', apiKey: 'demo' };" }));
await ctx.route('https://firestore.googleapis.com/**', async (r) => {
  const req = r.request();
  const res = await fetch(req.url().replace('https://firestore.googleapis.com', 'http://127.0.0.1:8085'), { method: req.method(), headers: { 'Content-Type': 'application/json' }, body: req.postData() || undefined });
  r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text(), headers: { 'access-control-allow-origin': '*' } });
});
const w = await ctx.newPage();
const werrs = []; w.on('pageerror', (e) => werrs.push(e.message));
await w.goto('http://localhost:8090/contact.html');
await w.waitForSelector('.site-notice', { timeout: 6000 });
ok((await w.textContent('.site-notice')).includes('looking for testers'), 'website notice shows on top');
await w.fill('#site-feedback textarea', 'Please add a Hindi option');
await w.click('#site-feedback button[type=submit]');
await w.waitForSelector('#site-feedback .form-msg.good');
await w.fill('#site-optin [name=name]', 'Sadat Rahman');
await w.fill('#site-optin [name=email]', 'sadat@gmail.com');
await w.fill('#site-optin [name=code]', 'polashi50');
await w.click('#site-optin button[type=submit]');
await w.waitForSelector('#site-optin .form-msg.good');
await w.screenshot({ path: SHOTS + 'company-contact.png', fullPage: true });
const fb2 = await read(async (db) => (await getDocs(collection(db, 'feedback'))).docs.map((d) => d.data()));
const op2 = await read(async (db) => (await getDocs(collection(db, 'optins'))).docs.map((d) => d.data()));
ok(fb2.some((f) => f.from === 'website' && f.text.includes('Hindi')) && op2.some((o) => o.email === 'sadat@gmail.com' && o.code === 'POLASHI50' && o.app === 'website'), 'website feedback and tester sign-up arrive');
ok(werrs.length === 0, 'no website errors ' + werrs.join('|'));
await b.close();
await env.cleanup();
