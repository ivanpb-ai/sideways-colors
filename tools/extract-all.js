// Extract every swatch from every fabric screenshot: tile, label crop,
// average color, and a 16x16 luminance hash for dedup.
const { chromium } = require('playwright');
const fs = require('fs');

const files = fs.readdirSync('/home/user/sideways-colors/public')
  .filter(f => /^(canvas|canvas-nature|capture|clara|divina-melange|fiord|hallingdal|mood|remix|rewool)(-\d+)?\.png$/.test(f))
  .sort();

const catOf = (f) => f.replace(/(-\d+)?\.png$/, '');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const all = [];

  for (const file of files) {
    const b64 = fs.readFileSync(`/home/user/sideways-colors/public/${file}`).toString('base64');
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
      const colFrac = new Array(W).fill(0);
      for (let px = 0; px < W; px++) {
        let n = 0;
        for (let py = 0; py < H; py += 2) if (!isBg((py * W + px) * 4)) n++;
        colFrac[px] = n / (H / 2);
      }
      const runs = [];
      let start = null;
      for (let px = 0; px < W; px++) {
        if (colFrac[px] > 0.3) { if (start === null) start = px; }
        else if (start !== null) { if (px - start > 100) runs.push([start, px]); start = null; }
      }
      if (start !== null && W - start > 100) runs.push([start, W]);
      const boxes = runs.map(([x0, x1]) => {
        const mid = Math.floor((x0 + x1) / 2);
        let y0 = null, y1 = null;
        for (let py = 0; py < H; py++) {
          if (!isBg((py * W + mid) * 4)) { if (y0 === null) y0 = py; y1 = py; }
        }
        return { x0, x1, y0, y1 };
      });
      return boxes.map((b) => {
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
        // 16x16 luminance hash for dedup
        const hcv = document.createElement('canvas');
        hcv.width = 16; hcv.height = 16;
        hcv.getContext('2d').drawImage(t, 0, 0, 16, 16);
        const hd = hcv.getContext('2d').getImageData(0, 0, 16, 16).data;
        const hash = [];
        for (let i = 0; i < hd.length; i += 4) {
          hash.push(Math.round(0.2126 * hd[i] + 0.7152 * hd[i + 1] + 0.0722 * hd[i + 2]));
        }
        // label crop: bottom-left area, upscaled 3x for OCR
        const lw = Math.floor((b.x1 - b.x0) * 0.6);
        const lh = Math.floor((b.y1 - b.y0) * 0.24);
        const lx = b.x0 + Math.floor((b.x1 - b.x0) * 0.03);
        const ly = b.y1 - lh - Math.floor((b.y1 - b.y0) * 0.03);
        const lc = document.createElement('canvas');
        lc.width = lw * 3; lc.height = lh * 3;
        const lctx = lc.getContext('2d');
        lctx.imageSmoothingEnabled = true;
        lctx.drawImage(img, lx, ly, lw, lh, 0, 0, lw * 3, lh * 3);
        return { tile: t.toDataURL('image/jpeg', 0.9), label: lc.toDataURL('image/png'), hex, hash };
      });
    }, b64);

    out.forEach((s, i) => {
      const id = `${file.replace('.png', '')}_${i}`;
      fs.writeFileSync(`swatch-work/${id}.jpg`, Buffer.from(s.tile.split(',')[1], 'base64'));
      fs.writeFileSync(`swatch-work/${id}-label.png`, Buffer.from(s.label.split(',')[1], 'base64'));
      all.push({ id, file, category: catOf(file), hex: s.hex, hash: s.hash });
    });
    console.log(file, out.length);
  }
  fs.writeFileSync('swatch-work/index.json', JSON.stringify(all));
  console.log('total swatches:', all.length);
  await browser.close();
})();
