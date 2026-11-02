// What this server can do right now (no secrets): the app uses it to show what is connected.
import { aiHealth } from './ai-core.mjs';
import { authEnabled } from './auth-core.mjs';
import { placesEnabled } from './places-core.mjs';

export const health = () => ({ ...aiHealth(), places: placesEnabled(), accounts: authEnabled(), sites: authEnabled(), sitecheck: true });
