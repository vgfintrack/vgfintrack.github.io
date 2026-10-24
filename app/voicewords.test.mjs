// Voice entry from real sentences a student said: income words, "এক" as a word,
// loans, a fare to get somewhere, the account named, and transfers between own accounts.
import { chromium } from 'playwright';
const ok = (c, m) => { console.log(c ? '✅' : '❌', m); if (!c) process.exitCode = 1; };
const b = await chromium.launch();

async function say(sentence) {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const googleClientId = 'REPLACE_ME';" }));
  await ctx.addInitScript((said) => {
    if (!sessionStorage.x) { localStorage.setItem('mt:lang', 'bn'); localStorage.setItem('mt:district-later', String(Date.now() + 9e10)); sessionStorage.x = 1; }
    window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { setTimeout(() => this.onresult({ results: [[{ transcript: said }]] }), 200); } stop() {} };
  }, sentence);
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  await p.goto('http://localhost:8090/FinnBlu/');
  await p.click('[data-start]'); await p.click('[data-track=personal]'); await p.click('[data-persona=student]'); await p.click('[data-next]');
  await p.click('[data-wallet=bkash]'); await p.click('[data-wallet=bank]').catch(() => {}); for (let i = 0; i < 4; i++) await p.click('[data-next]');
  await p.click('[data-goal="0"]'); await p.click('[data-next]'); await p.click('[data-finish=""]');
  await p.waitForSelector('.kpis');
  await p.click('#fab'); await p.click('#voice-btn');
  await p.waitForFunction(() => !document.querySelector('#voice-btn').classList.contains('listening'));
  const f = await p.evaluate(() => {
    const opt = (id) => document.querySelector(id)?.selectedOptions[0]?.textContent || '';
    return {
      type: document.querySelector('#txn-type .active')?.dataset.type,
      amount: document.querySelector('#txn-amount').value,
      category: document.querySelector('#txn-category').value,
      account: opt('#txn-account'),
      to: opt('#txn-to'),
      loan: document.querySelector('#txn-loan').value,
      info: document.querySelector('#sms-info').textContent,
    };
  });
  f.errs = p.errs;
  await ctx.close();
  return f;
}

let f = await say('ইনকাম ৪০০ টাকা');
ok(f.type === 'Income' && f.amount === '400', '“ইনকাম ৪০০ টাকা”: income ৳400 ' + JSON.stringify(f));

f = await say('অন্য এক বন্ধুর বিকাশ থেকে আমার বিকাশ এসেছে ৬০০ টাকা');
ok(f.type === 'Income' && f.amount === '600', '“অন্য এক বন্ধুর…”: income ৳600, not 1+600: ' + f.amount);
ok(/bkash/i.test(f.account), 'arrived in my bKash: ' + f.account);
ok(f.category === 'Other Income' && f.info.includes('ক্যাটাগরি বেছে'), 'no source said: Other Income, and asks to pick (not the first tuition) ' + f.category);

f = await say('ধার দিয়েছি বিশ হাজার টাকা');
ok(f.type === 'Loan' && f.loan === 'lend' && f.amount === '20000', '“ধার দিয়েছি…”: Loan, I lent ৳20000 ' + JSON.stringify(f));

f = await say('ধার নিলাম পাঁচ হাজার');
ok(f.type === 'Loan' && f.loan === 'borrow' && f.amount === '5000', '“ধার নিলাম…”: Loan, I borrowed');

f = await say('ধার শোধ করলাম দুই হাজার');
ok(f.type === 'Loan' && f.loan === 'repay', '“ধার শোধ করলাম”: I repaid');

f = await say('করিম ফেরত দিল এক হাজার');
ok(f.type === 'Loan' && f.loan === 'collect' && f.amount === '1000', '“ফেরত দিল এক হাজার”: someone paid me back ৳1000');

f = await say('টিউশনে যেতে ভাড়া লেগেছে ১৯০ টাকা');
ok(f.type === 'Expense' && f.amount === '190' && f.category === 'Transport', '“টিউশনে যেতে ভাড়া…”: Transport, not Study ' + f.category);

f = await say('বিকাশ থেকে ক্যাশে দিলাম তিন হাজার');
ok(f.type === 'Transfer' && /bkash/i.test(f.account) && /cash|ক্যাশ|হাতে/i.test(f.to), 'bKash → cash: a transfer between my accounts ' + JSON.stringify(f));

f = await say('আমার ব্যাংক অ্যাকাউন্ট থেকে বিকাশে ট্রান্সফার করেছি ১০০০০ টাকা');
ok(f.type === 'Transfer' && f.amount === '10000' && /bank/i.test(f.account) && /bkash/i.test(f.to), '“ব্যাংক অ্যাকাউন্ট থেকে বিকাশে ট্রান্সফার”: Bank → bKash ' + JSON.stringify(f));

f = await say('ব্যাংক তো বিকাশ করেছি ৫০০ টাকা');
ok(f.type === 'Transfer' && f.amount === '500' && /bank/i.test(f.account) && /bkash/i.test(f.to), '“ব্যাংক তো বিকাশ করেছি” (থেকে misheard): Bank → bKash ' + JSON.stringify(f));

f = await say('আম্মুকে বিকাশ থেকে দুই হাজার পাঠালাম');
ok(f.type === 'Expense' && /bkash/i.test(f.account), 'to Ammu from bKash: spending, paid from bKash ' + JSON.stringify(f));
ok(!f.errs.length, 'no errors ' + f.errs.join('|'));

await b.close();
