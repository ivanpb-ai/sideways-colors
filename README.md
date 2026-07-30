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
- **8 tyger med riktiga tygprover:** Canvas 2, Canvas Natur, Capture,
  Clara 2, Fiord 2, Mood, Remix 3 och Re-wool. Färgproverna i väljaren är
  beskurna ur Carl Hansens tygbilder och varje kulör hämtas som provets
  uppmätta medelfärg.
- Soffan och fåtöljen konfigureras var för sig, med en knapp för att
  använda samma tyg på båda. Alla val sparas lokalt i webbläsaren.

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
   tyg eller trä/bakgrund (HSV-regler per foto, med skuggbortfall och
   despeckling) och sparar mjuka masker i `public/masks/`.
2. `tools/extract-swatches.js` hittar tygproverna i skärmbilderna,
   beskär rena provrutor till `public/fabrics/` och mäter medelfärgen.
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
