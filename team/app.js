// FinnBlu team dashboard. Firebase (Auth + Firestore) holds the company's own
// data; firebase/firestore.rules decides who may read or change each part.
// Users' money records are never here: they live in each user's Google Drive.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {
  getFirestore, collection, doc, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc,
  serverTimestamp, Timestamp, query, orderBy, limit, where, documentId,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { firebaseConfig, OWNER } from './config.js';
import { PROFESSIONS } from '../FinnBlu/js/professions.js';
import { DISTRICTS, DIVISIONS } from '../FinnBlu/js/districts.js';
import { icon } from './icons.js';

// ---------------------------------------------------------------- helpers

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nf = new Intl.NumberFormat('en-US');
const money = (n) => `৳${nf.format(Math.round(Number(n) || 0))}`;
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);
const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);
const when = (v) => {
  const d = toDate(v);
  return d ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
};
const dayLabel = (s) => (s ? new Date(s + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const initials = (name = '?') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
const lower = (s) => String(s || '').trim().toLowerCase();

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 2800);
}

function csv(name, rows) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(q).join(',')).join('\n')], { type: 'text/csv' }));
  Object.assign(document.createElement('a'), { href: url, download: `${name}-${today()}.csv` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// The scrambled email the app checks against (the app does the same on the phone).
export async function emailHash(salt, email) {
  const data = new TextEncoder().encode(`${salt}:${lower(email)}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// ---------------------------------------------------------------- Firebase

let auth = null;
let db = null;
if (firebaseConfig) {
  const fb = initializeApp(firebaseConfig);
  auth = getAuth(fb);
  db = getFirestore(fb);
}

// ---------------------------------------------------------------- who am I

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: 'layout-dashboard', always: true },
  { id: 'tasks', label: 'Tasks', icon: 'list-checks', always: true },
  { id: 'users', label: 'App users', icon: 'smartphone' },
  { id: 'leads', label: 'Leads & partners', icon: 'store' },
  { id: 'feedback', label: 'Feedback', icon: 'message-square' },
  { id: 'limits', label: 'Extra limits', icon: 'infinity' },
  { id: 'promos', label: 'Promo codes', icon: 'ticket-percent' },
  { id: 'costs', label: 'Marketing costs', icon: 'megaphone' },
  { id: 'notices', label: 'Notices', icon: 'bell' },
  { id: 'team', label: 'Team', icon: 'user-cog', always: true },
  { id: 'activity', label: 'Activity', icon: 'history', leads: true },
];
// Sections the owner or a founder can give to employees and guests.
const GIVEABLE = SECTIONS.filter((s) => !s.always && !s.leads);
const ROLE_TEXT = {
  owner: 'Everything, including founders and the company account.',
  founder: 'Everything, except changing the owner or other founders.',
  employee: 'The sections given to you, plus tasks.',
  guest: 'Reading the sections given to you, until your end date.',
};

const S = {
  user: null, // { email, name, photo }
  role: null, // owner | founder | employee | guest
  sections: [],
  view: 'overview',
  data: {}, // collection name -> array of { id, ...data }
  unsub: [],
  self: null, // listener on my own team entry
  filters: {},
};
const isLead = () => S.role === 'owner' || S.role === 'founder';
const canRead = (sec) => isLead() || S.sections.includes(sec) || SECTIONS.find((s) => s.id === sec)?.always;
const canWrite = (sec) => isLead() || (S.role === 'employee' && S.sections.includes(sec));
const list = (name) => S.data[name] || [];
const teamName = (email) => (lower(email) === OWNER ? list('team').find((m) => m.id === OWNER)?.name || 'Owner' : list('team').find((m) => m.id === lower(email))?.name || email || '');

async function log(what, detail = '') {
  try {
    await addDoc(collection(db, 'activity'), { by: S.user.email, what, detail: String(detail).slice(0, 200), at: serverTimestamp() });
  } catch {}
}

// ---------------------------------------------------------------- sign in / out

function showGate(msg = '') {
  $('#shell').hidden = true;
  $('#gate').hidden = false;
  $('#gate-error').textContent = msg;
  $('#gate-error').hidden = !msg;
  if (!firebaseConfig) {
    $('#signin').disabled = true;
    $('#gate-error').textContent = 'The dashboard is not connected to Firebase yet.';
    $('#gate-error').hidden = false;
  }
}

$('#signin').onclick = async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return signInWithRedirect(auth, provider);
    if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') showGate(e.message);
  }
};

function stopListening() {
  S.unsub.forEach((u) => u());
  S.unsub = [];
  S.self?.();
  S.self = null;
  S.data = {};
  S.role = null;
}

if (auth)
  onAuthStateChanged(auth, (u) => {
    stopListening();
    if (!u) return showGate();
    S.user = { email: lower(u.email), name: u.displayName || u.email, photo: u.photoURL };
    if (S.user.email === OWNER) return start('owner', []);
    // Everyone else must be on the team list (and a guest still within their dates).
    S.self = onSnapshot(
      doc(db, 'team', S.user.email),
      (snap) => {
        const m = snap.data();
        const expired = m?.role === 'guest' && toDate(m.until) && toDate(m.until) < new Date();
        if (!m || expired) {
          stopListening();
          return showGate(expired ? `Your guest access ended on ${dayLabel(toDate(m.until).toISOString().slice(0, 10))}.` : `${S.user.email} is not on the FinnBlu team. Ask the owner to add you.`);
        }
        if (S.role !== m.role || JSON.stringify(S.sections) !== JSON.stringify(m.sections || [])) start(m.role, m.sections || []);
      },
      () => {
        stopListening();
        showGate(`${S.user.email} is not on the FinnBlu team. Ask the owner to add you.`);
      },
    );
  });
else showGate();

$('#signout').onclick = () => signOut(auth);

// ---------------------------------------------------------------- start: listen to what this person may see

function start(role, sections) {
  S.unsub.forEach((u) => u()); // S.self (my own team entry) keeps listening
  S.unsub = [];
  S.role = role;
  S.sections = sections;
  const listen = (name, q) =>
    S.unsub.push(
      onSnapshot(
        q,
        (snap) => {
          S.data[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          render();
        },
        (e) => console.warn(name, e.code),
      ),
    );
  listen('team', collection(db, 'team'));
  listen('tasks', collection(db, 'tasks'));
  listen('public', collection(db, 'public'));
  if (canRead('users')) {
    listen('stats', collection(db, 'stats'));
    // One document per day and kind of work; the last 90 days are enough.
    listen('profs', query(collection(db, 'profs'), where(documentId(), '>=', addDays(today(), -89))));
    listen('actives', collection(db, 'actives'));
    // where/<month>~c-<country> or ~d-<district>, the last 12 months
    listen('places', query(collection(db, 'where'), where(documentId(), '>=', addDays(today(), -366).slice(0, 7))));
    listen('optins', query(collection(db, 'optins'), orderBy('at', 'desc'), limit(500)));
  }
  if (canRead('leads')) listen('leads', collection(db, 'leads'));
  if (canRead('feedback')) listen('feedback', query(collection(db, 'feedback'), orderBy('at', 'desc'), limit(500)));
  if (canRead('limits')) listen('grants', collection(db, 'grants'));
  if (canRead('promos')) listen('promos', collection(db, 'promos'));
  if (canRead('costs')) listen('costs', collection(db, 'costs'));
  if (isLead()) listen('activity', query(collection(db, 'activity'), orderBy('at', 'desc'), limit(200)));
  if (role !== 'owner') updateDoc(doc(db, 'team', S.user.email), { lastSeen: serverTimestamp() }).catch(() => {});
  $('#gate').hidden = true;
  $('#shell').hidden = false;
  const fromHash = location.hash.slice(1);
  S.view = SECTIONS.some((s) => s.id === fromHash && canSee(s)) ? fromHash : 'overview';
  render();
}

const canSee = (s) => s.always || (s.leads ? isLead() : canRead(s.id));

// ---------------------------------------------------------------- shell

function drawShell() {
  const me = list('team').find((m) => m.id === S.user.email);
  const name = (S.role === 'owner' ? me?.name : me?.name) || S.user.name;
  $('#me').innerHTML = `<span class="avatar">${esc(initials(name))}</span><div><b>${esc(name)}</b><span class="tag ${S.role}">${S.role}</span></div>`;
  const badge = { feedback: list('feedback').filter((f) => !f.status || f.status === 'new').length, tasks: list('tasks').filter((t) => t.assignee === S.user.email && t.status !== 'done').length };
  $('#nav').innerHTML = SECTIONS.filter(canSee)
    .map((s) => `<a href="#${s.id}" class="${S.view === s.id ? 'on' : ''}" data-view="${s.id}">${icon(s.icon)}${s.label}${badge[s.id] ? `<span class="count">${badge[s.id]}</span>` : ''}</a>`)
    .join('');
  $('#top-title').textContent = SECTIONS.find((s) => s.id === S.view)?.label || '';
  const dark = isDark();
  $('#theme').innerHTML = icon(dark ? 'sun' : 'moon');
  $('#signout').innerHTML = `${icon('log-out')} Sign out`;
  $('#menu').innerHTML = icon('menu');
}

const isDark = () => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
$('#theme').onclick = () => {
  const t = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem('mt:theme', t);
  } catch {}
  drawShell();
};
$('#menu').onclick = () => $('#side').classList.toggle('open');
$('#nav').onclick = (e) => {
  const a = e.target.closest('[data-view]');
  if (!a) return;
  e.preventDefault();
  S.view = a.dataset.view;
  history.replaceState(null, '', `#${S.view}`);
  $('#side').classList.remove('open');
  render();
  scrollTo(0, 0);
};

function render() {
  if (!S.role || $('#shell').hidden) return;
  if (!S.data.team || !S.data.tasks) {
    drawShell();
    $('#main').innerHTML = '<div class="empty">Loading…</div>';
    return;
  }
  drawShell();
  const views = { overview, tasks, users, leads, feedback, limits, promos, costs, notices, team, activity };
  const focus = document.activeElement?.id;
  $('#main').innerHTML = views[S.view]();
  if (focus && $(`#${focus}`)) {
    const el = $(`#${focus}`);
    el.focus();
    if (el.setSelectionRange && el.value) el.setSelectionRange(el.value.length, el.value.length);
  }
}

const head = (title, sub, tools = '') => `<div class="page-head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="tools">${tools}</div></div>`;
const empty = (msg) => `<div class="empty">${msg}</div>`;
const pill = (v, label = v) => `<span class="pill ${esc(v)}">${esc(label)}</span>`;

// ---------------------------------------------------------------- dialogs

// fields: [{ name, label, type: text|email|number|date|select|textarea|checks|hidden, options, value, required, hint }]
function form({ title, fields, submit, remove, removeLabel = 'Delete', okLabel = 'Save', note = '' }) {
  const f = $('#dlg-form');
  const field = (x) => {
    const v = x.value ?? '';
    if (x.type === 'hidden') return `<input type="hidden" name="${x.name}" value="${esc(v)}">`;
    if (x.type === 'select')
      return `<label class="f">${x.label}<select name="${x.name}">${x.options.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
    if (x.type === 'textarea') return `<label class="f">${x.label}<textarea name="${x.name}" maxlength="${x.max || 2000}">${esc(v)}</textarea></label>`;
    if (x.type === 'checks')
      return `<div class="f"><span class="small muted"><b>${x.label}</b></span><div class="checks">${x.options
        .map(([k, l]) => `<label><input type="checkbox" name="${x.name}" value="${esc(k)}" ${(v || []).includes(k) ? 'checked' : ''}>${esc(l)}</label>`)
        .join('')}</div></div>`;
    return `<label class="f">${x.label}<input name="${x.name}" type="${x.type || 'text'}" value="${esc(v)}" ${x.required ? 'required' : ''} ${x.step ? `step="${x.step}"` : ''} ${x.min != null ? `min="${x.min}"` : ''} maxlength="${x.max || 200}" ${x.placeholder ? `placeholder="${esc(x.placeholder)}"` : ''}>${x.hint ? `<span class="small muted" style="font-weight:400">${x.hint}</span>` : ''}</label>`;
  };
  const rows = [];
  for (let i = 0; i < fields.length; i++) {
    const x = fields[i];
    if (x.half && fields[i + 1]?.half) {
      rows.push(`<div class="row">${field(x)}${field(fields[i + 1])}</div>`);
      i++;
    } else rows.push(field(x));
  }
  f.innerHTML = `<h2>${title}</h2>${note ? `<p class="note">${note}</p>` : ''}${rows.join('')}<p class="error" id="dlg-error" hidden></p>
    <div class="acts">${remove ? `<button type="button" class="btn danger" id="dlg-remove" style="margin-right:auto">${icon('trash-2')} ${removeLabel}</button>` : ''}
    <button type="button" class="btn" id="dlg-cancel">Cancel</button><button class="btn primary" id="dlg-ok">${okLabel}</button></div>`;
  const dlg = $('#dlg');
  $('#dlg-cancel').onclick = () => dlg.close();
  if (remove)
    $('#dlg-remove').onclick = async () => {
      if (!confirm(`${removeLabel}?`)) return;
      try {
        await remove();
        dlg.close();
      } catch (e) {
        showErr(e);
      }
    };
  const showErr = (e) => {
    $('#dlg-error').textContent = e.code === 'permission-denied' ? 'You do not have permission to do this.' : e.message || String(e);
    $('#dlg-error').hidden = false;
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const data = {};
    for (const x of fields) {
      if (x.type === 'checks') data[x.name] = $$(`[name="${x.name}"]:checked`, f).map((c) => c.value);
      else data[x.name] = f.elements[x.name].value.trim();
    }
    $('#dlg-ok').disabled = true;
    try {
      const msg = await submit(data);
      if (msg === false) return;
      dlg.close();
      if (typeof msg === 'string') toast(msg);
    } catch (err) {
      showErr(err);
    } finally {
      $('#dlg-ok') && ($('#dlg-ok').disabled = false);
    }
  };
  dlg.showModal();
  $('input:not([type=hidden]), select, textarea', f)?.focus();
}

// ---------------------------------------------------------------- Overview

function statsRange(days) {
  const from = addDays(today(), -(days - 1));
  return list('stats').filter((d) => d.id >= from).sort((a, b) => a.id.localeCompare(b.id));
}

function overview() {
  const mine = list('tasks').filter((t) => t.assignee === S.user.email && t.status !== 'done');
  const k = [];
  if (canRead('users')) {
    const d7 = statsRange(7);
    const todayRow = list('stats').find((d) => d.id === today());
    k.push(['Phones active today', nf.format(todayRow?.active || 0), 'anonymous count']);
    k.push(['Phones this month', nf.format(activesN(`m-${thisMonth()}`)), `${nf.format(activesN(`w-${isoWeek(new Date())}`))} this week`]);
    k.push(['New phones, 7 days', nf.format(d7.reduce((s, d) => s + (d.new || 0), 0)), 'first time opened']);
    k.push(['Shared their contact', nf.format(list('optins').length), `${list('optins').filter((o) => !o.status || o.status === 'new').length} new`]);
  }
  if (canRead('feedback')) k.push(['Feedback to read', nf.format(list('feedback').filter((f) => !f.status || f.status === 'new').length), `${list('feedback').length} in total`]);
  if (canRead('leads')) {
    const due = list('leads').filter((l) => l.next && l.next <= today() && !['active', 'lost'].includes(l.status));
    k.push(['Leads to follow up', nf.format(due.length), `${list('leads').length} leads`]);
  }
  if (canRead('costs')) {
    const m = today().slice(0, 7);
    k.push(['Marketing this month', money(list('costs').filter((c) => (c.date || '').startsWith(m)).reduce((s, c) => s + Number(c.amount || 0), 0)), 'spent']);
  }
  k.push(['My open tasks', nf.format(mine.length), mine.filter((t) => t.due && t.due < today()).length ? `${mine.filter((t) => t.due && t.due < today()).length} late` : 'none late']);

  const notice = list('public').find((p) => p.id === 'notice');
  return `${head(`Hello, ${esc((list('team').find((m) => m.id === S.user.email)?.name || S.user.name).split(' ')[0])}`, `You are ${S.role === 'owner' ? 'the owner' : S.role === 'employee' ? 'an employee' : `a ${S.role}`}: ${ROLE_TEXT[S.role]}`)}
    <div class="kpis">${k.map(([a, b, c]) => `<div class="kpi"><small>${a}</small><b>${b}</b><span>${c}</span></div>`).join('')}</div>
    <div class="grid">
      ${canRead('users') ? `<div class="card"><h3>${icon('smartphone')} Phones active, last 30 days</h3>${activeBars(30)}<p class="small muted" style="margin:8px 0 0">Each phone counts once a day. No names, no money.</p></div>` : ''}
      <div class="card"><h3>${icon('list-checks')} My tasks</h3>${mine.length ? mine.slice(0, 6).map(taskLine).join('') : empty('Nothing on your list.')}
        <p style="margin:8px 0 0"><a href="#tasks" data-go="tasks">Open tasks →</a></p></div>
      ${canRead('feedback') ? `<div class="card"><h3>${icon('message-square')} Latest feedback</h3>${list('feedback').slice(0, 4).map((f) => `<div class="item"><div class="top">${pill(f.kind)}${pill(f.status || 'new')}<span class="muted small">${when(f.at)}</span></div><div>${esc(f.text).slice(0, 160)}</div></div>`).join('') || empty('No feedback yet.')}</div>` : ''}
      <div class="card"><h3>${icon('bell')} Notice in the app</h3>${notice?.app?.on ? `<div class="notice-preview">${esc(notice.app.en)}<br><span class="muted">${esc(notice.app.bn)}</span></div>` : '<p class="muted" style="margin:0">No notice is showing.</p>'}</div>
    </div>`;
}

function activeBars(days) {
  const rows = statsRange(days);
  const byDay = Object.fromEntries(rows.map((r) => [r.id, r]));
  const all = [...Array(days)].map((_, i) => addDays(today(), i - days + 1));
  const max = Math.max(1, ...all.map((d) => byDay[d]?.active || 0));
  return `<div class="bars">${all.map((d) => `<div style="height:${((byDay[d]?.active || 0) / max) * 100}%" data-tip="${dayLabel(d)}: ${byDay[d]?.active || 0}"></div>`).join('')}</div>`;
}

const taskLine = (t) =>
  `<div class="item"><div class="top"><b>${esc(t.title)}</b>${pill(t.status || 'todo', { todo: 'To do', doing: 'Doing', review: 'For review', done: 'Done' }[t.status || 'todo'])}</div>
   <span class="small ${t.due && t.due < today() && t.status !== 'done' ? 'late' : 'muted'}">${t.due ? `Due ${dayLabel(t.due)}` : 'No due date'}</span></div>`;

// ---------------------------------------------------------------- Tasks

const TASK_COLS = [['todo', 'To do'], ['doing', 'Doing'], ['review', 'For review'], ['done', 'Done']];

function tasks() {
  const who = S.filters.taskWho || 'all';
  const items = list('tasks')
    .filter((t) => who === 'all' || (who === 'mine' ? t.assignee === S.user.email : t.createdBy === S.user.email))
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const canCreate = isLead() || S.role === 'employee';
  return `${head('Tasks', 'Give work to the team. The person a task is given to moves it along; owner and founders mark it done after review.',
    `<select id="task-who">${[['all', 'All tasks'], ['mine', 'Given to me'], ['made', 'Made by me']].map(([k, l]) => `<option value="${k}" ${who === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
     ${canCreate ? `<button class="btn primary" data-act="task-new">${icon('plus')} New task</button>` : ''}`)}
    <div class="board">${TASK_COLS.map(([k, l]) => {
      const col = items.filter((t) => (t.status || 'todo') === k);
      return `<div class="col"><h4>${l} · ${col.length}</h4>${col.map(taskCard).join('') || '<p class="small muted" style="margin:4px">Nothing here.</p>'}</div>`;
    }).join('')}</div>`;
}

function taskCard(t) {
  const mine = t.assignee === S.user.email;
  const edit = isLead() || canWrite('tasks') || t.createdBy === S.user.email;
  const next = { todo: ['doing', 'Start'], doing: ['review', 'Send for review'], review: isLead() ? ['done', 'Approve'] : null, done: null }[t.status || 'todo'];
  const late = t.due && t.due < today() && t.status !== 'done';
  return `<div class="task"><b>${esc(t.title)}</b>${t.details ? `<span class="small muted">${esc(t.details).slice(0, 140)}</span>` : ''}
    <span class="small">${icon('user-cog')} ${esc(teamName(t.assignee))}${t.due ? ` · <span class="${late ? 'late' : 'muted'}">${dayLabel(t.due)}</span>` : ''}</span>
    ${t.notes ? `<span class="small muted">“${esc(t.notes).slice(0, 120)}”</span>` : ''}
    <div class="acts">${next && (mine || isLead() || canWrite('tasks')) ? `<button class="btn sm" data-act="task-move" data-id="${t.id}" data-to="${next[0]}">${next[1]}</button>` : ''}
    ${t.status === 'review' && isLead() ? `<button class="btn sm" data-act="task-move" data-id="${t.id}" data-to="doing">Needs more work</button>` : ''}
    ${mine && !edit ? `<button class="btn sm" data-act="task-note" data-id="${t.id}">${icon('pencil')} Note</button>` : ''}
    ${edit ? `<button class="btn sm" data-act="task-edit" data-id="${t.id}">${icon('pencil')} Edit</button>` : ''}</div></div>`;
}

const teamOptions = () => [[OWNER, `${teamName(OWNER)} (owner)`], ...list('team').filter((m) => m.id !== OWNER).map((m) => [m.id, `${m.name} (${m.role})`])];

function taskForm(t = null) {
  form({
    title: t ? 'Edit task' : 'New task',
    fields: [
      { name: 'title', label: 'What needs doing', value: t?.title, required: true, max: 120 },
      { name: 'details', label: 'Details', type: 'textarea', value: t?.details, max: 1000 },
      { name: 'assignee', label: 'Given to', type: 'select', options: teamOptions(), value: t?.assignee || S.user.email, half: true },
      { name: 'due', label: 'Due date', type: 'date', value: t?.due, half: true },
      { name: 'status', label: 'Status', type: 'select', options: TASK_COLS, value: t?.status || 'todo' },
    ],
    remove: t ? () => deleteDoc(doc(db, 'tasks', t.id)).then(() => log('task delete', t.title)) : null,
    submit: async (d) => {
      if (t) await updateDoc(doc(db, 'tasks', t.id), { ...d, updatedAt: serverTimestamp(), updatedBy: S.user.email });
      else await addDoc(collection(db, 'tasks'), { ...d, notes: '', createdBy: S.user.email, createdAt: serverTimestamp() });
      log(t ? 'task edit' : 'task add', `${d.title} → ${d.assignee}`);
      return t ? 'Task saved' : 'Task added';
    },
  });
}

// ---------------------------------------------------------------- App users: anonymous counts + opt-ins

const COUNT_LABELS = {
  bn: 'বাংলা', en: 'English', shop: 'Business (shop) mode', personal: 'Personal', simple: 'Simple home screen', lock: 'App lock on', drive: 'Signed in (Drive)', team: 'Shop with a team',
  voice: 'Used voice', sms: 'Pasted an SMS', photo: 'Added a receipt photo', calc: 'Used the calculator', baki: 'Baki khata', buy: 'Stock purchase', repeat: 'Regular payments', report: 'Made a report',
};
const WHY = { support: 'Wants help', updates: 'Wants news', tester: 'Wants to test', business: 'Business enquiry' };

const perDay = (n) => (n < 1 ? 'Less than 1 phone a day' : Math.round(n) === 1 ? 'About 1 phone a day' : `About ${nf.format(Math.round(n))} phones a day`);

// ---- weekly and monthly users, and where they are
// Each phone adds 1 once a week (actives/w-2026-43) and once a month (m-2026-10).
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = t.getUTCFullYear();
  return `${y}-${String(Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)).padStart(2, '0')}`;
}
const thisMonth = () => today().slice(0, 7);
const activesN = (id) => list('actives').find((d) => d.id === id)?.n || 0;
const monthsBack = (n) =>
  [...Array(n)].map((_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (n - 1 - i));
    return d.toISOString().slice(0, 7);
  });
const monthLabel = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

function monthlyBars() {
  const months = monthsBack(12);
  const max = Math.max(1, ...months.map((m) => activesN(`m-${m}`)));
  return `<div class="bars">${months.map((m) => `<div style="height:${(activesN(`m-${m}`) / max) * 100}%" data-tip="${monthLabel(m)}: ${nf.format(activesN(`m-${m}`))} phones"></div>`).join('')}</div>
    <p class="small muted" style="margin:8px 0 0">The last 12 months. Each phone counts once a month.</p>`;
}

const regionName = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();
const flag = (cc) => String.fromCodePoint(...cc.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
function placesFor(month) {
  const rows = list('places').filter((d) => d.id.startsWith(`${month}~`)).map((d) => [d.id.split('~')[1], d.n || 0]);
  const of = (prefix) => rows.filter(([k]) => k.startsWith(prefix)).map(([k, n]) => [k.slice(2), n]).sort((a, b) => b[1] - a[1]);
  return { countries: of('c-'), districts: of('d-') };
}
function barList(rows, name, total) {
  const top = rows[0]?.[1] || 1;
  return `<div class="split wide">${rows
    .map(([id, n]) => `<div class="ln"><span>${esc(name(id))}</span><span class="tr"><i style="width:${(n / top) * 100}%"></i></span><b data-tip="${nf.format(n)} phones">${Math.round((n / total) * 100)}%</b></div>`)
    .join('')}</div>`;
}
function countriesCard(month) {
  const { countries } = placesFor(month);
  const total = countries.reduce((s, [, n]) => s + n, 0);
  if (!total) return empty('No phones counted in this month yet.');
  const abroad = countries.filter(([cc]) => cc !== 'bd').reduce((s, [, n]) => s + n, 0);
  return `${barList(countries.slice(0, 12), (cc) => `${flag(cc)} ${regionName?.of(cc.toUpperCase()) || cc.toUpperCase()}`, total)}
    <p class="small muted" style="margin:8px 0 0">${nf.format(total)} phones, from each phone's time zone. Outside Bangladesh: ${nf.format(abroad)}.</p>`;
}
function districtsCard(month) {
  const { districts } = placesFor(month);
  const told = districts.reduce((s, [, n]) => s + n, 0);
  if (!told) return empty('Nobody has chosen a district in this month yet. The app asks after the first entry, and in Setup.');
  const byId = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));
  const divs = Object.keys(DIVISIONS)
    .map((div) => [div, districts.filter(([id]) => byId[id]?.division === div).reduce((s, [, n]) => s + n, 0)])
    .filter(([, n]) => n)
    .sort((a, b) => b[1] - a[1]);
  const all = activesN(`m-${month}`);
  return `<p class="small muted" style="margin:0 0 6px"><b>By division</b></p>${barList(divs, (div) => `${div} division`, told)}
    <p class="small muted" style="margin:12px 0 6px"><b>Top districts</b></p>${barList(districts.slice(0, 15), (id) => byId[id]?.en || id, told)}
    <p class="small muted" style="margin:8px 0 0">${nf.format(told)} phones chose a district${all ? ` (${Math.round((told / all) * 100)}% of ${nf.format(all)} that month)` : ''}. Only what people chose themselves.</p>`;
}

// Kinds of work: phone-days per profession in the range, most first.
function professions(range) {
  const from = addDays(today(), -(range - 1));
  const by = {};
  for (const d of list('profs')) {
    const [day, prof] = d.id.split('~');
    if (day >= from && prof) by[prof] = (by[prof] || 0) + (d.n || 0);
  }
  const rows = Object.entries(by).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, n]) => s + n, 0);
  if (!total) return empty('No counts yet. Each phone that has chosen its work adds 1 a day.');
  const name = (id) => {
    const p = PROFESSIONS.find((x) => x.id === id);
    return id === 'custom' ? '✏️ Own profession (typed)' : p ? `${p.icon} ${p.en}` : id;
  };
  return `<div class="split wide">${rows
    .map(([id, n]) => `<div class="ln"><span>${esc(name(id))}</span><span class="tr"><i style="width:${(n / rows[0][1]) * 100}%"></i></span><b data-tip="${nf.format(n)} phone-days">${Math.round((n / total) * 100)}%</b></div>`)
    .join('')}</div>
    <p class="small muted" style="margin:8px 0 0">${perDay(total / range)} told their work. Shares are of phone-days.</p>`;
}

function users() {
  const range = Number(S.filters.range || 30);
  const rows = statsRange(range);
  const sum = (k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
  const act = sum('active');
  const avg = Math.round(act / range);
  const split = (keys) =>
    `<div class="split">${keys.map((k) => `<div class="ln"><span>${COUNT_LABELS[k]}</span><span class="tr"><i style="width:${act ? (sum(k) / act) * 100 : 0}%"></i></span><b>${act ? Math.round((sum(k) / act) * 100) : 0}%</b></div>`).join('')}</div>`;
  const status = S.filters.optStatus || 'all';
  const opts = list('optins').filter((o) => status === 'all' || (o.status || 'new') === status);
  return `${head('App users', 'Counts are anonymous: each phone adds 1 a day, with no name, email or money. People below chose to share their contact from the app.',
    `<select id="range">${[[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']].map(([k, l]) => `<option value="${k}" ${range === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
    <div class="kpis">
      <div class="kpi"><small>Phones this week</small><b>${nf.format(activesN(`w-${isoWeek(new Date())}`))}</b><span>weekly users, each phone once</span></div>
      <div class="kpi"><small>Phones this month</small><b>${nf.format(activesN(`m-${thisMonth()}`))}</b><span>monthly users · last month ${nf.format(activesN(`m-${monthsBack(2)[0]}`))}</span></div>
      <div class="kpi"><small>All phones</small><b>${nf.format(list('stats').reduce((s, r) => s + (r.new || 0), 0))}</b><span>ever opened FinnBlu (counted)</span></div>
      <div class="kpi"><small>Phone-days active</small><b>${nf.format(act)}</b><span>${avg >= 1 ? `about ${nf.format(avg)} a day` : act ? 'less than 1 a day' : 'none yet'}</span></div>
      <div class="kpi"><small>New phones</small><b>${nf.format(sum('new'))}</b><span>opened for the first time</span></div>
      <div class="kpi"><small>Signed in with Google</small><b>${act ? Math.round((sum('drive') / act) * 100) : 0}%</b><span>of active phone-days</span></div>
      <div class="kpi"><small>Shared their contact</small><b>${nf.format(list('optins').length)}</b><span>all time</span></div>
    </div>
    <div class="grid">
      <div class="card"><h3>${icon('smartphone')} Active each day</h3>${activeBars(range)}</div>
      <div class="card"><h3>${icon('users')} Who uses it</h3>${split(['bn', 'en', 'shop', 'team', 'personal', 'simple', 'lock', 'drive'])}</div>
      <div class="card"><h3>${icon('briefcase')} Kinds of work</h3>${professions(range)}</div>
      <div class="card"><h3>${icon('sparkles')} What they use</h3>${split(['voice', 'sms', 'calc', 'photo', 'baki', 'buy', 'repeat', 'report'])}</div>
      <div class="card"><h3>${icon('calendar')} Monthly users</h3>${monthlyBars()}</div>
    </div>
    <div class="card" style="margin-top:14px"><h3>${icon('map-pin')} Where they are
      <span class="tools" style="margin-left:auto"><select id="place-month">${monthsBack(12)
        .reverse()
        .map((m) => `<option value="${m}" ${(S.filters.placeMonth || thisMonth()) === m ? 'selected' : ''}>${monthLabel(m)}</option>`)
        .join('')}</select></span></h3>
      <div class="grid">
        <div><h4 style="margin:4px 0 8px">Countries</h4>${countriesCard(S.filters.placeMonth || thisMonth())}</div>
        <div><h4 style="margin:4px 0 8px">Districts in Bangladesh</h4>${districtsCard(S.filters.placeMonth || thisMonth())}</div>
      </div>
    </div>
    <div class="card" style="margin-top:14px"><h3>${icon('mail')} People who shared their contact
      <span class="tools" style="margin-left:auto"><select id="opt-status">${[['all', 'All'], ['new', 'New'], ['contacted', 'Contacted'], ['done', 'Done']].map(([k, l]) => `<option value="${k}" ${status === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button class="btn sm" data-act="opt-csv">${icon('download')} CSV</button></span></h3>
      ${opts.length ? `<div class="table-wrap"><table><thead><tr><th>Person</th><th>Why</th><th>Work</th><th>Promo</th><th>When</th><th>Status</th><th></th></tr></thead><tbody>${opts
        .map(
          (o) => `<tr><td><b>${esc(o.name)}</b><br><a href="mailto:${esc(o.email)}">${esc(o.email)}</a>${o.phone ? `<br><a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>` : ''}</td>
          <td>${esc(WHY[o.why] || o.why)}</td><td>${esc(o.profession || '')}<br><span class="muted">${esc(o.mode || '')} · ${esc(o.lang || '')}</span></td>
          <td>${esc(o.code || '')}</td><td class="muted">${when(o.at)}</td><td>${pill(o.status || 'new')}${o.note ? `<br><span class="muted">${esc(o.note)}</span>` : ''}</td>
          <td>${canWrite('users') ? `<button class="btn sm" data-act="opt-edit" data-id="${o.id}">${icon('pencil')}</button>` : ''}</td></tr>`,
        )
        .join('')}</tbody></table></div>` : empty('Nobody yet. In the app, Setup → “Stay in touch” lets a user share their contact.')}
    </div>`;
}

// ---------------------------------------------------------------- Leads & partners

const LEAD_KINDS = [['shop', 'Shop'], ['business', 'Other business'], ['school', 'School / college'], ['tester', 'Tester'], ['partner', 'Partner'], ['investor', 'Investor'], ['media', 'Media'], ['other', 'Other']];
const LEAD_STATUS = [['new', 'New'], ['contacted', 'Contacted'], ['trial', 'Trying the app'], ['active', 'Using it'], ['lost', 'Not now']];

function leads() {
  const q = lower(S.filters.leadQ);
  const st = S.filters.leadStatus || 'open';
  const items = list('leads')
    .filter((l) => (st === 'all' ? true : st === 'open' ? !['active', 'lost'].includes(l.status) : l.status === st))
    .filter((l) => !q || [l.name, l.person, l.phone, l.area, l.notes].some((v) => lower(v).includes(q)))
    .sort((a, b) => (a.next || '9999').localeCompare(b.next || '9999'));
  return `${head('Leads & partners', 'Shops, testers, schools and partners the team is talking to. Follow-ups due today or earlier are in red.',
    `<input id="lead-q" type="search" placeholder="Search" value="${esc(S.filters.leadQ || '')}">
     <select id="lead-status">${[['open', 'Open'], ['all', 'All'], ...LEAD_STATUS].map(([k, l]) => `<option value="${k}" ${st === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
     <button class="btn" data-act="lead-csv">${icon('download')} CSV</button>
     ${canWrite('leads') ? `<button class="btn primary" data-act="lead-new">${icon('plus')} Add</button>` : ''}`)}
    <div class="card">${items.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Kind</th><th>Contact</th><th>Status</th><th>Next follow-up</th><th>With</th><th></th></tr></thead><tbody>${items
      .map((l) => {
        const due = l.next && l.next <= today() && !['active', 'lost'].includes(l.status);
        const wa = l.phone ? `https://wa.me/${l.phone.replace(/\D/g, '').replace(/^0/, '880')}` : '';
        return `<tr><td><b>${esc(l.name)}</b>${l.area ? `<br><span class="muted">${esc(l.area)}</span>` : ''}${l.notes ? `<br><span class="muted small">${esc(l.notes).slice(0, 90)}</span>` : ''}</td>
          <td>${esc(Object.fromEntries(LEAD_KINDS)[l.kind] || l.kind)}</td>
          <td>${esc(l.person || '')}${l.phone ? `<br><a href="tel:${esc(l.phone)}">${esc(l.phone)}</a>${wa ? ` · <a href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ''}` : ''}${l.email ? `<br><a href="mailto:${esc(l.email)}">${esc(l.email)}</a>` : ''}</td>
          <td>${pill(l.status || 'new', Object.fromEntries(LEAD_STATUS)[l.status || 'new'])}</td>
          <td class="${due ? 'late' : ''}">${l.next ? dayLabel(l.next) : '<span class="muted">—</span>'}</td>
          <td class="muted">${esc(teamName(l.owner))}</td>
          <td>${canWrite('leads') ? `<button class="btn sm" data-act="lead-edit" data-id="${l.id}">${icon('pencil')}</button>` : ''}</td></tr>`;
      })
      .join('')}</tbody></table></div>` : empty('No leads here.')}</div>`;
}

function leadForm(l = null) {
  form({
    title: l ? 'Edit lead' : 'Add a lead',
    fields: [
      { name: 'name', label: 'Name (shop, school, person)', value: l?.name, required: true, max: 80 },
      { name: 'kind', label: 'Kind', type: 'select', options: LEAD_KINDS, value: l?.kind || 'shop', half: true },
      { name: 'status', label: 'Status', type: 'select', options: LEAD_STATUS, value: l?.status || 'new', half: true },
      { name: 'person', label: 'Contact person', value: l?.person, half: true, max: 60 },
      { name: 'phone', label: 'Phone', type: 'tel', value: l?.phone, half: true, max: 20 },
      { name: 'email', label: 'Email', type: 'email', value: l?.email, half: true, max: 120 },
      { name: 'area', label: 'Area', value: l?.area, half: true, max: 60, placeholder: 'e.g. Polashi, Dhaka' },
      { name: 'next', label: 'Next follow-up', type: 'date', value: l?.next, half: true },
      { name: 'owner', label: 'Who is talking to them', type: 'select', options: teamOptions(), value: l?.owner || S.user.email, half: true },
      { name: 'notes', label: 'Notes', type: 'textarea', value: l?.notes, max: 2000 },
    ],
    remove: l ? () => deleteDoc(doc(db, 'leads', l.id)).then(() => log('lead delete', l.name)) : null,
    submit: async (d) => {
      if (l) await updateDoc(doc(db, 'leads', l.id), { ...d, updatedAt: serverTimestamp(), updatedBy: S.user.email });
      else await addDoc(collection(db, 'leads'), { ...d, createdAt: serverTimestamp(), createdBy: S.user.email });
      log(l ? 'lead edit' : 'lead add', `${d.name} (${d.status})`);
      return 'Saved';
    },
  });
}

// ---------------------------------------------------------------- Feedback inbox

const FB_STATUS = [['new', 'New'], ['planned', 'Planned'], ['fixed', 'Done'], ['closed', 'Closed']];
const FB_KIND = { problem: 'Problem', idea: 'Idea', praise: 'Praise', question: 'Question' };

function feedback() {
  const st = S.filters.fbStatus || 'open';
  const kind = S.filters.fbKind || 'all';
  const items = list('feedback')
    .filter((f) => (st === 'all' ? true : st === 'open' ? ['new', 'planned', undefined].includes(f.status) : (f.status || 'new') === st))
    .filter((f) => kind === 'all' || f.kind === kind);
  return `${head('Feedback', 'From the app (Setup → Send feedback) and the website. People were asked not to write amounts or account numbers.',
    `<select id="fb-kind">${[['all', 'All kinds'], ...Object.entries(FB_KIND)].map(([k, l]) => `<option value="${k}" ${kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
     <select id="fb-status">${[['open', 'Open'], ['all', 'All'], ...FB_STATUS].map(([k, l]) => `<option value="${k}" ${st === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
     <button class="btn" data-act="fb-csv">${icon('download')} CSV</button>`)}
    <div class="card">${items.length ? items
      .map(
        (f) => `<div class="item"><div class="top">${pill(f.kind === 'problem' ? 'problem' : 'new', FB_KIND[f.kind] || f.kind)}${pill(f.status || 'new', Object.fromEntries(FB_STATUS)[f.status || 'new'])}
          <span class="muted small">${when(f.at)} · ${esc(f.from || '')} · ${esc(f.app || '')} · ${esc(f.lang || '')}${f.code ? ` · code ${esc(f.code)}` : ''}</span></div>
          <div style="white-space:pre-wrap">${esc(f.text)}</div>
          ${f.contact ? `<span class="small">Contact: ${/@/.test(f.contact) ? `<a href="mailto:${esc(f.contact)}">${esc(f.contact)}</a>` : `<a href="tel:${esc(f.contact)}">${esc(f.contact)}</a>`}</span>` : ''}
          ${f.note ? `<span class="small muted">Team note: ${esc(f.note)}</span>` : ''}
          ${canWrite('feedback') ? `<div class="acts">${FB_STATUS.filter(([k]) => k !== (f.status || 'new')).map(([k, l]) => `<button class="btn sm" data-act="fb-status" data-id="${f.id}" data-to="${k}">${l}</button>`).join('')}
            <button class="btn sm" data-act="fb-note" data-id="${f.id}">${icon('pencil')} Note</button>
            <button class="btn sm" data-act="fb-task" data-id="${f.id}">${icon('list-checks')} Make a task</button></div>` : ''}</div>`,
      )
      .join('') : empty('Nothing here.')}</div>`;
}

// ---------------------------------------------------------------- Extra limits

const FREE_LIMIT = 24;
const FREE_PRODUCTS = 15;

function limits() {
  const items = [...list('grants')].sort((a, b) => a.id.localeCompare(b.id));
  const pub = list('public').find((p) => p.id === 'limits');
  const teamWithout = [OWNER, ...list('team').map((m) => m.id)].filter((e, i, a) => a.indexOf(e) === i && !items.some((g) => g.id === e));
  return `${head('Extra limits', `The free plan has ${FREE_LIMIT} categories and ${FREE_PRODUCTS} products. People on this list get more in their own FinnBlu.`,
    canWrite('limits') ? `${teamWithout.length ? `<button class="btn" data-act="grant-team">${icon('users')} Add the team (${teamWithout.length})</button>` : ''}<button class="btn primary" data-act="grant-new">${icon('plus')} Give more</button>` : '')}
    <p class="note">${icon('shield-check')} The app downloads only scrambled emails and checks the user's own email on the phone, so it never sends anyone's email anywhere. A change reaches the person the next time they open FinnBlu with internet.</p>
    <div class="card">${items.length ? `<div class="table-wrap"><table><thead><tr><th>Email</th><th class="num">Categories</th><th class="num">Products</th><th>Until</th><th>Why</th><th>Given by</th><th></th></tr></thead><tbody>${items
      .map((g) => {
        const over = g.until && g.until < today();
        return `<tr><td><b>${esc(g.id)}</b>${teamName(g.id) !== g.id ? `<br><span class="muted">${esc(teamName(g.id))}</span>` : ''}</td>
          <td class="num">${g.limit ? nf.format(g.limit) : 'Unlimited'}</td>
          <td class="num">${g.products == null ? `<span class="muted">${FREE_PRODUCTS}</span>` : g.products ? nf.format(g.products) : 'Unlimited'}</td>
          <td class="${over ? 'late' : ''}">${g.until ? dayLabel(g.until) + (over ? ' (ended)' : '') : '<span class="muted">No end</span>'}</td>
          <td class="muted">${esc(g.note || '')}</td><td class="muted">${esc(teamName(g.by))}</td>
          <td>${canWrite('limits') ? `<button class="btn sm" data-act="grant-edit" data-id="${esc(g.id)}">${icon('pencil')}</button>` : ''}</td></tr>`;
      })
      .join('')}</tbody></table></div>` : empty('Nobody has extra categories yet.')}
      <p class="small muted" style="margin:10px 0 0">${pub?.updatedAt ? `List published ${when(pub.updatedAt)} · ${Object.keys(pub.grants || {}).length} people` : 'Not published yet.'}</p></div>`;
}

// Rebuilds the public, scrambled list from the private one.
async function publishLimits(next) {
  const pub = list('public').find((p) => p.id === 'limits');
  const salt = pub?.salt || crypto.getRandomValues(new Uint32Array(4)).join('-');
  const grants = {};
  for (const g of next)
    grants[await emailHash(salt, g.id)] = { limit: Number(g.limit) || 0, ...(g.products != null && { products: Number(g.products) || 0 }), ...(g.until && { until: g.until }) };
  await setDoc(doc(db, 'public', 'limits'), { salt, grants, free: FREE_LIMIT, freeProducts: FREE_PRODUCTS, updatedAt: serverTimestamp() });
}

function grantForm(g = null) {
  form({
    title: g ? 'Change extra limit' : 'Give more categories',
    note: 'Use the Google account email the person signs in to FinnBlu with.',
    fields: [
      { name: 'email', label: 'Email', type: 'email', value: g?.id, required: true, max: 120 },
      { name: 'limit', label: 'Categories', type: 'select', options: [['0', 'Unlimited'], ['30', '30'], ['40', '40'], ['50', '50'], ['75', '75'], ['100', '100']], value: String(g?.limit ?? 0), half: true },
      { name: 'products', label: 'Products (shops)', type: 'select', options: [['0', 'Unlimited'], ['', `${FREE_PRODUCTS} (free)`], ['25', '25'], ['40', '40'], ['60', '60'], ['100', '100']], value: g ? (g.products == null ? '' : String(g.products)) : '0', half: true },
      { name: 'until', label: 'Until (optional)', type: 'date', value: g?.until },
      { name: 'note', label: 'Why', value: g?.note, max: 120, placeholder: 'e.g. Founder, tester, partner shop' },
    ],
    remove: g
      ? async () => {
          await deleteDoc(doc(db, 'grants', g.id));
          await publishLimits(list('grants').filter((x) => x.id !== g.id));
          log('limit remove', g.id);
        }
      : null,
    removeLabel: 'Take it back',
    submit: async (d) => {
      const email = lower(d.email);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email.');
      const row = { limit: Number(d.limit), ...(d.products !== '' && { products: Number(d.products) }), until: d.until || '', note: d.note, by: S.user.email, at: serverTimestamp() };
      if (g && g.id !== email) await deleteDoc(doc(db, 'grants', g.id));
      await setDoc(doc(db, 'grants', email), row);
      await publishLimits([...list('grants').filter((x) => x.id !== email && x.id !== g?.id), { id: email, ...row }]);
      log('limit set', `${email}: ${row.limit || 'unlimited'} categories, ${row.products == null ? FREE_PRODUCTS : row.products || 'unlimited'} products${row.until ? ` until ${row.until}` : ''}`);
      return 'Saved and published';
    },
  });
}

// ---------------------------------------------------------------- Promo codes

function promoUses(code) {
  const c = String(code).toUpperCase();
  return list('optins').filter((o) => String(o.code || '').toUpperCase() === c).length + list('feedback').filter((f) => String(f.code || '').toUpperCase() === c).length;
}

function promos() {
  const items = [...list('promos')].sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  return `${head('Promo codes', 'Codes for campaigns. People type them when they share their contact or send feedback, so you see which campaign brought them. Ready for discounts once paid plans start.',
    canWrite('promos') ? `<button class="btn primary" data-act="promo-new">${icon('plus')} New code</button>` : '')}
    <div class="card">${items.length ? `<div class="table-wrap"><table><thead><tr><th>Code</th><th>Gives</th><th>Campaign</th><th>Dates</th><th class="num">Used</th><th></th></tr></thead><tbody>${items
      .map((p) => {
        const used = canRead('users') ? promoUses(p.id) : null;
        const ended = p.end && p.end < today();
        return `<tr><td><b>${esc(p.id)}</b> ${p.active === false || ended ? pill('closed', ended ? 'Ended' : 'Off') : pill('active', 'On')}</td>
          <td>${esc(p.gives || '')}</td><td>${esc(p.campaign || '')}</td>
          <td class="muted">${p.start ? dayLabel(p.start) : ''}${p.end ? ` → ${dayLabel(p.end)}` : ''}</td>
          <td class="num">${used == null ? '—' : nf.format(used)}${p.max ? ` / ${nf.format(p.max)}` : ''}</td>
          <td>${canWrite('promos') ? `<button class="btn sm" data-act="promo-edit" data-id="${esc(p.id)}">${icon('pencil')}</button>` : ''}</td></tr>`;
      })
      .join('')}</tbody></table></div>` : empty('No promo codes yet.')}</div>`;
}

function promoForm(p = null) {
  form({
    title: p ? `Edit ${p.id}` : 'New promo code',
    fields: [
      { name: 'code', label: 'Code (letters and numbers)', value: p?.id, required: true, max: 30, placeholder: 'e.g. POLASHI50' },
      { name: 'gives', label: 'What it gives', value: p?.gives, max: 120, placeholder: 'e.g. 3 months of Plus at half price' },
      { name: 'campaign', label: 'Campaign', value: p?.campaign, max: 80, placeholder: 'e.g. Polashi bazar posters' },
      { name: 'start', label: 'Starts', type: 'date', value: p?.start || today(), half: true },
      { name: 'end', label: 'Ends (optional)', type: 'date', value: p?.end, half: true },
      { name: 'max', label: 'Most uses (optional)', type: 'number', min: 0, value: p?.max || '', half: true },
      { name: 'active', label: 'Status', type: 'select', options: [['1', 'On'], ['0', 'Off']], value: p?.active === false ? '0' : '1', half: true },
    ],
    remove: p ? () => deleteDoc(doc(db, 'promos', p.id)).then(() => log('promo delete', p.id)) : null,
    submit: async (d) => {
      const code = d.code.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!code) throw new Error('Use letters and numbers only.');
      if (!p && list('promos').some((x) => x.id === code)) throw new Error('That code already exists.');
      if (p && p.id !== code) await deleteDoc(doc(db, 'promos', p.id));
      await setDoc(doc(db, 'promos', code), { gives: d.gives, campaign: d.campaign, start: d.start, end: d.end, max: Number(d.max) || 0, active: d.active === '1', by: S.user.email, at: serverTimestamp() });
      log(p ? 'promo edit' : 'promo add', code);
      return `Code ${code} saved`;
    },
  });
}

// ---------------------------------------------------------------- Marketing costs

const CHANNELS = [['facebook', 'Facebook / Instagram'], ['google', 'Google / YouTube'], ['print', 'Posters & leaflets'], ['event', 'Events & visits'], ['people', 'Influencers & ambassadors'], ['gifts', 'Gifts & samples'], ['other', 'Other']];

function costs() {
  const month = S.filters.costMonth || today().slice(0, 7);
  const items = list('costs').filter((c) => (c.date || '').startsWith(month)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const total = items.reduce((s, c) => s + Number(c.amount || 0), 0);
  const byCh = {};
  const byCamp = {};
  for (const c of items) {
    byCh[c.channel] = (byCh[c.channel] || 0) + Number(c.amount || 0);
    if (c.campaign) byCamp[c.campaign] = (byCamp[c.campaign] || 0) + Number(c.amount || 0);
  }
  const months = [...new Set([today().slice(0, 7), ...list('costs').map((c) => (c.date || '').slice(0, 7)).filter(Boolean)])].sort().reverse();
  const promoFor = (camp) => list('promos').filter((p) => p.campaign === camp).map((p) => p.id);
  return `${head('Marketing costs', 'Every taka spent to bring people in, by channel and campaign.',
    `<select id="cost-month">${months.map((m) => `<option value="${m}" ${m === month ? 'selected' : ''}>${new Date(m + '-15').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</option>`).join('')}</select>
     <button class="btn" data-act="cost-csv">${icon('download')} CSV</button>
     ${canWrite('costs') ? `<button class="btn primary" data-act="cost-new">${icon('plus')} Add a cost</button>` : ''}`)}
    <div class="kpis"><div class="kpi"><small>Spent this month</small><b>${money(total)}</b><span>${items.length} entries</span></div>
      <div class="kpi"><small>All time</small><b>${money(list('costs').reduce((s, c) => s + Number(c.amount || 0), 0))}</b><span>${list('costs').length} entries</span></div></div>
    <div class="grid">
      <div class="card"><h3>${icon('megaphone')} By channel</h3>${Object.keys(byCh).length ? `<div class="split">${CHANNELS.filter(([k]) => byCh[k]).map(([k, l]) => `<div class="ln"><span>${l}</span><span class="tr"><i style="width:${(byCh[k] / total) * 100}%"></i></span><b>${money(byCh[k])}</b></div>`).join('')}</div>` : empty('Nothing spent this month.')}</div>
      <div class="card"><h3>${icon('ticket-percent')} By campaign</h3>${Object.keys(byCamp).length ? `<table><tbody>${Object.entries(byCamp)
        .sort((a, b) => b[1] - a[1])
        .map(([camp, amt]) => {
          const codes = promoFor(camp);
          const uses = canRead('users') ? codes.reduce((s, c) => s + promoUses(c), 0) : 0;
          return `<tr><td>${esc(camp)}${codes.length ? `<br><span class="muted small">codes ${codes.join(', ')}</span>` : ''}</td><td class="num">${money(amt)}${uses ? `<br><span class="muted small">${uses} people · ${money(amt / uses)} each</span>` : ''}</td></tr>`;
        })
        .join('')}</tbody></table>` : empty('Give costs a campaign name to compare them.')}</div>
    </div>
    <div class="card" style="margin-top:14px">${items.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>What</th><th>Channel</th><th>Campaign</th><th>Paid by</th><th class="num">Amount</th><th></th></tr></thead><tbody>${items
      .map((c) => `<tr><td class="muted">${dayLabel(c.date)}</td><td>${esc(c.what)}</td><td>${esc(Object.fromEntries(CHANNELS)[c.channel] || c.channel)}</td><td>${esc(c.campaign || '')}</td><td class="muted">${esc(teamName(c.paidBy) || c.paidBy || '')}</td><td class="num">${money(c.amount)}</td>
        <td>${canWrite('costs') ? `<button class="btn sm" data-act="cost-edit" data-id="${c.id}">${icon('pencil')}</button>` : ''}</td></tr>`)
      .join('')}</tbody></table></div>` : empty('No costs this month.')}</div>`;
}

function costForm(c = null) {
  const camps = [...new Set(list('costs').map((x) => x.campaign).filter(Boolean))];
  form({
    title: c ? 'Edit cost' : 'Add a marketing cost',
    fields: [
      { name: 'what', label: 'What was it', value: c?.what, required: true, max: 120, placeholder: 'e.g. Facebook boost, 500 leaflets' },
      { name: 'amount', label: 'Amount (৳)', type: 'number', min: 0, step: 'any', value: c?.amount, required: true, half: true },
      { name: 'date', label: 'Date', type: 'date', value: c?.date || today(), half: true },
      { name: 'channel', label: 'Channel', type: 'select', options: CHANNELS, value: c?.channel || 'facebook', half: true },
      { name: 'paidBy', label: 'Paid by', type: 'select', options: teamOptions(), value: c?.paidBy || S.user.email, half: true },
      { name: 'campaign', label: 'Campaign', value: c?.campaign, max: 80, hint: camps.length ? `Used before: ${camps.slice(0, 6).map(esc).join(', ')}` : '' },
      { name: 'note', label: 'Note', value: c?.note, max: 200 },
    ],
    remove: c ? () => deleteDoc(doc(db, 'costs', c.id)).then(() => log('cost delete', `${c.what} ${c.amount}`)) : null,
    submit: async (d) => {
      const amount = Number(d.amount);
      if (!(amount > 0)) throw new Error('Enter an amount greater than 0.');
      const row = { ...d, amount, by: S.user.email, at: serverTimestamp() };
      if (c) await updateDoc(doc(db, 'costs', c.id), row);
      else await addDoc(collection(db, 'costs'), row);
      log(c ? 'cost edit' : 'cost add', `${d.what} ${money(amount)}`);
      S.filters.costMonth = d.date.slice(0, 7);
      return 'Saved';
    },
  });
}

// ---------------------------------------------------------------- Notices

function notices() {
  const n = list('public').find((p) => p.id === 'notice') || {};
  const box = (key, title, where) => {
    const x = n[key] || {};
    return `<div class="card"><h3>${icon('bell')} ${title}</h3>
      <p class="small muted" style="margin:0 0 10px">${where}</p>
      ${x.on ? `<div class="notice-preview">${esc(x.en)}${x.bn ? `<br><span class="muted">${esc(x.bn)}</span>` : ''}${x.link ? `<br><a href="${esc(x.link)}" target="_blank" rel="noopener">${esc(x.link)}</a>` : ''}</div>` : '<p class="muted">Not showing.</p>'}
      ${canWrite('notices') ? `<p style="margin:12px 0 0"><button class="btn" data-act="notice-edit" data-key="${key}">${icon('pencil')} Change</button></p>` : ''}</div>`;
  };
  return `${head('Notices', 'Short messages on top of the app and the website. They appear the next time someone opens it with internet.')}
    <div class="grid">${box('app', 'In the app', 'A bar under the top of the app. People can close it; a new message shows again.')}
    ${box('site', 'On the website', 'A bar at the top of every website page.')}</div>
    ${n.updatedAt ? `<p class="small muted">Last changed ${when(n.updatedAt)} by ${esc(teamName(n.by))}.</p>` : ''}`;
}

function noticeForm(key) {
  const n = list('public').find((p) => p.id === 'notice') || {};
  const x = n[key] || {};
  form({
    title: key === 'app' ? 'Notice in the app' : 'Notice on the website',
    fields: [
      { name: 'on', label: 'Show it', type: 'select', options: [['1', 'Yes, show it'], ['0', 'No']], value: x.on ? '1' : '0' },
      { name: 'en', label: 'English', value: x.en, max: 160, placeholder: 'e.g. New: keep receipt photos with your entries' },
      { name: 'bn', label: 'বাংলা', value: x.bn, max: 160, placeholder: 'যেমন: নতুন: এন্ট্রির সাথে রসিদের ছবি রাখুন' },
      { name: 'link', label: 'Link (optional)', type: 'url', value: x.link, max: 200, placeholder: 'https://vgfintrack.github.io/guides/how-to.html#receipt' },
    ],
    submit: async (d) => {
      if (d.on === '1' && !d.en && !d.bn) throw new Error('Write the message first.');
      if (d.link && !/^https:\/\//.test(d.link)) throw new Error('The link must start with https://');
      await setDoc(doc(db, 'public', 'notice'), { ...n, [key]: { on: d.on === '1', en: d.en, bn: d.bn, link: d.link, id: Date.now() }, updatedAt: serverTimestamp(), by: S.user.email });
      log('notice', `${key}: ${d.on === '1' ? d.en || d.bn : 'off'}`);
      return d.on === '1' ? 'Notice is live' : 'Notice turned off';
    },
  });
}

// ---------------------------------------------------------------- Team

function team() {
  const people = [{ id: OWNER, name: list('team').find((m) => m.id === OWNER)?.name || 'Company account', role: 'owner' }, ...list('team').filter((m) => m.id !== OWNER)];
  const order = { owner: 0, founder: 1, employee: 2, guest: 3 };
  people.sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name));
  const canEdit = (m) => m.role !== 'owner' && (S.role === 'owner' || (S.role === 'founder' && ['employee', 'guest'].includes(m.role)));
  const secName = (id) => SECTIONS.find((s) => s.id === id)?.label || id;
  return `${head('Team', 'People sign in with the Google account added here. Ask everyone to turn on 2-step verification.',
    isLead() ? `<button class="btn primary" data-act="member-new">${icon('user-plus')} Add person</button>` : '')}
    <div class="card"><div class="table-wrap"><table><thead><tr><th>Person</th><th>Role</th><th>Can see</th><th>Last opened</th><th></th></tr></thead><tbody>${people
      .map((m) => {
        const expired = m.role === 'guest' && toDate(m.until) && toDate(m.until) < new Date();
        return `<tr><td><b>${esc(m.name)}</b>${m.id === S.user.email ? ' <span class="muted">(you)</span>' : ''}<br><span class="muted">${esc(m.id)}</span></td>
        <td><span class="tag ${m.role}">${m.role}</span>${m.role === 'guest' && m.until ? `<br><span class="small ${expired ? 'late' : 'muted'}">until ${dayLabel(toDate(m.until).toISOString().slice(0, 10))}</span>` : ''}</td>
        <td class="small">${['owner', 'founder'].includes(m.role) ? 'Everything' : [...(m.sections || []).map(secName), 'Tasks'].join(', ')}</td>
        <td class="muted small">${m.role === 'owner' ? '' : when(m.lastSeen) || 'Not yet'}</td>
        <td>${canEdit(m) ? `<button class="btn sm" data-act="member-edit" data-id="${esc(m.id)}">${icon('pencil')}</button>` : ''}</td></tr>`;
      })
      .join('')}</tbody></table></div></div>
    <div class="grid" style="margin-top:14px">${Object.entries(ROLE_TEXT).map(([r, t]) => `<div class="card"><h3><span class="tag ${r}">${r}</span></h3><p class="muted" style="margin:0">${t}</p></div>`).join('')}</div>`;
}

function memberForm(m = null) {
  const roles = S.role === 'owner' ? [['founder', 'Founder'], ['employee', 'Employee'], ['guest', 'Guest (read only, with an end date)']] : [['employee', 'Employee'], ['guest', 'Guest (read only, with an end date)']];
  const until = m?.until ? toDate(m.until).toISOString().slice(0, 10) : addDays(today(), 30);
  form({
    title: m ? `Edit ${m.name}` : 'Add a person',
    note: 'Founders see everything. Employees can change the sections you tick; guests can only read them.',
    fields: [
      { name: 'email', label: 'Google account email', type: 'email', value: m?.id, required: true, max: 120 },
      { name: 'name', label: 'Name', value: m?.name, required: true, max: 80 },
      { name: 'role', label: 'Role', type: 'select', options: roles, value: m?.role || 'employee', half: true },
      { name: 'until', label: 'Guest until', type: 'date', value: until, half: true },
      { name: 'sections', label: 'Sections (employees and guests)', type: 'checks', options: GIVEABLE.map((s) => [s.id, s.label]), value: m?.sections || [] },
      ...(canWrite('limits') && !m ? [{ name: 'grant', label: 'Extra categories in their FinnBlu', type: 'select', options: [['0', 'Unlimited'], ['', 'No, keep the free 24']], value: '0' }] : []),
    ],
    remove: m ? () => deleteDoc(doc(db, 'team', m.id)).then(() => log('team remove', m.id)) : null,
    removeLabel: 'Remove from team',
    submit: async (d) => {
      const email = lower(d.email);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email.');
      if (email === OWNER) throw new Error('That is the company account: it is always the owner.');
      if (!m && list('team').some((x) => x.id === email)) throw new Error('This person is already on the team.');
      const row = {
        name: d.name,
        role: d.role,
        sections: ['founder'].includes(d.role) ? [] : d.sections,
        addedBy: m?.addedBy || S.user.email,
        addedAt: m?.addedAt || Timestamp.now(),
        ...(d.role === 'guest' && { until: Timestamp.fromDate(new Date(d.until + 'T23:59:59')) }),
      };
      if (m && m.id !== email) await deleteDoc(doc(db, 'team', m.id));
      await setDoc(doc(db, 'team', email), row);
      log(m ? 'team edit' : 'team add', `${email} as ${d.role}`);
      if (!m && d.grant !== undefined && d.grant !== '') {
        const g = { limit: 0, products: 0, until: d.role === 'guest' ? d.until : '', note: `Team (${d.role})`, by: S.user.email, at: serverTimestamp() };
        await setDoc(doc(db, 'grants', email), g);
        await publishLimits([...list('grants').filter((x) => x.id !== email), { id: email, ...g }]);
      }
      return m ? 'Saved' : `${d.name} can now sign in`;
    },
  });
}

// ---------------------------------------------------------------- Activity

function activity() {
  return `${head('Activity', 'What the team changed, newest first (last 200).')}
    <div class="card">${list('activity').length ? `<div class="table-wrap"><table><tbody>${list('activity')
      .map((a) => `<tr><td class="muted small" style="white-space:nowrap">${when(a.at)}</td><td><b>${esc(teamName(a.by))}</b></td><td>${esc(a.what)}</td><td class="muted">${esc(a.detail || '')}</td></tr>`)
      .join('')}</tbody></table></div>` : empty('Nothing yet.')}</div>`;
}

// ---------------------------------------------------------------- clicks and filters

const byId = (name, id) => list(name).find((x) => x.id === id);

$('#main').addEventListener('click', async (e) => {
  const go = e.target.closest('[data-go]');
  if (go) {
    e.preventDefault();
    S.view = go.dataset.go;
    history.replaceState(null, '', `#${S.view}`);
    return render();
  }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const { act, id } = b.dataset;
  try {
    if (act === 'task-new') taskForm();
    if (act === 'task-edit') taskForm(byId('tasks', id));
    if (act === 'task-move') {
      await updateDoc(doc(db, 'tasks', id), { status: b.dataset.to, updatedAt: serverTimestamp(), updatedBy: S.user.email });
      log('task move', `${byId('tasks', id)?.title} → ${b.dataset.to}`);
    }
    if (act === 'task-note') {
      const t = byId('tasks', id);
      form({ title: 'Note for the task', fields: [{ name: 'notes', label: t.title, type: 'textarea', value: t.notes, max: 1000 }], submit: (d) => updateDoc(doc(db, 'tasks', id), { notes: d.notes, updatedAt: serverTimestamp(), updatedBy: S.user.email }).then(() => 'Saved') });
    }
    if (act === 'lead-new') leadForm();
    if (act === 'lead-edit') leadForm(byId('leads', id));
    if (act === 'lead-csv')
      csv('leads', [['Name', 'Kind', 'Status', 'Person', 'Phone', 'Email', 'Area', 'Next', 'With', 'Notes'], ...list('leads').map((l) => [l.name, l.kind, l.status, l.person, l.phone, l.email, l.area, l.next, l.owner, l.notes])]);
    if (act === 'opt-edit') {
      const o = byId('optins', id);
      form({
        title: o.name,
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: [['new', 'New'], ['contacted', 'Contacted'], ['done', 'Done']], value: o.status || 'new' },
          { name: 'note', label: 'Team note', value: o.note, max: 200 },
        ],
        remove: () => deleteDoc(doc(db, 'optins', id)).then(() => log('opt-in delete', o.email)),
        removeLabel: 'Delete their contact',
        submit: (d) => updateDoc(doc(db, 'optins', id), { ...d, updatedBy: S.user.email }).then(() => 'Saved'),
      });
    }
    if (act === 'opt-csv')
      csv('app-contacts', [['Name', 'Email', 'Phone', 'Why', 'Work', 'Promo code', 'Language', 'Mode', 'App version', 'When', 'Status'], ...list('optins').map((o) => [o.name, o.email, o.phone, o.why, o.profession, o.code, o.lang, o.mode, o.app, toDate(o.at)?.toISOString(), o.status || 'new'])]);
    if (act === 'fb-status') {
      await updateDoc(doc(db, 'feedback', id), { status: b.dataset.to, updatedBy: S.user.email, updatedAt: serverTimestamp() });
      log('feedback', `${b.dataset.to}: ${byId('feedback', id)?.text.slice(0, 60)}`);
    }
    if (act === 'fb-note') {
      const f = byId('feedback', id);
      form({ title: 'Team note', fields: [{ name: 'note', label: f.text.slice(0, 120), value: f.note, max: 300 }], submit: (d) => updateDoc(doc(db, 'feedback', id), { note: d.note, updatedBy: S.user.email, updatedAt: serverTimestamp() }).then(() => 'Saved') });
    }
    if (act === 'fb-task') {
      const f = byId('feedback', id);
      taskForm(null);
      $('#dlg-form').elements.title.value = `${FB_KIND[f.kind] || 'Feedback'}: ${f.text.slice(0, 80)}`;
      $('#dlg-form').elements.details.value = f.text;
    }
    if (act === 'fb-csv') csv('feedback', [['When', 'Kind', 'Status', 'Text', 'Contact', 'From', 'App', 'Language', 'Code'], ...list('feedback').map((f) => [toDate(f.at)?.toISOString(), f.kind, f.status || 'new', f.text, f.contact, f.from, f.app, f.lang, f.code])]);
    if (act === 'grant-new') grantForm();
    if (act === 'grant-edit') grantForm(byId('grants', id));
    if (act === 'grant-team') {
      const add = [OWNER, ...list('team').map((m) => m.id)].filter((e, i, a) => a.indexOf(e) === i && !list('grants').some((g) => g.id === e));
      const rows = add.map((email) => ({ id: email, limit: 0, products: 0, until: '', note: 'Team', by: S.user.email, at: serverTimestamp() }));
      for (const { id: email, ...g } of rows) await setDoc(doc(db, 'grants', email), g);
      await publishLimits([...list('grants'), ...rows]);
      log('limit team', `${rows.length} people`);
      toast(`Unlimited categories for ${rows.length} team members`);
    }
    if (act === 'promo-new') promoForm();
    if (act === 'promo-edit') promoForm(byId('promos', id));
    if (act === 'cost-new') costForm();
    if (act === 'cost-edit') costForm(byId('costs', id));
    if (act === 'cost-csv') csv('marketing-costs', [['Date', 'What', 'Amount', 'Channel', 'Campaign', 'Paid by', 'Note'], ...list('costs').map((c) => [c.date, c.what, c.amount, c.channel, c.campaign, c.paidBy, c.note])]);
    if (act === 'notice-edit') noticeForm(b.dataset.key);
    if (act === 'member-new') memberForm();
    if (act === 'member-edit') memberForm(byId('team', id));
  } catch (err) {
    toast(err.code === 'permission-denied' ? 'You do not have permission to do this.' : err.message);
  }
});

$('#main').addEventListener('change', (e) => {
  const map = { 'task-who': 'taskWho', range: 'range', 'place-month': 'placeMonth', 'opt-status': 'optStatus', 'lead-status': 'leadStatus', 'fb-status': 'fbStatus', 'fb-kind': 'fbKind', 'cost-month': 'costMonth' };
  if (map[e.target.id]) {
    S.filters[map[e.target.id]] = e.target.value;
    render();
  }
});
$('#main').addEventListener('input', (e) => {
  if (e.target.id === 'lead-q') {
    S.filters.leadQ = e.target.value;
    render();
  }
});
