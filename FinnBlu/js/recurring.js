// Regular payments and income: rent, tuition, DPS, a mobile pack. A rule
// remembers the last date it was handled (added or skipped); every date after
// that, up to today, is due. Nothing is ever added without the user's tap.
//
// Rule: { id, type, amount, category, account, toAccount?, fee?, note,
//         every: 'month' | 'week', start: 'YYYY-MM-DD', lastDone: 'YYYY-MM-DD', paused? }

import { parseDate, fmtDate } from './calc.js';

const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();

// The first date after `after` this rule falls on. Monthly rules keep the
// start's day, moved to the month's last day when the month is shorter.
export function nextAfter(rule, after) {
  const s = parseDate(rule.start);
  if (rule.every === 'week') {
    const gap = Math.floor((parseDate(after) - s) / 864e5);
    const k = gap < 0 ? 0 : Math.floor(gap / 7) + 1;
    return fmtDate(new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7 * k, 12));
  }
  const day = s.getDate();
  const a = parseDate(after);
  for (let i = 0; i < 2; i++) {
    const y = a.getFullYear(), m = a.getMonth() + i;
    const d = fmtDate(new Date(y, m, Math.min(day, daysIn(y, m)), 12));
    if (d > after && d >= rule.start) return d;
  }
  return null; // not reached
}

// Every date that is due (after lastDone, up to today), oldest first.
export function dueDates(rule, today, limit = 24) {
  if (rule.paused) return [];
  const out = [];
  let d = rule.lastDone || rule.start;
  // A rule that has never been handled is due on its start date too.
  if (!rule.lastDone && rule.start <= today) out.push(rule.start);
  while (out.length < limit) {
    d = nextAfter(rule, d);
    if (!d || d > today) break;
    out.push(d);
  }
  return out;
}

// What is still to come after today, up to and including `end`.
export function upcoming(rules, today, end) {
  const out = [];
  for (const r of rules) {
    if (r.paused) continue;
    let d = today;
    for (let i = 0; i < 6; i++) {
      d = nextAfter(r, d);
      if (!d || d > end) break;
      if (d > (r.lastDone || '')) out.push({ rule: r, date: d });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function due(rules, today) {
  return rules
    .map((r) => ({ rule: r, dates: dueDates(r, today) }))
    .filter((x) => x.dates.length)
    .sort((a, b) => a.dates[0].localeCompare(b.dates[0]));
}

// A transaction for one date of a rule; `recurring` links it back.
export function txnFor(rule, date) {
  return {
    type: rule.type,
    amount: rule.amount,
    date,
    category: rule.category,
    account: rule.account,
    toAccount: rule.type === 'Transfer' ? rule.toAccount : null,
    fee: rule.fee || undefined,
    note: rule.note || '',
    recurring: rule.id,
  };
}
