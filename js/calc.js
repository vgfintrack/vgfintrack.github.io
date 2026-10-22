// Pure calculation helpers. No DOM, no Firebase — easy to test with Node.

export const ACCOUNT_TYPES = ['Liquid', 'Lend', 'Investment', 'Debt'];

// Service charges (bKash cash-out, bank transfer fees) are stored as `fee`
// on an Expense or Transfer. They are paid from the same account and count
// as spending in this category.
export const FEE_CATEGORY = 'Service Charges';
const fee = (t) => (t.type === 'Income' ? 0 : Number(t.fee) || 0);

// ---------- dates (all dates are 'YYYY-MM-DD' strings, local time) ----------

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function fmtDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}

export function today() {
  return fmtDate(new Date());
}

export function monthRange(s) {
  const d = parseDate(s);
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 12);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12);
  return { start: fmtDate(start), end: fmtDate(end) };
}

// Weeks run Saturday -> Friday.
export function weekRange(s) {
  const d = parseDate(s);
  const back = (d.getDay() + 1) % 7; // Sat=0, Sun=1, ... Fri=6
  const start = addDays(s, -back);
  return { start, end: addDays(start, 6) };
}

export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000) + 1;
}

const inRange = (t, r) => t.date >= r.start && t.date <= r.end;

// ---------- balances ----------

// Book balance = opening + money in - money out.
// Debt accounts are stored as a positive "amount owed" and returned the same
// way: paying the debt (a transfer into it) reduces what you owe.
export function balances(accounts, txns) {
  const bal = {};
  for (const a of accounts) bal[a.id] = a.type === 'Debt' ? -(a.opening || 0) : a.opening || 0;
  for (const t of txns) {
    const amt = Number(t.amount) || 0;
    if (t.type === 'Income' && t.account in bal) bal[t.account] += amt;
    else if (t.type === 'Expense' && t.account in bal) bal[t.account] -= amt + fee(t);
    else if (t.type === 'Transfer') {
      if (t.account in bal) bal[t.account] -= amt + fee(t);
      if (t.toAccount in bal) bal[t.toAccount] += amt;
    }
  }
  const out = {};
  for (const a of accounts) {
    const book = a.type === 'Debt' ? -bal[a.id] : bal[a.id];
    const hasValue = a.type === 'Investment' && a.currentValue != null && a.currentValue !== '';
    out[a.id] = { book, value: hasValue ? Number(a.currentValue) : book };
  }
  return out;
}

export function worth(accounts, txns) {
  const b = balances(accounts, txns);
  const sum = (type) =>
    accounts.filter((a) => a.type === type).reduce((s, a) => s + b[a.id].value, 0);
  const liquid = sum('Liquid');
  const lent = sum('Lend');
  const investments = sum('Investment');
  const debt = sum('Debt');
  return { balances: b, liquid, lent, investments, debt, netWorth: liquid + lent + investments - debt };
}

// ---------- period stats ----------

export function periodStats(range, txns, accounts, refDay = today()) {
  const ts = txns.filter((t) => inRange(t, range));
  const invIds = new Set(accounts.filter((a) => a.type === 'Investment').map((a) => a.id));
  let income = 0, expenses = 0, toInvestments = 0;
  for (const t of ts) {
    const amt = Number(t.amount) || 0;
    expenses += fee(t);
    if (t.type === 'Income') income += amt;
    else if (t.type === 'Expense') expenses += amt;
    else if (t.type === 'Transfer') {
      if (invIds.has(t.toAccount)) toInvestments += amt;
      if (invIds.has(t.account)) toInvestments -= amt;
    }
  }
  // Average per day counts only days that have happened so far.
  const last = refDay < range.start ? range.start : refDay > range.end ? range.end : refDay;
  const days = daysBetween(range.start, last);
  const net = income - expenses;
  return {
    income,
    expenses,
    net,
    savingsRate: income > 0 ? net / income : null,
    toInvestments,
    avgPerDay: expenses / days,
    count: ts.length,
  };
}

export function sumBy(range, txns, type, key = 'category') {
  const out = {};
  for (const t of txns) {
    if (!inRange(t, range)) continue;
    if (type === 'Expense' && fee(t)) out[FEE_CATEGORY] = (out[FEE_CATEGORY] || 0) + fee(t);
    if (t.type !== type) continue;
    out[t[key]] = (out[t[key]] || 0) + (Number(t.amount) || 0);
  }
  return out;
}

// Net amount added to each investment account in a range.
export function netAdded(range, txns, accountId) {
  let n = 0;
  for (const t of txns) {
    if (t.type !== 'Transfer' || !inRange(t, range)) continue;
    if (t.toAccount === accountId) n += Number(t.amount) || 0;
    if (t.account === accountId) n -= Number(t.amount) || 0;
  }
  return n;
}

export function dailySeries(range, txns) {
  const days = [];
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) days.push({ date: d, income: 0, expenses: 0 });
  const idx = Object.fromEntries(days.map((d, i) => [d.date, i]));
  for (const t of txns) {
    const i = idx[t.date];
    if (i === undefined) continue;
    if (t.type === 'Income') days[i].income += Number(t.amount) || 0;
    if (t.type === 'Expense') days[i].expenses += Number(t.amount) || 0;
    days[i].expenses += fee(t);
  }
  return days;
}

export function monthlySeries(endDate, n, txns, accounts) {
  const out = [];
  const end = parseDate(endDate);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1, 12);
    const r = monthRange(fmtDate(d));
    const s = periodStats(r, txns, accounts, r.end);
    out.push({
      label: d.toLocaleString('en-GB', { month: 'short', year: 'numeric' }),
      income: s.income,
      expenses: s.expenses,
      net: s.net,
    });
  }
  return out;
}

// Goal for a week is the monthly goal spread over the days of that month.
export function weeklyGoal(monthlyGoal, weekStart) {
  const r = monthRange(weekStart);
  return (monthlyGoal * 7) / daysBetween(r.start, r.end);
}
