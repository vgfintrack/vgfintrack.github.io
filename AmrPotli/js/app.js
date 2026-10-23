import * as C from './calc.js';
import * as R from './reports.js';
import { parseSms } from './sms.js';
import * as G from './guide.js';
import * as Rc from './recurring.js';
import { catIcon, accIcon, productIcon } from './icons.js';
import { attachKeypad, evalExpr, prettyExpr } from './keypad.js';
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
  const r = Math.round(n * 100) / 100 || 0; // no "-0"
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
  if ($('#install-dialog')?.open) drawInstall();
  if (state.data?.loaded && !$('#app').hidden) render();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  if ($('#install-dialog').open) drawInstall('installing');
  markGuide('install');
  toast(t('AmrPotli is installed. Open it from your home screen.'));
  if (state.data?.loaded) render();
});

async function installApp() {
  if (!installPrompt) return openInstall();
  installPrompt.prompt();
  const choice = await installPrompt.userChoice.catch(() => null);
  installPrompt = null;
  if ($('#install-dialog').open) drawInstall(choice?.outcome === 'accepted' ? 'installing' : null);
  if (state.data?.loaded && !$('#app').hidden) render();
}

// ---- the install screen: the right steps for each phone and browser.
// Chrome offers a one-tap install only sometimes (not inside Facebook or
// Messenger, not in Samsung Internet, not for a while after "No"), so the
// screen always has a way forward.

const UA = navigator.userAgent;
const inAppBrowser = () => /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|Line\/|MicroMessenger|; wv\)/i.test(UA);
const isAndroid = () => /android/i.test(UA);
const isSamsung = () => /SamsungBrowser/i.test(UA);
const isFirefox = () => /firefox|fxios/i.test(UA);
let relatedInstalled = false;

async function checkRelated() {
  try {
    relatedInstalled = (await navigator.getInstalledRelatedApps?.())?.length > 0;
  } catch {}
}

function installSituation() {
  if (isInstalled()) return 'standalone';
  if (relatedInstalled) return 'already';
  if (inAppBrowser()) return 'inapp';
  if (installPrompt) return 'prompt';
  if (isIOS()) return 'ios';
  if (isSamsung()) return 'samsung';
  if (isFirefox() && !isAndroid()) return 'firefox';
  return isAndroid() ? 'android' : 'desktop';
}

const step = (n, html) => `<li><span class="step-n">${n}</span><span>${html}</span></li>`;

function drawInstall(override = null) {
  const sit = override || installSituation();
  const here = location.origin + location.pathname;
  const body = {
    standalone: () => `<p class="install-ok">✓ ${t("You're using the installed app.")}</p>`,
    already: () => `<p class="install-ok">✓ ${t('AmrPotli is already installed on this phone. Find it on your home screen or in your app list.')}</p>
      <p class="muted">${t('Using it in the browser is fine too: both show the same data.')}</p>`,
    installing: () => `<p class="install-ok">✓ ${t('Installing… AmrPotli will appear on your home screen in a few seconds.')}</p>`,
    prompt: () => `<div class="install-hero"><img src="icons/icon.svg" alt="" width="72" height="72">
        <ul class="install-points"><li>⚡ ${t('Opens in one tap from your home screen')}</li><li>📶 ${t('Works without internet')}</li><li>🛡️ ${t('No Play Store needed, less than 1 MB')}</li></ul></div>
      <button class="btn primary wide big" data-install-now>📲 ${t('Install')}</button>`,
    inapp: () => `<p>${t("This page is open inside another app (like Facebook or Messenger), which can't install apps.")}</p>
      ${
        isAndroid()
          ? `<a class="btn primary wide big" href="intent://${here.replace(/^https?:\/\//, '')}?install#Intent;scheme=https;package=com.android.chrome;end">🌐 ${t('Open in Chrome')}</a>`
          : `<ol class="install-steps">${step(1, t('Tap <b>⋯</b> at the top or bottom of the screen'))}${step(2, t('Choose <b>Open in Safari</b>'))}${step(3, t('Tap <b>📲 Install the app</b> again there'))}</ol>`
      }
      <button class="btn wide" data-copy-link>🔗 ${t('Copy link')}</button>`,
    ios: () => `<ol class="install-steps">
        ${step(1, t('Tap the Share button <b class="ios-share">⬆︎</b> at the bottom of Safari'))}
        ${step(2, t('Scroll down and tap <b>Add to Home Screen</b> ➕'))}
        ${step(3, t('Tap <b>Add</b> at the top right'))}</ol>
      <p class="muted">${t('Use Safari for this; other iPhone browsers may not show the option.')}</p>`,
    samsung: () => `<ol class="install-steps">
        ${step(1, t('Tap the menu <b>☰</b> at the bottom right'))}
        ${step(2, t('Tap <b>Add page to</b>'))}
        ${step(3, t('Choose <b>Home screen</b>'))}</ol>`,
    android: () => `<ol class="install-steps">
        ${step(1, t('Tap <b>⋮</b> at the top right of Chrome'))}
        ${step(2, t('Tap <b>Install app</b> or <b>Add to Home screen</b>'))}
        ${step(3, t('Tap <b>Install</b>'))}</ol>`,
    desktop: () => `<ol class="install-steps">
        ${step(1, t('Click the install icon <b>⊕</b> at the right end of the address bar'))}
        ${step(2, t('Or open the menu <b>⋮</b> and choose <b>Install AmrPotli</b>'))}</ol>`,
    firefox: () => `<p>${t('Firefox on a computer cannot install web apps. Open this page in Chrome or Edge to install, or keep using it here.')}</p>
      <button class="btn wide" data-copy-link>🔗 ${t('Copy link')}</button>`,
    waiting: () => `<div class="install-wait"><div class="spinner"></div><p class="muted">${t('Getting the app ready…')}</p></div>`,
  }[sit]();
  $('#install-body').innerHTML = body;
  $('[data-install-now]', $('#install-body'))?.addEventListener('click', installApp);
  $('[data-copy-link]', $('#install-body'))?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(`${here}?install`);
      toast(t('Link copied. Paste it in Chrome.'));
    } catch {
      prompt(t('Copy this link:'), `${here}?install`);
    }
  });
}

