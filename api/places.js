// Vercel serverless: Google Places: find the business, its reviews and nearby competitors. Logic lives in lib/places-core.mjs.
import { corsHeaders } from '../lib/ai-core.mjs';
import { vercelData } from '../lib/places-core.mjs';

export default function handler(req, res) { return vercelData('places', req, res, corsHeaders); }
