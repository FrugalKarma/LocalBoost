// Static checks: syntax, i18n parity, key coverage, manifest/icons, service-worker precache, no secrets in client code.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const fail = (m) => { failures++; console.error('  ✗', m); };
const ok = (m) => console.log('  ✓', m);
const walk = (d, out = []) => { for (const f of readdirSync(d)) { const p = path.join(d, f); statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; };
const rel = (p) => path.relative(root, p).replaceAll('\\', '/');

console.log('1. JavaScript syntax');
const jsFiles = [...walk(path.join(root, 'js')), path.join(root, 'sw.js'), path.join(root, 'server.mjs'), ...walk(path.join(root, 'scripts'))].filter((f) => /\.m?js$/.test(f));
for (const f of jsFiles) { const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' }); if (r.status !== 0) fail(`${rel(f)}: ${r.stderr.split('\n').slice(0, 3).join(' ')}`); }
if (!failures) ok(`${jsFiles.length} files parse`);

console.log('2. i18n parity (ro, en, fr, de, hu)');
const flatten = (o, p = '', out = {}) => { for (const [k, v] of Object.entries(o)) { const key = p ? `${p}.${k}` : k; if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out); else out[key] = v; } return out; };
const dict = {};
for (const l of ['en', 'ro', 'fr', 'de', 'hu']) dict[l] = flatten((await import(pathToFileURL(path.join(root, 'js/locales', `${l}.js`)))).default);
const base = Object.keys(dict.en);
const placeholders = (s) => (typeof s === 'string' ? (s.match(/\{\w+\}/g) || []).sort().join() : '');
for (const l of ['ro', 'fr', 'de', 'hu']) {
  const miss = base.filter((k) => !(k in dict[l])); const extra = Object.keys(dict[l]).filter((k) => !(k in dict.en));
  if (miss.length) fail(`${l}: missing ${miss.length} keys, e.g. ${miss.slice(0, 5).join(', ')}`);
  if (extra.length) fail(`${l}: extra keys ${extra.slice(0, 5).join(', ')}`);
  for (const k of base) {
    const a = dict.en[k]; const b = dict[l][k]; if (b === undefined) continue;
    if (Array.isArray(a) !== Array.isArray(b) || (Array.isArray(a) && a.length !== b.length)) fail(`${l}: ${k} array shape differs`);
    else if (typeof a === 'string' && (placeholders(a) !== placeholders(b) || !b.trim())) fail(`${l}: ${k} placeholder/empty mismatch`);
  }
}
if (!failures) ok(`${base.length} keys identical across 4 languages`);

console.log('3. Translation keys used in code exist');
const used = new Set();
for (const f of jsFiles.filter((x) => rel(x).startsWith('js/') && !rel(x).includes('locales'))) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\b(?:t|ta|T)\(\s*'([\w.-]+)'/g)) used.add(m[1]);
  for (const m of src.matchAll(/tIn\(\s*\w+,\s*'([\w.-]+)'/g)) used.add(m[1]);
  for (const m of src.matchAll(/\['(?:\w+)',\s*'((?:website|common|settings)\.\w+)'\]/g)) used.add(m[1]);
}
const lacking = [...used].filter((k) => !(k in dict.en));
lacking.length ? fail(`keys used but not defined: ${lacking.join(', ')}`) : ok(`${used.size} literal keys resolved`);

console.log('4. Manifest and icons');
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
for (const k of ['name', 'short_name', 'start_url', 'display', 'theme_color', 'background_color', 'icons']) if (!manifest[k]) fail(`manifest.${k} missing`);
if (manifest.theme_color !== '#54172A') fail('theme_color should be burgundy #54172A');
const pngSize = (p) => { const b = readFileSync(p); return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20); };
for (const ic of manifest.icons) {
  const p = path.join(root, ic.src.replace(/^\//, ''));
  if (!existsSync(p)) fail(`icon missing: ${ic.src}`); else if (pngSize(p) !== ic.sizes) fail(`${ic.src} is ${pngSize(p)}, manifest says ${ic.sizes}`);
}
if (!manifest.icons.some((i) => i.sizes === '192x192') || !manifest.icons.some((i) => i.sizes === '512x512')) fail('need 192 and 512 icons');
if (!existsSync(path.join(root, 'icons/favicon.svg'))) fail('favicon.svg missing');
ok('manifest valid, icons present with correct dimensions');

console.log('5. Service worker precache');
const sw = readFileSync(path.join(root, 'sw.js'), 'utf8');
const shell = [...sw.slice(sw.indexOf('const SHELL'), sw.indexOf('];', sw.indexOf('const SHELL'))).matchAll(/'(\/[^']*)'/g)].map((m) => m[1]);
for (const p of shell) { if (p === '/') continue; if (!existsSync(path.join(root, p))) fail(`precache entry missing on disk: ${p}`); }
const allClient = walk(path.join(root, 'js')).map((f) => '/' + rel(f));
for (const f of allClient) if (!shell.includes(f)) fail(`client file not precached (breaks offline): ${f}`);
ok(`${shell.length} precached files verified`);

console.log('6. No secrets in client code');
for (const f of [...walk(path.join(root, 'js')), path.join(root, 'index.html'), path.join(root, 'sw.js'), path.join(root, 'preview.html')]) {
  const src = readFileSync(f, 'utf8');
  if (/sk-ant-|ANTHROPIC_API_KEY|x-api-key/i.test(src)) fail(`${rel(f)} references an API key`);
}
ok('no API keys or key headers in browser code');

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
