#!/usr/bin/env python3
"""Builds the AmrPotli website pages from tools/pages/.

Each source page is just the page body, starting with a settings comment:

    <!--{"out": "guides/student.html", "nav": "guides",
         "title_en": "...", "title_bn": "...", "description": "..."}-->

The script adds the shared <head>, menu and footer, and writes the page to
`out` (relative to the repository root). Run it after editing a page:

    python3 tools/build-site.py      (needs Python 3.12 or newer)

Shortcuts inside a page:
    [[English text || বাংলা লেখা]]       -> the right one shows for each language
    [[shot:sms|Caption || ক্যাপশন]]      -> a phone screenshot from assets/guide/
    {{root}}                              -> "" or "../", so links work from any folder
"""
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = ROOT / 'tools' / 'pages'
SITE = 'https://vgfintrack.github.io/'

NAV = [
    ('features', 'features.html', 'Features', 'ফিচার'),
    ('guides', 'guides/', 'Guides', 'গাইড'),
    ('faq', 'faq.html', 'FAQ', 'প্রশ্নোত্তর'),
    ('about', 'about.html', 'About', 'আমাদের কথা'),
]


def bi(en, bn):
    return f'<span lang="en">{en}</span><span lang="bn">{bn}</span>'


def shot(m, root):
    name, _, caption = m.group(1).partition('|')
    cap = ''
    if caption.strip():
        en, _, bn = caption.partition('||')
        cap = f'<figcaption>{bi(en.strip(), (bn or en).strip())}</figcaption>'
    imgs = ''.join(
        f'<img lang="{l}" src="{root}assets/guide/{l}-{name.strip()}.jpg" alt="" loading="lazy" width="390" height="780">'
        for l in ('en', 'bn')
    )
    return f'<figure class="shot"><div class="frame">{imgs}</div>{cap}</figure>'


def expand(body, root):
    body = body.replace('{{root}}', root)
    body = re.sub(r'\[\[shot:(.+?)\]\]', lambda m: shot(m, root), body, flags=re.S)
    body = re.sub(r'\[\[(.+?)\|\|(.+?)\]\]', lambda m: bi(m.group(1).strip(), m.group(2).strip()), body, flags=re.S)
    return body


def head(meta, root):
    is_home = meta['out'] == 'index.html'
    redirect = (
        "    // A home-screen install from before the app moved to /AmrPotli/ opens here\n"
        "    // in app mode: send it straight to the app.\n"
        "    if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) location.replace('AmrPotli/');\n"
        if is_home else ''
    )
    url = SITE + meta['out'].replace('index.html', '')
    esc = lambda s: html.escape(s, quote=True)
    return f'''<!doctype html>
<html lang="en" data-title-en="{esc(meta['title_en'])}" data-title-bn="{esc(meta['title_bn'])}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{esc(meta['title_en'])}</title>
  <meta name="description" content="{esc(meta['description'])}" />
  <meta name="theme-color" content="#0f766e" />
  <link rel="canonical" href="{url}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="{url}" />
  <meta property="og:title" content="{esc(meta['title_en'])}" />
  <meta property="og:description" content="{esc(meta['description'])}" />
  <meta property="og:image" content="{SITE}AmrPotli/icons/icon-512.png" />
  <link rel="icon" href="{root}AmrPotli/icons/icon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" />
  <script>
{redirect}    // Language: saved choice (shared with the app), else the browser language.
    // Day / night: saved choice (shared with the app), else the phone's setting.
    try {{
      const th = localStorage.getItem('mt:theme');
      if (th === 'light' || th === 'dark') document.documentElement.dataset.theme = th;
      const l = localStorage.getItem('mt:lang') || ((navigator.language || '').toLowerCase().startsWith('bn') ? 'bn' : 'en');
      document.documentElement.lang = l === 'bn' ? 'bn' : 'en';
    }} catch {{}}
  </script>
  <link rel="stylesheet" href="{root}assets/site.css" />
</head>
<body>
'''


