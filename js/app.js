/* Sideways color configurator — product photo views + living room scene */

// ---------- state ----------
function defaultConfig(productId) {
  return productId === "sofa"
    ? { fabricId: "fiord", code: "0101", woodId: "oak-oil" }
    : { fabricId: "clara", code: "0144", woodId: "oak-oil" };
}

const state = {
  mode: "products", // "products" | "scene"
  activeProduct: "sofa", // "sofa" | "chair" | "table"
  configs: { sofa: defaultConfig("sofa"), chair: defaultConfig("chair") },
  table: { finishId: "oak" },
  views: { sofa: 0, chair: 0 },
  flips: { sofa: false, chair: false },
};

const LS_STATE = "sideways.configs.v2";

// UI-only: which fabric's palette is open in the chooser (not persisted).
// null = no fabric picked yet, colors stay hidden.
let fabricBrowse = null;
let fabricBrowseProduct = null;
// UI-only: which sidebar area carries the selection highlight
let activeArea = "wood"; // "wood" | "fabric"

function updateAreaHighlight() {
  document.getElementById("wood-block").classList.toggle("active", activeArea === "wood");
  document.querySelector(".fabric-panel").classList.toggle("active", activeArea === "fabric");
}

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
function findFinish() {
  return TABLE.finishes.find((f) => f.id === state.table.finishId) || TABLE.finishes[0];
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
      const v = saved.views && saved.views[p.id];
      if (Number.isInteger(v) && v >= 0 && v < p.views.length) state.views[p.id] = v;
      if (saved.flips && typeof saved.flips[p.id] === "boolean") {
        state.flips[p.id] = saved.flips[p.id];
      }
    });
    if (
      PRODUCTS.some((p) => p.id === saved.activeProduct) ||
      saved.activeProduct === "table"
    ) {
      state.activeProduct = saved.activeProduct;
    }
    if (saved.table && TABLE.finishes.some((f) => f.id === saved.table.finishId)) {
      state.table.finishId = saved.table.finishId;
    }
    if (saved.mode === "products" || saved.mode === "scene") {
      state.mode = saved.mode;
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

// ---------- shared loading ----------
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Kunde inte läsa ${src}`));
    // cache-bust local assets so regenerated masks are always refetched
    img.src = src.startsWith("public/") ? `${src}?v=${ASSET_VERSION}` : src;
  });
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

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Shared recolor core. Drapes the fabric tile over the fabric mask (tile
// supplies color and weave, blurred luminance supplies folds/shadows) and
// re-tints the wood mask (raw luminance keeps the grain; hex null keeps
// the original oiled oak). Where soft mask edges give near-total combined
// coverage, pixels are replaced with normalized shares so no original
// color bleeds through. tileTransform [a,b,c,d] maps (x,y) to weave (u,v).
function recolorRegion(out, sc, region, tile, woodHex) {
  const d = out.data;
  const od = sc.orig.data;
  const m = region.fabricData.data;
  const wm = region.woodData.data;
  const td = tile.data;
  const ts = tile.width;
  const [ta, tb, tc2, td2] = region.tileTransform || [1, 0, 0, 1];
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

function meanLumOf(maskData, lumMap) {
  let sum = 0;
  let weight = 0;
  for (let p = 0; p < lumMap.length; p++) {
    const a = maskData.data[p * 4 + 3] / 255;
    if (!a) continue;
    sum += a * lumMap[p];
    weight += a;
  }
  return Math.max(0.05, weight ? sum / weight : 0.62);
}

function meanRawLumOf(maskData, orig) {
  const od = orig.data;
  let sum = 0;
  let weight = 0;
  for (let i = 0; i < od.length; i += 4) {
    const a = maskData.data[i + 3] / 255;
    if (!a) continue;
    sum += a * (0.2126 * od[i] + 0.7152 * od[i + 1] + 0.0722 * od[i + 2]) / 255;
    weight += a;
  }
  return Math.max(0.05, weight ? sum / weight : 0.6);
}

function grabImages(photo, masks, w, h) {
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
  // Shading map: mostly blurred (folds and shadows, so the photo's weave
  // doesn't double with the fabric tile's) mixed with some raw luminance
  // to keep the render as crisp as the rest of the photo.
  const blurred = grab(photo, true);
  const lumMap = new Float32Array(w * h);
  for (let p = 0; p < lumMap.length; p++) {
    const i = p * 4;
    const bl =
      (0.2126 * blurred.data[i] + 0.7152 * blurred.data[i + 1] + 0.0722 * blurred.data[i + 2]) / 255;
    const raw =
      (0.2126 * orig.data[i] + 0.7152 * orig.data[i + 1] + 0.0722 * orig.data[i + 2]) / 255;
    lumMap[p] = 0.55 * bl + 0.45 * raw;
  }
  return { orig, lumMap, maskDatas: masks.map((m) => grab(m, false)) };
}

// ---------- product photo renderer ----------
const PRODUCT_MAX_W = 1400;
const THUMB_W = 160;
const viewCache = {}; // "product/viewIdx@width" -> Promise<{w,h,orig,lumMap,region}>

function loadViewAt(productId, viewIdx, maxW) {
  const key = `${productId}/${viewIdx}@${maxW}`;
  if (!viewCache[key]) {
    const view = findProduct(productId).views[viewIdx];
    viewCache[key] = Promise.all([
      loadImage(view.photo),
      loadImage(view.mask),
      loadImage(view.wood),
    ]).then(([photo, mask, woodMask]) => {
      const scale = Math.min(1, maxW / photo.naturalWidth);
      const w = Math.round(photo.naturalWidth * scale);
      const h = Math.round(photo.naturalHeight * scale);
      const { orig, lumMap, maskDatas } = grabImages(photo, [mask, woodMask], w, h);
      const [fabricData, woodData] = maskDatas;
      const region = {
        fabricData,
        woodData,
        meanLum: meanLumOf(fabricData, lumMap),
        meanWoodLum: meanRawLumOf(woodData, orig),
      };
      return { w, h, orig, lumMap, region };
    });
  }
  return viewCache[key];
}

function loadView(productId, viewIdx) {
  return loadViewAt(productId, viewIdx, PRODUCT_MAX_W);
}

const renderToken = {};

async function renderPhoto(productId) {
  const cfg = state.configs[productId];
  const viewIdx = state.views[productId];
  const color = findColor(cfg);
  const wood = findWood(cfg);
  const token = `${viewIdx}/${color.id}/${cfg.fabricId}/${cfg.woodId}`;
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
  const out = new ImageData(new Uint8ClampedArray(vc.orig.data), vc.w, vc.h);
  recolorRegion(out, vc, vc.region, tile, wood.hex);
  canvas.getContext("2d").putImageData(out, 0, 0);
}

// Low-res recolored view thumbnails, so they track the configuration.
const thumbToken = {};

async function renderThumbs(productId) {
  const cfg = state.configs[productId];
  const color = findColor(cfg);
  const wood = findWood(cfg);
  const token = `${color.id}/${cfg.fabricId}/${cfg.woodId}`;
  thumbToken[productId] = token;
  const product = findProduct(productId);
  for (let idx = 0; idx < product.views.length; idx++) {
    const [vc, tile] = await Promise.all([
      loadViewAt(productId, idx, THUMB_W),
      loadTile(color.tile, 16), // tiny tile ≈ swatch average at thumb scale
    ]);
    if (thumbToken[productId] !== token) return; // superseded meanwhile
    const canvas = document.querySelector(
      `#card-${productId} .view-thumbs button:nth-child(${idx + 1}) canvas`
    );
    if (!canvas) return;
    canvas.width = vc.w;
    canvas.height = vc.h;
    const out = new ImageData(new Uint8ClampedArray(vc.orig.data), vc.w, vc.h);
    recolorRegion(out, vc, vc.region, tile, wood.hex);
    canvas.getContext("2d").putImageData(out, 0, 0);
  }
}

