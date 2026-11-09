// ---------- nueva venta ----------
// medio de pago de cada venta: solo se anota, Mostrador no cobra ni confirma el pago
const MEDIOS_PAGO = ["Efectivo", "Yape", "Plin", "Tarjeta", "Transferencia"];
const PAGO_INICIAL = MEDIOS_PAGO[0];
const PAGO_SIN_DATO = "Sin registrar"; // notas emitidas antes de existir este dato
function pagoResumen(notes) {
  const totals = new Map();
  notes.filter(n => n.estado !== "anulada").forEach(n => {
    const label = n.pago || PAGO_SIN_DATO, d = totals.get(label) || { label, count: 0, total: 0 };
    d.count++;
    d.total = round2(d.total + n2(n.total));
    totals.set(label, d);
  });
  return [...totals.values()].sort((a, b) => b.total - a.total);
}
const blankDraft = () => ({ cliente: "", doc: "", obs: "", pago: PAGO_INICIAL, items: [] });
let draft = store.get("mostrador.draft") || blankDraft();
let pickQ = "", pickTimer = 0;
const saveDraft = () => store.set("mostrador.draft", draft);
const nextFolio = () => S.notes.reduce((m, n) => Math.max(m, n2(n.folio)), notasFolioMax) + 1;
const draftTotal = () => draft.items.reduce((a, i) => a + n2(i.cant) * n2(i.precio), 0);

