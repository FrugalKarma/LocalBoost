# Raport QA — LocalBoost

Verificat pe 17 oct. 2026 cu Chromium (browserul încorporat în Claude Desktop) și Edge headless, Node 24.

## Ce a fost verificat și cum

| # | Test obligatoriu din brief | Rezultat | Cum |
| --- | --- | --- | --- |
| 1 | Pornește fără secrete externe | ✅ | `npm start` fără chei; toate fluxurile merg cu fallback local |
| 2 | Overview cu demo data | ✅ | DEMO DATA pe hero, grafic, review pulse, trend |
| 3 | Schimbarea limbii actualizează tot textul | ✅ | 4 limbi × 10 ecrane + pitch: **0 chei lipsă** (`window.__missingKeys` gol); `npm run check` confirmă 537 de chei identice în ro/en/fr/de, aceleași placeholdere și forme de array |
| 4 | Germana nu produce overflow | ✅ | scan automat de overflow orizontal, 4 limbi × 10 rute, la 320, 375 și 1024 px; plus 7 scene de pitch |
| 5 | Dark mode persistă după refresh | ✅ | `localStorage`, aplicat înainte de primul paint (fără flash) |
| 6 | Mission Control are fallback | ✅ | agenții trec waiting → running → complete/„complete (local)”; mission activă fără AI |
| 7 | Website temporar poate fi generat | ✅ | atât local, cât și cu AI (mock) |
| 8 | Headline editabil | ✅ | apare în preview și în `srcdoc` |
| 9 | Preview mobil funcționează | ✅ | desktop/tabletă/telefon + emulare 375×812 |
| 10 | Formularul de rezervare afișează confirmare | ✅ | click real în iframe: eroare fără consimțământ, confirmare cu consimțământ; cererea se numără în Proof Board. (Bug găsit și reparat: sandbox-ul cerea `allow-forms`.) |
| 11 | Pitch Mode pornește și se închide cu Esc | ✅ | P / Esc |
| 12 | ArrowRight schimbă scena | ✅ | 7/7 scene, plus R (restart), ←, A, F |
| 13 | Manifest valid | ✅ | `npm run check`: câmpuri, iconuri 192/512/maskable cu dimensiuni verificate din antetul PNG |
| 14 | Aplicația poate fi instalată | ⚠️ parțial | manifest + service worker activ + HTTPS/localhost verificate; **promptul nativ de instalare nu poate fi declanșat în browserul încorporat**, deci click-ul „Install” nu a fost văzut efectiv |
| 15 | Demo-ul rulează offline după prima încărcare | ✅ | build `dist/`, SW activ cu 41 de fișiere în cache, **serverul oprit**, pagina reîncărcată, flux complet (analiză → misiune → website) și `/preview/cafeneaua-copou` deschis offline |
| 16 | Nicio acțiune fără handler | ✅ | handler lipsă loghează un warning; niciunul întâlnit. Butoanele „stub” nu există: conectorii neimplementați arată statusul „Not connected” și explică permisiunile |
| 17 | `npm run build` trece | ✅ | `npm run check` + `npm run build` |
| 18 | Fără erori în consolă | ✅ | fluxul complet rulat fără `error`; rămân doar avertismente informative `[LocalBoost] AI unavailable… not_configured` (dezvoltator) |
| 19 | Linkurile/butoanele din pitch funcționează | ✅ | toate scenele, inclusiv butonul din scena 3 |
| 20 | Fallback video/static | ✅ | buton **Static fallback** (animații oprite, conținut local) + `prefers-reduced-motion`; nu există video |

### Alte verificări

- **Timeout AI:** Settings → „Timeout” → analiza se termină la **8,16 s** cu fallback, bannerul explică motivul, butonul rămâne activ, **Retry** funcționează.
- **Cale AI reală:** testată împotriva unui **mock local** al API-ului Anthropic (`scripts/mock-ai.mjs`) care returnează JSON murdar (garduri de cod, virgule finale). Cele 4 roluri → `ok`, JSON reparat și validat, UI-ul arată „AI model”.
- **Securitate website builder:** payload cu `<img onerror>`, `</script><script>`, culori și teme invalide → totul escapat, culorile reduse la valorile implicite, un singur `<script>` (al nostru) în document. Previzualizarea rulează în iframe `sandbox="allow-scripts allow-forms"` (fără `allow-same-origin`).
- **Export:** ZIP creat fără dependențe, 4 fișiere, **CRC32 verificat** pe fiecare intrare; HTML single-file; PNG „pitch card” (canvas).
- **Import CSV:** 2 rânduri importate ca „USER DATA”, separate de DEMO DATA, HTML escapat.
- **Contrast (WCAG):** 19 perechi cheie calculate, **toate ≥ 4,5:1** (minim 5,07; majoritatea > 9).
- **Mobil:** bottom nav (4 secțiuni + Menu), drawer cu overlay care se închide la selecție, scroll-ul paginii neblocat, safe areas, touch targets ≥ 44 px, landscape 812×375.
- **Cod:** nicio cheie API în fișierele din browser (`npm run check`).

## Limite cunoscute (spuse direct)

1. **Fără model real testat.** Nu există `ANTHROPIC_API_KEY` în acest mediu. Calea AI a fost verificată doar cu mock; răspunsul real al modelului poate diferi (validarea + fallback-ul acoperă formatul, nu calitatea textului).
2. **Instalarea PWA** nu a fost executată de la capăt (vezi #14). Safari/iOS (Add to Home Screen) și Firefox **nu au fost testate**.
3. **Fonturi:** se încarcă de la Google Fonts. Offline, fără o vizită anterioară online, se folosesc fonturile de sistem (design ușor diferit, layout intact).
4. **Linkurile de partajare** (`/preview/…#d=…`) conțin configurația paginii în hash și expiră după 72 h; funcționează cu serverul inclus sau un rewrite pe hosting (`vercel.json`).
5. **Voiceover** folosește `speechSynthesis` al browserului (calitatea vocii depinde de sistem); nu există fișiere audio.
6. **Fără wrapper desktop** (Tauri/Electron): PWA-ul acoperă Windows/macOS/Linux.
7. **Ecranul complet** cere un gest al utilizatorului; dacă este refuzat, Pitch Mode funcționează în fereastră.
8. Datele businessului, recenziile și programul sunt **simulate**; adresa și programul din website sunt marcate demo.
