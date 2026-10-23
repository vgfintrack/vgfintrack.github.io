// Data layer.
//
// Each user's data lives in ONE place: a hidden file in their own Google Drive
// ("app data folder", which only this app can open). There is no central
// server or database, so nobody else, the app's owner included, can read it.
//
// A copy is also kept in this browser so the app opens instantly and works
// offline. Changes are saved locally first and then synced to Drive.
// Signing out removes the copy from this browser; signing in again on any
// device brings everything back from Drive.
//
// Without a Google client ID (see config.js) the app runs in demo mode and
// keeps data in this browser only.

import { googleClientId } from './config.js';
import { t } from './i18n.js';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const SCOPES = `openid email profile ${DRIVE_SCOPE}`;
const FILE_NAME = 'amrpotli.json';
const LAST_USER_KEY = 'mt:last-user';
// Google access token for the signed-in user. It lasts about an hour and only
// allows this app's Drive folder and basic profile, so keeping it across page
// reloads lets the app sync without asking again every time.
const tokenKey = (uid) => `mt:token:${uid}`;

export const DEFAULT_SETTINGS = {
  savingsGoal: 0,
  incomeCategories: ['Salary', 'Tuition', 'Scholarship', 'Other Income'],
  expenseCategories: [
    { name: 'Food', budget: 0 },
    { name: 'Transport', budget: 0 },
    { name: 'Study & Books', budget: 0 },
    { name: 'Mobile & Internet', budget: 0 },
    { name: 'Family Support', budget: 0 },
    { name: 'Medical', budget: 0 },
    { name: 'Entertainment', budget: 0 },
    { name: 'Other', budget: 0 },
  ],
};

