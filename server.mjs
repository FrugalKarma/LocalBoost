// Zero-dependency static server + optional server-side AI proxy.
//   node server.mjs            serve the project root
//   node server.mjs --dist     serve ./dist (after `npm run build`)
// Set ANTHROPIC_API_KEY to enable real model calls; without it /api/ai answers 503 and the
// app uses its deterministic local fallback. The key never reaches the browser.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAI, aiHealth } from './lib/ai-core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv.includes('--dist') ? path.join(here, 'dist') : here;
const PORT = Number(process.env.PORT) || 5173;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };
const BLOCKED = /^\/(server\.mjs|package\.json|scripts|docs|dist\/\.|\.|node_modules)/;

const send = (res, code, body, type = 'application/json; charset=utf-8', extra = {}) => {
  res.writeHead(code, { 'content-type': type, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', ...extra });
  res.end(body);
};

async function readBody(req, max = 64 * 1024) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > max) throw new Error('too_large'); chunks.push(c); }
  return Buffer.concat(chunks).toString('utf8');
}

async function handleAI(req, res) {
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, JSON.stringify({ error: 'bad_request' })); }
  const out = await runAI(body, { ip: req.socket.remoteAddress || 'local', code: String(req.headers['x-access-code'] || '') });
  return send(res, 200, JSON.stringify(out));
}
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let p = decodeURIComponent(url.pathname);
    if (p === '/api/ai' && req.method === 'POST') return handleAI(req, res);
    if (p === '/api/health') return send(res, 200, JSON.stringify(aiHealth()));
    if (p.startsWith('/preview/')) p = '/preview.html';
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
  console.log(`LocalBoost running at http://localhost:${PORT}  (AI: ${aiHealth().ai ? 'live model' : 'local fallback - set ANTHROPIC_API_KEY to enable'})`);
});
