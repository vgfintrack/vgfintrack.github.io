import * as C from './calc.js';
import * as R from './reports.js';
import { parseSms } from './sms.js';
import * as G from './guide.js';
import { createStore, DEFAULT_SETTINGS, newId } from './store.js';
import { t, tn, en, lang, setLang, dateLocale, translateStatic } from './i18n.js';

// ---------------------------------------------------------------- helpers

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const money = (n) => (Math.round(n) === 0 ? '0' : nf.format(Math.round(n)));
const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money2 = (n) => (Number.isInteger(n) ? nf.format(n) : n.toFixed(2));
// Exact amounts for balances: whole taka when possible, otherwise with paisa.
const moneyExact = (n) => {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? nf.format(r) : nf2.format(r);
};
const pct = (r) => (r == null || !isFinite(r) ? '—' : `${Math.round(r * 100)}%`);

function niceDate(s, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return C.parseDate(s).toLocaleDateString(dateLocale(), opts);
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 2600);
}

// ---------------------------------------------------------------- theme
// 'auto' follows the device; 'light' (Day) and 'dark' (Night) are forced.

const THEME_KEY = 'mt:theme';
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

function themePref() {
  try {
    return localStorage.getItem(THEME_KEY) || 'auto';
  } catch {
    return 'auto';
  }
}

const isDark = () => themePref() === 'dark' || (themePref() === 'auto' && darkQuery.matches);

function applyTheme(pref = themePref()) {
  try {
    if (pref === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {}
  if (pref === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = pref;
  const dark = isDark();
  const btn = $('#theme-btn');
  btn.innerHTML = dark ? SUN : MOON;
  btn.title = dark ? t('Switch to day mode') : t('Switch to night mode');
  if (state.data?.loaded && !$('#app').hidden) render(); // charts pick up the new colours
}

darkQuery.addEventListener('change', () => themePref() === 'auto' && applyTheme('auto'));

// ---------------------------------------------------------------- install (PWA)
// The app works offline through sw.js. Chrome/Android offer an install
// prompt we can trigger from a button; iPhone needs Share → Add to Home Screen.

let installPrompt = null;
const INSTALL_TIP_KEY = 'mt:install-tip';
const isInstalled = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Offline support unavailable', e)));
}
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  if (state.data?.loaded && !$('#app').hidden) render();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  markGuide('install');
  toast(t('AmrPotli is installed. Open it from your home screen.'));
  if (state.data?.loaded) render();
});

async function installApp() {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => null);
  installPrompt = null;
  render();
}

function installTipDismissed() {
  try {
    return localStorage.getItem(INSTALL_TIP_KEY) === 'no';
  } catch {
    return false;
  }
}

// Setup card: install button, iPhone steps, or "installed".
function installCard() {
  let body;
  if (isInstalled()) body = `<p style="margin:0">✓ ${t('Installed on this device. It opens from your home screen, even offline.')}</p>`;
  else if (installPrompt)
    body = `<p class="muted" style="margin:0 0 10px;font-size:13px">${t('Open AmrPotli from your home screen like any app. It works offline too.')}</p>
      <button class="btn primary" data-install>${t('Install AmrPotli')}</button>`;
  else if (isIOS())
    body = `<p class="muted" style="margin:0;font-size:13px">${t('On iPhone: tap the Share button in Safari, then "Add to Home Screen".')}</p>`;
  else body = `<p class="muted" style="margin:0;font-size:13px">${t('Open your browser menu (⋮) and choose "Install app" or "Add to Home screen".')}</p>`;
  return `<div class="card" id="install-card"><h3>${t('Install the app')}</h3>${body}</div>`;
}

// One-time Dashboard tip when the browser can install the app.
function installTip() {
  if (isInstalled() || !installPrompt || installTipDismissed()) return '';
  return `<div class="card install-tip">
    <img src="icons/icon.svg" alt="" width="40" height="40">
    <div><strong>${t('Install AmrPotli')}</strong>
      <div class="muted" style="font-size:13px">${t('One tap from your home screen, even without internet.')}</div></div>
    <div class="tip-actions"><button class="btn sm" data-install-later>${t('Not now')}</button><button class="btn primary sm" data-install>${t('Install')}</button></div>
  </div>`;
}

function bindInstall(root) {
  $$('[data-install]', root).forEach((b) => (b.onclick = installApp));
  $$('[data-install-later]', root).forEach(
    (b) =>
      (b.onclick = () => {
        try {
          localStorage.setItem(INSTALL_TIP_KEY, 'no');
        } catch {}
        render();
      }),
  );
}

// ---------------------------------------------------------------- state

const state = {
  store: null,
  user: null,
  data: { accounts: [], transactions: [], settings: null, loaded: false },
  view: 'dashboard',
  period: 'month',
  ref: C.today(),
  txFilter: { month: C.today().slice(0, 7), type: '', account: '', q: '' },
  charts: {},
};

const settings = () => state.data.settings || DEFAULT_SETTINGS;
const accounts = () => [...state.data.accounts].sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
const accById = (id) => state.data.accounts.find((a) => a.id === id);
const accName = (id) => accById(id)?.name ?? t('(deleted account)');
// For loan wording: "Lent to JC vai" reads as "JC vai" in "JC vai paid back".
const personName = (id) => accName(id).replace(/^(lent to|loan from|borrowed from|loan to)\s+/i, '');

// ---------------------------------------------------------------- boot

async function boot() {
  state.store = await createStore();
  if (state.store.mode === 'demo') $('#demo-banner').hidden = false;
  let unsub = null;

  state.store.onAuth((user, error) => {
    state.user = user;
    $('#login-error').textContent = error || '';
    $('#login-error').hidden = !error;
    unsub?.();
    $('#loading').hidden = true;
    if (!user) {
      $('#login').hidden = false;
      $('#app').hidden = true;
      return;
    }
    $('#login').hidden = true;
    $('#app').hidden = false;
    renderAvatar();
    unsub = state.store.subscribe((data) => {
      state.data = data;
      if (data.loaded) render();
      else renderLoading();
    });
  });

  $('#btn-signin').onclick = async () => {
    $('#login-error').hidden = true;
    try {
      await state.store.signIn();
    } catch (e) {
      if (e.type === 'popup_closed') return;
      $('#login-error').textContent =
        e.type === 'popup_failed_to_open' ? t('Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.') : e.message || String(e);
      $('#login-error').hidden = false;
    }
  };

  state.store.onStatus(renderSync);
  $('#sync').onclick = async () => {
    try {
      await state.store.syncNow();
    } catch (e) {
      if (e.type !== 'popup_closed') toast(e.message || t('Could not connect to Google Drive'));
    }
  };

  $$('.tabbar button').forEach((b) => (b.onclick = () => switchView(b.dataset.view)));
  $('#fab').onclick = () => openTxn();
  $('#add-top').onclick = () => openTxn();
  $('#theme-btn').onclick = () => applyTheme(isDark() ? 'light' : 'dark');
  $$('[data-lang]').forEach((b) => (b.onclick = () => applyLang(b.dataset.lang)));
  applyLang(lang);
  applyTheme();
  $('#btn-user').onclick = () => switchView('setup');
  $$('dialog [data-close]').forEach((b) => (b.onclick = () => b.closest('dialog').close()));
  setupTxnDialog();
  setupAccountDialog();
}

function renderAvatar() {
  const u = state.user;
  const btn = $('#btn-user');
  btn.innerHTML = u.photoURL
    ? `<img src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">`
    : esc((u.displayName || u.email || '?')[0].toUpperCase());
}

const SYNC_LABELS = {
  synced: ['✓ Saved to Drive', 'ok'],
  syncing: ['Syncing…', ''],
  tap: ['Tap to sync', ''],
  unsynced: ['Not synced · tap', 'warn'],
  offline: ['Offline · saved on this device', 'warn'],
  error: ['Sync failed · tap to retry', 'bad'],
};
let syncStatus = 'idle';

// Switches English / Bangla and redraws everything on screen.
function applyLang(l) {
  setLang(l);
  translateStatic();
  $$('[data-lang]').forEach((b) => b.classList.toggle('active', b.dataset.lang === l));
  renderSync(syncStatus);
  if (state.store && !$('#app').hidden) {
    applyTheme();
    if (state.data.loaded) render();
  }
}

function renderSync(status) {
  syncStatus = status;
  const btn = $('#sync');
  const [label, cls] = SYNC_LABELS[status] || [];
  btn.hidden = !label;
  if (!label) return;
  btn.textContent = t(label);
  btn.className = `sync ${cls}`;
  btn.disabled = status === 'syncing';
}

// The add button belongs to Dashboard and Transactions, not Setup.
function showAddButton(show) {
  $('#fab').hidden = !show;
  $('#add-top').hidden = !show;
}

function renderLoading() {
  showAddButton(false);
  $$('.view').forEach((s) => (s.hidden = s.id !== 'view-dashboard'));
  $('#view-dashboard').innerHTML = `
    <div class="card" style="max-width:520px;margin:24px auto;display:grid;gap:12px;justify-items:center;text-align:center">
      <div class="spinner"></div>
      <p style="margin:0">${t('Loading your data from Google Drive…')}</p>
      <p class="muted" style="margin:0;font-size:13px">${t('If this takes long, tap the sync button at the top.')}</p>
    </div>`;
}

