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
  ro: { subject: (n) => `${n}: săptămâna ta pe scurt`, hi: 'Iată săptămâna ta pe scurt.', week: 'Săptămâna asta', vsLast: 'față de săptămâna trecută',
    views: 'Vizite pe site', clicks: 'Clicuri pe telefon și hartă', req: 'Cereri de rezervare', confirmed: 'Rezervări confirmate', rating: 'Nota pe Google', reviews: 'recenzii',
    better: 'Ce s-a îmbunătățit', flat: 'Săptămâna asta cifrele au stat pe loc. Mișcarea de mai jos te ajută să le urci.',
    up: { views: (n) => `+${n} vizite pe site`, clicks: (n) => `+${n} clicuri pe telefon și hartă`, requests: (n) => `+${n} cereri de rezervare`, rating: (a, b) => `Nota pe Google a urcat de la ${a} la ${b}`, reviews: (n) => `+${n} recenzii noi pe Google` },
    did: 'Ce ai făcut', didReplies: (n) => `Ai răspuns la ${n} ${n === 1 ? 'recenzie' : 'recenzii'} pe Google`, didConfirmed: (n) => `Ai confirmat ${n} ${n === 1 ? 'rezervare' : 'rezervări'}`, didNothing: 'Nimic bifat săptămâna asta. Zece minute în aplicație fac diferența.',
    team: 'Ce a făcut echipa Arcton pentru tine', move: 'Mișcarea ta pentru săptămâna asta', none: 'Deschide Arcton Ai ca să afli ce să faci săptămâna asta.', open: 'Deschide Arcton Ai',
    why: 'Primești acest email pentru că ai un cont Arcton Ai.', unsub: 'Dezabonează-te de la rezumatul săptămânal' },
  en: { subject: (n) => `${n}: your week in short`, hi: 'Here is your week in short.', week: 'This week', vsLast: 'vs last week',
    views: 'Website visits', clicks: 'Taps on phone and map', req: 'Booking requests', confirmed: 'Bookings confirmed', rating: 'Google rating', reviews: 'reviews',
    better: 'What got better', flat: 'Your numbers held steady this week. The move below helps you push them up.',
    up: { views: (n) => `+${n} website visits`, clicks: (n) => `+${n} taps on phone and map`, requests: (n) => `+${n} booking requests`, rating: (a, b) => `Google rating went up from ${a} to ${b}`, reviews: (n) => `+${n} new Google reviews` },
    did: 'What you did', didReplies: (n) => `You replied to ${n} Google ${n === 1 ? 'review' : 'reviews'}`, didConfirmed: (n) => `You confirmed ${n} ${n === 1 ? 'booking' : 'bookings'}`, didNothing: 'Nothing ticked off this week. Ten minutes in the app make the difference.',
    team: 'What the Arcton team did for you', move: 'Your move for this week', none: 'Open Arcton Ai to see what to do this week.', open: 'Open Arcton Ai',
    why: 'You get this email because you have an Arcton Ai account.', unsub: 'Unsubscribe from the weekly summary' },
};
const WEEK = 7 * 86_400_000;
const arrow = (now, before) => { const d = now - before; return !before && !now ? '' : d > 0 ? ` ▲ ${d}` : d < 0 ? ` ▼ ${-d}` : ' ='; };

/** What one client's email says. Pure: easy to test.
 * stats = { views, clicks, requests, confirmed, prev: { views, clicks, requests } }; last = the rating/reviews sent last week; note = the team's note. */
