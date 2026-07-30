// Measure the real wood color in each finish photo (wood-classified pixels)
// and crop a wood texture strip for the swatch buttons.
const { chromium } = require('playwright');
const fs = require('fs');

const REFS = [
  // fabricKind drives the wood classifier; badge: region to exclude (walnut award stamp)
  { name: 'oiled-oak', kind: 'rose', railY: [615, 660], railX: [700, 1000] },
  { name: 'soaped-oak', kind: 'grey', railY: [615, 660], railX: [700, 1000] },
  { name: 'walnut', kind: 'grey', railY: [885, 925], railX: [700, 1000], badge: { x: 1400, y: 430 } },
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  fs.mkdirSync('/home/user/sideways-colors/public/wood', { recursive: true });

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
      const rgb2hsv = (r, g, b) => {
        r /= 255; g /= 255; b /= 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), df = mx - mn;
        let h = 0;
        if (df > 0) {
          if (mx === r) h = ((g - b) / df) % 6;
          else if (mx === g) h = (b - r) / df + 2;
          else h = (r - g) / df + 4;
          h *= 60; if (h < 0) h += 360;
        }
        return [h, mx === 0 ? 0 : df / mx, mx];
      };
      let r = 0, g = 0, b = 0, n = 0;
      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          if (ref.badge && px > ref.badge.x - 60 && py < ref.badge.y + 60) continue;
          const i = (py * W + px) * 4;
          if (d[i + 3] < 250) continue;
          const [h, s, v] = rgb2hsv(d[i], d[i + 1], d[i + 2]);
          let isWood;
          if (ref.kind === 'grey') {
            isWood = h >= 10 && h <= 60 && s >= 0.24 && v >= 0.2;
          } else {
            isWood = (h >= 22 && h <= 55 && s >= 0.28 && v >= 0.25) ||
                     (h >= 20 && h <= 55 && s >= 0.2 && v < 0.45);
          }
          if (isWood) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
        }
      }
      const hex = '#' + [r, g, b].map(v => Math.round(v / n).toString(16).padStart(2, '0')).join('');
      // swatch strip from the seat rail
      const sw = document.createElement('canvas');
      const rw = ref.railX[1] - ref.railX[0], rh = ref.railY[1] - ref.railY[0];
      sw.width = 300; sw.height = 90;
      sw.getContext('2d').drawImage(img, ref.railX[0], ref.railY[0], rw, rh, 0, 0, 300, 90);
      return { hex, n, strip: sw.toDataURL('image/jpeg', 0.9) };
    }, { b64, ref });
    fs.writeFileSync(`/home/user/sideways-colors/public/wood/${ref.name}.jpg`,
      Buffer.from(out.strip.split(',')[1], 'base64'));
    console.log(ref.name, 'wood mean', out.hex, `(${out.n}px)`);
  }
  await browser.close();
})();
