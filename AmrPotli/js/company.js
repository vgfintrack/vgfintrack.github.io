// What the app shares with the AmrPotli team, and what it reads from them.
// Loaded after the app is on screen, so it never makes opening slower.
//
// Reads (no sign-in, nothing about the user is sent):
//   public/notice  a short message to show under the top bar
//   public/limits  scrambled (hashed) emails that get more categories; the
//                  user's own email is checked here, on the phone
// Sends:
//   stats/<day>    once a day, +1 to "active" and to what was used. No id,
//                  no email, no amounts. Can be turned off in Setup.
//   optins, feedback  only what the user types and sends themself.

// A namespace import: an older config.js without firebaseProject just means "not connected".
import * as config from './config.js';

const P = config.firebaseProject;
export const connected = () => !!(P?.projectId && P?.apiKey);
const base = () => `https://firestore.googleapis.com/v1/projects/${P.projectId}/databases/(default)/documents`;
const docName = (path) => `projects/${P.projectId}/databases/(default)/documents/${path}`;

const get = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k));
  } catch {
    return null;
  }
};
const put = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---------------------------------------------------------------- Firestore REST values

function plain(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, plain(x)]));
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(plain);
  return null;
}
const str = (s) => ({ stringValue: String(s ?? '') });

async function commit(writes) {
  const res = await fetch(`${base()}:commit?key=${P.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes }),
  });
  if (!res.ok) throw new Error(`Could not send (${res.status})`);
}

// ---------------------------------------------------------------- notice and limits

const PUBLIC_KEY = 'mt:public';

// A fresh copy each time the app opens (it is tiny); the last copy works offline.
export async function loadPublic(force = false) {
  const cached = get(PUBLIC_KEY);
  if (!connected()) return cached?.data || {};
  if (!force && cached && Date.now() - cached.at < 30_000) return cached.data;
  try {
    const res = await fetch(`${base()}/public?key=${P.apiKey}`);
    if (!res.ok) throw new Error(res.status);
    const json = await res.json();
    const data = Object.fromEntries((json.documents || []).map((d) => [d.name.split('/').pop(), plain({ mapValue: { fields: d.fields || {} } })]));
    put(PUBLIC_KEY, { at: Date.now(), data });
    return data;
  } catch {
    return cached?.data || {};
  }
}

async function hash(salt, email) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${String(email).trim().toLowerCase()}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// How many categories this email may have: the free number, or more.
// Infinity means no limit.
export async function categoryLimitFor(email, data, free = 24) {
  const lim = data?.limits;
  if (!email || !lim?.salt || !lim.grants || !crypto?.subtle) return free;
  const g = lim.grants[await hash(lim.salt, email)];
  if (!g || (g.until && g.until < today())) return free;
  return g.limit ? Math.max(free, g.limit) : Infinity;
}

// ---------------------------------------------------------------- anonymous daily counts

const USED_KEY = 'mt:used'; // features used since the last count was sent
const SENT_KEY = 'mt:counted'; // the last day this phone was counted
export const COUNTS_OFF_KEY = 'mt:counts-off';

export function markUsed(feature) {
  const used = get(USED_KEY) || [];
  if (!used.includes(feature)) put(USED_KEY, [...used, feature]);
}

export const countsOn = () => !get(COUNTS_OFF_KEY);
export const setCountsOn = (on) => put(COUNTS_OFF_KEY, on ? null : 1);

// facts: { lang, shop, simple, lock, drive }
export async function sendDailyCount(facts) {
  if (!connected() || !countsOn() || !navigator.onLine) return;
  const day = today();
  const last = get(SENT_KEY);
  if (last === day) return;
  const used = (get(USED_KEY) || []).filter((f) => ['voice', 'sms', 'photo', 'calc', 'baki', 'buy', 'repeat', 'report'].includes(f));
  const keys = ['active', ...(last ? [] : ['new']), facts.lang === 'bn' ? 'bn' : 'en', facts.shop ? 'shop' : 'personal', ...(facts.simple ? ['simple'] : []),
    ...(facts.lock ? ['lock'] : []), ...(facts.drive ? ['drive'] : []), ...used];
  try {
    await commit([{ transform: { document: docName(`stats/${day}`), fieldTransforms: keys.map((k) => ({ fieldPath: k, increment: { integerValue: '1' } })) } }]);
    put(SENT_KEY, day);
    put(USED_KEY, []);
  } catch {}
}

// ---------------------------------------------------------------- contact and feedback (only what the user sends)

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
const add = (col, fields) =>
  commit([{ update: { name: docName(`${col}/${newId()}`), fields }, updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }], currentDocument: { exists: false } }]);

export function sendOptin(o) {
  const f = { name: str(o.name.slice(0, 80)), email: str(o.email.trim().toLowerCase().slice(0, 120)), why: str(o.why) };
  for (const k of ['phone', 'code', 'profession', 'lang', 'mode', 'app']) if (o[k]) f[k] = str(String(o[k]).slice(0, k === 'phone' ? 20 : k === 'code' ? 30 : 60));
  if (f.code) f.code = str(o.code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 30));
  return add('optins', f);
}

export function sendFeedback(fb) {
  const f = { kind: str(fb.kind), text: str(fb.text.slice(0, 2000)) };
  for (const k of ['contact', 'from', 'app', 'lang', 'code']) if (fb[k]) f[k] = str(String(fb[k]).slice(0, k === 'contact' ? 120 : 30));
  return add('feedback', f);
}
