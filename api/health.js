import { aiHealth, corsHeaders } from '../lib/ai-core.mjs';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(corsHeaders(req.headers.origin))) res.setHeader(k, v);
  if (req.method === 'OPTIONS') return res.status(204).end();
  res.status(200).json(aiHealth());
}
