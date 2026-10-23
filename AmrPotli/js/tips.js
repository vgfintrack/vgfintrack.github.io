// Potli tips: short insights about the user's money, worked out on this phone
// from their own entries. Nothing is sent anywhere, and no AI service is
// used: each tip is a rule written here, in plain words.
// Loaded after the dashboard is on screen.

import * as C from './calc.js';
import * as Rc from './recurring.js';
import { t, addBangla } from './i18n.js';

addBangla({
  'Last week you spent ৳{a}, {p}% less than the week before. Most went to {cat} (৳{c}).': 'গত সপ্তাহে খরচ ৳{a}, আগের সপ্তাহের চেয়ে {p}% কম। সবচেয়ে বেশি গেছে {cat}-এ (৳{c})।',
  'Last week you spent ৳{a}, {p}% more than the week before. Most went to {cat} (৳{c}).': 'গত সপ্তাহে খরচ ৳{a}, আগের সপ্তাহের চেয়ে {p}% বেশি। সবচেয়ে বেশি গেছে {cat}-এ (৳{c})।',
  'Last week you spent ৳{a}. Most went to {cat} (৳{c}).': 'গত সপ্তাহে খরচ ৳{a}। সবচেয়ে বেশি গেছে {cat}-এ (৳{c})।',
  'Last week: sales ৳{s}, costs ৳{c}, profit ৳{p}.': 'গত সপ্তাহ: বিক্রি ৳{s}, খরচ ৳{c}, লাভ ৳{p}।',
  'Last week: sales ৳{s}, costs ৳{c}, a loss of ৳{p}.': 'গত সপ্তাহ: বিক্রি ৳{s}, খরচ ৳{c}, লোকসান ৳{p}।',
  '{cat} so far this month: ৳{a}, {p}% more than by this day last month.': 'এ মাসে এ পর্যন্ত {cat}: ৳{a}, গত মাসের এই দিন পর্যন্ত চেয়ে {p}% বেশি।',
  'Well done: {cat} is {p}% lower than by this day last month.': 'ভালো হচ্ছে: {cat} গত মাসের এই দিন পর্যন্ত চেয়ে {p}% কম।',
  '{cat} is over its budget by ৳{a}.': '{cat} বাজেটের চেয়ে ৳{a} বেশি হয়ে গেছে।',
  '{cat} budget: {p}% used, {d} days left in the month.': '{cat} বাজেট: {p}% খরচ হয়েছে, মাস শেষ হতে {d} দিন বাকি।',
  'Charges for cash-out and sending money cost you ৳{a} this month. Paying shops straight from bKash or Nagad, instead of cashing out, avoids the cash-out charge.': 'ক্যাশ আউট আর টাকা পাঠানোর চার্জে এ মাসে গেছে ৳{a}। ক্যাশ আউট না করে বিকাশ বা নগদ থেকে সরাসরি দোকানে পেমেন্ট করলে ক্যাশ আউটের চার্জ লাগে না।',
  'Last month you kept {r}% of your income (৳{n}), better than {q}% the month before.': 'গত মাসে আয়ের {r}% (৳{n}) রাখতে পেরেছেন, আগের মাসের {q}%-এর চেয়ে ভালো।',
  'Last month you kept {r}% of your income (৳{n}); the month before it was {q}%.': 'গত মাসে আয়ের {r}% (৳{n}) রাখতে পেরেছেন; আগের মাসে ছিল {q}%।',
  'Last month you spent ৳{n} more than you earned. Looking at the biggest category first helps most.': 'গত মাসে আয়ের চেয়ে ৳{n} বেশি খরচ হয়েছে। সবচেয়ে বড় ক্যাটাগরিটা আগে দেখলে সবচেয়ে বেশি কাজে দেয়।',
  "Last month's profit: ৳{n}, {r}% of sales.": 'গত মাসের লাভ: ৳{n}, বিক্রির {r}%।',
  'Savings goal ৳{g}: ৳{n} kept so far this month. You are on track.': 'সঞ্চয়ের লক্ষ্য ৳{g}: এ মাসে এ পর্যন্ত ৳{n} রাখা গেছে। ঠিক পথে আছেন।',
  'Savings goal ৳{g}: ৳{n} kept so far this month, a little behind. Spending ৳{d} less a day would catch up.': 'সঞ্চয়ের লক্ষ্য ৳{g}: এ মাসে এ পর্যন্ত ৳{n} রাখা গেছে, একটু পিছিয়ে। দিনে ৳{d} কম খরচ করলে ধরে ফেলবেন।',
  '{name} ৳{a} is due {when}, but {acc} has only ৳{b}.': '{name} ৳{a} {when} দিতে হবে, কিন্তু {acc}-এ আছে মাত্র ৳{b}।',
  '{name} ৳{a} is due {when}.': '{name} ৳{a} {when} দিতে হবে।',
  'today': 'আজ',
  'tomorrow': 'আগামীকাল',
  'in {n} days': '{n} দিন পর',
  'You owe {name} ৳{a}, due {when}.': '{name}-কে ৳{a} দিতে হবে, {when}।',
  '{name} owes you ৳{a}, due {when}.': '{name} আপনাকে ৳{a} দেবেন, {when}।',
  'You owe {name} ৳{a}; it was due {n} days ago.': '{name}-কে ৳{a} দেওয়ার কথা ছিল {n} দিন আগে।',
  '{name} owes you ৳{a}; it was due {n} days ago.': '{name} আপনাকে ৳{a} দেওয়ার কথা ছিল {n} দিন আগে।',
  'No entries for {n} days. Add what you spent, even roughly, to keep the picture right.': '{n} দিন কোনো এন্ট্রি নেই। আনুমানিক হলেও খরচগুলো লিখে রাখুন, তাহলে হিসাব ঠিক থাকবে।',
  '{name} owes ৳{a} baki; no payment for {n} days.': '{name}-এর বাকি ৳{a}; {n} দিন কোনো টাকা দেননি।',
  'Your best sales day is {day}: about ৳{a} on average, ৳{d} more than {slow}.': 'আপনার সবচেয়ে ভালো বিক্রির দিন {day}: গড়ে প্রায় ৳{a}, {slow}-এর চেয়ে ৳{d} বেশি।',
  'Profit margin so far this month: {m}%; by this day last month it was {l}%. Costs rose most in {cat} (৳{a} more).': 'এ মাসে এ পর্যন্ত লাভের হার: {m}%; গত মাসের এই দিন পর্যন্ত ছিল {l}%। খরচ সবচেয়ে বেশি বেড়েছে {cat}-এ (৳{a} বেশি)।',
  'Profit margin so far this month: {m}%, up from {l}% by this day last month.': 'এ মাসে এ পর্যন্ত লাভের হার: {m}%, গত মাসের এই দিন পর্যন্ত ছিল {l}%।',
  'Add entry': 'এন্ট্রি দিন',
  'Regular payment': 'নিয়মিত লেনদেন',
  'Open': 'খুলুন',
});