// ---------- living room scene renderer ----------
const SCENE_MAX_W = 1800;
let scenePromise = null;

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
      const scale = Math.min(1, SCENE_MAX_W / photo.naturalWidth);
      const w = Math.round(photo.naturalWidth * scale);
      const h = Math.round(photo.naturalHeight * scale);
      const { orig, lumMap, maskDatas } = grabImages(photo, masks, w, h);
      const regions = {};
      names.forEach((n, idx) => {
        const fabricData = maskDatas[idx * 2];
        const woodData = maskDatas[idx * 2 + 1];
        regions[n] = {
          fabricData,
          woodData,
          tileSize: SCENE.regions[n].tileSize,
          tileTransform: SCENE.regions[n].tileTransform,
          meanLum: meanLumOf(fabricData, lumMap),
          meanWoodLum: meanRawLumOf(woodData, { data: orig.data }),
        };
      });
      // both frames share one photo and one light: normalize their wood
      // against a common mean so the same finish matches across the
      // sofa/chair junction instead of shifting brightness per region
      {
        let sum = 0, weight = 0;
        names.forEach((n) => {
          const wd = regions[n].woodData.data;
          const od = orig.data;
          for (let i = 0; i < od.length; i += 4) {
            const a = wd[i + 3] / 255;
            if (!a) continue;
            sum += a * (0.2126 * od[i] + 0.7152 * od[i + 1] + 0.0722 * od[i + 2]) / 255;
            weight += a;
          }
        });
        const shared = Math.max(0.05, weight ? sum / weight : 0.6);
        names.forEach((n) => { regions[n].meanWoodLum = shared; });
      }
      return { w, h, orig, lumMap, regions };
    })();
  }
  return scenePromise;
}