function switchView(v) {
  state.view = v;
  $$('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  $$('.view').forEach((s) => (s.hidden = s.id !== `view-${v}`));
  render();
  window.scrollTo({ top: 0 });
}

function render() {
  const empty = !state.data.settings && state.data.accounts.length === 0 && state.data.transactions.length === 0;
  const onboarding = empty || wizard?.isCelebrating();
  document.body.classList.toggle('onboarding', !!onboarding);
  showAddButton(!onboarding && (state.view === 'dashboard' || state.view === 'transactions'));
  if (onboarding) return renderWelcome();
  G.noticeProgress(state.data, guideFlags(), toast);
  $$('.view').forEach((s) => (s.hidden = s.id !== `view-${state.view}`));
  if (state.view === 'dashboard') renderDashboard();
  if (state.view === 'transactions') renderTransactions();
  if (state.view === 'reports') renderReports();
  if (state.view === 'setup') renderSetup();
}

// ---------------------------------------------------------------- welcome

// New users get a step-by-step setup (onboarding.js). It is loaded only here,
// so people who already have data never download it.
let wizard = null;

async function renderWelcome() {
  $$('.view').forEach((s) => (s.hidden = s.id !== 'view-dashboard'));
  if (!wizard) {
    renderLoading();
    showAddButton(false);
    wizard = await import('./onboarding.js');
  }
  wizard.renderWizard($('#view-dashboard'), {
    user: state.user,
    save: (d) => state.store.importAll(d),
    importFile,
    setLang: applyLang,
    done: (next) => {
      switchView('dashboard');
      if (next === 'expense') {
        txnType = 'Expense';
        openTxn();
      }
    },
  });
}

// ---------------------------------------------------------------- getting-started guide

const guideFlags = () => ({ installed: isInstalled() });

// Remembers a guide step that leaves no data behind (report, install).
function markGuide(id) {
  const s = state.data.settings;
  if (!s?.onboarding || s.onboarding.done?.[id]) return;
  state.store.saveSettings({ ...s, onboarding: { ...s.onboarding, done: { ...s.onboarding.done, [id]: true } } });
}

function showGuide(on) {
  const s = settings();
  return state.store.saveSettings({ ...s, onboarding: { done: {}, ...s.onboarding, hidden: !on } });
}

function guideAction(id) {
  const scrollTo = (sel) => setTimeout(() => $(sel)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  if (id === 'expense' || id === 'income') {
    txnType = id === 'expense' ? 'Expense' : 'Income';
    openTxn();
  } else if (id === 'sms') {
    txnType = 'Expense';
    openTxn();
    openSmsPanel();
  } else if (id === 'budget') {
    switchView('setup');
    scrollTo('#budgets-card');
    setTimeout(() => $('#budgets-card [data-budget]')?.focus({ preventScroll: true }), 400);
  } else if (id === 'install') {
    if (installPrompt) installApp();
    else {
      switchView('setup');
      scrollTo('#install-card');
    }
  } else if (id === 'report') switchView('reports');
}

// ---------------------------------------------------------------- dashboard

function currentRange() {
  return state.period === 'month' ? C.monthRange(state.ref) : C.weekRange(state.ref);
}

function rangeLabel(r) {
  if (state.period === 'month') return niceDate(r.start, { month: 'long', year: 'numeric' });
  return `${niceDate(r.start, { day: 'numeric', month: 'short' })} – ${niceDate(r.end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function shiftPeriod(dir) {
  const r = currentRange();
  if (state.period === 'week') state.ref = C.addDays(r.start, 7 * dir);
  else {
    const d = C.parseDate(r.start);
    state.ref = C.fmtDate(new Date(d.getFullYear(), d.getMonth() + dir, 1, 12));
  }
  renderDashboard();
}

function budgetClass(ratio) {
  return ratio > 1 ? 'bad' : ratio >= 0.8 ? 'warn' : 'ok';
}

function renderDashboard() {
  const txns = state.data.transactions;
  const accs = accounts();
  const s = settings();
  const r = currentRange();
  const month = C.monthRange(state.ref);
  const isWeek = state.period === 'week';
  const st = C.periodStats(r, txns, accs);
  const w = C.worth(accs, txns);
  const goal = isWeek ? C.weeklyGoal(s.savingsGoal || 0, r.start) : s.savingsGoal || 0;
  const goalRatio = goal > 0 ? st.net / goal : null;
  const spent = C.sumBy(r, txns, 'Expense');
  const monthSpent = isWeek ? C.sumBy(month, txns, 'Expense') : spent;
  const income = C.sumBy(r, txns, 'Income');
  const totalBudget = s.expenseCategories.reduce((a, c) => a + (Number(c.budget) || 0), 0);

  const rateText =
    st.savingsRate == null ? '—' : st.savingsRate < -1 ? t('below −100%') : pct(st.savingsRate);
  const rateSub = isWeek ? t('Tuition is paid monthly, so check the month view') : t('of income kept');

  const byType = (t) => accs.filter((a) => a.type === t);
  const accRows = (list, sign = '') =>
    list
      .map(
        (a) => `<div class="li"><span class="name">${esc(a.name)}</span>
        <span class="num">${sign}${moneyExact(w.balances[a.id].value)}</span></div>`,
      )
      .join('');

  const cats = [...s.expenseCategories];
  for (const name of Object.keys(spent)) if (!cats.some((c) => c.name === name)) cats.push({ name, budget: 0 });

  const recent = [...txns].sort(txnSort).slice(0, 5);
  const guide = G.guideOn(state.data) ? G.guideCard(state.data, guideFlags()) : '';
  const importCard = txns.length || guide
    ? ''
    : `<div class="card" style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap">
        <div><strong>${t('No transactions yet')}</strong>
          <div class="muted" style="font-size:13px">${t('Have a backup or your spreadsheet data file? Import it here.')}</div></div>
        <label class="btn primary">${t('Import .json file')}
          <input type="file" accept=".json,application/json" id="dash-import" hidden></label>
      </div>`;

  $('#view-dashboard').innerHTML = `
    ${G.streakPill(txns, C.today())}
    ${guide}
    ${guide ? '' : installTip()}
    ${importCard}
    <div class="periodbar">
      <div class="segmented" id="period-seg">
        <button data-p="month" class="${!isWeek ? 'active' : ''}">${t('Month')}</button>
        <button data-p="week" class="${isWeek ? 'active' : ''}">${t('Week')}</button>
      </div>
      <div class="stepper">
        <button class="icon-btn" id="prev" aria-label="${t('Previous')}">‹</button>
        <span class="label">${rangeLabel(r)}</span>
        <button class="icon-btn" id="next" aria-label="${t('Next')}">›</button>
      </div>
    </div>

    <div class="kpis">
      <div class="kpi"><div class="k">${t('Income')}</div><div class="v num income">${money(st.income)}</div>
        <div class="s">${tn(Object.keys(income).length, '{n} source', '{n} sources')}</div></div>
      <div class="kpi"><div class="k">${t('Expenses')}</div><div class="v num expense">${money(st.expenses)}</div>
        <div class="s">${t('{amount} / day', { amount: money(st.avgPerDay) })}</div></div>
      <div class="kpi"><div class="k">${t('Net saved')}</div><div class="v num">${money(st.net)}</div>
        <div class="s">${st.toInvestments ? t('{amount} into investments', { amount: money(st.toInvestments) }) : t('Income minus expenses')}</div></div>
      <div class="kpi"><div class="k">${t('Savings rate')}</div><div class="v num">${rateText}</div>
        <div class="s">${rateSub}</div></div>
    </div>

    ${
      goal > 0
        ? `<div class="card">
      <h3>${isWeek ? t('Weekly savings goal') : t('Monthly savings goal')} <small class="num">${t('{a} of {b}', { a: money(Math.max(st.net, 0)), b: money(goal) })}</small></h3>
      <div class="progress ${goalRatio >= 1 ? 'ok' : ''}"><div style="width:${Math.max(0, Math.min(100, (goalRatio || 0) * 100))}%"></div></div>
      <div class="muted" style="font-size:12px;margin-top:6px">${
        goalRatio >= 1 ? t('Goal reached 🎉') : st.net < 0 ? t('Spending more than earning in this period') : t('{pct} there, {amount} to go', { pct: pct(goalRatio), amount: money(goal - st.net) })
      }</div></div>`
        : ''
    }

    <div class="grid2">
      <div class="card">
        <h3>${t('Where my money is')}</h3>
        <div class="networth"><span class="muted">${t('Net worth')}</span><span class="v num">${money(w.netWorth)}</span></div>
        <div class="buckets">
          <div class="bucket"><div class="k">${t('Spendable now')}</div><div class="v num">${money(w.liquid)}</div></div>
          <div class="bucket"><div class="k">${t('Lent to others')}</div><div class="v num">${money(w.lent)}</div></div>
          <div class="bucket"><div class="k">${t('Investments')}</div><div class="v num">${money(w.investments)}</div></div>
          <div class="bucket"><div class="k">${t('I owe')}</div><div class="v num">${money(w.debt)}</div></div>
        </div>
        <div class="list">
          ${accRows(byType('Liquid'))}${accRows(byType('Lend'))}${accRows(byType('Investment'))}${accRows(byType('Debt'), '−')}
        </div>
      </div>

      <div class="card">
        <h3>${t('Budget vs spending')} <small>${isWeek ? t('this month · this week') : t('{a} of {b}', { a: money(st.expenses), b: money(totalBudget) })}</small></h3>
        ${cats
          .filter((c) => (Number(c.budget) || 0) > 0 || monthSpent[c.name])
          .map((c) => {
            const b = Number(c.budget) || 0;
            const m = monthSpent[c.name] || 0;
            const ratio = b > 0 ? m / b : m > 0 ? 2 : 0;
            const left = b - m;
            return `<div class="budget">
              <div class="top"><span>${esc(c.name)}</span>
                <span class="r num">${money(m)} / ${money(b)}${isWeek ? ` · ${t('week {amount}', { amount: money(spent[c.name] || 0) })}` : ''}</span></div>
              <div class="progress ${budgetClass(ratio)}"><div style="width:${Math.min(100, ratio * 100)}%"></div></div>
              <div class="left ${left < 0 ? 'bad' : ''}">${left < 0 ? t('Over by {amount}', { amount: money(-left) }) : t('{amount} left', { amount: money(left) })}</div>
            </div>`;
          })
          .join('') || `<p class="muted">${t('Set monthly budgets in Setup.')}</p>`}
      </div>

      ${loansCard(accs, w)}

      <div class="card">
        <h3>${isWeek ? t('Day by day') : t('Daily spending')}</h3>
        <div class="chart-box"><canvas id="chart-daily"></canvas></div>
      </div>

      <div class="card">
        <h3>${t('Last 6 months')}</h3>
        <div class="chart-box"><canvas id="chart-months"></canvas></div>
      </div>

      <div class="card">
        <h3>${t('Income by source')}</h3>
        <div class="list">
          ${
            Object.entries(income)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => `<div class="li"><span class="name">${esc(k)}</span><span class="num income">${money(v)}</span></div>`)
              .join('') || `<p class="muted" style="margin:0">${t('No income in this period.')}</p>`
          }
        </div>
      </div>

      ${investmentsCard(accs, txns, w, month)}

      <div class="card span2">
        <h3>${t('Recent')} <button class="linkish" id="see-all">${t('See all')}</button></h3>
        ${recent.map(txnRow).join('') || `<p class="muted">${t('No transactions yet. Tap + to add one.')}</p>`}
      </div>
    </div>`;

  $$('#period-seg button').forEach(
    (b) => (b.onclick = () => ((state.period = b.dataset.p), renderDashboard())),
  );
  $('#prev').onclick = () => shiftPeriod(-1);
  $('#next').onclick = () => shiftPeriod(1);
  $('#see-all').onclick = () => switchView('transactions');
  bindInstall($('#view-dashboard'));
  $$('[data-guide]').forEach((b) => (b.onclick = () => guideAction(b.dataset.guide)));
  $$('[data-guide-hide]').forEach(
    (b) =>
      (b.onclick = () => {
        showGuide(false);
        toast(t('Guide hidden. You can show it again in Setup.'));
      }),
  );
  $$('#view-dashboard [data-loan]').forEach((b) => (b.onclick = () => openTxn(null, { loan: b.dataset.loan, person: b.dataset.person || undefined })));
  if ($('#dash-import')) $('#dash-import').onchange = (e) => importFile(e.target.files[0]);
  bindTxnRows($('#view-dashboard'));
  drawCharts(r, txns, accs);
}

function dueText(a) {
  if (!a.dueDate) return '';
  const d = C.daysUntil(a.dueDate);
  if (d < 0) return `<span class="due bad">${tn(-d, 'Overdue by {n} day', 'Overdue by {n} days')}</span>`;
  if (d === 0) return `<span class="due warn">${t('Due today')}</span>`;
  if (d <= 7) return `<span class="due warn">${tn(d, 'Due in {n} day', 'Due in {n} days')}</span>`;
  return `<span class="due">${t('Due {date}', { date: niceDate(a.dueDate, { day: 'numeric', month: 'short', year: 'numeric' }) })}</span>`;
}

// Who I owe and who owes me, with one-tap repay / got-back buttons.
function loansCard(accs, w) {
  const open = (type) => accs.filter((a) => a.type === type && w.balances[a.id].value > 0.004);
  const debts = open('Debt');
  const lends = open('Lend');
  const planText = (a) => {
    const p = a.type === 'Debt' ? planInfo(a) : null;
    return p && !p.done ? t('Installment {k} of {n} · next {amount}', { k: p.k, n: p.n, amount: money2(Math.round((p.principal + p.interest) * 100) / 100) }) : '';
  };
  const row = (a, action, label) => `<div class="li">
      <span class="mid" style="min-width:0"><div class="name">${esc(a.name)}</div>
        <div class="sub">${[planText(a), dueText(a)].filter(Boolean).join(' · ')}</div></span>
      <span class="num" style="margin-left:auto">${moneyExact(w.balances[a.id].value)}</span>
      <button class="btn sm" data-loan="${action}" data-person="${esc(a.id)}">${label}</button>
    </div>`;
  const section = (title, list, action, label, total) =>
    list.length
      ? `<div class="loan-sec"><div class="loan-head"><span>${title}</span><span class="num">${moneyExact(total)}</span></div>
         <div class="list">${list.map((a) => row(a, action, label)).join('')}</div></div>`
      : '';
  const body =
    section(t('I owe'), debts, 'repay', t('Repay'), w.debt) + section(t('Owed to me'), lends, 'collect', t('Got back'), w.lent) ||
    `<p class="muted" style="margin:0 0 10px">${t('No open loans. Borrowed money, or lent some to a friend? Add it here.')}</p>`;
  return `<div class="card">
    <h3>${t('Loans')} <span><button class="btn sm" data-loan="borrow">${t('+ Borrowed')}</button> <button class="btn sm" data-loan="lend">${t('+ Lent')}</button></span></h3>
    ${body}
  </div>`;
}

function investmentsCard(accs, txns, w, month) {
  const inv = accs.filter((a) => a.type === 'Investment');
  if (!inv.length) return '';
  return `<div class="card">
    <h3>${t('Investments')} <small>${niceDate(month.start, { month: 'short', year: 'numeric' })}</small></h3>
    <div class="table-wrap"><table>
      <tr><th>${t('Account')}</th><th>${t('Put in')}</th><th>${t('Value')}</th><th>${t('Gain')}</th><th>${t('Added')}</th><th>${t('Target')}</th></tr>
      ${inv
        .map((a) => {
          const b = w.balances[a.id];
          const added = C.netAdded(month, txns, a.id);
          const target = Number(a.monthlyTarget) || 0;
          const status = target ? `<span class="pill ${added >= target ? 'ok' : 'warn'}">${added >= target ? t('Paid') : t('{amount} due', { amount: money(target - added) })}</span>` : '—';
          const gain = b.value - b.book;
          return `<tr><td>${esc(a.name)}</td><td class="num">${money(b.book)}</td><td class="num">${money(b.value)}</td>
            <td class="num ${gain > 0 ? 'income' : gain < 0 ? 'expense' : ''}">${gain ? money(gain) : '—'}</td>
            <td class="num">${added ? money(added) : '—'}</td><td>${status}</td></tr>`;
        })
        .join('')}
    </table></div></div>`;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawCharts(r, txns, accs) {
  if (!window.Chart) return;
  Object.values(state.charts).forEach((c) => c.destroy());
  const grid = cssVar('--line');
  const muted = cssVar('--muted');
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { labels: { color: muted, boxWidth: 12 } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${money(c.parsed.y)}` } } },
    scales: {
      x: { grid: { display: false }, ticks: { color: muted, maxRotation: 0, autoSkipPadding: 8 } },
      y: { grid: { color: grid }, ticks: { color: muted, callback: (v) => money(v) }, beginAtZero: true },
    },
  };
  const days = C.dailySeries(r, txns);
  const isWeek = state.period === 'week';
  const dailySets = [{ label: t('Expenses'), data: days.map((d) => d.expenses), backgroundColor: cssVar('--expense'), borderRadius: 4 }];
  if (isWeek) dailySets.unshift({ label: t('Income'), data: days.map((d) => d.income), backgroundColor: cssVar('--income'), borderRadius: 4 });
  state.charts.daily = new Chart($('#chart-daily'), {
    type: 'bar',
    data: {
      labels: days.map((d) => (isWeek ? niceDate(d.date, { weekday: 'short' }) : C.parseDate(d.date).getDate())),
      datasets: dailySets,
    },
    options: { ...base, plugins: { ...base.plugins, legend: { display: isWeek, labels: base.plugins.legend.labels } } },
  });
  const months = C.monthlySeries(C.monthRange(state.ref).start, 6, txns, accs);
  state.charts.months = new Chart($('#chart-months'), {
    type: 'bar',
    data: {
      labels: months.map((m) => C.parseDate(m.start).toLocaleDateString(dateLocale(), { month: 'short' })),
      datasets: [
        { label: t('Income'), data: months.map((m) => m.income), backgroundColor: cssVar('--income'), borderRadius: 4 },
        { label: t('Expenses'), data: months.map((m) => m.expenses), backgroundColor: cssVar('--expense'), borderRadius: 4 },
      ],
    },
    options: base,
  });
}