async function openInstall() {
  const dlg = $('#install-dialog');
  await checkRelated();
  // Chrome may still be deciding; wait a moment before showing the manual steps.
  const mayPrompt = !isInstalled() && !relatedInstalled && !installPrompt && !inAppBrowser() && !isIOS() && !isSamsung() && 'serviceWorker' in navigator;
  drawInstall(mayPrompt ? 'waiting' : null);
  if (!dlg.open) dlg.showModal();
  if (!mayPrompt) return;
  for (let i = 0; i < 16 && !installPrompt && dlg.open; i++) await new Promise((r) => setTimeout(r, 250));
  if (dlg.open) drawInstall();
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
  const body = isInstalled()
    ? `<p style="margin:0">✓ ${t('Installed on this device. It opens from your home screen, even offline.')}</p>`
    : `<p class="muted" style="margin:0 0 10px;font-size:13px">${t('Open AmrPotli from your home screen like any app. It works offline too.')}</p>
       <button class="btn primary" data-install>📲 ${t('Install the app')}</button>`;
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
    if (hasLock() && lockDue()) lockNow();
    else unlocked = true;
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
  $('#btn-install').hidden = isInstalled();
  $('#btn-install').onclick = openInstall;
  // The website's "Install the app" button lands here with ?install.
  if (new URLSearchParams(location.search).has('install')) {
    history.replaceState(null, '', location.pathname);
    if (!isInstalled()) openInstall();
  }
  $$('dialog [data-close]').forEach((b) => (b.onclick = () => b.closest('dialog').close()));
  setupTxnDialog();
  setupAccountDialog();
  setupDeleteDialog();
  setupShopDialogs();
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

// ---------------------------------------------------------------- app lock
// The keypad (lock.js) loads only on devices where a lock is set.

const lockKey = () => `mt:lock:${state.user?.uid}`;
function lockCfg() {
  try {
    return JSON.parse(localStorage.getItem(lockKey()));
  } catch {
    return null;
  }
}
const hasLock = () => !!state.user && !!lockCfg();
const lockModule = () => import('./lock.js');

// The last moment the app was open and unlocked. It survives a refresh, so a
// reload within the "Lock after" time does not ask again; closing the app for
// longer does. Never written while the keypad is up.
let unlocked = false;
const seenKey = () => `mt:lock-seen:${state.user?.uid}`;
function markSeen() {
  if (!unlocked || !state.user) return;
  try {
    localStorage.setItem(seenKey(), String(Date.now()));
  } catch {}
}
function lockDue() {
  let seen = 0;
  try {
    seen = Number(localStorage.getItem(seenKey())) || 0;
  } catch {}
  return Date.now() - seen >= (lockCfg()?.after ?? 60) * 1000;
}

async function lockNow() {
  unlocked = false;
  document.documentElement.classList.add('locked'); // hide the app before the keypad loads
  const L = await lockModule();
  await L.showKeypad({ uid: state.user.uid, onForgot: forgotPin, demo: state.store.mode === 'demo' });
  unlocked = true;
  markSeen();
}

async function forgotPin() {
  if (state.store.mode === 'demo') {
    try {
      localStorage.removeItem('mt:demo');
    } catch {}
    return location.reload();
  }
  await state.store.signOut();
}

// Lock again after the app was in the background for the chosen time.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return markSeen();
  if (unlocked && hasLock() && lockDue()) lockNow();
});
addEventListener('pagehide', markSeen); // a refresh or closing the tab

function lockCard() {
  const cfg = lockCfg();
  if (!cfg)
    return `<div class="card" id="lock-card"><h3>🔒 ${t('App lock')}</h3>
      <p class="muted" style="margin:0 0 10px;font-size:13px">${t('PIN or fingerprint when AmrPotli opens.')}</p>
      <button class="btn primary" data-lock-on>${t('Turn on')}</button></div>`;
  const after = cfg.after ?? 60;
  return `<div class="card" id="lock-card"><h3>🔒 ${t('App lock')} <small>${t('On')}</small></h3>
    <div class="lock-opts">
      <button class="btn sm" data-lock-bio hidden>${cfg.cred ? `✓ ${t('Fingerprint on')}` : `☝ ${t('Add fingerprint')}`}</button>
      <button class="btn sm" data-lock-change>${t('Change PIN')}</button>
      <button class="btn sm danger" data-lock-off>${t('Turn off')}</button>
    </div>
    <h3 style="margin-top:14px">${t('Lock after')}</h3>
    <div class="segmented" style="display:flex">
      ${[[0, 'Immediately'], [60, '1 min'], [300, '5 min']]
        .map(([v, l]) => `<button data-lock-after="${v}" style="flex:1" class="${after === v ? 'active' : ''}">${t(l)}</button>`)
        .join('')}
    </div></div>`;
}

function bindLock(root) {
  const uid = state.user.uid;
  const label = state.user.email || state.user.displayName;
  const on = $('[data-lock-on]', root);
  if (on)
    on.onclick = async () => {
      const L = await lockModule();
      if (!(await L.showKeypad({ uid, mode: 'set', canCancel: true }))) return;
      if ((await L.canBiometric()) && confirm(t('Also unlock with fingerprint or face?'))) await L.enrollBiometric(uid, label).catch(() => toast(t('Fingerprint was not set up.')));
      toast(t('App lock is on'));
      render();
    };
  const unlockFirst = async (L) => L.showKeypad({ uid, mode: 'unlock', canCancel: true });
  const off = $('[data-lock-off]', root);
  if (off)
    off.onclick = async () => {
      const L = await lockModule();
      if (!(await unlockFirst(L))) return;
      L.removeLock(uid);
      toast(t('App lock is off'));
      render();
    };
  const change = $('[data-lock-change]', root);
  if (change)
    change.onclick = async () => {
      const L = await lockModule();
      if (!(await unlockFirst(L))) return;
      if (await L.showKeypad({ uid, mode: 'set', canCancel: true })) toast(t('PIN changed'));
    };
  const bio = $('[data-lock-bio]', root);
  if (bio) {
    lockModule().then(async (L) => {
      if (!(await L.canBiometric())) return;
      bio.hidden = false;
      bio.onclick = async () => {
        if (lockCfg()?.cred) L.removeBiometric(uid);
        else await L.enrollBiometric(uid, label).catch(() => toast(t('Fingerprint was not set up.')));
        render();
      };
    });
  }
  $$('[data-lock-after]', root).forEach(
    (b) =>
      (b.onclick = async () => {
        (await lockModule()).setAfter(uid, Number(b.dataset.lockAfter));
        render();
      }),
  );
}

// ---------------------------------------------------------------- shop: suppliers and stock purchases
// A supplier is a Debt account with a `supplier` record (who they are). A
// purchase is a "Stock Purchase" expense charged to the supplier, which adds
// to what the shop owes them, plus a transfer for whatever was paid on the spot.

const SUPPLIER_KINDS = { company: ['🏭', 'Company'], distributor: ['🚚', 'Distributor'], sr: ['🧑‍💼', 'Sales rep'], wholesale: ['🏬', 'Wholesaler'] };
const DEFAULT_PRODUCTS = ['Rice & Grains', 'Oil & Ghee', 'Spices', 'Tea & Sugar', 'Biscuits & Snacks', 'Drinks', 'Soap & Detergent', 'Toiletries', 'Eggs & Dairy', 'Cigarettes', 'Stationery', 'Other goods'];
const STOCK_CATEGORY = 'Stock Purchase';
const isShopMode = () => settings().mode === 'shop';
const suppliers = () => accounts().filter((a) => a.supplier);
const productGroups = () => settings().productGroups || DEFAULT_PRODUCTS;
const kindIcon = (a) => SUPPLIER_KINDS[a?.supplier?.kind]?.[0] || '🏭';
const supplierLine = (a) => [t(SUPPLIER_KINDS[a.supplier.kind]?.[1] || 'Supplier'), a.supplier.of, a.supplier.place].filter(Boolean).join(' · ');
const owed = (id) => C.worth(accounts(), state.data.transactions).balances[id]?.value ?? 0;
const isPurchase = (x) => x.type === 'Expense' && (x.purchase || x.category === STOCK_CATEGORY);

function suppliersCard(w) {
  const list = suppliers().sort((a, b) => w.balances[b.id].value - w.balances[a.id].value || a.name.localeCompare(b.name));
  const total = list.reduce((s, a) => s + w.balances[a.id].value, 0);
  return `<div class="card" id="suppliers-card">
    <h3>🏭 ${t('Suppliers')} <span><button class="btn sm" data-sup-add>${t('+ Add')}</button> <button class="btn sm primary" data-buy>📦 ${t('Purchase')}</button></span></h3>
    ${
      list.length
        ? `<div class="loan-head"><span>${t('I owe them')}</span><span class="num">${moneyExact(total)}</span></div>
           <div class="list">${list
             .map(
               (a) => `<button class="li sup-row" data-sup="${esc(a.id)}">
                 <span class="mid"><div class="name">${kindIcon(a)} ${esc(a.name)}</div><div class="sub">${esc(supplierLine(a))}</div></span>
                 <span class="num ${w.balances[a.id].value > 0.004 ? 'expense' : ''}">${moneyExact(w.balances[a.id].value)}</span></button>`,
             )
             .join('')}</div>`
        : `<p class="muted" style="margin:0;font-size:13px">${t('Add the companies, sales reps and wholesalers you buy from.')}</p>`
    }
  </div>`;
}

