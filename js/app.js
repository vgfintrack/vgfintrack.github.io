import * as C from './calc.js';
import { createStore, DEFAULT_SETTINGS, DEFAULT_ACCOUNTS, newId } from './store.js';

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
  return C.parseDate(s).toLocaleDateString('en-GB', opts);
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
  btn.title = dark ? 'Switch to day mode' : 'Switch to night mode';
  if (state.data?.loaded && !$('#app').hidden) render(); // charts pick up the new colours
}

darkQuery.addEventListener('change', () => themePref() === 'auto' && applyTheme('auto'));

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
const accName = (id) => accById(id)?.name ?? '(deleted account)';
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
        e.type === 'popup_failed_to_open' ? 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.' : e.message || String(e);
      $('#login-error').hidden = false;
    }
  };

  state.store.onStatus(renderSync);
  $('#sync').onclick = async () => {
    try {
      await state.store.syncNow();
    } catch (e) {
      if (e.type !== 'popup_closed') toast(e.message || 'Could not connect to Google Drive');
    }
  };

  $$('.tabbar button').forEach((b) => (b.onclick = () => switchView(b.dataset.view)));
  $('#fab').onclick = () => openTxn();
  $('#add-top').onclick = () => openTxn();
  $('#theme-btn').onclick = () => applyTheme(isDark() ? 'light' : 'dark');
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

function renderSync(status) {
  const btn = $('#sync');
  const [label, cls] = SYNC_LABELS[status] || [];
  btn.hidden = !label;
  if (!label) return;
  btn.textContent = label;
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
      <p style="margin:0">Loading your data from Google Drive…</p>
      <p class="muted" style="margin:0;font-size:13px">If this takes long, tap the sync button at the top.</p>
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
  showAddButton(!empty && state.view !== 'setup');
  if (empty) return renderWelcome();
  $$('.view').forEach((s) => (s.hidden = s.id !== `view-${state.view}`));
  if (state.view === 'dashboard') renderDashboard();
  if (state.view === 'transactions') renderTransactions();
  if (state.view === 'setup') renderSetup();
}

// ---------------------------------------------------------------- welcome

