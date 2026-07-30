const { chromium } = require('playwright');
const fs = require('fs');

const PHOTOS = [
  { name: 'sideways-sofa-1', type: 'avif', kind: 'rose', cutY: null },
  { name: 'sideways-sofa-2', type: 'avif', kind: 'rose', cutY: null },
  { name: 'sideways-sofa-3', type: 'avif', kind: 'rose', cutY: null },
  { name: 'sideways-chair-1', type: 'png', kind: 'grey', cutY: 770 },
  { name: 'sideways-chair-2', type: 'png', kind: 'grey', cutY: 715 },
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();

  for (const ph of PHOTOS) {
    const b64 = fs.readFileSync(`/home/user/sideways-colors/public/${ph.name}.${ph.type}`).toString('base64');
    const mime = ph.type === 'avif' ? 'image/avif' : 'image/png';
    const out = await page.evaluate(async ({ b64, mime, kind, cutY }) => {
      const img = new Image();
      img.src = `data:${mime};base64,${b64}`;
      await img.decode();
      const W = img.naturalWidth, H = img.naturalHeight;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, W, H).data;
      const mask = new ImageData(W, H);
      const md = mask.data;

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

      for (let py = 0; py < H; py++) {
        if (cutY !== null && py >= cutY) continue; // floor shadow region
        for (let px = 0; px < W; px++) {
          const i = (py * W + px) * 4;
          const a = d[i + 3];
          if (a < 250) continue;
          const r = d[i], g = d[i + 1], b = d[i + 2];
          if (r > 248 && g > 248 && b > 248) continue;
          const [h, s, v] = rgb2hsv(r, g, b);
          let isWood;
          if (kind === 'grey') {
            // neutral grey fabric: any warm-toned pixel is wood
            isWood = h >= 10 && h <= 60 && s >= 0.24 && v >= 0.2;
          } else {
            // rose fabric (hue < ~20): bright golden oak, or dark shadowed oak
            isWood = (h >= 22 && h <= 55 && s >= 0.28 && v >= 0.25) ||
                     (h >= 20 && h <= 55 && s >= 0.2 && v < 0.45);
          }
          if (!isWood) {
            md[i] = 255; md[i + 1] = 255; md[i + 2] = 255; md[i + 3] = 255;
          }
        }
      }

      const mc = document.createElement('canvas');
      mc.width = W; mc.height = H;
      mc.getContext('2d').putImageData(mask, 0, 0);

      // despeckle: blur then threshold
      const bl = document.createElement('canvas');
      bl.width = W; bl.height = H;
      const blctx = bl.getContext('2d');
      blctx.filter = 'blur(2px)';
      blctx.drawImage(mc, 0, 0);
      const bd = blctx.getImageData(0, 0, W, H);
      for (let i = 0; i < bd.data.length; i += 4) {
        const keep = bd.data[i + 3] > 130;
        bd.data[i] = bd.data[i + 1] = bd.data[i + 2] = keep ? 255 : 0;
        bd.data[i + 3] = keep ? 255 : 0;
      }
      bl.getContext('2d').putImageData(bd, 0, 0);

      // soft edge
      const soft = document.createElement('canvas');
      soft.width = W; soft.height = H;
      const sctx = soft.getContext('2d');
      sctx.filter = 'blur(1px)';
      sctx.drawImage(bl, 0, 0);

      const prev = document.createElement('canvas');
      prev.width = W; prev.height = H;
      const pctx = prev.getContext('2d');
      pctx.fillStyle = '#ffffff';
      pctx.fillRect(0, 0, W, H);
      pctx.drawImage(img, 0, 0);
      pctx.globalAlpha = 0.5;
      const tint = document.createElement('canvas');
      tint.width = W; tint.height = H;
      const tctx = tint.getContext('2d');
      tctx.drawImage(soft, 0, 0);
      tctx.globalCompositeOperation = 'source-in';
      tctx.fillStyle = '#e02020';
      tctx.fillRect(0, 0, W, H);
      pctx.drawImage(tint, 0, 0);

      return { mask: soft.toDataURL('image/png'), preview: prev.toDataURL('image/jpeg', 0.85) };
    }, { b64, mime, kind: ph.kind, cutY: ph.cutY });

    fs.writeFileSync(`/home/user/sideways-colors/public/masks/${ph.name}-mask.png`,
      Buffer.from(out.mask.split(',')[1], 'base64'));
    fs.writeFileSync(`preview-${ph.name}.jpg`,
      Buffer.from(out.preview.split(',')[1], 'base64'));
    console.log(ph.name, 'ok');
  }
  await browser.close();
})();
