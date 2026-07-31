/* Sideways color configurator — living room scene rendering */

// ---------- state ----------
function defaultConfig(productId) {
  return productId === "sofa"
    ? { fabricId: "fiord", code: "0101", woodId: "oak-oil" }
    : { fabricId: "clara", code: "0144", woodId: "oak-oil" };
}

const state = {
  activeProduct: "sofa",
  configs: { sofa: defaultConfig("sofa"), chair: defaultConfig("chair") },
};

const LS_STATE = "sideways.configs.v2";

function findFabric(fabricId) {
  return FABRICS.find((f) => f.id === fabricId);
}
// cfg.code holds the color's unique id (equal to the printed code except
// for source-label duplicates, e.g. Divina Melange "0457b")
function findColor(cfg) {
  const fabric = findFabric(cfg.fabricId);
  return fabric && fabric.colors.find((c) => c.id === cfg.code);
}
function findWood(cfg) {
  return WOOD_FINISHES.find((w) => w.id === cfg.woodId);
}
function findProduct(productId) {
  return PRODUCTS.find((p) => p.id === productId);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_STATE));
    if (!saved) return;
    PRODUCTS.forEach((p) => {
      const cfg = saved.configs && saved.configs[p.id];
      if (cfg && findColor(cfg)) {
        if (!findWood(cfg)) cfg.woodId = "oak-oil";
        state.configs[p.id] = cfg;
      }
    });
    if (PRODUCTS.some((p) => p.id === saved.activeProduct)) {
      state.activeProduct = saved.activeProduct;
    }
  } catch (e) {
    /* corrupt state — keep defaults */
  }
}

function saveState() {
  try {
    localStorage.setItem(LS_STATE, JSON.stringify(state));
  } catch (e) {
    /* storage unavailable */
  }
}

