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
  profile: { name: 'Ana Demo' },
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults(), ...JSON.parse(raw) };
  } catch { /* corrupt or unavailable storage: start clean */ }
  return defaults();
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota or private mode */ }
}

export const getState = () => state;

export function update(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  persist();
  return state;
}

export function updateSite(patch) {
  return update((s) => ({ site: { ...s.site, ...patch } }));
}

export function resetAll() {
  state = defaults();
  persist();
  return state;
}

export function replaceState(next) {
  state = { ...defaults(), ...next };
  persist();
}
