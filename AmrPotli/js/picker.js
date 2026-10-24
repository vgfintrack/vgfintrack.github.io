// Google's file picker, for a helper to choose the shop book the owner shared.
// Loaded only then. Picking a file is what lets FinnBlu open it (drive.file).

import * as config from './config.js';
import { t, lang } from './i18n.js';

function script(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error(t('Could not load Google sign-in. Check your internet connection.')));
    document.head.appendChild(s);
  });
}

// Resolves to the chosen file's id, or null if the picker was closed.
export async function pickShopBook(token) {
  if (!config.pickerKey) throw new Error(t('Team shops are not set up on this copy of FinnBlu.'));
  await script('https://apis.google.com/js/api.js');
  await new Promise((resolve) => gapi.load('picker', resolve));
  const P = google.picker;
  return new Promise((resolve) => {
    // "FinnBlu shop book", or "AmrPotli shop book" from before the new name.
    const shared = new P.DocsView(P.ViewId.DOCS).setMimeTypes('application/json').setOwnedByMe(false).setQuery('shop book');
    const picker = new P.PickerBuilder()
      .addView(shared)
      .setOAuthToken(token)
      .setDeveloperKey(config.pickerKey)
      .setAppId(config.googleProjectNumber)
      .setTitle(t('Choose the shop book'))
      .setLocale(lang === 'bn' ? 'bn' : 'en')
      .setCallback((d) => {
        if (d.action === P.Action.PICKED) resolve(d.docs?.[0]?.id || null);
        else if (d.action === P.Action.CANCEL) resolve(null);
      })
      .build();
    picker.setVisible(true);
  });
}
