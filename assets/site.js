// AmrPotli website: English / বাংলা switch (shared with the app) and the phone menu.
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
})();
