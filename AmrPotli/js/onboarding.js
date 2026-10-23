// First-run setup for people starting fresh, one question per screen, with a
// progress bar and the Potli asking the questions (like Duolingo or Chorcha).
// Loaded only when someone has no data yet, so it costs nothing for everyone else.
// Answers are kept on this device while the wizard is open, so a reload or
// closed tab picks up where the user left off.

import { t, lang, addBangla } from './i18n.js';
import { DEFAULT_SETTINGS } from './store.js';
import { PERSONAL, PERSONAL_EXTRA, BUSINESS, BUSINESS_EXTRA, BUSINESS_TYPES, POPULAR, searchProfessions, professionById } from './professions.js';

// Bangla for these screens comes with them, so the main app stays small.
addBangla({
  'Hi {name}! 👋': 'হ্যালো {name}! 👋',
  'Hi! 👋': 'হ্যালো! 👋',
  "I'm your Potli. Let's set up your money in about 1 minute: where you keep it, and what you spend on.": 'আমি আপনার পোটলি। চলুন 1 মিনিটে আপনার টাকার হিসাব সাজিয়ে ফেলি: টাকা কোথায় রাখেন, আর কীসে খরচ করেন।',
  'Only you can see your data. It is saved in your own Google Drive.': 'আপনার তথ্য শুধু আপনিই দেখতে পারবেন। এটি আপনার নিজের Google Drive-এ সেভ থাকে।',
  'You can change every answer later in Setup.': 'প্রতিটি উত্তর পরে Setup-এ বদলাতে পারবেন।',
  "Let's start": 'শুরু করি',
  'I have a backup file (.json)': 'আমার কাছে ব্যাকআপ ফাইল (.json) আছে',
  'Back': 'পেছনে',
  'Continue': 'এগিয়ে যান',
  'Finish': 'শেষ করুন',
  'Which of these sounds most like you?': 'এগুলোর মধ্যে কোনটি আপনার সাথে সবচেয়ে বেশি মেলে?',
  'I will suggest categories that fit you.': 'আপনার সাথে মানানসই ক্যাটাগরি আমি সাজিয়ে দেব।',
  'Student': 'শিক্ষার্থী',
  'Allowance from family, tuition, scholarship': 'পরিবারের হাতখরচ, টিউশন, বৃত্তি',
  'Job holder': 'চাকরিজীবী',
  'Monthly salary': 'মাসিক বেতন',
  'Freelancer': 'ফ্রিল্যান্সার',
  'Clients, Upwork, Fiverr': 'ক্লায়েন্ট, Upwork, Fiverr',
  'Business owner': 'ব্যবসায়ী',
  'Your personal money, apart from the shop': 'দোকানের বাইরে আপনার ব্যক্তিগত টাকা',
  'Running a home': 'সংসার চালাই',
  'Bazar, bills and family costs': 'বাজার, বিল আর পরিবারের খরচ',
  'Where do you keep your money?': 'আপনার টাকা কোথায় কোথায় রাখেন?',
  'Pick all that you use.': 'যেগুলো ব্যবহার করেন সবগুলো বেছে নিন।',
  'Cash in hand': 'হাতে নগদ',
  'Money in your wallet or at home': 'মানিব্যাগে বা বাসায় রাখা টাকা',
  'Bank account': 'ব্যাংক অ্যাকাউন্ট',
  'Savings, salary or student account': 'সেভিংস, স্যালারি বা স্টুডেন্ট অ্যাকাউন্ট',
  'How much is in each one right now?': 'এই মুহূর্তে কোনটিতে কত টাকা আছে?',
  'Check your bKash app or the last bank SMS. A close guess is fine; you can fix it later.': 'bKash অ্যাপ বা ব্যাংকের শেষ SMS দেখে নিন। কাছাকাছি আন্দাজ দিলেও চলবে; পরে ঠিক করা যাবে।',
  'Bank name, for example Sonali Bank': 'ব্যাংকের নাম, যেমন Sonali Bank',
  'Total': 'মোট',
  'What do you usually spend on?': 'সাধারণত কীসে কীসে খরচ করেন?',
  'Tap to add or remove. These become your budget categories.': 'যোগ বা বাদ দিতে ট্যাপ করুন। এগুলোই হবে আপনার বাজেটের ক্যাটাগরি।',
  'Add your own, for example Gym': 'নিজের মতো যোগ করুন, যেমন Gym',
  'Where does your money come from?': 'আপনার টাকা কোথা থেকে আসে?',
  'Pick all that apply.': 'যেগুলো মেলে সবগুলো বেছে নিন।',
  'Add your own, for example Pocket Money': 'নিজের মতো যোগ করুন, যেমন Pocket Money',
  '{n} selected': '{n}টি বাছাই করা',
  'How much do you want to save each month?': 'প্রতি মাসে কত টাকা জমাতে চান?',
  'Saving = income minus spending. A small goal is a great start.': 'সঞ্চয় = আয় বাদ খরচ। ছোট লক্ষ্য দিয়ে শুরু করাই ভালো।',
  'Other amount': 'অন্য পরিমাণ',
  'Your Potli is ready! 🎉': 'আপনার পোটলি তৈরি! 🎉',
  'Total money': 'মোট টাকা',
  'Categories': 'ক্যাটাগরি',
  'Savings goal': 'সঞ্চয়ের লক্ষ্য',
  "Now the most important habit: write down what you spend, every day. Let's add your first one.": 'এবার সবচেয়ে জরুরি অভ্যাস: প্রতিদিনের খরচ লিখে রাখা। চলুন প্রথমটা যোগ করি।',
  'Owe someone, or lent money to someone? Add it later with + → Loan.': 'কারও কাছে ধার আছে, বা কাউকে ধার দিয়েছেন? পরে + → লোন দিয়ে যোগ করুন।',
  'Add my first expense': 'আমার প্রথম খরচ যোগ করি',
  'Go to Dashboard': 'Dashboard-এ যাই',
  'A shop, trade or small business': 'দোকান, ব্যবসা বা ছোট প্রতিষ্ঠান',
  'What will you track?': 'কীসের হিসাব রাখবেন?',
  'My personal money': 'আমার নিজের টাকা',
  'Family, bills, savings': 'পরিবার, বিল, সঞ্চয়',
  "My shop's money": 'আমার দোকানের টাকা',
  'Sales, stock, shop costs': 'বিক্রি, মাল কেনা, দোকানের খরচ',
  'Cash box': 'ক্যাশ বাক্স',
  "The shop's cash drawer": 'দোকানের টাকার ড্রয়ার',
  'What does the shop spend money on?': 'দোকানের টাকা কীসে কীসে খরচ হয়?',
  'Add your own, for example Ice': 'নিজের মতো যোগ করুন, যেমন Ice',
  'How does money come into the shop?': 'দোকানে টাকা কীভাবে আসে?',
  'Add your own, for example Flexiload': 'নিজের মতো যোগ করুন, যেমন Flexiload',
  'How much profit do you aim for each month?': 'প্রতি মাসে কত লাভ করতে চান?',
  'Profit = sales minus costs.': 'লাভ = বিক্রি বাদ খরচ।',
  'Profit goal': 'লাভের লক্ষ্য',
  'What do you do?': 'আপনি কী করেন?',
  'Type your work, or pick one below. I will suggest categories that fit.': 'আপনার কাজ লিখুন, অথবা নিচে থেকে বেছে নিন। মানানসই ক্যাটাগরি সাজিয়ে দেব।',
  'e.g. teacher, pharmacy, poultry farm': 'যেমন শিক্ষক, ফার্মেসি, মুরগির খামার',
  'Your work': 'আপনার কাজ',
  'Your own profession': 'আপনার নিজের পেশা',
  'Popular': 'জনপ্রিয়',
  'Other profession: “{name}”': 'অন্য পেশা: “{name}”',
  'Shop, farm, pharmacy, any trade': 'দোকান, খামার, ফার্মেসি, যেকোনো ব্যবসা',
  "My business's money": 'আমার ব্যবসার টাকা',
  'Sales, stock, business costs': 'বিক্রি, মাল কেনা, ব্যবসার খরচ',
  'What kind of business?': 'কী ধরনের ব্যবসা?',
  "The business's cash drawer": 'ব্যবসার টাকার ড্রয়ার',
  'What does the business spend money on?': 'ব্যবসার টাকা কীসে কীসে খরচ হয়?',
  'How does money come into the business?': 'ব্যবসায় টাকা কীভাবে আসে?',
  'A healthy business writes down every sale and cost the same day. Start with one now.': 'ভালো ব্যবসা প্রতিটি বিক্রি আর খরচ সেদিনই লিখে রাখে। এখনই একটি দিয়ে শুরু করুন।',
  'A healthy shop writes down every sale and cost the same day. Start with one now.': 'ভালো দোকান প্রতিটি বিক্রি আর খরচ সেদিনই লিখে রাখে। এখনই একটি দিয়ে শুরু করুন।',
});

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