// ---------------------------------------------------------------- transactions list

function txnSort(a, b) {
  return b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0);
}

// What a transfer means for loans: borrow, repay, lend or collect. Older
// entries without `loan` are recognised from the account types.
function loanActionOf(t) {
  if (t.type !== 'Transfer') return null;
  if (t.loan) return t.loan;
  const from = accById(t.account)?.type;
  const to = accById(t.toAccount)?.type;
  if (from === 'Debt') return 'borrow';
  if (to === 'Debt') return 'repay';
  if (to === 'Lend') return 'lend';
  if (from === 'Lend') return 'collect';
  return null;
}

// Plain-language title and detail line for a transaction. `L` is the
// translator: the screen uses t(), reports pass en() to stay in English.
function describeTxn(x, L = t) {
  const isT = x.type === 'Transfer';
  const loan = loanActionOf(x);
  const loanTitle = {
    borrow: () => L('Borrowed from {name}', { name: personName(x.account) }),
    repay: () => L('Repaid {name}', { name: personName(x.toAccount) }),
    lend: () => L('Lent to {name}', { name: personName(x.toAccount) }),
    collect: () => L('{name} paid back', { name: personName(x.account) }),
  }[loan];
  const title = loanTitle ? loanTitle() : isT ? `${accName(x.account)} → ${accName(x.toAccount)}` : x.category;
  const moneyAcc = loan === 'borrow' || loan === 'collect' ? x.toAccount : x.account;
  const feeWord = x.feeCategory === C.INTEREST_CATEGORY ? L('interest {amount}', { amount: money2(Number(x.fee)) }) : L('charge {amount}', { amount: money2(Number(x.fee)) });
  const sub = [
    loan ? `${L('Loan')} · ${accName(moneyAcc)}` : isT ? L('Transfer') : accName(x.account),
    Number(x.fee) && x.type !== 'Income' ? feeWord : '',
    x.note,
  ]
    .filter(Boolean)
    .join(' · ');
  return { title, sub };
}

