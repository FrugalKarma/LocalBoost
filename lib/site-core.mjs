// Hosted websites: publish a business site at /s/<slug>, take booking requests from it and count visits.
// Shared by server.mjs and api/site.js. Needs accounts (Supabase); without them publishing answers 503
// and the owner can still download the site, whose form then falls back to WhatsApp or email.
import { createHash } from 'node:crypto';
import { authEnabled, requireUser, rest } from './auth-core.mjs';
import { normalizeDoc, buildDocument, SITE_JS } from '../js/siteTemplate.js';

const out = (status, body, headers) => ({ status, body, headers });
const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED = new Set(['api', 'app', 'admin', 'www', 'login', 'signin', 'help', 'support', 'localboost', 'static', 'assets']);
const S = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n) : '');
const SCRIPT_HASH = `'sha256-${createHash('sha256').update(SITE_JS).digest('base64')}'`;
// The hosted page runs in a sandbox (its own opaque origin), so even a template bug could not reach the app's sign-in.
const pageCsp = (origin) => [
  "default-src 'none'", `script-src ${SCRIPT_HASH}`, "style-src 'unsafe-inline' https://fonts.googleapis.com", 'font-src https://fonts.gstatic.com',
  'img-src data: https:', 'frame-src https://www.openstreetmap.org', `connect-src ${origin}`, "form-action 'none'", "base-uri 'none'", "frame-ancestors 'none'",
  'sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation',
].join('; ');
export const PUBLIC_CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600' };

const hits = new Map();
function throttled(key, max, windowMs) {
  const now = Date.now(); const list = (hits.get(key) || []).filter((x) => now - x < windowMs);
  list.push(now); hits.set(key, list); if (hits.size > 20000) hits.clear();
  return list.length > max;
}
const today = () => new Date().toISOString().slice(0, 10);

async function siteBySlug(slug) {
  if (!SLUG.test(slug)) return null;
  const r = await rest(`sites?slug=eq.${slug}&published=is.true&select=owner,slug,doc`);
  return r.ok ? r.json?.[0] || null : undefined;
}
async function bump(owner, kind) {
  await rest('rpc/localboost_site_hit', { method: 'POST', body: { p_owner: owner, p_day: today(), p_kind: kind } });
}

