// Vercel serverless: admin area: every client, open, edit, disable, delete. Logic lives in lib/auth-core.mjs.
import { corsHeaders } from '../lib/ai-core.mjs';
import { vercelAccount } from '../lib/auth-core.mjs';

export default function handler(req, res) { return vercelAccount('admin', req, res, corsHeaders); }
