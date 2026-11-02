// Keeps the business saved to the signed-in account (or, for the admin, to the client being viewed).
// Every change is saved about a second later. If someone else saved in between (the owner and the admin
// at the same time), the newer copy wins and is shown, so nothing is silently overwritten.
import { getState, subscribe, replaceState, resetAll, cloudData, enterShadow, exitShadow, inShadow } from './store.js';
import { api, signedIn, userId, onAuthChange } from './auth.js';

const OKEY = 'localboost.owner'; // which account the data in this browser belongs to
const owner = () => { try { return localStorage.getItem(OKEY) || ''; } catch { return ''; } };
export const localOwner = owner;
const setOwner = (id) => { try { if (id) localStorage.setItem(OKEY, id); else localStorage.removeItem(OKEY); } catch { /* blocked */ } };

let target = null; // { kind: 'own' } | { kind: 'client', id, email }
let version = 0;
let timer = null; let saving = null; let dirty = false;
let status = 'idle'; // idle | saving | saved | offline | error
let savedAt = null;
const watchers = new Set();
export const onCloud = (fn) => watchers.add(fn);
const emit = (extra = {}) => watchers.forEach((fn) => fn({ status, savedAt, ...extra }));
export const cloudStatus = () => ({ status, savedAt });
export const viewingClient = () => (target?.kind === 'client' ? target : null);

const keepLocal = (data) => { const cur = getState(); return { ...data, aiSim: cur.aiSim, theme: cur.theme }; };

subscribe((_s, meta) => {
  if (meta.remote || !target || !signedIn()) return;
  dirty = true; schedule(1200);
});
function schedule(ms) { clearTimeout(timer); timer = setTimeout(flush, ms); }

/** Sends pending changes now. */
export async function flush() {
  clearTimeout(timer);
  if (!dirty || !target) return;
  if (saving) { await saving; return flush(); }
  saving = (async () => {
    dirty = false; status = 'saving'; emit();
    const t = target; const data = cloudData();
    const r = t.kind === 'own'
      ? await api('/api/data', { method: 'PUT', body: { data, version } })
      : await api('/api/admin', { method: 'POST', body: { op: 'save', id: t.id, data, version } });
    if (t !== target) return; // switched account or client meanwhile
    if (r.status === 200) { version = r.body.version; status = 'saved'; savedAt = Date.now(); emit(); return; }
    if (r.status === 409) { // someone else saved first: show their copy
      version = r.body.version || 0;
      if (r.body.data) { applyRemote(r.body.data); emit({ conflict: true }); status = 'saved'; emit(); }
      else { dirty = true; schedule(50); } // row vanished: create it again
      return;
    }
    dirty = true;
    status = r.status === 0 || r.status >= 500 ? 'offline' : 'error'; emit({ code: r.body.error });
    if (r.status === 0 || r.status >= 500) schedule(15000);
  })().finally(() => { saving = null; });
  return saving;
}

function applyRemote(data) {
  if (target?.kind === 'client') enterShadow(data);
  else replaceState(keepLocal(data), { remote: true });
}

/**
 * After sign-in: load the account's business. If the account has nothing yet, keep what this browser has
 * only when it was made before accounts existed (no owner), so a shared computer never mixes two people's data.
 * Returns 'ok' | 'offline' | 'error'.
 */
export async function loadOwn() {
  target = { kind: 'own' }; version = 0;
  const me = userId();
  const r = await api('/api/data');
  if (r.status === 0 || r.status >= 500) { status = 'offline'; emit(); return owner() === me ? 'offline' : 'error'; }
  if (r.status !== 200) return 'error';
  version = r.body.version || 0;
  if (r.body.data) replaceState(keepLocal(r.body.data), { remote: true });
  else if (owner() && owner() !== me) resetAll({ remote: true });
  else if (getState().business.loaded) { dirty = true; } // first sign-in on this browser: bring the existing work along
  setOwner(me);
  status = 'saved'; savedAt = Date.now(); emit();
  if (dirty) await flush();
  return 'ok';
}

/** Admin: open a client's business (in memory only; the admin's own data is untouched). */
export async function openClient(id) {
  await flush();
  const r = await api(`/api/admin?op=client&id=${encodeURIComponent(id)}`);
  if (r.status !== 200) return r.body.error || 'error';
  target = { kind: 'client', id, email: r.body.client.email, disabled: r.body.client.disabled };
  version = r.body.version || 0;
  enterShadow(r.body.data || {});
  status = 'saved'; savedAt = r.body.updated_at ? Date.parse(r.body.updated_at) : null; emit();
  return 'ok';
}
/** Admin: back to their own workspace. */
export async function closeClient() {
  if (target?.kind !== 'client') return;
  await flush();
  exitShadow();
  target = { kind: 'own' };
  await loadOwn();
}

/** Signing out wipes this browser's copy, so the next person on this device starts clean. */
onAuthChange((s, reason) => {
  if (s) return;
  clearTimeout(timer); dirty = false;
  if (inShadow()) exitShadow();
  target = null; version = 0; status = 'idle'; setOwner('');
  if (reason !== 'refresh') resetAll({ remote: true });
});

// Last chance to save when the tab is hidden or closed.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
window.addEventListener('online', () => { if (dirty) flush(); });
