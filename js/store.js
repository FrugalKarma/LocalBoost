// Persistent user state. Demo data lives in data.js and is never mixed into this store.
const KEY = 'localboost.state.v1';

export const defaultSite = () => ({
  generated: false,
  theme: 'ocean',
  accent: '#F59E0B',
  font: 'lexend',
  radius: 'soft',
  layout: 'split',
  lang: null, // null = follow UI language
  showBooking: true,
  showReviews: true,
  showLocation: true,
  overrides: {},
  variants: { hero: 0, offer: 0, faq: 0 },
  ai: null,
});

const defaults = () => ({
  business: { loaded: false }, // nothing about any business is shown until the user loads one
  range: { preset: '8w', from: '', to: '' }, // period for the reach numbers
  competitors: { scanned: false, custom: [] },
  names: null, // Name Scout ideas (handles / business names)
  signalsCollected: false, // signals and numbers appear only after the user presses "Collect signals"
  theme: null,
  aiSim: 'off', // off | timeout | error
  userSignals: [],
  diagnosis: null,
  mission: null,
  assets: null,
  site: defaultSite(),
  bookings: [],
  checkpoint: null,
  chat: [], // "Ask LocalBoost" conversation (last 30 messages, this browser only)
  profile: { name: 'Ana Demo' },
});

let state = load();
let shadow = null; // admin looking at a client: the admin's own state waits here and nothing is written to this browser
const listeners = new Set();
/** fn(state, { remote }) runs after every change. remote = the change came from the server (do not send it back). */
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = (meta = {}) => listeners.forEach((fn) => { try { fn(state, meta); } catch (e) { console.error(e); } });

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults(), ...JSON.parse(raw) };
  } catch { /* corrupt or unavailable storage: start clean */ }
  return defaults();
}

function persist() {
  if (shadow) return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota or private mode */ }
}

export const getState = () => state;

export function update(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  persist(); notify();
  return state;
}

export function updateSite(patch) {
  return update((s) => ({ site: { ...s.site, ...patch } }));
}

export function resetAll({ remote = false } = {}) {
  state = defaults();
  persist(); notify({ remote });
  return state;
}

/** remote: true when `next` came from the server, so cloud sync does not send it straight back. */
export function replaceState(next, { remote = false } = {}) {
  state = { ...defaults(), ...next };
  persist(); notify({ remote });
}

/** Admin opens a client: show their data in memory only. exitShadow() brings the admin's own state back. */
export function enterShadow(data) {
  if (!shadow) shadow = state;
  state = { ...defaults(), ...data, aiSim: shadow.aiSim, theme: shadow.theme };
  notify({ remote: true });
}
export function exitShadow() {
  if (!shadow) return;
  state = shadow; shadow = null;
  notify({ remote: true });
}
export const inShadow = () => !!shadow;

/** What goes to the account in the cloud: everything except per-device switches. */
export function cloudData(s = state) {
  const { aiSim, theme, ...rest } = s; // eslint-disable-line no-unused-vars
  return rest;
}
