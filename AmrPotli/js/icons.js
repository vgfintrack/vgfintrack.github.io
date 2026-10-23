// One picture per category, account and action, so screens can show an icon
// with a word or two instead of sentences. Categories are the user's own
// names, so they are matched by keywords; anything unknown gets a parcel.

const CATEGORY = [
  [/service charge/i, '🧾'],
  [/govt fee/i, '🏛️'],
  [/commission/i, '🪙'],
  [/paper|toner|\bink\b/i, '📄'],
  [/internet bill|wifi|broadband/i, '📶'],
  [/photocopy|printing|print|lamination|binding|scan|compose|typing|application charge/i, '🖨️'],
  [/stock|purchase|\bmal\b|goods|wholesale/i, '📦'],
  [/repair/i, '🔧'],
  [/licen|trade fee|tax/i, '📜'],
  [/packag/i, '🛍️'],
  [/staff|employee|worker/i, '👷'],
  [/^sales?$|cash sale|\bsales\b/i, '💵'],
  [/interest/i, '📈'],
  [/dining|food|meal|lunch|breakfast|dinner|snack|tea|restaurant|khabar/i, '🍛'],
  [/bazar|grocer|market/i, '🛒'],
  [/transport|rickshaw|bus|cng|uber|pathao|fuel|travel|train/i, '🚌'],
  [/hostel|mess|rent received/i, '🏘️'],
  [/rent|house|home/i, '🏠'],
  [/utilit|bill|electric|gas|water/i, '💡'],
  [/mobile|internet|data|recharge|phone/i, '📱'],
  [/salary|bonus|job/i, '💼'],
  [/scholar|stipend/i, '🎓'],
  [/tuition|study|book|education|school|college|course|exam/i, '📚'],
  [/allowance|pocket|household money/i, '🤲'],
  [/family|parent|mother|father|ammu|abbu/i, '👪'],
  [/medic|health|doctor|medicine|pharma|hospital/i, '💊'],
  [/entertain|movie|game|fun|netflix|outing/i, '🎬'],
  [/cloth|shopping|dress/i, '🛍️'],
  [/gift|dawat|eid|wedding/i, '🎁'],
  [/personal care|salon|haircut|cosmetic/i, '💈'],
  [/software|tools|laptop|computer/i, '💻'],
  [/client|upwork|fiverr|freelanc|payment/i, '🧑‍💻'],
  [/business|profit|sales|shop/i, '🏪'],
  [/saving|dps|deposit|fdr|invest/i, '🐷'],
  [/donat|zakat|sadaqah|charity/i, '🤲'],
  [/gym|sport|fitness/i, '🏋️'],
  [/other/i, '📦'],
];

export function catIcon(name = '') {
  for (const [re, icon] of CATEGORY) if (re.test(name)) return icon;
  return '📦';
}

export function accIcon(a) {
  if (!a) return '💰';
  if (a.supplier) return { company: '🏭', distributor: '🚚', sr: '🧑‍💼', wholesale: '🏬' }[a.supplier.kind] || '🏭';
  if (a.type === 'Debt') return '🤝';
  if (a.type === 'Lend') return '🫴';
  if (a.type === 'Investment') return '📈';
  if (/cash|hand|নগদ|ক্যাশ/i.test(a.name)) return '💵';
  if (/bkash|nagad|rocket|upay|wallet/i.test(a.name)) return '📱';
  return '🏦';
}

// Product groups a shop buys; anything else falls back to the category icons.
const PRODUCT = [
  [/ice ?cream/i, '🍦'],
  [/toilet|shampoo|paste|cosmetic|cream/i, '🧴'],
  [/rice|grain|dal|lentil|flour|atta|chal/i, '🍚'],
  [/\boil\b|ghee/i, '🛢️'],
  [/spice|masala|salt/i, '🌶️'],
  [/tea|sugar|coffee/i, '☕'],
  [/biscuit|snack|chips|chanachur|cake/i, '🍪'],
  [/drink|juice|water|soft|cola/i, '🥤'],
  [/soap|detergent|wash|clean/i, '🧼'],
  [/egg|dairy|milk|butter/i, '🥚'],
  [/cigarette|bidi|tobacco/i, '🚬'],
  [/toner|ink|a4|photo paper|paper/i, '📄'],
  [/station|pen|khata/i, '🖊️'],
  [/vegetable|potato|onion|sobji/i, '🥔'],
  [/fruit/i, '🍌'],
  [/bread|bakery|bun/i, '🍞'],
  [/baby|diaper/i, '🍼'],
  [/medicine|saline/i, '💊'],
];

export function productIcon(name = '') {
  for (const [re, icon] of PRODUCT) if (re.test(name)) return icon;
  return /other/i.test(name) ? '📦' : catIcon(name);
}
