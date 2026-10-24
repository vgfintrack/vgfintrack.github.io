// Reads a pasted bKash / Nagad / bank SMS and suggests a transaction.
// Pure function, no DOM: the form shows the result for the user to check
// before saving. Unknown messages return null rather than a wrong guess.

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, '0');
const num = (s) => Number(String(s).replace(/,/g, ''));

// Dates seen in Bangladeshi SMS: 18/10/2026 18:41, 18-10-2026, 20-OCT-2026, 2026-10-20.
export function smsDate(text) {
  let m = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m = text.match(/\b(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s,-]+(\d{4})\b/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(m[1])}`;
  m = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})\b/);
  if (m) return `20${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return null;
}

// Every "Tk 500.00" / "BDT 2,400.00" / "৳500" with what it is: fee, balance or amount.
function amounts(text) {
  const out = { amount: null, fee: null, balance: null };
  const re = /(?:Tk\.?|BDT|৳)\s*:?\s*([\d,]+(?:\.\d{1,2})?)/gi;
  let m;
  while ((m = re.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 22), m.index).toLowerCase();
    const value = num(m[1]);
    // The label closest to the number wins ("Fee Tk 0.00. Balance Tk 772.82").
    const at = (re) => {
      let pos = -1;
      for (const x of before.matchAll(re)) pos = x.index;
      return pos;
    };
    const feeAt = at(/\b(fee|charge|vat)\b/g);
    const balAt = at(/\b(bal|balance|avl|available)\b/g);
    if (feeAt > balAt) out.fee ??= value;
    else if (balAt > feeAt) out.balance ??= value;
    else out.amount ??= value;
  }
  return out;
}

const has = (text, re) => re.test(text);

// Finds the user's account that best matches a hint like "bkash" or "sonali".
function findAccount(accounts, hints, fallbackFilter) {
  const liquid = accounts.filter((a) => a.type === 'Liquid');
  for (const h of hints.filter(Boolean)) {
    const hit = liquid.find((a) => a.name.toLowerCase().includes(h.toLowerCase()));
    if (hit) return hit.id;
  }
  const fb = fallbackFilter ? liquid.find(fallbackFilter) : null;
  return fb?.id ?? null;
}
const isCash = (a) => /cash|hand|নগদ|ক্যাশ/i.test(a.name);
const isWallet = (a) => /bkash|nagad|rocket|upay|wallet/i.test(a.name);
const isBank = (a) => /bank|ব্যাংক/i.test(a.name) || (!isCash(a) && !isWallet(a));

// Merchant codes after the name ("-MYGP-RM44473", " A/C 1234") are dropped.
function cleanName(name) {
  if (/^(?:01|\+?8801)\d/.test(name)) return name;
  return (
    name
      .replace(/-[\w-]*\d[\w-]*$/, '') // "-MYGP-RM44473", "-12345"
      .replace(/(\s+\S*\d\S*)+$/, '') // " A/C 1234"
      .trim() || name
  );
}

// What kind of spending a company is, matched against the user's own
// category names (so "Phone Bill" or "Mobile & Internet" both work).
const KINDS = [
  { what: /grameen|\bgp\b|mygp|robi|airtel|banglalink|teletalk|skitto|recharge|top.?up|internet|broadband|link3|carnival|amber ?it|bdcom|\bisp\b/i, cats: /mobile|internet|phone|recharge|data|wifi|broadband|ফোন|মোবাইল|ইন্টারনেট/i },
  { what: /desco|dpdc|nesco|wzpdcl|palli bidyut|\bpbs\b|breb|electric|prepaid meter|titas|karnaphuli|bakhrabad|jalalabad gas|\bgas\b|wasa|water/i, cats: /utilit|bill|electric|gas|water|বিদ্যুৎ|বিল/i },
  { what: /foodpanda|food ?delivery|pathao food|shohoz food|kfc|pizza|restaurant|cafe|burger/i, cats: /food|dining|meal|restaurant|খাবার/i },
  { what: /pathao|uber|obhai|shohoz|bus|railway|\brail\b|biman|us-bangla|novoair|air ?ticket|fuel|petrol|cng/i, cats: /transport|travel|fuel|যাতায়াত|ভাড়া/i },
  { what: /chaldal|shwapno|agora|meena bazar|unimart|grocery|super ?shop/i, cats: /bazar|grocer|market|বাজার/i },
  { what: /daraz|othoba|pickaboo|ajkerdeal|evaly|aarong|bata|apex|yellow|shopping/i, cats: /shopping|cloth|personal|কেনাকাটা/i },
  { what: /pharma|lazz|medicine|hospital|clinic|diagnostic|popular medical|ibn sina|labaid|square hospital|doctor/i, cats: /medic|health|doctor|ওষুধ|চিকিৎসা/i },
  { what: /school|college|university|tuition|coaching|exam fee|admission|udvash|10 ?minute school|shikho/i, cats: /study|education|tuition|school|book|পড়া|শিক্ষা/i },
  { what: /netflix|bioscope|hoichoi|chorki|toffee|spotify|youtube|cinema|cineplex|star cineplex|game/i, cats: /entertain|fun|movie|subscription|বিনোদন/i },
  { what: /insurance|metlife|jibon bima|pragati life/i, cats: /insurance|বিমা/i },
  { what: /zakat|donation|mosque|masjid|charity|bidyanondo/i, cats: /donat|zakat|charity|sadaqah|দান/i },
];

