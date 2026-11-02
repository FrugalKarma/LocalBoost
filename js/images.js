// Photos for the website: pick, resize in the browser (fast uploads, small pages), upload to the account.
// Without accounts the photo stays inside the site as a data URL (preview and download only).
import { authOn, signedIn, api } from './auth.js';

const LIMITS = { logo: 600, hero: 1800, about: 1400, gallery: 1400, seo: 1200 };

/** Opens the file picker. Resolves with File[] (may be empty). */
export function pickFiles({ multiple = false } = {}) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/jpeg,image/png,image/webp'; inp.multiple = multiple;
    inp.onchange = () => resolve([...(inp.files || [])].slice(0, 12));
    inp.addEventListener('cancel', () => resolve([])); // closing the picker must not leave the button busy
    inp.click();
  });
}

/** Resizes to fit `kind` and returns a data URL (JPEG; PNG for logos to keep transparency). */
export async function resize(file, kind = 'gallery') {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('type');
  if (file.size > 25_000_000) throw new Error('size');
  const bmp = await createImageBitmap(file);
  const max = LIMITS[kind] || 1400; const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d'); g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  const png = kind === 'logo' && file.type === 'image/png';
  let q = 0.84; let url = c.toDataURL(png ? 'image/png' : 'image/jpeg', q);
  while (!png && url.length > 900_000 && q > 0.5) { q -= 0.1; url = c.toDataURL('image/jpeg', q); }
  return url;
}

/** Stores the photo: uploaded to the account when possible. Returns { url } or { error }. */
export async function storeImage(dataUrl) {
  if (!authOn() || !signedIn()) return dataUrl.length < 400_000 ? { url: dataUrl, local: true } : { error: 'too_big_local' };
  const r = await api('/api/site', { method: 'POST', body: { op: 'upload', data: dataUrl } });
  return r.status === 200 ? { url: r.body.url } : { error: r.body?.error || 'upload_failed' };
}

/** pick → resize → store, for one or many photos. Returns [{ url }] and the number that failed. */
export async function addPhotos(kind, { multiple = false, onProgress } = {}) {
  const files = await pickFiles({ multiple });
  const done = []; let failed = 0;
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, files.length);
    try { const r = await storeImage(await resize(files[i], kind)); if (r.url) done.push({ url: r.url, name: files[i].name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').slice(0, 80) }); else failed++; }
    catch { failed++; }
  }
  return { photos: done, failed };
}
