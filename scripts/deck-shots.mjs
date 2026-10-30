// Captures the screens used in the pitch deck (desktop and phone) with headless Edge/Chrome.
//   node scripts/deck-shots.mjs      -> docs/deck/*.png
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs', 'deck'); mkdirSync(out, { recursive: true });
const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
if (!exe) { console.error('No Edge/Chrome found'); process.exit(1); }

const PORT = 5193;
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const base = `http://localhost:${PORT}/`;
const q = '?lang=ro&theme=dark';
const shots = [
  // desktop
  ['d-form', [1440, 1250], `${q}&prefill=1#/overview`],
  ['d-overview', [1440, 1750], `${q}&seed=full&open=1#/overview`],
  ['d-signals', [1440, 1500], `${q}&seed=full#/signals`],
  ['d-competitors', [1440, 2500], `${q}&seed=full#/competitors`],
  ['d-mission', [1440, 1900], `${q}&seed=full#/mission`],
  ['d-website', [1440, 1350], `${q}&seed=full#/website`],
  ['d-pack', [1440, 1500], `${q}&seed=full#/pack`],
  ['d-proof', [1440, 1100], `${q}&seed=full#/proof`],
  // phone
  ['p-form', [390, 1500], `${q}&prefill=1#/overview`],
  ['p-overview', [390, 1500], `${q}&seed=full#/overview`],
  ['p-signals', [390, 1500], `${q}&seed=full#/signals`],
  ['p-competitors', [390, 1500], `${q}&seed=full#/competitors`],
  ['p-mission', [390, 1500], `${q}&seed=full#/mission`],
  ['p-website', [390, 1500], `${q}&seed=full#/website`],
];
for (const [name, [w, h], query] of shots) {
  const file = path.join(out, `${name}.png`);
  const r = spawnSync(exe, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${path.join(root, '.shot-profile')}`, `--window-size=${w},${h}`, '--virtual-time-budget=10000', `--screenshot=${file}`, base + query], { stdio: 'ignore' });
  console.log(r.status === 0 && existsSync(file) ? 'ok' : 'FAIL', name);
}
server.kill();
setTimeout(() => { try { rmSync(path.join(root, '.shot-profile'), { recursive: true, force: true }); } catch { /* git-ignored */ } }, 1500);
