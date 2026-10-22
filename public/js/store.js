// Data layer. Firestore when configured, browser localStorage in demo mode.
// Layout in Firestore (every path is private to the signed-in user):
//   users/{uid}/accounts/{accountId}
//   users/{uid}/transactions/{txnId}
//   users/{uid}/meta/settings

import { firebaseConfig } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

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

export async function createStore() {
  const demo = !firebaseConfig.apiKey || firebaseConfig.apiKey === 'REPLACE_ME';
  return demo ? createLocalStore() : createFirestoreStore();
}

// ---------------------------------------------------------------- demo mode

function createLocalStore() {
  const KEY = 'money-tracker-demo';
  let data;
  try {
    data = JSON.parse(localStorage.getItem(KEY));
  } catch {}
  data ||= { accounts: [], transactions: [], settings: null };
  const listeners = new Set();
  const emit = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {}
    for (const cb of listeners) cb({ ...data, loaded: true });
  };
  const user = { uid: 'demo', displayName: 'Demo mode', email: 'Data stays in this browser' };

  return {
    mode: 'demo',
    onAuth(cb) {
      cb(user);
    },
    async signIn() {},
    async signOut() {},
    subscribe(cb) {
      listeners.add(cb);
      cb({ ...data, loaded: true });
      return () => listeners.delete(cb);
    },
    async saveTxn(t) {
      t = clean({ ...t, id: t.id || newId(), createdAt: t.createdAt || Date.now() });
      data.transactions = data.transactions.filter((x) => x.id !== t.id).concat(t);
      emit();
    },
    async deleteTxn(id) {
      data.transactions = data.transactions.filter((x) => x.id !== id);
      emit();
    },
    async saveAccount(a) {
      a = clean({ ...a, id: a.id || newId() });
      data.accounts = data.accounts.filter((x) => x.id !== a.id).concat(a);
      emit();
    },
    async deleteAccount(id) {
      data.accounts = data.accounts.filter((x) => x.id !== id);
      emit();
    },
    async saveSettings(s) {
      data.settings = clean(s);
      emit();
    },
    async importAll(d) {
      data = clean({ accounts: d.accounts, transactions: d.transactions, settings: d.settings });
      emit();
    },
  };
}

// ---------------------------------------------------------------- Firestore

async function createFirestoreStore() {
  const [{ initializeApp }, authMod, fs] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  // Offline cache: the app keeps working without internet and syncs later.
  const db = fs.initializeFirestore(app, {
    localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
  });

  let uid = null;
  const col = (name) => fs.collection(db, 'users', uid, name);
  const settingsRef = () => fs.doc(db, 'users', uid, 'meta', 'settings');

  return {
    mode: 'firebase',
    onAuth(cb) {
      authMod.onAuthStateChanged(auth, (u) => {
        uid = u ? u.uid : null;
        cb(u);
      });
    },
    async signIn() {
      const provider = new authMod.GoogleAuthProvider();
      try {
        await authMod.signInWithPopup(auth, provider);
      } catch (e) {
        // Popups are often blocked in installed / in-app browsers.
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
          await authMod.signInWithRedirect(auth, provider);
        } else throw e;
      }
    },
    async signOut() {
      await authMod.signOut(auth);
    },
    subscribe(cb) {
      const state = { accounts: [], transactions: [], settings: null };
      const seen = new Set();
      const update = (part) => () => {
        seen.add(part);
        cb({ ...state, loaded: seen.size === 3 });
      };
      const docs = (snap) => snap.docs.map((d) => ({ ...d.data(), id: d.id }));
      const unsubs = [
        fs.onSnapshot(col('accounts'), (s) => ((state.accounts = docs(s)), update('a')())),
        fs.onSnapshot(col('transactions'), (s) => ((state.transactions = docs(s)), update('t')())),
        fs.onSnapshot(settingsRef(), (s) => ((state.settings = s.exists() ? s.data() : null), update('s')())),
      ];
      return () => unsubs.forEach((u) => u());
    },
    async saveTxn(t) {
      const id = t.id || newId();
      await fs.setDoc(fs.doc(col('transactions'), id), clean({ ...t, id, createdAt: t.createdAt || Date.now() }));
    },
    async deleteTxn(id) {
      await fs.deleteDoc(fs.doc(col('transactions'), id));
    },
    async saveAccount(a) {
      const id = a.id || newId();
      await fs.setDoc(fs.doc(col('accounts'), id), clean({ ...a, id }));
    },
    async deleteAccount(id) {
      await fs.deleteDoc(fs.doc(col('accounts'), id));
    },
    async saveSettings(s) {
      await fs.setDoc(settingsRef(), clean(s));
    },
    // Replaces everything with the contents of a backup file.
    async importAll(d) {
      const ops = [];
      for (const name of ['accounts', 'transactions']) {
        const existing = await fs.getDocs(col(name));
        existing.forEach((doc) => ops.push((b) => b.delete(doc.ref)));
        for (const item of d[name] || []) {
          const id = item.id || newId();
          ops.push((b) => b.set(fs.doc(col(name), id), clean({ ...item, id })));
        }
      }
      ops.push((b) => b.set(settingsRef(), clean(d.settings || DEFAULT_SETTINGS)));
      for (let i = 0; i < ops.length; i += 450) {
        const batch = fs.writeBatch(db);
        ops.slice(i, i + 450).forEach((op) => op(batch));
        await batch.commit();
      }
    },
  };
}
