// Navigation: five places. A rail on the left on laptops (opens on hover to show names and sub-pages),
// a bar at the bottom on phones, and a row of tabs above the page for places that hold more than one page.
import { html, icon } from './core.js';
import { t } from './i18n.js';
import { isAdmin } from './auth.js';

/** `routes[0]` is where the place opens. */
export const GROUPS = [
  { id: 'home', icon: 'overview', routes: ['overview'] },
  { id: 'analyse', icon: 'diagnosis', routes: ['diagnosis', 'signals', 'competitors', 'proof'], order: ['signals', 'diagnosis', 'competitors', 'proof'] },
  { id: 'site', icon: 'website', routes: ['website'] },
  { id: 'studio', icon: 'pack', routes: ['pack', 'mission'], order: ['mission', 'pack'] },
  { id: 'account', icon: 'account', routes: ['account', 'plans', 'settings', 'info', 'admin'] },
];
export const groupIndex = (route) => Math.max(0, GROUPS.findIndex((g) => g.routes.includes(route)));
const pages = (g) => (g.order || g.routes).filter((r) => r !== 'admin' || isAdmin());
const label = (r) => t(r === 'mission' ? 'tab.mission' : `nav.${r}`);

export function rail(route) {
  const cur = groupIndex(route);
  return html`<a class="rail-logo" href="#/overview" aria-label="Arcton Ai"><img src="/icons/logo.svg" alt="" width="40" height="40"><strong>Arcton Ai</strong></a>
    <ul class="rail-list" style="--i:${cur}"><li class="rail-ind" aria-hidden="true"></li>${GROUPS.map((g, i) => html`<li>
      <a class="rail-a ${i === cur ? 'is-cur' : ''}" href="#/${g.routes[0]}" ${i === cur && pages(g).length === 1 ? 'aria-current="page"' : ''}>${icon(g.icon, 22)}<span>${t(`tab.${g.id}`)}</span></a>
      ${pages(g).length > 1 ? html`<ul class="rail-sub">${pages(g).map((r) => html`<li><a href="#/${r}" class="${r === route ? 'is-cur' : ''}" ${r === route ? 'aria-current="page"' : ''}>${label(r)}</a></li>`)}</ul>` : ''}</li>`)}</ul>`;
}

export function tabbar(route) {
  const cur = groupIndex(route);
  return html`<span class="tab-ind" aria-hidden="true"></span>${GROUPS.map((g, i) => html`<a class="tab-a ${i === cur ? 'is-cur' : ''}" href="#/${g.routes[0]}" ${i === cur ? 'aria-current="page"' : ''}>${icon(g.icon, 22)}<span>${t(`tab.${g.id}`)}</span></a>`)}`;
}

/** Tabs above the page, only where the place has more than one page. */
export function subtabs(route) {
  const g = GROUPS[groupIndex(route)]; const list = pages(g);
  if (list.length < 2) return html``;
  return html`<nav class="subtabs" aria-label="${t(`tab.${g.id}`)}"><div class="subtabs-in">${list.map((r) => html`<a href="#/${r}" class="${r === route ? 'is-cur' : ''}" ${r === route ? 'aria-current="page"' : ''}>${label(r)}</a>`)}</div></nav>`;
}
