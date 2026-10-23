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

  const nav = document.querySelector('.site-nav');
  const menu = document.querySelector('.menu-btn');
  if (menu) {
    menu.onclick = () => {
      const open = nav.classList.toggle('open');
      menu.setAttribute('aria-expanded', open);
      menu.textContent = open ? '✕' : '☰';
    };
    nav.querySelectorAll('.nav-links a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('open')));
  }
})();
