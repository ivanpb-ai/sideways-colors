/* Sideways color configurator */

// ---------- state ----------
function defaultConfig() {
  // The reference variant: oak oil, Fiord 551, natural cord
  return { groupId: "group3", fabricId: "fiord2", colorCode: "551", woodId: "oak-oil" };
}

const state = {
  activeProduct: "sofa",
  configs: { sofa: defaultConfig(), chair: defaultConfig() },
};

const LS_STATE = "sideways.configs";

function validConfig(cfg) {
  try {
    return !!(cfg && findColor(cfg) && findWood(cfg.woodId));
  } catch (e) {
    return false;
  }
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_STATE));
    if (!saved) return;
    PRODUCTS.forEach((p) => {
      if (validConfig(saved.configs && saved.configs[p.id])) {
        state.configs[p.id] = saved.configs[p.id];
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
    /* storage full or unavailable */
  }
}

// ---------- helpers ----------
function findGroup(groupId) {
  return FABRIC_GROUPS.find((g) => g.id === groupId);
}
function findFabric(groupId, fabricId) {
  return findGroup(groupId).fabrics.find((f) => f.id === fabricId);
}
function findColor(cfg) {
  return findFabric(cfg.groupId, cfg.fabricId).colors.find((c) => c.code === cfg.colorCode);
}
function findWood(woodId) {
  return WOOD_FINISHES.find((w) => w.id === woodId);
}

// Darken a hex color by a factor (0..1) for shading cushions/frames.
function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// ---------- rendering ----------
function renderProductTabs() {
  const el = document.getElementById("product-tabs");
  el.innerHTML = "";
  PRODUCTS.forEach((p) => {
    const btn = document.createElement("button");
    btn.textContent = p.short;
    btn.classList.toggle("active", state.activeProduct === p.id);
    btn.addEventListener("click", () => {
      state.activeProduct = p.id;
      renderAll();
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

function renderGroupTabs() {
  const cfg = state.configs[state.activeProduct];
  const el = document.getElementById("group-tabs");
  el.innerHTML = "";
  FABRIC_GROUPS.forEach((g) => {
    const btn = document.createElement("button");
    btn.textContent = g.name.replace("Tyggrupp ", "Grupp ");
    btn.classList.toggle("active", cfg.groupId === g.id);
    btn.addEventListener("click", () => {
      cfg.groupId = g.id;
      const firstFabric = g.fabrics[0];
      cfg.fabricId = firstFabric.id;
      cfg.colorCode = firstFabric.colors[0].code;
      renderAll();
    });
    el.appendChild(btn);
  });
}

function renderFabricChips() {
  const cfg = state.configs[state.activeProduct];
  const group = findGroup(cfg.groupId);
  const el = document.getElementById("fabric-chips");
  el.innerHTML = "";
  group.fabrics.forEach((f) => {
    const btn = document.createElement("button");
    btn.innerHTML = `${f.name}<span class="maker">${f.maker}</span>`;
    btn.classList.toggle("active", cfg.fabricId === f.id);
    btn.addEventListener("click", () => {
      cfg.fabricId = f.id;
      cfg.colorCode = f.colors[0].code;
      renderAll();
    });
    el.appendChild(btn);
  });
}

function renderColorSwatches() {
  const cfg = state.configs[state.activeProduct];
  const fabric = findFabric(cfg.groupId, cfg.fabricId);
  const el = document.getElementById("color-swatches");
  el.innerHTML = "";
  fabric.colors.forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "swatch";
    btn.style.background = c.hex;
    btn.title = `${fabric.name} ${c.code} – ${c.name}`;
    btn.setAttribute("aria-label", btn.title);
    btn.classList.toggle("active", cfg.colorCode === c.code);
    btn.addEventListener("click", () => {
      cfg.colorCode = c.code;
      renderAll();
    });
    el.appendChild(btn);
  });

  const color = findColor(cfg);
  document.getElementById("selected-color-label").innerHTML =
    `Vald: <b>${fabric.name} ${color.code}</b> · ${color.name}`;
}

function renderWoodSwatches() {
  const cfg = state.configs[state.activeProduct];
  const el = document.getElementById("wood-swatches");
  el.innerHTML = "";
  WOOD_FINISHES.forEach((w) => {
    const btn = document.createElement("button");
    btn.className = "swatch";
    btn.style.background = `linear-gradient(135deg, ${w.hex}, ${shade(w.hex, 0.82)})`;
    btn.title = w.name;
    btn.setAttribute("aria-label", w.name);
    btn.classList.toggle("active", cfg.woodId === w.id);
    btn.addEventListener("click", () => {
      cfg.woodId = w.id;
      renderAll();
    });
    el.appendChild(btn);
  });

  const label = document.createElement("div");
  label.className = "wood-label";
  label.textContent = `Vald: ${findWood(cfg.woodId).name}`;
  el.appendChild(label);
}

function applyConfigToCard(productId) {
  const cfg = state.configs[productId];
  const card = document.getElementById(`card-${productId}`);
  const color = findColor(cfg);
  const wood = findWood(cfg.woodId);
  card.style.setProperty("--fabric", color.hex);
  card.style.setProperty("--fabric-dark", shade(color.hex, 0.8));
  card.style.setProperty("--wood", wood.hex);
  card.style.setProperty("--wood-dark", shade(wood.hex, 0.78));

  const fabric = findFabric(cfg.groupId, cfg.fabricId);
  const group = findGroup(cfg.groupId);
  document.getElementById(`summary-${productId}`).textContent =
    `${group.name} · ${fabric.name} ${color.code} (${color.name}) · ${wood.name} · Naturfärgat pappersgarn`;

  if (typeof PhotoMode !== "undefined") PhotoMode.refresh(productId, color.hex);
}

function renderAll() {
  renderProductTabs();
  renderGroupTabs();
  renderFabricChips();
  renderColorSwatches();
  renderWoodSwatches();
  applyConfigToCard("sofa");
  applyConfigToCard("chair");
  saveState();
}

// ---------- events ----------
PRODUCTS.forEach((p) => {
  const card = document.getElementById(`card-${p.id}`);
  const activate = () => {
    state.activeProduct = p.id;
    renderAll();
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
  renderAll();
});

loadState();
if (typeof PhotoMode !== "undefined") PhotoMode.init();
renderAll();
