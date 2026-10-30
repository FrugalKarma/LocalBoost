import en from './locales/en.js';
import ro from './locales/ro.js';
import fr from './locales/fr.js';
import de from './locales/de.js';
import hu from './locales/hu.js';

export const LANGS = [
  { code: 'ro', label: 'RO', name: 'Română', locale: 'ro-RO' },
  { code: 'en', label: 'EN', name: 'English', locale: 'en-GB' },
  { code: 'fr', label: 'FR', name: 'Français', locale: 'fr-FR' },
  { code: 'de', label: 'DE', name: 'Deutsch', locale: 'de-DE' },
  { code: 'hu', label: 'HU', name: 'Magyar', locale: 'hu-HU' },
];

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

export const dictionaries = { en: flatten(en), ro: flatten(ro), fr: flatten(fr), de: flatten(de), hu: flatten(hu) };
const STORAGE_KEY = 'localboost.lang';
const listeners = new Set();
let current = 'en';

function detect() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && dictionaries[saved]) return saved;
  } catch { /* storage unavailable */ }
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  const first = dictionaries[nav] ? nav : 'en';
  try { localStorage.setItem(STORAGE_KEY, first); } catch { /* ignore */ }
  return first;
}

export function initLang() {
  current = detect();
  document.documentElement.lang = current;
  return current;
}

export const getLang = () => current;
export const getLocale = () => LANGS.find((l) => l.code === current)?.locale || 'en-GB';

export function setLang(code) {
  if (!dictionaries[code]) return;
  current = code;
  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
  document.documentElement.lang = code;
  listeners.forEach((fn) => fn(code));
}

export const onLang = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

function interpolate(s, vars) {
  if (typeof s !== 'string' || !vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
}

/** Translate a key in the current language (English fallback, then the key itself). */
export function t(key, vars) {
  return tIn(current, key, vars);
}

/** Translate a key in an explicit language. */
export function tIn(lang, key, vars) {
  const v = dictionaries[lang]?.[key] ?? dictionaries.en[key];
  if (v === undefined) {
    (window.__missingKeys ||= new Set()).add(key); // QA hook: lists untranslated keys
    return key;
  }
  return interpolate(v, vars);
}

/** Array-valued keys (copy variants). */
export function ta(key, lang = current) {
  const v = dictionaries[lang]?.[key] ?? dictionaries.en[key];
  return Array.isArray(v) ? v : [];
}

export const fmtNumber = (n, opts) => new Intl.NumberFormat(getLocale(), opts).format(n);
export const fmtDate = (d, opts = { dateStyle: 'medium', timeStyle: 'short' }) =>
  new Intl.DateTimeFormat(getLocale(), opts).format(new Date(d));
