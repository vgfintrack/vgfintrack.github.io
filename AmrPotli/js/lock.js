// App lock: a 4-digit PIN, plus fingerprint or face unlock where the phone
// supports it (WebAuthn with the phone's own sensor). It keeps people who
// pick up the phone out of the app; it does not encrypt the data. The lock is
// set per device, and the PIN is stored only as a salted hash.
// Loaded only when a lock is set, or when the user opens it in Setup.

import { t, addBangla } from './i18n.js';

addBangla({
  'Enter your PIN': 'আপনার PIN দিন',
  'Choose a 4-digit PIN': '৪ সংখ্যার একটি PIN বেছে নিন',
  'Enter the same PIN again': 'একই PIN আবার দিন',
  "The PINs didn't match. Try again.": 'PIN মেলেনি। আবার চেষ্টা করুন।',
  'Wrong PIN. {n} tries left.': 'ভুল PIN। আর {n} বার চেষ্টা করা যাবে।',
  'Too many tries. Wait {n} seconds.': 'অনেকবার ভুল হয়েছে। {n} সেকেন্ড অপেক্ষা করুন।',
  'Forgot PIN?': 'PIN ভুলে গেছেন?',
  'Use fingerprint': 'ফিঙ্গারপ্রিন্ট ব্যবহার করুন',
  'Delete': 'মুছুন',
  'Cancel': 'বাতিল',
  'To reset the PIN, sign in with Google again. Your data stays safe in your Google Drive. Continue?':
    'PIN রিসেট করতে আবার Google দিয়ে সাইন ইন করুন। আপনার তথ্য Google Drive-এ নিরাপদ থাকবে। এগোবেন?',
  'To reset the PIN, the data saved on this device will be cleared. Continue?': 'PIN রিসেট করতে এই ডিভাইসে রাখা তথ্য মুছে যাবে। এগোবেন?',
});

const KEY = (uid) => `mt:lock:${uid}`;
const MAX_TRIES = 5;
const WAIT_S = 30;

export function lockConfig(uid) {
  try {
    return JSON.parse(localStorage.getItem(KEY(uid)));
  } catch {
    return null;
  }
}
function saveConfig(uid, cfg) {
  try {
    if (cfg) localStorage.setItem(KEY(uid), JSON.stringify(cfg));
    else localStorage.removeItem(KEY(uid));
  } catch {}
}

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function hashPin(pin, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 150000 }, key, 256);
  return b64(bits);
}

export async function setPin(uid, pin, after = 60) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const old = lockConfig(uid) || {};
  saveConfig(uid, { ...old, salt: b64(salt), hash: await hashPin(pin, salt), after });
}

async function checkPin(uid, pin) {
  const c = lockConfig(uid);
  return !!c && (await hashPin(pin, unb64(c.salt))) === c.hash;
}

export function setAfter(uid, after) {
  const c = lockConfig(uid);
  if (c) saveConfig(uid, { ...c, after });
}

export function removeLock(uid) {
  saveConfig(uid, null);
}

// ---- fingerprint / face (the phone's own screen lock sensor)

export async function canBiometric() {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

export async function enrollBiometric(uid, label) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'AmrPotli' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: label || 'AmrPotli', displayName: label || 'AmrPotli' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
      attestation: 'none',
    },
  });
  const c = lockConfig(uid);
  saveConfig(uid, { ...c, cred: b64(cred.rawId) });
}

export function removeBiometric(uid) {
  const c = lockConfig(uid);
  if (c) saveConfig(uid, { ...c, cred: undefined });
}

async function biometricUnlock(uid) {
  const c = lockConfig(uid);
  if (!c?.cred) return false;
  try {
    await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: unb64(c.cred), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return true;
  } catch {
    return false;
  }
}

// ---- the keypad screen

const FINGER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 11v3a6 6 0 0 1-1.5 4M8.5 8.8A4 4 0 0 1 16 11v1.5M6.3 6.6A7 7 0 0 1 19 11v2M4 12a8 8 0 0 1 .8-3.5M9 21a9 9 0 0 0 2.8-4M15.8 17.5c.2-1 .2-2 .2-3"/></svg>';

let open = null; // the screen showing now, if any

