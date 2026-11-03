// Hosted websites: publish a business site at /s/<slug>, take booking requests from it and count visits.
// Shared by server.mjs and api/site.js. Needs accounts (Supabase); without them publishing answers 503
// and the owner can still download the site, whose form then falls back to WhatsApp or email.
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { authEnabled, requireUser, rest, storageUpload, planOf, atLeast } from './auth-core.mjs';
import { normalizeDoc, buildDocument, SITE_JS } from '../js/siteTemplate.js';

const out = (status, body, headers) => ({ status, body, headers });
const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED = new Set(['api', 'app', 'admin', 'www', 'login', 'signin', 'help', 'support', 'localboost', 'static', 'assets']);
const S = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n) : '');
const SCRIPT_HASH = `'sha256-${createHash('sha256').update(SITE_JS).digest('base64')}'`;
// The hosted page runs in a sandbox (its own opaque origin), so even a template bug could not reach the app's sign-in.
// Photos live in Supabase Storage (https). A local test setup may serve them over plain http, so allow exactly that origin.
const devStorage = () => { try { const u = new URL(process.env.SUPABASE_URL || ''); return u.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(u.hostname) ? ` ${u.origin}` : ''; } catch { return ''; } };
const pageCsp = (origin) => [
  "default-src 'none'", `script-src ${SCRIPT_HASH}`, "style-src 'unsafe-inline' https://fonts.googleapis.com", 'font-src https://fonts.gstatic.com',
  `img-src data: https:${devStorage()}`, 'frame-src https://www.openstreetmap.org', `connect-src ${origin}`, "form-action 'none'", "base-uri 'none'", "frame-ancestors 'none'",
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
  const r = await rest(`sites?slug=eq.${slug}&published=is.true&select=owner,slug,doc,profiles(plan,role,email,disabled)`);
  if (!r.ok) return undefined;
  const site = r.json?.[0]; if (!site) return null;
  const prof = Array.isArray(site.profiles) ? site.profiles[0] : site.profiles;
  // a site stays online only while its owner is on Business and not disabled
  if (!prof || prof.disabled || !atLeast(planOf(prof), 'business')) return null;
  return { ...site, ownerEmail: prof.email };
}
async function bump(owner, kind) {
  await rest('rpc/localboost_site_hit', { method: 'POST', body: { p_owner: owner, p_day: today(), p_kind: kind } });
}

/* ---------- email the owner about a new request (optional: RESEND_API_KEY) ---------- */
async function notifyOwner(site, row, origin) {
  const key = (process.env.RESEND_API_KEY || '').trim();
  const to = normalizeDoc(site.doc).biz.email || site.ownerEmail;
  if (!key || !to) return;
  const from = process.env.LOCALBOOST_MAIL_FROM || 'Arcton Ai <onboarding@resend.dev>';
  const lines = [`${row.name} · ${row.contact}`, row.date ? `${row.date}${row.time ? ` ${row.time}` : ''}` : '', row.party ? `${row.party} ×` : '', row.message || ''].filter(Boolean);
  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ from, to: [to], subject: `New request: ${row.name}`, text: `${lines.join('\n')}\n\n${origin}/#/website`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5"><h2 style="margin:0 0 12px">New request from your website</h2>${lines.map((l) => `<p style="margin:0 0 6px">${esc(l)}</p>`).join('')}<p style="margin-top:18px"><a href="${esc(origin)}/#/website">Open Arcton Ai</a></p></div>` }) });
}

const notFound = (msg) => out(404, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arcton Ai</title><body style="font-family:system-ui;padding:40px 20px;max-width:520px;margin:auto;color:#33121F"><h1>${msg}</h1><p><a href="/" style="color:#6E1A33">Arcton Ai</a></p>`, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });

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
      const html = buildDocument(normalizeDoc(site.doc), { api: `${origin}/api/site`, slug: site.slug, url: `${origin}/s/${site.slug}` });
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
      await notifyOwner(site, row, origin).catch((e) => console.warn('[Arcton] mail', e?.message));
      return out(200, { ok: true }, PUBLIC_CORS);
    }

    /* ---------- owner ---------- */
    if (!authEnabled()) return out(503, { error: 'sites_not_configured' });
    const u = await requireUser(headers); if (u.error) return out(u.error.status, u.error.body);
    const owner = u.user.id; const plan = planOf(u.profile);

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
    if (op === 'upload') {
      // photos for the site: logo, cover, gallery. The app resizes them first; any plan can upload (the preview uses them).
      if (throttled(`up:${owner}`, 80, 86_400_000)) return out(429, { error: 'rate_limited' });
      const m = String(q.data || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!m) return out(400, { error: 'bad_image' });
      const bytes = Buffer.from(m[2], 'base64');
      if (bytes.length > 3_000_000) return out(413, { error: 'image_too_large' });
      const magic = bytes.subarray(0, 12).toString('hex');
      const okType = (m[1] === 'image/jpeg' && magic.startsWith('ffd8ff')) || (m[1] === 'image/png' && magic.startsWith('89504e47')) || (m[1] === 'image/webp' && magic.startsWith('52494646') && magic.slice(16, 24) === '57454250');
      if (!okType) return out(400, { error: 'bad_image' });
      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[m[1]];
      const url = await storageUpload('site-media', `${owner}/${randomUUID()}.${ext}`, bytes, m[1]);
      return url ? out(200, { url }) : out(503, { error: 'storage_unavailable' });
    }
    if (op === 'publish') {
      if (!atLeast(plan, 'business')) return out(402, { error: 'plan_required', need: 'business' });
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
    console.error('[Arcton] site error', e);
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
