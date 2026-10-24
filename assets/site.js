// FinnBlu website: English / বাংলা switch (shared with the app) and the phone menu.
(() => {
  const html = document.documentElement;
  const buttons = document.querySelectorAll('[data-l]');
  const titles = { en: html.dataset.titleEn, bn: html.dataset.titleBn };
  function setLang(l) {
    html.lang = l;
    buttons.forEach((b) => b.classList.toggle('on', b.dataset.l === l));
    if (titles[l]) document.title = titles[l];
    try { localStorage.setItem('mt:lang', l); } catch {}
  }
  buttons.forEach((b) => (b.onclick = () => setLang(b.dataset.l)));
  setLang(html.lang === 'bn' ? 'bn' : 'en');

  // Day / night: the button switches to the other one; the choice is shared with the app.
  const themeBtn = document.querySelector('.theme-btn');
  const dark = () => html.dataset.theme === 'dark' || (!html.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const drawTheme = () => {
    if (!themeBtn) return;
    const bn = html.lang === 'bn';
    themeBtn.classList.toggle('is-dark', dark());
    themeBtn.title = dark() ? (bn ? 'দিনের মোড' : 'Day mode') : bn ? 'রাতের মোড' : 'Night mode';
    themeBtn.setAttribute('aria-label', themeBtn.title);
  };
  if (themeBtn)
    themeBtn.onclick = () => {
      html.dataset.theme = dark() ? 'light' : 'dark';
      try { localStorage.setItem('mt:theme', html.dataset.theme); } catch {}
      drawTheme();
    };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawTheme);
  buttons.forEach((b) => b.addEventListener('click', drawTheme));
  drawTheme();

  const nav = document.querySelector('.site-nav');
  const menu = document.querySelector('.menu-btn');
  if (menu) {
    menu.onclick = () => {
      const open = nav.classList.toggle('open');
      menu.setAttribute('aria-expanded', open);
      menu.classList.toggle('is-open', open);
    };
    nav.querySelectorAll('.nav-links a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('open')));
  }

  // ---- the FinnBlu team: website notice and the contact forms (company.js is shared with the app)
  const root = new URL('..', document.currentScript?.src || location.href);
  const company = () => import(new URL('FinnBlu/js/company.js', root).href);
  const bn = () => html.lang === 'bn';
  company()
    .then(async (C) => {
      if (!C.connected()) return;
      const n = (await C.loadPublic()).notice?.site;
      let closed = null;
      try { closed = localStorage.getItem('mt:site-notice-closed'); } catch {}
      if (!n?.on || String(n.id) === closed || !(n.en || n.bn)) return;
      const bar = document.createElement('div');
      bar.className = 'site-notice';
      const draw = () => {
        const text = bn() ? n.bn || n.en : n.en || n.bn;
        bar.innerHTML = `<div class="wrap"><span></span>${n.link && /^https:\/\//.test(n.link) ? `<a href="${n.link}">${bn() ? 'আরও' : 'More'} →</a>` : ''}<button type="button" aria-label="Close">✕</button></div>`;
        bar.querySelector('span').textContent = text;
        bar.querySelector('button').onclick = () => {
          try { localStorage.setItem('mt:site-notice-closed', String(n.id)); } catch {}
          bar.remove();
        };
      };
      draw();
      buttons.forEach((b) => b.addEventListener('click', draw));
      document.querySelector('.site-nav')?.after(bar);
    })
    .catch(() => {});

  const forms = { 'site-feedback': 'feedback', 'site-optin': 'optin' };
  for (const [id, kind] of Object.entries(forms)) {
    const f = document.getElementById(id);
    if (!f) continue;
    f.onsubmit = async (e) => {
      e.preventDefault();
      const msg = f.querySelector('.form-msg');
      const say = (en, bnText, bad) => {
        msg.textContent = bn() ? bnText : en;
        msg.className = `form-msg ${bad ? 'bad' : 'good'}`;
        msg.hidden = false;
      };
      const d = Object.fromEntries(new FormData(f).entries());
      if (kind === 'feedback' && !d.text.trim()) return say('Write your message first.', 'আগে আপনার কথা লিখুন।', true);
      if (kind === 'optin' && (!d.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim()))) return say('Write your name and a valid email.', 'আপনার নাম আর সঠিক ইমেইল লিখুন।', true);
      const btn = f.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const C = await company();
        if (!C.connected()) throw new Error('offline');
        if (kind === 'feedback') await C.sendFeedback({ kind: d.kind, text: d.text.trim(), contact: d.contact.trim(), from: 'website', lang: html.lang });
        else await C.sendOptin({ ...d, name: d.name.trim(), email: d.email.trim(), lang: html.lang, app: 'website' });
        f.reset();
        say('Sent. Thank you! The FinnBlu team will read it.', 'পাঠানো হয়েছে। ধন্যবাদ! FinnBlu টিম এটি পড়বে।');
      } catch {
        say('Could not send. Check your internet, or email vgfintrack@gmail.com.', 'পাঠানো যায়নি। ইন্টারনেট দেখুন, বা vgfintrack@gmail.com-এ ইমেইল করুন।', true);
      } finally {
        btn.disabled = false;
      }
    };
  }
})();
