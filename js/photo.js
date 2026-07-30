/*
 * Photo mode: photorealistic recoloring of user-supplied product photos.
 *
 * The user uploads a photo per product, paints a one-time mask over the
 * upholstery, and the app re-tints the masked pixels with the selected
 * fabric color while preserving the photo's lighting and texture.
 * Photo and mask persist in localStorage.
 */

const PhotoMode = (() => {
  const MAX_W = 1400;
  const LS_PHOTO = (id) => `sideways.photo.${id}`;
  const LS_MASK = (id) => `sideways.mask.${id}`;

  // productId -> { w, h, orig: ImageData, mask: HTMLCanvasElement,
  //                maskData: ImageData, editing, brushMode, brushSize }
  const items = {};
  // Kept outside items: the app reports the fabric color before the photo
  // has finished loading (async), and it must survive photo removal/reload.
  const lastHex = {};

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function card(productId) {
    return document.getElementById(`card-${productId}`);
  }
  function q(productId, sel) {
    return card(productId).querySelector(sel);
  }

  // ---------- photo loading ----------

  function setPhotoFromDataURL(productId, dataURL, { persist = true } = {}) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_W / img.naturalWidth);
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);

        const work = document.createElement("canvas");
        work.width = w;
        work.height = h;
        const wctx = work.getContext("2d");
        wctx.drawImage(img, 0, 0, w, h);

        const item = items[productId] || {};
        item.w = w;
        item.h = h;
        item.orig = wctx.getImageData(0, 0, w, h);

        if (!item.mask || item.mask.width !== w || item.mask.height !== h) {
          item.mask = document.createElement("canvas");
          item.mask.width = w;
          item.mask.height = h;
        }
        item.maskData = item.mask.getContext("2d").getImageData(0, 0, w, h);
        item.editing = false;
        item.brushMode = item.brushMode || "paint";
        item.brushSize = item.brushSize || 36;
        items[productId] = item;

        const view = q(productId, ".photo-view");
        view.width = w;
        view.height = h;

        if (persist) {
          try {
            localStorage.setItem(LS_PHOTO(productId), work.toDataURL("image/jpeg", 0.85));
          } catch (e) {
            console.warn("Kunde inte spara fotot i localStorage:", e);
          }
        }
        updateUI(productId);
        refresh(productId);
        resolve();
      };
      img.onerror = reject;
      img.src = dataURL;
    });
  }

  function removePhoto(productId) {
    delete items[productId];
    localStorage.removeItem(LS_PHOTO(productId));
    localStorage.removeItem(LS_MASK(productId));
    updateUI(productId);
  }

  // ---------- mask persistence ----------

  function saveMask(productId) {
    const item = items[productId];
    if (!item) return;
    try {
      localStorage.setItem(LS_MASK(productId), item.mask.toDataURL("image/png"));
    } catch (e) {
      console.warn("Kunde inte spara masken i localStorage:", e);
    }
  }

  function loadMask(productId) {
    const item = items[productId];
    const dataURL = localStorage.getItem(LS_MASK(productId));
    if (!item || !dataURL) return Promise.resolve();
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const ctx = item.mask.getContext("2d");
        ctx.clearRect(0, 0, item.w, item.h);
        ctx.drawImage(img, 0, 0, item.w, item.h);
        item.maskData = ctx.getImageData(0, 0, item.w, item.h);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = dataURL;
    });
  }

  // ---------- rendering ----------

  // Re-tint masked pixels: keep the photo's luminance (shadows, folds,
  // texture) and replace the chroma with the target fabric color.
  function recolor(item, hex) {
    const out = new ImageData(new Uint8ClampedArray(item.orig.data), item.w, item.h);
    const d = out.data;
    const m = item.maskData.data;
    const [tr, tg, tb] = hexToRgb(hex);
    for (let i = 0; i < d.length; i += 4) {
      const a = m[i + 3];
      if (!a) continue;
      const lum = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      // 0.62 ≈ reference mid-tone so the target color reads true in even light
      const f = Math.pow(lum, 0.85) / 0.62;
      const t = a / 255;
      d[i] = d[i] * (1 - t) + Math.min(255, tr * f) * t;
      d[i + 1] = d[i + 1] * (1 - t) + Math.min(255, tg * f) * t;
      d[i + 2] = d[i + 2] * (1 - t) + Math.min(255, tb * f) * t;
    }
    return out;
  }

  function refresh(productId, hex) {
    if (hex) lastHex[productId] = hex;
    const item = items[productId];
    if (!item) return;
    const view = q(productId, ".photo-view");
    const ctx = view.getContext("2d");

    if (item.editing) {
      // photo + translucent red mask overlay while painting
      ctx.putImageData(item.orig, 0, 0);
      const tint = document.createElement("canvas");
      tint.width = item.w;
      tint.height = item.h;
      const tctx = tint.getContext("2d");
      tctx.drawImage(item.mask, 0, 0);
      tctx.globalCompositeOperation = "source-in";
      tctx.fillStyle = "#e03a2f";
      tctx.fillRect(0, 0, item.w, item.h);
      ctx.globalAlpha = 0.45;
      ctx.drawImage(tint, 0, 0);
      ctx.globalAlpha = 1;
    } else {
      ctx.putImageData(recolor(item, lastHex[productId] || "#cfc4ad"), 0, 0);
    }
  }

  function updateUI(productId) {
    const item = items[productId];
    const hasPhoto = !!item;
    const editing = hasPhoto && item.editing;
    // SVG elements don't implement the hidden IDL attribute; use style
    q(productId, ".furniture").style.display = hasPhoto ? "none" : "";
    q(productId, ".photo-view").hidden = !hasPhoto;
    q(productId, "[data-role=edit-mask]").hidden = !hasPhoto || editing;
    q(productId, "[data-role=remove-photo]").hidden = !hasPhoto || editing;
    q(productId, ".mask-tools").hidden = !editing;
    q(productId, ".photo-hint").hidden = !editing;
    if (editing) {
      q(productId, "[data-role=brush]").classList.toggle("active", item.brushMode === "paint");
      q(productId, "[data-role=erase]").classList.toggle("active", item.brushMode === "erase");
    }
  }

  // ---------- mask editing ----------

  function canvasPoint(view, e) {
    const rect = view.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * view.width,
      y: ((e.clientY - rect.top) / rect.height) * view.height,
    };
  }

  function strokeTo(item, from, to) {
    const ctx = item.mask.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = item.brushSize;
    ctx.globalCompositeOperation =
      item.brushMode === "erase" ? "destination-out" : "source-over";
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  function setup(productId) {
    const c = card(productId);
    const view = q(productId, ".photo-view");
    const upload = q(productId, "[data-role=upload]");

    upload.addEventListener("change", () => {
      const file = upload.files && upload.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () =>
        setPhotoFromDataURL(productId, reader.result).then(() => startEditing(productId));
      reader.readAsDataURL(file);
      upload.value = "";
    });

    // drag & drop a photo onto the card
    c.addEventListener("dragover", (e) => {
      e.preventDefault();
      c.classList.add("dragging");
    });
    c.addEventListener("dragleave", () => c.classList.remove("dragging"));
    c.addEventListener("drop", (e) => {
      e.preventDefault();
      c.classList.remove("dragging");
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () =>
        setPhotoFromDataURL(productId, reader.result).then(() => startEditing(productId));
      reader.readAsDataURL(file);
    });

    q(productId, "[data-role=edit-mask]").addEventListener("click", (e) => {
      e.stopPropagation();
      startEditing(productId);
    });
    q(productId, "[data-role=remove-photo]").addEventListener("click", (e) => {
      e.stopPropagation();
      removePhoto(productId);
    });
    q(productId, "[data-role=brush]").addEventListener("click", (e) => {
      e.stopPropagation();
      items[productId].brushMode = "paint";
      updateUI(productId);
    });
    q(productId, "[data-role=erase]").addEventListener("click", (e) => {
      e.stopPropagation();
      items[productId].brushMode = "erase";
      updateUI(productId);
    });
    q(productId, "[data-role=size]").addEventListener("input", (e) => {
      items[productId].brushSize = Number(e.target.value);
    });
    q(productId, "[data-role=clear]").addEventListener("click", (e) => {
      e.stopPropagation();
      const item = items[productId];
      item.mask.getContext("2d").clearRect(0, 0, item.w, item.h);
      refresh(productId);
    });
    q(productId, "[data-role=done]").addEventListener("click", (e) => {
      e.stopPropagation();
      stopEditing(productId);
    });
    q(productId, ".mask-tools").addEventListener("click", (e) => e.stopPropagation());
    q(productId, ".photo-toolbar").addEventListener("click", (e) => e.stopPropagation());

    // painting
    let last = null;
    view.addEventListener("pointerdown", (e) => {
      const item = items[productId];
      if (!item || !item.editing) return;
      e.preventDefault();
      e.stopPropagation();
      view.setPointerCapture(e.pointerId);
      last = canvasPoint(view, e);
      strokeTo(item, last, last);
      refresh(productId);
    });
    view.addEventListener("pointermove", (e) => {
      const item = items[productId];
      if (!item || !item.editing || !last) return;
      const p = canvasPoint(view, e);
      strokeTo(item, last, p);
      last = p;
      refresh(productId);
    });
    const end = (e) => {
      const item = items[productId];
      if (!item || !item.editing || !last) return;
      last = null;
      item.maskData = item.mask.getContext("2d").getImageData(0, 0, item.w, item.h);
    };
    view.addEventListener("pointerup", end);
    view.addEventListener("pointercancel", end);
  }

  function startEditing(productId) {
    const item = items[productId];
    if (!item) return;
    item.editing = true;
    updateUI(productId);
    refresh(productId);
  }

  function stopEditing(productId) {
    const item = items[productId];
    if (!item) return;
    item.editing = false;
    item.maskData = item.mask.getContext("2d").getImageData(0, 0, item.w, item.h);
    saveMask(productId);
    updateUI(productId);
    refresh(productId);
  }

  function init() {
    PRODUCTS.forEach((p) => {
      setup(p.id);
      const dataURL = localStorage.getItem(LS_PHOTO(p.id));
      if (dataURL) {
        setPhotoFromDataURL(p.id, dataURL, { persist: false })
          .then(() => loadMask(p.id))
          .then(() => refresh(p.id));
      }
    });
  }

  return { init, refresh, setPhotoFromDataURL, startEditing, stopEditing };
})();
