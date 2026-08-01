// Generate soft fabric/wood masks for both products in the living room scene.
const { chromium } = require('playwright');
const fs = require('fs');
const REGIONS = require('./lr-regions.js');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const out = await page.evaluate(async (REGIONS) => {
    const W = 1152, H = 928;
    const make = (polys) => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d');
      x.fillStyle = '#fff';
      for (const poly of polys) {
        x.beginPath();
        poly.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
        x.closePath();
        x.fill();
      }
      // soften edges
      const s = document.createElement('canvas');
      s.width = W; s.height = H;
      const sx = s.getContext('2d');
      sx.filter = 'blur(1.5px)';
      sx.drawImage(c, 0, 0);
      return s.toDataURL('image/png');
    };
    const res = {};
    for (const [prod, regs] of Object.entries(REGIONS)) {
      res[prod] = { fabric: make(regs.fabric), wood: make(regs.wood) };
    }
    return res;
  }, REGIONS);
  for (const [prod, m] of Object.entries(out)) {
    fs.writeFileSync(`/home/user/sideways-colors/public/masks/lr-${prod}-fabric.png`,
      Buffer.from(m.fabric.split(',')[1], 'base64'));
    fs.writeFileSync(`/home/user/sideways-colors/public/masks/lr-${prod}-wood.png`,
      Buffer.from(m.wood.split(',')[1], 'base64'));
    console.log(prod, 'masks written');
  }
  await browser.close();
  process.exit(0);
})();