function txnRow(t) {
  const { title, sub } = describeTxn(t);
  const cls = t.type === 'Income' ? 'income' : t.type === 'Expense' ? 'expense' : 'transfer';
  const sign = t.type === 'Income' ? '+' : t.type === 'Expense' ? '−' : '';
  const icon = t.type === 'Income' ? '↓' : t.type === 'Expense' ? '↑' : '⇄';
  return `<button class="txn" data-id="${esc(t.id)}">
    <span class="ic ${cls}">${icon}</span>
    <span class="mid"><div class="t">${esc(title)}</div><div class="sub">${esc(sub)}</div></span>
    <span class="amt num ${cls}">${sign}${money(t.amount)}</span></button>`;
}

function bindTxnRows(root) {
  $$('.txn', root).forEach((el) => (el.onclick = () => openTxn(state.data.transactions.find((t) => t.id === el.dataset.id))));
}

function renderTransactions() {
  const f = state.txFilter;
  const q = f.q.trim().toLowerCase();
  const list = state.data.transactions
    .filter((t) => !f.month || t.date.startsWith(f.month))
    .filter((t) => !f.type || (f.type === 'Loan' ? !!loanActionOf(t) : t.type === f.type))
    .filter((t) => !f.account || t.account === f.account || t.toAccount === f.account)
    .filter(
      (t) =>
        !q ||
        [t.category, t.note, accName(t.account), t.toAccount && accName(t.toAccount), String(t.amount)]
          .join(' ')
          .toLowerCase()
          .includes(q),
    )
    .sort(txnSort);

  let inc = 0, exp = 0;
  for (const t of list) {
    if (t.type === 'Income') inc += Number(t.amount);
    if (t.type === 'Expense') exp += Number(t.amount);
  }

  const groups = [];
  for (const t of list) {
    if (!groups.length || groups.at(-1).date !== t.date) groups.push({ date: t.date, items: [] });
    groups.at(-1).items.push(t);
  }
  const dayTotal = (items) => items.filter((t) => t.type === 'Expense').reduce((a, t) => a + Number(t.amount), 0);

  const focused = document.activeElement?.id;
  $('#view-transactions').innerHTML = `
    <div class="card" style="display:grid;gap:10px">
      <div class="filters">
        <input type="month" id="f-month" value="${esc(f.month)}" aria-label="${t('Month')}">
        <select id="f-type" aria-label="${t('Type')}">
          <option value="">${t('All types')}</option>
          ${[['Expense', 'Expense'], ['Income', 'Income'], ['Transfer', 'Transfer'], ['Loan', 'Loans']]
            .map(([v, l]) => `<option value="${v}" ${f.type === v ? 'selected' : ''}>${t(l)}</option>`)
            .join('')}
        </select>
        <select id="f-account" aria-label="${t('Account')}">
          <option value="">${t('All accounts')}</option>
          ${accounts().map((a) => `<option value="${esc(a.id)}" ${f.account === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
        </select>
        <input type="search" id="f-q" placeholder="${t('Search notes, categories…')}" value="${esc(f.q)}">
      </div>
      <div class="muted num" style="font-size:13px">${tn(list.length, '{n} transaction', '{n} transactions')} ·
        <span class="income">+${money(inc)}</span> · <span class="expense">−${money(exp)}</span>
        ${f.month ? `· <button class="linkish" id="f-all">${t('Show all months')}</button>` : ''}</div>
    </div>
    <div>
      ${
        groups
          .map(
            (g) => `<div class="day-head"><span>${niceDate(g.date, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span class="num">${dayTotal(g.items) ? `−${money(dayTotal(g.items))}` : ''}</span></div>
            ${g.items.map(txnRow).join('')}`,
          )
          .join('') || `<div class="empty">${t('No transactions match.')}</div>`
      }
    </div>`;

  const v = $('#view-transactions');
  $('#f-month', v).onchange = (e) => ((f.month = e.target.value), renderTransactions());
  $('#f-type', v).onchange = (e) => ((f.type = e.target.value), renderTransactions());
  $('#f-account', v).onchange = (e) => ((f.account = e.target.value), renderTransactions());
  $('#f-q', v).oninput = (e) => ((f.q = e.target.value), renderTransactions());
  if ($('#f-all', v)) $('#f-all', v).onclick = () => ((f.month = ''), renderTransactions());
  if (focused === 'f-q') {
    const el = $('#f-q', v);
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }
  bindTxnRows(v);
}

// ---------------------------------------------------------------- transaction dialog

let editing = null;
let txnType = 'Expense';
let smsRef = ''; // transaction ID from a pasted SMS, saved with the entry

function setupTxnDialog() {
  $$('#txn-type button').forEach((b) => (b.onclick = () => setTxnType(b.dataset.type)));
  $('#txn-form').onsubmit = (e) => {
    e.preventDefault();
    saveTxn(false);
  };
  $('#txn-save-another').onclick = () => saveTxn(true);
  $('#txn-delete').onclick = async () => {
    if (!editing || !confirm(t('Delete this transaction?'))) return;
    await state.store.deleteTxn(editing.id);
    $('#txn-dialog').close();
    toast(t('Deleted'));
  };
  $('#txn-account').onchange = updateTxnHint;
  $('#txn-to').onchange = updateTxnHint;
  $('#txn-loan').onchange = () => fillLoanFields();
  $('#txn-person').onchange = () => ($('#txn-person').value === '__new' ? addLoanPerson() : fillLoanFields());
  $('#txn-category').onchange = updateTxnHint;
  $('#txn-amount').oninput = () => {
    delete $('#txn-amount').dataset.auto;
    updateFeeSuggestion();
  };
  $('#txn-fee').oninput = updateTxnHint;
  $('#txn-plan-count').oninput = updateTxnHint;
  $('#txn-plan-interest').oninput = updateTxnHint;
  $('#sms-btn').onclick = openSmsPanel;
  $('#sms-cancel').onclick = () => ($('#sms-panel').hidden = true);
  $('#sms-read').onclick = () => fillFromSms($('#sms-text').value);
  $('#txn-fee-suggest').onclick = () => {
    $('#txn-fee').value = $('#txn-fee-suggest').dataset.fee;
    updateTxnHint();
  };
}

// ---- paste SMS: the form is filled for the user to check, never saved automatically.

async function openSmsPanel() {
  $('#sms-panel').hidden = false;
  $('#sms-text').value = '';
  $('#sms-text').focus();
  try {
    const clip = await navigator.clipboard?.readText?.();
    if (clip && /(?:Tk|BDT|৳)\s*[\d,]/i.test(clip)) {
      $('#sms-text').value = clip;
      fillFromSms(clip);
    }
  } catch {
    // no clipboard permission: the user pastes into the box instead
  }
}

function showSmsInfo(html, warn = false) {
  const el = $('#sms-info');
  el.innerHTML = html;
  el.className = `sms-info${warn ? ' warn' : ''}`;
  el.hidden = false;
}

function fillFromSms(text) {
  const accs = accounts();
  const r = parseSms(text, accs);
  if (!r) return showSmsInfo(t("Couldn't read this SMS. Copy the whole message and try again, or fill the form yourself."), true);
  setTxnType(r.type);
  $('#txn-amount').value = r.amount;
  $('#txn-fee').value = r.fee || '';
  $('#txn-date').value = r.date || C.today();
  const pick = (sel, id) => id && [...$(sel).options].some((o) => o.value === id) && ($(sel).value = id);
  pick('#txn-account', r.account);
  if (r.type === 'Transfer') pick('#txn-to', r.toAccount);
  if (r.category) pick('#txn-category', r.category);
  $('#txn-note').value = [t(r.kind), r.counterparty].filter(Boolean).join(' · ');
  smsRef = r.ref || '';
  $('#sms-panel').hidden = true;
  updateTxnHint();

  const lines = [`✓ ${t('Filled from the SMS. Check the details and tap Save.')}`];
  let warn = false;
  if (smsRef && state.data.transactions.some((x) => x.ref === smsRef)) {
    lines.push(`⚠️ ${t('This SMS seems to be added already (TrxID {ref}).', { ref: smsRef })}`);
    warn = true;
  }
  if (!r.account) {
    lines.push(`⚠️ ${t('No matching account found. Choose the account, or add it in Setup.')}`);
    warn = true;
  }
  // Compare the balance in the SMS with what AmrPotli will show after saving.
  const accId = r.balanceAccount && accById(r.balanceAccount) ? r.balanceAccount : null;
  if (r.balance != null && accId) {
    const now = C.worth(accs, state.data.transactions).balances[accId]?.value ?? 0;
    const draft = { type: r.type, account: $('#txn-account').value, toAccount: r.type === 'Transfer' ? $('#txn-to').value : null, amount: r.amount, fee: r.fee };
    const after = C.worth(accs, [...state.data.transactions, draft]).balances[accId]?.value ?? now;
    const name = accName(accId);
    if (Math.abs(after - r.balance) < 0.5) lines.push(`✓ ${t('{name} balance will match the SMS ({amount}).', { name, amount: moneyExact(r.balance) })}`);
    else {
      lines.push(`ℹ️ ${t('SMS says {name} balance is {sms}; AmrPotli will show {app}. Some entries may be missing.', { name, sms: moneyExact(r.balance), app: moneyExact(after) })}`);
      warn = true;
    }
  }
  showSmsInfo(lines.map(esc).join('<br>'), warn);
}

function fillSelect(sel, items, value) {
  sel.innerHTML = items.map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`).join('');
  if (value != null && items.some(([v]) => v === value)) sel.value = value;
}

// The Loan tab is a friendly front for transfers between a money account
// and a person/lender account (type Debt = I owe them, Lend = they owe me).
const LOAN = {
  borrow: { personType: 'Debt', person: 'Borrowed from', money: 'Received in', personIsFrom: true, due: true },
  repay: { personType: 'Debt', person: 'Repaid to', money: 'Paid from', personIsFrom: false, interest: true, due: true },
  lend: { personType: 'Lend', person: 'Lent to', money: 'Paid from', personIsFrom: false, due: true },
  collect: { personType: 'Lend', person: 'Paid back by', money: 'Received in', personIsFrom: true },
};
const FEE_LABEL = $('#txn-fee-label').dataset.i18nHtml;
// Display names for account types (stored values stay in English).
const TYPE_NAMES = { Liquid: 'Liquid', Lend: 'Lend', Investment: 'Investment', Debt: 'Debt' };

