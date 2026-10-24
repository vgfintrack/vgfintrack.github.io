// "Getting started" checklist and the daily streak on the Dashboard.
// Small and pure: it only reads the data the Dashboard already has. The
// first-run wizard itself lives in onboarding.js and loads only for new users.

import { t, lang } from './i18n.js';

// Bump on each release, so feedback shows which version people were using.
export const APP_VERSION = '2026.10.24j';

// Feedback goes to a Google Form, never with any money data. The form's last
// question ("App info") is filled in with version, language, device type and
// where the button was, which helps find bugs and says nothing about the person.
const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSdvSfgm0FSD-HoNBByTHWaTj-Kl_0-zTXREGdng5tHuB1Xkcg/viewform';
const APP_INFO_FIELD = 'entry.247074758';

export function feedbackUrl(from) {
  const ua = navigator.userAgent;
  const device = /android/i.test(ua) ? 'Android' : /iphone|ipad|ipod/i.test(ua) ? 'iPhone' : /windows/i.test(ua) ? 'Windows' : /mac/i.test(ua) ? 'Mac' : 'Other';
  const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const info = `v${APP_VERSION} · ${lang} · ${device} · ${installed ? 'installed' : 'browser'} · ${innerWidth}px · from ${from}`;
  return `${FORM}?usp=pp_url&${APP_INFO_FIELD}=${encodeURIComponent(info)}`;
}

const feedbackLink = () =>
  `<button type="button" class="linkish guide-help" data-feedback="guide">💬 ${t('Stuck, or have an idea? Tell us')}</button>`;

// Each step is done when the data shows it, so the list stays right on every
// device. Report and install leave no data behind, so they are flags in settings.
export const GUIDE = [
  { id: 'setup', label: 'Set up FinnBlu', sub: 'Accounts, balances and categories', done: () => true },
  { id: 'expense', label: 'Add your first expense', sub: 'Tea, rickshaw, lunch: anything you spent today', done: (d) => d.transactions.some((x) => x.type === 'Expense') },
  { id: 'income', label: 'Record money you received', sub: 'Salary, tuition, allowance or a payment', done: (d) => d.transactions.some((x) => x.type === 'Income') },
  { id: 'sms', label: 'Try Paste SMS', sub: 'Copy a bKash, Nagad or bank SMS and paste it', done: (d) => d.transactions.some((x) => x.ref) },
  { id: 'budget', label: 'Set a monthly budget', sub: 'A spending limit, for example for Food', done: (d) => (d.settings?.expenseCategories || []).some((c) => Number(c.budget) > 0) },
  { id: 'install', label: 'Install FinnBlu on your phone', sub: 'Opens like an app, even offline', done: (d, f) => f.installed || !!d.settings?.onboarding?.done?.install },
  { id: 'report', label: 'Open your first statement', sub: 'A printable statement of your month', done: (d) => !!d.settings?.onboarding?.done?.report },
];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Shown to people who set up with the wizard (or asked for it in Setup), until they hide it.
export const guideOn = (d) => !!d.settings?.onboarding && !d.settings.onboarding.hidden;

// A shop's guide speaks of sales and stock.
const SHOP_WORDS = {
  expense: ['Record your first stock purchase', 'Pick a supplier, what you bought and what you paid'],
  income: ['Record your first sale', "Today's cash sales, or one bKash payment"],
};

export function guideState(d, flags) {
  const shop = d.settings?.mode === 'shop';
  const items = GUIDE.map((g) => ({
    ...g,
    ...(shop && SHOP_WORDS[g.id] && { label: SHOP_WORDS[g.id][0], sub: SHOP_WORDS[g.id][1] }),
    isDone: g.done(d, flags),
  }));
  return { items, count: items.filter((i) => i.isDone).length, next: items.find((i) => !i.isDone) };
}

export function guideCard(d, flags) {
  const { items, count, next } = guideState(d, flags);
  const total = items.length;
  if (!next)
    return `<div class="card guide guide-done">
      <div class="guide-trophy" aria-hidden="true">🏆</div>
      <div><strong>${t("You've finished the getting-started guide!")}</strong>
        <div class="muted" style="font-size:13px">${t('You now know the main parts of FinnBlu. Keep adding entries every day.')}</div></div>
      <button class="btn sm" data-guide-hide>${t('Hide')}</button>
      ${feedbackLink()}
    </div>`;
  return `<div class="card guide">
    <div class="guide-head">
      <div><strong>${t('Getting started')}</strong>
        <div class="muted" style="font-size:13px">${t('{a} of {b} done', { a: count, b: total })}</div></div>
      <button class="linkish" data-guide-hide>${t('Hide')}</button>
    </div>
    <div class="progress ok" aria-hidden="true"><div style="width:${(count / total) * 100}%"></div></div>
    <ol class="guide-list">
      ${items
        .map((i, n) => {
          const cls = i.isDone ? 'done' : i === next ? 'next' : '';
          return `<li class="${cls}">
            <span class="dot" aria-hidden="true">${i.isDone ? '✓' : n + 1}</span>
            <span class="txt"><strong>${t(i.label)}</strong>${i.isDone ? '' : `<small>${t(i.sub)}</small>`}</span>
            ${i.isDone ? `<span class="sr">${t('Done')}</span>` : `<button class="btn sm ${cls === 'next' ? 'primary' : ''}" data-guide="${i.id}">${t(cls === 'next' ? 'Start' : 'Go')}</button>`}
          </li>`;
        })
        .join('')}
    </ol>
    ${feedbackLink()}
  </div>`;
}

// A toast when a step gets done, Duolingo style. The first call only remembers.
let seen = null;
export function noticeProgress(d, flags, toast) {
  if (!guideOn(d)) return (seen = null);
  const { items, count } = guideState(d, flags);
  const now = new Set(items.filter((i) => i.isDone).map((i) => i.id));
  if (seen) {
    const fresh = items.find((i) => i.isDone && !seen.has(i.id));
    if (fresh)
      setTimeout(
        () =>
          toast(
            count === items.length
              ? `🏆 ${t('All steps done. Well done!')}`
              : `🎉 ${t(fresh.label)} ✓ · ${t('{a} of {b} done', { a: count, b: items.length })}`,
          ),
        2700, // after the "Saved" toast
      );
  }
  seen = now;
}

// Days in a row with at least one entry, counting back from today (or from
// yesterday, so the streak is not lost before today's entries are added).
export function streak(txns, today) {
  const days = new Set(txns.map((x) => x.date));
  const step = (s, n) => {
    const d = new Date(`${s}T12:00:00`);
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const todayDone = days.has(today);
  let day = todayDone ? today : step(today, -1);
  let n = 0;
  while (days.has(day)) {
    n++;
    day = step(day, -1);
  }
  return { n, todayDone };
}

export function streakPill(txns, today) {
  const { n, todayDone } = streak(txns, today);
  if (n < 2) return '';
  return `<div class="streak ${todayDone ? '' : 'pending'}" title="${esc(t('Days in a row with at least one entry'))}">
    🔥 <strong>${t('{n}-day streak', { n })}</strong>${todayDone ? '' : ` <span>· ${t("add today's entries to keep it")}</span>`}</div>`;
}
