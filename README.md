# Sideways färgväljare

En webbapp för att välja tygfärg för **RF1903-L Sideways Soffa** och
**RF1904 Sideways Loungefåtölj** (design Rikke Frost för Carl Hansen & Søn),
med fotorealistisk visning baserad på riktiga produktfoton.

## Funktioner

- **Fotorealistisk omfärgning med vävstruktur:** produktfotona (`public/`)
  färgas om direkt i webbläsaren. Tygprovets väv och kulör draperas över
  tygytorna, medan fotots ljus, skuggor och veck bevaras – så resultatet
  ser ut som ett riktigt produktfoto även för grova vävar som Capture och
  Canvas Natur. Ek-stommen och pappersgarnet påverkas inte.
- **Flera vyer:** soffan har tre vyer (framifrån, snett framifrån, bakifrån)
  och fåtöljen två. Även tyget som syns mellan ryggens träribbor färgas om.
- **10 tyger, 326 kulörer:** Canvas 2, Canvas Natur, Capture, Clara 2,
  Divina Melange 3, Fiord 2, Hallingdal 65, Mood, Remix 3 och Re-wool,
  grupperade per tyg i väljaren och sorterade efter färgnummer.
  Färgproverna är beskurna ur Carl Hansens tygbilder, färgnumren är lästa
  ur provbildernas etiketter och varje kulör mäts som provets medelfärg.
- **3 träfinisher, kalibrerade mot referensfoton:** ek olja (fotonas
  original), ek såpa och valnöt olja. Kulörerna är uppmätta ur Carl
  Hansens referensfoton av soffan i respektive finish
  (`public/oiled-oak.avif`, `soaped-oak.avif`, `walnut.avif`,
  se `tools/calibrate-wood.js`), och swatch-knapparna visar riktigt trä
  beskuret ur fotona. Träet färgas om via en egen mask med bevarad ådring.
- Soffan och fåtöljen konfigureras var för sig, med en knapp för att
  använda samma val på båda. Alla val sparas lokalt i webbläsaren.

## Kör appen

Ingen byggprocess behövs, men fotona läses via `fetch`/canvas så appen bör
serveras över HTTP:

```sh
npx serve .
# eller
python3 -m http.server 8000
```

Öppna sedan `http://localhost:8000`.

## Så fungerar omfärgningen

1. `tools/make-masks.js` klassificerar varje pixel i produktfotona som
   tyg, trä eller bakgrund (HSV-regler per foto, med skuggbortfall och
   despeckling) och sparar mjuka tyg- och trämasker i `public/masks/`.
2. Tygpipelinen: `tools/extract-all.js` hittar alla provrutor i
   skärmbilderna och beskär rena tiles, `tools/dedupe.js` tar bort
   dubbletter från överlappande karusellsidor (perceptuell hash),
   `tools/ocr.js` läser färgnumren ur etiketterna (tesseract.js) och
   `tools/build-fabrics.js` applicerar manuellt verifierade korrigeringar
   och bygger `public/fabrics/` + tyglistan i `js/data.js`.
3. I appen ritas fotot till en canvas. För maskerade pixlar hämtas färg
   och väv från tygprovet (kaklat i produktanpassad skala), som moduleras
   med fotots lätt utsuddade luminans – fotot bidrar med veck och skuggor,
   tygprovet med väv och kulör (`js/app.js`, funktionen `recolor`).
   Luminansen normaliseras mot varje fotos egen tygyta så att samma prov
   blir exakt lika ljust på soffan och fåtöljen.

Skripten körs med Node + Playwright (`npm i playwright`) och behöver bara
köras om ifall foton eller tygbilder byts ut.

## Struktur

```
index.html          – sida och layout
css/styles.css      – stilar
js/data.js          – produkter, vyer, tyger och kulörer
js/app.js           – tillstånd, kontroller och omfärgningsmotor
public/             – produktfoton och tygbilder (från Carl Hansen)
public/fabrics/     – beskurna tygprover (genererade)
public/masks/       – tygmasker för fotona (genererade)
tools/              – genereringsskript för masker och tygprover
```

Produktfoton och tygbilder är Carl Hansen & Søns material – använd appen
privat och publicera inte bilderna vidare.