export const DEFAULT_ACCOUNTS = [
  { id: 'bank', name: 'Bank', type: 'Liquid', opening: 0, order: 1 },
  { id: 'cash', name: 'Cash in Hand', type: 'Liquid', opening: 0, order: 2 },
  { id: 'bkash', name: 'bKash', type: 'Liquid', opening: 0, order: 3 },
];

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const clean = (o) => JSON.parse(JSON.stringify(o)); // drops undefined values

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function save(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// ---------------------------------------------------------------- merging
//
// Every account and transaction carries `updatedAt`. Deleting keeps a small
// "tombstone" ({ id, deleted: true, updatedAt }) so a delete made on one phone
// is not undone by an older copy on another. Merging keeps the newest version
// of each item, which lets two devices edit offline and sync later.

export function emptyDoc() {
  return { version: 2, accounts: {}, transactions: {}, settings: null, settingsUpdatedAt: 0 };
}

export function mergeDocs(a, b) {
  const out = emptyDoc();
  for (const key of ['accounts', 'transactions']) {
    out[key] = { ...a[key] };
    for (const [id, item] of Object.entries(b[key] || {})) {
      const mine = out[key][id];
      if (!mine || (item.updatedAt || 0) > (mine.updatedAt || 0)) out[key][id] = item;
    }
  }
  const useB = (b.settingsUpdatedAt || 0) > (a.settingsUpdatedAt || 0) || (!a.settings && b.settings);
  out.settings = useB ? b.settings : a.settings;
  out.settingsUpdatedAt = useB ? b.settingsUpdatedAt || 0 : a.settingsUpdatedAt || 0;
  return out;
}

// Accepts both this format and the older arrays-based backup file.
export function docFromBackup(d, stamp = Date.now()) {
  const doc = emptyDoc();
  if (d && !Array.isArray(d.accounts) && d.accounts) return mergeDocs(doc, d);
  for (const a of d.accounts || []) doc.accounts[a.id] = { ...a, updatedAt: a.updatedAt || stamp };
  for (const t of d.transactions || []) doc.transactions[t.id] = { ...t, updatedAt: t.updatedAt || stamp };
  doc.settings = d.settings || null;
  doc.settingsUpdatedAt = d.settings ? stamp : 0;
  return doc;
}

const live = (map) => Object.values(map).filter((x) => !x.deleted);

// ---------------------------------------------------------------- local engine

function createEngine(cacheKey, onChanged, { readyWithoutCache = true } = {}) {
  let cached = cacheKey ? load(cacheKey) : null;
  // A new device has nothing to show until the first download from Drive.
  let ready = readyWithoutCache || !!cached;
  let doc = cached?.doc || emptyDoc();
  let dirty = !!cached?.dirty;
  let rev = 0; // bumps on every local change
  const listeners = new Set();

  const view = () => ({
    accounts: live(doc.accounts),
    transactions: live(doc.transactions),
    settings: doc.settings,
    loaded: ready,
  });
  const persist = () => cacheKey && save(cacheKey, { doc, dirty });
  const emit = () => listeners.forEach((cb) => cb(view()));
  const change = (fn) => {
    fn(Date.now());
    rev++;
    dirty = true;
    persist();
    emit();
    onChanged?.();
  };

  return {
    get doc() {
      return doc;
    },
    get dirty() {
      return dirty;
    },
    get rev() {
      return rev;
    },
    hasCache: !!cached,
    // Replace the local doc after a sync. `stillDirty` is set if the user
    // changed something while the sync was in flight.
    replace(next, stillDirty = false) {
      ready = true;
      doc = next;
      dirty = stillDirty;
      persist();
      emit();
    },
    subscribe(cb) {
      listeners.add(cb);
      cb(view());
      return () => listeners.delete(cb);
    },
    saveTxn(t) {
      change((now) => {
        const id = t.id || newId();
        doc.transactions[id] = clean({ ...t, id, createdAt: t.createdAt || now, updatedAt: now });
      });
    },
    deleteTxn(id) {
      change((now) => (doc.transactions[id] = { id, deleted: true, updatedAt: now }));
    },
    saveAccount(a) {
      change((now) => {
        const id = a.id || newId();
        doc.accounts[id] = clean({ ...a, id, updatedAt: now });
      });
    },
    deleteAccount(id) {
      change((now) => (doc.accounts[id] = { id, deleted: true, updatedAt: now }));
    },
    saveSettings(s) {
      change((now) => {
        doc.settings = clean(s);
        doc.settingsUpdatedAt = now;
      });
    },
    // Restoring a backup replaces everything, on every device.
    importAll(d) {
      change((now) => {
        for (const key of ['accounts', 'transactions'])
          for (const id of Object.keys(doc[key])) doc[key][id] = { id, deleted: true, updatedAt: now };
        const incoming = docFromBackup(clean(d), now + 1);
        for (const key of ['accounts', 'transactions'])
          for (const [id, item] of Object.entries(incoming[key])) doc[key][id] = { ...item, updatedAt: now + 1 };
        doc.settings = incoming.settings || DEFAULT_SETTINGS;
        doc.settingsUpdatedAt = now + 1;
      });
    },
    // Adds a backup's items to the current data. Items already here (same id)
    // are kept as they are; categories and budgets are combined.
    mergeAll(d) {
      change((now) => {
        const incoming = docFromBackup(clean(d), now);
        for (const key of ['accounts', 'transactions'])
          for (const [id, item] of Object.entries(incoming[key])) {
            const mine = doc[key][id];
            if (!mine || mine.deleted) doc[key][id] = { ...item, updatedAt: now };
          }
        const cur = doc.settings || DEFAULT_SETTINGS;
        const inc = incoming.settings;
        if (inc) {
          const expense = cur.expenseCategories.map((c) => {
            const other = inc.expenseCategories?.find((x) => x.name === c.name);
            return !Number(c.budget) && other ? { ...c, budget: other.budget } : c;
          });
          for (const c of inc.expenseCategories || []) if (!expense.some((x) => x.name === c.name)) expense.push(c);
          doc.settings = {
            ...cur,
            savingsGoal: Number(cur.savingsGoal) || Number(inc.savingsGoal) || 0,
            incomeCategories: [...new Set([...cur.incomeCategories, ...(inc.incomeCategories || [])])],
            expenseCategories: expense,
          };
          doc.settingsUpdatedAt = now;
        }
      });
    },
    clear() {
      if (cacheKey) save(cacheKey, null);
      doc = emptyDoc();
      dirty = false;
    },
  };
}

export async function createStore() {
  const demo = !googleClientId || googleClientId.startsWith('REPLACE');
  return demo ? createDemoStore() : createDriveStore();
}

// ---------------------------------------------------------------- demo mode

function createDemoStore() {
  const engine = createEngine('mt:demo');
  const user = { uid: 'demo', displayName: t('Demo mode'), email: t('Data stays in this browser') };
  return {
    mode: 'demo',
    onAuth: (cb) => cb(user),
    onStatus: (cb) => cb('demo'),
    async signIn() {},
    async signOut() {},
    async syncNow() {},
    // Demo data lives only in this browser.
    async deleteMyData() {
      for (const k of ['mt:demo', 'mt:onb:demo', 'mt:lock:demo']) save(k, null);
    },
    subscribe: (cb) => engine.subscribe(cb),
    saveTxn: async (t) => engine.saveTxn(t),
    deleteTxn: async (id) => engine.deleteTxn(id),
    saveAccount: async (a) => engine.saveAccount(a),
    deleteAccount: async (id) => engine.deleteAccount(id),
    saveSettings: async (s) => engine.saveSettings(s),
    importAll: async (d) => engine.importAll(d),
    mergeAll: async (d) => engine.mergeAll(d),
  };
}

// ---------------------------------------------------------------- Google Drive

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error(t('Could not load Google sign-in. Check your internet connection.')));
    document.head.appendChild(s);
  });
}

