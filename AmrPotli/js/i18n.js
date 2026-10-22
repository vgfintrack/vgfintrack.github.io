// English / Bangla. English text is the key; Bangla comes from BN below and
// falls back to English when a phrase has no translation. Everyday words are
// Bangla; words people already use in English (Dashboard, Reports, Setup,
// Google Drive, Sync, PDF, CSV, bKash) stay in English, and familiar loanwords
// are written in Bangla script (ব্যাংক, ক্যাশ, ট্রান্সফার, লোন, বাজেট).
// Numbers keep 0-9 digits, as in banking and mobile-money apps.

import { BN } from './i18n-bn.js';

const LANG_KEY = 'mt:lang';

function initial() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'bn') return saved;
  } catch {}
  return (navigator.language || '').toLowerCase().startsWith('bn') ? 'bn' : 'en';
}

export let lang = initial();

export function setLang(l) {
  lang = l === 'bn' ? 'bn' : 'en';
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {}
  document.documentElement.lang = lang;
}

// Date locale: Bangla month and day names, but 0-9 digits.
export const dateLocale = () => (lang === 'bn' ? 'bn-BD-u-nu-latn' : 'en-GB');

const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s);

export function t(en, vars) {
  return fill(lang === 'bn' ? BN[en] ?? en : en, vars);
}

// English-only translator, for documents that stay in English.
export const en = (s, vars) => fill(s, vars);

// Singular/plural for English; Bangla uses the same form for both.
export function tn(n, one, many, vars = {}) {
  return t(n === 1 ? one : many, { n, ...vars });
}

// Static text in index.html: data-i18n (text), data-i18n-html (markup) and
// data-i18n-ph (placeholder) hold the English source.
export function translateStatic(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
  for (const el of root.querySelectorAll('[data-i18n-label]')) el.setAttribute('aria-label', t(el.dataset.i18nLabel));
  document.documentElement.lang = lang;
}
