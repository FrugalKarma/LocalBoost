// Persistent user state: everything here is the owner's real business data (saved to their account when signed in).
const KEY = 'localboost.state.v1';

export const defaultSite = () => ({
  v: 2,
  generated: false,
  design: { preset: null, palette: {}, fonts: null, radius: null, heroStyle: null, density: 'cozy' }, // null = the preset's choice
  sections: [], // ordered: hero, about, services, menu, gallery, offer, reviews, visit, faq, booking, contact
  booking: { askParty: null, askDate: true, askTime: true, askService: false, services: null, note: '' },
  announcement: { on: false, text: '' },
  seo: { title: '', description: '', image: '' },
  logo: '',
  branding: true,
  lang: null, // null = follow the app language
  ai: null,
});


const defaults = () => ({
  v: 2,
  business: { loaded: false }, // the owner's details, plus the Google listing they picked (business.place)
  competitors: { list: [], custom: [], fetchedAt: null }, // nearby places from Google + ones the owner added
  names: null, // Name Scout ideas (handles / business names)
  signals: { notes: [], google: null, site: null, themes: null, errors: {}, collectedAt: null },
  theme: null,
  diagnosis: null,
  mission: null, // includes the baseline numbers captured when the mission starts
  assets: null,
  site: defaultSite(), // website content + look; site.slug / site.publishedAt once it is online
  checkpoint: null,
  replies: null, // drafted replies to Google reviews, by review index
  chat: [], // "Ask Arcton" conversation (last 30 messages)
  profile: { name: '' },
});

/** Older saves (version 1) mixed in sample data: keep the owner's own details and start the journey clean. */
function migrate(raw) {
  if (!raw || typeof raw !== 'object') return defaults();
  if (raw.v === 2) return { ...defaults(), ...raw };
  const keep = defaults();
  const b = raw.business || {};
  const isSample = b.name === 'Cafeneaua Copou';
  if (b.loaded && !isSample) keep.business = { ...b };
  if (raw.profile?.name && raw.profile.name !== 'Ana Demo') keep.profile = { name: raw.profile.name };
  if (Array.isArray(raw.userSignals)) keep.signals.notes = raw.userSignals.slice(0, 200).map((x) => ({ id: x.id, kind: 'review', source: x.source || 'CSV', text: x.evidence || '', at: Date.now() })).filter((x) => x.text);
  if (Array.isArray(raw.chat)) keep.chat = raw.chat;
  return keep;
}


let state = load();
let shadow = null; // admin looking at a client: the admin's own state waits here and nothing is written to this browser
const listeners = new Set();
/** fn(state, { remote }) runs after every change. remote = the change came from the server (do not send it back). */
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = (meta = {}) => listeners.forEach((fn) => { try { fn(state, meta); } catch (e) { console.error(e); } });

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
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
  state = migrate(next);
  persist(); notify({ remote });
}

/** Admin opens a client: show their data in memory only. exitShadow() brings the admin's own state back. */
export function enterShadow(data) {
  if (!shadow) shadow = state;
  state = { ...migrate(data), theme: shadow.theme };
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
  const { theme, aiSim, ...rest } = s; // eslint-disable-line no-unused-vars
  return rest;
}