let sceneToken = null;
const tableImgCache = {};

function loadTableImg(src) {
  if (!tableImgCache[src]) tableImgCache[src] = loadImage(src);
  return tableImgCache[src];
}

async function renderScene() {
  const token = JSON.stringify([state.configs, state.table]);
  sceneToken = token;
  const sc = await loadScene();
  const [jobs, tableImg] = await Promise.all([
    Promise.all(
      PRODUCTS.map(async (p) => {
        const cfg = state.configs[p.id];
        const region = sc.regions[p.id];
        const tile = await loadTile(findColor(cfg).tile, region.tileSize);
        return { region, tile, woodHex: findWood(cfg).hex };
      })
    ),
    loadTableImg(findFinish().img),
  ]);
  if (sceneToken !== token) return; // superseded meanwhile
  const canvas = document.getElementById("scene");
  canvas.width = sc.w;
  canvas.height = sc.h;
  const out = new ImageData(new Uint8ClampedArray(sc.orig.data), sc.w, sc.h);
  jobs.forEach((j) => recolorRegion(out, sc, j.region, j.tile, j.woodHex));
  const ctx = canvas.getContext("2d");
  ctx.putImageData(out, 0, 0);

  // composite the table into the scene: soft floor shadow, then cutout
  const t = TABLE.scene;
  const scale = sc.w / 1152; // scene coords are authored at native width
  const tx = t.x * scale, ty = t.y * scale, tw = t.w * scale, th = t.h * scale;
  const g = ctx.createRadialGradient(
    tx + tw / 2, ty + th - 6 * scale, 1,
    tx + tw / 2, ty + th - 6 * scale, tw * 0.5
  );
  g.addColorStop(0, "rgba(30,20,15,0.32)");
  g.addColorStop(0.7, "rgba(30,20,15,0.16)");
  g.addColorStop(1, "rgba(30,20,15,0)");
  ctx.save();
  ctx.translate(tx + tw / 2, ty + th - 6 * scale);
  ctx.scale(1, 0.16);
  ctx.translate(-(tx + tw / 2), -(ty + th - 6 * scale));
  ctx.fillStyle = g;
  ctx.fillRect(tx - tw * 0.2, ty + th - 6 * scale - tw * 0.5, tw * 1.4, tw);
  ctx.restore();
  ctx.drawImage(tableImg, tx, ty, tw, th);
}

