// Build = verify + copy the static app into ./dist with a content-hashed service-worker version.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = spawnSync(process.execPath, [path.join(root, 'scripts/check.mjs')], { stdio: 'inherit' });
if (check.status !== 0) { console.error('Build aborted: checks failed.'); process.exit(1); }

const dist = path.join(root, 'dist');
rmSync(dist, { recursive: true, force: true }); mkdirSync(dist);
for (const item of ['index.html', 'preview.html', 'manifest.json', 'sw.js', 'css', 'js', 'icons']) cpSync(path.join(root, item), path.join(dist, item), { recursive: true });

const walk = (d, out = []) => { for (const f of readdirSync(d).sort()) { const p = path.join(d, f); statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; };
const hash = createHash('sha256');
for (const f of walk(dist)) if (!f.endsWith('sw.js')) hash.update(readFileSync(f));
const version = hash.digest('hex').slice(0, 10);
const swPath = path.join(dist, 'sw.js');
writeFileSync(swPath, readFileSync(swPath, 'utf8').replace("'localboost-dev'", `'${version}'`));
console.log(`\nBuild complete: dist/ (service worker version ${version}). Serve with: npm run serve:dist`);
