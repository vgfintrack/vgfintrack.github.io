// Made-up people for the FinnBlu tips test and the website screenshots.
// personal: a job holder on Sunday 11 Oct 2026; shop: a grocery on Thursday 15 Oct 2026.
let n = 0;
const tx = (date, type, category, account, amount, extra = {}) => ({ id: 'x' + ++n, date, type, category, account, toAccount: null, amount, note: '', updatedAt: n, createdAt: n, ...extra });
const cats = (list) => list.map(([name, budget = 0]) => ({ name, budget }));

export const personal = {
  version: 2,
  accounts: Object.fromEntries([
    { id: 'cash', name: 'Cash in Hand', type: 'Liquid', opening: 3000, order: 1 },
    { id: 'bkash', name: 'bKash', type: 'Liquid', opening: 4000, order: 2 },
    { id: 'karim', name: 'Loan from Karim', type: 'Debt', opening: 3000, order: 3, dueDate: '2026-10-14' },
  ].map((a) => [a.id, { ...a, updatedAt: 1 }])),
  transactions: {},
  settings: {
    savingsGoal: 5000,
    incomeCategories: ['Salary', 'Other Income'],
    expenseCategories: cats([['Food', 3000], ['Transport'], ['House Rent'], ['Mobile & Internet'], ['Other']]),
    recurring: [{ id: 'rent', type: 'Expense', amount: 8000, category: 'House Rent', account: 'cash', note: 'House rent', every: 'month', start: '2026-08-12', lastDone: '2026-09-12' }],
    onboarding: { persona: 'job', hidden: true, done: {} },
  },
  settingsUpdatedAt: 1,
};
const T = [];
T.push(tx('2026-09-01', 'Income', 'Salary', 'bkash', 30000));
for (const d of ['02', '03', '04', '05', '06', '07', '08', '09', '10', '11']) T.push(tx(`2026-09-${d}`, 'Expense', 'Food', 'cash', 120));
T.push(tx('2026-09-15', 'Expense', 'House Rent', 'cash', 8000));
// this month: food is up, and a cash-out with a charge
for (const [d, a] of [['01', 500], ['02', 600], ['04', 400], ['05', 700], ['07', 450]]) T.push(tx(`2026-10-${d}`, 'Expense', 'Food', 'bkash', a));
T.push(tx('2026-10-03', 'Transfer', null, 'bkash', 5000, { toAccount: 'cash', fee: 125 }));
T.push(tx('2026-10-06', 'Expense', 'Transport', 'cash', 300));
personal.transactions = Object.fromEntries(T.map((x) => [x.id, x]));
export const shop = {
  version: 2,
  accounts: Object.fromEntries([
    { id: 'cash', name: 'Cash Box', type: 'Liquid', opening: 5000, order: 1 },
    { id: 'rafiq', name: 'Rafiq', type: 'Lend', opening: 2500, order: 2, customer: { phone: '' } },
  ].map((a) => [a.id, { ...a, updatedAt: 1 }])),
  transactions: {},
  settings: {
    mode: 'shop', savingsGoal: 0, incomeCategories: ['Sales'], expenseCategories: cats([['Stock Purchase'], ['Shop Rent'], ['Electricity']]),
    productGroups: ['Rice & Grains'], stockCategory: 'Stock Purchase', onboarding: { persona: 'shop', hidden: true, done: {} },
  },
  settingsUpdatedAt: 1,
};
const S = [];
// 8 weeks of sales: Fridays are busy, Tuesdays slow
for (let d = new Date('2026-08-20T12:00:00'); d < new Date('2026-10-15T12:00:00'); d.setDate(d.getDate() + 1)) {
  const iso = d.toISOString().slice(0, 10);
  const wd = d.getDay();
  S.push(tx(iso, 'Income', 'Sales', 'cash', wd === 5 ? 3000 : wd === 2 ? 800 : 1500));
}
// costs: last month small, this month stock jumped
S.push(tx('2026-09-05', 'Expense', 'Stock Purchase', 'cash', 5000));
S.push(tx('2026-10-05', 'Expense', 'Stock Purchase', 'cash', 15000));
S.push(tx('2026-08-25', 'Income', 'Sales', 'rafiq', 2500 * 0)); // nothing new for Rafiq: his baki is old
shop.transactions = Object.fromEntries(S.map((x) => [x.id, x]));
shop.accounts.rafiq.opening = 2500;
