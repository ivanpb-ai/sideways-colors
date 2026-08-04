// Generate soft fabric/wood masks for both products in the living room scene.
// Fabric masks are refined by color-snapping: within a narrow band around
// the traced polygon boundary, pixels are classified as fabric or not by
// color, so the mask follows the true fabric edge against frame/background.
const { chromium } = require('playwright');
const fs = require('fs');
const REGIONS = require('./lr-regions.js');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const photoB64 = fs.readFileSync('/home/user/sideways-colors/public/living-room.png').toString('base64');
  const out = await page.evaluate(async ({ REGIONS, photoB64 }) => {
    const W = 1152, H = 928;
    const photo = new Image();
    photo.src = 'data:image/png;base64,' + photoB64;
    await photo.decode();
    const pc = document.createElement('canvas');
    pc.width = W; pc.height = H;
    const pctx = pc.getContext('2d');
    pctx.drawImage(photo, 0, 0);
    const pd = pctx.getImageData(0, 0, W, H).data;

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

    // limit snapping to zones where fabric borders the frame — against
    // the wallpaper the traced polygon is more reliable than color
    const SNAP_ZONE = {
      sofa: (px, py) => py > 560 || px < 210 || px > 780,
      chair: (px, py) => (px > 990 && py > 636) || py > 800, // frame/slats and rail only
    };
    // per-product fabric classifier for boundary snapping
    const CLASSIFY = {
      sofa: (h, s, v) => {
        if (h >= 26 && h <= 48 && s >= 0.28 && v >= 0.25) return false; // oak
        if (s < 0.09) return false; // wallpaper/neutral
        return (h >= 305 || h <= 24) && s >= 0.09; // rose fabric
      },
      chair: (h, s, v) => {
        if (h >= 20 && h <= 50 && s >= 0.2) return false; // wood
        if (s <= 0.17 && v >= 0.25) return true; // grey fabric
        // cool blue-grey shadow tones on the fabric (seat lip)
        return h >= 190 && h <= 260 && s <= 0.32 && v >= 0.2;
      },
    };

    const trace = (x, polys) => {
      for (const poly of polys) {
        x.beginPath();
        poly.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
        x.closePath();
        x.fill();
      }
    };
    const strokePolys = (x, polys, lw, op) => {
      x.save();
      x.globalCompositeOperation = op;
      x.lineWidth = lw;
      x.lineJoin = 'round';
      x.strokeStyle = '#fff';
      for (const poly of polys) {
        x.beginPath();
        poly.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
        x.closePath();
        x.stroke();
      }
      x.restore();
    };

    const make = (polys, snapKind) => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d');
      x.fillStyle = '#fff';
      trace(x, polys);

      if (snapKind) {
        // inner core: polygon eroded by ~6px (always fabric)
        const innerC = document.createElement('canvas');
        innerC.width = W; innerC.height = H;
        const ix = innerC.getContext('2d');
        ix.fillStyle = '#fff';
        trace(ix, polys);
        strokePolys(ix, polys, 12, 'destination-out');
        // outer limit: polygon dilated by ~6px
        const outerC = document.createElement('canvas');
        outerC.width = W; outerC.height = H;
        const ox = outerC.getContext('2d');
        ox.fillStyle = '#fff';
        trace(ox, polys);
        strokePolys(ox, polys, 12, 'source-over');

        const inner = ix.getImageData(0, 0, W, H).data;
        const outer = ox.getImageData(0, 0, W, H).data;
        const im = x.getImageData(0, 0, W, H);
        const d = im.data;
        const cls = CLASSIFY[snapKind];
        const zone = SNAP_ZONE[snapKind];
        for (let p = 0; p < W * H; p++) {
          const i = p * 4;
          if (inner[i + 3] > 128) {
            d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 255;
          } else if (outer[i + 3] > 128) {
            const px = p % W, py = (p / W) | 0;
            let on;
            if (zone(px, py)) {
              const [h, s, v] = rgb2hsv(pd[i], pd[i + 1], pd[i + 2]);
              on = cls(h, s, v);
            } else {
              on = d[i + 3] > 128; // keep the traced polygon edge
            }
            d[i] = d[i + 1] = d[i + 2] = on ? 255 : 0;
            d[i + 3] = on ? 255 : 0;
          } else {
            d[i + 3] = 0;
          }
        }
        x.putImageData(im, 0, 0);
        // despeckle the snapped band lightly: blur+threshold
        const t = document.createElement('canvas');
        t.width = W; t.height = H;
        const tx = t.getContext('2d');
        tx.filter = 'blur(1.2px)';
        tx.drawImage(c, 0, 0);
        const td = tx.getImageData(0, 0, W, H);
        for (let i = 0; i < td.data.length; i += 4) {
          const keep = td.data[i + 3] > 120;
          td.data[i] = td.data[i + 1] = td.data[i + 2] = keep ? 255 : 0;
          td.data[i + 3] = keep ? 255 : 0;
        }
        x.clearRect(0, 0, W, H);
        x.putImageData(td, 0, 0);
      }

      const s = document.createElement('canvas');
      s.width = W; s.height = H;
      const sx = s.getContext('2d');
      sx.filter = 'blur(0.7px)';
      sx.drawImage(c, 0, 0);
      return s.toDataURL('image/png');
    };

    const res = {};
    for (const [prod, regs] of Object.entries(REGIONS)) {
      res[prod] = { fabric: make(regs.fabric, prod), wood: make(regs.wood, null) };
    }
    return res;
  }, { REGIONS, photoB64 });

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