function renderVenta() {
  const el = $("#v-venta");
  const focusId = document.activeElement && document.activeElement.id;
  const caret = focusId && document.activeElement.selectionStart;
  const q = norm(pickQ);
  const res = productMatches(pickQ);
  const total = draftTotal();
  el.innerHTML = `
    <div class="toolbar"><h1 style="margin-right:auto">Nueva nota de venta</h1><span class="muted num">${folioTxt(nextFolio())}</span></div>
    ${S.cajas.length && !cajaAbierta() ? `<div class="banner venta-caja"><span>La caja está cerrada: esta venta no entrará en ningún cierre.</span><button class="btn" data-view="caja">Abrir caja</button></div>` : ""}
    <div class="sale">
      <div class="panel">
        <div class="grid2">
          <label class="f"><span>Cliente</span><input type="text" id="d-cliente" value="${esc(draft.cliente)}" placeholder="Público en general" autocomplete="off"></label>
          <label class="f"><span>DNI / RUC / documento</span><input type="text" id="d-doc" value="${esc(draft.doc)}" placeholder="Opcional" autocomplete="off"></label>
        </div>
        <div class="picker">
          <div class="scan-row"><label class="f"><span>Agregar producto</span><input type="search" id="d-pick" value="${esc(pickQ)}" placeholder="${S.products.length ? "Escribe nombre o código" : "Primero agrega productos en Inventario"}" autocomplete="off"></label><button type="button" class="btn" id="d-scan"><svg class="bc-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3M8 9v6M11 9v6M14 9v6M17 9v6"/></svg>Escanear</button></div>
          ${q ? pickerResultsHtml(res, `Crear «${esc(pickQ)}»`) : ""}
        </div>
        <div class="lines">
          ${draft.items.length ? `<div class="line line-head"><span>Producto</span><span style="text-align:right">Cant.</span><span style="text-align:right">Precio</span><span class="sub">Importe</span><span></span></div>` : ""}
          ${draft.items.map((i, k) => {
            const p = S.products.find(x => x.id === i.productId);
            const pv = p && i.variantId && p.variantes ? p.variantes.find(v=>v.id===i.variantId) : null;
            const available = pv ? n2(pv.stock) : p && totalStock(p);
            const over = p && n2(i.cant) > available;
            return `<div class="line">
              <div class="nm">${esc(i.nombre)}<small>${p ? `stock ${qty(available)} ${esc(p.unidad || "und")}` : i.productId ? "producto eliminado" : "no descuenta stock"}</small>${over ? `<small class="warnline">Supera el stock disponible</small>` : ""}</div>
              <input type="number" id="l-cant-${k}" data-cant="${k}" value="${i.cant}" min="0" step="1" inputmode="decimal" aria-label="Cantidad">
              <input type="number" id="l-precio-${k}" data-precio="${k}" value="${i.precio}" min="0" step="0.01" inputmode="decimal" aria-label="Precio unitario">
              <span class="sub">${money(n2(i.cant) * n2(i.precio))}</span>
              <button class="x" data-rmline="${k}" aria-label="Quitar ${esc(i.nombre)}">×</button>
            </div>`;
          }).join("") || `<p class="muted" style="margin:4px 0">Busca un producto arriba para agregarlo a la nota.</p>`}
        </div>
        <div class="pay-field"><span id="d-pago-label">Medio de pago</span><div class="pay-opts" role="group" aria-labelledby="d-pago-label">${MEDIOS_PAGO.map(m => `<button type="button" data-pago="${esc(m)}" aria-pressed="${(draft.pago || PAGO_INICIAL) === m}">${esc(m)}</button>`).join("")}</div></div>
        <label class="f"><span>Observaciones</span><textarea id="d-obs" placeholder="Ej. Entrega a domicilio">${esc(draft.obs)}</textarea></label>
        <div class="total-row"><span>Total</span><b id="d-total">${money(total)}</b></div>
        <div class="actions">
          <button class="btn ghost" id="d-clear" ${draft.items.length || draft.cliente ? "" : "disabled"}>Vaciar</button>
          <div class="r"><button class="btn primary" id="d-emit" ${draft.items.some(i => n2(i.cant) > 0) ? "" : "disabled"}>Emitir nota y descontar stock</button></div>
        </div>
      </div>
      ${ticketHtml({ folio: nextFolio(), fecha: new Date().toISOString(), cliente: draft.cliente, doc: draft.doc, obs: draft.obs, pago: draft.pago || PAGO_INICIAL, items: draft.items.filter(i => n2(i.cant) > 0), total }, true)}
    </div>`;
  if (focusId && document.getElementById(focusId)) { const i = document.getElementById(focusId); i.focus(); try { i.setSelectionRange(caret, caret); } catch {} }
}
// buscador de productos de Nueva venta y de Cotizaciones
function productMatches(text) {
  const q = norm(text), palabras = palabrasDe(text);
  if (!q) return [];
  const res = [], otros = [];
  S.products.forEach(p => {
    const hay = productoTexto(p);
    if (tieneTodas(hay, palabras)) res.push({ p, s: 1 + (hay.startsWith(q) ? 0.5 : 0) + (hay.includes(q) ? 0.2 : 0) });
    else otros.push(p);
  });
  // el parecido (errores de tipeo) solo se calcula si hace falta y el catálogo no es enorme
  if (res.length < 8 && S.products.length <= CATALOGO_GRANDE) {
    otros.forEach(p => {
      const s = similarity({ nombre: text }, p);
      if (s >= 0.35) res.push({ p, s });
    });
  }
  return res.sort((a, b) => b.s - a.s).slice(0, 8);
}
function pickerResultsHtml(res, quickLabel) {
  const fotos = anyFoto(), th = p => fotos ? thumbHtml(p, "sm") : "";
  const variantBtn = (p, v) => `<button data-addline="${esc(p.id)}" data-variant="${esc(v.id)}">${th(p)}<span>${esc(p.nombre)} – ${esc([v.talla, v.color].filter(Boolean).join(" / "))}</span><span class="num">${money(v.precio ?? p.precio)}</span><small>${esc(v.codigo || p.codigo || "")}</small><small class="num">stock ${qty(v.stock)} ${esc(p.unidad || "und")}</small></button>`;
  const productBtn = p => `<button data-addline="${esc(p.id)}">${th(p)}<span>${esc(p.nombre)}</span><span class="num">${money(p.precio)}</span><small>${esc(p.categoria || "Sin categoría")}</small><small class="num">stock ${qty(p.stock)} ${esc(p.unidad || "und")}</small></button>`;
  const rows = res.map(x => x.p.variantes && x.p.variantes.length ? x.p.variantes.map(v => variantBtn(x.p, v)).join("") : productBtn(x.p)).join("");
  return `<div class="results${fotos ? " with-thumb" : ""}">${rows || `<div style="padding:10px" class="muted">Sin coincidencias. <button class="btn ghost" data-quickadd="1" style="padding:2px 6px">${quickLabel}</button></div>`}</div>`;
}
// línea de venta o cotización a partir de un producto (y su variante, si tiene)
function itemFromProduct(p, variant) {
  return { productId: p.id, ...(variant ? { variantId: variant.id, talla: variant.talla || "", color: variant.color || "" } : {}), nombre: p.nombre + (variant ? " – " + [variant.talla, variant.color].filter(Boolean).join(" / ") : ""), unidad: p.unidad || "und", cant: 1, precio: n2(variant && variant.precio != null ? variant.precio : p.precio) };
}
function addLine(p, variant) {
  if(p.variantes&&p.variantes.length&&!variant)return;
  const ex = draft.items.find(i => i.productId === p.id && i.variantId === (variant&&variant.id));
  if (ex) ex.cant = n2(ex.cant) + 1;
  else draft.items.push(itemFromProduct(p, variant));
  pickQ = ""; saveDraft(); renderVenta(); $("#d-pick").focus();
}
$("#v-venta").addEventListener("click", async e => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.addline) { const p = S.products.find(x => x.id === t.dataset.addline); if (p) addLine(p,t.dataset.variant&&p.variantes&&p.variantes.find(v=>v.id===t.dataset.variant)); return; }
  if (t.dataset.rmline) { draft.items.splice(+t.dataset.rmline, 1); saveDraft(); return renderVenta(); }
  if (t.dataset.quickadd) { const name = pickQ; pickQ = ""; openProduct(null); $("#p-nombre").value = name; showSimilar(); return; }
  if (t.dataset.pago) { draft.pago = t.dataset.pago; saveDraft(); return renderVenta(); }
  if (t.id === "d-scan") return abrirEscaner(ventaCodigo, "Apunta la cámara a cada producto. Se agregan solos; toca Listo al terminar.");
  if (t.id === "d-clear") { draft = blankDraft(); saveDraft(); return renderVenta(); }
  if (t.id === "d-emit") return emitNote(t);
});
$("#v-venta").addEventListener("input", e => {
  const t = e.target;
  if (t.id === "d-pick") {
    pickQ = t.value;
    clearTimeout(pickTimer);
    pickTimer = 0;
    if (S.products.length <= SEMEJANZA_MAX) return renderVenta();
    pickTimer = setTimeout(() => { pickTimer = 0; renderVenta(); }, 120);
    return;
  }
  if (t.id === "d-cliente") { draft.cliente = t.value; saveDraft(); return renderVenta(); }
  if (t.id === "d-doc") { draft.doc = t.value; saveDraft(); return renderVenta(); }
  if (t.id === "d-obs") { draft.obs = t.value; saveDraft(); return renderVenta(); }
  if (t.dataset.cant) { draft.items[+t.dataset.cant].cant = t.value === "" ? "" : n2(t.value); saveDraft(); return renderVenta(); }
  if (t.dataset.precio) { draft.items[+t.dataset.precio].precio = t.value === "" ? "" : n2(t.value); saveDraft(); return renderVenta(); }
});
$("#v-venta").addEventListener("keydown", e => {
  if (e.target.id === "d-pick" && e.key === "Enter") {
    e.preventDefault();
    if (pickTimer) { clearTimeout(pickTimer); pickTimer = 0; renderVenta(); }
    const t = pickQ.trim(), hit = buscarCodigo(t);
    if (hit) { const m = ventaCodigo(t); if (hit.v || !hit.p.variantes || !hit.p.variantes.length) return; return toast(m); }
    // un código que no existe no debe agregar el producto más parecido
    if (pareceCodigo(t) && !productMatches(t).some(x => x.s >= 1)) {
      pickQ = ""; renderVenta();
      return toast("No hay ningún producto con el código " + t);
    }
    const b = $("#v-venta [data-addline]");
    if (b) b.click();
  }
});
async function emitNote(btn) {
  if (!exigir("venta.crear", "crear ventas")) return;
  const items = draft.items.filter(i => n2(i.cant) > 0).map(i => {
    const linea = { ...i, cant: n2(i.cant), precio: n2(i.precio) };
    // el costo se guarda con la venta: si después cambia, la ganancia de esta venta no se mueve
    const p = i.productId && S.products.find(x => x.id === i.productId);
    if (p && tieneCosto(p)) linea.costo = n2(p.costo); else delete linea.costo;
    return linea;
  });
  if (!items.length) return;
  btn.disabled = true;
  const fromQuote = draft.cotizacionId;
  const note = {
    id: uid(), folio: nextFolio(), fecha: new Date().toISOString(),
    cliente: draft.cliente.trim(), doc: draft.doc.trim(), obs: draft.obs.trim(), pago: draft.pago || PAGO_INICIAL,
    items, total: Math.round(items.reduce((a, i) => a + i.cant * i.precio, 0) * 100) / 100, estado: "emitida",
  };
  try {
    await flushPendingStock();
    note.vendedorId = usuarioActual()?.id;
    note.vendedorNombre = usuarioActual()?.nombre;
    if (usaTransacciones()) {
      const r = await fbMovimiento({ deltas: deltasDe(items, -1), nota: note });
      note.id = r.id; note.folio = r.folio;
    } else {
      const freshNotes = await readNotes();
      note.folio = nextFreeFolio(freshNotes);
      saleAdjusting = true;
      const changed = await adjustStock(items, -1);
      try {
        const latestNotes = await readNotes();
        if (latestNotes.some(n => n2(n.folio) === n2(note.folio))) note.folio = nextFreeFolio(latestNotes);
        await putNote(note);
      }
      catch (err) {
        await restoreProducts(changed);
        try { await deleteNote(note.id); } catch {}
        throw err;
      }
      saleAdjusting = false;
    }
    // la cotización de la que salió la venta queda marcada como vendida
    if (fromQuote) { try { await patchQuote(fromQuote, { estado: "vendida", notaId: note.id, notaFolio: note.folio }); } catch {} }
    draft = blankDraft(); saveDraft();
    S.selNote = note.id;
    toast("Nota " + folioTxt(note.folio) + " emitida");
    go("notas");
  } catch (err) { saleAdjusting = false; toast("No se pudo emitir la nota; se revirtieron los cambios. " + failMsg(err)); btn.disabled = false; }
}
async function readNotes() {
  if (db && db.lastNotes) return db.lastNotes();
  if (db) { const snap = await db.collection("notes").get(); return snap.docs.map(d => ({ id: d.id, ...d.data() })); }
  return [...mem.notes.values()].map(n => ({ ...n }));
}
function nextFreeFolio(notes) {
  const used = new Set(notes.map(n => n2(n.folio)));
  let folio = notes.reduce((m, n) => Math.max(m, n2(n.folio)), 0) + 1;
  while (used.has(folio)) folio++;
  return folio;
}
async function restoreProducts(snapshots) {
  for (const p of snapshots) {
    const body = { ...p }; delete body.id;
    if (db) await db.collection("products").doc(p.id).set(body);
    else { mem.products.set(p.id, { ...p }); syncMem(); }
  }
}
async function adjustStock(items, sign) {
  const byKey = {};
  items.forEach(i => { if (i.productId) {const key=i.productId+":"+(i.variantId||"");byKey[key]=(byKey[key]||0)+n2(i.cant);} });
  const snapshots = [];
  for (const key of Object.keys(byKey)) {
    const [id, vid] = key.split(":"), p = await readProduct(id);
    if (!p || (vid && !(p.variantes || []).some(v => v.id === vid))) throw new Error("Producto o variante no disponible");
  }
  try {
    for (const [key, c] of Object.entries(byKey)) {
      const [id, vid] = key.split(":"), p = await readProduct(id);
      snapshots.push(structuredClone(p));
      if (vid) {
        const v = p.variantes.find(x => x.id === vid);
        v.stock = Math.round((n2(v.stock) + sign * c) * 1000) / 1000; p.stock = totalStock(p);
        await patchProduct(id, { variantes: p.variantes, stock: p.stock, actualizado: new Date().toISOString() });
      } else {
        p.stock = Math.round((n2(p.stock) + sign * c) * 1000) / 1000;
        await patchProduct(id, { stock: p.stock, actualizado: new Date().toISOString() });
      }
    }
  } catch (err) { await restoreProducts(snapshots); throw err; }
  return snapshots;
}

