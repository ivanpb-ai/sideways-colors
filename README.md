# Sideways färgväljare

En webbapp för att välja tygfärg och träfinish för **RF1903 Sideways Soffa**
och **RF1904 Sideways Loungefåtölj** (design Rikke Frost för Carl Hansen & Søn).

## Funktioner

- Stiliserade illustrationer av båda möblerna som uppdateras direkt när du
  ändrar tyg, färg eller träslag.
- Tygvalen är organiserade enligt Carl Hansens tyggrupper:
  - **Tyggrupp 1:** Clara 2, Remix 3, Capture, Focus Royal, Mood, Passion
  - **Tyggrupp 2:** Re-wool 2
  - **Tyggrupp 3:** Fiord 2, Hallingdal 65
  - **Tyggrupp 4:** Divina Melange 3, Keiga
- Träfinish: ek olja, ek vitolja, ek rökfärgad olja samt valnöt olja.
- Soffan och fåtöljen konfigureras var för sig, med en knapp för att kopiera
  valet till båda.
- Startläget motsvarar referensvarianten: ek olja, Fiord 551, naturfärgat
  pappersgarn.
- **Fotoläge (fotorealistiskt):** ladda upp eller dra in ett riktigt
  produktfoto på ett produktkort, måla en gång över tyget/dynorna med
  penselverktyget – därefter färgas fotot om fotorealistiskt för varje
  tygfärg du väljer. Omfärgningen bevarar fotots ljus, skuggor och
  tygstruktur (luminansen behålls, kulören byts). Foto, mask och dina
  färgval sparas lokalt i webbläsaren (localStorage).

## Kör appen

Ingen byggprocess behövs – öppna `index.html` direkt i webbläsaren, eller
starta en enkel server:

```sh
npx serve .
# eller
python3 -m http.server 8000
```

## Fotoläge – tips

1. Spara ett produktfoto från t.ex. Carl Hansens produktsida i din
   webbläsare (högerklicka → spara bild). Välj gärna ett foto där möbeln
   har ett ljust, jämnt belyst tyg – det ger bäst omfärgningsresultat.
2. Dra in bilden på soffans eller fåtöljens kort i appen (eller klicka
   "Ladda upp foto").
3. Maskeditorn öppnas automatiskt: måla över allt tyg (dynor, bolster).
   Använd "Sudda" för att korrigera och reglaget för penselstorlek.
   Klicka "Klar" när du är nöjd – masken behöver bara målas en gång.
4. Välj tyg och färg som vanligt; fotot färgas om direkt.

Observera att produktfoton från Carl Hansen m.fl. är upphovsrättsskyddade –
använd dem privat i appen, publicera dem inte vidare.

## Notering om färgerna

Carl Hansens och Kvadrats webbplatser blockerar automatisk hämtning, så
färgproverna i `js/data.js` är handplockade approximationer av de verkliga
Kvadrat- och Gabriel-kulörerna (färgnummer och namn kan avvika något från
den aktuella kollektionen). Justera eller komplettera listorna i
`js/data.js` – varje färg är bara `{ code, name, hex }`.
