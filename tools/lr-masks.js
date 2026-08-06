// Generate soft fabric/wood masks for both products in the living room
// scene from the painted mask sources in tools/mask-sources/:
//   fabric-white.png – the scene with all upholstery painted flat white
//   wood-white.png   – the scene with all visible wood painted flat white
// White pixels are extracted, cleaned up (despeckle, enclosed-hole fill)
// and split per product. The hand-traced polygons in lr-regions.js are
// no longer the masks themselves – they only vote on which product each
// white component belongs to.
const { chromium } = require('playwright');
const fs = require('fs');
const REGIONS = require('./lr-regions.js');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const b64 = f => fs.readFileSync(f).toString('base64');
  const out = await page.evaluate(async ({ REGIONS, fabB64, woodB64 }) => {
    const W = 1152, H = 928;
    const load = d => new Promise(r => {
      const i = new Image();
      i.onload = () => r(i);
      i.src = 'data:image/png;base64,' + d;
    });
    const [fabImg, woodImg] = await Promise.all([load(fabB64), load(woodB64)]);
    const pix = im => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(im, 0, 0, W, H);
      return x.getImageData(0, 0, W, H).data;
    };

    // rasterize each product's polygons, dilated a little, as the
    // component-to-product voting oracle
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
        fabric: rasterize(REGIONS[prod].fabric),
        wood: rasterize(REGIONS[prod].wood),
        any: rasterize([...REGIONS[prod].fabric, ...REGIONS[prod].wood]),
      };
    }
    // exact (undilated) wood polygons – unioned into the painted wood
    // below, so thin members (rails, posts) stay continuous even where
    // the paint is patchy
    const rasterizeExact = polys => {
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
      const d = x.getImageData(0, 0, W, H).data;
      const m = new Uint8Array(W * H);
      for (let p = 0; p < W * H; p++) m[p] = d[p * 4 + 3] > 128 ? 1 : 0;
      return m;
    };
    const polyWood = {
      sofa: rasterizeExact(REGIONS.sofa.wood),
      chair: rasterizeExact(REGIONS.chair.wood),
    };

    const MIN_COMPONENT = 40; // px – drop speckle below this

    const extract = (data, kind) => {
      // 1) threshold: painted-white pixels
      const white = new Uint8Array(W * H);
      for (let p = 0; p < W * H; p++) {
        const i = p * 4;
        if (Math.min(data[i], data[i + 1], data[i + 2]) > 230) white[p] = 1;
      }
      // 2) connected components; vote each onto a product (or drop it)
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
            if (Math.abs((r % W) - qx) > 1) continue; // no row wrap
            lab[r] = 1; stack[sp++] = r;
          }
        }
        if (cnt < MIN_COMPONENT) { dropped++; continue; }
        // majority vote against the polygon oracles. Wood fragments with
        // no same-kind overlap fall back to the product's whole region;
        // fabric has no fallback (the fabric behind the slat gaps is
        // rendered as part of the wood panel, like before).
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
        if (!votes.sofa && !votes.chair) { dropped++; continue; } // scene white, not furniture
        const target = votes.sofa >= votes.chair ? masks.sofa : masks.chair;
        for (const q of members) target[q] = 1;
      }
      return { masks, dropped };
    };

    // 3) fill enclosed holes: shading creases inside the painted white,
    // and for the wood panel also the slat gaps (rendered as wood, whose
    // luminance-preserving recolor keeps them reading as shadowed depth).
    // `outside` pixels (the same product's fabric) count as reachable
    // exterior, so a closed wood ring around the upholstery can never
    // flood-fill the fabric itself.
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

    // 3b) morphological close (bridge gaps in the painted wood, e.g.
    // where brush strokes missed parts of a rail) – but never into the
    // same product's fabric, so the slat-gap/fabric boundary stays put
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
        tx.filter = 'blur(5px)';
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

    // 4) light despeckle + soft edge, then export
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

    const fab = extract(pix(fabImg), 'fabric');
    const wood = extract(pix(woodImg), 'wood');
    // carve painted-fabric spill that is really wood (see fabricCarve)
    for (const prod of ['sofa', 'chair']) {
      if (!REGIONS[prod].fabricCarve) continue;
      const carve = rasterizeExact(REGIONS[prod].fabricCarve);
      for (let p = 0; p < W * H; p++) if (carve[p]) fab.masks[prod][p] = 0;
    }
    const stats = { droppedFabric: fab.dropped, droppedWood: wood.dropped, holes: {} };
    // allowed reach of each product's wood: the traced regions dilated
    // ~9px – the paint refines placement inside this bound, but slop
    // (e.g. brush strokes on the carpet) cannot escape it
    const woodBound = {};
    for (const prod of ['sofa', 'chair']) {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d');
      x.fillStyle = '#fff';
      x.strokeStyle = '#fff';
      x.lineWidth = 18;
      x.lineJoin = 'round';
      for (const poly of REGIONS[prod].wood) {
        x.beginPath();
        poly.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
        x.closePath();
        x.fill();
        x.stroke();
      }
      const d = x.getImageData(0, 0, W, H).data;
      const m = new Uint8Array(W * H);
      for (let p = 0; p < W * H; p++) m[p] = d[p * 4 + 3] > 128 ? 1 : 0;
      woodBound[prod] = m;
    }
    for (const prod of ['sofa', 'chair']) {
      stats.holes[prod + 'Fabric'] = fillHoles(fab.masks[prod]);
      stats.holes[prod + 'Bridged'] = closeInto(wood.masks[prod], fab.masks[prod]);
      // union in the traced wood, except where the painted fabric wins
      let unioned = 0;
      const wm = wood.masks[prod], pw = polyWood[prod];
      for (let p = 0; p < W * H; p++) {
        if (pw[p] && !wm[p] && !fab.masks.sofa[p] && !fab.masks.chair[p]) { wm[p] = 1; unioned++; }
      }
      stats.holes[prod + 'PolyUnion'] = unioned;
      stats.holes[prod + 'Wood'] = fillHoles(wood.masks[prod], fab.masks[prod]);
      let bounded = 0;
      const bound = woodBound[prod];
      for (let p = 0; p < W * H; p++) if (wm[p] && !bound[p]) { wm[p] = 0; bounded++; }
      stats.holes[prod + 'Bounded'] = bounded;
    }
    // the chair stands in front of the sofa's right end – in any overlap
    // the chair's masks win, so sofa wood/fabric cannot bleed onto it
    let ceded = 0;
    for (let p = 0; p < W * H; p++) {
      if (fab.masks.chair[p] || wood.masks.chair[p]) {
        if (wood.masks.sofa[p]) { wood.masks.sofa[p] = 0; ceded++; }
        if (fab.masks.sofa[p]) { fab.masks.sofa[p] = 0; ceded++; }
      }
    }
    stats.holes.sofaCededToChair = ceded;
    const res = {};
    for (const prod of ['sofa', 'chair']) {
      res[prod] = { fabric: toPng(fab.masks[prod]), wood: toPng(wood.masks[prod]) };
    }
    res.stats = stats;
    return res;
  }, {
    REGIONS,
    fabB64: b64('/home/user/sideways-colors/tools/mask-sources/fabric-white.png'),
    woodB64: b64('/home/user/sideways-colors/tools/mask-sources/wood-white.png'),
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