function renderWelcome() {
  $$('.view').forEach((s) => (s.hidden = s.id !== 'view-dashboard'));
  $('#view-dashboard').innerHTML = `
    <div class="card" style="max-width:520px;margin:24px auto;display:grid;gap:14px">
      <h2>Welcome 👋</h2>
      <p class="muted" style="margin:0">Bring in your data from a backup file (for example, the file made from your
      spreadsheet), or start with an empty tracker and add your accounts.</p>
      <label class="btn primary wide" style="text-align:center">Import backup file (.json)
        <input type="file" accept=".json,application/json" id="welcome-import" hidden></label>
      <button class="btn wide" id="welcome-fresh">Start fresh</button>
    </div>`;
  $('#welcome-import').onchange = (e) => importFile(e.target.files[0]);
  $('#welcome-fresh').onclick = async () => {
    await state.store.importAll({ accounts: DEFAULT_ACCOUNTS, transactions: [], settings: DEFAULT_SETTINGS });
    switchView('setup');
    toast('Set your opening balances and budgets here');
  };
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
    st.savingsRate == null ? '—' : st.savingsRate < -1 ? 'below −100%' : pct(st.savingsRate);
  const rateSub = isWeek ? 'Tuition is paid monthly, so check the month view' : 'of income kept';

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
  const importCard = txns.length
    ? ''
    : `<div class="card" style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap">
        <div><strong>No transactions yet</strong>
          <div class="muted" style="font-size:13px">Have a backup or your spreadsheet data file? Import it here.</div></div>
        <label class="btn primary">Import .json file
          <input type="file" accept=".json,application/json" id="dash-import" hidden></label>
      </div>`;

  $('#view-dashboard').innerHTML = `
    ${importCard}
    <div class="periodbar">
      <div class="segmented" id="period-seg">
        <button data-p="month" class="${!isWeek ? 'active' : ''}">Month</button>
        <button data-p="week" class="${isWeek ? 'active' : ''}">Week</button>
      </div>
      <div class="stepper">
        <button class="icon-btn" id="prev" aria-label="Previous">‹</button>
        <span class="label">${rangeLabel(r)}</span>
        <button class="icon-btn" id="next" aria-label="Next">›</button>
      </div>
    </div>

    <div class="kpis">
      <div class="kpi"><div class="k">Income</div><div class="v num income">${money(st.income)}</div>
        <div class="s">${Object.keys(income).length} source${Object.keys(income).length === 1 ? '' : 's'}</div></div>
      <div class="kpi"><div class="k">Expenses</div><div class="v num expense">${money(st.expenses)}</div>
        <div class="s">${money(st.avgPerDay)} / day</div></div>
      <div class="kpi"><div class="k">Net saved</div><div class="v num">${money(st.net)}</div>
        <div class="s">${st.toInvestments ? `${money(st.toInvestments)} into investments` : 'Income minus expenses'}</div></div>
      <div class="kpi"><div class="k">Savings rate</div><div class="v num">${rateText}</div>
        <div class="s">${rateSub}</div></div>
    </div>

    ${
      goal > 0
        ? `<div class="card">
      <h3>${isWeek ? 'Weekly' : 'Monthly'} savings goal <small class="num">${money(Math.max(st.net, 0))} of ${money(goal)}</small></h3>
      <div class="progress ${goalRatio >= 1 ? 'ok' : ''}"><div style="width:${Math.max(0, Math.min(100, (goalRatio || 0) * 100))}%"></div></div>
      <div class="muted" style="font-size:12px;margin-top:6px">${
        goalRatio >= 1 ? 'Goal reached 🎉' : st.net < 0 ? 'Spending more than earning in this period' : `${pct(goalRatio)} there, ${money(goal - st.net)} to go`
      }</div></div>`
        : ''
    }

    <div class="grid2">
      <div class="card">
        <h3>Where my money is</h3>
        <div class="networth"><span class="muted">Net worth</span><span class="v num">${money(w.netWorth)}</span></div>
        <div class="buckets">
          <div class="bucket"><div class="k">Spendable now</div><div class="v num">${money(w.liquid)}</div></div>
          <div class="bucket"><div class="k">Lent to others</div><div class="v num">${money(w.lent)}</div></div>
          <div class="bucket"><div class="k">Investments</div><div class="v num">${money(w.investments)}</div></div>
          <div class="bucket"><div class="k">I owe</div><div class="v num">${money(w.debt)}</div></div>
        </div>
        <div class="list">
          ${accRows(byType('Liquid'))}${accRows(byType('Lend'))}${accRows(byType('Investment'))}${accRows(byType('Debt'), '−')}
        </div>
      </div>

      <div class="card">
        <h3>Budget vs spending <small>${isWeek ? 'this month · this week' : `${money(st.expenses)} of ${money(totalBudget)}`}</small></h3>
        ${cats
          .filter((c) => (Number(c.budget) || 0) > 0 || monthSpent[c.name])
          .map((c) => {
            const b = Number(c.budget) || 0;
            const m = monthSpent[c.name] || 0;
            const ratio = b > 0 ? m / b : m > 0 ? 2 : 0;
            const left = b - m;
            return `<div class="budget">
              <div class="top"><span>${esc(c.name)}</span>
                <span class="r num">${money(m)} / ${money(b)}${isWeek ? ` · week ${money(spent[c.name] || 0)}` : ''}</span></div>
              <div class="progress ${budgetClass(ratio)}"><div style="width:${Math.min(100, ratio * 100)}%"></div></div>
              <div class="left ${left < 0 ? 'bad' : ''}">${left < 0 ? `Over by ${money(-left)}` : `${money(left)} left`}</div>
            </div>`;
          })
          .join('') || '<p class="muted">Set monthly budgets in Setup.</p>'}
      </div>

      ${loansCard(accs, w)}

      <div class="card">
        <h3>${isWeek ? 'Day by day' : 'Daily spending'}</h3>
        <div class="chart-box"><canvas id="chart-daily"></canvas></div>
      </div>

      <div class="card">
        <h3>Last 6 months</h3>
        <div class="chart-box"><canvas id="chart-months"></canvas></div>
      </div>

      <div class="card">
        <h3>Income by source</h3>
        <div class="list">
          ${
            Object.entries(income)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => `<div class="li"><span class="name">${esc(k)}</span><span class="num income">${money(v)}</span></div>`)
              .join('') || '<p class="muted" style="margin:0">No income in this period.</p>'
          }
        </div>
      </div>

      ${investmentsCard(accs, txns, w, month)}

      <div class="card span2">
        <h3>Recent <button class="linkish" id="see-all">See all</button></h3>
        ${recent.map(txnRow).join('') || '<p class="muted">No transactions yet. Tap + to add one.</p>'}
      </div>
    </div>`;

  $$('#period-seg button').forEach(
    (b) => (b.onclick = () => ((state.period = b.dataset.p), renderDashboard())),
  );
  $('#prev').onclick = () => shiftPeriod(-1);
  $('#next').onclick = () => shiftPeriod(1);
  $('#see-all').onclick = () => switchView('transactions');
  $$('#view-dashboard [data-loan]').forEach((b) => (b.onclick = () => openTxn(null, { loan: b.dataset.loan, person: b.dataset.person || undefined })));
  if ($('#dash-import')) $('#dash-import').onchange = (e) => importFile(e.target.files[0]);
  bindTxnRows($('#view-dashboard'));
  drawCharts(r, txns, accs);
}

