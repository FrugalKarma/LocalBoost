// Quick design review screenshots: node scripts/shot.mjs <name> <width>x<height> "<query+hash>" [...more triples]
// Writes PNGs to .shots/ (git-ignored). Needs Edge or Chrome, like scripts/screenshots.mjs.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.shots'); mkdirSync(out, { recursive: true });
const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((b) => existsSync(b));
if (!exe) { console.error('No Edge/Chrome found.'); process.exit(1); }
const args = process.argv.slice(2);
if (args.length < 3 || args.length % 3) { console.error('usage: node scripts/shot.mjs name WxH "query#hash" ...'); process.exit(1); }
const PORT = 5191;
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
for (let i = 0; i < args.length; i += 3) {
  const [name, size, query] = args.slice(i, i + 3); const [w, h] = size.split('x');
  const profile = path.join(out, `.profile-${i}`); const file = path.join(out, `${name}.png`);
  const r = spawnSync(exe, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${profile}`, `--window-size=${w},${h}`, '--virtual-time-budget=6000', `--screenshot=${file}`, `http://localhost:${PORT}/${query}`], { stdio: 'ignore' });
  console.log(r.status === 0 && existsSync(file) ? 'ok ' : 'FAIL', name);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* browser may still hold it */ }
}
server.kill();
