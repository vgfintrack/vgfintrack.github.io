// Printable documents built from the user's own records: account statement,
// income & expense statement, assets & liabilities, annual tax summary and
// loan statements. Each returns a complete HTML page (A4, print-friendly)
// that the browser can print or save as PDF.

import * as C from './calc.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amt = (n) => {
  const r = Math.round((Number(n) || 0) * 100) / 100;
  return r < 0 ? `(${nf.format(-r)})` : nf.format(r);
};
const blank = (n) => (Math.abs(Number(n) || 0) < 0.005 ? '' : amt(n));
// The app icon, inline so it always appears (also when printing offline).
const LOGO = `<svg viewBox="0 0 512 512" width="40" height="40" aria-hidden="true"><rect width="512" height="512" rx="112" fill="#0f766e"/><path d="M178 112c22 26 44 30 78 14 34 16 56 12 78-14l-26 82H204z" fill="#fbbf24"/><path d="M256 186c-106 12-150 104-140 174 9 62 66 88 140 88s131-26 140-88c10-70-34-162-140-174z" fill="#f59e0b"/><rect x="196" y="176" width="120" height="26" rx="13" fill="#9a3412"/><text x="256" y="408" font-family="system-ui, sans-serif" font-size="170" font-weight="700" text-anchor="middle" fill="#7c2d12">৳</text></svg>`;
const day = (s) => C.parseDate(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export const REPORTS = {
  statement: {
    title: 'Account statement',
    uses: 'Personal record of an account or wallet, with running balance. Bank-statement style.',
  },
  income: {
    title: 'Income & expense statement',
    uses: 'Scholarship, stipend or sponsor forms, loan applications, budgeting.',
  },
  networth: {
    title: 'Statement of assets & liabilities',
    uses: 'Net worth on a date. Helps with the wealth statement in your tax return (IT-10B).',
  },
  tax: {
    title: 'Annual tax summary (1 July – 30 June)',
    uses: 'Income, living expenses and change in wealth for one income year. Helps fill your return (IT-10B / IT-10BB).',
  },
  loan: {
    title: 'Loan statement',
    uses: 'Everything borrowed, repaid, lent or collected with one person or lender, and what is outstanding.',
  },
};

// Bangladesh income year: 1 July – 30 June.
export function incomeYear(ref, offset = 0) {
  const d = C.parseDate(ref);
  const startYear = (d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1) + offset;
  return { start: `${startYear}-07-01`, end: `${startYear + 1}-06-30`, label: `${startYear}–${String(startYear + 1).slice(2)}` };
}

export function presetRange(key, today = C.today()) {
  const m = C.monthRange(today);
  switch (key) {
    case 'this-month':
      return m;
    case 'last-month':
      return C.monthRange(C.addDays(m.start, -1));
    case 'last-3':
      return { start: C.monthRange(C.addMonths(m.start, -2)).start, end: today };
    case 'last-6':
      return { start: C.monthRange(C.addMonths(m.start, -5)).start, end: today };
    case 'this-iy':
      return incomeYear(today);
    case 'last-iy':
      return incomeYear(today, -1);
    case 'this-year':
      return { start: `${today.slice(0, 4)}-01-01`, end: `${today.slice(0, 4)}-12-31` };
    default:
      return m;
  }
}

// --------------------------------------------------------------- calculations

// Balances as of the end of `date`. Past dates use book values, because an
// investment's "current value" is only known for today.
function worthAsOf(ctx, date) {
  const txns = ctx.txns.filter((t) => t.date <= date);
  const accs = date >= C.today() ? ctx.accounts : ctx.accounts.map((a) => ({ ...a, currentValue: null }));
  return C.worth(accs, txns);
}

// How much a transaction moves money into (+) or out of (−) a set of accounts.
function effectOn(t, ids) {
  const a = Number(t.amount) || 0;
  const fee = t.type === 'Income' ? 0 : Number(t.fee) || 0;
  let e = 0;
  if (t.type === 'Income' && ids.has(t.account)) e += a;
  if (t.type === 'Expense' && ids.has(t.account)) e -= a + fee;
  if (t.type === 'Transfer') {
    if (ids.has(t.account)) e -= a + fee;
    if (ids.has(t.toAccount)) e += a;
  }
  return e;
}

const sortAsc = (a, b) => a.date.localeCompare(b.date) || (a.createdAt ?? 0) - (b.createdAt ?? 0);

// --------------------------------------------------------------- page shell

function page(ctx, { title, subtitle, body, declaration }) {
  const generated = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${esc(ctx.holder)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 11.5px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Bengali", sans-serif; color: #13201d; background: #e9eeec; }
  .sheet { background: #fff; max-width: 210mm; margin: 16px auto; padding: 14mm 12mm; box-shadow: 0 2px 12px rgb(0 0 0 / .12); }
  .bar { position: sticky; top: 0; display: flex; gap: 8px; justify-content: center; padding: 10px; background: #0f766e; }
  .bar button { font: 600 14px system-ui, sans-serif; border: 0; border-radius: 8px; padding: 9px 16px; cursor: pointer; background: #fff; color: #0f766e; }
  .bar span { color: #d9f3ef; font: 13px system-ui, sans-serif; align-self: center; }
  header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #0f766e; padding-bottom: 10px; margin-bottom: 14px; }
  .brand { display: flex; gap: 10px; align-items: center; }
  .brand svg { flex: none; }
  .brand b { font-size: 16px; color: #0f766e; display: block; }
  .brand small { color: #5d6b67; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .sub { color: #5d6b67; }
  .meta { text-align: right; color: #5d6b67; font-size: 11px; }
  .holder { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 6px 16px; background: #f4f6f5; border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; }
  .holder div span { display: block; color: #5d6b67; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
  .holder div b { font-weight: 600; }
  h2 { font-size: 13px; margin: 18px 0 6px; color: #0f766e; text-transform: uppercase; letter-spacing: .04em; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 5px 6px; border-bottom: 1px solid #e3e8e6; vertical-align: top; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #5d6b67; border-bottom: 1.5px solid #13201d; }
  td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td .d { color: #5d6b67; font-size: 10.5px; }
  tr.total td { font-weight: 700; border-top: 1.5px solid #13201d; border-bottom: 3px double #13201d; }
  tr.sub td { font-weight: 600; background: #f4f6f5; }
  tr.open td { background: #f4f6f5; font-style: italic; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin-bottom: 6px; }
  .kpis div { border: 1px solid #dde4e2; border-radius: 8px; padding: 8px 10px; }
  .kpis span { display: block; font-size: 10px; color: #5d6b67; text-transform: uppercase; letter-spacing: .04em; }
  .kpis b { font-size: 14px; font-variant-numeric: tabular-nums; }
  .note { color: #5d6b67; font-size: 10.5px; margin-top: 6px; }
  .decl { margin-top: 26px; page-break-inside: avoid; }
  .sign { display: flex; gap: 40px; margin-top: 34px; }
  .sign div { flex: 1; border-top: 1px solid #13201d; padding-top: 4px; color: #5d6b67; font-size: 10.5px; }
  footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #dde4e2; color: #5d6b67; font-size: 9.5px; }
  .empty { color: #5d6b67; font-style: italic; padding: 10px 6px; }
  @media print {
    body { background: #fff; }
    .bar { display: none; }
    .sheet { margin: 0; padding: 0; box-shadow: none; max-width: none; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  }
</style></head>
<body>
<div class="bar"><button onclick="window.print()">Print / Save as PDF</button><span>Choose "Save as PDF" as the printer to download it.</span></div>
<div class="sheet">
  <header>
    <div class="brand">${LOGO}<div><b>AmrPotli</b><small>আমার পোটলি · personal records</small></div></div>
    <div class="meta">Generated ${esc(generated)}<br>Amounts in BDT (৳)</div>
  </header>
  <h1>${esc(title)}</h1>
  <div class="sub">${subtitle}</div>
  <div class="holder" style="margin-top:12px">
    <div><span>Name</span><b>${esc(ctx.holder)}</b></div>
    ${ctx.email ? `<div><span>Email</span><b>${esc(ctx.email)}</b></div>` : ''}
    ${ctx.extra ? `<div><span>Details</span><b>${esc(ctx.extra)}</b></div>` : ''}
  </div>
  ${body}
  ${
    declaration
      ? `<div class="decl"><p>I declare that the information in this statement is true and complete to the best of my knowledge.</p>
         <div class="sign"><div>Signature</div><div>Date</div></div></div>`
      : ''
  }
  <footer>Prepared by the holder from their own records in AmrPotli (vgfintrack.github.io). It is not issued or verified by a bank,
  mobile financial service or the National Board of Revenue. Where an official document is required (for example a bank-certified
  statement for a visa), attach that as well.</footer>
</div>
</body></html>`;
}

const kpis = (items) => `<div class="kpis">${items.map(([k, v]) => `<div><span>${esc(k)}</span><b>${amt(v)}</b></div>`).join('')}</div>`;

// --------------------------------------------------------------- 1. account statement

export function statementReport(ctx, { range, accountId }) {
  const all = accountId === '__liquid';
  const accs = all ? ctx.accounts.filter((a) => a.type === 'Liquid') : ctx.accounts.filter((a) => a.id === accountId);
  const ids = new Set(accs.map((a) => a.id));
  const label = all ? `All spendable accounts (${accs.map((a) => a.name).join(', ')})` : accs[0]?.name || 'Account';
  const before = worthAsOf(ctx, C.addDays(range.start, -1)).balances;
  const opening = accs.reduce((s, a) => s + before[a.id].book, 0);
  let bal = opening, credits = 0, debits = 0;
  const rows = ctx.txns
    .filter((t) => t.date >= range.start && t.date <= range.end)
    .sort(sortAsc)
    .map((t) => {
      const e = effectOn(t, ids);
      if (Math.abs(e) < 0.005) return '';
      bal += e;
      if (e > 0) credits += e;
      else debits -= e;
      const { title, sub } = ctx.describe(t);
      return `<tr><td>${day(t.date)}</td><td>${esc(title)}<div class="d">${esc(sub)}</div></td>
        <td class="n">${e < 0 ? amt(-e) : ''}</td><td class="n">${e > 0 ? amt(e) : ''}</td><td class="n">${amt(bal)}</td></tr>`;
    })
    .join('');
  const body = `
    ${kpis([['Opening balance', opening], ['Money in', credits], ['Money out', debits], ['Closing balance', bal]])}
    <h2>Transactions</h2>
    <table><thead><tr><th style="width:80px">Date</th><th>Description</th><th class="n">Money out</th><th class="n">Money in</th><th class="n">Balance</th></tr></thead>
    <tbody>
      <tr class="open"><td>${day(range.start)}</td><td>Opening balance</td><td></td><td></td><td class="n">${amt(opening)}</td></tr>
      ${rows || '<tr><td colspan="5" class="empty">No transactions in this period.</td></tr>'}
      <tr class="total"><td></td><td>Totals and closing balance</td><td class="n">${amt(debits)}</td><td class="n">${amt(credits)}</td><td class="n">${amt(bal)}</td></tr>
    </tbody></table>
    <p class="note">Service charges and loan interest are included in "Money out". Moves between the accounts covered by this statement are left out.</p>`;
  return page(
    { ...ctx, extra: label },
    { title: REPORTS.statement.title, subtitle: `${esc(label)} · ${day(range.start)} to ${day(range.end)}`, body, declaration: ctx.declaration },
  );
}

// Same data as CSV, for spreadsheets.
export function statementCsv(ctx, { range, accountId }) {
  const all = accountId === '__liquid';
  const accs = all ? ctx.accounts.filter((a) => a.type === 'Liquid') : ctx.accounts.filter((a) => a.id === accountId);
  const ids = new Set(accs.map((a) => a.id));
  const before = worthAsOf(ctx, C.addDays(range.start, -1)).balances;
  let bal = accs.reduce((s, a) => s + before[a.id].book, 0);
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Date', 'Description', 'Details', 'Money out', 'Money in', 'Balance'], [range.start, 'Opening balance', '', '', '', bal.toFixed(2)]];
  for (const t of ctx.txns.filter((t) => t.date >= range.start && t.date <= range.end).sort(sortAsc)) {
    const e = effectOn(t, ids);
    if (Math.abs(e) < 0.005) continue;
    bal += e;
    const { title, sub } = ctx.describe(t);
    rows.push([t.date, title, sub, e < 0 ? (-e).toFixed(2) : '', e > 0 ? e.toFixed(2) : '', bal.toFixed(2)]);
  }
  return rows.map((r) => r.map(q).join(',')).join('\n');
}

// --------------------------------------------------------------- 2. income & expense

function incomeExpense(ctx, range) {
  const st = C.periodStats(range, ctx.txns, ctx.accounts, range.end);
  const inc = C.sumBy(range, ctx.txns, 'Income');
  const exp = C.sumBy(range, ctx.txns, 'Expense');
  return { st, inc, exp };
}

const listRows = (obj, total, totalLabel) =>
  Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${amt(v)}</td><td class="n">${total ? Math.round((v / total) * 100) : 0}%</td></tr>`)
    .join('') + `<tr class="total"><td>${totalLabel}</td><td class="n">${amt(total)}</td><td class="n">100%</td></tr>`;

export function incomeReport(ctx, { range }) {
  const { st, inc, exp } = incomeExpense(ctx, range);
  // Month by month.
  const months = [];
  for (let m = C.monthRange(range.start).start; m <= range.end; m = C.addMonths(m, 1)) {
    const r = C.monthRange(m);
    const rr = { start: r.start < range.start ? range.start : r.start, end: r.end > range.end ? range.end : r.end };
    const s = C.periodStats(rr, ctx.txns, ctx.accounts, rr.end);
    months.push([C.parseDate(m).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }), s]);
  }
  const body = `
    ${kpis([['Total income', st.income], ['Total expenses', st.expenses], ['Net saved', st.net]])}
    <p class="note" style="margin-top:0">Savings rate: ${st.income > 0 ? Math.round((st.net / st.income) * 100) : 0}% · Moved into investments: ${amt(st.toInvestments)}</p>
    <h2>Income by source</h2>
    <table><thead><tr><th>Source</th><th class="n">Amount</th><th class="n">Share</th></tr></thead>
    <tbody>${Object.keys(inc).length ? listRows(inc, st.income, 'Total income') : '<tr><td colspan="3" class="empty">No income recorded.</td></tr>'}</tbody></table>
    <h2>Expenses by category</h2>
    <table><thead><tr><th>Category</th><th class="n">Amount</th><th class="n">Share</th></tr></thead>
    <tbody>${Object.keys(exp).length ? listRows(exp, st.expenses, 'Total expenses') : '<tr><td colspan="3" class="empty">No expenses recorded.</td></tr>'}</tbody></table>
    ${
      months.length > 1
        ? `<h2>Month by month</h2>
      <table><thead><tr><th>Month</th><th class="n">Income</th><th class="n">Expenses</th><th class="n">Net saved</th></tr></thead><tbody>
      ${months.map(([l, s]) => `<tr><td>${l}</td><td class="n">${amt(s.income)}</td><td class="n">${amt(s.expenses)}</td><td class="n">${amt(s.net)}</td></tr>`).join('')}
      <tr class="total"><td>Total</td><td class="n">${amt(st.income)}</td><td class="n">${amt(st.expenses)}</td><td class="n">${amt(st.net)}</td></tr>
      </tbody></table>`
        : ''
    }
    <p class="note">Borrowed money, loan repayments, lending and moves between your own accounts are not income or expenses and are not counted here. Service charges and loan interest are counted as expenses.</p>`;
  return page(ctx, { title: REPORTS.income.title, subtitle: `${day(range.start)} to ${day(range.end)}`, body, declaration: ctx.declaration });
}

// --------------------------------------------------------------- 3. assets & liabilities

function assetsTable(ctx, w, cols) {
  // cols: [{ label, w }] — one or two dates side by side.
  const group = (type, title) => {
    const accs = ctx.accounts.filter((a) => a.type === type);
    if (!accs.length) return '';
    const rows = accs
      .map((a) => `<tr><td>${esc(a.name)}</td>${cols.map((c) => `<td class="n">${amt(c.w.balances[a.id].value)}</td>`).join('')}</tr>`)
      .join('');
    const key = { Liquid: 'liquid', Investment: 'investments', Lend: 'lent', Debt: 'debt' }[type];
    return `<tr class="sub"><td>${title}</td>${cols.map((c) => `<td class="n">${amt(c.w[key])}</td>`).join('')}</tr>${rows}`;
  };
  const head = `<thead><tr><th>Item</th>${cols.map((c) => `<th class="n">${esc(c.label)}</th>`).join('')}</tr></thead>`;
  return `
    <h2>Assets</h2>
    <table>${head}<tbody>
      ${group('Liquid', 'Cash, bank and mobile wallets')}
      ${group('Investment', 'Investments')}
      ${group('Lend', 'Money others owe me')}
      <tr class="total"><td>Total assets</td>${cols.map((c) => `<td class="n">${amt(c.w.liquid + c.w.investments + c.w.lent)}</td>`).join('')}</tr>
    </tbody></table>
    <h2>Liabilities</h2>
    <table>${head}<tbody>
      ${group('Debt', 'Loans and money I owe') || '<tr><td class="empty" colspan="3">No liabilities.</td></tr>'}
      <tr class="total"><td>Total liabilities</td>${cols.map((c) => `<td class="n">${amt(c.w.debt)}</td>`).join('')}</tr>
    </tbody></table>
    <h2>Net wealth</h2>
    <table>${head}<tbody>
      <tr class="total"><td>Net wealth (assets − liabilities)</td>${cols.map((c) => `<td class="n">${amt(c.w.netWorth)}</td>`).join('')}</tr>
    </tbody></table>`;
}

export function networthReport(ctx, { date }) {
  const w = worthAsOf(ctx, date);
  const body = `
    ${kpis([['Total assets', w.liquid + w.investments + w.lent], ['Total liabilities', w.debt], ['Net wealth', w.netWorth]])}
    ${assetsTable(ctx, w, [{ label: `As of ${day(date)}`, w }])}
    <p class="note">${date >= C.today() ? 'Investments are shown at their current value where you have entered one, otherwise at the amount put in.' : 'Investments are shown at the amount put in (book value) for past dates.'}</p>`;
  return page(ctx, { title: REPORTS.networth.title, subtitle: `As of ${day(date)}`, body, declaration: ctx.declaration });
}

// --------------------------------------------------------------- 4. annual tax summary

export function taxReport(ctx, { range }) {
  const end = range.end > C.today() ? C.today() : range.end;
  const startW = worthAsOf(ctx, C.addDays(range.start, -1));
  const endW = worthAsOf(ctx, end);
  const r = { start: range.start, end };
  const { st, inc, exp } = incomeExpense(ctx, r);
  const expected = startW.netWorth + st.income - st.expenses;
  const diff = endW.netWorth - expected;
  const iy = `${range.start.slice(0, 4)}–${range.end.slice(2, 4)}`;
  const body = `
    ${kpis([['Total income', st.income], ['Living expenses', st.expenses], ['Net wealth at start', startW.netWorth], ['Net wealth at end', endW.netWorth]])}
    <h2>1. Income in the income year</h2>
    <table><thead><tr><th>Source</th><th class="n">Amount</th><th class="n">Share</th></tr></thead>
    <tbody>${Object.keys(inc).length ? listRows(inc, st.income, 'Total income') : '<tr><td colspan="3" class="empty">No income recorded.</td></tr>'}</tbody></table>
    <h2>2. Living and other expenses (for the lifestyle statement)</h2>
    <table><thead><tr><th>Category</th><th class="n">Amount</th><th class="n">Share</th></tr></thead>
    <tbody>${Object.keys(exp).length ? listRows(exp, st.expenses, 'Total expenses') : '<tr><td colspan="3" class="empty">No expenses recorded.</td></tr>'}</tbody></table>
    <h2>3. Assets and liabilities: start and end of the year</h2>
    ${assetsTable(ctx, endW, [
      { label: `On ${day(C.addDays(range.start, -1))}`, w: startW },
      { label: `On ${day(end)}`, w: endW },
    ])}
    <h2>4. Change in net wealth</h2>
    <table><tbody>
      <tr><td>Net wealth at the start of the year</td><td class="n">${amt(startW.netWorth)}</td></tr>
      <tr><td>+ Income during the year</td><td class="n">${amt(st.income)}</td></tr>
      <tr><td>− Expenses during the year</td><td class="n">${amt(st.expenses)}</td></tr>
      <tr class="sub"><td>Expected net wealth at the end</td><td class="n">${amt(expected)}</td></tr>
      <tr><td>Recorded net wealth at the end</td><td class="n">${amt(endW.netWorth)}</td></tr>
      <tr class="total"><td>Difference to explain</td><td class="n">${amt(diff)}</td></tr>
    </tbody></table>
    <p class="note">${
      Math.abs(diff) < 0.5
        ? 'The records reconcile: the change in wealth is fully explained by income and expenses.'
        : 'A difference usually means an opening balance, gift, revaluation or transaction that was not recorded. Review it before using these figures.'
    }</p>
    <p class="note">The Bangladesh income year runs from 1 July to 30 June. This summary follows the structure of the return's statement of assets and liabilities
    and statement of expenses relating to lifestyle, but it is not the official form. Check the current NBR forms, tax-free threshold and rules,
    and include any income or assets not recorded in AmrPotli.${range.end > C.today() ? ` The income year is not over yet, so figures run to ${day(end)}.` : ''}</p>`;
  return page(ctx, {
    title: `Annual tax summary · income year ${iy}`,
    subtitle: `${day(range.start)} to ${day(range.end)}`,
    body,
    declaration: ctx.declaration,
  });
}

// --------------------------------------------------------------- 5. loan statement

export function loanReport(ctx, { range, personId }) {
  const acc = ctx.accounts.find((a) => a.id === personId);
  if (!acc) return page(ctx, { title: REPORTS.loan.title, subtitle: '', body: '<p class="empty">Choose a person or lender.</p>' });
  const owe = acc.type === 'Debt'; // I owe them; otherwise they owe me
  const before = worthAsOf(ctx, C.addDays(range.start, -1)).balances[acc.id].book;
  let bal = before, plus = 0, minus = 0, interest = 0;
  const rows = ctx.txns
    .filter((t) => (t.account === acc.id || t.toAccount === acc.id) && t.date >= range.start && t.date <= range.end)
    .sort(sortAsc)
    .map((t) => {
      // For a Debt account, money taken from it = more owed; for Lend, money put in = more owed to me.
      const raw = t.toAccount === acc.id ? Number(t.amount) : -Number(t.amount);
      const change = owe ? -raw : raw;
      bal += change;
      if (change > 0) plus += change;
      else minus -= change;
      const i = t.feeCategory === C.INTEREST_CATEGORY ? Number(t.fee) || 0 : 0;
      interest += i;
      const { title, sub } = ctx.describe(t);
      return `<tr><td>${day(t.date)}</td><td>${esc(title)}<div class="d">${esc(sub)}</div></td>
        <td class="n">${change > 0 ? amt(change) : ''}</td><td class="n">${change < 0 ? amt(-change) : ''}</td><td class="n">${blank(i)}</td><td class="n">${amt(bal)}</td></tr>`;
    })
    .join('');
  const who = ctx.personName(acc.id);
  const plan = acc.plan?.count ? `${acc.plan.count} monthly installments, total interest ${amt(acc.plan.interest || 0)}` : '';
  const body = `
    ${kpis(
      owe
        ? [['Owed at start', before], ['Borrowed', plus], ['Repaid', minus], ['Interest paid', interest], ['Still owed', bal]]
        : [['Owed to me at start', before], ['Lent', plus], ['Paid back', minus], ['Still owed to me', bal]],
    )}
    ${acc.dueDate && bal > 0.004 ? `<p class="note" style="margin-top:0">Next due date: ${day(acc.dueDate)}${plan ? ` · ${plan}` : ''}</p>` : plan ? `<p class="note">${plan}</p>` : ''}
    <h2>Entries</h2>
    <table><thead><tr><th style="width:80px">Date</th><th>Description</th><th class="n">${owe ? 'Borrowed' : 'Lent'}</th><th class="n">${owe ? 'Repaid' : 'Paid back'}</th><th class="n">Interest</th><th class="n">Outstanding</th></tr></thead>
    <tbody>
      <tr class="open"><td>${day(range.start)}</td><td>Outstanding at start</td><td></td><td></td><td></td><td class="n">${amt(before)}</td></tr>
      ${rows || '<tr><td colspan="6" class="empty">No entries in this period.</td></tr>'}
      <tr class="total"><td></td><td>Totals and outstanding</td><td class="n">${amt(plus)}</td><td class="n">${amt(minus)}</td><td class="n">${amt(interest)}</td><td class="n">${amt(bal)}</td></tr>
    </tbody></table>
    ${
      ctx.declaration
        ? ''
        : `<div class="decl"><p>${owe ? `Amount still owed by ${esc(ctx.holder)} to ${esc(who)}` : `Amount still owed by ${esc(who)} to ${esc(ctx.holder)}`}: <b>BDT ${amt(bal)}</b> as of ${day(range.end > C.today() ? C.today() : range.end)}.</p>
         <div class="sign"><div>${esc(ctx.holder)}</div><div>${esc(who)}</div></div></div>`
    }`;
  return page(
    { ...ctx, extra: `${owe ? 'Lender' : 'Borrower'}: ${who}` },
    { title: REPORTS.loan.title, subtitle: `${owe ? 'Money I borrowed from' : 'Money I lent to'} ${esc(who)} · ${day(range.start)} to ${day(range.end)}`, body, declaration: ctx.declaration },
  );
}