function fillLoanFields(x = null, preset = null) {
  const action = $('#txn-loan').value;
  const cfg = LOAN[action];
  const accs = accounts();
  const people = accs.filter((a) => a.type === cfg.personType);
  const prevPerson = $('#txn-person').value;
  const person = x ? (cfg.personIsFrom ? x.account : x.toAccount) : preset?.person ?? prevPerson;
  fillSelect(
    $('#txn-person'),
    [...people.map((a) => [a.id, a.name]), ['__new', cfg.personType === 'Debt' ? t('+ New lender (person, bank, bKash…)') : t('+ New person…')]],
    person,
  );
  // Money side: spendable accounts first, never another loan account.
  const order = (a) => (a.type === 'Liquid' ? 0 : 1);
  const moneyAccs = accs.filter((a) => a.type !== 'Debt' && a.type !== 'Lend').sort((a, b) => order(a) - order(b));
  const prevMoney = $('#txn-account').value;
  fillSelect(
    $('#txn-account'),
    moneyAccs.map((a) => [a.id, a.type === 'Liquid' ? a.name : `${a.name} (${t(TYPE_NAMES[a.type])})`]),
    x ? (cfg.personIsFrom ? x.toAccount : x.account) : prevMoney,
  );
  $('#txn-person-label').textContent = t(cfg.person);
  $('#txn-account-label').textContent = t(cfg.money);
  $('#txn-fee-field').hidden = !cfg.interest;
  $('#txn-fee-label').innerHTML = cfg.interest ? t('Interest or extra paid <span class="muted">(optional)</span>') : t(FEE_LABEL);
  $('#txn-due-field').hidden = !cfg.due;
  $('#txn-plan-field').hidden = action !== 'borrow';
  const acc = accById($('#txn-person').value);
  const plan = action === 'repay' && acc ? planInfo(acc) : null;
  $('#txn-due-label').innerHTML = t(
    action === 'repay' ? 'Next payment due <span class="muted">(optional)</span>'
    : action === 'borrow' ? 'Due date <span class="muted">(optional: first installment, or when it all must be paid)</span>'
    : 'Due date <span class="muted">(optional: when it should be paid back)</span>',
  );
  if (x) {
    $('#txn-due').value = action === 'repay' ? '' : acc?.dueDate || '';
    if (action === 'borrow' && acc?.plan?.txn === x.id) {
      $('#txn-plan-count').value = acc.plan.count;
      $('#txn-plan-interest').value = acc.plan.interest || '';
    }
  } else if (action === 'repay') {
    // Next due date moves one month on, unless this is the last installment.
    $('#txn-due').value = acc?.dueDate && !(plan && plan.k >= plan.n) ? C.addMonths(acc.dueDate, 1) : '';
    const amt = $('#txn-amount');
    if (plan && !plan.done && (amt.value === '' || amt.dataset.auto === '1')) {
      amt.value = plan.principal;
      amt.dataset.auto = '1';
      $('#txn-fee').value = plan.interest || '';
    }
  } else if (cfg.due) $('#txn-due').value = acc?.dueDate || '';
  updateTxnHint();
}

// Installment plan of a loan account: which installment is next and how much.
function planInfo(acc) {
  const p = acc.plan;
  if (!p?.count) return null;
  const paid = state.data.transactions.filter((t) => t.toAccount === acc.id && loanActionOf(t) === 'repay' && t.date >= p.date).length;
  const owed = C.worth(accounts(), state.data.transactions).balances[acc.id]?.value ?? 0;
  const per = Math.round((p.principal / p.count) * 100) / 100;
  const k = paid + 1;
  return {
    k,
    n: p.count,
    done: owed <= 0.004 || k > p.count,
    principal: k >= p.count ? Math.round(owed * 100) / 100 : Math.min(per, Math.round(owed * 100) / 100),
    interest: Math.round(((p.interest || 0) / p.count) * 100) / 100,
  };
}

// Creates a lender/borrower account from inside the form.
async function addLoanPerson() {
  const cfg = LOAN[$('#txn-loan').value];
  const name = prompt(cfg.personType === 'Debt' ? t('Who did you borrow from? (a person, bank, bKash…)') : t('Who did you lend to?'))?.trim();
  if (!name) {
    const first = $('#txn-person').options[0]?.value;
    $('#txn-person').value = first && first !== '__new' ? first : '__new';
    return fillLoanFields();
  }
  const existing = state.data.accounts.find((a) => a.type === cfg.personType && a.name.toLowerCase() === name.toLowerCase());
  const id = existing?.id || newId();
  if (!existing) await state.store.saveAccount({ id, name, type: cfg.personType, opening: 0, order: state.data.accounts.length + 1 });
  fillLoanFields(null, { person: id });
}

function setTxnType(type, x = null, preset = null) {
  txnType = type;
  $$('#txn-type button').forEach((b) => b.classList.toggle('active', b.dataset.type === type));
  const s = settings();
  const accs = accounts();
  const isT = type === 'Transfer';
  const isLoan = type === 'Loan';
  $('#txn-loan-field').hidden = !isLoan;
  $('#txn-person-field').hidden = !isLoan;
  $('#txn-due-field').hidden = true;
  $('#txn-fee-label').innerHTML = t(FEE_LABEL);
  if (isLoan) {
    $('#txn-category-field').hidden = true;
    $('#txn-to-field').hidden = true;
    $('#txn-loan').value = (x && loanActionOf(x)) || preset?.loan || $('#txn-loan').value || 'borrow';
    return fillLoanFields(x, preset);
  }
  $('#txn-category-field').hidden = isT;
  $('#txn-to-field').hidden = !isT;
  $('#txn-fee-field').hidden = type === 'Income';
  $('#txn-account-label').textContent = t(type === 'Income' ? 'Received in' : type === 'Expense' ? 'Paid from' : 'From');

  const cats = type === 'Income' ? s.incomeCategories : s.expenseCategories.map((c) => c.name);
  const catList = [...cats];
  if (x?.category && !isT && !catList.includes(x.category)) catList.push(x.category);
  fillSelect($('#txn-category'), catList.map((c) => [c, c]), x?.category);

  // Income/Expense normally touch spendable accounts; show those first.
  const order = (a) => (isT ? 0 : a.type === 'Liquid' ? 0 : 1);
  const accItems = [...accs].sort((a, b) => order(a) - order(b)).map((a) => [a.id, a.type === 'Liquid' ? a.name : `${a.name} (${t(TYPE_NAMES[a.type])})`]);
  const prevFrom = $('#txn-account').value;
  // Income and expenses default to a spendable account, never a loan account.
  const prevOk = isT || accById(prevFrom)?.type === 'Liquid';
  const firstLiquid = accs.find((a) => a.type === 'Liquid')?.id;
  fillSelect($('#txn-account'), accItems, x?.account ?? (prevOk ? prevFrom : firstLiquid ?? prevFrom));
  const prevTo = $('#txn-to').value;
  fillSelect($('#txn-to'), accItems, x?.toAccount ?? prevTo);
  if (isT && $('#txn-to').value === $('#txn-account').value) {
    const other = accItems.find(([id]) => id !== $('#txn-account').value);
    if (other) $('#txn-to').value = other[0];
  }
  updateTxnHint();
}

// Offers the fee at the same rate as the last charge paid from this account
// (e.g. bKash cash-out), so it does not have to be worked out every time.
function updateFeeSuggestion() {
  const btn = $('#txn-fee-suggest');
  const amount = Number($('#txn-amount').value);
  const from = $('#txn-account').value;
  const to = txnType === 'Transfer' ? $('#txn-to').value : null;
  btn.hidden = true;
  if (txnType === 'Income' || txnType === 'Loan' || !(amount > 0) || Number($('#txn-fee').value) > 0) return;
  const past = state.data.transactions
    .filter((t) => t.type === txnType && t.account === from && Number(t.fee) > 0 && Number(t.amount) > 0 && t.id !== editing?.id)
    .sort((a, b) => (b.toAccount === to) - (a.toAccount === to) || txnSort(a, b));
  if (!past.length) return;
  const rate = Number(past[0].fee) / Number(past[0].amount);
  const fee = Math.round(amount * rate * 100) / 100;
  btn.dataset.fee = fee;
  btn.textContent = t('Use {amount} · same rate as last time ({rate}%)', { amount: money2(fee), rate: (rate * 100).toFixed(2) });
  btn.hidden = false;
}

function updateTxnHint() {
  updateFeeSuggestion();
  const from = accById($('#txn-account').value);
  const to = accById($('#txn-to').value);
  let hint = '';
  if (txnType === 'Loan') {
    const action = $('#txn-loan').value;
    const person = accById($('#txn-person').value);
    const name = person ? personName(person.id) : t('them');
    const owed = person ? C.worth(accounts(), state.data.transactions).balances[person.id].value : 0;
    hint = t(
      {
        borrow: 'Borrowed money is not income. You will owe {name} more.',
        repay: 'Repaying is not spending: you will owe {name} less.',
        lend: 'Lending is not spending. {name} will owe you.',
        collect: 'Getting your money back is not income. {name} will owe you less.',
      }[action],
      { name },
    );
    if (person && owed > 0)
      hint += ' ' + t(LOAN[action].personType === 'Debt' ? 'You owe {name} {amount} now.' : '{name} owes you {amount} now.', { name, amount: moneyExact(owed) });
    const plan = action === 'repay' && person ? planInfo(person) : null;
    if (plan && !plan.done) hint += ' ' + t('Installment {k} of {n}.', { k: plan.k, n: plan.n });
    const count = Number($('#txn-plan-count').value);
    const amount = Number($('#txn-amount').value);
    if (action === 'borrow' && count > 1 && amount > 0) {
      const each = (amount + (Number($('#txn-plan-interest').value) || 0)) / count;
      hint += ' ' + t('You will pay about {amount} a month for {n} months.', { amount: money2(Math.round(each * 100) / 100), n: count });
    }
    const interest = Number($('#txn-fee').value);
    if (action === 'repay')
      hint += ' ' + (interest > 0 ? t('The {amount} interest is counted as spending (Loan Interest).', { amount: money2(interest) }) : t('Only interest would count as spending.'));
    $('#txn-hint').textContent = hint;
    return;
  }
  if (txnType === 'Transfer' && from && to) {
    if (to.type === 'Investment') hint = t('Counts as money moved into investments, not spending.');
    else if (to.type === 'Lend') hint = t("You're lending money. {name} will owe you more.", { name: to.name });
    else if (from.type === 'Lend') hint = t('{name} is paying you back.', { name: from.name });
    else if (to.type === 'Debt') hint = t('Paying off what you owe.');
    else if (from.type === 'Debt') hint = t('Borrowing money. What you owe goes up.');
    else hint = t('Moving your own money between accounts. The transfer itself is not spending.');
  } else if (txnType === 'Expense' && $('#txn-category').value === 'Family Support') {
    hint = t('Money you give to family is spending. If someone is only holding it for you, use Transfer to their account instead.');
  }
  const fee = Number($('#txn-fee').value);
  if (txnType !== 'Income' && fee > 0) {
    hint = `${hint} ${t('The {amount} charge is taken from {account} and counted as spending (Service Charges).', {
      amount: money2(fee),
      account: accById($('#txn-account').value)?.name ?? t('this account'),
    })}`.trim();
  }
  $('#txn-hint').textContent = hint;
}