function purchasesCard(month) {
  const buys = state.data.transactions.filter((x) => isPurchase(x) && x.date >= month.start && x.date <= month.end);
  if (!buys.length && !suppliers().length) return '';
  const total = buys.reduce((s, x) => s + Number(x.amount), 0);
  const byProduct = {};
  const bySupplier = {};
  for (const x of buys) {
    bySupplier[x.account] = (bySupplier[x.account] || 0) + Number(x.amount);
    const split = (x.items || []).filter((i) => Number(i.amount) > 0);
    const splitSum = split.reduce((s, i) => s + Number(i.amount), 0);
    for (const i of split) byProduct[i.p] = (byProduct[i.p] || 0) + Number(i.amount);
    const rest = Number(x.amount) - splitSum;
    if (rest > 0.004) {
      const k = (x.items || []).length === 1 ? x.items[0].p : 'Mixed';
      byProduct[k] = (byProduct[k] || 0) + rest;
    }
  }
  const bars = (obj, label, icon) => {
    const rows = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max = rows[0]?.[1] || 1;
    return rows
      .map(
        ([k, v]) => `<div class="mini-bar"><span class="mb-name">${icon(k)} ${esc(label(k))}</span><span class="num">${money(v)}</span>
          <div class="progress"><div style="width:${(v / max) * 100}%"></div></div></div>`,
      )
      .join('');
  };
  return `<div class="card">
    <h3>📦 ${t('Purchases this month')} <small class="num">${money(total)}</small></h3>
    ${
      buys.length
        ? `<div class="mb-sec">${t('By product')}</div>${bars(byProduct, (k) => (k === 'Mixed' ? t('Mixed, not split') : k), (k) => (k === 'Mixed' ? '🧺' : productIcon(k)))}
           <div class="mb-sec">${t('By supplier')}</div>${bars(bySupplier, (k) => accName(k), (k) => kindIcon(accById(k)))}`
        : `<p class="muted" style="margin:0">${t('No purchases yet this month.')}</p>`
    }
  </div>`;
}

function bindShop(root) {
  $$('[data-buy]', root).forEach((b) => (b.onclick = () => openPurchase(b.dataset.buy || null)));
  $$('[data-sup-add]', root).forEach((b) => (b.onclick = () => openSupplier()));
  $$('[data-sup]', root).forEach((b) => (b.onclick = () => openSupplierView(b.dataset.sup)));
}

// ---- purchase form

let buyItems = []; // [{ p, amount }]

function openPurchase(supplierId = null) {
  if (!suppliers().length) return openSupplier(null, (id) => openPurchase(id));
  const sups = suppliers();
  fillSelect($('#buy-supplier'), sups.map((a) => [a.id, `${kindIcon(a)} ${a.name}`]), supplierId || sups[0].id);
  const liquid = accounts().filter((a) => a.type === 'Liquid');
  fillSelect($('#buy-from'), liquid.map((a) => [a.id, a.name]), liquid.find((a) => /cash/i.test(a.name))?.id);
  buyItems = [];
  $('#buy-total').value = '';
  $('#buy-total').readOnly = false;
  $('#buy-paid').value = '';
  $('#buy-memo').value = '';
  $('#buy-date').value = C.today();
  $('#buy-new-product').value = '';
  $('#buy-error').hidden = true;
  renderBuyProducts();
  $('#buy-dialog').showModal();
}

function renderBuyProducts() {
  const chosen = new Set(buyItems.map((i) => i.p));
  const all = [...new Set([...productGroups(), ...chosen])];
  $('#buy-products').innerHTML = `${all
    .map((p) => `<button type="button" class="ob-chip ${chosen.has(p) ? 'on' : ''}" aria-pressed="${chosen.has(p)}" data-product="${esc(p)}">${productIcon(p)} ${esc(p)}</button>`)
    .join('')}
    ${
      buyItems.length
        ? `<div class="buy-items"><p class="muted">${t('Amount for each (optional):')}</p>${buyItems
            .map(
              (i, n) => `<label class="buy-item"><span>${productIcon(i.p)} ${esc(i.p)}</span>
                <input type="number" inputmode="decimal" min="0" step="any" placeholder="৳" value="${i.amount || ''}" data-item="${n}"></label>`,
            )
            .join('')}</div>`
        : ''
    }`;
  $$('[data-product]', $('#buy-products')).forEach(
    (b) =>
      (b.onclick = () => {
        const p = b.dataset.product;
        buyItems = buyItems.some((i) => i.p === p) ? buyItems.filter((i) => i.p !== p) : [...buyItems, { p, amount: 0 }];
        renderBuyProducts();
        syncBuyTotal();
      }),
  );
  $$('[data-item]', $('#buy-products')).forEach(
    (inp) =>
      (inp.oninput = () => {
        buyItems[Number(inp.dataset.item)].amount = Number(inp.value) || 0;
        syncBuyTotal();
      }),
  );
  updateBuyHint();
}

// When items have amounts, the total is their sum.
function syncBuyTotal() {
  const sum = buyItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const split = sum > 0;
  $('#buy-total').readOnly = split;
  if (split) $('#buy-total').value = Math.round(sum * 100) / 100;
  updateBuyHint();
}

function updateBuyHint() {
  const sup = accById($('#buy-supplier').value);
  const total = Number($('#buy-total').value) || 0;
  const paid = Number($('#buy-paid').value) || 0;
  let hint = '';
  if (sup && total > 0) {
    const due = owed(sup.id) + total - paid;
    hint =
      paid >= total
        ? t('Paid in full. You owe {name} {amount} in total.', { name: sup.name, amount: moneyExact(owed(sup.id)) })
        : t('{amount} goes on baki. You will owe {name} {due} in total.', { amount: moneyExact(total - paid), name: sup.name, due: moneyExact(due) });
  }
  $('#buy-hint').textContent = hint;
}

