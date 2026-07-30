/* Sideways color configurator — photo-based rendering */

// ---------- state ----------
function defaultConfig(productId) {
  return productId === "sofa"
    ? { fabricId: "fiord", code: "0101" }
    : { fabricId: "clara", code: "0144" };
}

const state = {
  activeProduct: "sofa",
  configs: { sofa: defaultConfig("sofa"), chair: defaultConfig("chair") },
  views: { sofa: 0, chair: 0 },
};

const LS_STATE = "sideways.configs.v2";

function findFabric(fabricId) {
  return FABRICS.find((f) => f.id === fabricId);
}
function findColor(cfg) {
  const fabric = findFabric(cfg.fabricId);
  return fabric && fabric.colors.find((c) => c.code === cfg.code);
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
      if (cfg && findColor(cfg)) state.configs[p.id] = cfg;
      const v = saved.views && saved.views[p.id];
      if (Number.isInteger(v) && v >= 0 && v < p.views.length) state.views[p.id] = v;
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

// ---------- photo renderer ----------
const MAX_W = 1400;
const viewCache = {}; // "product/viewIdx" -> Promise<{w,h,orig,maskData}>

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Kunde inte läsa ${src}`));
    img.src = src;
  });
}

function loadView(productId, viewIdx) {
  const key = `${productId}/${viewIdx}`;
  if (!viewCache[key]) {
    const view = findProduct(productId).views[viewIdx];
    viewCache[key] = Promise.all([loadImage(view.photo), loadImage(view.mask)]).then(
      ([photo, mask]) => {
        const scale = Math.min(1, MAX_W / photo.naturalWidth);
        const w = Math.round(photo.naturalWidth * scale);
        const h = Math.round(photo.naturalHeight * scale);
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        ctx.drawImage(photo, 0, 0, w, h);
        const orig = ctx.getImageData(0, 0, w, h);
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(mask, 0, 0, w, h);
        const maskData = ctx.getImageData(0, 0, w, h);
        // Macro-shading map: lightly blurred so the photo contributes
        // folds and seam shadows while its own weave micro-texture is
        // suppressed (the fabric tile supplies the weave instead).
        ctx.clearRect(0, 0, w, h);
        ctx.filter = "blur(2px)";
        ctx.drawImage(photo, 0, 0, w, h);
        ctx.filter = "none";
        const bd = ctx.getImageData(0, 0, w, h).data;
        const lumMap = new Float32Array(w * h);
        for (let p = 0; p < lumMap.length; p++) {
          const i = p * 4;
          lumMap[p] = (0.2126 * bd[i] + 0.7152 * bd[i + 1] + 0.0722 * bd[i + 2]) / 255;
        }
        // mean fabric luminance — normalizing against it makes the same
        // swatch render equally light on every photo
        const md = maskData.data;
        let sum = 0;
        let weight = 0;
        for (let p = 0; p < lumMap.length; p++) {
          const a = md[p * 4 + 3] / 255;
          if (!a) continue;
          sum += a * lumMap[p];
          weight += a;
        }
        const meanLum = Math.max(0.05, weight ? sum / weight : 0.62);
        return { w, h, orig, maskData, lumMap, meanLum };
      }
    );
  }
  return viewCache[key];
}

// Fabric tiles, cached per "path@size" as tileable ImageData.
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

// Drape the fabric tile over the masked pixels: the tile supplies color
// and weave, the photo's blurred luminance supplies folds and shadows.
function recolor(vc, tile) {
  const out = new ImageData(new Uint8ClampedArray(vc.orig.data), vc.w, vc.h);
  const d = out.data;
  const m = vc.maskData.data;
  const td = tile.data;
  const ts = tile.width;
  for (let y = 0; y < vc.h; y++) {
    const trow = (y % ts) * ts;
    for (let x = 0; x < vc.w; x++) {
      const p = y * vc.w + x;
      const i = p * 4;
      const a = m[i + 3];
      if (!a) continue;
      // at lum == meanLum the fabric renders the tile as-is;
      // the exponent softens shadows/highlights slightly
      const f = Math.pow(vc.lumMap[p] / vc.meanLum, 0.85);
      const ti = (trow + (x % ts)) * 4;
      const t = a / 255;
      d[i] = d[i] * (1 - t) + Math.min(255, td[ti] * f) * t;
      d[i + 1] = d[i + 1] * (1 - t) + Math.min(255, td[ti + 1] * f) * t;
      d[i + 2] = d[i + 2] * (1 - t) + Math.min(255, td[ti + 2] * f) * t;
    }
  }
  return out;
}

const renderToken = {};

async function renderPhoto(productId) {
  const viewIdx = state.views[productId];
  const color = findColor(state.configs[productId]);
  const token = `${viewIdx}/${color.code}/${state.configs[productId].fabricId}`;
  renderToken[productId] = token;
  const product = findProduct(productId);
  const [vc, tile] = await Promise.all([
    loadView(productId, viewIdx),
    loadTile(color.tile, product.tileSize),
  ]);
  if (renderToken[productId] !== token) return; // superseded meanwhile
  const canvas = document.querySelector(`#card-${productId} .photo-view`);
  canvas.width = vc.w;
  canvas.height = vc.h;
  canvas.getContext("2d").putImageData(recolor(vc, tile), 0, 0);
}