export function composeDigest({ id, email, data, stats, origin, last = null, note = '' }) {
  const b = data?.business || {}; if (!b.name) return null;
  const lang = data?.diagnosis?.lang === 'en' ? 'en' : 'ro'; const c = COPY[lang];
  const dec = (x) => (lang === 'ro' ? String(x).replace('.', ',') : String(x)); // 4,6 in Romanian
  const g = data?.signals?.google || b.place || {};
  const move = data?.diagnosis?.data?.opportunity?.title || '';
  const unsub = `${origin}/api/digest?op=unsub&u=${encodeURIComponent(id)}&t=${unsubToken(id)}`;
  const st = { views: 0, clicks: 0, requests: 0, confirmed: 0, ...stats }; const prev = { views: 0, clicks: 0, requests: 0, ...(stats?.prev || {}) };
  const rows = [[c.views, `${st.views}${arrow(st.views, prev.views)}`], [c.clicks, `${st.clicks}${arrow(st.clicks, prev.clicks)}`], [c.req, `${st.requests}${arrow(st.requests, prev.requests)}`],
    ...(st.confirmed ? [[c.confirmed, st.confirmed]] : []), ...(g.rating ? [[c.rating, `${dec(g.rating)}${g.reviewCount ? ` · ${g.reviewCount} ${c.reviews}` : ''}`]] : [])];
  const better = [];
  for (const k of ['views', 'clicks', 'requests']) if (st[k] > prev[k]) better.push(c.up[k](st[k] - prev[k]));
  if (last?.rating && g.rating > last.rating) better.push(c.up.rating(dec(last.rating), dec(g.rating)));
  if (last?.reviews != null && g.reviewCount > last.reviews) better.push(c.up.reviews(g.reviewCount - last.reviews));
  const since = Date.now() - WEEK;
  const replied = Object.values(data?.repliesDone || {}).filter((at) => Number(at) >= since).length;
  const did = [...(replied ? [c.didReplies(replied)] : []), ...(st.confirmed ? [c.didConfirmed(st.confirmed)] : [])];
  const address = [BRAND.company, BRAND.address].filter(Boolean).join(', ');
  const list = (xs) => xs.map((x) => `• ${x}`).join('\n');
  const text = [`${b.name}`, c.hi, '', `${c.week} (${c.vsLast}):`, ...rows.map(([k, v]) => `${k}: ${v}`), '', `${c.better}:`, better.length ? list(better) : c.flat, '',
    `${c.did}:`, did.length ? list(did) : c.didNothing, ...(note ? ['', `${c.team}:`, note] : []), '', move ? `${c.move}: ${move}` : c.none, '', `${c.open}: ${origin}`, '', c.why, address, `${c.unsub}: ${unsub}`].join('\n');
  const ox = '#8E1B2C'; const ink = '#1B1414'; const mute = '#6E625B'; const line = '#EADFD6';
  const h2 = (s) => `<p style="margin:26px 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:${ox};font-weight:700">${esc(s)}</p>`;
  const ul = (xs, empty) => (xs.length ? `<ul style="margin:0;padding:0 0 0 18px">${xs.map((x) => `<li style="margin:0 0 6px">${esc(x)}</li>`).join('')}</ul>` : `<p style="margin:0;color:${mute}">${esc(empty)}</p>`);
  const html = `<div style="background:#F6F1EC;padding:24px 12px"><div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;color:${ink};font-size:16px;line-height:1.5">
<div style="background:#120E0E;padding:22px 26px;color:#EDE6DC"><p style="margin:0 0 4px;font-size:12px;letter-spacing:.24em;color:#E0C29F">ARCTON AI</p><p style="margin:0;font-size:22px;font-weight:700">${esc(b.name)}</p><p style="margin:4px 0 0;color:#B9AEA3">${esc(c.hi)}</p></div>
<div style="padding:8px 26px 26px">${h2(`${c.week} · ${c.vsLast}`)}
<table role="presentation" style="width:100%;border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:10px 0;border-bottom:1px solid ${line};color:${mute}">${esc(k)}</td><td style="padding:10px 0;border-bottom:1px solid ${line};text-align:right;font-weight:700">${esc(v)}</td></tr>`).join('')}</table>
${h2(c.better)}${ul(better, c.flat)}${h2(c.did)}${ul(did, c.didNothing)}
${note ? `${h2(c.team)}<p style="margin:0;padding:12px 14px;background:#FBF6F2;border-left:3px solid ${ox};border-radius:6px;white-space:pre-line">${esc(note)}</p>` : ''}
${h2(c.move)}<p style="margin:0 0 22px;font-size:18px;font-weight:700">${esc(move || c.none)}</p>
<p style="margin:0"><a href="${esc(origin)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:${ox};color:#fff;text-decoration:none;font-weight:700">${esc(c.open)}</a></p></div></div>
<p style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:14px auto 0;color:#8A7F78;font-size:12px;text-align:center">${esc(c.why)}<br>${esc(address)}<br><a href="${esc(unsub)}" style="color:#8A7F78">${esc(c.unsub)}</a></p></div>`;
  return { to: [email], subject: c.subject(b.name), text, html, headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } };
}

async function sendAll(origin) {
  // "Talk to us" messages are kept at most 12 months (privacy policy); the weekly run deletes older ones, mail or no mail
  await rest(`leads?created_at=lt.${new Date(Date.now() - 365 * 86_400_000).toISOString()}`, { method: 'DELETE' }).catch(() => null);
  if (!mailOn()) return out(503, { error: 'email_not_configured' });
  const day = (ms) => new Date(Date.now() - ms).toISOString().slice(0, 10);
  const since = day(WEEK); const before = day(2 * WEEK);
  // shortcut: loads every client's data in one go; fine for a few hundred accounts, page it past ~1000.
  const cols = 'id,email,disabled,digest_off,businesses(data)';
  let p = await rest(`profiles?select=${cols},digest_last,digest_note&disabled=is.false&limit=1000`);
  const extra = p.ok; // digest_last / digest_note exist once the newer schema.sql ran
  if (!p.ok) p = await rest(`profiles?select=${cols}&disabled=is.false&limit=1000`);
  const [s, q] = await Promise.all([
    rest(`site_stats?day=gte.${before}&select=owner,day,views,clicks,requests&limit=40000`),
    rest(`site_requests?created_at=gte.${new Date(Date.now() - WEEK).toISOString()}&status=in.(confirmed,done)&select=owner&limit=20000`),
  ]);
  if (!p.ok || !s.ok) return out(503, { error: 'database_unreachable' });
  const stats = {};
  const blank = () => ({ views: 0, clicks: 0, requests: 0, confirmed: 0, prev: { views: 0, clicks: 0, requests: 0 } });
  for (const r of s.json || []) { const x = (stats[r.owner] ||= blank()); const into = r.day >= since ? x : x.prev; for (const k of ['views', 'clicks', 'requests']) into[k] += Number(r[k]) || 0; }
  for (const r of (q.ok ? q.json : []) || []) (stats[r.owner] ||= blank()).confirmed += 1;
  const sent = []; const mails = [];
  for (const x of p.json || []) {
    if (!x.email || x.digest_off) continue;
    const biz = Array.isArray(x.businesses) ? x.businesses[0] : x.businesses;
    const m = composeDigest({ id: x.id, email: x.email, data: biz?.data, stats: stats[x.id] || blank(), origin, last: x.digest_last || null, note: String(x.digest_note || '').slice(0, 1000) });
    if (m) { mails.push(m); sent.push({ id: x.id, g: biz?.data?.signals?.google || {} }); }
  }
  const n = await sendMails(mails);
  // remember this week's rating for next week's "what got better", and clear the team's note once it went out
  if (extra) await Promise.allSettled(sent.map(({ id, g }) => rest(`profiles?id=eq.${id}`, { method: 'PATCH', body: { digest_last: { rating: g.rating || null, reviews: g.reviewCount ?? null, at: new Date().toISOString() }, digest_note: null } })));
  return out(200, { sent: n, of: mails.length });
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