// The first step asks what you do: a few popular cards, and a search box for
// everything else (professions.js). The answer picks the starting categories.
const POPULAR_SUB = {
  student: 'Allowance from family, tuition, scholarship',
  job: 'Monthly salary',
  freelancer: 'Clients, Upwork, Fiverr',
  home: 'Bazar, bills and family costs',
  business: 'Shop, farm, pharmacy, any trade',
};
const BTYPE_PROF = { other: 'otherbiz' }; // business type -> its profession entry
const profName = (p) => (lang === 'bn' ? p.bn : p.en);
const isShop = () => draft?.persona === 'business' && draft.bizMode === 'shop' && !!draft.btype;
const starter = () => (isShop() ? BUSINESS[draft.btype] : PERSONAL[draft.persona] || PERSONAL.other);
const pool = (key) => [...new Set([...starter()[key], ...(isShop() ? BUSINESS_EXTRA : PERSONAL_EXTRA)[key]])];
const resetLists = () => {
  draft.expense = [...starter().expense];
  draft.income = [...starter().income];
};

function chooseProfession(p, customLabel = null) {
  if (customLabel) {
    draft.prof = { id: 'custom', label: customLabel };
    draft.persona = 'other';
    draft.btype = null;
  } else {
    draft.prof = { id: p.id };
    if ('business' in p) {
      draft.persona = 'business';
      draft.btype = p.business; // null for plain "Business owner": asked next
    } else {
      draft.persona = p.personal;
      draft.btype = null;
    }
  }
  draft.bizMode = null;
  resetLists();
}

