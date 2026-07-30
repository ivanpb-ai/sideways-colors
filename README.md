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

## Kör appen

Ingen byggprocess behövs – öppna `index.html` direkt i webbläsaren, eller
starta en enkel server:

```sh
npx serve .
# eller
python3 -m http.server 8000
```

## Notering om färgerna

Carl Hansens och Kvadrats webbplatser blockerar automatisk hämtning, så
färgproverna i `js/data.js` är handplockade approximationer av de verkliga
Kvadrat- och Gabriel-kulörerna (färgnummer och namn kan avvika något från
den aktuella kollektionen). Justera eller komplettera listorna i
`js/data.js` – varje färg är bara `{ code, name, hex }`.
