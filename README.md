# LocalBoost — Signal-to-Action OS

Aplicație web (PWA) pentru IMM-uri locale: **Observe → Diagnose → Act → Measure**.
Transformă semnale despre un business (recenzii, întrebări, audit de website, căutări) într-o **misiune concretă de 48 de ore**, cu website temporar, ofertă, postare, concept de merch și un checkpoint de măsurare.

Business demo: **Cafeneaua Copou** (Iași), fictiv. Toate cifrele sunt etichetate **DEMO DATA**.

## What's new in v1.0-redesign

- **New design ("Copou Ledger")**: colour-coded journey tabs (Home · Observe · Analyse · Act · Measure) instead of the sidebar, map-first Home, burgundy palette, light and dark, 5 languages.
- **Ask LocalBoost**: open questions answered by Claude on the server (`/api/chat`, streamed), grounded in the business data. Default model `claude-haiku-5-5`. Without `ANTHROPIC_API_KEY` the panel says AI is not set up and links to the right screen.
- **What works, what is blocked and how to unblock it:** [docs/GAP_REPORT.md](docs/GAP_REPORT.md).

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | enables real AI (server only) |
| `LOCALBOOST_MODEL` / `LOCALBOOST_CHAT_MODEL` | model override (default `claude-haiku-5-5`) |
| `LOCALBOOST_ALLOWED_ORIGINS` | extra origins allowed to call the API (default: the Capacitor app) |
| `LOCALBOOST_IP_LIMIT` / `LOCALBOOST_DAILY_LIMIT` | questions per visitor per hour / per day (default 40 / 800) |

> Note: sections below describe the previous version in places (sidebar, Pitch Mode). The gap report lists what is outdated.

## Pornire rapidă

Necesită doar Node.js ≥ 18. **Zero dependențe npm.**

```bash
npm start
```

Deschide http://localhost:5173. Aplicația funcționează imediat, fără chei și fără internet după prima încărcare.

| Comandă | Ce face |
| --- | --- |
| `npm start` | server static + proxy AI pe server (port 5173, `PORT=...` pentru altul) |
| `npm run check` | sintaxă JS, paritate i18n (4 limbi), chei folosite, manifest/iconuri, precache SW, fără secrete în browser |
| `npm run build` | rulează verificările și produce `dist/` cu versiune hash pentru service worker |
| `npm run serve:dist` | servește `dist/` (varianta de livrare, cu cache offline) |
| `npm run icons` | regenerează iconurile PNG (192/512/maskable) |
| `npm run screenshots` | capturi pentru submission în `docs/screenshots/` (Edge/Chrome headless) |

## Demo pentru juriu: totul pornește gol

La prima deschidere aplicația **nu arată nicio dată**. Presenterul apasă pe rând: **Load sample business** → **Collect signals** → **Run AI analysis** → **Start mission** → **Generate website** etc. Pașii care au nevoie de date refuză politicos dacă nu au fost apăsate butoanele anterioare. Fontul este **Lexend**; sidebar-ul se ascunde după selecție și apare la hover pe marginea stângă (pe telefon: butonul cu bare). Generatorul de website are 7 teme de culoare (altă paletă decât aplicația), 3 fonturi, 3 stiluri de colțuri și nu afișează „DEMO DATA”.

## AI real (opțional)

```bash
set ANTHROPIC_API_KEY=...        # PowerShell: $env:ANTHROPIC_API_KEY="..."
npm start
```

Cheia rămâne **pe server**; browserul nu o vede. Fără cheie, fiecare pas AI folosește un fallback local determinist și interfața o spune explicit. Detalii în [docs/AI_TOOLS.md](docs/AI_TOOLS.md).

## Pitch în 10 secunde

Apasă **P** oriunde → **Start presentation** → **→** pentru următoarea scenă. **A** = vedere public, **R** = restart, **F** = ecran complet, **Esc** = ieșire. Scriptul de 3 minute: [docs/PITCH_SCRIPT.md](docs/PITCH_SCRIPT.md).

Linkuri utile pentru repetiții: `/?seed=full` încarcă un demo complet; `/?pitch=1&scene=2` deschide direct scena 3; `?lang=de&theme=dark` forțează limba/tema.

## Documentație

- [docs/SETUP.md](docs/SETUP.md) — instalare, PWA pe telefon și PC, hosting, depanare
- [docs/AI_TOOLS.md](docs/AI_TOOLS.md) — tooluri AI folosite și contribuția AI
- [docs/PITCH_SCRIPT.md](docs/PITCH_SCRIPT.md) — scriptul de 3 minute (RO + EN)
- [docs/QA_REPORT.md](docs/QA_REPORT.md) — ce s-a testat, cum și ce **nu** s-a putut verifica
- [docs/screenshots/](docs/screenshots/) — capturi pentru submission

## Structură

```
index.html, preview.html   shell + pagina publică /preview/cafeneaua-copou
css/styles.css             design system Burgundy Field Intelligence (light + dark)
js/app.js                  shell, router, evenimente globale
js/ai.js, prompts.js       4 roluri AI, timeout 8 s, reparare JSON, fallback local
js/mission.js              orchestrarea agenților
js/siteTemplate.js         generator de website (sanitizat), folosit și de preview/export
js/website.js              copy rezolvat, share link, export ZIP/HTML/PNG
js/pitch.js                Pitch Mode (7 scene, presenter + audience)
js/locales/{ro,en,fr,de}.js  traduceri complete
js/views/*                 Overview, Signals, Diagnosis, Mission, Website, Pack, Proof, Pitch, Settings, Account
sw.js, manifest.json       PWA offline + instalabil
server.mjs                 server static + /api/ai (cheia rămâne pe server)
```

## Android

LocalBoost-debug.apk (semnat debug) se instaleaza direct pe telefon. Rebuild: JDK din Android Studio (jbr) + Android SDK, apoi 
pm run android:sync ?i, �n folderul ndroid/, gradlew assembleDebug. APK-ul include aplica?ia offline; AI-ul real cere un server (vezi docs/SETUP.md), altfel folose?te fallback-ul local.
