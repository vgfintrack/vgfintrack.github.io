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
// The FinnBlu logo, inline so it always appears (also when printing offline).
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 925 240" width="139" height="36" role="img" aria-label="FinnBlu"><rect x="0" y="162" width="45.5" height="78" rx="6" fill="#0E2B49"/><rect x="67" y="115" width="45.5" height="125" rx="6" fill="#1D558E"/><path d="M134.5 240V106C134.5 32 210 8 234.6 0C227.3 6.9 181 48.9 181 120.2V240Z" fill="#2476CF"/><path d="M447.0 205.0C446.6 204.5 446.6 113.7 447.0 113.3C447.5 112.9 471.5 112.9 472.0 113.3C472.2 113.5 472.2 124.1 472.2 159.2C472.2 204.0 472.2 204.7 471.8 205.0C471.0 205.4 447.4 205.3 447.0 205.0ZM489.9 205.0C489.5 204.7 489.5 202.3 489.5 159.0C489.5 117.6 489.5 113.3 489.9 113.2C490.1 113.1 495.7 113.0 502.4 113.0C513.3 113.0 514.5 113.0 514.8 113.4C515.0 113.7 515.1 114.7 515.2 116.7C515.2 118.3 515.3 119.7 515.3 119.9C515.6 120.5 516.1 120.3 517.5 119.2C521.3 116.1 525.6 113.7 529.6 112.5C534.5 111.1 536.1 110.9 541.6 110.9C546.2 110.9 547.2 110.9 549.4 111.5C550.8 111.8 552.3 112.3 552.9 112.5C553.5 112.8 554.1 113.0 554.2 113.0C554.4 113.0 554.9 113.2 555.5 113.5C556.0 113.7 557.0 114.2 557.8 114.6C559.1 115.2 562.9 117.7 564.3 118.9C565.7 120.1 569.2 124.0 570.1 125.4C570.6 126.2 571.3 127.2 571.5 127.5C572.3 128.4 574.7 133.5 575.0 134.8C575.2 135.4 575.4 136.0 575.5 136.1C575.6 136.3 575.9 137.3 576.1 138.4C576.3 139.5 576.6 140.9 576.7 141.6C576.9 142.5 577.0 153.6 576.9 174.0L576.9 205.1L564.7 205.2C556.8 205.2 552.3 205.2 552.0 205.0C551.5 204.8 551.5 203.9 551.4 177.2C551.4 160.1 551.2 149.0 551.1 148.0C550.8 146.5 550.3 145.1 549.6 143.8C549.4 143.4 549.0 142.6 548.8 142.1C547.9 140.3 546.1 138.6 543.5 136.9C542.2 136.0 540.3 135.1 539.4 134.7C537.8 134.2 537.2 134.1 533.5 134.1C529.8 134.1 529.2 134.2 527.8 134.7C526.9 135.1 526.0 135.4 525.9 135.5C525.7 135.6 525.4 135.8 525.0 135.9C524.1 136.2 521.2 138.2 520.2 139.4C519.0 140.6 517.0 143.5 517.0 144.0C517.0 144.1 516.8 144.7 516.5 145.2C515.3 147.6 515.2 148.7 515.2 177.4C515.2 203.9 515.2 204.3 514.8 204.8C514.3 205.2 513.9 205.2 502.3 205.2C494.7 205.2 490.2 205.1 489.9 205.0ZM593.0 204.9C592.8 204.7 592.8 192.4 592.8 158.8L592.9 113.1L605.2 113.1C616.1 113.0 617.5 113.0 617.9 113.4C618.2 113.7 618.2 114.4 618.2 116.7C618.2 120.6 618.6 121.0 620.5 119.3C621.5 118.4 626.4 115.0 626.7 115.0C626.8 115.0 627.8 114.5 628.9 114.0C630.0 113.5 631.1 113.0 631.4 113.0C631.7 113.0 632.3 112.8 632.9 112.5C633.4 112.3 634.5 112.0 635.1 111.9C635.8 111.8 637.0 111.5 637.8 111.3C638.8 111.0 640.2 110.9 644.5 110.9C649.3 110.9 650.2 110.9 652.4 111.5C653.8 111.8 655.4 112.3 655.9 112.5C656.5 112.8 657.1 113.0 657.3 113.0C657.9 113.0 662.5 115.4 664.5 116.8C668.4 119.5 671.2 122.3 674.2 126.8C675.7 129.0 678.0 133.7 678.0 134.4C678.0 134.7 678.2 135.2 678.4 135.6C678.6 136.0 679.0 137.4 679.3 138.7C679.9 141.1 679.9 141.2 680.0 172.6C680.1 190.0 680.0 204.4 679.9 204.7L679.8 205.2L667.7 205.2C657.2 205.2 655.5 205.2 655.1 204.9L654.5 204.5L654.5 178.1C654.5 160.7 654.4 150.9 654.2 149.2C654.0 146.9 653.4 144.9 652.7 143.8C652.6 143.5 652.3 143.0 652.1 142.5C650.8 139.7 646.4 136.1 642.5 134.8C640.5 134.1 636.1 133.8 633.3 134.2C630.1 134.7 625.6 136.9 623.3 139.2C622.4 140.2 620.0 143.8 620.0 144.2C620.0 144.5 619.8 145.1 619.5 145.6C618.4 147.7 618.3 150.2 618.3 178.3L618.2 204.5L617.7 204.9C617.2 205.2 615.6 205.2 605.2 205.2C595.5 205.2 593.3 205.2 593.0 204.9ZM345.4 204.8C345.0 204.8 344.5 204.5 344.3 204.3C344.1 204.0 344.0 190.2 344.0 137.5C344.0 100.9 344.1 70.9 344.2 70.6C344.3 70.3 348.5 70.2 389.1 70.2L434.0 70.2L434.4 71.0C434.7 71.6 434.8 73.2 434.8 81.7C434.8 91.4 434.6 93.1 433.9 93.5C433.8 93.7 419.4 93.7 402.0 93.7C377.7 93.7 370.3 93.8 370.0 94.1C369.6 94.5 369.6 125.5 370.1 126.0C370.3 126.2 377.3 126.2 400.3 126.2L430.2 126.2L430.7 126.9C431.1 127.5 431.1 128.5 431.1 138.1C431.1 148.2 431.1 148.7 430.6 149.2L430.2 149.8L400.3 149.8C377.3 149.8 370.3 149.8 370.1 150.0C369.8 150.3 369.8 156.6 369.8 177.2L369.8 204.0L369.1 204.4C368.5 204.8 367.5 204.9 357.3 204.9C351.1 204.9 345.8 204.9 345.4 204.8ZM457.8 97.3C456.1 97.0 453.3 96.0 452.5 95.4C452.2 95.2 451.8 95.0 451.6 95.0C451.2 95.0 448.7 92.5 447.8 91.2C446.4 89.1 445.3 84.4 445.6 81.8C446.1 78.5 447.5 75.6 449.6 73.4C452.2 70.8 455.9 69.3 459.5 69.2C462.8 69.2 466.0 70.3 468.5 72.2C470.8 74.1 472.4 76.3 473.0 78.6C473.1 79.0 473.4 80.1 473.6 80.9C474.0 82.1 474.0 82.7 473.8 84.4C473.2 88.6 472.1 91.1 469.7 93.4C466.8 96.3 461.8 97.9 457.8 97.3Z" fill="#0E2B49"/><path d="M882.8 207.8C877.6 207.3 871.6 205.7 868.6 203.9C867.7 203.4 866.9 203.0 866.8 203.0C866.7 203.0 866.0 202.6 865.2 202.0C864.5 201.5 863.4 200.7 862.8 200.2C857.1 196.1 852.5 189.7 850.4 183.0C850.1 182.2 849.7 181.0 849.5 180.3C849.2 179.6 849.0 178.5 849.0 178.0C849.0 177.5 848.8 176.2 848.5 175.1C848.0 173.2 848.0 172.2 848.0 144.3C848.0 123.4 848.1 115.5 848.3 115.4C848.4 115.3 851.3 115.2 854.7 115.2C860.5 115.3 860.9 115.3 861.4 115.8C861.9 116.3 861.9 116.7 862.0 145.4L862.2 174.6L862.7 176.2C863.9 179.8 864.8 181.8 866.0 183.6C866.3 184.0 866.7 184.8 867.0 185.3C868.1 187.3 873.4 192.0 874.5 192.0C874.7 192.0 875.0 192.1 875.1 192.2C875.6 192.7 878.6 193.8 879.3 193.8C879.7 193.8 881.3 194.0 882.9 194.3C888.0 195.3 891.9 194.7 897.2 192.1C900.6 190.4 903.2 187.9 906.1 183.5C907.0 182.0 908.1 179.5 908.6 177.1C909.0 175.8 909.3 174.4 909.4 174.1C909.5 173.9 909.7 160.7 909.7 145.0C909.9 117.2 909.9 116.3 910.4 115.8C910.8 115.3 911.0 115.2 917.2 115.2C923.3 115.2 923.5 115.3 923.8 115.8C924.0 116.1 924.0 124.4 923.9 144.4C923.9 168.8 923.8 172.8 923.5 174.2C923.2 175.1 923.0 176.5 922.9 177.4C922.6 179.4 920.2 186.7 919.5 187.6C919.4 187.8 919.2 188.2 919.1 188.5C919.0 188.8 918.7 189.4 918.5 189.7C918.3 190.1 917.4 191.4 916.6 192.6C914.1 196.5 908.9 201.2 905.2 202.9C904.8 203.1 903.6 203.7 902.6 204.1C896.3 207.0 889.3 208.3 882.8 207.8ZM702.1 205.1C701.6 204.8 701.6 73.3 702.1 73.0C702.2 72.8 714.6 72.8 729.6 72.8L756.9 72.9L759.8 73.5C761.3 73.8 763.2 74.3 764.0 74.5C764.7 74.8 765.5 75.0 765.8 75.0C766.1 75.0 766.8 75.2 767.4 75.5C767.9 75.8 768.5 76.0 768.7 76.0C769.1 76.0 773.0 78.0 774.8 79.1C776.5 80.2 779.2 82.6 780.8 84.3C784.3 88.2 787.4 94.5 788.0 98.8C788.1 99.6 788.4 101.1 788.6 102.0C789.1 104.2 789.1 107.0 788.6 110.1C788.4 111.5 788.2 113.2 788.1 113.9C787.9 115.1 787.0 118.2 786.4 119.7C786.2 120.1 786.0 120.6 786.0 120.7C786.0 121.2 783.1 125.8 781.5 127.6C779.8 129.6 777.2 132.1 775.0 133.5C773.2 134.8 773.3 135.2 775.9 136.6C780.1 139.0 784.0 142.0 786.1 144.5C787.5 146.2 787.6 146.4 789.2 148.9C791.6 152.5 793.5 157.3 794.0 160.5C795.1 167.8 795.1 167.8 794.5 172.4C793.8 177.9 793.0 180.9 790.8 185.1C789.7 187.3 788.6 189.1 787.3 190.6C786.3 191.9 782.4 195.8 781.9 196.1C781.6 196.2 780.7 196.9 779.9 197.5C779.1 198.1 777.6 199.1 776.8 199.6C775.9 200.1 775.0 200.6 774.8 200.7C774.5 200.9 773.7 201.2 772.9 201.5C772.0 201.8 771.0 202.3 770.5 202.5C769.9 202.8 769.2 203.0 768.8 203.0C768.4 203.0 767.7 203.2 767.1 203.4C766.6 203.6 765.2 203.9 764.1 204.1C763.0 204.3 761.1 204.6 759.9 204.9C757.9 205.2 753.8 205.3 730.0 205.3C711.9 205.4 702.3 205.3 702.1 205.1ZM814.2 205.3C813.9 205.2 813.5 205.1 813.3 204.9C812.9 204.6 812.8 69.9 813.3 69.3C813.7 68.8 825.9 68.8 826.6 69.4C827.1 69.7 827.1 70.7 827.2 136.7C827.2 173.5 827.2 203.9 827.1 204.2C827.1 204.5 826.8 204.9 826.5 205.0C826.0 205.3 815.8 205.5 814.2 205.3ZM760.8 191.6C761.6 191.3 762.8 190.9 763.4 190.8C767.0 189.9 770.0 188.2 773.6 185.0C775.0 183.7 776.8 181.3 777.7 179.6C778.2 178.8 778.6 178.0 778.7 177.9C778.9 177.7 779.2 176.9 779.4 176.0C781.2 170.3 781.3 168.5 780.2 162.1C779.4 156.8 775.8 151.3 771.0 147.8C768.5 146.0 766.6 145.0 765.8 145.0C765.6 145.0 765.1 144.8 764.7 144.6C763.7 144.1 761.4 143.6 758.4 143.1C755.1 142.6 716.4 142.5 715.9 143.0C715.6 143.3 715.5 147.0 715.5 167.5C715.5 190.3 715.5 191.7 715.9 192.0C716.2 192.2 723.2 192.2 737.8 192.2C758.8 192.1 759.1 192.1 760.8 191.6ZM741.6 129.4C754.6 129.3 757.1 129.3 758.5 128.9C763.4 127.7 767.3 125.6 769.9 122.7C771.3 121.1 774.0 116.1 774.0 115.0C774.0 114.7 774.2 114.1 774.4 113.6C774.9 112.4 775.2 106.0 774.8 104.0C773.9 99.3 773.1 97.2 770.6 94.0C768.8 91.7 766.3 89.7 763.7 88.6C763.1 88.4 762.0 87.9 761.3 87.6C760.5 87.3 759.7 87.0 759.3 87.0C759.0 87.0 758.1 86.8 757.3 86.5C755.9 85.9 755.6 85.9 736.2 85.8C721.9 85.7 716.4 85.8 716.0 86.0L715.5 86.3L715.5 107.5C715.5 127.4 715.5 128.8 715.9 129.2C716.3 129.6 716.9 129.6 721.4 129.6C724.1 129.5 733.2 129.5 741.6 129.4Z" fill="#2476CF"/></svg>`;
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
  body { margin: 0; font: 11.5px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Bengali", sans-serif; color: #0E2B49; background: #E9EEF5; }
  .sheet { background: #fff; max-width: 210mm; margin: 16px auto; padding: 14mm 12mm; box-shadow: 0 2px 12px rgb(0 0 0 / .12); }
  .bar { position: sticky; top: 0; display: flex; gap: 8px; justify-content: center; padding: 10px; background: #2476CF; }
  .bar button { font: 600 14px system-ui, sans-serif; border: 0; border-radius: 8px; padding: 9px 16px; cursor: pointer; background: #fff; color: #2476CF; }
  .bar span { color: #DCEBFA; font: 13px system-ui, sans-serif; align-self: center; }
  header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #2476CF; padding-bottom: 10px; margin-bottom: 14px; }
  .brand { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
  .brand svg { flex: none; width: 34mm; height: auto; }
  .brand small { color: #56677D; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .sub { color: #56677D; }
  .meta { text-align: right; color: #56677D; font-size: 11px; }
  .holder { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 6px 16px; background: #F4F6FA; border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; }
  .holder div span { display: block; color: #56677D; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
  .holder div b { font-weight: 600; }
  h2 { font-size: 13px; margin: 18px 0 6px; color: #0E2B49; text-transform: uppercase; letter-spacing: .04em; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 5px 6px; border-bottom: 1px solid #E3E9F1; vertical-align: top; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #56677D; border-bottom: 1.5px solid #0E2B49; }
  td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td .d { color: #56677D; font-size: 10.5px; }
  tr.total td { font-weight: 700; border-top: 1.5px solid #0E2B49; border-bottom: 3px double #0E2B49; }
  tr.sub td { font-weight: 600; background: #F4F6FA; }
  tr.open td { background: #F4F6FA; font-style: italic; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin-bottom: 6px; }
  .kpis div { border: 1px solid #DCE4EE; border-radius: 8px; padding: 8px 10px; }
  .kpis span { display: block; font-size: 10px; color: #56677D; text-transform: uppercase; letter-spacing: .04em; }
  .kpis b { font-size: 14px; font-variant-numeric: tabular-nums; }
  .note { color: #56677D; font-size: 10.5px; margin-top: 6px; }
  .decl { margin-top: 26px; page-break-inside: avoid; }
  .sign { display: flex; gap: 40px; margin-top: 34px; }
  .sign div { flex: 1; border-top: 1px solid #0E2B49; padding-top: 4px; color: #56677D; font-size: 10.5px; }
  footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #DCE4EE; color: #56677D; font-size: 9.5px; }
  .empty { color: #56677D; font-style: italic; padding: 10px 6px; }
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
    <div class="brand">${LOGO}<small>Personal records</small></div>
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
  <footer>Prepared by the holder from their own records in FinnBlu (vgfintrack.github.io/FinnBlu). It is not issued or verified by a bank,
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
    and include any income or assets not recorded in FinnBlu.${range.end > C.today() ? ` The income year is not over yet, so figures run to ${day(end)}.` : ''}</p>`;
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