async function createDriveStore() {
  let user = load(LAST_USER_KEY); // { uid, email, displayName, photoURL }
  let token = null; // { value, expiresAt }
  let engine = null;
  let fileId = null;
  let status = 'idle';
  let syncing = null;
  let again = false;
  let syncTimer = null;
  let authCb = () => {};
  const statusListeners = new Set();
  const dataSubs = new Map(); // listener -> unsubscribe from current engine

  const setStatus = (s) => {
    status = s;
    statusListeners.forEach((cb) => cb(s));
  };

  const scheduleSync = () => {
    if (engine?.dirty) setStatus(hasToken() ? 'syncing' : 'unsynced');
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => sync(), 1200);
  };

  const openEngine = () => {
    engine = createEngine(`mt:data:${user.uid}`, scheduleSync, { readyWithoutCache: false });
    for (const [cb, off] of dataSubs) {
      off?.();
      dataSubs.set(cb, engine.subscribe(cb));
    }
  };

  const hasToken = () => token && Date.now() < token.expiresAt - 60_000;
  const keepToken = () => user && save(tokenKey(user.uid), token);
  const dropToken = () => {
    token = null;
    if (user) save(tokenKey(user.uid), null);
  };

  // --- Google sign-in (needs a tap, because it may open a popup)
  let tokenClient = null;
  let pending = null;
  async function requestToken(interactive) {
    await loadGis();
    tokenClient ||= google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: SCOPES,
      callback: (resp) => pending?.resolve(resp),
      error_callback: (err) => pending?.reject(err),
    });
    const resp = await new Promise((resolve, reject) => {
      pending = { resolve, reject };
      tokenClient.requestAccessToken({
        prompt: interactive && !user ? 'select_account' : '',
        ...(user?.email && { login_hint: user.email }),
      });
    });
    if (resp.error) throw new Error(resp.error_description || resp.error);
    if (!google.accounts.oauth2.hasGrantedAllScopes(resp, DRIVE_SCOPE)) {
      throw new Error(t('Please tick the box that lets the app keep its data in your Google Drive. That is where your data is stored.'));
    }
    token = { value: resp.access_token, expiresAt: Date.now() + Number(resp.expires_in || 3600) * 1000 };
  }

  async function api(url, opts = {}) {
    const res = await fetch(url, { ...opts, headers: { ...opts.headers, Authorization: `Bearer ${token.value}` } });
    if (res.status === 401) {
      dropToken();
      throw Object.assign(new Error(t('Google sign-in expired')), { needsAuth: true });
    }
    if (!res.ok) throw new Error(`Google Drive error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res;
  }

  async function fetchProfile() {
    const p = await (await api('https://www.googleapis.com/oauth2/v3/userinfo')).json();
    return { uid: p.sub, email: p.email, displayName: p.name || p.email, photoURL: p.picture || '' };
  }

  async function readRemote() {
    if (!fileId) {
      const q = encodeURIComponent(`name='${FILE_NAME}'`);
      const list = await (
        await api(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)&orderBy=modifiedTime desc`)
      ).json();
      fileId = list.files?.[0]?.id || null;
    }
    if (!fileId) return null;
    const res = await api(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    return docFromBackup(await res.json(), 0);
  }

  async function writeRemote(doc) {
    const body = JSON.stringify(doc);
    if (fileId) {
      await api(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      return;
    }
    const boundary = 'mt' + newId();
    const meta = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' });
    const multipart =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
    const res = await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipart,
    });
    fileId = (await res.json()).id;
  }

  // Download, merge with local changes, upload if anything differs.
  async function sync() {
    if (!engine) return;
    if (!hasToken()) return setStatus(engine.dirty ? 'unsynced' : 'tap');
    if (!navigator.onLine) return setStatus('offline');
    if (syncing) {
      again = true;
      return syncing;
    }
    syncing = (async () => {
      setStatus('syncing');
      try {
        const base = engine.doc;
        const startRev = engine.rev;
        const remote = await readRemote();
        const merged = remote ? mergeDocs(base, remote) : base;
        const remoteJson = remote ? JSON.stringify(remote) : null;
        // A brand-new user with nothing yet: don't create an empty file.
        const nothingYet = !remote && !engine.dirty && JSON.stringify(merged) === JSON.stringify(emptyDoc());
        if (!nothingYet && JSON.stringify(merged) !== remoteJson) await writeRemote(merged);
        // Keep edits made while we were syncing.
        const changedMeanwhile = engine.rev !== startRev;
        engine.replace(changedMeanwhile ? mergeDocs(engine.doc, merged) : merged, changedMeanwhile);
        setStatus(changedMeanwhile ? 'syncing' : 'synced');
        if (changedMeanwhile) again = true;
      } catch (e) {
        console.error(e);
        setStatus(e.needsAuth ? 'tap' : navigator.onLine ? 'error' : 'offline');
      } finally {
        syncing = null;
        if (again) {
          again = false;
          scheduleSync();
        }
      }
    })();
    return syncing;
  }

  window.addEventListener('online', () => engine && sync());
  // Coming back to the app: pick up changes made on other devices.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && engine && hasToken()) sync();
  });

  // Reconnects to Google without a separate tap. Must run during a tap or
  // click (e.g. pressing Save), because Google may briefly open a popup.
  let reconnecting = null;
  function reconnect() {
    reconnecting ||= requestToken(false)
      .then(() => {
        keepToken();
        return sync();
      })
      .catch((e) => {
        console.warn('Could not reconnect to Google Drive', e);
        setStatus(engine?.dirty ? 'unsynced' : 'tap');
      })
      .finally(() => (reconnecting = null));
    return reconnecting;
  }

  // Signs this device out: revokes the token and drops the local copy.
  function forget() {
    if (token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(token.value, () => {});
    dropToken();
    fileId = null;
    engine?.clear();
    engine = null;
    for (const [cb, off] of dataSubs) {
      off?.();
      dataSubs.set(cb, null);
    }
    user = null;
    save(LAST_USER_KEY, null);
    setStatus('idle');
    authCb(null);
  }

  const mutate = (fn) => async (...args) => {
    if (!engine) throw new Error(t('Not signed in'));
    fn(...args);
    if (!hasToken()) reconnect();
  };

  return {
    mode: 'drive',
    onAuth(cb) {
      authCb = cb;
      if (user) {
        token = load(tokenKey(user.uid));
        openEngine();
        cb(user);
        if (hasToken()) sync();
        else {
          setStatus(engine.dirty ? 'unsynced' : 'tap');
          loadGis().catch(() => {}); // ready for a quick reconnect on the next tap
        }
      } else cb(null);
    },
    onStatus(cb) {
      statusListeners.add(cb);
      cb(status);
    },
    // Called from a button tap.
    async signIn() {
      await requestToken(true);
      const profile = await fetchProfile();
      if (!user || user.uid !== profile.uid) fileId = null;
      user = profile;
      save(LAST_USER_KEY, user);
      keepToken();
      openEngine();
      authCb(user);
      await sync();
    },
    // Called from a button tap. Reconnects to Drive if needed, then syncs.
    async syncNow() {
      if (!hasToken()) {
        try {
          await requestToken(true);
          keepToken();
        } catch (e) {
          setStatus('tap');
          throw e;
        }
      }
      await sync();
    },
    // Saves any unsynced changes, then removes this browser's copy.
    async signOut() {
      if (engine?.dirty) {
        if (!hasToken()) await requestToken(true).catch(() => {});
        await sync();
        if (engine.dirty && !confirm(t('Some changes could not be saved to Google Drive yet. Sign out anyway and lose them?'))) return;
      }
      forget();
    },
    // Deletes every AmrPotli file in this Google account's Drive and this
    // device's copy, then removes the app's access to the account.
    // Called from a button tap (it may need to sign in again first).
    async deleteMyData() {
      clearTimeout(syncTimer);
      await syncing?.catch(() => {});
      if (!hasToken()) {
        await requestToken(true);
        keepToken();
      }
      const list = await (await api('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id)&pageSize=1000')).json();
      for (const f of list.files || []) await api(`https://www.googleapis.com/drive/v3/files/${f.id}`, { method: 'DELETE' });
      const uid = user.uid;
      forget();
      for (const k of [`mt:data:${uid}`, tokenKey(uid), `mt:onb:${uid}`, `mt:lock:${uid}`]) save(k, null);
    },
    subscribe(cb) {
      dataSubs.set(cb, engine ? engine.subscribe(cb) : null);
      return () => {
        dataSubs.get(cb)?.();
        dataSubs.delete(cb);
      };
    },
    saveTxn: mutate((t) => engine.saveTxn(t)),
    deleteTxn: mutate((id) => engine.deleteTxn(id)),
    saveAccount: mutate((a) => engine.saveAccount(a)),
    deleteAccount: mutate((id) => engine.deleteAccount(id)),
    saveSettings: mutate((s) => engine.saveSettings(s)),
    importAll: mutate((d) => engine.importAll(d)),
    mergeAll: mutate((d) => engine.mergeAll(d)),
  };
}