const walletLabel = (w) => (w.id === 'cash' && isShop() ? 'Cash box' : w.label);
const walletSub = (w) => (w.id === 'cash' && isShop() ? "The business's cash drawer" : w.sub);

// Ids match the earlier default accounts and help the SMS reader find them.
const WALLETS = [
  { id: 'cash', name: 'Cash in Hand', label: 'Cash in hand', icon: '💵', sub: 'Money in your wallet or at home' },
  { id: 'bkash', name: 'bKash', label: 'bKash', icon: '📱', color: '#e2136e' },
  { id: 'nagad', name: 'Nagad', label: 'Nagad', icon: '📱', color: '#f7941d' },
  { id: 'rocket', name: 'Rocket', label: 'Rocket', icon: '📱', color: '#8c3494' },
  { id: 'upay', name: 'Upay', label: 'Upay', icon: '📱', color: '#1e4fa3' },
  { id: 'bank', name: 'Bank', label: 'Bank account', icon: '🏦', sub: 'Savings, salary or student account' },
];

const GOALS = [0, 500, 1000, 2000, 5000, 10000];
const STEPS = ['hello', 'who', 'where', 'amounts', 'spend', 'income', 'goal', 'done'];

const fresh = () => ({ step: 'hello', persona: null, prof: null, btype: null, bizMode: null, wallets: ['cash'], bankName: '', balances: {}, expense: null, income: null, goal: null });
let draft = null;
let draftKey = 'mt:onb';
let celebrating = false;
let customGoal = false;

function loadDraft(uid) {
  draftKey = `mt:onb:${uid}`;
  if (draft) return;
  try {
    draft = { ...fresh(), ...JSON.parse(localStorage.getItem(draftKey) || '{}') };
  } catch {
    draft = fresh();
  }
  if (draft.step === 'done') draft.step = 'goal'; // the data was never saved
}
function saveDraft() {
  try {
    localStorage.setItem(draftKey, JSON.stringify(draft));
  } catch {}
}

// True while the "Your Potli is ready" screen is up, after the data exists.
export const isCelebrating = () => celebrating;