// The user's category that fits the SMS best, or null.
export function guessCategory(text, categories = []) {
  for (const k of KINDS) {
    if (!k.what.test(text)) continue;
    const hit = categories.find((c) => k.cats.test(c));
    if (hit) return hit;
  }
  return null;
}

// "Grameenphone Ltd" and "GRAMEENPHONE" are the same shop for remembering.
export const merchantKey = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/\b(ltd|limited|plc|pvt|bd|bangladesh)\b|[^a-z0-9\u0980-\u09ff ]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(' ');

export function parseSms(raw, accounts = []) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const { amount, fee, balance } = amounts(text);
  if (!(amount > 0)) return null;

  const ref = (text.match(/\b(?:TrxID|TxnID|Trx ID|Txn ID|TrnxID|Ref(?:erence)? ?No\.?)\s*:?\s*([A-Z0-9]{6,})/i) || [])[1] || '';
  const date = smsDate(text);
  const bankName = (text.match(/\b([A-Z][A-Za-z]+)\s+Bank\b/) || [])[1];

  // Which service sent it.
  const provider = has(text, /nagad/i) ? 'nagad' : has(text, /rocket|dbbl/i) ? 'rocket' : has(text, /TrxID/i) ? 'bkash' : has(text, /\bA\/C\b|account .*(debited|credited)|debited|credited/i) ? 'bank' : has(text, /TxnID/i) ? 'nagad' : 'unknown';
  const walletHint = provider === 'bank' ? null : provider;
  const wallet = () => findAccount(accounts, [walletHint, 'bkash'], isWallet);
  const bank = () => findAccount(accounts, [bankName, 'bank'], isBank);
  const cash = () => findAccount(accounts, ['cash'], isCash);
  // "to Grameenphone Ltd-MYGP-RM44473 is successful" -> "Grameenphone Ltd"
  const counterparty = cleanName((text.match(/\b(?:to|from)\s+((?:01|\+?8801)\d{8,9}|[A-Z][\w&.\- ]{2,40}?)(?=[.,]| is | was | has | successful| Ref| Fee| Trx| Txn| for | on | at |$)/) || [])[1]?.trim() || '');
  const own = provider === 'bank' ? bank() : wallet();

  const base = { amount, fee: fee || 0, date, ref, balance, provider, counterparty, balanceAccount: own };

  // ---- money moving between your own accounts
  if (has(text, /cash\s*out/i)) return { ...base, kind: 'Cash out', type: 'Transfer', account: wallet(), toAccount: cash() };
  if (has(text, /cash\s*in/i)) return { ...base, kind: 'Cash in', type: 'Transfer', account: cash(), toAccount: wallet() };
  if (has(text, /deposit .*from .*bank|add money|bank to (bkash|nagad)|transferred from .*bank/i) && provider !== 'bank')
    return { ...base, kind: 'Bank to wallet', type: 'Transfer', account: bank(), toAccount: wallet() };
  if (has(text, /(bkash|nagad|rocket)/i) && provider === 'bank' && has(text, /debited|transfer/i))
    return { ...base, kind: 'Bank to wallet', type: 'Transfer', account: bank(), toAccount: wallet() };

  // ---- money in
  if (has(text, /received|credited|deposit|refund|cashback|salary|remittance/i))
    return { ...base, kind: 'Money received', type: 'Income', account: own, category: has(text, /salary/i) ? 'Salary' : null };

  // ---- money out
  if (has(text, /recharge|top.?up|airtime/i)) return { ...base, kind: 'Mobile recharge', type: 'Expense', account: own, category: 'Mobile & Internet' };
  if (has(text, /send money|sent|transfer/i)) return { ...base, kind: 'Send money', type: 'Expense', account: own };
  if (has(text, /payment|paid|purchase|bill|debited|withdraw|pos\b/i))
    return { ...base, kind: provider === 'bank' ? 'Bank debit' : 'Payment', type: 'Expense', account: own };

  return null;
}
