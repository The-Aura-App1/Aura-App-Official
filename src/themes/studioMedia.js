// Images, GIFs and videos picked as a Theme Studio backdrop. They stay on
// this device (IndexedDB), are never uploaded, and only the person sees them;
// a design saved to the account keeps just the id, so another device shows
// the plain glow until the picture is added there too.

export const MEDIA_TYPES = {
  image: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'],
  video: ['video/mp4', 'video/webm'],
};
export const MEDIA_MAX_BYTES = { image: 15 * 1024 * 1024, video: 60 * 1024 * 1024 };
const KEEP = 12;   // older backdrops are cleared once there are more than this

const DB = 'aura-studio';
const STORE = 'media';

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('This browser can\'t keep pictures for themes.')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Storage is blocked.'));
  });
}

function run(mode, work) {
  return open().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const result = work(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(result?.result ?? result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}

// What kind a file is, or an error to show
export function checkMedia(file) {
  const kind = Object.keys(MEDIA_TYPES).find(k => MEDIA_TYPES[k].includes(file?.type));
  if (!kind) return { error: 'Pick a picture (PNG, JPG, WebP, GIF or AVIF) or a video (MP4 or WebM).' };
  if (file.size > MEDIA_MAX_BYTES[kind]) return { error: `That ${kind} is too big. Keep it under ${MEDIA_MAX_BYTES[kind] / 1024 / 1024} MB.` };
  return { kind };
}

// → { id, kind } or throws
export async function saveMedia(file) {
  const { kind, error } = checkMedia(file);
  if (error) throw new Error(error);
  const id = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await run('readwrite', store => store.put({ id, kind, blob: file, type: file.type, savedAt: Date.now() }));
  // keep the newest few
  const all = await run('readonly', store => store.getAll());
  const old = (all ?? []).sort((a, b) => b.savedAt - a.savedAt).slice(KEEP);
  if (old.length) await run('readwrite', store => old.forEach(m => store.delete(m.id)));
  return { id, kind };
}

const urls = new Map();
// An object URL for a saved backdrop, or null when it isn't on this device
export async function mediaUrl(id) {
  if (!id) return null;
  if (urls.has(id)) return urls.get(id);
  try {
    const item = await run('readonly', store => store.get(id));
    if (!item?.blob) return null;
    const url = URL.createObjectURL(item.blob);
    urls.set(id, url);
    return url;
  } catch {
    return null;
  }
}
