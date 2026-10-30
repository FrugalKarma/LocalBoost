// Name Scout: handle and business-name ideas. AI first (role "namer"), deterministic local ideas as fallback.
import { t, ta, getLang } from './i18n.js';
import { getBiz, cleanHandle } from './business.js';
import { slug } from './core.js';

const uniq = (arr) => [...new Set(arr)];

export function localHandles() {
  const b = getBiz();
  const city = slug(b.city.split(',')[0]).replace(/-/g, '');
  const word = slug(ta(`names.words.${b.category}`)[0] || t(`biz.cat.${b.category}`)).replace(/-/g, '');
  const base = b.name ? slug(b.name).replace(/-/g, '') : '';
  const list = base
    ? [base, `${base}.${city}`, `${base}_official`, `the${base}`, `${base}.${word}`, `${base}${city}`, `${base}.hq`]
    : [`${word}.${city}`, `${city}.${word}`, `${word}_${city}`, `the${word}${city}`, `${word}${city}`, `${city}${word}.official`];
  return uniq(list.map(cleanHandle).filter((h) => h.length >= 3)).slice(0, 6);
}

export function localBrandNames() {
  const b = getBiz();
  const city = b.city.split(',')[0].trim();
  const words = ta(`names.words.${b.category}`);
  const suffix = ta('names.suffix');
  const out = [];
  words.forEach((w, i) => { out.push(`${w} ${city}`); out.push(`${city} ${suffix[i % suffix.length]}`); });
  out.push(`${suffix[0]} & ${words[0]}`);
  return uniq(out).slice(0, 6);
}

export function localNames() {
  return { handles: localHandles(), names: getBiz().noName ? localBrandNames() : [], lang: getLang() };
}
