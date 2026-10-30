// Vercel serverless (Node runtime): streamed answers for "Ask LocalBoost". Same logic as server.mjs.
import { streamChat, corsHeaders } from '../lib/ai-core.mjs';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(corsHeaders(req.headers.origin))) res.setHeader(k, v);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' });
  const ctrl = new AbortController();
  req.on('close', () => { if (!res.writableEnded) ctrl.abort(); });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  await streamChat(body || {}, { ip, code: String(req.headers['x-access-code'] || ''), clientSignal: ctrl.signal, emit: (ev) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(ev)}\n\n`); } });
  res.end();
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
