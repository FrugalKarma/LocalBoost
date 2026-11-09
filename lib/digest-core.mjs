// Weekly email digest: every Monday each client gets one short email with what happened in the last 7 days
// (booking requests, website visits, Google rating) and their move for this week, with a one-click unsubscribe.
// Runs from a Vercel cron (vercel.json → /api/digest), authorised by CRON_SECRET. Needs RESEND_API_KEY to send.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { authEnabled, rest } from './auth-core.mjs';
import { publicUrl } from './public-url.mjs';
import { BRAND } from '../js/brand.js';
import { sendMails, mailOn } from './mail.mjs';

const out = (status, body, headers) => ({ status, body, headers });
const secret = () => (process.env.CRON_SECRET || '').trim();
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const unsubToken = (id) => createHmac('sha256', secret()).update(`digest:${id}`).digest('hex').slice(0, 32);
const tokenOk = (id, t) => { const a = Buffer.from(unsubToken(id)); const b = Buffer.from(String(t || '')); return secret().length >= 16 && a.length === b.length && timingSafeEqual(a, b); };

const COPY = {
  ro: { subject: (n) => `${n}: săptămâna ta pe scurt`, hi: 'Iată săptămâna ta pe scurt.', req: 'Cereri de rezervare', views: 'Vizite pe site', rating: 'Nota pe Google', reviews: 'recenzii',
    move: 'Mișcarea ta pentru săptămâna asta', none: 'Deschide Arcton Ai ca să afli ce să faci săptămâna asta.', open: 'Deschide Arcton Ai', why: 'Primești acest email pentru că ai un cont Arcton Ai.', unsub: 'Dezabonează-te de la rezumatul săptămânal' },
  en: { subject: (n) => `${n}: your week in short`, hi: 'Here is your week in short.', req: 'Booking requests', views: 'Website visits', rating: 'Google rating', reviews: 'reviews',
    move: 'Your move for this week', none: 'Open Arcton Ai to see what to do this week.', open: 'Open Arcton Ai', why: 'You get this email because you have an Arcton Ai account.', unsub: 'Unsubscribe from the weekly summary' },
};

/** What one client's email says. Pure: easy to test. */
export function composeDigest({ id, email, data, stats, origin }) {
  const b = data?.business || {}; if (!b.name) return null;
  const c = COPY[data?.diagnosis?.lang === 'en' ? 'en' : 'ro'];
  const g = data?.signals?.google || b.place || {};
  const move = data?.diagnosis?.data?.opportunity?.title || '';
  const unsub = `${origin}/api/digest?op=unsub&u=${encodeURIComponent(id)}&t=${unsubToken(id)}`;
  const rows = [[c.req, stats.requests], [c.views, stats.views], ...(g.rating ? [[c.rating, `${g.rating}${g.reviewCount ? ` · ${g.reviewCount} ${c.reviews}` : ''}`]] : [])];
  const address = [BRAND.company, BRAND.address].filter(Boolean).join(', ');
  const text = [`${b.name}`, c.hi, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', move ? `${c.move}: ${move}` : c.none, '', `${c.open}: ${origin}`, '', c.why, address, `${c.unsub}: ${unsub}`].join('\n');
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:auto;color:#0B0E1F;font-size:16px;line-height:1.5">
<p style="margin:0 0 4px;color:#1846FF;font-weight:600">${esc(b.name)}</p><h1 style="margin:0 0 18px;font-size:24px;font-weight:500">${esc(c.hi)}</h1>
<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px">${rows.map(([k, v]) => `<tr><td style="padding:10px 0;border-bottom:1px solid #E4E6F2;color:#555B7A">${esc(k)}</td><td style="padding:10px 0;border-bottom:1px solid #E4E6F2;text-align:right;font-weight:600">${esc(v)}</td></tr>`).join('')}</table>
${move ? `<p style="margin:0 0 4px;color:#555B7A;font-size:14px">${esc(c.move)}</p><p style="margin:0 0 22px;font-size:18px;font-weight:600">${esc(move)}</p>` : `<p style="margin:0 0 22px">${esc(c.none)}</p>`}
<p style="margin:0 0 30px"><a href="${esc(origin)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#1846FF;color:#fff;text-decoration:none;font-weight:600">${esc(c.open)}</a></p>
<p style="margin:0;color:#8A8FA8;font-size:12px">${esc(c.why)}<br>${esc(address)}<br><a href="${esc(unsub)}" style="color:#8A8FA8">${esc(c.unsub)}</a></p></div>`;
  return { to: [email], subject: c.subject(b.name), text, html, headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } };
}

async function sendAll(origin) {
  if (!mailOn()) return out(503, { error: 'email_not_configured' });
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  // shortcut: loads every client's data in one go; fine for a few hundred accounts, page it past ~1000.
  const [p, s] = await Promise.all([
    rest('profiles?select=id,email,disabled,digest_off,businesses(data)&disabled=is.false&limit=1000'),
    rest(`site_stats?day=gte.${since}&select=owner,views,requests&limit=20000`),
  ]);
  if (!p.ok || !s.ok) return out(503, { error: 'database_unreachable' });
  const stats = {};
  for (const r of s.json || []) { const x = (stats[r.owner] ||= { views: 0, requests: 0 }); x.views += Number(r.views) || 0; x.requests += Number(r.requests) || 0; }
  const mails = (p.json || []).filter((x) => x.email && !x.digest_off).map((x) => {
    const biz = Array.isArray(x.businesses) ? x.businesses[0] : x.businesses;
    const m = composeDigest({ id: x.id, email: x.email, data: biz?.data, stats: stats[x.id] || { views: 0, requests: 0 }, origin });
    return m;
  }).filter(Boolean);
  const sent = await sendMails(mails);
  return out(200, { sent, of: mails.length });
}

const page = (msg) => out(200, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arcton Ai</title><body style="font-family:system-ui;padding:48px 20px;max-width:520px;margin:auto;background:#05060F;color:#DDE0F5;text-align:center"><h1 style="font-weight:400">${msg}</h1><p><a href="/" style="color:#B8B8FF">Arcton Ai</a></p>`, { 'content-type': 'text/html; charset=utf-8' });

export async function handleDigest({ method, query, headers, origin }) {
  if (!authEnabled()) return out(503, { error: 'accounts_off' });
  if (query.op === 'unsub') { // GET from the email link, or POST from a mail app's one-click unsubscribe
    if (!/^[0-9a-f-]{36}$/i.test(String(query.u || '')) || !tokenOk(query.u, query.t)) return out(400, { error: 'bad_link' });
    const r = await rest(`profiles?id=eq.${encodeURIComponent(query.u)}`, { method: 'PATCH', body: { digest_off: true } });
    return r.ok ? page('Te-ai dezabonat. Nu mai primești rezumatul săptămânal. · You are unsubscribed.') : out(503, { error: 'database_unreachable' });
  }
  const auth = String(headers.authorization || '');
  if (method !== 'GET' || secret().length < 16 || auth.length !== secret().length + 7 || !timingSafeEqual(Buffer.from(auth), Buffer.from(`Bearer ${secret()}`))) return out(401, { error: 'unauthorized' });
  return sendAll(origin);
}

export async function vercelDigest(req, res) {
  const r = await handleDigest({ method: req.method, query: req.query || {}, headers: req.headers, origin: publicUrl(req.headers) });
  res.setHeader('cache-control', 'no-store');
  for (const [k, v] of Object.entries(r.headers || {})) res.setHeader(k, v);
  return typeof r.body === 'string' ? res.status(r.status).send(r.body) : res.status(r.status).json(r.body);
}
