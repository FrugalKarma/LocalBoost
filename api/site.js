// Vercel serverless: hosted websites (/s/<slug> is rewritten here), booking requests and visit counts. Logic lives in lib/site-core.mjs.
import { corsHeaders } from '../lib/ai-core.mjs';
import { vercelSite } from '../lib/site-core.mjs';

export default function handler(req, res) { return vercelSite(req, res, corsHeaders); }
