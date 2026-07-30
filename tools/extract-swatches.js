// Detect swatch squares in the fabric screenshots, crop clean tiles
// (avoiding the label text in the lower-left), compute average colors.
const { chromium } = require('playwright');
const fs = require('fs');

const FILES = ['canvas', 'canvas-nature', 'capture', 'clara', 'fiord', 'mood', 'remix', 'rewool'];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  fs.mkdirSync('/home/user/sideways-colors/public/fabrics', { recursive: true });
  const results = {};

  for (const name of FILES) {
    const b64 = fs.readFileSync(`/home/user/sideways-colors/public/${name}.png`).toString('base64');
    const out = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const W = img.naturalWidth, H = img.naturalHeight;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const data = x.getImageData(0, 0, W, H).data;
      const isBg = (i) => {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        return a < 128 || (r > 235 && g > 235 && b > 235);
      };
      // column projection: fraction of non-background pixels
      const colFrac = new Array(W).fill(0);
      for (let px = 0; px < W; px++) {
        let n = 0;
        for (let py = 0; py < H; py += 2) if (!isBg((py * W + px) * 4)) n++;
        colFrac[px] = n / (H / 2);
      }
      // find horizontal runs of columns that are mostly content
      const runs = [];
      let start = null;
      for (let px = 0; px < W; px++) {
        if (colFrac[px] > 0.3) { if (start === null) start = px; }
        else if (start !== null) { if (px - start > 100) runs.push([start, px]); start = null; }
      }
      if (start !== null && W - start > 100) runs.push([start, W]);
      // vertical extent per run
      const boxes = runs.map(([x0, x1]) => {
        const mid = Math.floor((x0 + x1) / 2);
        let y0 = null, y1 = null;
        for (let py = 0; py < H; py++) {
          if (!isBg((py * W + mid) * 4)) { if (y0 === null) y0 = py; y1 = py; }
        }
        return { x0, x1, y0, y1 };
      });
      // crop a clean tile: inset 8px; take a square from the TOP part
      // (label text sits in the lower-left), then average color
      const tiles = boxes.map((b) => {
        const inset = 8;
        const bw = b.x1 - b.x0 - inset * 2;
        const bh = b.y1 - b.y0 - inset * 2;
        const size = Math.min(bw, Math.floor(bh * 0.6), 640);
        const sx = b.x0 + inset + Math.floor((bw - size) / 2);
        const sy = b.y0 + inset;
        const t = document.createElement('canvas');
        t.width = 512; t.height = 512;
        t.getContext('2d').drawImage(img, sx, sy, size, size, 0, 0, 512, 512);
        const td = t.getContext('2d').getImageData(0, 0, 512, 512).data;
        let r = 0, g = 0, bl = 0, n = 0;
        for (let i = 0; i < td.length; i += 16) { r += td[i]; g += td[i + 1]; bl += td[i + 2]; n++; }
        const hex = '#' + [r, g, bl].map(v => Math.round(v / n).toString(16).padStart(2, '0')).join('');
        return { dataURL: t.toDataURL('image/jpeg', 0.9), hex, box: b };
      });
      return tiles;
    }, b64);

    results[name] = out.map((t, i) => {
      const file = `${name}-${i + 1}.jpg`;
      fs.writeFileSync(`/home/user/sideways-colors/public/fabrics/${file}`,
        Buffer.from(t.dataURL.split(',')[1], 'base64'));
      return { file, hex: t.hex, box: t.box };
    });
    console.log(name, JSON.stringify(results[name].map(r => ({ f: r.file, hex: r.hex }))));
  }
  fs.writeFileSync('swatches.json', JSON.stringify(results, null, 2));
  await browser.close();
})();
