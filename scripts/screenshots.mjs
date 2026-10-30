// Captures submission screenshots with headless Edge/Chrome against a temporary local server.
//   npm run screenshots          (needs Microsoft Edge or Chrome installed; fonts load from Google Fonts when online)
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs', 'screenshots');
mkdirSync(outDir, { recursive: true });
const browsers = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const exe = browsers.find((b) => existsSync(b));
if (!exe) { console.error('No Edge/Chrome found. Open the app and capture manually.'); process.exit(1); }

const PORT = 5190;
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

const base = `http://localhost:${PORT}/`;
const D = [1440, 900]; const M = [390, 844];
const shots = [
  ['01-overview-light-en', D, '?lang=en&theme=light&seed=full#/overview'],
  ['02-signals-ro', D, '?lang=ro&theme=light&seed=full#/signals'],
  ['03-ai-diagnosis-en', D, '?lang=en&theme=light&seed=full#/diagnosis'],
  ['04-mission-control-dark', D, '?lang=en&theme=dark&seed=full#/mission'],
  ['05-temporary-website', [1440, 1100], '?lang=en&theme=light&seed=full#/website'],
  ['06-action-pack-fr', D, '?lang=fr&theme=light&seed=full#/pack'],
  ['07-proof-board-de', D, '?lang=de&theme=light&seed=full#/proof'],
  ['08-pitch-scene-3', D, '?lang=en&seed=full&pitch=1&scene=2'],
  ['09-pitch-scene-5-audience', D, '?lang=en&seed=full&pitch=audience&scene=4'],
  ['10-mobile-overview-de-dark', M, '?lang=de&theme=dark&seed=full#/overview'],
  ['11-mobile-website', M, '?lang=en&theme=light&seed=full#/website'],
  ['12-mobile-pitch', M, '?lang=ro&seed=full&pitch=1&scene=1'],
];
for (const [name, [w, h], query] of shots) {
  const file = path.join(outDir, `${name}.png`);
  const profile = path.join(root, '.shot-profile');
  const r = spawnSync(exe, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${profile}`, `--window-size=${w},${h}`, '--virtual-time-budget=9000', `--screenshot=${file}`, base + query], { stdio: 'ignore' });
  console.log(r.status === 0 && existsSync(file) ? '✓' : '✗', name);
}
server.kill();
setTimeout(() => { try { rmSync(path.join(root, '.shot-profile'), { recursive: true, force: true }); } catch { /* browser may still hold files: harmless, it is git-ignored */ } }, 1500);