// ---------- controls ----------
function renderModeTabs() {
  const el = document.getElementById("mode-tabs");
  el.innerHTML = "";
  [
    { id: "products", label: "Produktvyer" },
    { id: "scene", label: "I vardagsrummet" },
  ].forEach((m) => {
    const btn = document.createElement("button");
    btn.textContent = m.label;
    btn.classList.toggle("active", state.mode === m.id);
    btn.addEventListener("click", () => {
      state.mode = m.id;
      update();
    });
    el.appendChild(btn);
  });
  document.getElementById("stage-products").hidden = state.mode !== "products";
  document.getElementById("stage-scene").hidden = state.mode !== "scene";
}

const SELECTABLE = () => [...PRODUCTS.map((p) => ({ id: p.id, short: p.short })), { id: "table", short: TABLE.short }];

function renderProductTabs() {
  const el = document.getElementById("product-tabs");
  el.innerHTML = "";
  SELECTABLE().forEach((p) => {
    const btn = document.createElement("button");
    btn.textContent = p.short;
    btn.classList.toggle("active", state.activeProduct === p.id);
    btn.addEventListener("click", () => {
      state.activeProduct = p.id;
      renderControls();
    });
    el.appendChild(btn);
  });

  SELECTABLE().forEach((p) => {
    const active = state.activeProduct === p.id;
    const card = document.getElementById(`card-${p.id}`);
    card.classList.toggle("active", active);
    card.setAttribute("aria-pressed", String(active));
    const pick = document.getElementById(`pick-${p.id}`);
    pick.classList.toggle("active", active);
    pick.setAttribute("aria-pressed", String(active));
  });

  // the table is configured by finish; sofa/chair by fabric+color+wood
  const isTable = state.activeProduct === "table";
  document.getElementById("finish-block").hidden = !isTable;
  document.getElementById("fabric-block").hidden = isTable;
  document.getElementById("color-block").hidden = isTable;
  document.getElementById("wood-block").hidden = isTable;
  document.getElementById("apply-block").hidden = isTable;
  document.querySelector(".fabric-panel").hidden = isTable;
}

function renderFinishSwatches() {
  const el = document.getElementById("finish-swatches");
  el.innerHTML = "";
  TABLE.finishes.forEach((f) => {
    const btn = document.createElement("button");
    btn.className = "finish-option";
    btn.classList.toggle("active", state.table.finishId === f.id);
    const img = document.createElement("img");
    img.src = f.img;
    img.alt = "";
    btn.appendChild(img);
    const label = document.createElement("span");
    label.textContent = f.name;
    btn.appendChild(label);
    btn.addEventListener("click", () => {
      state.table.finishId = f.id;
      update();
    });
    el.appendChild(btn);
  });
}

function renderFabricChips() {
  if (state.activeProduct === "table") return;
  // close the palette when the user switches product
  if (fabricBrowseProduct !== state.activeProduct) {
    fabricBrowseProduct = state.activeProduct;
    fabricBrowse = null;
  }
  const el = document.getElementById("fabric-chips");
  el.innerHTML = "";
  FABRICS.forEach((f) => {
    const btn = document.createElement("button");
    btn.textContent = f.name;
    btn.classList.toggle("active", fabricBrowse === f.id);
    btn.addEventListener("click", () => {
      fabricBrowse = fabricBrowse === f.id ? null : f.id;
      update();
    });
    el.appendChild(btn);
  });
  document.getElementById("fabric-info").textContent = fabricBrowse
    ? findFabric(fabricBrowse).info
    : "Välj ett tyg för att visa alla kulörer.";
  updateAreaHighlight();
}

function renderColorSwatches() {
  if (state.activeProduct === "table") return;
  const cfg = state.configs[state.activeProduct];
  document.getElementById("color-block").hidden = !fabricBrowse;
  const el = document.getElementById("color-swatches");
  el.innerHTML = "";
  if (fabricBrowse) {
    const fabric = findFabric(fabricBrowse);
    fabric.colors.forEach((c) => {
      const btn = document.createElement("button");
      btn.className = "swatch";
      btn.title = `${fabric.name} ${c.code}`;
      btn.setAttribute("aria-label", btn.title);
      btn.classList.toggle("active", cfg.fabricId === fabric.id && cfg.code === c.id);
      const img = document.createElement("img");
      img.src = c.tile;
      img.alt = "";
      img.loading = "lazy";
      btn.appendChild(img);
      const label = document.createElement("span");
      label.textContent = c.code;
      btn.appendChild(label);
      btn.addEventListener("click", () => {
        cfg.fabricId = fabric.id;
        cfg.code = c.id;
        update();
      });
      el.appendChild(btn);
    });
  }

  const selFabric = findFabric(cfg.fabricId);
  const color = findColor(cfg);
  document.getElementById("selected-color-label").innerHTML =
    `Vald: <b>${selFabric.name} ${color.code}</b>`;
}

