// Zero-dependency static server + optional server-side AI proxy.
//   node server.mjs            serve the project root
//   node server.mjs --dist     serve ./dist (after `npm run build`)
// Set ANTHROPIC_API_KEY to enable real model calls; without it /api/ai answers 503 and the
// app uses its deterministic local fallback. The key never reaches the browser.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAI, streamChat, corsHeaders } from './lib/ai-core.mjs';
import { handleAccount, aiAccess } from './lib/auth-core.mjs';
import { handleData } from './lib/places-core.mjs';
import { handleSite, originOf, PUBLIC_CORS } from './lib/site-core.mjs';
import { health } from './lib/health.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv.includes('--dist') ? path.join(here, 'dist') : here;
const PORT = Number(process.env.PORT) || 5173;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };
const BLOCKED = /^\/(server\.mjs|package\.json|scripts|docs|dist\/\.|\.|node_modules)/;

const send = (res, code, body, type = 'application/json; charset=utf-8', extra = {}) => {
  type = type || 'application/json; charset=utf-8';
  res.writeHead(code, { 'content-type': type, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', ...extra });
  res.end(body);
};

async function readBody(req, max = 64 * 1024) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > max) throw new Error('too_large'); chunks.push(c); }
  return Buffer.concat(chunks).toString('utf8');
}

async function handleAI(req, res, cors) {
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, JSON.stringify({ error: 'bad_request' }), undefined, cors); }
  const gate = await aiAccess(req.headers, String(body?.role || ''));
  if (!gate.ok) return send(res, 200, JSON.stringify({ error: gate.error }), undefined, cors);
  const out = await runAI(body, { ip: req.socket.remoteAddress || 'local', code: String(req.headers['x-access-code'] || '') });
  if (!out.error && gate.consume) await gate.consume().catch(() => {});
  return send(res, 200, JSON.stringify(out), undefined, cors);
}

// "Ask LocalBoost": Server-Sent Events, one `data: {json}` line per event (meta, delta, done, error).
async function handleChat(req, res, cors) {
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, JSON.stringify({ error: 'bad_request' }), undefined, cors); }
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...cors });
  const gate = await aiAccess(req.headers, 'chat');
  if (!gate.ok) { res.write(`data: ${JSON.stringify({ type: 'error', error: gate.error })}\n\n`); return res.end(); }
  const ctrl = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ctrl.abort(); });
  await streamChat(body, { ip: req.socket.remoteAddress || 'local', code: String(req.headers['x-access-code'] || ''), clientSignal: ctrl.signal,
    emit: (ev) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(ev)}\n\n`); } });
  res.end();
}

// Accounts (/api/auth, /api/data, /api/admin): same handlers as the Vercel functions.
async function handleAccountReq(route, req, res, url, cors) {
  let body = {};
  if (req.method !== 'GET') { try { body = JSON.parse((await readBody(req, 1024 * 1024)) || '{}'); } catch { return send(res, 400, JSON.stringify({ error: 'bad_request' }), undefined, cors); } }
  const r = await handleAccount(route, { method: req.method, query: Object.fromEntries(url.searchParams), body, headers: req.headers, ip: req.socket.remoteAddress || 'local' });
  return send(res, r.status, JSON.stringify(r.body), undefined, { 'cache-control': 'no-store', ...cors });
}

async function handleDataReq(route, req, res, url, cors) {
  let body = {};
  if (req.method === 'POST') { try { body = JSON.parse((await readBody(req)) || '{}'); } catch { return send(res, 400, JSON.stringify({ error: 'bad_request' }), undefined, cors); } }
  const r = await handleData(route, { method: req.method, query: Object.fromEntries(url.searchParams), body, headers: req.headers, ip: req.socket.remoteAddress || 'local' });
  return send(res, r.status, JSON.stringify(r.body), undefined, { 'cache-control': 'no-store', ...cors });
}

// Hosted sites: /s/<slug> pages, plus booking requests and visit counts that may come from any website.
async function handleSiteReq(req, res, url, cors) {
  if (req.method === 'OPTIONS') { res.writeHead(204, { ...PUBLIC_CORS, ...cors, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type, authorization' }); return res.end(); }
  let body = {};
  if (req.method === 'POST') { try { body = JSON.parse((await readBody(req, 256 * 1024)) || '{}'); } catch { return send(res, 400, JSON.stringify({ error: 'bad_request' }), undefined, PUBLIC_CORS); } }
  const r = await handleSite({ method: req.method, query: Object.fromEntries(url.searchParams), body, headers: req.headers, origin: originOf(req.headers), ip: req.socket.remoteAddress || 'local' });
  const pub = ['hit', 'request'].includes(body.op || url.searchParams.get('op'));
  const headers = { 'cache-control': 'no-store', ...(r.headers || {}), ...(pub ? PUBLIC_CORS : cors) };
  return typeof r.body === 'string' ? send(res, r.status, r.body, headers['content-type'] || 'text/html; charset=utf-8', headers) : send(res, r.status, JSON.stringify(r.body), undefined, headers);
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let p = decodeURIComponent(url.pathname);
    if (p.startsWith('/api/')) {
      const cors = corsHeaders(req.headers.origin);
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
      if (p === '/api/ai' && req.method === 'POST') return handleAI(req, res, cors);
      if (p === '/api/chat' && req.method === 'POST') return handleChat(req, res, cors);
      const acct = { '/api/auth': 'auth', '/api/data': 'data', '/api/admin': 'admin' }[p];
      if (acct) return handleAccountReq(acct, req, res, url, cors);
      if (p === '/api/health') return send(res, 200, JSON.stringify(health()), undefined, cors);
      if (p === '/api/places' || p === '/api/sitecheck') return handleDataReq(p.slice(5), req, res, url, cors);
      if (p === '/api/site') return handleSiteReq(req, res, url, cors);
    }
    if (/^\/s\/[^/]+\/?$/.test(p)) { url.searchParams.set('op', 'page'); url.searchParams.set('slug', p.split('/')[2]); return handleSiteReq(req, res, url, {}); }
    if (p === '/') p = '/index.html';
    if (BLOCKED.test(p) || p.includes('..')) return send(res, 404, 'Not found', 'text/plain');
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT)) return send(res, 404, 'Not found', 'text/plain');
    const data = await readFile(file);
    const type = MIME[path.extname(file)] || 'application/octet-stream';
    const noCache = p === '/sw.js' || p.endsWith('.html');
    send(res, 200, data, type, { 'cache-control': noCache ? 'no-cache' : 'no-cache' });
  } catch {
    send(res, 404, 'Not found', 'text/plain');
  }
}).listen(PORT, () => {
  console.log(`LocalBoost running at http://localhost:${PORT}  (AI: ${health().ai ? 'live model' : 'local fallback - set ANTHROPIC_API_KEY to enable'})`);
});