def nav(meta, root):
    current = ' aria-current="page"'
    links = ''.join(
        f'<a href="{root}{href}"{current if meta.get("nav") == key else ""}>{bi(en, bn)}</a>'
        for key, href, en, bn in NAV
    )
    return f'''
<nav class="site-nav" aria-label="Main">
  <div class="wrap">
    <a class="logo" href="{root}./"><img src="{root}AmrPotli/icons/icon.svg" alt="" width="32" height="32"><span class="word">AmrPotli</span></a>
    <div class="nav-links">{links}</div>
    <div class="nav-right">
      <div class="seg" role="group" aria-label="Language">
        <button type="button" data-l="en">EN</button>
        <button type="button" data-l="bn">বাং</button>
      </div>
      <button type="button" class="theme-btn" aria-label="Day or night">🌙</button>
      <a class="btn primary sm" href="{root}AmrPotli/">{bi('Open app', 'অ্যাপ খুলুন')}</a>
      <button type="button" class="menu-btn" aria-label="Menu" aria-expanded="false">☰</button>
    </div>
  </div>
</nav>
'''


def foot(root):
    blank = ' target="_blank" rel="noopener"'
    col = lambda title, items: '<div><b>' + title + '</b>' + ''.join(
        f'<a href="{href}"{blank if href.startswith("http") else ""}>{label}</a>' for href, label in items
    ) + '</div>'
    feedback = 'https://docs.google.com/forms/d/e/1FAIpQLSdvSfgm0FSD-HoNBByTHWaTj-Kl_0-zTXREGdng5tHuB1Xkcg/viewform?usp=pp_url&entry.247074758=website'
    return f'''
<footer class="site-foot">
  <div class="wrap">
    <div class="foot-cols">
      <div class="foot-brand">
        <a class="logo" href="{root}./"><img src="{root}AmrPotli/icons/icon.svg" alt="" width="32" height="32">AmrPotli</a>
        <p>{bi('A private money tracker for life and small business in Bangladesh.', 'বাংলাদেশের জীবন আর ছোট ব্যবসার জন্য প্রাইভেট টাকার হিসাব।')}</p>
      </div>
      {col(bi('App', 'অ্যাপ'), [(f'{root}AmrPotli/', bi('Open AmrPotli', 'AmrPotli খুলুন')), (f'{root}AmrPotli/?install', bi('📲 Install', '📲 ইনস্টল')), (f'{root}features.html', bi('All features', 'সব ফিচার'))])}
      {col(bi('Guides', 'গাইড'), [(f'{root}guides/start.html', bi('Get started', 'শুরু করুন')), (f'{root}guides/', bi('Guide for you', 'আপনার গাইড')), (f'{root}guides/how-to.html', bi('How to…', 'কীভাবে করবেন')), (f'{root}faq.html', bi('Questions', 'প্রশ্নোত্তর'))])}
      {col(bi('AmrPotli', 'AmrPotli'), [(f'{root}about.html', bi('About us', 'আমাদের কথা')), (feedback, bi('Send feedback', 'মতামত পাঠান')), (f'{root}AmrPotli/privacy.html', bi('Privacy', 'প্রাইভেসি')), (f'{root}AmrPotli/terms.html', bi('Terms of use', 'ব্যবহারের শর্তাবলি'))])}
    </div>
    <div class="foot-base">
      <span>© 2026 vgfintrack · AmrPotli</span>
      <a href="mailto:vgfintrack@gmail.com">vgfintrack@gmail.com</a>
    </div>
  </div>
</footer>
<script src="{root}assets/site.js"></script>
</body>
</html>
'''


def build():
    urls = []
    for src in sorted(PAGES.rglob('*.html')):
        text = src.read_text(encoding='utf-8')
        m = re.match(r'\s*<!--(\{.*?\})-->\s*', text, re.S)
        if not m:
            raise SystemExit(f'{src}: missing settings comment')
        meta = json.loads(m.group(1))
        body = text[m.end():]
        depth = meta['out'].count('/')
        root = meta.get('root', '../' * depth)  # 404.html is served at any depth: it uses "/"
        out = ROOT / meta['out']
        out.parent.mkdir(parents=True, exist_ok=True)
        page = head(meta, root) + nav(meta, root) + expand(body, root) + foot(root)
        leftover = re.findall(r'\[\[|\]\]|\{\{root\}\}', page)
        if leftover:
            raise SystemExit(f'{src}: unexpanded shortcut')
        out.write_text(page, encoding='utf-8')
        if meta['out'] != '404.html':
            urls.append(SITE + meta['out'].replace('index.html', ''))
        print('wrote', meta['out'])
    (ROOT / 'sitemap.xml').write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + ''.join(f'  <url><loc>{u}</loc></url>\n' for u in urls + [SITE + 'AmrPotli/privacy.html', SITE + 'AmrPotli/terms.html'])
        + '</urlset>\n',
        encoding='utf-8',
    )
    print('wrote sitemap.xml')


if __name__ == '__main__':
    build()