function setupShopDialogs() {
  $('#buy-supplier').onchange = updateBuyHint;
  $('#buy-total').oninput = updateBuyHint;
  $('#buy-paid').oninput = updateBuyHint;
  $('#buy-paid-all').onclick = () => {
    $('#buy-paid').value = $('#buy-total').value;
    updateBuyHint();
  };
  $('#buy-paid-none').onclick = () => {
    $('#buy-paid').value = '';
    updateBuyHint();
  };
  $('#buy-new-supplier').onclick = () => {
    $('#buy-dialog').close();
    openSupplier(null, (id) => openPurchase(id));
  };
  const addProduct = () => {
    const p = $('#buy-new-product').value.trim().replace(/\s+/g, ' ');
    if (!p) return;
    const known = productGroups().find((x) => x.toLowerCase() === p.toLowerCase());
    const name = known || p;
    if (!known) state.store.saveSettings({ ...settings(), productGroups: [...productGroups(), name] });
    if (!buyItems.some((i) => i.p === name)) buyItems.push({ p: name, amount: 0 });
    $('#buy-new-product').value = '';
    renderBuyProducts();
  };
  $('#buy-add-product').onclick = addProduct;
  $('#buy-new-product').onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addProduct();
    }
  };
  $('#buy-form').onsubmit = async (e) => {
    e.preventDefault();
    const err = (m) => {
      $('#buy-error').textContent = m;
      $('#buy-error').hidden = false;
    };
    const sup = $('#buy-supplier').value;
    const total = Number($('#buy-total').value);
    const paid = Number($('#buy-paid').value) || 0;
    if (!(total > 0)) return err(t('Enter an amount greater than 0.'));
    if (paid < 0 || paid > total + 0.004) return err(t('Paid now cannot be more than the total.'));
    if (!$('#buy-date').value) return err(t('Pick a date.'));
    const pid = newId();
    const date = $('#buy-date').value;
    const items = buyItems.map((i) => ({ p: i.p, ...(Number(i.amount) > 0 && { amount: Number(i.amount) }) }));
    const s = settings();
    if (!s.expenseCategories.some((c) => c.name === STOCK_CATEGORY))
      await state.store.saveSettings({ ...s, expenseCategories: [{ name: STOCK_CATEGORY, budget: 0 }, ...s.expenseCategories] });
    await state.store.saveTxn({
      type: 'Expense',
      amount: total,
      date,
      category: STOCK_CATEGORY,
      account: sup,
      note: items.map((i) => i.p).join(', '),
      items: items.length ? items : undefined,
      memo: $('#buy-memo').value.trim() || undefined,
      purchase: pid,
    });
    if (paid > 0)
      await state.store.saveTxn({ type: 'Transfer', amount: paid, date, category: 'Transfer', account: $('#buy-from').value, toAccount: sup, note: '', purchase: pid });
    $('#buy-dialog').close();
    toast(paid >= total ? t('Purchase saved, paid in full') : t('Purchase saved · {amount} on baki', { amount: money(total - paid) }));
  };

  // supplier form
  $$('#sup-kind [data-kind]').forEach((b) => (b.onclick = () => setSupKind(b.dataset.kind)));
  $('#sup-form').onsubmit = async (e) => {
    e.preventDefault();
    const err = (m) => {
      $('#sup-error').textContent = m;
      $('#sup-error').hidden = false;
    };
    const name = $('#sup-name').value.trim().replace(/\s+/g, ' ');
    if (!name) return err(t('Enter a name.'));
    if (state.data.accounts.some((a) => a.id !== supEdit?.id && a.name.toLowerCase() === name.toLowerCase())) return err(t('You already have an account with this name.'));
    const due = Number($('#sup-due').value) || 0;
    if (due < 0) return err(t('Baki cannot be negative.'));
    const id = supEdit?.id || newId();
    const opening = supEdit ? (supEdit.opening || 0) + (due - owed(supEdit.id)) : due;
    const supplier = {
      kind: supKind,
      of: ['distributor', 'sr'].includes(supKind) ? $('#sup-of').value.trim() || undefined : undefined,
      place: ['wholesale', 'distributor'].includes(supKind) ? $('#sup-place').value.trim() || undefined : undefined,
      phone: $('#sup-phone').value.trim() || undefined,
    };
    await state.store.saveAccount({ ...(supEdit || {}), id, name, type: 'Debt', opening: Math.round(opening * 100) / 100, supplier, order: supEdit?.order ?? 50 });
    $('#sup-dialog').close();
    toast(supEdit ? t('Updated') : t('Supplier added'));
    const after = supAfter;
    supAfter = null;
    after?.(id);
  };
}

let supEdit = null;
let supAfter = null;
let supKind = 'wholesale';

function setSupKind(kind) {
  supKind = kind;
  $$('#sup-kind [data-kind]').forEach((b) => {
    b.classList.toggle('on', b.dataset.kind === kind);
    b.setAttribute('aria-checked', b.dataset.kind === kind);
  });
  $('#sup-name-label').textContent = t({ company: 'Company name', distributor: 'Distributor name', sr: "Sales rep's name", wholesale: 'Shop name' }[kind]);
  $('#sup-of-field').hidden = !['distributor', 'sr'].includes(kind);
  $('#sup-place-field').hidden = !['wholesale', 'distributor'].includes(kind);
}

function openSupplier(a = null, after = null) {
  supEdit = a;
  supAfter = after;
  $('#sup-title').textContent = a ? t('Edit supplier') : t('New supplier');
  $('#sup-name').value = a?.name || '';
  $('#sup-of').value = a?.supplier?.of || '';
  $('#sup-place').value = a?.supplier?.place || '';
  $('#sup-phone').value = a?.supplier?.phone || '';
  $('#sup-due').value = a ? Math.round(owed(a.id) * 100) / 100 || '' : '';
  $('#sup-error').hidden = true;
  setSupKind(a?.supplier?.kind || 'wholesale');
  $('#sup-dialog').showModal();
  $('#sup-name').focus();
}

function openSupplierView(id) {
  const a = accById(id);
  if (!a) return;
  const month = C.monthRange(C.today());
  const txns = state.data.transactions.filter((x) => x.account === id || x.toAccount === id).sort(txnSort);
  const bought = txns.filter((x) => isPurchase(x) && x.date >= month.start && x.date <= month.end).reduce((s, x) => s + Number(x.amount), 0);
  $('#supv-title').textContent = `${kindIcon(a)} ${a.name}`;
  $('#supv-body').innerHTML = `
    <p class="muted" style="margin:0 0 12px">${esc(supplierLine(a))}${a.supplier.phone ? ` · <a href="tel:${esc(a.supplier.phone)}">📞 ${esc(a.supplier.phone)}</a>` : ''}</p>
    <div class="sup-stats">
      <div><span>${t('I owe them')}</span><strong class="num expense">${moneyExact(owed(id))}</strong></div>
      <div><span>${t('Bought this month')}</span><strong class="num">${money(bought)}</strong></div>
    </div>
    <div class="sup-actions">
      <button class="btn primary" data-supv="buy">📦 ${t('Purchase')}</button>
      <button class="btn" data-supv="pay">💵 ${t('Pay')}</button>
      <button class="btn" data-supv="edit">✏️ ${t('Edit')}</button>
    </div>
    <h3 style="margin:16px 0 4px">${t('History')}</h3>
    <div class="txn-list">${txns.slice(0, 20).map(txnRow).join('') || `<p class="muted">${t('Nothing yet.')}</p>`}</div>`;
  const body = $('#supv-body');
  $('[data-supv=buy]', body).onclick = () => {
    $('#supv-dialog').close();
    openPurchase(id);
  };
  $('[data-supv=pay]', body).onclick = () => {
    $('#supv-dialog').close();
    paySupplier(id);
  };
  $('[data-supv=edit]', body).onclick = () => {
    $('#supv-dialog').close();
    openSupplier(a);
  };
  $$('.txn', body).forEach(
    (el) =>
      (el.onclick = () => {
        $('#supv-dialog').close();
        openTxn(state.data.transactions.find((x) => x.id === el.dataset.id));
      }),
  );
  $('#supv-dialog').showModal();
}

function productsCard() {
  return `<div class="card" id="products-card">
    <h3>📦 ${t('Products you buy')}</h3>
    <div class="chips">${productGroups()
      .map((p, i) => `<span class="chip">${productIcon(p)} ${esc(p)}<button data-del-prod="${i}" aria-label="${esc(t('Remove {name}', { name: p }))}">✕</button></span>`)
      .join('')}</div>
    <div class="add-row"><input id="new-prod" placeholder="${esc(t('New product group'))}" maxlength="30"><button class="btn" id="add-prod">${t('Add')}</button></div>
  </div>`;
}

