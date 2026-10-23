// A fake Google for the browser tests: sign-in (GIS), Drive with owners and
// sharing, and the file picker. Each person is a "uid"; their email is
// <uid>@gmail.com. Nothing leaves the test browser.

export function fakeDrive() {
  const files = {}; // id -> { name, parents, owner, content, perms: [{ id, email }], description }
  let next = 1;
  const mails = []; // sharing emails Google would send
  const can = (f, uid) => f && (f.owner === uid || f.perms.some((p) => p.email === `${uid}@gmail.com`));
  async function handle(route) {
    const req = route.request();
    const uid = (req.headers()['authorization'] || '').replace('Bearer ', '');
    const url = new URL(req.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const notFound = () => json({ error: { code: 404, message: 'File not found' } }, 404);
    let m;
    if (url.pathname === '/oauth2/v3/userinfo') return json({ sub: uid, email: `${uid}@gmail.com`, name: uid[0].toUpperCase() + uid.slice(1) });
    if (url.pathname === '/drive/v3/files' && req.method() === 'GET') {
      if (url.searchParams.get('spaces') !== 'appDataFolder') return json({ error: 'wrong space' }, 400);
      const q = url.searchParams.get('q') || '';
      const names = [...q.matchAll(/name='([^']+)'/g)].map((x) => x[1]);
      const contains = [...q.matchAll(/name contains '([^']+)'/g)].map((x) => x[1]);
      const list = Object.entries(files)
        .filter(([, f]) => f.owner === uid && f.parents.includes('appDataFolder'))
        .filter(([, f]) => (!names.length || names.includes(f.name)) && (!contains.length || contains.some((c) => f.name.includes(c))))
        .map(([id, f]) => ({ id, name: f.name, createdTime: f.created }));
      return json({ files: list });
    }
    if ((m = url.pathname.match(/^\/drive\/v3\/files\/(\w+)\/permissions$/)) && req.method() === 'POST') {
      const f = files[m[1]];
      if (!f || f.owner !== uid) return notFound();
      const body = JSON.parse(req.postData());
      const id = 'p' + next++;
      f.perms.push({ id, email: body.emailAddress, role: body.role });
      mails.push({ to: body.emailAddress, from: uid, message: url.searchParams.get('emailMessage') || '' });
      return json({ id });
    }
    if ((m = url.pathname.match(/^\/drive\/v3\/files\/(\w+)\/permissions\/(\w+)$/)) && req.method() === 'DELETE') {
      const f = files[m[1]];
      if (!f || f.owner !== uid) return notFound();
      f.perms = f.perms.filter((p) => p.id !== m[2]);
      return route.fulfill({ status: 204, body: '' });
    }
    if ((m = url.pathname.match(/^\/drive\/v3\/files\/(\w+)$/))) {
      const f = files[m[1]];
      if (!can(f, uid)) return notFound();
      if (req.method() === 'DELETE') {
        if (f.owner !== uid) return json({ error: 'not owner' }, 403);
        delete files[m[1]];
        return route.fulfill({ status: 204, body: '' });
      }
      if (url.searchParams.get('alt') === 'media') return route.fulfill({ contentType: 'application/json', body: f.content });
      return json({ id: m[1], name: f.name, owners: [{ displayName: f.owner[0].toUpperCase() + f.owner.slice(1), emailAddress: `${f.owner}@gmail.com` }], capabilities: { canEdit: true } });
    }
    if (url.pathname === '/upload/drive/v3/files' && req.method() === 'POST') {
      const body = req.postData();
      const parts = body.split(/--mt\w+/).filter((p) => p.includes('Content-Type'));
      const meta = JSON.parse(parts[0].split('\r\n\r\n')[1]);
      const id = 'f' + next++;
      files[id] = { name: meta.name, parents: meta.parents || ['root'], owner: uid, content: parts[1].split('\r\n\r\n').slice(1).join('\r\n\r\n').trim(), perms: [], description: meta.description || '', created: new Date().toISOString() };
      return json({ id });
    }
    if ((m = url.pathname.match(/^\/upload\/drive\/v3\/files\/(\w+)$/)) && req.method() === 'PATCH') {
      const f = files[m[1]];
      if (!can(f, uid)) return notFound();
      f.content = req.postData();
      return json({ id: m[1] });
    }
    return json({ error: 'unhandled ' + req.method() + ' ' + url.pathname }, 500);
  }
  return { files, mails, handle, doc: (id) => JSON.parse(files[id].content) };
}

// Sign-in: window.__mockUser is who signs in; window.__scopes lists what was asked.
export const FAKE_GIS = `window.google = Object.assign(window.google || {}, { accounts: { oauth2: {
  initTokenClient(cfg) { return { requestAccessToken(o = {}) {
    const scope = o.scope || cfg.scope; (window.__scopes ||= []).push(scope);
    setTimeout(() => cfg.callback({ access_token: window.__mockUser, expires_in: 3600, scope }), 10); } }; },
  hasGrantedAllScopes: (resp, ...s) => s.every((x) => resp.scope.includes(x)), revoke() {} } } });`;

// The file picker: picks window.__pick (a file id), or is closed if none.
export const FAKE_PICKER = `window.gapi = { load: (name, cb) => cb() };
window.google = window.google || {};
(() => {
  class Chain { constructor() { for (const k of ['setMimeTypes', 'setOwnedByMe', 'setQuery', 'addView', 'setOAuthToken', 'setDeveloperKey', 'setAppId', 'setTitle', 'setLocale']) this[k] = (v) => { this['_' + k] = v; return this; }; } }
  class PickerBuilder extends Chain {
    setCallback(cb) { this.cb = cb; return this; }
    build() { const b = this; return { setVisible() { window.__pickerAsked = { key: b._setDeveloperKey, app: b._setAppId, token: b._setOAuthToken };
      setTimeout(() => b.cb(window.__pick ? { action: 'picked', docs: [{ id: window.__pick }] } : { action: 'cancel' }), 30); } }; }
  }
  window.google.picker = { ViewId: { DOCS: 'docs' }, Action: { PICKED: 'picked', CANCEL: 'cancel' }, DocsView: Chain, PickerBuilder };
})();`;

// A phone signed in as `uid`, with the fakes above. Returns { ctx, p }.
export async function phone(browser, uid, drive, { lang = 'en', scale = 1 } = {}) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: scale });
  await ctx.addInitScript(([u, l]) => {
    window.__mockUser = u;
    if (!sessionStorage.x) { localStorage.setItem('mt:lang', l); sessionStorage.x = 1; }
  }, [uid, lang]);
  await ctx.route('**/AmrPotli/js/config.js', async (r) => {
    // the real config, with a test client id
    const real = await (await r.fetch()).text();
    r.fulfill({ contentType: 'text/javascript', body: real.replace(/googleClientId = '[^']*'/, "googleClientId = 'test.apps.googleusercontent.com'") });
  });
  await ctx.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_GIS }));
  await ctx.route('https://apis.google.com/js/api.js', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_PICKER }));
  await ctx.route('https://www.googleapis.com/**', (r) => drive.handle(r));
  await ctx.route('https://firestore.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  p.on('dialog', (d) => d.accept());
  return { ctx, p };
}