// ---------- scene loading ----------
const MAX_W = 1800;
let scenePromise = null;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Kunde inte läsa ${src}`));
    img.src = src;
  });
}

function loadScene() {
  if (!scenePromise) {
    scenePromise = (async () => {
      const names = Object.keys(SCENE.regions);
      const [photo, ...masks] = await Promise.all([
        loadImage(SCENE.photo),
        ...names.flatMap((n) => [
          loadImage(SCENE.regions[n].fabric),
          loadImage(SCENE.regions[n].wood),
        ]),
      ]);
      const scale = Math.min(1, MAX_W / photo.naturalWidth);
      const w = Math.round(photo.naturalWidth * scale);
      const h = Math.round(photo.naturalHeight * scale);
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.canvas.width = w;
      ctx.canvas.height = h;
      const grab = (img, blur) => {
        ctx.clearRect(0, 0, w, h);
        ctx.filter = blur ? "blur(2px)" : "none";
        ctx.drawImage(img, 0, 0, w, h);
        ctx.filter = "none";
        return ctx.getImageData(0, 0, w, h);
      };
      const orig = grab(photo, false);
      // macro shading for fabric: blurred so the scene's own weave doesn't
      // double with the fabric tile's
      const blurred = grab(photo, true);
      const lumMap = new Float32Array(w * h);
      for (let p = 0; p < lumMap.length; p++) {
        const i = p * 4;
        lumMap[p] =
          (0.2126 * blurred.data[i] + 0.7152 * blurred.data[i + 1] + 0.0722 * blurred.data[i + 2]) / 255;
      }
      const od = orig.data;
      const regions = {};
      names.forEach((n, idx) => {
        const fabricData = grab(masks[idx * 2], false);
        const woodData = grab(masks[idx * 2 + 1], false);
        let fSum = 0, fW = 0, wSum = 0, wW = 0;
        for (let p = 0; p < lumMap.length; p++) {
          const i = p * 4;
          const af = fabricData.data[i + 3] / 255;
          if (af) {
            fSum += af * lumMap[p];
            fW += af;
          }
          const aw = woodData.data[i + 3] / 255;
          if (aw) {
            wSum += aw * (0.2126 * od[i] + 0.7152 * od[i + 1] + 0.0722 * od[i + 2]) / 255;
            wW += aw;
          }
        }
        regions[n] = {
          fabricData,
          woodData,
          tileSize: SCENE.regions[n].tileSize,
          tileTransform: SCENE.regions[n].tileTransform || [1, 0, 0, 1],
          meanLum: Math.max(0.05, fW ? fSum / fW : 0.62),
          meanWoodLum: Math.max(0.05, wW ? wSum / wW : 0.6),
        };
      });
      return { w, h, orig, lumMap, regions };
    })();
  }
  return scenePromise;
}

// ---------- fabric tiles ----------
const tileCache = {};

function loadTile(path, size) {
  const key = `${path}@${size}`;
  if (!tileCache[key]) {
    tileCache[key] = loadImage(path).then((img) => {
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      c.getContext("2d").drawImage(img, 0, 0, size, size);
      return c.getContext("2d").getImageData(0, 0, size, size);
    });
  }
  return tileCache[key];
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---------- rendering ----------
// Per region: drape the fabric tile over the fabric mask (tile supplies
// color and weave, the scene's blurred luminance supplies folds/shadows)
// and re-tint the wood mask (raw luminance keeps the grain). Where the
// soft mask edges make combined coverage near-total, replace the pixel
// with normalized shares so no original color bleeds through.
function recolorScene(sc, jobs) {
  const out = new ImageData(new Uint8ClampedArray(sc.orig.data), sc.w, sc.h);
  const d = out.data;
  const od = sc.orig.data;
  for (const job of jobs) {
    const { region, tile, woodHex } = job;
    const m = region.fabricData.data;
    const wm = region.woodData.data;
    const td = tile.data;
    const ts = tile.width;
    const [ta, tb, tc2, td2] = region.tileTransform;
    const wc = woodHex ? hexToRgb(woodHex) : null;
    for (let y = 0; y < sc.h; y++) {
      for (let x = 0; x < sc.w; x++) {
        const p = y * sc.w + x;
        const i = p * 4;
        const af = m[i + 3];
        const aw = wm[i + 3];
        if (!af && !aw) continue;

        let fr = 0, fg = 0, fb = 0;
        if (af) {
          const f = Math.pow(sc.lumMap[p] / region.meanLum, 0.85);
          // perspective-approximating weave coordinates
          const u = ((Math.round(ta * x + tb * y) % ts) + ts) % ts;
          const v = ((Math.round(tc2 * x + td2 * y) % ts) + ts) % ts;
          const ti = (v * ts + u) * 4;
          fr = Math.min(255, td[ti] * f);
          fg = Math.min(255, td[ti + 1] * f);
          fb = Math.min(255, td[ti + 2] * f);
        }
        let wr = od[i], wg = od[i + 1], wb = od[i + 2];
        if (wc && aw) {
          const rawLum = (0.2126 * od[i] + 0.7152 * od[i + 1] + 0.0722 * od[i + 2]) / 255;
          const f = Math.pow(rawLum / region.meanWoodLum, 0.9);
          wr = Math.min(255, wc[0] * f);
          wg = Math.min(255, wc[1] * f);
          wb = Math.min(255, wc[2] * f);
        }

        const total = af + aw;
        if (total >= 230) {
          const sF = af / total;
          const sW = 1 - sF;
          d[i] = fr * sF + wr * sW;
          d[i + 1] = fg * sF + wg * sW;
          d[i + 2] = fb * sF + wb * sW;
        } else {
          const tF = af / 255;
          const tW = (aw / 255) * (1 - tF);
          d[i] = od[i] * (1 - tF - tW) + fr * tF + wr * tW;
          d[i + 1] = od[i + 1] * (1 - tF - tW) + fg * tF + wg * tW;
          d[i + 2] = od[i + 2] * (1 - tF - tW) + fb * tF + wb * tW;
        }
      }
    }
  }
  return out;
}

let renderTokenValue = null;

async function renderScene() {
  const token = JSON.stringify(state.configs);
  renderTokenValue = token;
  const sc = await loadScene();
  const jobs = await Promise.all(
    PRODUCTS.map(async (p) => {
      const cfg = state.configs[p.id];
      const color = findColor(cfg);
      const region = sc.regions[p.id];
      const tile = await loadTile(color.tile, region.tileSize);
      return { region, tile, woodHex: findWood(cfg).hex };
    })
  );
  if (renderTokenValue !== token) return; // superseded meanwhile
  const canvas = document.getElementById("scene");
  canvas.width = sc.w;
  canvas.height = sc.h;
  canvas.getContext("2d").putImageData(recolorScene(sc, jobs), 0, 0);
}

// ---------- controls ----------
function renderProductTabs() {
  const el = document.getElementById("product-tabs");
  el.innerHTML = "";
  PRODUCTS.forEach((p) => {
    const btn = document.createElement("button");
    btn.textContent = p.short;
    btn.classList.toggle("active", state.activeProduct === p.id);
    btn.addEventListener("click", () => {
      state.activeProduct = p.id;
      renderControls();
    });
    el.appendChild(btn);
  });

  PRODUCTS.forEach((p) => {
    const pick = document.getElementById(`pick-${p.id}`);
    const active = state.activeProduct === p.id;
    pick.classList.toggle("active", active);
    pick.setAttribute("aria-pressed", String(active));
  });
}

function renderFabricChips() {
  const cfg = state.configs[state.activeProduct];
  const el = document.getElementById("fabric-chips");
  el.innerHTML = "";
  FABRICS.forEach((f) => {
    const btn = document.createElement("button");
    btn.textContent = f.name;
    btn.classList.toggle("active", cfg.fabricId === f.id);
    btn.addEventListener("click", () => {
      cfg.fabricId = f.id;
      cfg.code = f.colors[0].id;
      update();
    });
    el.appendChild(btn);
  });
  document.getElementById("fabric-info").textContent = findFabric(cfg.fabricId).info;
}

function renderColorSwatches() {
  const cfg = state.configs[state.activeProduct];
  const fabric = findFabric(cfg.fabricId);
  const el = document.getElementById("color-swatches");
  el.innerHTML = "";
  fabric.colors.forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "swatch";
    btn.title = `${fabric.name} ${c.code}`;
    btn.setAttribute("aria-label", btn.title);
    btn.classList.toggle("active", cfg.code === c.id);
    const img = document.createElement("img");
    img.src = c.tile;
    img.alt = "";
    img.loading = "lazy";
    btn.appendChild(img);
    const label = document.createElement("span");
    label.textContent = c.code;
    btn.appendChild(label);
    btn.addEventListener("click", () => {
      cfg.code = c.id;
      update();
    });
    el.appendChild(btn);
  });

  const color = findColor(cfg);
  document.getElementById("selected-color-label").innerHTML =
    `Vald: <b>${fabric.name} ${color.code}</b>`;
}

function renderWoodSwatches() {
  const cfg = state.configs[state.activeProduct];
  const el = document.getElementById("wood-swatches");
  el.innerHTML = "";
  WOOD_FINISHES.forEach((w) => {
    const btn = document.createElement("button");
    btn.className = "swatch wood-swatch";
    btn.title = w.name;
    btn.setAttribute("aria-label", w.name);
    btn.classList.toggle("active", cfg.woodId === w.id);
    const img = document.createElement("img");
    img.className = "wood-block";
    img.src = w.swatchImg;
    img.alt = "";
    btn.appendChild(img);
    btn.addEventListener("click", () => {
      cfg.woodId = w.id;
      update();
    });
    el.appendChild(btn);
  });
  document.getElementById("selected-wood-label").innerHTML =
    `Vald: <b>${findWood(cfg).name}</b>`;
}

function renderSummary(productId) {
  const cfg = state.configs[productId];
  const fabric = findFabric(cfg.fabricId);
  const color = findColor(cfg);
  document.getElementById(`summary-${productId}`).textContent =
    `${fabric.name} ${color.code} · ${findWood(cfg).name} · Naturfärgat pappersgarn`;
}

function renderControls() {
  renderProductTabs();
  renderFabricChips();
  renderColorSwatches();
  renderWoodSwatches();
  saveState();
}

function update() {
  renderControls();
  PRODUCTS.forEach((p) => renderSummary(p.id));
  renderScene();
}

// ---------- events ----------
PRODUCTS.forEach((p) => {
  document.getElementById(`pick-${p.id}`).addEventListener("click", () => {
    state.activeProduct = p.id;
    renderControls();
  });
});

// click a piece of furniture in the scene to configure it
document.getElementById("scene").addEventListener("click", async (e) => {
  const sc = await loadScene();
  const canvas = e.currentTarget;
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * sc.w);
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * sc.h);
  const i = (y * sc.w + x) * 4 + 3;
  for (const p of PRODUCTS) {
    const r = sc.regions[p.id];
    if (r.fabricData.data[i] > 40 || r.woodData.data[i] > 40) {
      state.activeProduct = p.id;
      renderControls();
      return;
    }
  }
});

document.getElementById("apply-both").addEventListener("click", () => {
  const src = state.configs[state.activeProduct];
  const other = state.activeProduct === "sofa" ? "chair" : "sofa";
  state.configs[other] = { ...src };
  update();
});

// ---------- init ----------
loadState();
update();
