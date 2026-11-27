// Custom domains for Custom Premium sites: the client points their domain at us, the app adds it to the Vercel
// project (VERCEL_TOKEN + VERCEL_PROJECT_ID, optional VERCEL_TEAM_ID) and checks when it works.
// Without the Vercel variables the domain is still saved and the team adds it by hand (Vercel → Settings → Domains).
import { promises as dns } from 'node:dns';

export const DOMAIN = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
// our own hosts never belong to a client (also in middleware.js)
export const OWN_HOST = /^((www\.)?arcton\.site|.+\.vercel\.app|localhost|\d{1,3}(\.\d{1,3}){3}|\[[0-9a-f:]+\])(:\d+)?$/i;
const IP = '76.76.21.21'; const CNAME = 'cname.vercel-dns.com'; // Vercel's documented defaults; its API may recommend others

/** "https://www.Cafe.ro/" → "cafe.ro"; '' when it is not a domain a client may use. */
export function cleanDomain(v) {
  const d = String(v || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '').replace(/\.$/, '').replace(/^www\./, '');
  return DOMAIN.test(d) && !OWN_HOST.test(d) ? d : '';
}
/** The request's host without port and www., for finding a site by its domain. */
export const hostOf = (headers = {}) => String(headers['x-forwarded-host'] || headers.host || '').split(',')[0].trim().toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '');

const TOKEN = () => (process.env.VERCEL_TOKEN || '').trim();
const PROJECT = () => (process.env.VERCEL_PROJECT_ID || '').trim();
export const vercelOn = () => !!(TOKEN() && PROJECT());
async function v(path, { method = 'GET', body } = {}) {
  const team = (process.env.VERCEL_TEAM_ID || '').trim();
  const url = `https://api.vercel.com${path}${team ? `${path.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(team)}` : ''}`;
  try {
    const r = await fetch(url, { method, headers: { authorization: `Bearer ${TOKEN()}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
    return { ok: r.ok, status: r.status, json: await r.json().catch(() => ({})) };
  } catch { return { ok: false, status: 0, json: {} }; }
}

/** Adds the domain and www. (which redirects to it) to the project. Returns { ok, error? }. */
export async function addDomain(d) {
  if (!vercelOn()) return { ok: false, error: 'manual' };
  const p = encodeURIComponent(PROJECT());
  const a = await v(`/v10/projects/${p}/domains`, { method: 'POST', body: { name: d } });
  if (!a.ok && a.status !== 409) return { ok: false, error: a.json?.error?.code || 'vercel_failed' }; // 409: already on this project
  await v(`/v10/projects/${p}/domains`, { method: 'POST', body: { name: `www.${d}`, redirect: d, redirectStatusCode: 308 } });
  return { ok: true };
}
export async function removeDomain(d) {
  if (!vercelOn()) return;
  const p = encodeURIComponent(PROJECT());
  await Promise.all([v(`/v9/projects/${p}/domains/${d}`, { method: 'DELETE' }), v(`/v9/projects/${p}/domains/www.${d}`, { method: 'DELETE' })]);
}

/** What the client must set at their registrar, and whether it already works. */
export async function domainStatus(d) {
  let ip = IP; let cname = CNAME; let verified = null; const extra = [];
  if (vercelOn()) {
    const p = encodeURIComponent(PROJECT());
    const [pd, c, cw] = await Promise.all([v(`/v9/projects/${p}/domains/${d}`), v(`/v6/domains/${d}/config`), v(`/v6/domains/www.${d}/config`)]);
    ip = c.json?.recommendedIPv4?.find((x) => x.rank === 1)?.value?.[0] || ip;
    cname = String(cw.json?.recommendedCNAME?.find((x) => x.rank === 1)?.value || cname).replace(/\.$/, '');
    if (pd.ok) verified = !!pd.json?.verified;
    for (const x of pd.json?.verification || []) extra.push({ type: x.type, name: String(x.domain || '').replace(new RegExp(`\\.?${d.replace(/\./g, '\\.')}$`), '') || '@', value: x.value }); // domain used on another Vercel account: prove it is theirs
  }
  const [a, w] = await Promise.all([dns.resolve4(d).catch(() => []), dns.resolveCname(`www.${d}`).catch(() => [])]);
  const apexOk = a.includes(ip); const wwwOk = w.some((x) => x.replace(/\.$/, '') === cname);
  return {
    domain: d, auto: vercelOn(), verified, apexOk, wwwOk, live: apexOk && verified !== false,
    records: [{ type: 'A', name: '@', value: ip, ok: apexOk }, { type: 'CNAME', name: 'www', value: cname, ok: wwwOk }, ...extra.map((x) => ({ ...x, ok: verified === true }))],
  };
}
