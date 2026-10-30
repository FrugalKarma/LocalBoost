# Setup LocalBoost

## 1. Rulare locală (2 minute)

Cerințe: **Node.js ≥ 18**. Nu există `npm install`: aplicația nu are dependențe.

```bash
npm start
```

→ http://localhost:5173. Demo Mode funcționează imediat, fără credențiale.

Altă portă: `PORT=8080 npm start` (PowerShell: `$env:PORT=8080; npm start`).

## 2. Verificare și build

```bash
npm run check    # sintaxă, i18n (4 limbi), chei, manifest/iconuri, precache SW, fără secrete
npm run build    # check + dist/ cu service worker versionat prin hash
npm run serve:dist
```

Folosește `dist/` pentru demo-ul final: service worker-ul din `dist/` este **cache-first** (offline garantat după prima încărcare). În modul dev (`npm start` din rădăcină) service worker-ul este network-first, ca să vezi imediat modificările.

## 3. Instalare ca aplicație (PWA)

Aplicația trebuie servită de pe `https://` sau `http://localhost`.

| Dispozitiv | Pași |
| --- | --- |
| **Windows / Linux** (Chrome, Edge) | Deschide aplicația → iconița de instalare din bara de adrese, sau **Settings → Install LocalBoost** |
| **macOS** (Chrome, Edge) | Același buton de instalare. **Safari 17+:** File → Add to Dock |
| **Android** (Chrome) | Meniu ⋮ → **Install app** (sau butonul din Settings) |
| **iPhone / iPad** (Safari) | Share → **Add to Home Screen** |

Butonul **Install LocalBoost** din Settings folosește promptul nativ când browserul îl oferă; altfel deschide instrucțiunile de mai sus. Wrapper desktop (Tauri/Electron): **nu a fost inclus** — PWA-ul acoperă Windows/macOS/Linux și nu a fost sacrificat pentru el.

## 4. AI real (opțional)

```bash
# PowerShell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
npm start
# opțional: $env:LOCALBOOST_MODEL = "claude-sonnet-5-5"
```

- Cheia se citește **doar în `server.mjs`**; nu există în fișierele din browser (`npm run check` verifică asta).
- Endpoint: `POST /api/ai` cu `{role, lang, payload}`; roluri: `analyst`, `strategist`, `creator`, `builder`.
- Fiecare apel are timeout 8 s în browser (7,5 s pe server); la orice eșec (lipsă cheie, timeout, JSON invalid) se folosește fallback-ul local și interfața spune de ce.
- Test fără cheie reală: `node scripts/mock-ai.mjs` într-un terminal, apoi `ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://localhost:5199 npm start`.
- În Settings → **Simulate an AI problem** poți forța timeout sau eroare pentru repetiții.

## 5. Hosting

Static + o rută: `/preview/:slug` trebuie să servească `preview.html`.

- **Vercel:** `vercel.json` este inclus (rewrite). Proxy-ul `/api/ai` din `server.mjs` nu rulează pe hosting static; fără el aplicația folosește fallback-ul local (un singur request `/api/health` eșuează la prima apelare).
- **Netlify:** `/preview/*  /preview.html  200` în `_redirects`.
- **Node:** `npm start` / `npm run serve:dist` face tot (static, rewrite, API).

Aplicația presupune că este servită de la **rădăcina** domeniului (`/`).

## 6. Linkuri de repetiție

| URL | Efect |
| --- | --- |
| `/?seed=full` | încarcă un demo complet (diagnostic, misiune, website, checkpoint) |
| `/?pitch=1` | deschide Pitch Mode |
| `/?pitch=1&scene=3` | direct în scena 4 |
| `/?pitch=audience&scene=0` | vedere public |
| `/?lang=de&theme=dark` | forțează limba și tema (se salvează) |

## 7. Depanare

- **Modificările nu apar:** ai un service worker vechi. DevTools → Application → Service Workers → Unregister, sau Settings din browser → clear site data.
- **„Offline” apare deși ești online:** badge-ul confirmă cu un request real; dacă persistă, reîncarcă pagina.
- **Fonturile arată altfel offline:** fonturile vin de la Google Fonts și se pun în cache după prima încărcare online; fără ele se folosesc Georgia/system-ui (aplicația rămâne lizibilă).
- **Previzualizarea publică nu se deschide (404):** hostingul nu are rewrite-ul pentru `/preview/*` (vezi secțiunea 5).