const valid = {
  hello: () => true,
  who: () => !!draft.prof && (draft.persona !== 'business' || draft.bizMode === 'personal' || (draft.bizMode === 'shop' && !!draft.btype)),
  where: () => draft.wallets.length > 0,
  amounts: () => draft.wallets.every((id) => !(Number(draft.balances[id]) < 0)),
  spend: () => draft.expense.length > 0,
  income: () => draft.income.length > 0,
  goal: () => draft.goal != null && draft.goal >= 0,
};

// ctx: { user, save(data), importFile(file), setLang(l), done(next) }
export function renderWizard(root, ctx) {
  loadDraft(ctx.user?.uid || 'me');
  const p = draft.persona ? starter() : null;
  draft.expense ??= p ? [...p.expense] : null;
  draft.income ??= p ? [...p.income] : null;
  const step = celebrating ? 'done' : draft.step;
  // Saving redraws the app; keep the celebration (and its confetti) as it is.
  if (step === 'done' && root.dataset.ob === `done|${lang}`) return;
  root.dataset.ob = `${step}|${lang}`;
  const idx = STEPS.indexOf(step);
  const first = ctx.user?.uid === 'demo' ? '' : (ctx.user?.displayName || '').split(' ')[0];

  const coach = (msg, sub = '') => `
    <div class="ob-coach">
      <img src="icons/icon.svg" alt="" width="56" height="56">
      <div class="ob-bubble"><strong>${msg}</strong>${sub ? `<span>${sub}</span>` : ''}</div>
    </div>`;

  const bodies = {
    hello: () => `
      <div class="segmented lang-switch ob-lang">
        <button type="button" data-ob-lang="en" class="${lang === 'en' ? 'active' : ''}">English</button>
        <button type="button" data-ob-lang="bn" class="${lang === 'bn' ? 'active' : ''}">বাংলা</button>
      </div>
      <div class="ob-hero"><img src="icons/icon.svg" alt="" width="96" height="96"></div>
      <h1 class="ob-title">${first ? t('Hi {name}! 👋', { name: esc(first) }) : t('Hi! 👋')}</h1>
      <p class="ob-lead">${t("I'm your Potli. Let's set up your money in about 1 minute: where you keep it, and what you spend on.")}</p>
      <ul class="ob-points">
        <li>🔒 ${t('Only you can see your data. It is saved in your own Google Drive.')}</li>
        <li>✏️ ${t('You can change every answer later in Setup.')}</li>
      </ul>`,
    who: () => {
      const chosen = draft.prof && (draft.prof.id === 'custom' ? null : professionById(draft.prof.id));
      const popular = POPULAR.includes(draft.prof?.id);
      const card = (p, attrs, sub) => `<button type="button" class="ob-option ${draft.prof?.id === p.id ? 'on' : ''}" role="radio" aria-checked="${draft.prof?.id === p.id}" ${attrs}>
          <span class="ob-ico">${p.icon}</span><span class="ob-txt"><strong>${esc(profName(p))}</strong>${sub ? `<small>${t(sub)}</small>` : ''}</span></button>`;
      return `
      ${coach(t('What do you do?'), t('Type your work, or pick one below. I will suggest categories that fit.'))}
      <div class="prof-search">
        <span aria-hidden="true">🔎</span>
        <input id="prof-input" type="search" autocomplete="off" placeholder="${esc(t('e.g. teacher, pharmacy, poultry farm'))}" aria-label="${esc(t('Your work'))}">
      </div>
      <div id="prof-results" class="prof-results" role="listbox"></div>
      ${
        draft.prof && !popular
          ? `<div class="ob-options">${
              chosen
                ? card(chosen, `data-prof-id="${chosen.id}"`)
                : `<button type="button" class="ob-option on" role="radio" aria-checked="true"><span class="ob-ico">🧑</span><span class="ob-txt"><strong>${esc(draft.prof.label)}</strong><small>${t('Your own profession')}</small></span></button>`
            }${subChoices()}</div>`
          : ''
      }
      <p class="ob-label">${t('Popular')}</p>
      <div class="ob-options" role="radiogroup">
        ${POPULAR.map((id) => card(professionById(id), `data-persona="${id}"`, POPULAR_SUB[id]) + (draft.prof?.id === id ? subChoices() : '')).join('')}
      </div>`;
    },
    where: () => `
      ${coach(t('Where do you keep your money?'), t('Pick all that you use.'))}
      <div class="ob-options grid">
        ${WALLETS.map((w) => {
          const on = draft.wallets.includes(w.id);
          return `<button type="button" class="ob-option ${on ? 'on' : ''}" role="checkbox" aria-checked="${on}" data-wallet="${w.id}">
            <span class="ob-ico" ${w.color ? `style="--c:${w.color}"` : ''}>${w.color ? `<i class="ob-dot"></i>` : w.icon}</span>
            <span class="ob-txt"><strong>${t(walletLabel(w))}</strong>${walletSub(w) ? `<small>${t(walletSub(w))}</small>` : ''}</span>
            <span class="ob-check" aria-hidden="true">✓</span></button>`;
        }).join('')}
      </div>`,
    amounts: () => `
      ${coach(t('How much is in each one right now?'), t('Check your bKash app or the last bank SMS. A close guess is fine; you can fix it later.'))}
      <div class="ob-amounts">
        ${draft.wallets
          .map((id) => {
            const w = WALLETS.find((x) => x.id === id);
            return `<div class="ob-amount">
              <label for="ob-bal-${id}">${id === 'bank' ? t('Bank') : t(walletLabel(w))}</label>
              ${id === 'bank' ? `<input id="ob-bank-name" class="ob-bank-name" placeholder="${esc(t('Bank name, for example Sonali Bank'))}" value="${esc(draft.bankName)}" maxlength="40" autocomplete="off">` : ''}
              <div class="ob-money"><span>৳</span><input id="ob-bal-${id}" data-bal="${id}" type="number" inputmode="decimal" min="0" step="any" placeholder="0" value="${draft.balances[id] ?? ''}"></div>
            </div>`;
          })
          .join('')}
      </div>`,
    spend: () => `
      ${coach(isShop() ? t('What does the business spend money on?') : t('What do you usually spend on?'), t('Tap to add or remove. These become your budget categories.'))}
      ${chipPicker('expense', pool('expense'), isShop() ? t('Add your own, for example Ice') : t('Add your own, for example Gym'))}`,
    income: () => `
      ${coach(isShop() ? t('How does money come into the business?') : t('Where does your money come from?'), t('Pick all that apply.'))}
      ${chipPicker('income', pool('income'), isShop() ? t('Add your own, for example Flexiload') : t('Add your own, for example Pocket Money'))}`,
    goal: () => `
      ${
        isShop()
          ? coach(t('How much profit do you aim for each month?'), t('Profit = sales minus costs.'))
          : coach(t('How much do you want to save each month?'), t('Saving = income minus spending. A small goal is a great start.'))
      }
      <div class="ob-goals">
        ${GOALS.map((g) => `<button type="button" class="ob-chip big ${draft.goal === g && !customGoal ? 'on' : ''}" data-goal="${g}">${g ? `৳ ${nf.format(g)}` : t('Not now')}</button>`).join('')}
        <button type="button" class="ob-chip big ${customGoal ? 'on' : ''}" data-goal-custom>${t('Other amount')}</button>
      </div>
      <div class="ob-money" id="ob-goal-box" ${customGoal ? '' : 'hidden'}><span>৳</span><input id="ob-goal" type="number" inputmode="decimal" min="0" step="any" placeholder="0" value="${customGoal && draft.goal ? draft.goal : ''}"></div>`,
    done: () => {
      const s = summary();
      return `
      <div class="ob-confetti" aria-hidden="true">${confetti()}</div>
      <div class="ob-hero pop"><img src="icons/icon.svg" alt="" width="96" height="96"></div>
      <h1 class="ob-title">${t('Your Potli is ready! 🎉')}</h1>
      <div class="ob-summary">
        <div><span>${t('Accounts')}</span><strong>${s.accounts}</strong></div>
        <div><span>${t('Total money')}</span><strong class="num">৳ ${nf.format(s.total)}</strong></div>
        <div><span>${t('Categories')}</span><strong>${s.cats}</strong></div>
        <div><span>${isShop() ? t('Profit goal') : t('Savings goal')}</span><strong class="num">${s.goal ? `৳ ${nf.format(s.goal)}` : '—'}</strong></div>
      </div>
      <p class="ob-lead">${
        isShop() ? t('A healthy business writes down every sale and cost the same day. Start with one now.') : t("Now the most important habit: write down what you spend, every day. Let's add your first one.")
      }</p>
      <p class="muted ob-small">${t('Owe someone, or lent money to someone? Add it later with + → Loan.')}</p>`;
    },
  };

  const footer = {
    hello: `<button class="btn primary wide ob-cta" data-next>${t("Let's start")}</button>
      <label class="btn wide ob-alt">${t('I have a backup file (.json)')}<input type="file" accept=".json,application/json" id="welcome-import" hidden></label>`,
    done: `<button class="btn primary wide ob-cta" data-finish="expense">${t('Add my first expense')}</button>
      <button class="btn wide ob-alt" data-finish="">${t('Go to Dashboard')}</button>`,
  }[step] ?? `${step === 'amounts' ? `<div class="ob-total"><span>${t('Total')}</span><strong class="num" id="ob-total">৳ ${nf.format(totalBalance())}</strong></div>` : ''}<button class="btn primary wide ob-cta" data-next ${valid[step]() ? '' : 'disabled'}>${t(step === 'goal' ? 'Finish' : 'Continue')}</button>`;

  const showBar = step !== 'hello' && step !== 'done';
  root.innerHTML = `
    <div class="ob" data-step="${step}">
      ${
        showBar
          ? `<div class="ob-top">
              <button type="button" class="icon-btn ob-back" data-back aria-label="${esc(t('Back'))}">‹</button>
              <div class="ob-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${STEPS.length - 2}" aria-valuenow="${idx}"><div style="width:${(idx / (STEPS.length - 2)) * 100}%"></div></div>
            </div>`
          : ''
      }
      <div class="ob-body">${bodies[step]()}</div>
      <div class="ob-foot">${footer}</div>
    </div>`;

  bind(root, ctx, step);
}

