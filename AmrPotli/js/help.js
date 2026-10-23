// "How do I…?": short answers that work offline, each with a link to the
// full step-by-step guide on the website. Searched on the phone in English,
// Bangla or Banglish. Loaded when the help box opens.

const G = '../guides/how-to.html#';
// [id, English question, English answer, Bangla question, Bangla answer, extra search words, link]
const TOPICS = [
  ['add', 'Add an entry', 'Tap the green +, choose Expense, Income, Transfer or Loan, type the amount, tap a category and Save.', 'এন্ট্রি যোগ করব কীভাবে?', 'সবুজ + চাপুন, খরচ, আয়, ট্রান্সফার বা লোন বেছে নিন, টাকা লিখে ক্যাটাগরিতে চাপ দিয়ে সেভ করুন।', 'new expense income spend khoroch aay entry likhbo যোগ এন্ট্রি খরচ আয় লিখব', G + 'add'],
  ['calculator', 'Add up several items in one entry', 'Tap the amount and type 60+80+150 on AmrPotli’s number pad. It saves ৳290 and keeps the parts in the note.', 'কয়েকটা জিনিস এক এন্ট্রিতে যোগ করব কীভাবে?', 'টাকার ঘরে চাপ দিয়ে আমার পোটলির নম্বর প্যাডে ৬০+৮০+১৫০ লিখুন। ৳২৯০ সেভ হবে, ভাগগুলো নোটে থাকবে।', 'calculator sum plus total jog hisab ক্যালকুলেটর যোগফল মোট', G + 'calculator'],
  ['voice', 'Add by speaking', 'Tap 🎤 and say it, for example “ডিম দেড়শো, মাছ সাড়ে চারশো”. Check the form and Save. It needs internet.', 'মুখে বলে কীভাবে লিখব?', '🎤 চেপে বলুন, যেমন “ডিম দেড়শো, মাছ সাড়ে চারশো”। ফর্ম দেখে সেভ করুন। ইন্টারনেট লাগে।', 'voice speak mic bolbo kotha ভয়েস মুখে বলে কথা মাইক', G + 'voice'],
  ['sms', 'Add from a bKash, Nagad or bank SMS', 'Copy the SMS, tap + → Paste SMS, then Fill from SMS. Check the category and Save; next time it remembers the shop.', 'বিকাশ, নগদ বা ব্যাংকের SMS থেকে কীভাবে লিখব?', 'SMS কপি করে + → SMS পেস্ট, তারপর “SMS থেকে পূরণ” চাপুন। ক্যাটাগরি দেখে সেভ করুন; পরের বার দোকান মনে রাখবে।', 'sms message bkash nagad rocket bank paste এসএমএস বিকাশ নগদ রকেট ব্যাংক মেসেজ bikash', G + 'sms'],
  ['receipt', 'Keep a receipt or memo photo', 'In the entry form tap Receipt photo, take or pick a picture. It is saved in your own Google Drive.', 'রসিদ বা মেমোর ছবি কীভাবে রাখব?', 'এন্ট্রি ফর্মে “রসিদের ছবি” চেপে ছবি তুলুন বা বেছে নিন। এটি আপনার নিজের Google Drive-এ থাকে।', 'photo picture camera memo receipt chobi ছবি রসিদ মেমো ক্যামেরা', G + 'receipt'],
  ['transfer', 'Move money between accounts, with charges', 'Tap + → Transfer, choose From and To. Add the cash-out or sending charge in Service charge; it counts as spending.', 'এক অ্যাকাউন্ট থেকে আরেকটায় টাকা সরাব কীভাবে?', '+ → ট্রান্সফার চেপে কোথা থেকে আর কোথায় বেছে নিন। ক্যাশ আউট বা পাঠানোর চার্জ “সার্ভিস চার্জ”-এ লিখুন; সেটা খরচ হিসেবে গোনা হয়।', 'transfer move cash out charge fee bank to bkash ট্রান্সফার ক্যাশআউট ক্যাশ আউট চার্জ পাঠানো bikash', G + 'transfer'],
  ['loans', 'Record a loan or installment', 'Tap + → Loan and choose: I borrowed, I lent, I repaid or They paid me back. Put interest in the interest box.', 'ধার বা কিস্তি কীভাবে লিখব?', '+ → লোন চেপে বেছে নিন: ধার নিলাম, ধার দিলাম, শোধ করলাম, বা ফেরত পেলাম। সুদ থাকলে সুদের ঘরে লিখুন।', 'loan borrow lend dhar kisti installment interest লোন ধার কিস্তি সুদ ঋণ', G + 'loans'],
  ['regular', 'Rent, bills or salary that repeat', 'Save the entry once with Repeat (monthly or weekly). On the day AmrPotli asks: Add, Change or Skip.', 'প্রতি মাসের ভাড়া, বিল বা বেতন কীভাবে লিখে রাখব?', 'একবার “পুনরাবৃত্তি” (মাসে বা সপ্তাহে) দিয়ে সেভ করুন। সেদিন আমার পোটলি জিজ্ঞেস করবে: যোগ, বদল বা বাদ।', 'repeat recurring monthly rent bill salary vara beton ভাড়া বিল বেতন প্রতি মাসে নিয়মিত', G + 'regular'],
  ['budgets', 'Set a budget or savings goal', 'Setup → Expense categories: type a monthly budget next to each. The savings goal is in Setup too.', 'বাজেট বা সঞ্চয়ের লক্ষ্য কীভাবে দেব?', 'Setup → খরচের ক্যাটাগরি: প্রতিটার পাশে মাসিক বাজেট লিখুন। সঞ্চয়ের লক্ষ্যও Setup-এ।', 'budget goal savings target sonchoy lokkho বাজেট লক্ষ্য সঞ্চয়', G + 'budgets'],
  ['reports', 'Make a statement or report', 'Reports tab: choose a statement (account, income & expense, assets, tax, loans) and the dates, then Print or Save as PDF.', 'স্টেটমেন্ট বা রিপোর্ট কীভাবে বানাব?', 'রিপোর্ট ট্যাবে স্টেটমেন্ট (অ্যাকাউন্ট, আয়-ব্যয়, সম্পদ, ট্যাক্স, লোন) আর তারিখ বেছে প্রিন্ট বা PDF করুন।', 'report statement pdf print tax bank document রিপোর্ট স্টেটমেন্ট ট্যাক্স প্রিন্ট', G + 'reports'],
  ['undo', 'Bring back something I deleted', 'Right after deleting, tap Undo on the message at the bottom.', 'মুছে ফেলা জিনিস কীভাবে ফেরাব?', 'মোছার সঙ্গে সঙ্গে নিচের বার্তায় “ফিরিয়ে আনুন” চাপুন।', 'undo delete deleted mistake restore ফেরত মুছে ভুল', G + 'undo'],
  ['lock', 'Lock the app with a PIN or fingerprint', 'Setup → App lock → Turn on, choose a PIN, and fingerprint or face if your phone has it.', 'পিন বা আঙুলের ছাপে লক দেব কীভাবে?', 'Setup → অ্যাপ লক → চালু করুন, পিন দিন, আর ফোনে থাকলে আঙুলের ছাপ বা মুখ।', 'lock pin fingerprint password hide লক পিন আঙুলের ছাপ পাসওয়ার্ড', G + 'lock'],
  ['forgot-pin', 'I forgot my PIN', 'On the lock screen tap Forgot PIN? and sign in with Google again. Your data stays safe in Drive.', 'পিন ভুলে গেছি', 'লক স্ক্রিনে “PIN ভুলে গেছেন?” চেপে আবার Google দিয়ে সাইন ইন করুন। তথ্য Drive-এ নিরাপদ থাকে।', 'forgot pin password lock পিন ভুলে লক', G + 'lock'],
  ['backup', 'Backup, or move to a new phone', 'Everything is in your Google Drive: on a new phone, sign in with the same account. Setup → Download backup keeps a spare copy.', 'ব্যাকআপ, বা নতুন ফোনে নেব কীভাবে?', 'সব আপনার Google Drive-এ: নতুন ফোনে একই অ্যাকাউন্টে সাইন ইন করুন। Setup → ব্যাকআপ ডাউনলোড একটা বাড়তি কপি রাখে।', 'backup new phone move restore import json ব্যাকআপ নতুন ফোন', G + 'backup'],
  ['categories', 'Change or add categories', 'Setup → Expense categories or Income sources: tap a name to rename, ✕ to remove, or type a new one. Up to 24 on the free plan.', 'ক্যাটাগরি কীভাবে বদলাব বা যোগ করব?', 'Setup → খরচের ক্যাটাগরি বা আয়ের উৎস: নাম বদলাতে নামে চাপুন, বাদ দিতে ✕, নতুন হলে লিখে যোগ করুন। ফ্রি প্ল্যানে ২৪টি পর্যন্ত।', 'category categories rename add remove khat ক্যাটাগরি খাত', G + 'categories'],
  ['sync', 'It says “Tap to sync” or “Not synced”', 'Your entries are safe on the phone. Tap the button at the top once; it reconnects to Google and saves to Drive.', '“Sync করতে চাপুন” বা “Sync হয়নি” দেখাচ্ছে', 'এন্ট্রিগুলো ফোনে নিরাপদ আছে। ওপরের বোতামে একবার চাপুন; Google-এ আবার যুক্ত হয়ে Drive-এ সেভ হবে।', 'sync not synced drive offline error tap সিঙ্ক ড্রাইভ', '../faq.html#problems'],
  ['install', 'Install the app on my phone', 'Setup → Install the app, or in Chrome: Install. On iPhone: Safari → Share → Add to Home Screen.', 'ফোনে অ্যাপ ইনস্টল করব কীভাবে?', 'Setup → অ্যাপটি ইনস্টল করুন, বা Chrome-এ Install। আইফোনে: Safari → Share → Add to Home Screen।', 'install home screen app download play store ইনস্টল অ্যাপ', G + 'install'],
  ['language', 'Change the language or night mode', 'Setup → Language for বাংলা or English; Appearance for Day, Night or Auto. The moon button at the top switches too.', 'ভাষা বা রাতের মোড কীভাবে বদলাব?', 'Setup → ভাষা থেকে বাংলা বা English; দেখতে কেমন থেকে দিন, রাত বা অটো। ওপরের চাঁদের বোতামেও বদলায়।', 'language bangla english dark night theme ভাষা বাংলা ইংরেজি রাত দিন', '../faq.html#basics'],
  ['baki', 'Record a sale on baki (credit)', 'Tap Baki sale, pick or add the customer, type the amount and Save. Their total baki shows in the Baki khata.', 'বাকিতে বিক্রি কীভাবে লিখব?', '“বাকিতে বিক্রি” চেপে কাস্টমার বেছে নিন বা যোগ করুন, টাকা লিখে সেভ করুন। মোট বাকি বাকির খাতায় দেখাবে।', 'baki credit customer due khata sale বাকি বাকিতে খাতা কাস্টমার খদ্দের', '../guides/shop.html'],
  ['getbaki', 'A customer paid some baki', 'Tap Got baki (or the customer’s name), type what they paid and into which account. Remind sends a polite WhatsApp message.', 'কাস্টমার বাকি শোধ করলে কী করব?', '“বাকি আদায়” (বা কাস্টমারের নাম) চেপে কত দিলেন আর কোন অ্যাকাউন্টে লিখুন। “মনে করিয়ে দিন” WhatsApp-এ ভদ্র বার্তা পাঠায়।', 'baki paid collect customer whatsapp remind বাকি আদায় শোধ কাস্টমার তাগাদা', '../guides/shop.html'],
  ['purchase', 'Record a stock purchase from a supplier', 'Tap Purchase, choose the supplier, tick the products, type the total and how much you paid now. The rest stays as baki to the supplier.', 'সাপ্লায়ারের কাছ থেকে মাল কেনা কীভাবে লিখব?', '“মাল কেনা” চেপে সাপ্লায়ার বেছে নিন, পণ্য টিক দিন, মোট টাকা আর এখন কত দিলেন লিখুন। বাকিটা সাপ্লায়ারের বাকি হিসেবে থাকবে।', 'purchase stock supplier buy mal kena memo মাল কেনা সাপ্লায়ার পাইকার মেমো', '../guides/shop.html'],
  ['helpers', 'Let my employee or family add sales', 'Setup → Team → Add a helper with their Gmail. They open AmrPotli on their phone → For business → A team → Employee or helper.', 'কর্মচারী বা পরিবারের কেউ কীভাবে বিক্রি লিখবেন?', 'Setup → টিম → সহকারী যোগ করুন-এ তাঁর Gmail দিন। তিনি নিজের ফোনে আমার পোটলি → ব্যবসার জন্য → একটি টিম → কর্মচারী বা সহকারী বেছে নেবেন।', 'team helper employee staff family shop share karmochari কর্মচারী সহকারী টিম ভাতিজা পরিবার', '../guides/shop.html#team'],
  ['district', 'Change my district', 'Setup → Your district. It is optional and only counted anonymously.', 'জেলা কীভাবে বদলাব?', 'Setup → আপনার জেলা। এটি ঐচ্ছিক, শুধু নাম-পরিচয় ছাড়া গোনা হয়।', 'district location zila place জেলা এলাকা', '../faq.html#privacy'],
  ['delete', 'Delete my account and data', 'Setup → Delete my account. It offers a backup first, then asks you to type DELETE. This cannot be undone.', 'অ্যাকাউন্ট আর তথ্য কীভাবে মুছব?', 'Setup → আমার অ্যাকাউন্ট মুছে ফেলুন। আগে ব্যাকআপ দেয়, তারপর DELETE লিখতে বলে। এটি আর ফেরানো যায় না।', 'delete account remove erase data মুছে অ্যাকাউন্ট ডিলিট', G + 'delete'],
];

export const HELP = TOPICS.map(([id, enQ, enA, bnQ, bnA, words, link]) => ({ id, en: { q: enQ, a: enA }, bn: { q: bnQ, a: bnA }, words, link }));

const POPULAR = ['add', 'sms', 'loans', 'regular', 'backup', 'helpers'];
// Keeps letters, numbers and marks (Bangla vowel signs like া and ি are marks).
const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ');

// The best matches for what was typed (or a few popular ones for nothing).
export function searchHelp(query, limit = 6) {
  const words = norm(query).split(/\s+/).filter((w) => w.length >= 2);
  if (!words.length) return POPULAR.map((id) => HELP.find((h) => h.id === id));
  return HELP.map((h) => {
    const hay = norm(`${h.en.q} ${h.bn.q} ${h.words} ${h.en.a} ${h.bn.a}`);
    const title = norm(`${h.en.q} ${h.bn.q} ${h.words}`);
    let score = 0;
    for (const w of words) {
      if (title.includes(w)) score += 3;
      else if (hay.includes(w)) score += 1;
    }
    return { h, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.h);
}
