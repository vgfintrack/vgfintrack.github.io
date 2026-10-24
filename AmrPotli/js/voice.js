// Voice entry: "ডিম দেড়শো, মাছ সাড়ে চারশো" becomes ৳600 with "ডিম 150 + মাছ 450"
// in the note. Uses the phone's own speech service (Chrome sends the audio to
// Google for the words; FinnBlu gets only the text). Loaded only when 🎤 is tapped.

const nfc = (s) => String(s || '').normalize('NFC');

// Bangla says every number from 1 to 99 with its own word.
const ONES = 'এক দুই তিন চার পাঁচ ছয় সাত আট নয় দশ এগারো বারো তেরো চৌদ্দ পনেরো ষোলো সতেরো আঠারো উনিশ বিশ একুশ বাইশ তেইশ চব্বিশ পঁচিশ ছাব্বিশ সাতাশ আটাশ ঊনত্রিশ ত্রিশ একত্রিশ বত্রিশ তেত্রিশ চৌত্রিশ পঁয়ত্রিশ ছত্রিশ সাঁইত্রিশ আটত্রিশ ঊনচল্লিশ চল্লিশ একচল্লিশ বিয়াল্লিশ তেতাল্লিশ চুয়াল্লিশ পঁয়তাল্লিশ ছেচল্লিশ সাতচল্লিশ আটচল্লিশ ঊনপঞ্চাশ পঞ্চাশ একান্ন বাহান্ন তিপ্পান্ন চুয়ান্ন পঞ্চান্ন ছাপ্পান্ন সাতান্ন আটান্ন ঊনষাট ষাট একষট্টি বাষট্টি তেষট্টি চৌষট্টি পঁয়ষট্টি ছেষট্টি সাতষট্টি আটষট্টি ঊনসত্তর সত্তর একাত্তর বাহাত্তর তিয়াত্তর চুয়াত্তর পঁচাত্তর ছিয়াত্তর সাতাত্তর আটাত্তর ঊনআশি আশি একাশি বিরাশি তিরাশি চুরাশি পঁচাশি ছিয়াশি সাতাশি আটাশি ঊননব্বই নব্বই একানব্বই বিরানব্বই তিরানব্বই চুরানব্বই পঁচানব্বই ছিয়ানব্বই সাতানব্বই আটানব্বই নিরানব্বই'.split(' ');
const WORDS = new Map(ONES.map((w, i) => [nfc(w), i + 1]));
// Common other spellings.
for (const [w, n] of [['দুই', 2], ['দু', 2], ['ছয়', 6], ['ছ', 6], ['নয়', 9], ['উনিশ', 19], ['বিশ', 20], ['কুড়ি', 20], ['ত্রিশ', 30], ['তিরিশ', 30], ['ষোল', 16], ['এগার', 11], ['বার', 12], ['তের', 13], ['পনের', 15], ['সতের', 17], ['আঠার', 18], ['একশ', 100], ['শূন্য', 0]])
  WORDS.set(nfc(w), n);
const FRACTION = new Map([[nfc('দেড়'), 1.5], [nfc('আড়াই'), 2.5]]);
const HALF = nfc('সাড়ে');
const HUNDRED = /^(শো|শ|শত|hundred)$/;
const THOUSAND = /^(হাজার|thousand)$/;
const LAKH = /^(লাখ|লক্ষ|lakh|lac)$/;
const FILLER = new Set(['টাকা', 'টাকার', 'টাকায়', 'tk', 'taka', 'takar', 'আর', 'এবং', 'and', 'plus', 'দিয়ে', 'হলো', 'হল', 'খরচ', 'লাগলো', 'লাগল', 'কিনলাম', 'দিলাম'].map(nfc));

const BN = '০১২৩৪৫৬৭৮৯';
const toLatin = (s) => s.replace(/[০-৯]/g, (d) => BN.indexOf(d));