function bindProducts(root) {
  const save = (list) => state.store.saveSettings({ ...settings(), productGroups: list });
  $$('[data-del-prod]', root).forEach((b) => (b.onclick = () => save(productGroups().filter((_, i) => i !== Number(b.dataset.delProd)))));
  const add = $('#add-prod', root);
  if (!add) return;
  add.onclick = () => {
    const name = $('#new-prod', root).value.trim().replace(/\s+/g, ' ');
    if (!name || productGroups().some((p) => p.toLowerCase() === name.toLowerCase())) return;
    save([...productGroups(), name]);
  };
}

function paySupplier(id) {
  txnType = 'Transfer';
  openTxn();
  const from = accounts().find((a) => a.type === 'Liquid' && /cash/i.test(a.name)) || accounts().find((a) => a.type === 'Liquid');
  if (from) $('#txn-account').value = from.id;
  $('#txn-to').value = id;
  const due = owed(id);
  if (due > 0) $('#txn-amount').value = Math.round(due * 100) / 100;
  updateTxnHint();
}

// ---------------------------------------------------------------- quick actions
// The Dashboard's grid of one-tap actions, an icon and a word each.

const QUICK = [
  ['Expense', '💸', 'Expense'],
  ['Income', '💰', 'Income'],
  ['Transfer', '🔁', 'Transfer'],
  ['Loan', '🤝', 'Loan'],
  ['sms', '📋', 'Paste SMS'],
  ['regular', '🗓️', 'Regular'],
  ['budget', '🎯', 'Budget'],
  ['report', '📄', 'Statement'],
];

// A shop's grid: sell, buy stock, pay costs and suppliers.
const QUICK_SHOP = [
  ['Income', '🛍️', 'Sale'],
  ['buy', '📦', 'Purchase'],
  ['Expense', '💸', 'Cost'],
  ['paysup', '💵', 'Pay supplier'],
  ['suppliers', '🏭', 'Suppliers'],
  ['sms', '📋', 'Paste SMS'],
  ['Transfer', '🔁', 'Transfer'],
  ['report', '📄', 'Statement'],
];

function quickActions() {
  const list = isShopMode() ? QUICK_SHOP : QUICK;
  return `<nav class="quick" aria-label="${esc(t('Quick actions'))}">${list.map(
    ([id, icon, label]) => `<button data-quick="${id}"><span class="qi" aria-hidden="true">${icon}</span><span>${t(label)}</span></button>`,
  ).join('')}</nav>`;
}

