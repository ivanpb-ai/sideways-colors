// Generate soft fabric/wood masks for both products in the living room
// scene from the painted mask sources in tools/mask-sources/:
//   fabric-white.png – the scene with all upholstery painted flat white
//   wood-white.png   – the scene with all visible wood painted white
// The masks follow the paint faithfully. Wood is extracted in two tiers:
// flat white, plus pixels the painting clearly brightened where the base
// photo is plausibly wood (the painted wood is lighter than the photo's).
// The polygons in lr-regions.js are never unioned into a mask: `fabric`
// and `wood` only vote on which product each painted component belongs to,
// and `rim` is the search window for the top-edge snap below.
const { chromium } = require('playwright');
const fs = require('fs');
const REGIONS = require('./lr-regions.js');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const b64 = f => fs.readFileSync(f).toString('base64');
  const out = await page.evaluate(async ({ REGIONS, fabB64, woodB64, baseB64 }) => {
    const W = 1152, H = 928;
    const load = d => new Promise(r => {
      const i = new Image();
      i.onload = () => r(i);
      i.src = 'data:image/png;base64,' + d;
    });
    const [fabImg, woodImg, baseImg] = await Promise.all([load(fabB64), load(woodB64), load(baseB64)]);
    const pix = im => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(im, 0, 0, W, H);
      return x.getImageData(0, 0, W, H).data;
    };
    const rgb2hsv = (r, g, b) => {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), df = mx - mn;
      let h = 0;
      if (df > 0) {
        if (mx === r) h = ((g - b) / df) % 6;
        else if (mx === g) h = (b - r) / df + 2;
        else h = (r - g) / df + 4;
        h *= 60; if (h < 0) h += 360;
      }
      return [h, mx === 0 ? 0 : df / mx, mx / 255];
    };

    // product-voting oracle: traced regions dilated a little
    const rasterize = polys => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d');
      x.fillStyle = '#fff';
      x.strokeStyle = '#fff';
      x.lineWidth = 16;
      x.lineJoin = 'round';
      for (const poly of polys) {
        x.beginPath();
        poly.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
        x.closePath();
        x.fill();
        x.stroke();
      }
      const d = x.getImageData(0, 0, W, H).data;
      const m = new Uint8Array(W * H);
      for (let p = 0; p < W * H; p++) m[p] = d[p * 4 + 3] > 128 ? 1 : 0;
      return m;
    };
    const oracle = {};
    for (const prod of ['sofa', 'chair']) {
      oracle[prod] = {
        fabric: rasterize([...REGIONS[prod].fabric, ...REGIONS[prod].rim]),
        wood: rasterize(REGIONS[prod].wood),
        any: rasterize([...REGIONS[prod].fabric, ...REGIONS[prod].rim, ...REGIONS[prod].wood]),
      };
    }

    const fd = pix(fabImg), wd = pix(woodImg), bd = pix(baseImg);

    // painted-pixel candidates
    const fabWhite = new Uint8Array(W * H);
    const woodWhite = new Uint8Array(W * H);
    for (let p = 0; p < W * H; p++) {
      const i = p * 4;
      if (Math.min(fd[i], fd[i + 1], fd[i + 2]) > 228) fabWhite[p] = 1;
      const mn = Math.min(wd[i], wd[i + 1], wd[i + 2]);
      if (mn > 228) { woodWhite[p] = 1; continue; }
      if (mn > 135) {
        const [, s1] = rgb2hsv(wd[i], wd[i + 1], wd[i + 2]);
        if (s1 < 0.30) {
          const dsum = (wd[i] + wd[i + 1] + wd[i + 2]) - (bd[i] + bd[i + 1] + bd[i + 2]);
          if (dsum > 100) {
            const [hb, sb, vb] = rgb2hsv(bd[i], bd[i + 1], bd[i + 2]);
            if (hb >= 15 && hb <= 55 && sb >= 0.15 && vb >= 0.2) woodWhite[p] = 1;
          }
        }
      }
    }

    const MIN_COMPONENT = 40;

    // split painted pixels into per-product masks by component voting
    const split = (white, kind) => {
      const masks = { sofa: new Uint8Array(W * H), chair: new Uint8Array(W * H) };
      const lab = new Int32Array(W * H);
      const stack = new Int32Array(W * H);
      let dropped = 0;
      for (let s = 0; s < W * H; s++) {
        if (!white[s] || lab[s]) continue;
        let sp = 0, cnt = 0;
        stack[sp++] = s; lab[s] = 1;
        const members = [];
        while (sp) {
          const q = stack[--sp];
          members.push(q); cnt++;
          const qx = q % W;
          for (const dq of [-1, 1, -W, W]) {
            const r = q + dq;
            if (r < 0 || r >= W * H || !white[r] || lab[r]) continue;
            if (Math.abs((r % W) - qx) > 1) continue;
            lab[r] = 1; stack[sp++] = r;
          }
        }
        if (cnt < MIN_COMPONENT) { dropped++; continue; }
        let votes = { sofa: 0, chair: 0 };
        for (const q of members) {
          if (oracle.sofa[kind][q]) votes.sofa++;
          if (oracle.chair[kind][q]) votes.chair++;
        }
        if (!votes.sofa && !votes.chair && kind === 'wood') {
          for (const q of members) {
            if (oracle.sofa.any[q]) votes.sofa++;
            if (oracle.chair.any[q]) votes.chair++;
          }
        }
        if (!votes.sofa && !votes.chair) { dropped++; continue; }
        const target = votes.sofa >= votes.chair ? masks.sofa : masks.chair;
        for (const q of members) target[q] = 1;
      }
      return { masks, dropped };
    };

    // fill enclosed holes; `outside` pixels (the product's fabric) count
    // as reachable exterior so a wood ring can never flood the upholstery
    const fillHoles = (m, outside) => {
      const seen = new Uint8Array(W * H);
      const stack = new Int32Array(W * H);
      let sp = 0;
      const push = p => { if (!m[p] && !seen[p]) { seen[p] = 1; stack[sp++] = p; } };
      for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
      for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
      if (outside) for (let p = 0; p < W * H; p++) if (outside[p]) push(p);
      while (sp) {
        const q = stack[--sp];
        const qx = q % W;
        for (const dq of [-1, 1, -W, W]) {
          const r = q + dq;
          if (r < 0 || r >= W * H || m[r] || seen[r]) continue;
          if (Math.abs((r % W) - qx) > 1) continue;
          seen[r] = 1; stack[sp++] = r;
        }
      }
      let filled = 0;
      for (let p = 0; p < W * H; p++) if (!m[p] && !seen[p]) { m[p] = 1; filled++; }
      return filled;
    };

    // morphological close: bridge small paint gaps, but never into the
    // same product's fabric (keeps the slat-gap/fabric boundary put)
    const closeInto = (m, keepOut) => {
      const draw = src => {
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const x = c.getContext('2d');
        const im = x.createImageData(W, H);
        for (let p = 0; p < W * H; p++) {
          const on = src[p] ? 255 : 0;
          im.data[p * 4] = im.data[p * 4 + 1] = im.data[p * 4 + 2] = on;
          im.data[p * 4 + 3] = on;
        }
        x.putImageData(im, 0, 0);
        return c;
      };
      const pass = (src, thr) => {
        const t = document.createElement('canvas');
        t.width = W; t.height = H;
        const tx = t.getContext('2d');
        tx.filter = 'blur(4px)';
        tx.drawImage(src, 0, 0);
        const td = tx.getImageData(0, 0, W, H).data;
        const o = new Uint8Array(W * H);
        for (let p = 0; p < W * H; p++) o[p] = td[p * 4 + 3] > thr ? 1 : 0;
        return o;
      };
      const dil = pass(draw(m), 20);
      const closed = pass(draw(dil), 235);
      let added = 0;
      for (let p = 0; p < W * H; p++) {
        if (closed[p] && !m[p] && !keepOut[p]) { m[p] = 1; added++; }
      }
      return added;
    };

    const toPng = m => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d');
      const im = x.createImageData(W, H);
      for (let p = 0; p < W * H; p++) {
        const i = p * 4;
        const on = m[p] ? 255 : 0;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = on;
        im.data[i + 3] = on;
      }
      x.putImageData(im, 0, 0);
      const t = document.createElement('canvas');
      t.width = W; t.height = H;
      const tx = t.getContext('2d');
      tx.filter = 'blur(1px)';
      tx.drawImage(c, 0, 0);
      const td = tx.getImageData(0, 0, W, H);
      for (let i = 0; i < td.data.length; i += 4) {
        const keep = td.data[i + 3] > 110;
        td.data[i] = td.data[i + 1] = td.data[i + 2] = keep ? 255 : 0;
        td.data[i + 3] = keep ? 255 : 0;
      }
      tx.putImageData(td, 0, 0);
      const s = document.createElement('canvas');
      s.width = W; s.height = H;
      const sx = s.getContext('2d');
      sx.filter = 'blur(0.7px)';
      sx.drawImage(t, 0, 0);
      return s.toDataURL('image/png');
    };

    // Neither frame has a crest rail – the upholstery rolls straight over
    // the back's top edge – but the painting stops a few px shy of that
    // silhouette on both. Unrecolored, the leftover strip reads as a wood
    // rim glued along the back: a salmon piping on the sofa, a mauve one on
    // the chair. Inside the `rim` search window, take the paint's own top
    // rows as the reference upholstery color and walk each column upwards
    // while the photo still matches it. The first row that doesn't is
    // whatever stands behind the frame, so the fabric ends just below.
    const snapTop = (m, zone) => {
      const TOL = 34; // RGB distance at which we've left the upholstery
      const MAX = 8; // further than the paint could plausibly have missed
      const REF = 4; // rows of paint averaged for the reference color
      let added = 0;
      for (let x = 0; x < W; x++) {
        let y0 = -1;
        for (let y = 0; y < H; y++) {
          const p = y * W + x;
          if (zone[p] && m[p]) { y0 = y; break; }
        }
        if (y0 < 0) continue;
        let rr = 0, rg = 0, rb = 0, n = 0;
        for (let y = y0; y < y0 + REF && y < H; y++) {
          const i = (y * W + x) * 4;
          rr += bd[i]; rg += bd[i + 1]; rb += bd[i + 2]; n++;
        }
        rr /= n; rg /= n; rb /= n;
        let y = y0;
        while (y > 0 && y0 - (y - 1) <= MAX && zone[(y - 1) * W + x]) {
          const i = ((y - 1) * W + x) * 4;
          const dr = bd[i] - rr, dg = bd[i + 1] - rg, db = bd[i + 2] - rb;
          if (Math.sqrt(dr * dr + dg * dg + db * db) > TOL) break;
          y--;
        }
        for (let yy = y; yy < y0; yy++) {
          const p = yy * W + x;
          if (!m[p]) { m[p] = 1; added++; }
        }
      }
      return added;
    };

    const fab = split(fabWhite, 'fabric');
    const wood = split(woodWhite, 'wood');
    const stats = { droppedFabric: fab.dropped, droppedWood: wood.dropped, holes: {} };

    for (const prod of ['sofa', 'chair']) {
      // rasterize() strokes as well as fills, so the band comes out dilated
      // by ~8px – wide enough to bracket both the paint and the silhouette
      stats.holes[prod + 'Snapped'] = snapTop(fab.masks[prod], rasterize(REGIONS[prod].rim));
      stats.holes[prod + 'Fabric'] = fillHoles(fab.masks[prod]);
      stats.holes[prod + 'Bridged'] = closeInto(wood.masks[prod], fab.masks[prod]);
      stats.holes[prod + 'Wood'] = fillHoles(wood.masks[prod], fab.masks[prod]);
      // wood is fine lines painted precisely – in any leftover overlap
      // the wood wins over the broader fabric fill
      let woodWins = 0;
      for (let p = 0; p < W * H; p++) {
        if (wood.masks[prod][p] && fab.masks[prod][p]) { fab.masks[prod][p] = 0; woodWins++; }
      }
      stats.holes[prod + 'WoodWins'] = woodWins;
    }

    // the painted wood lines run a few px fatter than the real members –
    // slim them by ~1px (interiors like the slat panel are hole-filled
    // solid, so only outlines are affected)
    const erode1 = m => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d');
      const im = x.createImageData(W, H);
      for (let p = 0; p < W * H; p++) {
        const on = m[p] ? 255 : 0;
        im.data[p * 4] = im.data[p * 4 + 1] = im.data[p * 4 + 2] = on;
        im.data[p * 4 + 3] = on;
      }
      x.putImageData(im, 0, 0);
      const t = document.createElement('canvas');
      t.width = W; t.height = H;
      const tx = t.getContext('2d');
      tx.filter = 'blur(1px)';
      tx.drawImage(c, 0, 0);
      const td = tx.getImageData(0, 0, W, H).data;
      let removed = 0;
      for (let p = 0; p < W * H; p++) {
        if (m[p] && td[p * 4 + 3] <= 200) { m[p] = 0; removed++; }
      }
      return removed;
    };
    stats.holes.sofaWoodEroded = erode1(wood.masks.sofa);
    stats.holes.chairWoodEroded = erode1(wood.masks.chair);

    // deep shadow stays shadow: recoloring near-black pixels only lifts
    // them unnaturally, and unpainted they read correctly in any finish
    let shadowDropped = 0;
    for (let p = 0; p < W * H; p++) {
      if (!wood.masks.sofa[p] && !wood.masks.chair[p]) continue;
      const i = p * 4;
      if (Math.max(bd[i], bd[i + 1], bd[i + 2]) < 69) {
        wood.masks.sofa[p] = 0;
        wood.masks.chair[p] = 0;
        shadowDropped++;
      }
    }
    stats.holes.shadowDropped = shadowDropped;

    // nothing of the sofa's wood lies right of its end post's outer edge
    const SOFA_WOOD_MAX_X = 856;
    for (let y = 0; y < H; y++) {
      for (let x2 = SOFA_WOOD_MAX_X; x2 < W; x2++) wood.masks.sofa[y * W + x2] = 0;
    }
    // the chair stands in front of the sofa – its masks win any overlap
    let ceded = 0;
    for (let p = 0; p < W * H; p++) {
      if (fab.masks.chair[p] || wood.masks.chair[p]) {
        if (wood.masks.sofa[p]) { wood.masks.sofa[p] = 0; ceded++; }
        if (fab.masks.sofa[p]) { fab.masks.sofa[p] = 0; ceded++; }
      }
    }
    stats.holes.sofaCededToChair = ceded;

    const res = { stats };
    for (const prod of ['sofa', 'chair']) {
      res[prod] = { fabric: toPng(fab.masks[prod]), wood: toPng(wood.masks[prod]) };
    }
    return res;
  }, {
    REGIONS,
    fabB64: b64('/home/user/sideways-colors/tools/mask-sources/fabric-white.png'),
    woodB64: b64('/home/user/sideways-colors/tools/mask-sources/wood-white.png'),
    baseB64: b64('/home/user/sideways-colors/public/living-room.png'),
  });

  console.log('stats:', JSON.stringify(out.stats));
  for (const prod of ['sofa', 'chair']) {
    fs.writeFileSync(`/home/user/sideways-colors/public/masks/lr-${prod}-fabric.png`,
      Buffer.from(out[prod].fabric.split(',')[1], 'base64'));
    fs.writeFileSync(`/home/user/sideways-colors/public/masks/lr-${prod}-wood.png`,
      Buffer.from(out[prod].wood.split(',')[1], 'base64'));
    console.log(prod, 'masks written');
  }
  await browser.close();
  process.exit(0);
})();