const sumOf = (o) => Object.values(o).reduce((s, n) => s + n, 0);
const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0] || null;
const pct = (a, b) => Math.round((Math.abs(a - b) / b) * 100);

// Each tip: { id, kind, icon, text, prio, action? }. Higher prio shows first:
// money that is due or short (80–92), then budgets and changes (66–78), then
// the rest. The same id is the same tip (so "not useful" hides it).
// ctx: { accounts, transactions, settings, money(n), dayName(date), today }
export function potliTips(ctx) {
  const { accounts, transactions: txns, settings: s, money } = ctx;
  const today = ctx.today || C.today();
  const out = [];
  const add = (kind, key, icon, text, prio, action = null) => out.push({ id: `${kind}:${key}`, kind, icon, text, prio, action });
  if (txns.length < 5) return out; // too early to say anything useful

  const shop = s.mode === 'shop';
  const fees = ctx.feeCategory || C.FEE_CATEGORY;
  const month = C.monthRange(today);
  const dayN = Number(today.slice(8));
  const soFar = { start: month.start, end: today };
  const lastDay = C.addMonths(today, -1);
  const lastMonth = C.monthRange(lastDay);
  const lastSoFar = { start: lastMonth.start, end: lastDay };
  const count = (r) => txns.filter((x) => x.date >= r.start && x.date <= r.end).length;
  const exp = (r) => C.sumBy(r, txns, 'Expense');
  const inc = (r) => sumOf(C.sumBy(r, txns, 'Income'));
  const acc = Object.fromEntries(accounts.map((a) => [a.id, a]));
  const w = C.worth(accounts, txns);
  const when = (d) => (d === 0 ? t('today') : d === 1 ? t('tomorrow') : t('in {n} days', { n: d }));

  // ---- last week, on the first two days of a new week (weeks run Saturday to Friday)
  const week = C.weekRange(today);
  if (C.daysBetween(week.start, today) <= 2) {
    const lw = C.weekRange(C.addDays(week.start, -1));
    const pw = C.weekRange(C.addDays(lw.start, -1));
    if (count(lw) >= 3) {
      const e = exp(lw);
      const spent = sumOf(e);
      if (shop) {
        const sales = inc(lw);
        const profit = sales - spent;
        add('week', lw.start, '🗓️', t(profit >= 0 ? 'Last week: sales ৳{s}, costs ৳{c}, profit ৳{p}.' : 'Last week: sales ৳{s}, costs ৳{c}, a loss of ৳{p}.', { s: money(sales), c: money(spent), p: money(Math.abs(profit)) }), 67);
      } else if (spent > 0) {
        const [cat, c] = top(e);
        const before = sumOf(exp(pw));
        const change = before > 0 ? pct(spent, before) : 0;
        const text =
          before > 0 && change >= 5
            ? t(spent < before ? 'Last week you spent ৳{a}, {p}% less than the week before. Most went to {cat} (৳{c}).' : 'Last week you spent ৳{a}, {p}% more than the week before. Most went to {cat} (৳{c}).', { a: money(spent), p: change, cat, c: money(c) })
            : t('Last week you spent ৳{a}. Most went to {cat} (৳{c}).', { a: money(spent), cat, c: money(c) });
        add('week', lw.start, '🗓️', text, 67);
      }
    }
  }

  // ---- money that is due: regular payments and loans
  const rules = (s.recurring || []).filter((r) => r.type === 'Expense' || r.type === 'Transfer');
  for (const { rule, date } of Rc.upcoming(rules, today, C.addDays(today, 3)).slice(0, 2)) {
    const d = C.daysUntil(date, today);
    const name = rule.note || rule.category || t('Regular payment');
    const have = w.balances[rule.account]?.value;
    if (have != null && have < Number(rule.amount))
      add('due', `${rule.id}:${date}`, '⏰', t('{name} ৳{a} is due {when}, but {acc} has only ৳{b}.', { name, a: money(rule.amount), when: when(d), acc: acc[rule.account]?.name || '', b: money(Math.max(0, have)) }), 92);
    else add('due', `${rule.id}:${date}`, '⏰', t('{name} ৳{a} is due {when}.', { name, a: money(rule.amount), when: when(d) }), 48);
  }
  for (const a of accounts) {
    if (!a.dueDate || (a.type !== 'Debt' && a.type !== 'Lend') || a.customer || a.supplier) continue;
    const owed = Math.abs(w.balances[a.id]?.value || 0);
    if (owed < 1) continue;
    const d = C.daysUntil(a.dueDate, today);
    if (d > 7) continue;
    const name = a.name.replace(/^(lent to|loan from|borrowed from|loan to)\s+/i, '');
    const mine = a.type === 'Debt';
    const text =
      d < 0
        ? t(mine ? 'You owe {name} ৳{a}; it was due {n} days ago.' : '{name} owes you ৳{a}; it was due {n} days ago.', { name, a: money(owed), n: -d })
        : t(mine ? 'You owe {name} ৳{a}, due {when}.' : '{name} owes you ৳{a}, due {when}.', { name, a: money(owed), when: when(d) });
    add('loan', `${a.id}:${a.dueDate}`, '🤝', text, d < 0 ? 88 : 78);
  }

  // ---- budgets (personal) and categories that grew
  const now = exp(soFar);
  const daysLeft = C.daysUntil(month.end, today);
  for (const c of s.expenseCategories || []) {
    const budget = Number(c.budget) || 0;
    const used = now[c.name] || 0;
    if (!budget || !used) continue;
    if (used > budget) add('budget', `${c.name}:${month.start}:over`, '🎯', t('{cat} is over its budget by ৳{a}.', { cat: c.name, a: money(used - budget) }), 86);
    else if (used / budget >= 0.8 && daysLeft >= 5) add('budget', `${c.name}:${month.start}`, '🎯', t('{cat} budget: {p}% used, {d} days left in the month.', { cat: c.name, p: Math.round((used / budget) * 100), d: daysLeft }), 74);
  }
  if (dayN >= 5 && count(lastMonth) >= 10) {
    const before = exp(lastSoFar);
    const changes = Object.keys({ ...now, ...before })
      .filter((cat) => cat !== fees && (now[cat] || 0) >= 300 && (before[cat] || 0) >= 300)
      .map((cat) => [cat, now[cat], before[cat], now[cat] - before[cat]]);
    const up = changes.filter(([, a, b]) => a >= b * 1.3 && a - b >= 300).sort((x, y) => y[3] - x[3])[0];
    const down = changes.filter(([, a, b]) => a <= b * 0.7 && b - a >= 300).sort((x, y) => x[3] - y[3])[0];
    if (up) add('catup', `${up[0]}:${month.start}`, '📈', t('{cat} so far this month: ৳{a}, {p}% more than by this day last month.', { cat: up[0], a: money(up[1]), p: pct(up[1], up[2]) }), 70);
    if (down) add('catdown', `${down[0]}:${month.start}`, '👏', t('Well done: {cat} is {p}% lower than by this day last month.', { cat: down[0], p: pct(down[1], down[2]) }), 38);
  }

  // ---- charges
  const charged = now[fees] || 0;
  if (charged >= 100) add('fees', month.start, '💸', t('Charges for cash-out and sending money cost you ৳{a} this month. Paying shops straight from bKash or Nagad, instead of cashing out, avoids the cash-out charge.', { a: money(charged) }), 50);

  // ---- last month, in the first week of a new month
  if (dayN <= 7 && count(lastMonth) >= 10) {
    const st = C.periodStats(lastMonth, txns, accounts, lastMonth.end);
    if (shop) {
      if (st.income > 0) add('lastmonth', lastMonth.start, '📊', t("Last month's profit: ৳{n}, {r}% of sales.", { n: money(st.net), r: Math.round((st.net / st.income) * 100) }), 60);
    } else if (st.income > 0) {
      if (st.net < 0) add('lastmonth', lastMonth.start, '📊', t('Last month you spent ৳{n} more than you earned. Looking at the biggest category first helps most.', { n: money(-st.net) }), 66);
      else {
        const prevM = C.monthRange(C.addMonths(lastMonth.start, -1));
        const prev = C.periodStats(prevM, txns, accounts, prevM.end);
        const r = Math.round(st.savingsRate * 100);
        if (prev.income > 0 && prev.savingsRate != null) {
          const q = Math.round(prev.savingsRate * 100);
          add('lastmonth', lastMonth.start, '📊', t(r > q ? 'Last month you kept {r}% of your income (৳{n}), better than {q}% the month before.' : 'Last month you kept {r}% of your income (৳{n}); the month before it was {q}%.', { r, q, n: money(st.net) }), r > q ? 58 : 62);
        }
      }
    }
  }

  // ---- savings goal, from the 10th
  const goal = Number(s.savingsGoal) || 0;
  if (!shop && goal > 0 && dayN >= 10) {
    const st = C.periodStats(soFar, txns, accounts, today);
    const days = C.daysBetween(month.start, month.end);
    const pace = (goal * dayN) / days;
    if (st.net >= pace) add('goal', `${month.start}:ok`, '💎', t('Savings goal ৳{g}: ৳{n} kept so far this month. You are on track.', { g: money(goal), n: money(Math.max(0, st.net)) }), 42);
    else if (daysLeft > 0) add('goal', `${month.start}:behind`, '💎', t('Savings goal ৳{g}: ৳{n} kept so far this month, a little behind. Spending ৳{d} less a day would catch up.', { g: money(goal), n: money(Math.max(0, st.net)), d: money(Math.ceil((goal - st.net) / (daysLeft + 1))) }), 64);
  }

  // ---- shops: baki, best day, profit margin
  if (shop) {
    let worst = null;
    for (const a of accounts.filter((x) => x.customer)) {
      const owes = w.balances[a.id]?.value || 0;
      if (owes < 100) continue;
      let lastPaid = null;
      let first = null;
      for (const x of txns) {
        if (x.account !== a.id) continue;
        if (x.type === 'Transfer' && (!lastPaid || x.date > lastPaid)) lastPaid = x.date;
        if (!first || x.date < first) first = x.date;
      }
      const since = lastPaid || first;
      if (!since) continue;
      const days = C.daysBetween(since, today) - 1;
      if (days >= 30 && (!worst || owes * days > worst.score)) worst = { a, owes, days, score: owes * days };
    }
    if (worst) add('baki', worst.a.id, '📒', t('{name} owes ৳{a} baki; no payment for {n} days.', { name: worst.a.name, a: money(worst.owes), n: worst.days }), 80, { label: t('Open'), kind: 'customer', id: worst.a.id });

    const from = C.addDays(today, -56);
    const byDay = [0, 1, 2, 3, 4, 5, 6].map(() => ({ sum: 0, days: new Set() }));
    for (const x of txns) {
      if (x.type !== 'Income' || x.date < from || x.date >= today) continue;
      const wd = C.parseDate(x.date).getDay();
      byDay[wd].sum += Number(x.amount) || 0;
      byDay[wd].days.add(x.date);
    }
    const avg = byDay.map((d, wd) => ({ wd, avg: d.days.size >= 3 ? d.sum / d.days.size : null })).filter((d) => d.avg != null);
    if (avg.length >= 5) {
      avg.sort((a, b) => b.avg - a.avg);
      const best = avg[0];
      const slow = avg.at(-1);
      if (best.avg >= slow.avg * 1.2 && ctx.dayName)
        add('bestday', `${best.wd}:${month.start}`, '🛍️', t('Your best sales day is {day}: about ৳{a} on average, ৳{d} more than {slow}.', { day: ctx.dayName(best.wd), a: money(best.avg), d: money(best.avg - slow.avg), slow: ctx.dayName(slow.wd) }), 30);
    }

    if (dayN >= 7) {
      const sNow = inc(soFar);
      const sBefore = inc(lastSoFar);
      if (sNow > 0 && sBefore > 0) {
        const cNow = sumOf(now);
        const before = exp(lastSoFar);
        const cBefore = sumOf(before);
        const m = Math.round(((sNow - cNow) / sNow) * 100);
        const l = Math.round(((sBefore - cBefore) / sBefore) * 100);
        if (m <= l - 5) {
          const rise = Object.keys(now)
            .map((cat) => [cat, (now[cat] || 0) - (before[cat] || 0)])
            .sort((a, b) => b[1] - a[1])[0];
          if (rise && rise[1] > 0) add('margin', `${month.start}:down`, '📉', t('Profit margin so far this month: {m}%; by this day last month it was {l}%. Costs rose most in {cat} (৳{a} more).', { m, l, cat: rise[0], a: money(rise[1]) }), 72);
        } else if (m >= l + 5) add('margin', `${month.start}:up`, '📈', t('Profit margin so far this month: {m}%, up from {l}% by this day last month.', { m, l }), 36);
      }
    }
  }

  // ---- the habit
  const lastEntry = txns.reduce((d, x) => (x.date <= today && x.date > d ? x.date : d), '');
  const quiet = lastEntry ? C.daysBetween(lastEntry, today) - 1 : 0;
  if (quiet >= 3) add('quiet', lastEntry, '✍️', t('No entries for {n} days. Add what you spent, even roughly, to keep the picture right.', { n: quiet }), 68, { label: t('Add entry'), kind: 'add' });

  return out.sort((a, b) => b.prio - a.prio);
}