// `preset` pre-fills a new entry, e.g. { loan: 'repay', person: id }.
function openTxn(x = null, preset = null) {
  if (!state.data.accounts.length) {
    toast(t('Add an account in Setup first'));
    return switchView('setup');
  }
  editing = x;
  smsRef = '';
  $('#sms-row').hidden = !!x;
  $('#sms-panel').hidden = true;
  $('#sms-info').hidden = true;
  $('#txn-title').textContent = x ? t('Edit transaction') : t('Add transaction');
  $('#txn-delete').hidden = !x;
  $('#txn-save-another').hidden = !!x;
  $('#txn-error').hidden = true;
  $('#txn-amount').value = x ? x.amount : '';
  $('#txn-date').value = x ? x.date : C.today();
  $('#txn-note').value = x?.note ?? '';
  $('#txn-fee').value = x?.fee || '';
  $('#txn-due').value = '';
  $('#txn-plan-count').value = '';
  $('#txn-plan-interest').value = '';
  delete $('#txn-amount').dataset.auto;
  const type = x ? (loanActionOf(x) ? 'Loan' : x.type) : preset?.loan ? 'Loan' : txnType;
  setTxnType(type, x, preset);
  $('#txn-dialog').showModal();
  if (!x) $('#txn-amount').focus();
}

async function saveTxn(another) {
  const amount = Number($('#txn-amount').value);
  const err = (m) => {
    $('#txn-error').textContent = m;
    $('#txn-error').hidden = false;
  };
  if (!(amount > 0)) return err(t('Enter an amount greater than 0.'));
  if (!$('#txn-date').value) return err(t('Pick a date.'));
  if (txnType === 'Loan') return saveLoan(amount, another, err);
  const isT = txnType === 'Transfer';
  if (isT && $('#txn-account').value === $('#txn-to').value) return err(t('From and To must be different accounts.'));
  const fee = txnType === 'Income' ? 0 : Number($('#txn-fee').value) || 0;
  if (fee < 0) return err(t('The service charge cannot be negative.'));
  const x = {
    ...(editing || {}),
    type: txnType,
    amount,
    date: $('#txn-date').value,
    category: isT ? 'Transfer' : $('#txn-category').value,
    account: $('#txn-account').value,
    toAccount: isT ? $('#txn-to').value : null,
    note: $('#txn-note').value.trim(),
    fee: fee > 0 ? fee : undefined,
    feeCategory: undefined,
    loan: undefined,
    ref: smsRef || editing?.ref || undefined,
  };
  try {
    await state.store.saveTxn(x);
    await ensureFeeCategory(x);
  } catch (e) {
    return err(e.message);
  }
  const saved = t({ Expense: 'Saved expense of {amount}', Income: 'Saved income of {amount}', Transfer: 'Saved transfer of {amount}' }[txnType], {
    amount: money(amount),
  });
  toast(editing ? t('Updated') : fee ? `${saved} + ${t('charge {amount}', { amount: money2(fee) })}` : saved);
  afterSave(another);
}

// Fees and interest get a category in Setup so they can be given a budget.
async function ensureFeeCategory(x) {
  if (!(Number(x.fee) > 0)) return;
  const name = C.feeCategory(x);
  const s = settings();
  if (!s.expenseCategories.some((c) => c.name === name))
    await state.store.saveSettings({ ...s, expenseCategories: [...s.expenseCategories, { name, budget: 0 }] });
}

async function saveLoan(amount, another, err) {
  const action = $('#txn-loan').value;
  const cfg = LOAN[action];
  const person = $('#txn-person').value;
  const moneyAcc = $('#txn-account').value;
  if (!person || person === '__new') return err(cfg.personType === 'Debt' ? t('Choose or add who you borrowed from.') : t('Choose or add the person.'));
  if (!moneyAcc) return err(t('Choose the account the money went into or came out of.'));
  const interest = cfg.interest ? Number($('#txn-fee').value) || 0 : 0;
  if (interest < 0) return err(t('Interest cannot be negative.'));
  const x = {
    ...(editing || { id: newId() }),
    type: 'Transfer',
    loan: action,
    category: 'Transfer',
    amount,
    date: $('#txn-date').value,
    account: cfg.personIsFrom ? person : moneyAcc,
    toAccount: cfg.personIsFrom ? moneyAcc : person,
    note: $('#txn-note').value.trim(),
    fee: interest > 0 ? interest : undefined,
    feeCategory: interest > 0 ? C.INTEREST_CATEGORY : undefined,
  };
  try {
    await state.store.saveTxn(x);
    await ensureFeeCategory(x);
    const acc = accById(person);
    let due = $('#txn-due').value;
    const owedNow = C.worth(accounts(), state.data.transactions).balances[person]?.value ?? 0;
    if (owedNow <= 0.004) due = ''; // fully repaid: nothing is due any more
    const count = Math.floor(Number($('#txn-plan-count').value));
    const plan =
      action === 'borrow' && count >= 1
        ? { count, interest: Number($('#txn-plan-interest').value) || 0, principal: amount, date: x.date, txn: x.id }
        : acc?.plan;
    if (acc && ((cfg.due && due !== (acc.dueDate || '')) || plan !== acc.plan))
      await state.store.saveAccount({ ...acc, dueDate: due || undefined, plan });
  } catch (e) {
    return err(e.message);
  }
  const name = personName(person);
  const what = t(
    { borrow: 'Borrowed {amount} from {name}', repay: 'Repaid {amount} to {name}', lend: 'Lent {amount} to {name}', collect: '{name} paid back {amount}' }[action],
    { amount: money(amount), name },
  );
  toast(editing ? t('Updated') : what);
  afterSave(another);
}

function afterSave(another) {
  smsRef = '';
  $('#sms-info').hidden = true;
  if (another) {
    $('#txn-amount').value = '';
    $('#txn-fee').value = '';
    $('#txn-fee-suggest').hidden = true;
    $('#txn-note').value = '';
    $('#txn-error').hidden = true;
    $('#txn-amount').focus();
  } else $('#txn-dialog').close();
}

// ---------------------------------------------------------------- reports

const report = { type: 'statement', preset: 'this-month', start: '', end: '', asOf: '', account: '__liquid', person: '', declaration: false };

function reportRange() {
  if (report.preset === 'custom' && report.start && report.end) return { start: report.start, end: report.end };
  return R.presetRange(report.preset);
}

function reportContext() {
  const s = settings();
  return {
    accounts: accounts(),
    txns: state.data.transactions,
    holder: s.holderName || state.user?.displayName || '',
    email: state.user?.email && state.store.mode === 'drive' ? state.user.email : '',
    describe: (x) => describeTxn(x, en),
    personName,
    declaration: report.declaration,
  };
}