// Business owners choose whose money this potli is for; a plain "Business
// owner" also picks the kind of business.
function subChoices() {
  if (draft.persona !== 'business') return '';
  const modes = [
    ['personal', '🧍', 'My personal money', 'Family, bills, savings'],
    ['shop', '🏪', "My business's money", 'Sales, stock, business costs'],
  ];
  const kinds =
    draft.bizMode === 'shop' && draft.prof?.id === 'business'
      ? `<p>${t('What kind of business?')}</p>
         <div class="ob-chips">${BUSINESS_TYPES.map((b) => {
           const p = professionById(BTYPE_PROF[b] || b);
           return `<button type="button" class="ob-chip ${draft.btype === b ? 'on' : ''}" aria-pressed="${draft.btype === b}" data-btype="${b}">${p.icon} ${esc(profName(p))}</button>`;
         }).join('')}</div>`
      : '';
  return `<div class="ob-sub" role="radiogroup" aria-label="${esc(t('What will you track?'))}">
      <p>${t('What will you track?')}</p>
      ${modes
        .map(
          ([m, ic, l, sub]) => `<button type="button" class="ob-option ${draft.bizMode === m ? 'on' : ''}" role="radio" aria-checked="${draft.bizMode === m}" data-biz="${m}">
            <span class="ob-ico">${ic}</span><span class="ob-txt"><strong>${t(l)}</strong><small>${t(sub)}</small></span></button>`,
        )
        .join('')}
      ${kinds}
    </div>`;
}