// ---------- Firebase: venta, anulación y conteo, todo junto o nada ----------
// Con internet va en una transacción: si otro equipo cambió el mismo producto o tomó el mismo folio,
// Firebase la repite con los datos nuevos, así nunca se pisan el stock ni se repite el número de nota.
// Sin internet no hay transacciones: va en un lote, que también se guarda entero o nada y se envía al volver la conexión.
const usaTransacciones = () => !!(fbMode && fb && fb.negocioId && db);
const sinRed = e => !navigator.onLine || /unavailable|deadline-exceeded/.test(String((e && e.code) || ""));
const FOLIO_ID = folio => "folio-" + folio;
function deltasDe(items, sign) {
  const deltas = new Map();
  items.forEach(i => {
    if (!i.productId) return;
    const key = i.productId + ":" + (i.variantId || "");
    deltas.set(key, (deltas.get(key) || 0) + sign * n2(i.cant));
  });
  return deltas;
}
// agrupa los cambios por producto: Map(id → [{ vid, d }])
function deltasPorProducto(deltas) {
  const porId = new Map();
  for (const [key, d] of deltas) {
    const [id, vid] = key.split(":");
    if (!porId.has(id)) porId.set(id, []);
    porId.get(id).push({ vid, d });
  }
  return porId;
}
// calcula el stock nuevo de un producto leído; piso0 = el conteo manual no baja de cero
function parcheStock(p, cambios, piso0) {
  const r = x => Math.round(x * 1000) / 1000;
  const ajusta = (actual, d) => piso0 ? Math.max(0, r(n2(actual) + d)) : r(n2(actual) + d);
  const patch = { actualizado: new Date().toISOString() };
  if (cambios.some(c => c.vid)) {
    const variantes = (p.variantes || []).map(v => ({ ...v }));
    for (const c of cambios) {
      const v = variantes.find(x => x.id === c.vid);
      if (!v) throw new Error("Producto o variante no disponible");
      v.stock = ajusta(v.stock, c.d);
    }
    patch.variantes = variantes;
    patch.stock = totalStock({ variantes });
  } else {
    patch.stock = ajusta(p.stock, cambios.reduce((a, c) => a + c.d, 0));
  }
  return patch;
}
// deltas: Map("producto:variante" → cambio). nota: venta nueva. anular: nota que se anula.
// Devuelve el id y el folio con que quedó guardada la venta.
async function fbMovimiento({ deltas, nota = null, anular = null, piso0 = false, soloEnLinea = false }) {
  if (soloEnLinea && !navigator.onLine) throw Object.assign(new Error("Sin conexión"), { code: "unavailable" });
  const { F, fs } = fb, base = "negocios/" + fb.negocioId + "/";
  const prodRef = id => F.doc(fs, base + "products/" + id);
  const porId = deltasPorProducto(deltas);
  const anuladaEn = new Date().toISOString();
  if (navigator.onLine) {
    try {
      // el folio parte de la nota más alta del servidor; la transacción confirma que nadie lo tomó
      let desde = 0;
      if (nota) {
        const ult = await db.lastNotes();
        desde = Math.max(ult[0] ? n2(ult[0].folio) : 0, ...S.notes.map(n => n2(n.folio))) + 1;
      }
      return await F.runTransaction(fs, async tx => {
        // Firebase exige hacer todas las lecturas antes de escribir
        let folio = desde, notaRef = null;
        if (nota) {
          for (let intento = 0; ; intento++) {
            notaRef = F.doc(fs, base + "notes/" + FOLIO_ID(folio));
            if (!(await tx.get(notaRef)).exists()) break;
            if (intento > 50) throw new Error("No se encontró un número de nota libre");
            folio++;
          }
        }
        let anularRef = null;
        if (anular) {
          anularRef = F.doc(fs, base + "notes/" + anular.id);
          const s = await tx.get(anularRef);
          if (!s.exists()) throw Object.assign(new Error("La nota ya no existe."), { aviso: "Esa nota ya no existe." });
          if (s.data().estado === "anulada") throw Object.assign(new Error("Ya anulada"), { aviso: "Esa nota ya fue anulada en otro equipo; el stock no se devolvió dos veces." });
        }
        const parches = [];
        for (const [id, cambios] of porId) {
          const s = await tx.get(prodRef(id));
          if (!s.exists()) throw new Error("Producto o variante no disponible");
          parches.push([id, parcheStock(s.data(), cambios, piso0)]);
        }
        parches.forEach(([id, patch]) => tx.update(prodRef(id), patch));
        if (nota) { const body = { ...nota, folio }; delete body.id; tx.set(notaRef, body); }
        if (anular) tx.update(anularRef, { estado: "anulada", anulada: anuladaEn });
        return { id: notaRef ? notaRef.id : null, folio };
      });
    } catch (e) { if (!sinRed(e) || soloEnLinea) throw e; }
  }
  // sin internet: lote con lo que hay en este equipo. El folio puede coincidir con el de otro equipo
  // que también vendió sin internet, pero ninguna nota se pierde (cada una tiene su propio id).
  // El stock simple se suma con increment, que Firebase combina con lo de otros equipos.
  // Las tallas viven en una lista que no se puede sumar por partes: escribir la lista de este equipo
  // borraría lo que vendió otro, así que ese cambio espera en una cola y se aplica con transacción al volver internet.
  const batch = F.writeBatch(fs);
  const enCola = new Map();
  for (const [id, cambios] of porId) {
    if (cambios.some(c => c.vid)) { cambios.forEach(c => enCola.set(id + ":" + (c.vid || ""), c.d)); continue; }
    batch.update(prodRef(id), { stock: F.increment(Math.round(cambios.reduce((a, c) => a + c.d, 0) * 1000) / 1000), actualizado: new Date().toISOString() });
  }
  if (enCola.size) {
    const cola = pendLeer();
    cola.push({ id: uid(), nid: fb.negocioId, deltas: [...enCola], piso0 });
    pendGuardar(cola);
    toast("Sin internet: el stock por talla se actualizará al volver la conexión");
  }
  let r = { id: null, folio: 0 };
  if (nota) {
    r = { id: nota.id, folio: nextFolio() };
    const body = { ...nota, folio: r.folio }; delete body.id;
    batch.set(F.doc(fs, base + "notes/" + nota.id), body);
  }
  if (anular) {
    if (anular.estado === "anulada") throw Object.assign(new Error("Ya anulada"), { aviso: "Esa nota ya estaba anulada." });
    batch.update(F.doc(fs, base + "notes/" + anular.id), { estado: "anulada", anulada: anuladaEn });
  }
  if (porId.size > enCola.size || nota || anular) await fbWrite(batch.commit());
  return r;
}
// cola de cambios de stock por talla hechos sin internet (sobrevive si se cierra la app)
const PEND_KEY = "mostrador.stockPendiente";
function pendLeer() { try { return JSON.parse(localStorage.getItem(PEND_KEY) || "[]"); } catch { return []; } }
function pendGuardar(lista) { try { localStorage.setItem(PEND_KEY, JSON.stringify(lista)); } catch {} }
let pendEnviando = false;
async function stockPendienteEnviar() {
  if (pendEnviando || !usaTransacciones() || !navigator.onLine) return;
  pendEnviando = true;
  try {
    for (const m of pendLeer()) {
      if (m.nid !== fb.negocioId) continue;
      try { await fbMovimiento({ deltas: new Map(m.deltas), piso0: m.piso0, soloEnLinea: true }); }
      catch (e) {
        // sin red o sin permiso: queda en la cola para el próximo intento
        if (sinRed(e) || String(e && e.code).includes("permission")) break;
        // el producto o la talla ya no existe: no hay a qué aplicarlo
      }
      pendGuardar(pendLeer().filter(x => x.id !== m.id));
    }
  } finally { pendEnviando = false; }
}
addEventListener("online", () => setTimeout(stockPendienteEnviar, 1500));