function quickAction(id) {
  if (['Expense', 'Income', 'Transfer', 'Loan'].includes(id)) {
    txnType = id;
    return openTxn();
  }
  if (id === 'buy') return openPurchase();
  if (id === 'paysup') {
    const w = C.worth(accounts(), state.data.transactions);
    const top = suppliers().sort((a, b) => w.balances[b.id].value - w.balances[a.id].value)[0];
    return top ? paySupplier(top.id) : openSupplier();
  }
  if (id === 'suppliers') return $('#suppliers-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (id === 'regular') {
    switchView('setup');
    return setTimeout(() => $('#rules-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }
  guideAction(id);
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
  if (id === 'expense' && isShopMode()) return openPurchase();
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
  } else if (id === 'install') installApp(); else if (id === 'report') switchView('reports');
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
  // A shop's potli speaks of sales, costs and profit.
  const shop = s.mode === 'shop';
  const W = (personal, forShop) => t(shop ? forShop : personal);
  const rateSub = isWeek ? t('Tuition is paid monthly, so check the month view') : W('of income kept', 'of sales kept');

  const byType = (t) => accs.filter((a) => a.type === t);
  const accRows = (list, sign = '') =>
    list
      .map(
        (a) => `<div class="li"><span class="name"><span class="li-ic" aria-hidden="true">${accIcon(a)}</span>${esc(a.name)}</span>
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
    ${quickActions()}
    ${dueCard()}
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
      <div class="kpi"><div class="k">${W('Income', 'Sales')}</div><div class="v num income">${money(st.income)}</div>
        <div class="s">${tn(Object.keys(income).length, '{n} source', '{n} sources')}</div></div>
      <div class="kpi"><div class="k">${W('Expenses', 'Costs')}</div><div class="v num expense">${money(st.expenses)}</div>
        <div class="s">${t('{amount} / day', { amount: money(st.avgPerDay) })}</div></div>
      <div class="kpi"><div class="k">${W('Net saved', 'Profit')}</div><div class="v num">${money(st.net)}</div>
        <div class="s">${st.toInvestments ? t('{amount} into investments', { amount: money(st.toInvestments) }) : t('Income minus expenses')}</div></div>
      <div class="kpi"><div class="k">${W('Savings rate', 'Profit margin')}</div><div class="v num">${rateText}</div>
        <div class="s">${rateSub}</div></div>
    </div>

    ${
      goal > 0
        ? `<div class="card">
      <h3>${isWeek ? W('Weekly savings goal', 'Weekly profit goal') : W('Monthly savings goal', 'Monthly profit goal')} <small class="num">${t('{a} of {b}', { a: money(Math.max(st.net, 0)), b: money(goal) })}</small></h3>
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
            const ratio = b > 0 ? m / b : 0;
            const left = b - m;
            return `<div class="budget ${b > 0 ? '' : 'no-budget'}">
              <div class="top"><span><span class="li-ic" aria-hidden="true">${catIcon(c.name)}</span>${esc(c.name)}</span>
                <span class="r num">${money(m)} / ${money(b)}${isWeek ? ` · ${t('week {amount}', { amount: money(spent[c.name] || 0) })}` : ''}</span></div>
              <div class="progress ${budgetClass(ratio)}"><div style="width:${Math.min(100, ratio * 100)}%"></div></div>
              <div class="left ${b > 0 && left < 0 ? 'bad' : ''}">${
                b > 0 ? (left < 0 ? t('Over by {amount}', { amount: money(-left) }) : t('{amount} left', { amount: money(left) })) : t('No budget set')
              }</div>
            </div>`;
          })
          .join('') || `<p class="muted">${t('Set monthly budgets in Setup.')}</p>`}
      </div>

      ${isShopMode() ? suppliersCard(w) + purchasesCard(month) : ''}
      ${loansCard(accs, w)}
      ${comingUpCard()}

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
  bindRecurring($('#view-dashboard'));
  bindShop($('#view-dashboard'));
  $$('[data-quick]').forEach((b) => (b.onclick = () => quickAction(b.dataset.quick)));
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
  const open = (type) => accs.filter((a) => a.type === type && !a.supplier && w.balances[a.id].value > 0.004);
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
  if (accById(t.account)?.supplier || accById(t.toAccount)?.supplier) return null; // paying a supplier is not a loan
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
  const toSupplier = isT && accById(x.toAccount)?.supplier;
  const title = loanTitle
    ? loanTitle()
    : x.purchase && x.type === 'Expense'
      ? `${L('Purchase')} · ${accName(x.account)}`
      : toSupplier
        ? L('Paid {name}', { name: accName(x.toAccount) })
        : isT
          ? `${accName(x.account)} → ${accName(x.toAccount)}`
          : x.category;
  const moneyAcc = loan === 'borrow' || loan === 'collect' ? x.toAccount : x.account;
  const feeWord = x.feeCategory === C.INTEREST_CATEGORY ? L('interest {amount}', { amount: money2(Number(x.fee)) }) : L('charge {amount}', { amount: money2(Number(x.fee)) });
  const sub = [
    loan ? `${L('Loan')} · ${accName(moneyAcc)}` : isT ? L('Transfer') : accName(x.account),
    Number(x.fee) && x.type !== 'Income' ? feeWord : '',
    x.recurring ? `↻ ${L('regular')}` : '',
    x.memo ? `${L('Memo')} ${x.memo}` : '',
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
  const icon = loanActionOf(t)
    ? '🤝'
    : t.purchase && t.type === 'Expense'
      ? '📦'
      : t.type === 'Transfer'
        ? accById(t.toAccount)?.supplier
          ? '💵'
          : '🔁'
        : catIcon(t.category);
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
let occ = null; // { rule, date } when adding a due regular payment with changes
let feeOpen = false; // the service charge box, folded away until it is needed

function setupTxnDialog() {
  $$('#txn-type button').forEach((b) => (b.onclick = () => setTxnType(b.dataset.type)));
  $('#txn-form').onsubmit = (e) => {
    e.preventDefault();
    saveTxn(false);
  };
  $('#txn-save-another').onclick = () => saveTxn(true);
  $('#txn-repeat').onchange = updateRepeatHint;
  $('#txn-fee-add').onclick = () => {
    feeOpen = true;
    showFee();
    $('#txn-fee').focus();
  };
  $('#txn-dialog').addEventListener('close', () => (occ = null));
  $('#txn-date').addEventListener('change', updateRepeatHint);
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
  // The calculator pad shows while the amount is being entered, and folds
  // away when another field is used.
  keypad = attachKeypad($('#txn-amount'), $('#calc-pad'), $('#calc-result'), { onChange: () => $('#txn-amount').dispatchEvent(new Event('input')) });
  $('#txn-amount').addEventListener('focus', () => ($('#calc-pad').hidden = false));
  // Only typing in another box folds the pad; tapping a button must not move
  // the sheet under the finger (the tap would then miss).
  $('#txn-form').addEventListener('focusin', (e) => {
    if (e.target !== $('#txn-amount') && e.target.matches('input, select, textarea')) $('#calc-pad').hidden = true;
  });
  $('#txn-fee').oninput = () => {
    feeOpen = true; // keep the box while the user edits it, even when emptied
    updateTxnHint();
  };
  $('#txn-plan-count').oninput = updateTxnHint;
  $('#txn-plan-interest').oninput = updateTxnHint;
  $('#sms-btn').onclick = openSmsPanel;
  // Voice: shown only where the phone can listen; its code loads on the first tap.
  $('#voice-btn').hidden = !(window.SpeechRecognition || window.webkitSpeechRecognition);
  $('#voice-btn').onclick = speakEntry;
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

async function speakEntry() {
  const btn = $('#voice-btn');
  if (btn.classList.contains('listening')) return (await import('./voice.js')).listen.stop?.();
  // Answer the tap at once; the voice code (small) loads while the user starts talking.
  btn.classList.add('listening');
  btn.textContent = `🎙️ ${t('Listening…')}`;
  showSmsInfo(`🎤 ${esc(t('Say what you spent, for example: "ডিম দেড়শো, মাছ সাড়ে চারশো"'))}`);
  try {
    const V = await import('./voice.js');
    const heard = await V.listen(lang === 'bn' ? 'bn-BD' : 'en-IN');
    const s = settings();
    const r = V.parseSpeech(heard, { expense: s.expenseCategories.map((c) => c.name), income: s.incomeCategories });
    if (!r) return showSmsInfo(`🎤 “${esc(heard)}”<br>${esc(t("Couldn't find an amount. Try again, and say the taka amount."))}`, true);
    setTxnType(r.type);
    $('#txn-amount').value = r.expr;
    $('#txn-amount').dataset.itemized = prettyExpr(r.expr);
    if (r.category) $('#txn-category').value = r.category;
    $('#txn-note').value = r.note;
    updateTxnHint();
    showSmsInfo(`🎤 “${esc(heard)}”<br>✓ ${esc(t('Filled in. Check and tap Save.'))}`);
  } catch (e) {
    const msg = {
      'not-allowed': 'Allow the microphone for this site to use voice.',
      'service-not-allowed': 'Allow the microphone for this site to use voice.',
      network: 'Voice needs an internet connection.',
      'no-speech': "Didn't hear anything. Tap 🎤 and speak again.",
    }[e] || "Voice didn't work this time. You can type instead.";
    showSmsInfo(esc(t(msg)), true);
  } finally {
    btn.classList.remove('listening');
    btn.textContent = t('🎤 Speak');
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

// Category tiles: the real <select> stays (hidden) and holds the value; the
// tiles mirror it, so code that sets the select only needs syncCatGrid().
function syncCatGrid() {
  const sel = $('#txn-category');
  const grid = $('#txn-cat-grid');
  const opts = [...sel.options];
  const key = opts.map((o) => o.value).join('|');
  if (grid.dataset.key !== key) {
    grid.dataset.key = key;
    grid.innerHTML = opts
      .map((o) => `<button type="button" role="radio" data-cat="${esc(o.value)}"><span aria-hidden="true">${catIcon(o.value)}</span><small>${esc(o.textContent)}</small></button>`)
      .join('');
    $$('[data-cat]', grid).forEach(
      (b) =>
        (b.onclick = () => {
          sel.value = b.dataset.cat;
          syncCatGrid();
        }),
    );
  }
  $$('[data-cat]', grid).forEach((b) => {
    const on = b.dataset.cat === sel.value;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on);
  });
}

// The amount box may hold a sum ("60+80+150"); this is its total.
let keypad = null;
const amountValue = () => evalExpr($('#txn-amount').value).value;

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
  const people = accs.filter((a) => a.type === cfg.personType && !a.supplier);
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
  $('#txn-fee-add').hidden = true;
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
  $('#txn-repeat-field').hidden = isLoan || !!editing || !!occ;
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
  $('#txn-plan-field').hidden = true; // installments belong to "I borrowed money" only
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
  const amount = amountValue();
  const from = $('#txn-account').value;
  const to = txnType === 'Transfer' ? $('#txn-to').value : null;
  btn.hidden = true;
  if (txnType === 'Loan') return;
  if (txnType === 'Income' || !(amount > 0) || Number($('#txn-fee').value) > 0) return showFee();
  const past = state.data.transactions
    .filter((t) => t.type === txnType && t.account === from && Number(t.fee) > 0 && Number(t.amount) > 0 && t.id !== editing?.id)
    .sort((a, b) => (b.toAccount === to) - (a.toAccount === to) || txnSort(a, b));
  if (!past.length) return;
  const rate = Number(past[0].fee) / Number(past[0].amount);
  const fee = Math.round(amount * rate * 100) / 100;
  btn.dataset.fee = fee;
  btn.textContent = t('Use {amount} · same rate as last time ({rate}%)', { amount: money2(fee), rate: (rate * 100).toFixed(2) });
  btn.hidden = false;
  showFee();
}

// Expenses and transfers can carry a charge, but most don't: the box shows
// when asked for, when it has a value, or when this account had charges before
// (a bKash cash-out). Income never has one.
function showFee() {
  const can = txnType === 'Expense' || txnType === 'Transfer';
  const show = can && (feeOpen || Number($('#txn-fee').value) > 0 || !$('#txn-fee-suggest').hidden);
  $('#txn-fee-field').hidden = !show;
  $('#txn-fee-add').hidden = !can || show;
}

function updateTxnHint() {
  keypad?.refresh();
  updateFeeSuggestion();
  syncCatGrid();
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
    const amount = amountValue();
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
  feeOpen = Number(x?.fee) > 0;
  $('#txn-repeat').value = '';
  $('#txn-repeat-hint').hidden = true;
  $('#calc-pad').hidden = true;
  delete $('#txn-amount').dataset.auto;
  delete $('#txn-amount').dataset.itemized;
  const type = x ? (loanActionOf(x) ? 'Loan' : x.type) : preset?.loan ? 'Loan' : txnType;
  setTxnType(type, x, preset);
  $('#txn-dialog').showModal();
  if (!x) $('#txn-amount').focus();
}

// A sum like "60 + 80 + 150" is kept in the note, so the parts are not lost.
function noteWithSum() {
  const note = $('#txn-note').value.trim();
  const raw = $('#txn-amount').value;
  if (!evalExpr(raw).isSum) return note;
  const sum = prettyExpr(raw);
  // Voice already wrote the items with their amounts; don't repeat them.
  if ($('#txn-amount').dataset.itemized === sum) return note;
  return note.includes(sum) ? note : [note, sum].filter(Boolean).join(' · ');
}

async function saveTxn(another) {
  const amount = amountValue();
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
    note: noteWithSum(),
    fee: fee > 0 ? fee : undefined,
    feeCategory: undefined,
    loan: undefined,
    ref: smsRef || editing?.ref || undefined,
  };
  const every = !editing && !occ ? $('#txn-repeat').value : '';
  const ruleId = every ? newId() : occ?.rule.id;
  if (ruleId) x.recurring = ruleId;
  try {
    await state.store.saveTxn(x);
    await ensureFeeCategory(x);
    if (every)
      await saveRules([
        ...rules(),
        { id: ruleId, type: x.type, amount, category: x.category, account: x.account, toAccount: x.toAccount, fee: x.fee, note: x.note, every, start: x.date, lastDone: x.date },
      ]);
    if (occ) await markRule(occ.rule.id, occ.date);
  } catch (e) {
    return err(e.message);
  }
  if (every) setTimeout(() => toast(t('Saved as a regular payment. AmrPotli will remind you when it is due.')), 2700);
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
    note: noteWithSum(),
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
  occ = null;
  $('#txn-repeat').value = '';
  $('#txn-repeat-hint').hidden = true;
  $('#sms-info').hidden = true;
  if (another) {
    $('#txn-amount').value = '';
    $('#txn-fee').value = '';
    $('#txn-fee-suggest').hidden = true;
    feeOpen = false;
    showFee();
    $('#txn-note').value = '';
    $('#txn-error').hidden = true;
    $('#txn-amount').focus();
  } else $('#txn-dialog').close();
}

// ---------------------------------------------------------------- regular payments
// Rules live in settings (recurring.js has the date logic). Due items wait on
// the Dashboard for one tap: Add, Change (opens the form) or Skip.

const rules = () => settings().recurring || [];
const saveRules = (list) => state.store.saveSettings({ ...settings(), recurring: list });
const ruleName = (r) =>
  r.note || (r.type === 'Transfer' ? `${accName(r.account)} → ${accName(r.toAccount)}` : r.category);
const ruleCls = (r) => (r.type === 'Income' ? 'income' : r.type === 'Expense' ? 'expense' : 'transfer');
const ruleSign = (r) => (r.type === 'Income' ? '+' : r.type === 'Expense' ? '−' : '');

// The latest date handled; never moves backwards.
function markRule(id, date) {
  return saveRules(rules().map((r) => (r.id === id && date > (r.lastDone || '') ? { ...r, lastDone: date } : r)));
}

function everyText(r) {
  if (r.every === 'week') return t('Every week on {day}', { day: C.parseDate(r.start).toLocaleDateString(dateLocale(), { weekday: 'long' }) });
  return t('Every month on day {d}', { d: C.parseDate(r.start).getDate() });
}

function updateRepeatHint() {
  const every = $('#txn-repeat').value;
  const el = $('#txn-repeat-hint');
  el.hidden = !every;
  if (!every) return;
  const start = $('#txn-date').value || C.today();
  el.textContent = `${everyText({ every, start })}. ${t('You will get a reminder on the Dashboard; nothing is added without your tap.')}`;
}

function dueCard() {
  const list = Rc.due(rules(), C.today());
  if (!list.length) return '';
  return `<div class="card due-card">
    <h3>${t('Due now')} <small>${t('regular payments')}</small></h3>
    ${list
      .map(({ rule: r, dates }) => {
        const more = dates.length - 1;
        return `<div class="due-row">
          <div class="mid"><strong>${esc(ruleName(r))}</strong>
            <div class="sub"><span class="num ${ruleCls(r)}">${ruleSign(r)}${money(r.amount)}</span> · ${esc(accName(r.account))} · ${niceDate(dates[0], { day: 'numeric', month: 'short' })}${
              more ? ` · <strong>${t('{n} more due', { n: more })}</strong>` : ''
            }</div></div>
          <div class="due-actions">
            <button class="btn sm" data-rskip="${esc(r.id)}">${t('Skip')}</button>
            <button class="btn sm" data-rchange="${esc(r.id)}">${t('Change')}</button>
            <button class="btn sm primary" data-radd="${esc(r.id)}">${t('Add')}</button>
          </div></div>`;
      })
      .join('')}
  </div>`;
}

function comingUpCard() {
  if (!rules().length) return '';
  const today = C.today();
  const list = Rc.upcoming(rules(), today, C.monthRange(today).end);
  const out = list.filter((x) => x.rule.type === 'Expense').reduce((s, x) => s + Number(x.rule.amount), 0);
  const inc = list.filter((x) => x.rule.type === 'Income').reduce((s, x) => s + Number(x.rule.amount), 0);
  return `<div class="card">
    <h3>${t('Coming up this month')} <small class="num">${[out ? `${t('to pay')} ${money(out)}` : '', inc ? `${t('to receive')} ${money(inc)}` : ''].filter(Boolean).join(' · ')}</small></h3>
    ${
      list.length
        ? `<div class="list">${list
            .slice(0, 6)
            .map(
              ({ rule: r, date }) => `<div class="li"><span class="name">${niceDate(date, { day: 'numeric', month: 'short' })} · ${esc(ruleName(r))}</span>
              <span class="num ${ruleCls(r)}">${ruleSign(r)}${money(r.amount)}</span></div>`,
            )
            .join('')}</div>`
        : `<p class="muted" style="margin:0">${t('Nothing else this month.')}</p>`
    }
  </div>`;
}

function rulesCard() {
  const list = rules();
  return `<div class="card" id="rules-card">
    <h3>${t('Regular payments')}</h3>
    ${
      list.length
        ? list
            .map((r) => {
              const next = r.paused ? null : Rc.nextAfter(r, r.lastDone || C.addDays(r.start, -1));
              return `<div class="rule-row">
                <div class="mid"><strong>${esc(ruleName(r))}</strong>
                  <div class="sub">${t(r.type)} · ${esc(accName(r.account))} · ${everyText(r)}${
                    r.paused ? ` · <strong>${t('Paused')}</strong>` : next ? ` · ${t('next {date}', { date: niceDate(next, { day: 'numeric', month: 'short' }) })}` : ''
                  }</div></div>
                <input type="number" inputmode="decimal" min="0" step="any" value="${Number(r.amount)}" data-ramount="${esc(r.id)}" aria-label="${esc(t('Amount for {name}', { name: ruleName(r) }))}">
                <div class="rule-actions">
                  <button class="btn sm" data-rpause="${esc(r.id)}">${r.paused ? t('Resume') : t('Pause')}</button>
                  <button class="icon-btn" data-rdel="${esc(r.id)}" aria-label="${esc(t('Remove {name}', { name: ruleName(r) }))}">✕</button>
                </div></div>`;
            })
            .join('')
        : `<p class="muted" style="margin:0;font-size:13px">🗓️ ${t('Rent, tuition, DPS… Add a transaction and choose Repeat.')}</p>`
    }
  </div>`;
}

function bindRecurring(root) {
  const find = (id) => rules().find((r) => r.id === id);
  $$('[data-radd]', root).forEach(
    (b) =>
      (b.onclick = async () => {
        const r = find(b.dataset.radd);
        const date = Rc.dueDates(r, C.today())[0];
        // A deleted account: let the user pick another in the form.
        if (!accById(r.account) || (r.type === 'Transfer' && !accById(r.toAccount))) return changeDue(r, date);
        b.disabled = true;
        const x = Rc.txnFor(r, date);
        await state.store.saveTxn(x);
        await ensureFeeCategory(x);
        await markRule(r.id, date);
        toast(t('Added {name}: {amount}', { name: ruleName(r), amount: money(r.amount) }));
      }),
  );
  $$('[data-rskip]', root).forEach(
    (b) =>
      (b.onclick = async () => {
        const r = find(b.dataset.rskip);
        const date = Rc.dueDates(r, C.today())[0];
        await markRule(r.id, date);
        toast(t('Skipped {name} for {date}', { name: ruleName(r), date: niceDate(date, { day: 'numeric', month: 'short' }) }));
      }),
  );
  $$('[data-rchange]', root).forEach((b) => (b.onclick = () => changeDue(find(b.dataset.rchange))));
  $$('[data-ramount]', root).forEach(
    (inp) =>
      (inp.onchange = () => {
        const amount = Number(inp.value);
        if (!(amount > 0)) return toast(t('Enter an amount greater than 0.'));
        saveRules(rules().map((r) => (r.id === inp.dataset.ramount ? { ...r, amount } : r))).then(() => toast(t('Saved')));
      }),
  );
  $$('[data-rpause]', root).forEach(
    (b) =>
      (b.onclick = () => {
        // Resuming starts from today, so months while paused are not all due at once.
        const today = C.today();
        saveRules(rules().map((r) => (r.id === b.dataset.rpause ? (r.paused ? { ...r, paused: false, lastDone: r.lastDone > today ? r.lastDone : today } : { ...r, paused: true }) : r)));
      }),
  );
  $$('[data-rdel]', root).forEach(
    (b) =>
      (b.onclick = () => {
        const r = find(b.dataset.rdel);
        if (!confirm(t('Stop "{name}" from repeating? Transactions already added stay.', { name: ruleName(r) }))) return;
        saveRules(rules().filter((x) => x.id !== r.id));
      }),
  );
}

// Opens the form filled from the rule, for a different amount or account this time.
function changeDue(r, date = Rc.dueDates(r, C.today())[0]) {
  occ = { rule: r, date };
  txnType = r.type;
  openTxn();
  $('#txn-save-another').hidden = true;
  $('#txn-amount').value = r.amount;
  $('#txn-date').value = date;
  $('#txn-note').value = r.note || '';
  $('#txn-fee').value = r.fee || '';
  const pick = (sel, v) => v && [...$(sel).options].some((o) => o.value === v) && ($(sel).value = v);
  pick('#txn-category', r.category);
  pick('#txn-account', r.account);
  if (r.type === 'Transfer') pick('#txn-to', r.toAccount);
  updateTxnHint();
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

const REPORT_ICONS = { statement: '🏦', income: '📊', networth: '⚖️', tax: '🧾', loan: '🤝' };
const REPORT_SHORT = { statement: 'Account statement', income: 'Income & expense', networth: 'Assets & liabilities', tax: 'Tax summary', loan: 'Loan statement' };

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
      <h3 style="margin:0">${t('Documents')} <small>${t('Print or PDF · English')}</small></h3>
      <div class="doc-tiles" role="radiogroup">
        ${Object.entries(R.REPORTS)
          .map(
            ([k, v]) => `<button class="doc-tile ${kind === k ? 'on' : ''}" role="radio" aria-checked="${kind === k}" data-report="${k}">
              <span class="qi" aria-hidden="true">${REPORT_ICONS[k] || '📄'}</span><span>${esc(t(REPORT_SHORT[k] || v.title))}</span></button>`,
          )
          .join('')}
      </div>
    </div>

    <div class="card" style="display:grid;gap:12px">
      <h3 style="margin:0">${esc(t(R.REPORTS[kind].title))}</h3>
      <p class="muted" style="margin:-6px 0 0;font-size:13px">${esc(t(R.REPORTS[kind].uses))}</p>
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

      ${isShopMode() ? productsCard() : ''}

      ${rulesCard()}

      ${lockCard()}

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
        </div>
      </div>

      <div class="card">
        <h3>${t('Signed in')}</h3>
        <p style="margin:0 0 10px">${esc(u.displayName || '')}<br><span class="muted">${esc(u.email || '')}</span></p>
        ${
          state.store.mode === 'drive'
            ? `<p class="muted" style="margin:0 0 10px;font-size:13px">🔒 ${t('Only you can see your data. It is in a private folder in your Google Drive.')}</p>
               <button class="btn" id="signout">${t('Sign out')}</button>`
            : `<p class="muted" style="margin:0;font-size:13px">${t('Demo mode. Add a Google client ID to <code>js/config.js</code> to sign in and sync.')}</p>`
        }
        <button class="linkish danger-link" id="delete-account">${t('Delete my account')}</button>
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
  bindRecurring(v);
  bindLock(v);
  bindProducts(v);
  $('#guide-show', v)?.addEventListener('click', () => {
    showGuide(true);
    switchView('dashboard');
  });
  $$('[data-lang]', v).forEach((b) => (b.onclick = () => applyLang(b.dataset.lang)));
  $('#export', v).onclick = exportJson;
  $('#export-csv', v).onclick = exportCsv;
  $('#import', v).onchange = (e) => importFile(e.target.files[0]);
  if ($('#signout', v)) $('#signout', v).onclick = () => state.store.signOut();
  $('#delete-account', v).onclick = openDelete;
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

// ---------------------------------------------------------------- delete account

async function openDelete() {
  // With an app lock, only the owner may delete.
  if (hasLock() && !(await (await lockModule()).showKeypad({ uid: state.user.uid, mode: 'unlock', canCancel: true }))) return;
  $('#delete-confirm').value = '';
  $('#delete-go').disabled = true;
  $('#delete-error').hidden = true;
  $('#delete-dialog').showModal();
}

function setupDeleteDialog() {
  $('#delete-backup').onclick = exportJson;
  $('#delete-confirm').oninput = () => ($('#delete-go').disabled = $('#delete-confirm').value.trim().toUpperCase() !== 'DELETE');
  $('#delete-form').onsubmit = async (e) => {
    e.preventDefault();
    if ($('#delete-go').disabled) return;
    $('#delete-go').disabled = true;
    $('#delete-go').textContent = t('Deleting…');
    try {
      const demo = state.store.mode === 'demo';
      await state.store.deleteMyData();
      $('#delete-dialog').close();
      if (demo) return location.reload();
      toast(t('Your AmrPotli account and data were deleted.'));
    } catch (err) {
      if (err?.type === 'popup_closed') return;
      $('#delete-error').textContent = t('Could not delete: {msg}. Nothing was removed from this device; try again.', { msg: err.message || String(err) });
      $('#delete-error').hidden = false;
    } finally {
      $('#delete-go').textContent = t('Delete everything');
    }
  };
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