// A word that is a number, or a number with "শো" (hundred) joined to it: দুইশো, দেড়শো.
function numberWord(w) {
  if (/^[\d০-৯][\d০-৯,]*(\.[\d০-৯]+)?$/.test(w)) return { n: Number(toLatin(w).replace(/,/g, '')) };
  if (WORDS.has(w)) return { n: WORDS.get(w) };
  if (FRACTION.has(w)) return { n: FRACTION.get(w) };
  if (HUNDRED.test(w)) return { mult: 100 };
  if (THOUSAND.test(w)) return { mult: 1000 };
  if (LAKH.test(w)) return { mult: 100000 };
  if (w === HALF) return { half: true };
  const m = w.match(/^(.+?)(শো|শ|শত)$/);
  if (m && (WORDS.has(m[1]) || FRACTION.has(m[1]))) return { n: (WORDS.get(m[1]) ?? FRACTION.get(m[1])) * 100, hundreds: true };
  const k = w.match(/^(.+?)(হাজার)$/);
  if (k && (WORDS.has(k[1]) || FRACTION.has(k[1]))) return { n: (WORDS.get(k[1]) ?? FRACTION.get(k[1])) * 1000 };
  return null;
}

// "এক হাজার দুইশো পঞ্চাশ ডিম" -> [{ value: 1250, start, end }] over the word list.
function findNumbers(words) {
  const out = [];
  let total = 0, cur = 0, start = -1, half = false, any = false;
  const flush = (end) => {
    if (any) out.push({ value: Math.round((total + cur) * 100) / 100, start, end });
    total = 0; cur = 0; start = -1; half = false; any = false;
  };
  words.forEach((w, i) => {
    const t = numberWord(w);
    if (!t) return flush(i);
    if (start < 0) start = i;
    if (t.half) return (half = true);
    if (t.mult === 100) {
      cur = (cur || 1) * 100;
    } else if (t.mult) {
      total += (cur || 1) * t.mult;
      cur = 0;
    } else {
      const n = half ? t.n + (t.hundreds ? 50 : 0.5) : t.n;
      half = false;
      // "দুইশো পঞ্চাশ" is 250: whole hundreds followed by less than a hundred.
      // Any other two numbers in a row ("150 200") are two amounts.
      const joins = cur === 0 || (cur % 100 === 0 && n < 100);
      if (!joins) {
        flush(i);
        start = i;
        any = true;
      }
      cur += n;
    }
    any = true;
  });
  flush(words.length);
  return out;
}

// Category names the user has, matched by what was bought. Words are matched
// whole (with common endings like -এ, -র, -টা), so "পঞ্চাশ" is not "চা".
const HINTS = [
  [['বাসা ভাড়া', 'ঘর ভাড়া', 'বাড়ি ভাড়া', 'house rent'], null, ['House Rent', 'Rent', 'Shop Rent']],
  [null, 'চাল ডাল তেল মাছ মাংস মুরগি গরুর গরু খাসি ডিম সবজি শাক আলু পেঁয়াজ পিয়াজ রসুন আদা মরিচ মসলা লবণ চিনি দুধ বাজার ফল কলা আটা ময়দা rice fish egg eggs vegetable vegetables bazar grocery groceries chicken meat onion potato milk', ['Bazar & Groceries', 'Groceries', 'Bazar', 'Food']],
  [null, 'খাবার নাস্তা চা লাঞ্চ হোটেল বিরিয়ানি ভাত food lunch breakfast tea snack snacks dinner', ['Food', 'Snacks & Tea', 'Hall Dining Fee']],
  [null, 'রিকশা রিক্সা বাস সিএনজি উবার পাঠাও গাড়ি rickshaw bus cng uber pathao transport fare', ['Transport', 'Transport & Delivery']],
  [null, 'গ্যাস বিদ্যুৎ কারেন্ট বিল পানি gas electricity electric bill water', ['Utility Bills', 'Electricity', 'Bills']],
  [null, 'ভাড়া rent', ['House Rent', 'Rent', 'Shop Rent']],
  [null, 'ওষুধ ঔষধ ডাক্তার হাসপাতাল medicine doctor hospital', ['Medical']],
  [null, 'স্কুল কলেজ টিউশন বই খাতা কোচিং school tuition book books coaching', ["Children's Education", 'Study & Books', 'Education']],
  [null, 'মোবাইল রিচার্জ ইন্টারনেট ফ্লেক্সি recharge mobile internet', ['Mobile & Internet']],
  [null, 'কাপড় জামা শাড়ি জুতা clothes dress shoes', ['Clothing', 'Shopping']],
  [null, 'উপহার গিফট দাওয়াত বিয়ে gift dawat wedding', ['Gifts & Dawat']],
  [null, 'বেতন salary', ['Salary']],
  [null, 'ছেলে মেয়ে স্বামী বাবা আব্বু আম্মু ভাই বোন পাঠাইছে পাঠিয়েছে পাঠালো son daughter husband', ['Household Money', 'Family Allowance', 'Gift Received']],
].map(([phrases, words, names]) => [phrases?.map(nfc), words ? new Set(nfc(words).toLowerCase().split(' ')) : null, names]);
const ENDING = /(গুলো|গুলি|টা|টি|ের|ে|র|য়|ও|s)$/;
const hasWord = (set, w) => set.has(w) || set.has(w.replace(ENDING, ''));
const INCOME = /পেলাম|পেয়েছি|পাইছি|পাইলাম|পেয়েছি|আসছে|এসেছে|received|got|salary|বেতন/i;

