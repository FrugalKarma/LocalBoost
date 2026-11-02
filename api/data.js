// Vercel serverless: the signed-in owner's business data. Logic lives in lib/auth-core.mjs.
import { corsHeaders } from '../lib/ai-core.mjs';
import { vercelAccount } from '../lib/auth-core.mjs';

export default function handler(req, res) { return vercelAccount('data', req, res, corsHeaders); }
