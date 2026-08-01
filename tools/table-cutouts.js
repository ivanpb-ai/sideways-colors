// Cut the RF1905 table out of the white-background product screenshots.
// Background is removed by flood fill from the borders so enclosed bright
// areas (marble/laminate top) are preserved.
const { chromium } = require('playwright');
const fs = require('fs');

const TABLES = [
  { file: 'oiled-oak-table.jpg', id: 'oak', crop: { x: 10, y: 710, w: 1060, h: 1040 } },
  { file: 'oiled-oak-and-black-laminate-table.jpg', id: 'oak-laminate', crop: { x: 10, y: 710, w: 1060, h: 1040 } },
  { file: 'white-marble-and-oiled-walnut-table.jpg', id: 'marble-walnut', crop: { x: 10, y: 625, w: 1060, h: 1045 }, topEllipse: { cx: 530, cy: 309, rx: 488, ry: 58 } },
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  fs.mkdirSync('/home/user/sideways-colors/public/table', { recursive: true });

  for (const t of TABLES) {
    const b64 = fs.readFileSync(`/home/user/sideways-colors/public/${t.file}`).toString('base64');
    const out = await page.evaluate(async ({ b64, crop, topEllipse }) => {
      const img = new Image();
      img.src = 'data:image/jpeg;base64,' + b64;
      await img.decode();
      const W = crop.w, H = crop.h;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d');
      x.drawImage(img, crop.x, crop.y, W, H, 0, 0, W, H);
      const im = x.getImageData(0, 0, W, H);
      const d = im.data;
      // flood fill near-white background from the borders
      const isBg = (i) => Math.min(d[i], d[i + 1], d[i + 2]) > 222;
      const visited = new Uint8Array(W * H);
      const stack = [];
      for (let px = 0; px < W; px++) { stack.push(px); stack.push((H - 1) * W + px); }
      for (let py = 0; py < H; py++) { stack.push(py * W); stack.push(py * W + W - 1); }
      while (stack.length) {
        const p = stack.pop();
        if (visited[p]) continue;
        visited[p] = 1;
        if (!isBg(p * 4)) continue;
        d[p * 4 + 3] = 0;
        const px = p % W, py = (p / W) | 0;
        if (px > 0) stack.push(p - 1);
        if (px < W - 1) stack.push(p + 1);
        if (py > 0) stack.push(p - W);
        if (py < H - 1) stack.push(p + W);
      }
      // second pass: eat light-grey shadow fringes (lower half only, so
      // the bright table tops are never touched)
      {
        const isFringe = (i, py) => py > H * 0.55 &&
          Math.min(d[i], d[i + 1], d[i + 2]) > 188 &&
          (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])) < 26;
        const st2 = [];
        for (let p = 0; p < W * H; p++) if (d[p * 4 + 3] === 0) st2.push(p);
        while (st2.length) {
          const p = st2.pop();
          const px = p % W, py = (p / W) | 0;
          for (const q of [p - 1, p + 1, p - W, p + W]) {
            if (q < 0 || q >= W * H) continue;
            const qx = q % W;
            if (Math.abs(qx - px) > 1) continue;
            const qy = (q / W) | 0;
            if (d[q * 4 + 3] !== 0 && isFringe(q * 4, qy)) {
              d[q * 4 + 3] = 0;
              st2.push(q);
            }
          }
        }
      }
      // background is also visible THROUGH the table (between the top
      // and the lower shelf, and through the rim slits) — those regions
      // are enclosed by the silhouette so the border flood never reaches
      // them. Clear large enclosed near-white components; small bright
      // spots (specular highlights, brass) are kept.
      {
        const isWhite = (i) => Math.min(d[i], d[i + 1], d[i + 2]) > 218;
        const seen = new Uint8Array(W * H);
        for (let start = 0; start < W * H; start++) {
          if (seen[start] || d[start * 4 + 3] === 0 || !isWhite(start * 4)) continue;
          const comp = [];
          const st = [start];
          seen[start] = 1;
          let touchesBorder = false;
          while (st.length) {
            const p = st.pop();
            comp.push(p);
            const px = p % W, py = (p / W) | 0;
            if (px === 0 || px === W - 1 || py === 0 || py === H - 1) touchesBorder = true;
            for (const q of [p - 1, p + 1, p - W, p + W]) {
              if (q < 0 || q >= W * H || seen[q]) continue;
              const qx = q % W;
              if (Math.abs(qx - px) > 1) continue;
              if (d[q * 4 + 3] !== 0 && isWhite(q * 4)) { seen[q] = 1; st.push(q); }
            }
          }
          if (!touchesBorder && comp.length >= 300) {
            for (const p of comp) d[p * 4 + 3] = 0;
          }
        }
      }
      // the marble top reads as background (white on white, connected
      // through the rim gaps) — restore it via an explicit ellipse
      if (topEllipse) {
        const { cx, cy, rx, ry } = topEllipse;
        for (let py = Math.max(0, cy - ry); py <= Math.min(H - 1, cy + ry); py++) {
          for (let px = Math.max(0, cx - rx); px <= Math.min(W - 1, cx + rx); px++) {
            const nx = (px - cx) / rx, ny = (py - cy) / ry;
            if (nx * nx + ny * ny <= 1) d[(py * W + px) * 4 + 3] = 255;
          }
        }
      }
      x.putImageData(im, 0, 0);
      // tight bbox of remaining alpha
      let minX = W, maxX = 0, minY = H, maxY = 0;
      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          if (d[(py * W + px) * 4 + 3] > 10) {
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
          }
        }
      }
      const bw = maxX - minX + 1, bh = maxY - minY + 1;
      const outC = document.createElement('canvas');
      const scale = Math.min(1, 800 / bw);
      outC.width = Math.round(bw * scale);
      outC.height = Math.round(bh * scale);
      const ox = outC.getContext('2d');
      ox.drawImage(c, minX, minY, bw, bh, 0, 0, outC.width, outC.height);
      return { png: outC.toDataURL('image/png'), bw, bh };
    }, { b64, crop: t.crop, topEllipse: t.topEllipse });
    fs.writeFileSync(`/home/user/sideways-colors/public/table/${t.id}.png`,
      Buffer.from(out.png.split(',')[1], 'base64'));
    console.log(t.id, `bbox ${out.bw}x${out.bh}`);
  }
  await browser.close();
})();
