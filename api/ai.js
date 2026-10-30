import { runAI } from '../lib/ai-core.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  return res.status(200).json(await runAI(body || {}, { ip, code: String(req.headers['x-access-code'] || '') }));
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