function chipPicker(key, pool, placeholder) {
  const list = draft[key];
  const all = [...list, ...pool.filter((x) => !list.includes(x))];
  return `<div class="ob-chips">
      ${all.map((c) => `<button type="button" class="ob-chip ${list.includes(c) ? 'on' : ''}" aria-pressed="${list.includes(c)}" data-chip="${esc(c)}">${list.includes(c) ? '✓ ' : '+ '}${esc(c)}</button>`).join('')}
    </div>
    <form class="ob-add" data-add>
      <input maxlength="30" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}">
      <button class="btn" type="submit">${t('Add')}</button>
    </form>
    <p class="muted ob-small" id="ob-count">${t('{n} selected', { n: list.length })}</p>`;
}

function totalBalance() {
  return draft.wallets.reduce((s, id) => s + (Number(draft.balances[id]) || 0), 0);
}

function summary() {
  return {
    accounts: draft.wallets.length,
    total: totalBalance(),
    cats: draft.expense.length,
    goal: draft.goal || 0,
  };
}

// 24 pieces of CSS confetti; they fall once and stop (none with reduced motion).
function confetti() {
  const colors = ['#0f766e', '#f59e0b', '#e2136e', '#2563eb', '#16a34a', '#fbbf24'];
  return Array.from({ length: 24 }, (_, i) => {
    const x = (i * 37) % 100;
    const d = (i % 6) * 0.12;
    return `<i style="left:${x}%;background:${colors[i % colors.length]};animation-delay:${d}s;--r:${(i * 47) % 360}deg"></i>`;
  }).join('');
}

