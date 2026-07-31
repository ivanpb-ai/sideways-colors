const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const b64 = fs.readFileSync('/home/user/sideways-colors/public/black-oak.png').toString('base64');
  const out = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, W, H).data;
    // black frame = fully opaque, very dark pixels
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 250) continue;
      if (Math.max(d[i], d[i + 1], d[i + 2]) < 70) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    }
    const hex = '#' + [r, g, b].map(v => Math.round(v / n).toString(16).padStart(2, '0')).join('');
    // find front-left leg via opaque column runs and crop a strip
    const x0 = 80, x1 = 500, y0 = 720, y1 = 790;
    const good = [];
    for (let px = x0; px < x1; px++) {
      let ok = true;
      for (let py = y0; py < y1; py += 4) {
        if (d[(py * W + px) * 4 + 3] < 250) { ok = false; break; }
      }
      good.push(ok);
    }
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
    return { hex, n, legX, legW, strip: s.toDataURL('image/jpeg', 0.9) };
  }, b64);
  fs.writeFileSync('/home/user/sideways-colors/public/wood/black-oak.jpg',
    Buffer.from(out.strip.split(',')[1], 'base64'));
  console.log('black oak mean', out.hex, `(${out.n}px), leg x`, out.legX, 'w', out.legW);
  await browser.close();
})();
