# Script de pitch — 3 minute (RO + EN)

**Pregătire (10 s):** deschide aplicația instalată → apasă **P** → **Start presentation**. Timerul din dreapta-sus (doar pentru prezentator) arată `mm:ss / 03:00`. **→** = următoarea scenă, **A** = vedere public (fără timer, fără controale, subtitrări mari), **Esc** = ieșire.
Dacă se strică ceva: butonul **Static fallback** oprește animațiile; AI-ul are fallback local la 8 s, deci pitch-ul nu se blochează niciodată.

---

## Scena 1 — The invisible business · 0:00–0:20

**RO:** „Un business bun poate rămâne invizibil. Cafeneaua Copou din Iași are recenzii excelente, 4,7 stele, 2,4 mii de oameni atinși pe lună și un scor de vizibilitate de 78 din 100. Și totuși informațiile sunt împrăștiate: recenzii într-un loc, întrebări în altul, un website care nu spune ce poți face acolo.”

**EN:** “A good business can stay invisible. Cafeneaua Copou in Iași has great reviews, a 4.7 rating and a visibility score of 78 out of 100 — yet its information is scattered.”

*Arată:* scorul 78/100, chip-urile 4.7 / 2.4k / „Semnale amestecate”. *Menționează:* toate cifrele sunt DEMO DATA.

## Scena 2 — The signal · 0:20–0:45

**RO:** „Oamenii apreciază locul, dar nu înțeleg rapid ce pot face acolo între 14:00 și 18:00. Citim ce spun ei: atmosferă plăcută, cafea excelentă — și aceeași întrebare, iar și iar: ce program aveți după-amiaza, aveți mese libere? Iar căutările pentru pauze, lucru și întâlniri mici ating maximul exact în intervalul ăsta.”

*Arată:* cele 3 citate și graficul cu intervalul 14–18 evidențiat.

## Scena 3 — The AI diagnosis · 0:45–1:20

**RO:** „Aici intervine AI-ul. Un click.” *(apasă **Rulează diagnosticul AI**; pașii: citesc, extrag, prioritizez, validez)* „LocalBoost citește semnalele, separă faptele de inferențe și alege **o singură** oportunitate: să facem evidentă pauza de coffee break de după-amiază. Vedem problema, dovada, încrederea și impactul probabil — și ce trebuie să confirme proprietarul. Dacă modelul nu răspunde în 8 secunde, analiza locală preia automat: demo-ul nu se blochează.”

*Arată:* problema + dovada, confidence 82%, oportunitatea, textul „Deterministic local analysis · DEMO DATA” sau „AI model”.

## Scena 4 — The mission · 1:20–1:50

**RO:** „Din oportunitate iese o misiune de 48 de ore: o ipoteză testabilă, publicul țintă — oameni care lucrează remote, studenți, grupuri mici —, o singură ofertă, baseline-ul de 2.400 de persoane atinse și zero rezervări, ținta de plus 15% și cel puțin cinci cereri de rezervare, și un checkpoint peste 48 de ore. Ținta e un obiectiv, nu o promisiune.”

## Scena 5 — The generated action pack · 1:50–2:20

**RO:** „În câteva secunde, proprietarul primește tot ce îi trebuie, și totul spune aceeași poveste: un website temporar editabil, o postare, oferta, un sticker pentru pahare și un buton de rezervare. Nimic nu se publică singur — omul verifică și postează.”

*Opțional (dacă ai 15 s):* Esc → **Temporary Website** → editează headline-ul → **Present website** → arată formularul de rezervare cu confirmarea „cererea demo a fost pregătită”.

## Scena 6 — The measurable outcome · 2:20–2:45

**RO:** „Proof Board: ce am pornit, ce măsurăm, când revenim și ce facem dacă nu funcționează — mutăm oferta mai sus, testăm o ofertă mai concretă, întrebăm cinci oaspeți ce au înțeles. Valorile le introduce proprietarul; LocalBoost nu falsifică rezultate.”

## Scena 7 — The close · 2:45–3:00

**RO:** „LocalBoost nu produce încă un raport. Transformă un semnal local într-o acțiune locală măsurabilă.” *(pauză; mulțumește juriului)*

**EN:** “LocalBoost doesn’t produce another report. It turns a local signal into a measurable local action.”

---

## Răspunsuri scurte pentru întrebări

- **Ce e real și ce e demo?** Aplicația, fluxul, website builder-ul, exporturile, PWA-ul și offline-ul sunt reale. Datele businessului sunt simulate și etichetate. AI-ul real rulează doar cu cheie pe server; fără cheie răspunde fallback-ul local, marcat ca atare.
- **Ce se întâmplă dacă AI-ul nu răspunde?** Timeout 8 s → analiză/misiune/website locale; butonul nu rămâne blocat; apare motivul și **Retry**.
- **Cum instalez?** Settings → Install LocalBoost (Chrome/Edge); iOS: Share → Add to Home Screen.
- **De ce încredere?** Fiecare rezultat arată sursele, ce e fapt vs. inferență și ce trebuie confirmat.