export function parseSpeech(raw, { expense = [], income = [] } = {}) {
  const text = nfc(raw).replace(/[,।?!]/g, ' ');
  const words = text.split(/\s+/).filter(Boolean);
  const nums = findNumbers(words);
  if (!nums.length) return null;
  const label = (from, to) => words.slice(from, to).filter((w) => !FILLER.has(w)).join(' ');
  const items = nums.map((n, i) => ({ value: n.value, label: label(i ? nums[i - 1].end : 0, n.start) }));
  // "দেড়শো টাকার ডিম": the thing comes after the amount.
  if (items.length === 1 && !items[0].label) items[0].label = label(nums[0].end, words.length);
  if (items.length > 1 && !items[0].label) {
    // amount-first speech for several items: shift labels left
    for (let i = 0; i < items.length; i++) items[i].label = label(nums[i].end, nums[i + 1]?.start ?? words.length);
  }
  const type = INCOME.test(text) ? 'Income' : 'Expense';
  const list = type === 'Income' ? income : expense;
  let category = null;
  const lower = words.map((w) => w.toLowerCase());
  for (const [phrases, set, names] of HINTS) {
    const hit = phrases ? phrases.some((ph) => text.toLowerCase().includes(ph)) : lower.some((w) => hasWord(set, w));
    if (!hit) continue;
    category = names.map((n) => list.find((c) => c.toLowerCase() === n.toLowerCase())).find(Boolean) || null;
    if (category) break;
  }
  const amount = Math.round(items.reduce((s, i) => s + i.value, 0) * 100) / 100;
  return {
    type,
    amount,
    expr: items.length > 1 ? items.map((i) => i.value).join('+') : String(amount),
    note: items.length > 1 ? items.map((i) => `${i.label} ${i.value}`.trim()).join(' + ') : items[0].label,
    category,
    heard: raw,
  };
}

export const voiceSupported = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);

// Listens once and resolves with what was said (or rejects with an error code).
export function listen(lang) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  return new Promise((resolve, reject) => {
    const r = new SR();
    r.lang = lang;
    r.interimResults = false;
    r.maxAlternatives = 1;
    let done = false;
    r.onresult = (e) => {
      done = true;
      resolve(e.results[0][0].transcript);
    };
    r.onerror = (e) => {
      done = true;
      reject(e.error || 'error');
    };
    r.onend = () => !done && reject('no-speech');
    r.start();
    listen.stop = () => r.stop();
  });
}
