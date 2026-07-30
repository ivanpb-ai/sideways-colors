// Find the front-left leg by scanning for fully-opaque column runs, crop it,
// rotate to a horizontal strip for the wood swatch buttons.
const { chromium } = require('playwright');
const fs = require('fs');
const REFS = [
  { name: 'oiled-oak', xr: [150, 500], yr: [700, 820] },
  { name: 'soaped-oak', xr: [150, 500], yr: [700, 820] },
  { name: 'walnut', xr: [250, 600], yr: [950, 1100] },
];
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  for (const ref of REFS) {
    const b64 = fs.readFileSync(`/home/user/sideways-colors/public/${ref.name}.avif`).toString('base64');
    const out = await page.evaluate(async ({ b64, ref }) => {
      const img = new Image();
      img.src = 'data:image/avif;base64,' + b64;
      await img.decode();
      const W = img.naturalWidth, H = img.naturalHeight;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, W, H).data;
      const [x0, x1] = ref.xr, [y0, y1] = ref.yr;
      // columns where every sampled row is opaque
      const good = [];
      for (let px = x0; px < x1; px++) {
        let ok = true;
        for (let py = y0; py < y1; py += 4) {
          if (d[(py * W + px) * 4 + 3] < 250) { ok = false; break; }
        }
        good.push(ok);
      }
      // largest run
      let best = [0, 0], cur = null;
      for (let i = 0; i <= good.length; i++) {
        if (i < good.length && good[i]) { if (cur === null) cur = i; }
        else if (cur !== null) { if (i - cur > best[1] - best[0]) best = [cur, i]; cur = null; }
      }
      const legX = x0 + best[0] + 2, legW = (best[1] - best[0]) - 4;
      const s = document.createElement('canvas');
      s.width = 300; s.height = 90;
      const sx = s.getContext('2d');
      sx.translate(150, 45);
      sx.rotate(Math.PI / 2);
      sx.drawImage(img, legX, y0, legW, y1 - y0, -45, -150, 90, 300);
      return { strip: s.toDataURL('image/jpeg', 0.9), legX, legW };
    }, { b64, ref });
    fs.writeFileSync(`/home/user/sideways-colors/public/wood/${ref.name}.jpg`,
      Buffer.from(out.strip.split(',')[1], 'base64'));
    console.log(ref.name, 'leg at x', out.legX, 'width', out.legW);
  }
  await browser.close();
})();
