// Vercel serverless: website check: fetches the owner's site and tests what customers need. Logic lives in lib/places-core.mjs.
import { corsHeaders } from '../lib/ai-core.mjs';
import { vercelData } from '../lib/places-core.mjs';

export default function handler(req, res) { return vercelData('sitecheck', req, res, corsHeaders); }
