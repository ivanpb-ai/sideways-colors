# Sideways färgväljare

En webbapp för att konfigurera **RF1903-L Sideways Soffa**,
**RF1904 Sideways Loungefåtölj** och **RF1905 Sideways Bord**
(design Rikke Frost för Carl Hansen & Søn), visade fotorealistiskt –
även tillsammans i ett riktigt vardagsrum.

## Funktioner

- **Två visningslägen:** *Produktvyer* (standard) visar soffan och
  fåtöljen som fristående produktfoton med flera vyer per möbel och
  spegelvändning. *I vardagsrummet* visar båda möblerna i rumsfotot
  `public/living-room.png` – klicka på en möbel i bilden för att välja
  vilken som konfigureras. Samma val (tyg, kulör, trä) gäller i båda
  lägena.
- **Fotorealistisk omfärgning med vävstruktur:** tygprovets väv och kulör
  draperas över tygytorna, medan fotots ljus, skuggor och veck bevaras.
  Trästommen färgas om via egna masker med bevarad ådring.
  Vardagsrummets masker genereras av `tools/lr-masks.js` ur två målade
  maskbilder i `tools/mask-sources/` (tyget respektive träet övermålat i
  vitt). Vitt extraheras, städas (brusborttagning, hålfyllnad,
  gap-överbryggning i träet) och delas per möbel; polygonerna i
  `tools/lr-regions.js` används bara för att rösta om vilken möbel varje
  vit komponent tillhör samt som kontinuitetsgaranti för smala trädelar.
- **10 tyger, 326 kulörer:** Canvas 2, Canvas Natur, Capture, Clara 2,
  Divina Melange 3, Fiord 2, Hallingdal 65, Mood, Remix 3 och Re-wool,
  grupperade per tyg i väljaren och sorterade efter färgnummer.
  Färgproverna är beskurna ur Carl Hansens tygbilder, färgnumren är lästa
  ur provbildernas etiketter och varje kulör mäts som provets medelfärg.
- **4 träfinisher, kalibrerade mot referensfoton:** ek olja (fotonas
  original), ek såpa, ek svart och valnöt olja. Kulörerna är uppmätta ur Carl
  Hansens referensfoton av soffan i respektive finish
  (`public/oiled-oak.avif`, `soaped-oak.avif`, `walnut.avif`,
  se `tools/calibrate-wood.js`), och swatch-knapparna visar riktigt trä
  beskuret ur fotona. Träet färgas om via en egen mask med bevarad ådring.
- **Sideways-bordet i tre utföranden:** ek olja, ek olja + svart
  laminat samt vit marmor + valnöt olja. Bordet visas med frilagda
  produktbilder (`tools/table-cutouts.js` skär ut bordet ur
  produktfotona i `public/` och tar bort den vita bakgrunden) och
  komponeras in i vardagsrummet framför soffan med mjuk skugga.
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