function dueText(a) {
  if (!a.dueDate) return '';
  const d = C.daysUntil(a.dueDate);
  if (d < 0) return `<span class="due bad">Overdue by ${-d} day${d === -1 ? '' : 's'}</span>`;
  if (d === 0) return '<span class="due warn">Due today</span>';
  if (d <= 7) return `<span class="due warn">Due in ${d} day${d === 1 ? '' : 's'}</span>`;
  return `<span class="due">Due ${niceDate(a.dueDate, { day: 'numeric', month: 'short', year: 'numeric' })}</span>`;
}

// Who I owe and who owes me, with one-tap repay / got-back buttons.
function loansCard(accs, w) {
  const open = (type) => accs.filter((a) => a.type === type && w.balances[a.id].value > 0.004);
  const debts = open('Debt');
  const lends = open('Lend');
  const planText = (a) => {
    const p = a.type === 'Debt' ? planInfo(a) : null;
    return p && !p.done ? `Installment ${p.k} of ${p.n} · next ${money2(Math.round((p.principal + p.interest) * 100) / 100)}` : '';
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
    section('I owe', debts, 'repay', 'Repay', w.debt) + section('Owed to me', lends, 'collect', 'Got back', w.lent) ||
    '<p class="muted" style="margin:0 0 10px">No open loans. Borrowed money, or lent some to a friend? Add it here.</p>';
  return `<div class="card">
    <h3>Loans <span><button class="btn sm" data-loan="borrow">+ Borrowed</button> <button class="btn sm" data-loan="lend">+ Lent</button></span></h3>
    ${body}
  </div>`;
}

function investmentsCard(accs, txns, w, month) {
  const inv = accs.filter((a) => a.type === 'Investment');
  if (!inv.length) return '';
  return `<div class="card">
    <h3>Investments <small>${niceDate(month.start, { month: 'short', year: 'numeric' })}</small></h3>
    <div class="table-wrap"><table>
      <tr><th>Account</th><th>Put in</th><th>Value</th><th>Gain</th><th>Added</th><th>Target</th></tr>
      ${inv
        .map((a) => {
          const b = w.balances[a.id];
          const added = C.netAdded(month, txns, a.id);
          const t = Number(a.monthlyTarget) || 0;
          const status = t ? `<span class="pill ${added >= t ? 'ok' : 'warn'}">${added >= t ? 'Paid' : `${money(t - added)} due`}</span>` : '—';
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
  const dailySets = [{ label: 'Expenses', data: days.map((d) => d.expenses), backgroundColor: cssVar('--expense'), borderRadius: 4 }];
  if (isWeek) dailySets.unshift({ label: 'Income', data: days.map((d) => d.income), backgroundColor: cssVar('--income'), borderRadius: 4 });
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
      labels: months.map((m) => m.label.split(' ')[0]),
      datasets: [
        { label: 'Income', data: months.map((m) => m.income), backgroundColor: cssVar('--income'), borderRadius: 4 },
        { label: 'Expenses', data: months.map((m) => m.expenses), backgroundColor: cssVar('--expense'), borderRadius: 4 },
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

function txnRow(t) {
  const isT = t.type === 'Transfer';
  const loan = loanActionOf(t);
  const loanTitle = {
    borrow: () => `Borrowed from ${personName(t.account)}`,
    repay: () => `Repaid ${personName(t.toAccount)}`,
    lend: () => `Lent to ${personName(t.toAccount)}`,
    collect: () => `${personName(t.account)} paid back`,
  }[loan];
  const title = loanTitle ? loanTitle() : isT ? `${accName(t.account)} → ${accName(t.toAccount)}` : t.category;
  const moneyAcc = loan === 'borrow' || loan === 'collect' ? t.toAccount : t.account;
  const feeWord = t.feeCategory === C.INTEREST_CATEGORY ? 'interest' : 'charge';
  const sub = [
    loan ? `Loan · ${accName(moneyAcc)}` : isT ? 'Transfer' : accName(t.account),
    Number(t.fee) && t.type !== 'Income' ? `${feeWord} ${money2(Number(t.fee))}` : '',
    t.note,
  ]
    .filter(Boolean)
    .join(' · ');
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
        <input type="month" id="f-month" value="${esc(f.month)}" aria-label="Month">
        <select id="f-type" aria-label="Type">
          <option value="">All types</option>
          ${[['Expense', 'Expense'], ['Income', 'Income'], ['Transfer', 'Transfer'], ['Loan', 'Loans']]
            .map(([v, l]) => `<option value="${v}" ${f.type === v ? 'selected' : ''}>${l}</option>`)
            .join('')}
        </select>
        <select id="f-account" aria-label="Account">
          <option value="">All accounts</option>
          ${accounts().map((a) => `<option value="${esc(a.id)}" ${f.account === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
        </select>
        <input type="search" id="f-q" placeholder="Search notes, categories…" value="${esc(f.q)}">
      </div>
      <div class="muted num" style="font-size:13px">${list.length} transactions ·
        <span class="income">+${money(inc)}</span> · <span class="expense">−${money(exp)}</span>
        ${f.month ? `· <button class="linkish" id="f-all">Show all months</button>` : ''}</div>
    </div>
    <div>
      ${
        groups
          .map(
            (g) => `<div class="day-head"><span>${niceDate(g.date, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span class="num">${dayTotal(g.items) ? `−${money(dayTotal(g.items))}` : ''}</span></div>
            ${g.items.map(txnRow).join('')}`,
          )
          .join('') || '<div class="empty">No transactions match.</div>'
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

function setupTxnDialog() {
  $$('#txn-type button').forEach((b) => (b.onclick = () => setTxnType(b.dataset.type)));
  $('#txn-form').onsubmit = (e) => {
    e.preventDefault();
    saveTxn(false);
  };
  $('#txn-save-another').onclick = () => saveTxn(true);
  $('#txn-delete').onclick = async () => {
    if (!editing || !confirm('Delete this transaction?')) return;
    await state.store.deleteTxn(editing.id);
    $('#txn-dialog').close();
    toast('Deleted');
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
  $('#txn-fee-suggest').onclick = () => {
    $('#txn-fee').value = $('#txn-fee-suggest').dataset.fee;
    updateTxnHint();
  };
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
const FEE_LABEL = $('#txn-fee-label').innerHTML;

function fillLoanFields(t = null, preset = null) {
  const action = $('#txn-loan').value;
  const cfg = LOAN[action];
  const accs = accounts();
  const people = accs.filter((a) => a.type === cfg.personType);
  const prevPerson = $('#txn-person').value;
  const person = t ? (cfg.personIsFrom ? t.account : t.toAccount) : preset?.person ?? prevPerson;
  fillSelect(
    $('#txn-person'),
    [...people.map((a) => [a.id, a.name]), ['__new', cfg.personType === 'Debt' ? '+ New lender (person, bank, bKash…)' : '+ New person…']],
    person,
  );
  // Money side: spendable accounts first, never another loan account.
  const order = (a) => (a.type === 'Liquid' ? 0 : 1);
  const moneyAccs = accs.filter((a) => a.type !== 'Debt' && a.type !== 'Lend').sort((a, b) => order(a) - order(b));
  const prevMoney = $('#txn-account').value;
  fillSelect(
    $('#txn-account'),
    moneyAccs.map((a) => [a.id, a.type === 'Liquid' ? a.name : `${a.name} (${a.type})`]),
    t ? (cfg.personIsFrom ? t.toAccount : t.account) : prevMoney,
  );
  $('#txn-person-label').textContent = cfg.person;
  $('#txn-account-label').textContent = cfg.money;
  $('#txn-fee-field').hidden = !cfg.interest;
  $('#txn-fee-label').innerHTML = cfg.interest ? 'Interest or extra paid <span class="muted">(optional)</span>' : FEE_LABEL;
  $('#txn-due-field').hidden = !cfg.due;
  $('#txn-plan-field').hidden = action !== 'borrow';
  const acc = accById($('#txn-person').value);
  const plan = action === 'repay' && acc ? planInfo(acc) : null;
  $('#txn-due-label').innerHTML =
    action === 'repay' ? 'Next payment due <span class="muted">(optional)</span>'
    : action === 'borrow' ? 'Due date <span class="muted">(optional: first installment, or when it all must be paid)</span>'
    : 'Due date <span class="muted">(optional: when it should be paid back)</span>';
  if (t) {
    $('#txn-due').value = action === 'repay' ? '' : acc?.dueDate || '';
    if (action === 'borrow' && acc?.plan?.txn === t.id) {
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
  const name = prompt(cfg.personType === 'Debt' ? 'Who did you borrow from? (a person, bank, bKash…)' : 'Who did you lend to?')?.trim();
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

function setTxnType(type, t = null, preset = null) {
  txnType = type;
  $$('#txn-type button').forEach((b) => b.classList.toggle('active', b.dataset.type === type));
  const s = settings();
  const accs = accounts();
  const isT = type === 'Transfer';
  const isLoan = type === 'Loan';
  $('#txn-loan-field').hidden = !isLoan;
  $('#txn-person-field').hidden = !isLoan;
  $('#txn-due-field').hidden = true;
  $('#txn-fee-label').innerHTML = FEE_LABEL;
  if (isLoan) {
    $('#txn-category-field').hidden = true;
    $('#txn-to-field').hidden = true;
    $('#txn-loan').value = (t && loanActionOf(t)) || preset?.loan || $('#txn-loan').value || 'borrow';
    return fillLoanFields(t, preset);
  }
  $('#txn-category-field').hidden = isT;
  $('#txn-to-field').hidden = !isT;
  $('#txn-fee-field').hidden = type === 'Income';
  $('#txn-account-label').textContent = type === 'Income' ? 'Received in' : type === 'Expense' ? 'Paid from' : 'From';

  const cats = type === 'Income' ? s.incomeCategories : s.expenseCategories.map((c) => c.name);
  const catList = [...cats];
  if (t?.category && !isT && !catList.includes(t.category)) catList.push(t.category);
  fillSelect($('#txn-category'), catList.map((c) => [c, c]), t?.category);

  // Income/Expense normally touch spendable accounts; show those first.
  const order = (a) => (isT ? 0 : a.type === 'Liquid' ? 0 : 1);
  const accItems = [...accs].sort((a, b) => order(a) - order(b)).map((a) => [a.id, a.type === 'Liquid' ? a.name : `${a.name} (${a.type})`]);
  const prevFrom = $('#txn-account').value;
  // Income and expenses default to a spendable account, never a loan account.
  const prevOk = isT || accById(prevFrom)?.type === 'Liquid';
  const firstLiquid = accs.find((a) => a.type === 'Liquid')?.id;
  fillSelect($('#txn-account'), accItems, t?.account ?? (prevOk ? prevFrom : firstLiquid ?? prevFrom));
  const prevTo = $('#txn-to').value;
  fillSelect($('#txn-to'), accItems, t?.toAccount ?? prevTo);
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
  btn.textContent = `Use ${money2(fee)} · same rate as last time (${(rate * 100).toFixed(2)}%)`;
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
    const name = person ? personName(person.id) : 'them';
    const owed = person ? C.worth(accounts(), state.data.transactions).balances[person.id].value : 0;
    hint = {
      borrow: `Borrowed money is not income. You will owe ${name} more.`,
      repay: `Repaying is not spending: you will owe ${name} less.`,
      lend: `Lending is not spending. ${name} will owe you.`,
      collect: `Getting your money back is not income. ${name} will owe you less.`,
    }[action];
    if (person && owed > 0) hint += LOAN[action].personType === 'Debt' ? ` You owe ${name} ${moneyExact(owed)} now.` : ` ${name} owes you ${moneyExact(owed)} now.`;
    const plan = action === 'repay' && person ? planInfo(person) : null;
    if (plan && !plan.done) hint += ` Installment ${plan.k} of ${plan.n}.`;
    const count = Number($('#txn-plan-count').value);
    const amount = Number($('#txn-amount').value);
    if (action === 'borrow' && count > 1 && amount > 0) {
      const each = (amount + (Number($('#txn-plan-interest').value) || 0)) / count;
      hint += ` You will pay about ${money2(Math.round(each * 100) / 100)} a month for ${count} months.`;
    }
    const interest = Number($('#txn-fee').value);
    if (action === 'repay')
      hint += interest > 0 ? ` The ${money2(interest)} interest is counted as spending (Loan Interest).` : ' Only interest would count as spending.';
    $('#txn-hint').textContent = hint;
    return;
  }
  if (txnType === 'Transfer' && from && to) {
    if (to.type === 'Investment') hint = `Counts as money moved into investments, not spending.`;
    else if (to.type === 'Lend') hint = `You're lending money. ${to.name} will owe you more.`;
    else if (from.type === 'Lend') hint = `${from.name} is paying you back.`;
    else if (to.type === 'Debt') hint = `Paying off what you owe.`;
    else if (from.type === 'Debt') hint = `Borrowing money. What you owe goes up.`;
    else hint = `Moving your own money between accounts. The transfer itself is not spending.`;
  } else if (txnType === 'Expense' && $('#txn-category').value === 'Family Support') {
    hint = 'Money you give to family is spending. If someone is only holding it for you, use Transfer to their account instead.';
  }
  const fee = Number($('#txn-fee').value);
  if (txnType !== 'Income' && fee > 0) {
    hint = `${hint} The ${money2(fee)} charge is taken from ${accById($('#txn-account').value)?.name ?? 'this account'} and counted as spending (Service Charges).`.trim();
  }
  $('#txn-hint').textContent = hint;
}

// `preset` pre-fills a new entry, e.g. { loan: 'repay', person: id }.
function openTxn(t = null, preset = null) {
  if (!state.data.accounts.length) {
    toast('Add an account in Setup first');
    return switchView('setup');
  }
  editing = t;
  $('#txn-title').textContent = t ? 'Edit transaction' : 'Add transaction';
  $('#txn-delete').hidden = !t;
  $('#txn-save-another').hidden = !!t;
  $('#txn-error').hidden = true;
  $('#txn-amount').value = t ? t.amount : '';
  $('#txn-date').value = t ? t.date : C.today();
  $('#txn-note').value = t?.note ?? '';
  $('#txn-fee').value = t?.fee || '';
  $('#txn-due').value = '';
  $('#txn-plan-count').value = '';
  $('#txn-plan-interest').value = '';
  delete $('#txn-amount').dataset.auto;
  const type = t ? (loanActionOf(t) ? 'Loan' : t.type) : preset?.loan ? 'Loan' : txnType;
  setTxnType(type, t, preset);
  $('#txn-dialog').showModal();
  if (!t) $('#txn-amount').focus();
}

async function saveTxn(another) {
  const amount = Number($('#txn-amount').value);
  const err = (m) => {
    $('#txn-error').textContent = m;
    $('#txn-error').hidden = false;
  };
  if (!(amount > 0)) return err('Enter an amount greater than 0.');
  if (!$('#txn-date').value) return err('Pick a date.');
  if (txnType === 'Loan') return saveLoan(amount, another, err);
  const isT = txnType === 'Transfer';
  if (isT && $('#txn-account').value === $('#txn-to').value) return err('From and To must be different accounts.');
  const fee = txnType === 'Income' ? 0 : Number($('#txn-fee').value) || 0;
  if (fee < 0) return err('The service charge cannot be negative.');
  const t = {
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
  };
  try {
    await state.store.saveTxn(t);
    await ensureFeeCategory(t);
  } catch (e) {
    return err(e.message);
  }
  toast(editing ? 'Updated' : `Saved ${txnType.toLowerCase()} of ${money(amount)}${fee ? ` + ${money2(fee)} charge` : ''}`);
  afterSave(another);
}

// Fees and interest get a category in Setup so they can be given a budget.
async function ensureFeeCategory(t) {
  if (!(Number(t.fee) > 0)) return;
  const name = C.feeCategory(t);
  const s = settings();
  if (!s.expenseCategories.some((c) => c.name === name))
    await state.store.saveSettings({ ...s, expenseCategories: [...s.expenseCategories, { name, budget: 0 }] });
}

async function saveLoan(amount, another, err) {
  const action = $('#txn-loan').value;
  const cfg = LOAN[action];
  const person = $('#txn-person').value;
  const moneyAcc = $('#txn-account').value;
  if (!person || person === '__new') return err(cfg.personType === 'Debt' ? 'Choose or add who you borrowed from.' : 'Choose or add the person.');
  if (!moneyAcc) return err('Choose the account the money went into or came out of.');
  const interest = cfg.interest ? Number($('#txn-fee').value) || 0 : 0;
  if (interest < 0) return err('Interest cannot be negative.');
  const t = {
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
    await state.store.saveTxn(t);
    await ensureFeeCategory(t);
    const acc = accById(person);
    let due = $('#txn-due').value;
    const owedNow = C.worth(accounts(), state.data.transactions).balances[person]?.value ?? 0;
    if (owedNow <= 0.004) due = ''; // fully repaid: nothing is due any more
    const count = Math.floor(Number($('#txn-plan-count').value));
    const plan =
      action === 'borrow' && count >= 1
        ? { count, interest: Number($('#txn-plan-interest').value) || 0, principal: amount, date: t.date, txn: t.id }
        : acc?.plan;
    if (acc && ((cfg.due && due !== (acc.dueDate || '')) || plan !== acc.plan))
      await state.store.saveAccount({ ...acc, dueDate: due || undefined, plan });
  } catch (e) {
    return err(e.message);
  }
  const name = personName(person);
  const what = { borrow: `Borrowed ${money(amount)} from ${name}`, repay: `Repaid ${money(amount)} to ${name}`, lend: `Lent ${money(amount)} to ${name}`, collect: `${name} paid back ${money(amount)}` }[action];
  toast(editing ? 'Updated' : what);
  afterSave(another);
}

function afterSave(another) {
  if (another) {
    $('#txn-amount').value = '';
    $('#txn-fee').value = '';
    $('#txn-fee-suggest').hidden = true;
    $('#txn-note').value = '';
    $('#txn-error').hidden = true;
    $('#txn-amount').focus();
  } else $('#txn-dialog').close();
}

// ---------------------------------------------------------------- setup

function renderSetup() {
  const s = settings();
  const w = C.worth(accounts(), state.data.transactions);
  const u = state.user;
  $('#view-setup').innerHTML = `
    <div class="grid2">
      <div class="card">
        <h3>Accounts <button class="btn sm" id="add-acc">+ Add account</button></h3>
        <div class="list">
          ${accounts()
            .map(
              (a) => `<button class="li txn" style="border:0;border-top:1px solid var(--line);border-radius:0;margin:0;padding:10px 2px" data-acc="${esc(a.id)}">
                <span class="mid"><div class="t">${esc(a.name)}<span class="tag">${a.type}</span></div>
                <div class="sub">Opening ${money(a.opening || 0)}${a.notes ? ` · ${esc(a.notes)}` : ''}</div></span>
                <span class="amt num">${a.type === 'Debt' ? '−' : ''}${moneyExact(w.balances[a.id].value)}</span></button>`,
            )
            .join('') || '<p class="muted">No accounts yet.</p>'}
        </div>
      </div>

      <div class="card">
        <h3>Monthly savings goal</h3>
        <div class="field"><label for="goal">Income minus expenses, per month (BDT)</label>
          <input type="number" id="goal" inputmode="decimal" value="${Number(s.savingsGoal) || 0}"></div>
      </div>

      <div class="card">
        <h3>Expense categories &amp; monthly budgets
          <small class="num">total ${money(s.expenseCategories.reduce((a, c) => a + (Number(c.budget) || 0), 0))}</small></h3>
        ${s.expenseCategories
          .map(
            (c, i) => `<div class="edit-row">
              <button class="linkish" style="text-align:left;color:var(--text);font-weight:500" data-rename-exp="${i}" title="Rename">${esc(c.name)}</button>
              <input type="number" inputmode="decimal" data-budget="${i}" value="${Number(c.budget) || 0}" aria-label="Budget for ${esc(c.name)}">
              <button class="icon-btn" data-del-exp="${i}" aria-label="Remove ${esc(c.name)}">✕</button></div>`,
          )
          .join('')}
        <div class="add-row"><input id="new-exp" placeholder="New expense category"><button class="btn" id="add-exp">Add</button></div>
      </div>

      <div class="card">
        <h3>Income sources</h3>
        <div class="chips">
          ${s.incomeCategories
            .map((c, i) => `<span class="chip"><span data-rename-inc="${i}" style="cursor:pointer">${esc(c)}</span><button data-del-inc="${i}" aria-label="Remove ${esc(c)}">✕</button></span>`)
            .join('')}
        </div>
        <div class="add-row"><input id="new-inc" placeholder="New income source"><button class="btn" id="add-inc">Add</button></div>
      </div>

      <div class="card">
        <h3>Appearance</h3>
        <div class="segmented" id="theme-seg" style="display:flex">
          ${[['auto', 'Auto'], ['light', '☀️ Day'], ['dark', '🌙 Night']]
            .map(([v, l]) => `<button data-theme-pref="${v}" style="flex:1" class="${themePref() === v ? 'active' : ''}">${l}</button>`)
            .join('')}
        </div>
        <p class="muted" style="font-size:12px;margin:8px 0 0">Auto follows your phone or computer setting.</p>
      </div>

      <div class="card">
        <h3>Backup &amp; data</h3>
        <div style="display:grid;gap:8px">
          <button class="btn" id="export">Download backup (.json)</button>
          <button class="btn" id="export-csv">Download transactions (.csv)</button>
          <label class="btn" style="text-align:center">Import .json file…
            <input type="file" accept=".json,application/json" id="import" hidden></label>
          <p class="muted" style="font-size:12px;margin:0">After choosing a file you can replace your data or add the file to it.</p>
        </div>
      </div>

      <div class="card">
        <h3>Signed in</h3>
        <p style="margin:0 0 10px">${esc(u.displayName || '')}<br><span class="muted">${esc(u.email || '')}</span></p>
        ${
          state.store.mode === 'drive'
            ? `<p class="muted" style="margin:0 0 10px;font-size:13px">Your data is stored in a private app folder in this Google account's Drive.
               Nobody else can see it, including the people who run this website. Signing out removes it from this device only.</p>
               <button class="btn" id="signout">Sign out</button>`
            : '<p class="muted" style="margin:0;font-size:13px">Demo mode. Add a Google client ID to <code>js/config.js</code> to sign in and sync.</p>'
        }
      </div>
    </div>`;

  const v = $('#view-setup');
  const save = (patch) => state.store.saveSettings({ ...s, ...patch });

  $('#add-acc', v).onclick = () => openAccount();
  $$('[data-acc]', v).forEach((b) => (b.onclick = () => openAccount(accById(b.dataset.acc))));
  $('#goal', v).onchange = (e) => save({ savingsGoal: Number(e.target.value) || 0 }).then(() => toast('Goal saved'));

  $$('[data-budget]', v).forEach(
    (inp) =>
      (inp.onchange = () => {
        const list = s.expenseCategories.map((c, i) => (i === Number(inp.dataset.budget) ? { ...c, budget: Number(inp.value) || 0 } : c));
        save({ expenseCategories: list }).then(() => toast('Budget saved'));
      }),
  );
  $$('[data-del-exp]', v).forEach(
    (b) =>
      (b.onclick = () => {
        const c = s.expenseCategories[Number(b.dataset.delExp)];
        if (!confirm(`Remove "${c.name}"? Past transactions keep this category.`)) return;
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
        if (!confirm(`Remove "${c}"? Past transactions keep this source.`)) return;
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
  $('#export', v).onclick = exportJson;
  $('#export-csv', v).onclick = exportCsv;
  $('#import', v).onchange = (e) => importFile(e.target.files[0]);
  if ($('#signout', v)) $('#signout', v).onclick = () => state.store.signOut();
}

// Renames a category and moves its past transactions with it.
async function renameCategory(type, oldName, buildList) {
  const name = prompt(`Rename "${oldName}" to:`, oldName)?.trim();
  if (!name || name === oldName) return;
  const s = settings();
  const key = type === 'Income' ? 'incomeCategories' : 'expenseCategories';
  await state.store.saveSettings({ ...s, [key]: buildList(name) });
  const affected = state.data.transactions.filter((t) => t.type === type && t.category === oldName);
  for (const t of affected) await state.store.saveTxn({ ...t, category: name });
  toast(`Renamed. ${affected.length} transaction${affected.length === 1 ? '' : 's'} updated.`);
}

// ---------------------------------------------------------------- account dialog

let editingAcc = null;

function setupAccountDialog() {
  const syncType = () => {
    const type = $('#acc-type').value;
    $$('#acc-dialog .inv-only').forEach((el) => (el.hidden = type !== 'Investment'));
    $$('#acc-dialog .loan-only').forEach((el) => (el.hidden = type !== 'Debt' && type !== 'Lend'));
    $('#acc-opening-label').textContent =
      type === 'Debt' ? 'Amount I owed at start' : type === 'Lend' ? 'Amount owed to me at start' : 'Opening balance';
  };
  $('#acc-type').onchange = syncType;
  setupAccountDialog.syncType = syncType;

  $('#acc-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = $('#acc-name').value.trim();
    if (!name) {
      $('#acc-error').textContent = 'Give the account a name.';
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
    toast('Account saved');
  };

  $('#acc-delete').onclick = async () => {
    const used = state.data.transactions.some((t) => t.account === editingAcc.id || t.toAccount === editingAcc.id);
    if (used) {
      $('#acc-error').textContent = 'This account has transactions. Delete or move them first.';
      $('#acc-error').hidden = false;
      return;
    }
    if (!confirm(`Delete "${editingAcc.name}"?`)) return;
    await state.store.deleteAccount(editingAcc.id);
    $('#acc-dialog').close();
  };
}

function openAccount(a = null) {
  editingAcc = a;
  $('#acc-title').textContent = a ? 'Edit account' : 'New account';
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
    `The file has ${d.transactions.length} transactions and ${d.accounts.length} accounts. ` +
    `You currently have ${mine} transaction${mine === 1 ? '' : 's'}.`;
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
    if (!Array.isArray(d.accounts) || !Array.isArray(d.transactions)) throw new Error('This is not an AmrPotli backup file.');
    const hasData = state.data.transactions.length || state.data.accounts.length;
    const mode = hasData ? await askImportMode(d) : 'replace';
    if (mode === 'cancel') return;
    if (mode === 'merge') await state.store.mergeAll(d);
    else await state.store.importAll({ ...d, settings: d.settings || DEFAULT_SETTINGS });
    toast(mode === 'merge' ? `Added ${d.transactions.length} transactions from the file` : `Imported ${d.transactions.length} transactions`);
    switchView('dashboard');
  } catch (e) {
    alert(`Import failed: ${e.message}`);
  } finally {
    $$('input[type=file]').forEach((i) => (i.value = ''));
  }
}

boot();