// ---------- controls rendering ----------
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
    const card = document.getElementById(`card-${p.id}`);
    const active = state.activeProduct === p.id;
    card.classList.toggle("active", active);
    card.setAttribute("aria-pressed", String(active));
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
      cfg.code = f.colors[0].code;
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
    btn.classList.toggle("active", cfg.code === c.code);
    const img = document.createElement("img");
    img.src = c.tile;
    img.alt = "";
    btn.appendChild(img);
    const label = document.createElement("span");
    label.textContent = c.code;
    btn.appendChild(label);
    btn.addEventListener("click", () => {
      cfg.code = c.code;
      update();
    });
    el.appendChild(btn);
  });

  const color = findColor(cfg);
  document.getElementById("selected-color-label").innerHTML =
    `Vald: <b>${fabric.name} ${color.code}</b>`;
}

function renderViewThumbs(productId) {
  const product = findProduct(productId);
  const el = document.querySelector(`#card-${productId} .view-thumbs`);
  el.innerHTML = "";
  product.views.forEach((v, idx) => {
    const btn = document.createElement("button");
    btn.title = v.label;
    btn.setAttribute("role", "tab");
    btn.classList.toggle("active", state.views[productId] === idx);
    const img = document.createElement("img");
    img.src = v.photo;
    img.alt = v.label;
    btn.appendChild(img);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.views[productId] = idx;
      renderViewThumbs(productId);
      renderPhoto(productId);
      saveState();
    });
    el.appendChild(btn);
  });
}

function renderSummary(productId) {
  const cfg = state.configs[productId];
  const fabric = findFabric(cfg.fabricId);
  document.getElementById(`summary-${productId}`).textContent =
    `${fabric.name} ${cfg.code} · Ek · Naturfärgat pappersgarn`;
}

function renderControls() {
  renderProductTabs();
  renderFabricChips();
  renderColorSwatches();
  saveState();
}

function update() {
  renderControls();
  PRODUCTS.forEach((p) => {
    renderSummary(p.id);
    renderPhoto(p.id);
  });
}

// ---------- events ----------
PRODUCTS.forEach((p) => {
  const card = document.getElementById(`card-${p.id}`);
  const activate = () => {
    state.activeProduct = p.id;
    renderControls();
  };
  card.addEventListener("click", activate);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  });
});

document.getElementById("apply-both").addEventListener("click", () => {
  const src = state.configs[state.activeProduct];
  const other = state.activeProduct === "sofa" ? "chair" : "sofa";
  state.configs[other] = { ...src };
  update();
});

// ---------- init ----------
loadState();
PRODUCTS.forEach((p) => renderViewThumbs(p.id));
update();