// mode 'unlock' asks for the PIN (or a finger); mode 'set' asks twice for a new PIN.
// Resolves true when unlocked / set, false when cancelled.
export function showKeypad({ uid, mode = 'unlock', canCancel = false, onForgot = null, demo = false }) {
  if (open) return open.promise;
  const root = document.createElement('div');
  root.className = 'lock';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  document.body.append(root);
  document.documentElement.classList.add('locked');

  let entry = '';
  let first = null;
  let busy = false;
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  const cfg = lockConfig(uid);
  const fails = () => Number(sessionStorage.getItem('mt:lock-fails') || 0);
  const waitUntil = () => Number(sessionStorage.getItem('mt:lock-wait') || 0);

  const close = (ok) => {
    root.remove();
    document.documentElement.classList.remove('locked');
    removeEventListener('keydown', onKey);
    open = null;
    resolve(ok);
  };

  const title = () => (mode === 'unlock' ? t('Enter your PIN') : first == null ? t('Choose a 4-digit PIN') : t('Enter the same PIN again'));

  function draw(msg = '', bad = false) {
    const waiting = Math.ceil((waitUntil() - Date.now()) / 1000);
    root.innerHTML = `
      <div class="lock-box">
        <img src="icons/icon.svg" alt="" width="64" height="64">
        <h2>${title()}</h2>
        <div class="lock-dots ${bad ? 'shake' : ''}" aria-label="${entry.length} / 4">${[0, 1, 2, 3].map((i) => `<i class="${i < entry.length ? 'on' : ''}"></i>`).join('')}</div>
        <p class="lock-msg" role="status">${waiting > 0 ? t('Too many tries. Wait {n} seconds.', { n: waiting }) : msg}</p>
        <div class="lock-pad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-k="${n}">${n}</button>`).join('')}
          ${
            mode === 'unlock' && cfg?.cred
              ? `<button type="button" class="lock-bio" data-bio aria-label="${t('Use fingerprint')}">${FINGER}</button>`
              : canCancel
                ? `<button type="button" class="lock-text" data-cancel>${t('Cancel')}</button>`
                : '<span></span>'
          }
          <button type="button" data-k="0">0</button>
          <button type="button" class="lock-text" data-del aria-label="${t('Delete')}">⌫</button>
        </div>
        ${mode === 'unlock' && onForgot ? `<button type="button" class="linkish" data-forgot>${t('Forgot PIN?')}</button>` : ''}
      </div>`;
    root.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => press(b.dataset.k)));
    root.querySelector('[data-del]').onclick = () => press('del');
    const bio = root.querySelector('[data-bio]');
    if (bio) bio.onclick = tryBio;
    const cancel = root.querySelector('[data-cancel]');
    if (cancel) cancel.onclick = () => close(false);
    const forgot = root.querySelector('[data-forgot]');
    if (forgot)
      forgot.onclick = () => {
        const q = demo
          ? t('To reset the PIN, the data saved on this device will be cleared. Continue?')
          : t('To reset the PIN, sign in with Google again. Your data stays safe in your Google Drive. Continue?');
        if (!confirm(q)) return;
        removeLock(uid);
        close(true);
        onForgot();
      };
    if (waiting > 0) setTimeout(() => open && draw(), 1000);
  }

  async function press(k) {
    if (busy || waitUntil() > Date.now()) return;
    if (k === 'del') entry = entry.slice(0, -1);
    else if (entry.length < 4) entry += k;
    draw();
    if (entry.length < 4) return;
    busy = true;
    const pin = entry;
    entry = '';
    if (mode === 'set') {
      if (first == null) {
        first = pin;
        busy = false;
        return draw();
      }
      if (pin !== first) {
        first = null;
        busy = false;
        return draw(t("The PINs didn't match. Try again."), true);
      }
      await setPin(uid, pin, cfg?.after ?? 60);
      return close(true);
    }
    if (await checkPin(uid, pin)) {
      sessionStorage.removeItem('mt:lock-fails');
      return close(true);
    }
    const n = fails() + 1;
    sessionStorage.setItem('mt:lock-fails', n);
    busy = false;
    if (n >= MAX_TRIES) {
      sessionStorage.setItem('mt:lock-fails', 0);
      sessionStorage.setItem('mt:lock-wait', Date.now() + WAIT_S * 1000);
      return draw('', true);
    }
    draw(t('Wrong PIN. {n} tries left.', { n: MAX_TRIES - n }), true);
  }

  async function tryBio() {
    if (await biometricUnlock(uid)) close(true);
  }

  function onKey(e) {
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
    else if (e.key === 'Escape' && canCancel) close(false);
  }
  addEventListener('keydown', onKey);

  draw();
  open = { promise };
  // Offer the finger straight away, like banking apps do.
  if (mode === 'unlock' && cfg?.cred) setTimeout(tryBio, 300);
  return promise;
}

export const isShowing = () => !!open;