function go(root, ctx, step) {
  draft.step = step;
  saveDraft();
  renderWizard(root, ctx);
  root.querySelector('.ob')?.classList.add('enter');
  window.scrollTo({ top: 0 });
  // Balances are typed straight away; on other steps the keyboard stays closed.
  if (step === 'amounts') root.querySelector('[data-bal]')?.focus({ preventScroll: true });
}

function bind(root, ctx, step) {
  const rerender = () => renderWizard(root, ctx);
  const nextBtn = $('[data-next]', root);
  const refreshNext = () => nextBtn && (nextBtn.disabled = !valid[step]());

  $$('[data-ob-lang]', root).forEach((b) => (b.onclick = () => ctx.setLang(b.dataset.obLang)));
  const imp = $('#welcome-import', root);
  if (imp) imp.onchange = (e) => e.target.files[0] && ctx.importFile(e.target.files[0]);

  $('[data-back]', root)?.addEventListener('click', () => go(root, ctx, STEPS[Math.max(0, STEPS.indexOf(step) - 1)]));
  nextBtn?.addEventListener('click', () => {
    if (!valid[step]()) return;
    if (step === 'goal') return finish(root, ctx);
    go(root, ctx, STEPS[STEPS.indexOf(step) + 1]);
  });

  const pick = (p, custom) => {
    if (custom || draft.prof?.id !== p.id) chooseProfession(p, custom);
    saveDraft();
    rerender();
  };
  $$('[data-persona]', root).forEach((b) => (b.onclick = () => pick(professionById(b.dataset.persona))));
  // Search: only the list under the box is redrawn while typing, so the keyboard stays open.
  const box = $('#prof-input', root);
  const results = $('#prof-results', root);
  if (box)
    box.oninput = () => {
      const q = box.value.trim().replace(/\s+/g, ' ');
      const found = searchProfessions(q);
      results.innerHTML =
        found.map((p) => `<button type="button" role="option" data-prof-id="${p.id}"><span>${p.icon}</span>${esc(profName(p))}<small>${esc(lang === 'bn' ? p.en : p.bn)}</small></button>`).join('') +
        (q.length >= 2 ? `<button type="button" role="option" class="prof-other" data-prof-custom="${esc(q)}"><span>➕</span>${esc(t('Other profession: “{name}”', { name: q }))}</button>` : '');
      $$('[data-prof-id]', results).forEach((b) => (b.onclick = () => pick(professionById(b.dataset.profId))));
      $$('[data-prof-custom]', results).forEach((b) => (b.onclick = () => pick(null, b.dataset.profCustom.slice(0, 40))));
    };
  $$('.ob-options [data-prof-id]', root).forEach((b) => (b.onclick = () => pick(professionById(b.dataset.profId))));
  $$('[data-biz]', root).forEach(
    (b) =>
      (b.onclick = () => {
        draft.bizMode = b.dataset.biz;
        resetLists();
        saveDraft();
        rerender();
      }),
  );
  $$('[data-btype]', root).forEach(
    (b) =>
      (b.onclick = () => {
        draft.btype = b.dataset.btype;
        resetLists();
        saveDraft();
        rerender();
      }),
  );
  $$('[data-wallet]', root).forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.wallet;
        draft.wallets = draft.wallets.includes(id) ? draft.wallets.filter((x) => x !== id) : WALLETS.map((w) => w.id).filter((x) => x === id || draft.wallets.includes(x));
        saveDraft();
        rerender();
      }),
  );

  // Typing must not redraw the screen (that would close the phone keyboard).
  $$('[data-bal]', root).forEach(
    (inp) =>
      (inp.oninput = () => {
        draft.balances[inp.dataset.bal] = inp.value === '' ? undefined : Number(inp.value);
        $('#ob-total', root).textContent = `৳ ${nf.format(totalBalance())}`;
        inp.classList.toggle('bad', Number(inp.value) < 0);
        saveDraft();
        refreshNext();
      }),
  );
  const bank = $('#ob-bank-name', root);
  if (bank) bank.oninput = () => ((draft.bankName = bank.value), saveDraft());

  const key = step === 'spend' ? 'expense' : step === 'income' ? 'income' : null;
  $$('[data-chip]', root).forEach(
    (b) =>
      (b.onclick = () => {
        const c = b.dataset.chip;
        const on = !draft[key].includes(c);
        draft[key] = on ? [...draft[key], c] : draft[key].filter((x) => x !== c);
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on);
        b.textContent = `${on ? '✓' : '+'} ${c}`;
        $('#ob-count', root).textContent = t('{n} selected', { n: draft[key].length });
        saveDraft();
        refreshNext();
      }),
  );
  const add = $('[data-add]', root);
  if (add)
    add.onsubmit = (e) => {
      e.preventDefault();
      const inp = $('input', add);
      const name = inp.value.trim().replace(/\s+/g, ' ');
      if (!name) return;
      const same = draft[key].find((x) => x.toLowerCase() === name.toLowerCase());
      if (!same) draft[key] = [...draft[key], name];
      saveDraft();
      rerender();
      $('[data-add] input', root)?.focus();
    };

  $$('[data-goal]', root).forEach(
    (b) =>
      (b.onclick = () => {
        customGoal = false;
        draft.goal = Number(b.dataset.goal);
        saveDraft();
        rerender();
      }),
  );
  const custom = $('[data-goal-custom]', root);
  if (custom)
    custom.onclick = () => {
      customGoal = true;
      draft.goal = null;
      rerender();
      $('#ob-goal', root)?.focus();
    };
  const goalInp = $('#ob-goal', root);
  if (goalInp)
    goalInp.oninput = () => {
      draft.goal = goalInp.value === '' ? null : Number(goalInp.value);
      saveDraft();
      refreshNext();
    };

  $$('[data-finish]', root).forEach(
    (b) =>
      (b.onclick = () => {
        celebrating = false;
        draft = null;
        delete root.dataset.ob;
        try {
          localStorage.removeItem(draftKey);
        } catch {}
        ctx.done(b.dataset.finish);
      }),
  );
}

