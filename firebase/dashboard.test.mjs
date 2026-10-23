import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const BASE = 'http://localhost:8090/team/';
const SDK = new URL('../node_modules/firebase/', import.meta.url).pathname;
const FS = 'http://127.0.0.1:8085/v1/projects/demo-amrpotli/databases/(default)/documents';
const SHOTS = ''; // screenshots go to out/

// Wrappers around the real SDK: same exports, but connected to the emulators,
// and window.__login(email) signs in as anyone (the emulator accepts it).
const REAL = 'https://www.gstatic.com/firebasejs/11.10.0/__real/';
const EMULATED = {
  'firebase-firestore.js': `export * from '${REAL}firebase-firestore.js';
    import { getFirestore as get, connectFirestoreEmulator } from '${REAL}firebase-firestore.js';
    export function getFirestore(...a) { const db = get(...a); if (!db.__emu) { connectFirestoreEmulator(db, '127.0.0.1', 8085); db.__emu = 1; } return db; }`,
  'firebase-auth.js': `export * from '${REAL}firebase-auth.js';
    import { getAuth as get, connectAuthEmulator, signInWithCredential, GoogleAuthProvider } from '${REAL}firebase-auth.js';
    export function getAuth(...a) {
      const auth = get(...a);
      if (!auth.__emu) {
        connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
        auth.__emu = 1;
        window.__login = (email, name = email.split('@')[0]) =>
          signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true, name })));
      }
      return auth;
    }`,
};
const b = await chromium.launch();
async function open(email, { width = 1280, scheme = 'light' } = {}) {
  const ctx = await b.newContext({ viewport: { width, height: 900 }, colorScheme: scheme });
  // The dashboard's code is untouched: inside this test browser only, its
  // Firebase files are swapped for ones that talk to the local emulators.
  await ctx.route('https://www.gstatic.com/firebasejs/**', (r) => {
    const url = r.request().url();
    const f = url.split('/').pop();
    const js = (body) => r.fulfill({ contentType: 'text/javascript', body });
    if (url.includes('/__real/') || !EMULATED[f]) return js(readFileSync(SDK + f));
    js(EMULATED[f]);
  });
  await ctx.route('**/team/config.js', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: "export const firebaseConfig = { apiKey: 'demo', projectId: 'demo-amrpotli', authDomain: 'localhost' };\nexport const OWNER = 'vgfintrack@gmail.com';" }));
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  p.on('dialog', (d) => d.accept());
  await p.goto(BASE);
  await p.waitForSelector('#gate:not([hidden])');
  if (email) {
    await p.evaluate((e) => window.__login(e), email);
    await p.waitForSelector('#shell:not([hidden])', { timeout: 8000 }).catch(() => {});
  }
  return { ctx, p };
}
const fill = async (p, values) => {
  for (const [k, v] of Object.entries(values)) {
    const el = await p.$(`#dlg-form [name="${k}"]`);
    const tag = await el.evaluate((e) => e.tagName);
    if (tag === 'SELECT') await el.selectOption(String(v));
    else await el.fill(String(v));
  }
};
const save = async (p) => { await p.click('#dlg-ok'); try { await p.waitForFunction(() => !document.querySelector('#dlg').open, null, { timeout: 20000 }); } catch (e) { console.log('DIALOG ERROR:', await p.textContent('#dlg-error'), 'okDisabled', await p.$eval('#dlg-ok', (b) => b.disabled), 'invalid', await p.evaluate(() => [...document.querySelectorAll('#dlg-form :invalid')].map((e) => e.name + ':' + e.validationMessage).join(';'))); throw e; } await p.waitForTimeout(300); };
const go = async (p, view) => { await p.click(`#nav [data-view="${view}"]`); await p.waitForTimeout(250); };
const navItems = (p) => p.$$eval('#nav a', (a) => a.map((x) => x.dataset.view));
const rest = (path, body, method = 'POST') => fetch(`${FS}/${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// ---------------------------------------------------------------- 1. owner builds the team
const O = await open('vgfintrack@gmail.com');
let p = O.p;
ok(!(await p.isHidden('#shell')), 'owner signs in without being on any list');
ok((await navItems(p)).length === 11, 'owner sees all 11 sections: ' + (await navItems(p)).join(', '));
ok((await p.textContent('#me')).includes('owner'), 'shown as owner');
await p.screenshot({ path: SHOTS + 'dash-1-overview.png' });

await go(p, 'team');
await p.click('[data-act="member-new"]');
await fill(p, { email: 'Sabbir@Gmail.com', name: 'Sabbir Ahmed', role: 'founder' });
await save(p);
await p.click('[data-act="member-new"]');
await fill(p, { email: 'rina@gmail.com', name: 'Rina Akter', role: 'employee', grant: '0' });
await p.check('#dlg-form [name="sections"][value="leads"]');
await p.check('#dlg-form [name="sections"][value="costs"]');
await save(p);
await p.click('[data-act="member-new"]');
await fill(p, { email: 'guest@gmail.com', name: 'Tanjim (guest)', role: 'guest', grant: '' });
await p.check('#dlg-form [name="sections"][value="feedback"]');
await save(p);
const teamTxt = await p.textContent('#main');
ok(teamTxt.includes('Sabbir Ahmed') && teamTxt.includes('sabbir@gmail.com') && teamTxt.includes('Rina Akter') && teamTxt.includes('Leads & partners, Marketing costs, Tasks'), 'team: founder (email lower-cased), employee with sections, guest');
await p.screenshot({ path: SHOTS + 'dash-2-team.png' });

// ---------------------------------------------------------------- 2. extra limits
await go(p, 'limits');
ok((await p.textContent('#main')).includes('rina@gmail.com'), 'adding Rina with "Unlimited" put her on the limits list');
await p.click('[data-act="grant-new"]');
await fill(p, { email: 'polashi.store@gmail.com', limit: '50', until: '2027-01-31', note: 'Partner shop' });
await save(p);
await p.click('[data-act="grant-team"]');
await p.waitForTimeout(600);
const pub = await (await fetch(`${FS}/public/limits`)).json();
const salt = pub.fields.salt.stringValue;
const hashes = Object.keys(pub.fields.grants.mapValue.fields);
const h = (e) => createHash('sha256').update(`${salt}:${e}`).digest('hex').slice(0, 32);
ok(hashes.includes(h('polashi.store@gmail.com')) && hashes.includes(h('rina@gmail.com')) && hashes.includes(h('vgfintrack@gmail.com')) && hashes.includes(h('sabbir@gmail.com')), `public list has ${hashes.length} scrambled emails, and the phone's check finds them`);
ok(!JSON.stringify(pub).includes('@'), 'no email is readable in the public list');
ok(pub.fields.grants.mapValue.fields[h('polashi.store@gmail.com')].mapValue.fields.limit.integerValue === '50', 'partner shop gets 50');
await p.screenshot({ path: SHOTS + 'dash-3-limits.png' });

// ---------------------------------------------------------------- 3. leads, promo, costs, notice
await go(p, 'leads');
await p.click('[data-act="lead-new"]');
await fill(p, { name: 'Mayer Doa Store', kind: 'shop', status: 'contacted', person: 'Rafiq bhai', phone: '01712345678', area: 'Polashi', next: new Date(Date.now() - 86400000).toISOString().slice(0, 10), notes: 'Wants to try baki khata' });
await save(p);
ok((await p.$$eval('td.late', (t) => t.length)) === 1 && (await p.textContent('#main')).includes('WhatsApp'), 'lead with an overdue follow-up shows in red, with WhatsApp');
await go(p, 'promos');
await p.click('[data-act="promo-new"]');
await fill(p, { code: 'polashi-50', gives: 'Early tester badge', campaign: 'Polashi posters' });
await save(p);
ok((await p.textContent('#main')).includes('POLASHI50'), 'promo code cleaned to POLASHI50');
await go(p, 'costs');
await p.click('[data-act="cost-new"]');
await fill(p, { what: '500 leaflets', amount: '1200', channel: 'print', campaign: 'Polashi posters' });
await save(p);
await p.click('[data-act="cost-new"]');
await fill(p, { what: 'Facebook boost', amount: '800', channel: 'facebook', campaign: 'FB launch' });
await save(p);
ok((await p.textContent('.kpi')).includes('৳2,000'), 'marketing this month: ৳2,000');
await go(p, 'notices');
await p.click('[data-act="notice-edit"][data-key="app"]');
await fill(p, { on: '1', en: 'New: keep receipt photos with your entries', bn: 'নতুন: এন্ট্রির সাথে রসিদের ছবি রাখুন', link: 'https://vgfintrack.github.io/guides/how-to.html#receipt' });
await save(p);
const notice = await (await fetch(`${FS}/public/notice`)).json();
ok(notice.fields.app.mapValue.fields.on.booleanValue === true, 'notice is public for the app to read');

// ---------------------------------------------------------------- 4. the app sends counts, an opt-in and feedback (no sign-in)
const today = new Date().toISOString().slice(0, 10);
const commit = (writes) => fetch(`${FS.replace('/documents', '/documents:commit')}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ writes }) });
const inc = (keys) => ({ transform: { document: `projects/demo-amrpotli/databases/(default)/documents/stats/${today}`, fieldTransforms: keys.map((k) => ({ fieldPath: k, increment: { integerValue: '1' } })) } });
for (const keys of [['active', 'new', 'bn', 'shop', 'drive', 'baki', 'voice'], ['active', 'bn', 'personal', 'simple', 'voice'], ['active', 'en', 'personal', 'drive', 'sms', 'calc']]) {
  const r = await commit([inc(keys)]);
  ok(r.ok, 'app adds a day count: ' + keys.join(','));
}
// kinds of work: two pharmacies, a student, one typed profession
const prof = (id) => ({ transform: { document: `projects/demo-amrpotli/databases/(default)/documents/profs/${today}~${id}`, fieldTransforms: [{ fieldPath: 'n', increment: { integerValue: '1' } }] } });
for (const id of ['pharmacy', 'pharmacy', 'student', 'custom']) ok((await commit([prof(id)])).ok, 'app adds 1 for its kind of work: ' + id);
ok(!(await commit([prof('Rahim Pharmacy')])).ok, 'typed words are refused as a kind of work');
const now = { setToServerValue: 'REQUEST_TIME' };
const docW = (col, id, fields, at = 'at') => ({ update: { name: `projects/demo-amrpotli/databases/(default)/documents/${col}/${id}`, fields }, updateTransforms: [{ fieldPath: at, ...now }], currentDocument: { exists: false } });
const S = (v) => ({ stringValue: v });
let r = await commit([docW('optins', 'o1', { name: S('Rahim Uddin'), email: S('rahim@gmail.com'), why: S('tester'), code: S('POLASHI50'), profession: S('Grocery shop'), lang: S('bn'), mode: S('shop'), app: S('2026.10.23') })]);
ok(r.ok, 'app opt-in accepted');
r = await commit([docW('feedback', 'f1', { kind: S('idea'), text: S('Please add stock count for my shop'), contact: S('01812000000'), from: S('app'), app: S('2026.10.23'), lang: S('bn') })]);
ok(r.ok, 'app feedback accepted');
r = await commit([docW('feedback', 'f2', { kind: S('idea'), text: S('x'), from: S('app'), lang: S('bn'), secret: S('balance 5000') })]);
ok(!r.ok, 'feedback with extra fields refused');
await p.waitForTimeout(800);
await go(p, 'users');
const u = await p.textContent('#main');
ok(u.includes('Rahim Uddin') && u.includes('POLASHI50') && u.includes('Wants to test'), 'opt-in listed with its promo code');
ok(/Phone-days active\s*3/.test(await p.textContent('.kpis')), 'counts: 3 phone-days');
const work = await p.$$eval('.split.wide .ln', (e) => e.map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
ok(work.length === 3 && work[0].includes('Pharmacy') && work[0].includes('50%') && work.some((w) => w.includes('Student') && w.includes('25%')) && work.some((w) => w.includes('Own profession (typed)')), 'Kinds of work card: ' + work.join(' | '));
await p.screenshot({ path: SHOTS + 'dash-4-users.png', fullPage: true });
await go(p, 'promos');
ok(/POLASHI50[\s\S]*1/.test(await p.textContent('tbody')), 'promo code shows 1 use');
await go(p, 'costs');
ok((await p.textContent('#main')).includes('1 people · ৳1,200 each'), 'campaign cost per person (posters: ৳1,200 for 1)');
await go(p, 'feedback');
await p.click('[data-act="fb-status"][data-to="planned"]');
await p.waitForTimeout(300);
await p.click('[data-act="fb-task"]');
await fill(p, { assignee: 'rina@gmail.com', due: today });
await save(p);
await go(p, 'tasks');
ok((await p.textContent('.board')).includes('Idea: Please add stock count'), 'feedback turned into a task for Rina');
await p.screenshot({ path: SHOTS + 'dash-5-tasks.png' });
await go(p, 'activity');
ok((await p.$$eval('tbody tr', (r) => r.length)) >= 10, 'activity log records the changes');
ok(p.errs.length === 0, 'no errors (owner) ' + p.errs.join(' | '));
await O.ctx.close();

// ---------------------------------------------------------------- 5. employee sees only her sections
const E = await open('rina@gmail.com', { width: 390, scheme: 'dark' });
p = E.p;
ok((await navItems(p)).join() === 'overview,tasks,leads,costs,team', 'employee menu: ' + (await navItems(p)).join(', '));
ok((await p.textContent('.kpis')).includes('My open tasks') && !(await p.textContent('.kpis')).includes('Phones active'), 'employee overview has no app-user counts');
await p.screenshot({ path: SHOTS + 'dash-6-employee-phone.png' });
await p.click('#menu'); await go(p, 'tasks');
await p.click('[data-act="task-move"][data-to="doing"]');
await p.waitForTimeout(300);
ok((await p.textContent('.col:nth-child(2)')).includes('stock count'), 'she starts her task');
await p.click('#menu'); await go(p, 'leads');
await p.click('[data-act="lead-new"]');
await fill(p, { name: 'Bismillah Pharmacy', kind: 'business' });
await save(p);
ok((await p.textContent('#main')).includes('Bismillah Pharmacy'), 'she adds a lead');
const sneaky = await p.evaluate(async () => {
  const { getFirestore, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
  try { await setDoc(doc(getFirestore(), 'grants', 'me@x.com'), { limit: 0 }); return 'allowed'; } catch (e) { return e.code; }
});
ok(sneaky === 'permission-denied', 'she cannot give herself extra limits, even from the console');
ok(p.errs.length === 0, 'no errors (employee) ' + p.errs.join(' | '));
await E.ctx.close();

// ---------------------------------------------------------------- 6. guest reads feedback only; stranger is kept out
const G = await open('guest@gmail.com');
p = G.p;
ok((await navItems(p)).join() === 'overview,tasks,feedback,team', 'guest menu: ' + (await navItems(p)).join(', '));
ok(!(await p.$('[data-act="fb-status"]')) , 'guest cannot change feedback');
await G.ctx.close();
const X = await open('random@gmail.com');
await X.p.waitForTimeout(800);
ok(!(await X.p.isHidden('#gate')) && (await X.p.textContent('#gate-error')).includes('not on the AmrPotli team'), 'a stranger is told to ask the owner');
await X.ctx.close();
await b.close();