function renderReports() {
  const accs = accounts();
  const people = accs.filter((a) => a.type === 'Debt' || a.type === 'Lend');
  if (!report.person && people[0]) report.person = people[0].id;
  if (!report.asOf) report.asOf = C.today();
  const s = settings();
  const presets = [
    ['this-month', t('This month')],
    ['last-month', t('Last month')],
    ['last-3', t('Last 3 months')],
    ['last-6', t('Last 6 months')],
    ['this-iy', t('This income year ({label})', { label: R.incomeYear(C.today()).label })],
    ['last-iy', t('Last income year ({label})', { label: R.incomeYear(C.today(), -1).label })],
    ['this-year', t('Calendar year {year}', { year: C.today().slice(0, 4) })],
    ['custom', t('Custom dates…')],
  ];
  const kind = report.type;
  if (kind === 'tax' && !report.preset.endsWith('-iy')) report.preset = 'last-iy';
  const r = reportRange();
  $('#view-reports').innerHTML = `
    <div class="card" style="display:grid;gap:10px">
      <h3 style="margin:0">${t('Documents')}</h3>
      <p class="muted" style="margin:0;font-size:13px">${t('Make a printable statement from your records. It opens as a page you can print or save as PDF. Documents are in English.')}</p>
      ${Object.entries(R.REPORTS)
        .map(
          ([k, v]) => `<button class="choice ${kind === k ? 'recommended selected' : ''}" data-report="${k}">
            <strong>${esc(t(v.title))}</strong><span>${esc(t(v.uses))}</span></button>`,
        )
        .join('')}
    </div>

    <div class="card" style="display:grid;gap:12px">
      <h3 style="margin:0">${esc(t(R.REPORTS[kind].title))}</h3>
      ${
        kind === 'networth'
          ? `<div class="field"><label for="r-asof">${t('As of date')}</label><input type="date" id="r-asof" value="${esc(report.asOf)}"></div>`
          : `<div class="field"><label for="r-preset">${t('Period')}</label>
              <select id="r-preset">${presets
                .filter(([k]) => kind !== 'tax' || k.endsWith('-iy') || k === 'custom')
                .map(([k, l]) => `<option value="${k}" ${report.preset === k ? 'selected' : ''}>${esc(l)}</option>`)
                .join('')}</select></div>
             ${
               report.preset === 'custom'
                 ? `<div class="row2"><div class="field"><label for="r-start">${t('From')}</label><input type="date" id="r-start" value="${esc(report.start || r.start)}"></div>
                    <div class="field"><label for="r-end">${t('To')}</label><input type="date" id="r-end" value="${esc(report.end || r.end)}"></div></div>`
                 : `<p class="muted" style="margin:-4px 0 0;font-size:12px">${t('{from} to {to}', { from: niceDate(r.start, { day: 'numeric', month: 'short', year: 'numeric' }), to: niceDate(r.end, { day: 'numeric', month: 'short', year: 'numeric' }) })}</p>`
             }`
      }
      ${
        kind === 'statement'
          ? `<div class="field"><label for="r-account">${t('Account')}</label><select id="r-account">
              <option value="__liquid">${t('All spendable accounts (bank, cash, wallets)')}</option>
              ${accs.filter((a) => a.type !== 'Debt').map((a) => `<option value="${esc(a.id)}" ${report.account === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
            </select></div>`
          : ''
      }
      ${
        kind === 'loan'
          ? people.length
            ? `<div class="field"><label for="r-person">${t('Person or lender')}</label><select id="r-person">
                ${people.map((a) => `<option value="${esc(a.id)}" ${report.person === a.id ? 'selected' : ''}>${esc(a.name)} (${a.type === 'Debt' ? t('I owe') : t('owes me')})</option>`).join('')}
              </select></div>`
            : `<p class="muted" style="margin:0">${t('No loans recorded yet. Add one with + → Loan.')}</p>`
          : ''
      }
      <div class="field"><label for="r-name">${t('Name printed on the document')}</label>
        <input id="r-name" value="${esc(s.holderName || state.user?.displayName || '')}" placeholder="${t('Your full name (in English)')}"></div>
      <label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" id="r-decl" style="width:auto" ${report.declaration ? 'checked' : ''}>
        ${t('Add a declaration and signature line')}</label>
      <div class="sheet-actions" style="justify-content:flex-start">
        <button class="btn primary" id="r-open">${t('Open document')}</button>
        ${kind === 'statement' ? `<button class="btn" id="r-csv">${t('Download CSV')}</button>` : ''}
      </div>
      <p class="muted" style="margin:0;font-size:12px">${t('These documents come from your own records. Banks and embassies usually also need an official, bank-stamped statement, so use these as a summary or supporting document.')}</p>
    </div>`;

  const v = $('#view-reports');
  $$('[data-report]', v).forEach((b) => (b.onclick = () => ((report.type = b.dataset.report), renderReports())));
  const on = (sel, fn) => $(sel, v) && ($(sel, v).onchange = fn);
  on('#r-preset', (e) => ((report.preset = e.target.value), renderReports()));
  on('#r-start', (e) => (report.start = e.target.value));
  on('#r-end', (e) => (report.end = e.target.value));
  on('#r-asof', (e) => (report.asOf = e.target.value));
  on('#r-account', (e) => (report.account = e.target.value));
  on('#r-person', (e) => (report.person = e.target.value));
  on('#r-decl', (e) => (report.declaration = e.target.checked));
  on('#r-name', (e) => state.store.saveSettings({ ...settings(), holderName: e.target.value.trim() }));
  $('#r-open', v).onclick = openReport;
  if ($('#r-csv', v))
    $('#r-csv', v).onclick = () => {
      const range = reportRange();
      download(`statement-${range.start}-to-${range.end}.csv`, R.statementCsv(reportContext(), { range, accountId: report.account }), 'text/csv');
    };
}

function openReport() {
  const name = $('#r-name')?.value.trim();
  if (name && name !== settings().holderName) state.store.saveSettings({ ...settings(), holderName: name });
  const ctx = { ...reportContext(), holder: name || reportContext().holder };
  markGuide('report');
  const range = reportRange();
  if (report.preset === 'custom' && range.start > range.end) return toast(t('The start date is after the end date'));
  const html = {
    statement: () => R.statementReport(ctx, { range, accountId: report.account }),
    income: () => R.incomeReport(ctx, { range }),
    networth: () => R.networthReport(ctx, { date: report.asOf || C.today() }),
    tax: () => R.taxReport(ctx, { range }),
    loan: () => R.loanReport(ctx, { range, personId: report.person }),
  }[report.type]();
  const w = window.open('', '_blank');
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
  } else {
    // Pop-ups blocked: save the page instead; it opens in any browser.
    download(`${report.type}-${C.today()}.html`, html, 'text/html');
    toast(t('Saved the document as a file. Open it to print or save as PDF.'));
  }
}

// ---------------------------------------------------------------- setup

function renderSetup() {
  const s = settings();
  const w = C.worth(accounts(), state.data.transactions);
  const u = state.user;
  $('#view-setup').innerHTML = `
    <div class="grid2">
      <div class="card">
        <h3>${t('Accounts')} <button class="btn sm" id="add-acc">${t('+ Add account')}</button></h3>
        <div class="list">
          ${accounts()
            .map(
              (a) => `<button class="li txn" style="border:0;border-top:1px solid var(--line);border-radius:0;margin:0;padding:10px 2px" data-acc="${esc(a.id)}">
                <span class="mid"><div class="t">${esc(a.name)}<span class="tag">${t(TYPE_NAMES[a.type])}</span></div>
                <div class="sub">${t('Opening {amount}', { amount: money(a.opening || 0) })}${a.notes ? ` · ${esc(a.notes)}` : ''}</div></span>
                <span class="amt num">${a.type === 'Debt' ? '−' : ''}${moneyExact(w.balances[a.id].value)}</span></button>`,
            )
            .join('') || `<p class="muted">${t('No accounts yet.')}</p>`}
        </div>
      </div>

      <div class="card">
        <h3>${t('Monthly savings goal')}</h3>
        <div class="field"><label for="goal">${t('Income minus expenses, per month (BDT)')}</label>
          <input type="number" id="goal" inputmode="decimal" value="${Number(s.savingsGoal) || 0}"></div>
      </div>

      <div class="card" id="budgets-card">
        <h3>${t('Expense categories &amp; monthly budgets')}
          <small class="num">${t('total {amount}', { amount: money(s.expenseCategories.reduce((a, c) => a + (Number(c.budget) || 0), 0)) })}</small></h3>
        ${s.expenseCategories
          .map(
            (c, i) => `<div class="edit-row">
              <button class="linkish" style="text-align:left;color:var(--text);font-weight:500" data-rename-exp="${i}" title="${t('Rename')}">${esc(c.name)}</button>
              <input type="number" inputmode="decimal" data-budget="${i}" value="${Number(c.budget) || 0}" aria-label="${esc(t('Budget for {name}', { name: c.name }))}">
              <button class="icon-btn" data-del-exp="${i}" aria-label="${esc(t('Remove {name}', { name: c.name }))}">✕</button></div>`,
          )
          .join('')}
        <div class="add-row"><input id="new-exp" placeholder="${t('New expense category')}"><button class="btn" id="add-exp">${t('Add')}</button></div>
      </div>

      <div class="card">
        <h3>${t('Income sources')}</h3>
        <div class="chips">
          ${s.incomeCategories
            .map((c, i) => `<span class="chip"><span data-rename-inc="${i}" style="cursor:pointer">${esc(c)}</span><button data-del-inc="${i}" aria-label="${esc(t('Remove {name}', { name: c }))}">✕</button></span>`)
            .join('')}
        </div>
        <div class="add-row"><input id="new-inc" placeholder="${t('New income source')}"><button class="btn" id="add-inc">${t('Add')}</button></div>
      </div>

      ${installCard()}

      <div class="card">
        <h3>${t('Help &amp; feedback')}</h3>
        <p class="muted" style="margin:0 0 10px;font-size:13px">${t("Found a problem, or have an idea? Tell us in a short form. Please don't write amounts, balances or account numbers.")}</p>
        <a class="btn" href="${G.feedbackUrl('setup')}" target="_blank" rel="noopener">💬 ${t('Send feedback')}</a>
      </div>

      <div class="card">
        <h3>${t('Language')} · ভাষা</h3>
        <div class="segmented" style="display:flex">
          <button data-lang="en" style="flex:1" class="${lang === 'en' ? 'active' : ''}">English</button>
          <button data-lang="bn" style="flex:1" class="${lang === 'bn' ? 'active' : ''}">বাংলা</button>
        </div>
        <h3 style="margin-top:16px">${t('Appearance')}</h3>
        <div class="segmented" id="theme-seg" style="display:flex">
          ${[['auto', 'Auto'], ['light', '☀️ Day'], ['dark', '🌙 Night']]
            .map(([v, l]) => `<button data-theme-pref="${v}" style="flex:1" class="${themePref() === v ? 'active' : ''}">${t(l)}</button>`)
            .join('')}
        </div>
        <p class="muted" style="font-size:12px;margin:8px 0 0">${t('Auto follows your phone or computer setting.')}</p>
        ${G.guideOn(state.data) ? '' : `<h3 style="margin-top:16px">${t('Getting started')}</h3>
        <button class="btn" id="guide-show">${t('Show the getting-started guide')}</button>`}
      </div>

      <div class="card">
        <h3>${t('Backup &amp; data')}</h3>
        <div style="display:grid;gap:8px">
          <button class="btn" id="export">${t('Download backup (.json)')}</button>
          <button class="btn" id="export-csv">${t('Download transactions (.csv)')}</button>
          <label class="btn" style="text-align:center">${t('Import .json file…')}
            <input type="file" accept=".json,application/json" id="import" hidden></label>
          <p class="muted" style="font-size:12px;margin:0">${t('After choosing a file you can replace your data or add the file to it.')}</p>
        </div>
      </div>

      <div class="card">
        <h3>${t('Signed in')}</h3>
        <p style="margin:0 0 10px">${esc(u.displayName || '')}<br><span class="muted">${esc(u.email || '')}</span></p>
        ${
          state.store.mode === 'drive'
            ? `<p class="muted" style="margin:0 0 10px;font-size:13px">${t("Your data is stored in a private app folder in this Google account's Drive. Nobody else can see it, including the people who run this website. Signing out removes it from this device only.")}</p>
               <button class="btn" id="signout">${t('Sign out')}</button>`
            : `<p class="muted" style="margin:0;font-size:13px">${t('Demo mode. Add a Google client ID to <code>js/config.js</code> to sign in and sync.')}</p>`
        }
      </div>
    </div>`;

  const v = $('#view-setup');
  const save = (patch) => state.store.saveSettings({ ...s, ...patch });

  $('#add-acc', v).onclick = () => openAccount();
  $$('[data-acc]', v).forEach((b) => (b.onclick = () => openAccount(accById(b.dataset.acc))));
  $('#goal', v).onchange = (e) => save({ savingsGoal: Number(e.target.value) || 0 }).then(() => toast(t('Goal saved')));

  $$('[data-budget]', v).forEach(
    (inp) =>
      (inp.onchange = () => {
        const list = s.expenseCategories.map((c, i) => (i === Number(inp.dataset.budget) ? { ...c, budget: Number(inp.value) || 0 } : c));
        save({ expenseCategories: list }).then(() => toast(t('Budget saved')));
      }),
  );
  $$('[data-del-exp]', v).forEach(
    (b) =>
      (b.onclick = () => {
        const c = s.expenseCategories[Number(b.dataset.delExp)];
        if (!confirm(t('Remove "{name}"? Past transactions keep this category.', { name: c.name }))) return;
        save({ expenseCategories: s.expenseCategories.filter((x) => x !== c) });
      }),
  );
  $$('[data-rename-exp]', v).forEach(
    (b) =>
      (b.onclick = () => {
        const i = Number(b.dataset.renameExp);
        renameCategory('Expense', s.expenseCategories[i].name, (name) =>
          s.expenseCategories.map((c, j) => (j === i ? { ...c, name } : c)),
        );
      }),
  );
  $('#add-exp', v).onclick = () => {
    const name = $('#new-exp', v).value.trim();
    if (!name || s.expenseCategories.some((c) => c.name === name)) return;
    save({ expenseCategories: [...s.expenseCategories, { name, budget: 0 }] });
  };

  $$('[data-del-inc]', v).forEach(
    (b) =>
      (b.onclick = () => {
        const c = s.incomeCategories[Number(b.dataset.delInc)];
        if (!confirm(t('Remove "{name}"? Past transactions keep this source.', { name: c }))) return;
        save({ incomeCategories: s.incomeCategories.filter((x) => x !== c) });
      }),
  );
  $$('[data-rename-inc]', v).forEach(
    (b) =>
      (b.onclick = () => {
        const i = Number(b.dataset.renameInc);
        renameCategory('Income', s.incomeCategories[i], (name) => s.incomeCategories.map((c, j) => (j === i ? name : c)));
      }),
  );
  $('#add-inc', v).onclick = () => {
    const name = $('#new-inc', v).value.trim();
    if (!name || s.incomeCategories.includes(name)) return;
    save({ incomeCategories: [...s.incomeCategories, name] });
  };

  $$('[data-theme-pref]', v).forEach((b) => (b.onclick = () => applyTheme(b.dataset.themePref)));
  bindInstall(v);
  $('#guide-show', v)?.addEventListener('click', () => {
    showGuide(true);
    switchView('dashboard');
  });
  $$('[data-lang]', v).forEach((b) => (b.onclick = () => applyLang(b.dataset.lang)));
  $('#export', v).onclick = exportJson;
  $('#export-csv', v).onclick = exportCsv;
  $('#import', v).onchange = (e) => importFile(e.target.files[0]);
  if ($('#signout', v)) $('#signout', v).onclick = () => state.store.signOut();
}

// Renames a category and moves its past transactions with it.
async function renameCategory(type, oldName, buildList) {
  const name = prompt(t('Rename "{name}" to:', { name: oldName }), oldName)?.trim();
  if (!name || name === oldName) return;
  const s = settings();
  const key = type === 'Income' ? 'incomeCategories' : 'expenseCategories';
  await state.store.saveSettings({ ...s, [key]: buildList(name) });
  const affected = state.data.transactions.filter((t) => t.type === type && t.category === oldName);
  for (const t of affected) await state.store.saveTxn({ ...t, category: name });
  toast(tn(affected.length, 'Renamed. {n} transaction updated.', 'Renamed. {n} transactions updated.'));
}

// ---------------------------------------------------------------- account dialog

let editingAcc = null;

function setupAccountDialog() {
  const syncType = () => {
    const type = $('#acc-type').value;
    $$('#acc-dialog .inv-only').forEach((el) => (el.hidden = type !== 'Investment'));
    $$('#acc-dialog .loan-only').forEach((el) => (el.hidden = type !== 'Debt' && type !== 'Lend'));
    $('#acc-opening-label').textContent = t(
      type === 'Debt' ? 'Amount I owed at start' : type === 'Lend' ? 'Amount owed to me at start' : 'Opening balance',
    );
  };
  $('#acc-type').onchange = syncType;
  setupAccountDialog.syncType = syncType;

  $('#acc-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = $('#acc-name').value.trim();
    if (!name) {
      $('#acc-error').textContent = t('Give the account a name.');
      $('#acc-error').hidden = false;
      return;
    }
    const type = $('#acc-type').value;
    const value = $('#acc-value').value;
    await state.store.saveAccount({
      ...(editingAcc || { id: newId(), order: state.data.accounts.length + 1 }),
      name,
      type,
      opening: Number($('#acc-opening').value) || 0,
      currentValue: type === 'Investment' && value !== '' ? Number(value) : null,
      monthlyTarget: type === 'Investment' ? Number($('#acc-target').value) || 0 : 0,
      dueDate: (type === 'Debt' || type === 'Lend') && $('#acc-due').value ? $('#acc-due').value : undefined,
      notes: $('#acc-notes').value.trim(),
    });
    $('#acc-dialog').close();
    toast(t('Account saved'));
  };

  $('#acc-delete').onclick = async () => {
    const used = state.data.transactions.some((t) => t.account === editingAcc.id || t.toAccount === editingAcc.id);
    if (used) {
      $('#acc-error').textContent = t('This account has transactions. Delete or move them first.');
      $('#acc-error').hidden = false;
      return;
    }
    if (!confirm(t('Delete "{name}"?', { name: editingAcc.name }))) return;
    await state.store.deleteAccount(editingAcc.id);
    $('#acc-dialog').close();
  };
}

function openAccount(a = null) {
  editingAcc = a;
  $('#acc-title').textContent = a ? t('Edit account') : t('New account');
  $('#acc-delete').hidden = !a;
  $('#acc-error').hidden = true;
  $('#acc-name').value = a?.name ?? '';
  $('#acc-type').value = a?.type ?? 'Liquid';
  $('#acc-opening').value = a?.opening ?? 0;
  $('#acc-value').value = a?.currentValue ?? '';
  $('#acc-target').value = a?.monthlyTarget || '';
  $('#acc-notes').value = a?.notes ?? '';
  $('#acc-due').value = a?.dueDate || '';
  setupAccountDialog.syncType();
  $('#acc-dialog').showModal();
}

// ---------------------------------------------------------------- import / export

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportJson() {
  const { accounts, transactions, settings } = state.data;
  download(`amrpotli-backup-${C.today()}.json`, JSON.stringify({ version: 1, accounts, transactions, settings }, null, 2), 'application/json');
}

function exportCsv() {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Date', 'Type', 'Category', 'Account', 'To Account', 'Amount', 'Service Charge', 'Note']];
  for (const t of [...state.data.transactions].sort((a, b) => a.date.localeCompare(b.date)))
    rows.push([t.date, t.type, t.category, accName(t.account), t.toAccount ? accName(t.toAccount) : '', t.amount, t.fee || '', t.note]);
  download(`transactions-${C.today()}.csv`, rows.map((r) => r.map(q).join(',')).join('\n'), 'text/csv');
}

// Asks whether to replace or add to the current data. Resolves to
// 'replace', 'merge' or 'cancel'.
function askImportMode(d) {
  const dlg = $('#import-dialog');
  const mine = state.data.transactions.length;
  $('#import-summary').textContent =
    t('The file has {tx} transactions and {acc} accounts.', { tx: d.transactions.length, acc: d.accounts.length }) +
    ' ' +
    tn(mine, 'You currently have {n} transaction.', 'You currently have {n} transactions.');
  // Nothing logged yet (e.g. after "Start fresh"): replacing is the safe choice.
  $('#import-replace').classList.toggle('recommended', mine === 0);
  $('#import-merge').classList.toggle('recommended', mine > 0);
  dlg.returnValue = 'cancel';
  dlg.showModal();
  return new Promise((resolve) => dlg.addEventListener('close', () => resolve(dlg.returnValue || 'cancel'), { once: true }));
}

async function importFile(file) {
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!Array.isArray(d.accounts) || !Array.isArray(d.transactions)) throw new Error(t('This is not an AmrPotli backup file.'));
    const hasData = state.data.transactions.length || state.data.accounts.length;
    const mode = hasData ? await askImportMode(d) : 'replace';
    if (mode === 'cancel') return;
    if (mode === 'merge') await state.store.mergeAll(d);
    else await state.store.importAll({ ...d, settings: d.settings || DEFAULT_SETTINGS });
    toast(t(mode === 'merge' ? 'Added {n} transactions from the file' : 'Imported {n} transactions', { n: d.transactions.length }));
    switchView('dashboard');
  } catch (e) {
    alert(t('Import failed: {msg}', { msg: e.message }));
  } finally {
    $$('input[type=file]').forEach((i) => (i.value = ''));
  }
}

boot();