async function finish(root, ctx) {
  const accounts = draft.wallets.map((id, i) => {
    const w = WALLETS.find((x) => x.id === id);
    const name = id === 'bank' ? draft.bankName.trim() || 'Bank' : id === 'cash' && isShop() ? 'Cash Box' : w.name;
    return { id, name, type: 'Liquid', opening: Math.max(0, Number(draft.balances[id]) || 0), order: i + 1 };
  });
  const settings = {
    ...DEFAULT_SETTINGS,
    savingsGoal: draft.goal || 0,
    incomeCategories: [...draft.income],
    expenseCategories: draft.expense.map((name) => ({ name, budget: 0 })),
    onboarding: { persona: isShop() ? 'shop' : draft.persona, hidden: false, done: {} },
    ...(isShop() && { mode: 'shop', productGroups: [...BUSINESS[draft.btype].products], stockCategory: BUSINESS[draft.btype].stock }),
    profession: draft.prof.id === 'custom' ? { label: draft.prof.label } : { id: draft.prof.id, ...(isShop() && { business: draft.btype }) },
    ...(draft.persona === 'home' && { simple: true }), // the simple home screen
  };
  // Show the celebration before the save finishes, so the screen does not jump.
  celebrating = true;
  draft.step = 'done';
  saveDraft();
  renderWizard(root, ctx);
  await ctx.save({ accounts, transactions: [], settings });
  try {
    localStorage.removeItem(draftKey); // saved for real now
  } catch {}
}