const notFound = (msg) => out(404, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LocalBoost</title><body style="font-family:system-ui;padding:40px 20px;max-width:520px;margin:auto;color:#33121F"><h1>${msg}</h1><p><a href="/" style="color:#6E1A33">LocalBoost</a></p>`, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });

export async function handleSite({ method, query, body, headers, origin, ip }) {
  try {
    const q = method === 'GET' ? query : body || {};
    const op = q.op;

    /* ---------- public: the page itself ---------- */
    if (method === 'GET' && op === 'page') {
      if (!authEnabled()) return notFound('This site is not available.');
      const site = await siteBySlug(S(q.slug, 40).toLowerCase());
      if (site === undefined) return out(503, 'Temporarily unavailable', { 'content-type': 'text/plain' });
      if (!site) return notFound('This site does not exist or is no longer published.');
      const html = buildDocument(normalizeDoc(site.doc), { api: `${origin}/api/site`, slug: site.slug });
      return out(200, html, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': pageCsp(origin), 'cache-control': 'public, max-age=60', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' });
    }

    /* ---------- public: visits and requests from any published site (also downloaded copies) ---------- */
    if (op === 'hit' || op === 'request') {
      if (!authEnabled()) return out(503, { error: 'sites_not_configured' }, PUBLIC_CORS);
      const slug = S(q.slug, 40).toLowerCase();
      if (op === 'hit' && throttled(`hit:${ip}:${slug}`, 30, 3600_000)) return out(200, { ok: true }, PUBLIC_CORS); // ignore floods quietly
      if (op === 'request' && (throttled(`req:${ip}`, 5, 600_000) || throttled(`req:${slug}`, 60, 3600_000))) return out(429, { error: 'rate_limited' }, PUBLIC_CORS);
      const site = await siteBySlug(slug);
      if (!site) return out(404, { error: 'not_found' }, PUBLIC_CORS);
      if (op === 'hit') { await bump(site.owner, q.kind === 'click' ? 'click' : 'view'); return out(200, { ok: true }, PUBLIC_CORS); }
      const name = S(q.name, 80); const contact = S(q.contact, 120);
      if (q.website) return out(200, { ok: true }, PUBLIC_CORS); // honeypot: bots fill the hidden field
      if (!name || contact.length < 5 || q.consent !== true) return out(400, { error: 'bad_request' }, PUBLIC_CORS);
      const row = { owner: site.owner, name, contact, date: /^\d{4}-\d{2}-\d{2}$/.test(q.date) ? q.date : null, time: /^\d{2}:\d{2}$/.test(q.time) ? q.time : null,
        party: Math.max(0, Math.min(99, Math.round(Number(q.party) || 0))) || null, message: S(q.message, 600) || null };
      const r = await rest('site_requests', { method: 'POST', body: row });
      if (!r.ok) return out(503, { error: 'database_unreachable' }, PUBLIC_CORS);
      await bump(site.owner, 'request');
      return out(200, { ok: true }, PUBLIC_CORS);
    }

    /* ---------- owner ---------- */
    if (!authEnabled()) return out(503, { error: 'sites_not_configured' });
    const u = await requireUser(headers); if (u.error) return out(u.error.status, u.error.body);
    const owner = u.user.id;

    if (method === 'GET' && op === 'mine') {
      const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
      const [s, st, rq] = await Promise.all([
        rest(`sites?owner=eq.${owner}&select=slug,published,updated_at`),
        rest(`site_stats?owner=eq.${owner}&day=gte.${since}&select=day,views,clicks,requests&order=day.asc`),
        rest(`site_requests?owner=eq.${owner}&select=id,created_at,name,contact,date,time,party,message,status&order=created_at.desc&limit=100`),
      ]);
      if (!s.ok || !st.ok || !rq.ok) return out(503, { error: 'database_unreachable' });
      return out(200, { site: s.json?.[0] || null, stats: st.json || [], requests: rq.json || [] });
    }
    if (op === 'publish') {
      const slug = S(q.slug, 40).toLowerCase();
      if (!SLUG.test(slug) || RESERVED.has(slug)) return out(400, { error: 'bad_slug' });
      const doc = normalizeDoc(q.doc);
      if (!doc.biz.name) return out(400, { error: 'bad_request' });
      if (JSON.stringify(doc).length > 200_000) return out(413, { error: 'data_too_large' });
      const taken = await rest(`sites?slug=eq.${slug}&select=owner`);
      if (!taken.ok) return out(503, { error: 'database_unreachable' });
      if (taken.json?.[0] && taken.json[0].owner !== owner) return out(409, { error: 'slug_taken' });
      const r = await rest('sites?on_conflict=owner', { method: 'POST', body: { owner, slug, doc, published: true, updated_at: new Date().toISOString() }, prefer: 'resolution=merge-duplicates,return=representation' });
      if (!r.ok) return out(r.status === 409 ? 409 : 503, { error: r.status === 409 ? 'slug_taken' : 'database_unreachable' });
      return out(200, { slug, url: `${origin}/s/${slug}` });
    }
    if (op === 'unpublish') {
      const r = await rest(`sites?owner=eq.${owner}`, { method: 'PATCH', body: { published: false } });
      return r.ok ? out(200, { ok: true }) : out(503, { error: 'database_unreachable' });
    }
    if (op === 'request-status') {
      const id = Math.round(Number(q.id)); const status = q.status === 'done' ? 'done' : 'new';
      if (!id) return out(400, { error: 'bad_request' });
      const r = await rest(`site_requests?id=eq.${id}&owner=eq.${owner}`, { method: 'PATCH', body: { status } });
      return r.ok ? out(200, { ok: true }) : out(503, { error: 'database_unreachable' });
    }
    if (op === 'request-delete') {
      const id = Math.round(Number(q.id)); if (!id) return out(400, { error: 'bad_request' });
      const r = await rest(`site_requests?id=eq.${id}&owner=eq.${owner}`, { method: 'DELETE' });
      return r.ok ? out(200, { ok: true }) : out(503, { error: 'database_unreachable' });
    }
    return out(400, { error: 'bad_request' });
  } catch (e) {
    console.error('[LocalBoost] site error', e);
    return out(500, { error: 'server_error' });
  }
}

/** The address the app is served from (used for links in hosted pages). */
export function originOf(headers) {
  const env = (process.env.LOCALBOOST_PUBLIC_URL || '').replace(/\/+$/, '');
  if (env) return env;
  const host = String(headers['x-forwarded-host'] || headers.host || 'localhost');
  const proto = String(headers['x-forwarded-proto'] || (/^(localhost|127\.)/.test(host) ? 'http' : 'https')).split(',')[0];
  return `${proto}://${host}`;
}

export async function vercelSite(req, res, corsHeaders) {
  const isPublic = ['hit', 'request'].includes(req.query?.op) || (req.method === 'POST' && typeof req.body === 'string' && /"op"\s*:\s*"(hit|request)"/.test(req.body));
  const cors = isPublic || req.method === 'OPTIONS' ? PUBLIC_CORS : corsHeaders(req.headers.origin);
  if (req.method === 'OPTIONS') { for (const [k, v] of Object.entries({ ...PUBLIC_CORS, ...corsHeaders(req.headers.origin), 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type, authorization' })) res.setHeader(k, v); return res.status(204).end(); }
  let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const r = await handleSite({ method: req.method, query: req.query || {}, body: body || {}, headers: req.headers, origin: originOf(req.headers), ip });
  for (const [k, v] of Object.entries({ 'cache-control': 'no-store', ...(r.headers || {}), ...cors })) res.setHeader(k, v);
  if (typeof r.body === 'string') return res.status(r.status).send(r.body);
  res.status(r.status).json(r.body);
}