function renderWoodSwatches() {
  if (state.activeProduct === "table") return;
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
    `Vald: <b>${findWood(state.configs[state.activeProduct]).name}</b>`;
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
    const cv = document.createElement("canvas");
    cv.setAttribute("aria-label", v.label);
    btn.appendChild(cv);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.views[productId] = idx;
      renderViewThumbs(productId);
      renderFlip(productId);
      renderPhoto(productId);
      renderThumbs(productId);
      saveState();
    });
    el.appendChild(btn);
  });
}

function renderFlip(productId) {
  const flipped = state.flips[productId];
  const card = document.getElementById(`card-${productId}`);
  card.querySelector(".photo-view").classList.toggle("flipped", flipped);
  card.querySelectorAll(".view-thumbs canvas").forEach((cv) =>
    cv.classList.toggle("flipped", flipped));
  const btn = card.querySelector("[data-role=flip]");
  btn.classList.toggle("active", flipped);
  btn.setAttribute("aria-pressed", String(flipped));
}

function renderSummary(productId) {
  const cfg = state.configs[productId];
  const fabric = findFabric(cfg.fabricId);
  const color = findColor(cfg);
  const flip = state.flips[productId] ? " · Spegelvänd" : "";
  const text = `${fabric.name} ${color.code} · ${findWood(cfg).name} · Naturfärgat pappersgarn`;
  document.getElementById(`summary-${productId}`).textContent = text + flip;
  document.getElementById(`scene-summary-${productId}`).textContent = text;
}

function renderTable() {
  const finish = findFinish();
  document.getElementById("table-photo").src = finish.img;
  const text = finish.name;
  document.getElementById("summary-table").textContent = text;
  document.getElementById("scene-summary-table").textContent = text;
}

function renderControls() {
  renderModeTabs();
  renderProductTabs();
  renderFinishSwatches();
  renderFabricChips();
  renderColorSwatches();
  renderWoodSwatches();
  saveState();
}

function update() {
  renderControls();
  PRODUCTS.forEach((p) => renderSummary(p.id));
  renderTable();
  if (state.mode === "products") {
    PRODUCTS.forEach((p) => {
      renderFlip(p.id);
      renderPhoto(p.id);
      renderThumbs(p.id);
    });
  } else {
    renderScene();
  }
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

  card.querySelector("[data-role=flip]").addEventListener("click", (e) => {
    e.stopPropagation();
    state.flips[p.id] = !state.flips[p.id];
    renderFlip(p.id);
    renderSummary(p.id);
    saveState();
  });

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
  // the table sits in front of everything — check it first
  const t = TABLE.scene;
  const scale = sc.w / 1152;
  if (x >= t.x * scale && x <= (t.x + t.w) * scale &&
      y >= t.y * scale && y <= (t.y + t.h) * scale) {
    state.activeProduct = "table";
    renderControls();
    return;
  }
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

document.getElementById("card-table").addEventListener("click", () => {
  state.activeProduct = "table";
  renderControls();
});
document.getElementById("pick-table").addEventListener("click", () => {
  state.activeProduct = "table";
  renderControls();
});

// only one sidebar area carries the highlight at a time; clicking
// anywhere inside a card (not just its swatches) claims it
document.getElementById("wood-block").addEventListener("click", () => {
  activeArea = "wood";
  updateAreaHighlight();
});
document.querySelector(".fabric-panel").addEventListener("click", () => {
  activeArea = "fabric";
  updateAreaHighlight();
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
