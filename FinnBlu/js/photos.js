// Receipt photos. A photo is made small on the phone (about 100–200 KB), kept
// in this browser (IndexedDB) and, when signed in, uploaded to the same
// private Google Drive folder as the rest of the data. A transaction keeps
// only the photo's id ({ receipt: id }). Loaded only when a photo is added or
// opened, so the app does not get slower for anyone else.

const DB = 'amrpotli-photos';
const STORE = 'photos';
// About 1.6 million pixels: a phone photo becomes ~1460×1100, and a long
// shop receipt stays wide enough to read (it is not squeezed to fit a side).
const MAX_PIXELS = 1_600_000;
const MAX_SIDE = 4000;
const QUALITY = 0.72;

let dbp = null;
function db() {
  dbp ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function run(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

const key = (uid, id) => `${uid}:${id}`;

// { blob, pending, at } — pending means "not in Drive yet".
export const getLocal = (uid, id) => run('readonly', (s) => s.get(key(uid, id)));
export const putLocal = (uid, id, blob, pending) => run('readwrite', (s) => s.put({ blob, pending, at: Date.now() }, key(uid, id)));
export const removeLocal = (uid, id) => run('readwrite', (s) => s.delete(key(uid, id)));
const mine = (uid) => IDBKeyRange.bound(`${uid}:`, `${uid}:\uffff`);

// [{ id, pending, at }] for one user, without the pictures.
export async function list(uid) {
  const out = [];
  await run('readonly', (s) => {
    const req = s.openCursor(mine(uid));
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return;
      out.push({ id: c.key.slice(uid.length + 1), pending: c.value.pending, at: c.value.at || 0 });
      c.continue();
    };
    return req;
  });
  return out;
}

export async function clearUser(uid) {
  await run('readwrite', (s) => s.delete(mine(uid)));
}

// Camera photos are several MB; a receipt only needs to be readable.
export async function shrink(file) {
  if (!/^image\//.test(file.type)) throw new Error('not-image');
  let img;
  try {
    img = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('not-image'));
      el.src = URL.createObjectURL(file);
    });
  }
  const w = img.width || img.naturalWidth;
  const h = img.height || img.naturalHeight;
  const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (w * h)), MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // transparent screenshots stay readable
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('not-image');
  return blob;
}
