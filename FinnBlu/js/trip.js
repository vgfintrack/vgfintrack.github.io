// Group trips: who put what in, who owes whom. Pure functions over a trip
// book's members and entries (see store.js, startTrip).
//
// Entries:
//   money into the fund: { type: 'Income', amount, paidBy: memberId }
//   an expense:          { type: 'Expense', amount, category, paidBy: memberId | 'fund',
//                          split: [memberId, …] (empty: everyone) }

export const FUND = 'fund';

export const TRIP_CATEGORIES = [
  ['Bus & train', '🚌'],
  ['Local transport', '🚙'],
  ['Hotel', '🏨'],
  ['Boat', '🚤'],
  ['Food', '🍛'],
  ['Guide fee', '🧭'],
  ["Guide's expenses", '🎒'],
  ['Tickets & entry', '🎟️'],
  ['Snacks & water', '🥤'],
  ['Shopping', '🛍️'],
  ['Other', '📦'],
];
export const tripIcon = (c) => TRIP_CATEGORIES.find(([n]) => n === c)?.[1] || '📦';

const r2 = (n) => Math.round(n * 100) / 100;

// Totals and each member's balance. A member's balance is what they put in
// (fund money and expenses they paid themselves) minus their share. The
// balances add up to the money left in the fund.
export function tripTotals(members, entries) {
  const ids = members.map((m) => m.id);
  const per = Object.fromEntries(ids.map((id) => [id, { in: 0, paid: 0, share: 0 }]));
  let fundIn = 0;
  let fundOut = 0;
  let spent = 0;
  const byCategory = {};
  for (const x of entries) {
    const amount = Number(x.amount) || 0;
    if (!(amount > 0)) continue;
    if (x.type === 'Income') {
      fundIn += amount;
      if (per[x.paidBy]) per[x.paidBy].in += amount;
      continue;
    }
    if (x.type !== 'Expense') continue;
    spent += amount;
    byCategory[x.category || 'Other'] = (byCategory[x.category || 'Other'] || 0) + amount;
    if (x.paidBy === FUND) fundOut += amount;
    else if (per[x.paidBy]) per[x.paidBy].paid += amount;
    const named = (x.split?.length ? x.split : ids).filter((id) => per[id]);
    const who = named.length ? named : ids;
    for (const id of who) per[id].share += amount / who.length;
  }
  const people = members.map((m) => {
    const p = per[m.id];
    return { ...m, in: r2(p.in), paid: r2(p.paid), share: r2(p.share), balance: r2(p.in + p.paid - p.share) };
  });
  return {
    spent: r2(spent),
    fundIn: r2(fundIn),
    fundOut: r2(fundOut),
    fundLeft: r2(fundIn - fundOut),
    perPerson: r2(spent / (members.length || 1)),
    byCategory,
    people,
  };
}

// The fewest payments that settle everyone. The person keeping the fund's
// cash (keeper) holds what is left in it, so they pay that out.
export function settleUp(people, fundLeft, keeperId) {
  const owed = people.map((p) => ({ id: p.id, name: p.name, amount: p.balance - (p.id === keeperId ? fundLeft : 0) }));
  const give = owed.filter((p) => p.amount < -0.5).map((p) => ({ ...p, amount: -p.amount })).sort((a, b) => b.amount - a.amount);
  const get = owed.filter((p) => p.amount > 0.5).sort((a, b) => b.amount - a.amount);
  const pays = [];
  let i = 0;
  let j = 0;
  while (i < give.length && j < get.length) {
    const n = Math.min(give[i].amount, get[j].amount);
    if (n >= 1) pays.push({ from: give[i].id, fromName: give[i].name, to: get[j].id, toName: get[j].name, amount: Math.round(n) });
    give[i].amount -= n;
    get[j].amount -= n;
    if (give[i].amount < 0.5) i++;
    if (get[j].amount < 0.5) j++;
  }
  return pays;
}

// Guide paid by the day: the fee for the trip, what is paid, what is left,
// and the guide's own costs (their food, room and transport).
export function guideCost(trip, byCategory) {
  const fee = (Number(trip?.guidePerDay) || 0) * (Number(trip?.days) || 0);
  const paid = byCategory['Guide fee'] || 0;
  const own = byCategory["Guide's expenses"] || 0;
  return { fee, paid, left: Math.max(0, fee - paid), own, total: Math.max(fee, paid) + own };
}
