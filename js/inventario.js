// ---------- inventario ----------
const pendingStock = new Map();
const stockWrites = new Set();
const totalStock = p => Array.isArray(p.variantes) && p.variantes.length ? p.variantes.reduce((a,v)=>a+n2(v.stock),0) : n2(p.stock);
function scheduleStockDelta(id, variantId, delta) {
  const key = id + ":" + (variantId || "");
  const old = pendingStock.get(key);
  if (old) clearTimeout(old.timer);
  // si el guardado anterior ya está en curso, su delta no se vuelve a sumar
  const entry = { delta: (old && !old.promise ? old.delta : 0) + delta, timer: null };
  entry.timer = setTimeout(() => flushStockDelta(key).catch(e => toast(failMsg(e))), 450);
  pendingStock.set(key, entry);
}
async function flushStockDelta(key) {
  const entry = pendingStock.get(key); if (!entry) return;
  if (entry.promise) return entry.promise;
  clearTimeout(entry.timer);
  entry.promise = (async () => {
    const [id, variantId] = key.split(":");
    // en modo local la pantalla y los datos son el mismo objeto: el valor ya está aplicado, solo falta guardarlo
    if (!db) { syncMem(); return; }
    if (usaTransacciones()) { await fbMovimiento({ deltas: new Map([[key, entry.delta]]), piso0: true }); return; }
    const p = await readProduct(id); if (!p) return;
    if (variantId) {
      const v = (p.variantes || []).find(x => x.id === variantId); if (!v) return;
      v.stock = Math.max(0, Math.round((n2(v.stock) + entry.delta) * 1000) / 1000);
      p.stock = totalStock(p);
      await patchProduct(id, { variantes: p.variantes, stock: p.stock, actualizado: new Date().toISOString() });
    } else {
      p.stock = Math.max(0, Math.round((n2(p.stock) + entry.delta) * 1000) / 1000);
      await patchProduct(id, { stock: p.stock, actualizado: new Date().toISOString() });
    }
  })();
  stockWrites.add(entry.promise);
  entry.promise.then(() => stockWrites.delete(entry.promise), () => stockWrites.delete(entry.promise));
  try { await entry.promise; }
  finally { if (pendingStock.get(key) === entry) pendingStock.delete(key); }
}
async function flushPendingStock() {
  while (pendingStock.size || stockWrites.size) {
    const pending = [...pendingStock.keys()].map(key => flushStockDelta(key));
    await Promise.all([...pending, ...stockWrites]);
  }
}
function setStockLocal(id, value) {
  if (!exigir("stock.ajustar", "ajustar stock")) return;
  const p = S.products.find(x => x.id === id); if (!p) return;
  const previous = n2(p.stock);
  p.stock = value;
  scheduleStockDelta(id, null, value - previous);
}
function setVariantStock(id, variantId, value) {
  if (!exigir("stock.ajustar", "ajustar stock")) return;
  const p=S.products.find(x=>x.id===id), v=p&&p.variantes&&p.variantes.find(x=>x.id===variantId); if(!v)return;
  const previous = n2(v.stock);
  v.stock=value; p.stock=totalStock(p);
  scheduleStockDelta(id, variantId, value - previous);
}

// Enter en el buscador (lo envía el lector USB): si el código no existe, ofrece crearlo; si existe, lo deja listo para la siguiente lectura
document.getElementById("v-inventario").addEventListener("keydown", e => {
  if (e.target.id !== "invSearch" || e.key !== "Enter") return;
  e.preventDefault();
  const t = e.target.value.trim();
  clearTimeout(invTimer);
  S.q = e.target.value;
  renderInventario();
  // queda seleccionado para que la siguiente lectura reemplace al código anterior
  if (buscarCodigo(t)) return $("#invSearch").select();
  const hay = productMatches(t).some(x => x.s >= 1);
  if (!hay && pareceCodigo(t)) { const m = inventarioCodigo(t); if (m) toast(m); }
});
const INV_PAGINA = 50, SEMEJANZA_MAX = 300;
let invLimite = INV_PAGINA, invTimer = 0;
function renderInventario() {
  const el = $("#v-inventario");
  const prods = S.products;
  const palabras = palabrasDe(S.q);
  let list = prods.filter(p => !palabras.length || tieneTodas(productoTexto(p), palabras));
  if (S.lowOnly) list = list.filter(p => p.variantes&&p.variantes.length ? p.variantes.some(v=>n2(v.stock)<=n2(v.minimo??p.minimo)) : n2(p.stock) <= n2(p.minimo));
  const units = prods.reduce((a, p) => a + Math.max(0, totalStock(p)), 0);
  const value = prods.reduce((a, p) => a + (p.variantes && p.variantes.length
    ? p.variantes.reduce((b, v) => b + Math.max(0, n2(v.stock)) * n2(v.precio ?? p.precio), 0)
    : Math.max(0, n2(p.stock)) * n2(p.precio)), 0);
  const low = prods.reduce((a,p)=>a+(p.variantes&&p.variantes.length?p.variantes.filter(v=>n2(v.stock)<=n2(v.minimo??p.minimo)).length:Number(n2(p.stock)<=n2(p.minimo))),0);
  const cats = new Set(prods.map(p => (p.categoria || "").trim()).filter(Boolean)).size;

  let groups;
  // comparar cada nombre con los demás es muy pesado con listas largas
  const semejanzaGrande = S.group === "semejanza" && list.length > SEMEJANZA_MAX;
  if (S.group === "semejanza" && !semejanzaGrande) groups = clusters(list);
  else {
    const m = new Map();
    list.forEach(p => { const k = (p.categoria || "").trim() || "Sin categoría"; if (!m.has(k)) m.set(k, []); m.get(k).push(p); });
    groups = [...m.entries()].sort((a, b) => a[0] === "Sin categoría" ? 1 : b[0] === "Sin categoría" ? -1 : ordenEs.compare(a[0], b[0]))
      .map(([label, items]) => ({ label, items: items.sort((a, b) => ordenEs.compare(a.nombre, b.nombre)) }));
  }
  // solo se dibuja una parte: es lo que mantiene rápida la pantalla con catálogos grandes
  let invQueda = invLimite;
  const invVisibles = groups.map(g => {
    const items = g.items.slice(0, Math.max(0, invQueda));
    invQueda -= items.length;
    return { ...g, visibles: items };
  }).filter(g => g.visibles.length);
  const invFaltan = Math.max(0, list.length - invLimite);

  const focusId = document.activeElement && document.activeElement.id;
  el.innerHTML = `
    <div class="toolbar">
      <h1 style="margin-right:auto">Inventario</h1>
      <button class="btn" id="exportCsv" ${prods.length ? "" : "disabled"} ${puede("datos.exportar") ? "" : "hidden"}>Exportar Excel</button>
      <button class="btn" id="openLabels" ${prods.length ? "" : "disabled"} ${puede("producto.editar") ? "" : "hidden"}>Etiquetas</button>
      <button class="btn primary" id="addProd" ${puede("producto.crear") ? "" : "hidden"}>+ Producto</button>
    </div>
    <div class="stats">
      <div class="stat"><b>${prods.length}</b><span>Productos</span></div>
      <div class="stat"><b>${cats}</b><span>Categorías</span></div>
      <div class="stat"><b>${qty(units)}</b><span>Unidades en stock</span></div>
      <div class="stat" ${puede("estadisticas.ver") ? "" : "hidden"}><b>${money(value)}</b><span>Valor a precio de venta</span></div>
      <div class="stat ${low ? "warn" : ""}"><b>${low}</b><span>Por reponer</span></div>
    </div>
    <div class="toolbar">
      <input class="grow" type="search" id="invSearch" placeholder="Buscar por nombre, categoría o código" value="${esc(S.q)}">
      <button class="btn" id="invScan"><svg class="bc-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3M8 9v6M11 9v6M14 9v6M17 9v6"/></svg>Escanear</button>
      <div class="seg" role="group" aria-label="Agrupar">
        <button data-group="categoria" aria-pressed="${S.group === "categoria"}">Por categoría</button>
        <button data-group="semejanza" aria-pressed="${S.group === "semejanza"}">Por semejanza</button>
      </div>
      <button class="btn ${S.lowOnly ? "primary" : ""}" id="lowOnly" aria-pressed="${S.lowOnly}">Solo por reponer</button>
    </div>
    ${semejanzaGrande ? `<p class="muted" style="margin:-4px 0 14px;font-size:13.5px">«Por semejanza» funciona con listas de hasta ${SEMEJANZA_MAX} productos. Busca o filtra para reducir la lista; mientras tanto se muestran por categoría.</p>` : S.group === "semejanza" && list.length ? `<p class="muted" style="margin:-4px 0 14px;font-size:13.5px">Los productos se agrupan solos según lo parecido de sus nombres, sin importar la categoría que les pusiste.</p>` : ""}
    <div id="groups">
      ${!S.loaded ? `<div class="empty">Cargando inventario…</div>` :
        !prods.length ? `<div class="empty"><h2>Tu inventario está vacío</h2><p>Agrega tu primer producto con <b>+ Producto</b>. Al escribir el nombre, la app te muestra los productos parecidos y te sugiere su categoría.</p></div>` :
        !list.length ? `<div class="empty">Ningún producto coincide con la búsqueda.</div>` :
        invVisibles.map(g => `
          <div class="group">
            <div class="group-head"><h2 ${g.quiet ? 'class="muted"' : ""}>${esc(g.label)}</h2><span class="count">${g.items.length} ${g.items.length === 1 ? "producto" : "productos"}</span></div>
            <div class="list"><div class="row head" aria-hidden="true"><span>Producto</span><span class="r">Precio</span><span>Stock</span><span>Estado</span></div>${g.visibles.map(rowHtml).join("")}</div>
          </div>`).join("") + (invFaltan ? `<div class="inv-mas"><span class="muted">Se muestran ${invLimite} de ${list.length} productos. Busca por nombre o código para ir directo.</span><button class="btn" id="invMas">Ver ${Math.min(INV_PAGINA, invFaltan)} más</button></div>` : "")}
    </div>
    </div>`;
  if (focusId === "invSearch") { const i = $("#invSearch"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}
const fotoOk = p => /^data:image\//.test((p && p.foto) || "");
let fotoLista = null, fotoHay = false;
const anyFoto = () => {
  if (fotoLista !== S.products) { fotoLista = S.products; fotoHay = S.products.some(fotoOk); }
  return fotoHay;
};
function thumbHtml(p, size = "") {
  return `<span class="thumb ${size}" aria-hidden="true">${fotoOk(p) ? `<img src="${esc(p.foto)}" alt="" loading="lazy">` : esc((p.nombre || "?").trim().charAt(0))}</span>`;
}
// con al menos una foto en el inventario, todas las filas llevan su recuadro para que queden alineadas
function nameHtml(p, inner) {
  return anyFoto() ? `<div class="name with-thumb">${thumbHtml(p)}<div>${inner}</div></div>` : `<div class="name">${inner}</div>`;
}
// --- Tallas y colores ---
const TALLAS = {
  Letras: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "Única"],
  Niños: ["2", "4", "6", "8", "10", "12", "14", "16"],
  Pantalón: ["26", "28", "30", "32", "34", "36", "38", "40", "42"],
  Calzado: ["33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44"],
};
const COLORES = { Negro: "#1f1f1f", Blanco: "#ffffff", Gris: "#9a9a9a", Azul: "#2f5fd0", "Azul marino": "#1d2a55", Celeste: "#8cc8f0", Rojo: "#d33a2c", Rosado: "#f2a5bd", Fucsia: "#d6338a", Morado: "#7a4cc2", Verde: "#2f9a4f", Amarillo: "#f2cc2f", Naranja: "#f08a24", Beige: "#e3d3b4", Marrón: "#7a4e2d", Plateado: "#c9cdd2", Dorado: "#cfa53a" };
const swatch = c => { const k = Object.keys(COLORES).find(x => norm(x) === norm(c)); return `<i class="sw" style="--sw:${k ? COLORES[k] : "transparent"}"></i>`; };
// orden natural: XS, S, M… luego números de menor a mayor, luego el resto por nombre
function tallaKey(t) {
  const i = TALLAS.Letras.findIndex(x => norm(x) === norm(t));
  if (i >= 0) return [0, i, ""];
  return isFinite(t) && String(t).trim() !== "" ? [1, Number(t), ""] : [2, 0, norm(t)];
}
const byTalla = (a, b) => { const x = tallaKey(a), y = tallaKey(b); return x[0] - y[0] || x[1] - y[1] || x[2].localeCompare(y[2]); };
function byColor(a, b) {
  const names = Object.keys(COLORES), i = names.findIndex(x => norm(x) === norm(a)), j = names.findIndex(x => norm(x) === norm(b));
  return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || norm(a).localeCompare(norm(b));
}
const uniq = list => list.filter((x, i) => x && list.findIndex(y => norm(y) === norm(x)) === i);
const openVar = new Set(); // productos con el detalle de tallas abierto en Inventario
// total de cada color del producto, siempre a la vista en la fila (solo si tiene dos colores o más)
function colorTotalsHtml(p) {
  const tot = new Map();
  (p.variantes || []).forEach(v => {
    const c = (v.color || "").trim(); if (!c) return;
    const k = norm(c), e = tot.get(k) || { nombre: c, n: 0 };
    e.n += n2(v.stock); tot.set(k, e);
  });
  if (tot.size < 2) return "";
  const lista = [...tot.values()].sort((a, b) => byColor(a.nombre, b.nombre));
  return `<div class="color-tots" aria-label="Stock por color">${lista.map(c =>
    `<span class="${c.n <= 0 ? "out" : ""}" title="${esc(c.nombre)}: ${qty(c.n)} ${esc(p.unidad || "und")}">${swatch(c.nombre)}${esc(c.nombre)} <b>${qty(c.n)}</b></span>`).join("")}</div>`;
}
function varRowHtml(p, st, chip) {
  const vs = p.variantes, open = openVar.has(p.id);
  // avisa cuántas tallas o colores piden reposición aunque el total alcance
  const bajas = vs.filter(v => n2(v.stock) <= n2(v.minimo ?? p.minimo)).length;
  if (st > 0) chip = bajas ? `<span class="chip low">${bajas} por reponer</span>` : "";
  const prices = vs.map(v => n2(v.precio ?? p.precio)), lo = Math.min(...prices), hi = Math.max(...prices);
  return `<div class="row" data-id="${esc(p.id)}">
    ${nameHtml(p, `<button data-edit="${esc(p.id)}">${esc(p.nombre)}</button>
      <div class="meta">${S.group === "semejanza" && p.categoria ? `<span>${esc(p.categoria)}</span>` : ""}${p.codigo ? `<span class="num">${esc(p.codigo)}</span>` : ""}<span>${vs.length} ${vs.length === 1 ? "variante" : "variantes"}</span></div>${colorTotalsHtml(p)}`)}
    <div class="price">${lo === hi ? money(lo) : `<span style="white-space:nowrap">${money(lo)} –</span> <span style="white-space:nowrap">${money(hi)}</span>`}<div class="muted" style="font-size:12px">por ${esc(p.unidad || "und")}</div></div>
    <button class="var-toggle" data-vtoggle="${esc(p.id)}" aria-expanded="${open}" aria-label="Ver stock por talla y color de ${esc(p.nombre)}"><b>${qty(st)}</b><span class="muted">${esc(p.unidad || "und")} · ${open ? "Ocultar" : "Ver tallas"}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
    <div class="estado">${chip}</div>
    ${open ? `<div class="var-panel">${varDetailHtml(p)}${puede("producto.editar") ? `<button class="btn var-etq" data-etq-producto="${esc(p.id)}"><svg class="bc-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3M8 9v6M11 9v6M14 9v6M17 9v6"/></svg>Imprimir etiquetas de este producto</button>` : ""}</div>` : ""}
  </div>`;
}
// Cuadro talla × color con el stock de cada combinación; si las variantes no forman un cuadro, una lista
function varDetailHtml(p) {
  const vs = p.variantes, edit = puede("stock.ajustar");
  const state = v => { const n = n2(v.stock); return n <= 0 ? "out" : n <= n2(v.minimo ?? p.minimo) ? "low" : ""; };
  const label = v => [v.talla, v.color].filter(Boolean).join(" / ") || "Variante";
  const allT = vs.every(v => v.talla), noT = vs.every(v => !v.talla), allC = vs.every(v => v.color), noC = vs.every(v => !v.color);
  const keys = vs.map(v => norm(v.talla || "") + "|" + norm(v.color || ""));
  const legend = `<div class="var-legend"><span><i></i>Por reponer</span><span><i class="out"></i>Agotado</span>${edit ? "<span>Toca un número para cambiarlo.</span>" : ""}</div>`;
  if ((allT || noT) && (allC || noC) && new Set(keys).size === keys.length) {
    const ts = noT ? [""] : uniq(vs.map(v => v.talla)).sort(byTalla), cs = noC ? [""] : uniq(vs.map(v => v.color)).sort(byColor);
    const find = (t, c) => vs.find(v => norm(v.talla || "") === norm(t) && norm(v.color || "") === norm(c));
    const cell = (t, c) => {
      const v = find(t, c);
      if (!v) return `<td class="none">—</td>`;
      const n = n2(v.stock);
      return `<td class="${state(v)}">${edit ? `<input data-vstk="${esc(p.id)}" data-variant="${esc(v.id)}" type="number" min="0" step="1" inputmode="numeric" value="${n}" aria-label="Stock ${esc(label(v))}">` : qty(n)}</td>`;
    };
    const sum = list => list.reduce((a, v) => a + n2(v && v.stock), 0);
    const totCol = ts.length > 1, totRow = cs.length > 1;
    return `<div class="var-matrix-wrap"><table class="var-matrix">
      <thead><tr><th></th>${ts.map(t => `<th>${t ? esc(t) : "Stock"}</th>`).join("")}${totCol ? "<th>Total</th>" : ""}</tr></thead>
      <tbody>${cs.map(c => `<tr><th>${c ? swatch(c) + esc(c) : "Stock"}</th>${ts.map(t => cell(t, c)).join("")}${totCol ? `<td class="tot">${qty(sum(ts.map(t => find(t, c))))}</td>` : ""}</tr>`).join("")}
      ${totRow ? `<tr><th>Total</th>${ts.map(t => `<td class="tot">${qty(sum(cs.map(c => find(t, c))))}</td>`).join("")}${totCol ? `<td class="tot">${qty(sum(vs))}</td>` : ""}</tr>` : ""}</tbody>
    </table></div>${legend}`;
  }
  return `<div class="var-cards">${vs.map(v => {
    const n = n2(v.stock), st = state(v);
    const mark = st === "out" ? '<span class="chip out">Agotado</span>' : st === "low" ? '<span class="chip low">Reponer</span>' : "";
    return `<div class="var-card"><span>${v.color ? swatch(v.color) : ""}${esc(label(v))} ${mark}</span>${edit ? `<div class="counter"><button data-vdec="${esc(p.id)}" data-variant="${esc(v.id)}" aria-label="Restar uno">−</button><input data-vstk="${esc(p.id)}" data-variant="${esc(v.id)}" type="number" value="${n}" aria-label="Stock ${esc(label(v))}" style="width:52px"><button data-vinc="${esc(p.id)}" data-variant="${esc(v.id)}" aria-label="Sumar uno">+</button></div>` : `<b class="num">${qty(n)}</b>`}</div>`;
  }).join("")}</div>`;
}
function rowHtml(p) {
  const st = totalStock(p), mn = n2(p.minimo);
  const chip = st <= 0 ? `<span class="chip out">Agotado</span>` : st <= mn ? `<span class="chip low">Reponer</span>` : "";
  if (p.variantes && p.variantes.length) return varRowHtml(p, st, chip);
  return `<div class="row" data-id="${esc(p.id)}">
    ${nameHtml(p, `<button data-edit="${esc(p.id)}">${esc(p.nombre)}</button>
      <div class="meta">${S.group === "semejanza" && p.categoria ? `<span>${esc(p.categoria)}</span>` : ""}${p.codigo ? `<span class="num">${esc(p.codigo)}</span>` : ""}${mn ? `<span>mín. ${qty(mn)}</span>` : ""}${p.ejemplo ? `<span class="chip ex">Ejemplo</span>` : ""}</div>`)}
    <div class="price">${money(p.precio)}<div class="muted" style="font-size:12px">por ${esc(p.unidad || "und")}</div></div>
    <div class="counter">
      ${puede("stock.ajustar") ? `      <button data-dec="${esc(p.id)}" aria-label="Restar uno a ${esc(p.nombre)}">−</button>` : ""}
      ${puede("stock.ajustar")?`<input type="number" id="stk-${esc(p.id)}" data-stk="${esc(p.id)}" value="${st}" step="1" aria-label="Stock de ${esc(p.nombre)}">`:`<span>${qty(st)}</span>`}
      ${puede("stock.ajustar")?`<button data-inc="${esc(p.id)}" aria-label="Sumar uno a ${esc(p.nombre)}">+</button>`:""}
      <span class="u">${esc(p.unidad || "und")}</span>
    </div>
    <div class="estado">${chip}</div>
  </div>`;
}

// Borrador de la configuración: lo que se escribe solo cambia la vista previa
// hasta pulsar "Guardar configuración". Se descarta al salir de la vista.
let configDraft = null;
const CONFIG_SAMPLE_ITEMS = [
  { cant: 2, unidad: "und", nombre: "Polo algodón – M / Negro", precio: 35 },
  { cant: 1, unidad: "und", nombre: "Gorra bordada", precio: 25 },
  { cant: 3, unidad: "und", nombre: "Medias deportivas", precio: 8.5 }
];
function configSample() {
  const total = CONFIG_SAMPLE_ITEMS.reduce((a, i) => a + i.cant * i.precio, 0);
  return {
    folio: 123, fecha: new Date().toISOString(), cliente: "Cliente de ejemplo",
    doc: "12345678", vendedorNombre: usuarioActual()?.nombre || "", pago: PAGO_INICIAL, total, items: CONFIG_SAMPLE_ITEMS
  };
}
function renderConfigPreview() {
  const box = $("#configPreview");
  if (box) box.innerHTML = ticketHtml(configSample(), false, configDraft);
}
function renderConfig() {
  const el = $("#v-config");
  if (!configDraft) configDraft = { ...S.settings };
  const s = configDraft;
  const field = (label, key, placeholder = "", attrs = "") => `
        <label class="f"><span>${label}</span>
          <input type="text" data-setting="${key}" value="${esc(s[key] || "")}" placeholder="${esc(placeholder)}" ${attrs}>
        </label>`;
  const check = (key, label) => `
        <label class="check"><input type="checkbox" data-setting="${key}" ${s[key] !== false ? "checked" : ""}> ${label}</label>`;
  el.innerHTML = `
    <h1>Configuración</h1>
    <div class="config-layout">
      <div class="config-form">
        <div class="config-card">
          <h2>Negocio</h2>
          ${field("Nombre comercial (sale en el ticket)", "negocio", "Mi negocio")}
          ${field("Razón social (opcional)", "razonSocial")}
          <div class="row2">
            ${field("RUC (opcional)", "ruc", "11 dígitos", 'inputmode="numeric" maxlength="11"')}
            ${field("Moneda", "moneda", "S/", 'maxlength="4"')}
          </div>
        </div>
        <div class="config-card">
          <h2>Dirección y contacto</h2>
          ${field("Dirección de la tienda", "direccion", "Av. Principal 123")}
          ${field("Distrito / ciudad", "ciudad", "Miraflores, Lima")}
          <div class="row2">
            ${field("Teléfono / WhatsApp", "telefono", "987 654 321", 'inputmode="tel"')}
            ${field("Correo (opcional)", "correo", "ventas@mitienda.com", 'inputmode="email"')}
          </div>
        </div>
        <div class="config-card">
          <h2>Redes sociales y tienda virtual</h2>
          <div class="row2">
            ${field("Facebook", "facebook", "@mitienda o enlace")}
            ${field("Instagram", "instagram", "@mitienda o enlace")}
          </div>
          <div class="row2">
            ${field("TikTok", "tiktok", "@mitienda o enlace")}
            ${field("Tienda virtual", "web", "mitienda.com")}
          </div>
        </div>
        <div class="config-card">
          <h2>Ticket</h2>
          <span class="f-label">Papel de la ticketera</span>
          <div class="seg paper-options">
            <button type="button" data-paper="58" aria-pressed="${s.papel === "58"}">58 mm</button>
            <button type="button" data-paper="80" aria-pressed="${s.papel !== "58"}">80 mm</button>
          </div>
          <div class="f logo-field"><span>Logo del ticket</span>
            <div class="logo-pick">
              ${s.logo ? `<img src="${esc(s.logo)}" alt="Logo actual">` : `<span class="muted">Sin logo</span>`}
              <button class="btn" id="pickLogo">${s.logo ? "Cambiar" : "Subir logo"}</button>
              ${s.logo ? `<button class="btn" id="removeLogo">Quitar</button>` : ""}
            </div>
          </div>
          ${field("Mensaje final", "mensajeFinal", "Gracias por su compra")}
          ${check("mostrarRedes", "Mostrar redes sociales en el ticket")}
          ${check("montoEnLetras", "Mostrar monto en letras")}
        </div>
        ${webConfigCard()}
        ${!db || fbMode ? `
        <div class="config-card">
          <h2>Copia de seguridad</h2>
          <div class="row-actions"><button class="btn" id="exportBackup">Exportar copia</button> <button class="btn" id="importBackup">Importar copia</button></div>
        </div>` : ""}
        <button class="btn primary config-save" id="saveSettings">Guardar configuración</button>
      </div>
      <aside class="config-preview">
        <h2>Vista previa</h2>
        <div id="configPreview"></div>
      </aside>
    </div>`;
  renderConfigPreview();
}

document.addEventListener("click", e => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.view) return go(t.dataset.view);
  if (t.id === "addProd") return openProduct(null);
  if (t.id === "openLabels") return abrirEtiquetas();
  if (t.dataset.etqProducto) return abrirEtiquetas(t.dataset.etqProducto);
  if (t.id === "invScan") return abrirEscaner(c => { const m = inventarioCodigo(c); if (m) toast(m); return false; });
  if (t.dataset.edit) return openProduct(t.dataset.edit);
  if (t.dataset.vtoggle) { const id = t.dataset.vtoggle; if (openVar.has(id)) openVar.delete(id); else openVar.add(id); return renderInventario(); }
  if (t.id === "invMas") { invLimite += INV_PAGINA; return renderInventario(); }
  if (t.dataset.group) { S.group = t.dataset.group; invLimite = INV_PAGINA; store.set("mostrador.group", S.group); return renderInventario(); }
  if (t.id === "lowOnly") { S.lowOnly = !S.lowOnly; invLimite = INV_PAGINA; return renderInventario(); }
  if (t.dataset.inc || t.dataset.dec) {
    const id = t.dataset.inc || t.dataset.dec, p = S.products.find(x => x.id === id); if (!p) return;
    const v = Math.round((n2(p.stock) + (t.dataset.inc ? 1 : -1)) * 1000) / 1000;
    setStockLocal(id, v);
    const inp = document.getElementById("stk-" + id); if (inp) inp.value = v;
    return;
  }
  if(t.dataset.vinc||t.dataset.vdec){const id=t.dataset.vinc||t.dataset.vdec,p=S.products.find(x=>x.id===id),v=p&&p.variantes.find(x=>x.id===t.dataset.variant);if(v){setVariantStock(id,v.id,Math.max(0,n2(v.stock)+(t.dataset.vinc?1:-1)));renderInventario();}return;}
  if (t.id === "saveSettings") {
    if (!exigir("ajustes.editar", "guardar la configuración") || !configDraft) return;
    const values = {};
    for (const [k, v] of Object.entries(configDraft)) values[k] = typeof v === "string" ? v.trim() : v;
    if (values.ruc && !/^\d{11}$/.test(values.ruc)) return toast("El RUC debe tener 11 dígitos.");
    // se parte de los ajustes actuales para no borrar el logo ni otros datos
    const s = { ...S.settings, ...values, negocio: values.negocio || "Mi negocio", moneda: values.moneda || "S/" };
    putSettings(s).then(() => {
      S.settings = s;
      configDraft = null;
      $("#bizName").textContent = s.negocio;
      renderConfig();
      toast("Configuración guardada");
    }).catch(e => toast(failMsg(e)));
    return;
  }
  if (t.dataset.paper && configDraft) {
    configDraft.papel = t.dataset.paper;
    document.querySelectorAll("[data-paper]").forEach(b => b.setAttribute("aria-pressed", b.dataset.paper === t.dataset.paper));
    renderConfigPreview();
    return;
  }
  if (t.id === "pickLogo") { $("#logoFile").click(); return; }
  if (t.id === "removeLogo") {
    const s = { ...S.settings }; delete s.logo;
    putSettings(s).then(() => {
      S.settings = s;
      if (configDraft) delete configDraft.logo;
      toast("Logo quitado");
      renderConfig();
    }).catch(e => toast(failMsg(e)));
    return;
  }
  if (t.id === "exportCsv") return exportCsv(t);
  if (t.id === "webLink") return vincularWeb(true);
  if (t.id === "webUnlink") return vincularWeb(false);
  if (t.id === "webCopy") { navigator.clipboard?.writeText(fb.negocioId).then(() => toast("Código copiado"), () => toast("No se pudo copiar")); return; }
  if (t.id === "exportBackup") return exportBackup();
  if (t.id === "importBackup") { $("#backupFile").click(); return; }
});
document.addEventListener("input", e => {
  if (e.target.id === "invSearch") {
    S.q = e.target.value;
    invLimite = INV_PAGINA;
    clearTimeout(invTimer);
    // con muchos productos se espera a que termine de teclear
    if (S.products.length > SEMEJANZA_MAX) invTimer = setTimeout(renderInventario, 140);
    else renderInventario();
  }
  if (configDraft && e.target.matches("#v-config [data-setting]")) {
    const input = e.target;
    configDraft[input.dataset.setting] = input.type === "checkbox" ? input.checked : input.value;
    renderConfigPreview();
  }
});
document.addEventListener("change", e => {
  if(e.target.dataset&&e.target.dataset.vstk){setVariantStock(e.target.dataset.vstk,e.target.dataset.variant,n2(e.target.value));renderInventario();return;}
  const id = e.target.dataset && e.target.dataset.stk;
  if (id) { const v = n2(e.target.value); setStockLocal(id, v); renderInventario(); }
  if (e.target.id === "backupFile" && e.target.files[0]) importBackup(e.target.files[0]);
  if (e.target.id === "logoFile" && e.target.files[0]) { saveLogo(e.target.files[0]); e.target.value = ""; }
});

// El logo se achica a lo que cabe en una ticketera (máx. 400 × 200 px) y se guarda
// dentro de los ajustes como imagen en texto, así viaja a todos los equipos.
async function saveLogo(file) {
  if (!exigir("ajustes.editar", "cambiar el logo")) return;
  if (!/^image\//.test(file.type)) return toast("Elige un archivo de imagen (PNG o JPG).");
  let img;
  try {
    const url = URL.createObjectURL(file);
    img = await new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url; });
    URL.revokeObjectURL(url);
  } catch { return toast("No se pudo abrir esa imagen."); }
  const k = Math.min(1, 400 / img.naturalWidth, 200 / img.naturalHeight);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); // fondo blanco: el papel del ticket
  g.drawImage(img, 0, 0, c.width, c.height);
  let logo = c.toDataURL("image/png");
  if (logo.length > 150000) logo = c.toDataURL("image/jpeg", 0.85);
  try {
    const s = { ...S.settings, logo };
    await putSettings(s);
    S.settings = s;
    if (configDraft) configDraft.logo = logo;
    toast("Logo guardado. Ya sale en los tickets.");
    renderConfig();
  }
  catch (e) { toast(failMsg(e)); }
}

// todas las notas del servidor: una copia no puede salir incompleta por falta de internet
async function notasCompletas() {
  if (!db || !db.notesServidor) return S.notes;
  const snap = await db.notesServidor();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function exportBackup() {
  if (!exigir("datos.exportar", "exportar copias")) return;
  let notasCopia, cajasCopia;
  try { notasCopia = await notasCompletas(); cajasCopia = await cajasCompletas(); }
  catch { return toast("Para sacar la copia completa necesitas internet. Inténtalo cuando vuelva la conexión."); }
  const data = JSON.stringify({ version: 1, products: S.products, notes: notasCopia, quotes: S.quotes, cajas: cajasCopia, users: fbMode ? undefined : S.users, settings: S.settings }, null, 2);
  const name = "mostrador-copia-" + new Date().toISOString().slice(0, 10) + ".json";
  if (downloads) return saveFile(name, data);
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: "application/json" })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
let pendingBackup = null;
async function importBackup(file) {
  if (!exigir("datos.importar", "importar copias")) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.products) || !Array.isArray(data.notes) || !data.settings || typeof data.settings !== "object" || (data.users !== undefined && !Array.isArray(data.users))) throw new Error("Formato inválido");
    pendingBackup = data;
    const dialog = $("#backupDialog");
    dialog.returnValue = ""; dialog.showModal();
    dialog.onclose = async () => {
      const mode = dialog.returnValue; const incoming = pendingBackup; pendingBackup = null;
      if (!incoming || !["merge", "replace"].includes(mode)) return;
      try {
        if (mode === "replace") {
          if (db) {
            const notasBorrar = await notasCompletas();
            await Promise.all(S.products.map(p => removeProduct(p.id)));
            await Promise.all(notasBorrar.map(n => db.collection("notes").doc(n.id).delete()));
            await Promise.all(S.quotes.map(q => db.collection("quotes").doc(q.id).delete()));
            const cajasBorrar = await cajasCompletas();
            if (!cajasBlocked) await Promise.all(cajasBorrar.map(x => db.collection("cajas").doc(x.id).delete()));
          } else { mem.products.clear(); mem.notes.clear(); mem.quotes.clear(); mem.cajas.clear(); }
        }
        for (const p of incoming.products) if (p && p.id) await putProduct(p);
        // los productos importados no tienen su nombre reservado
        if (usaTransacciones()) { try { localStorage.setItem(NOMBRES_REVISAR, fb.negocioId); } catch {} nombresReservarExistentes(); }
        for (const n of incoming.notes) if (n && n.id) await putNote(n);
        for (const q of Array.isArray(incoming.quotes) ? incoming.quotes : []) if (q && q.id) await putQuote(q);
        if (!cajasBlocked) for (const x of Array.isArray(incoming.cajas) ? incoming.cajas : []) if (x && x.id) await putCaja(x);
        await putSettings(incoming.settings);
        if (Array.isArray(incoming.users) && !fbMode) {
          if (mode === "replace") S.users = incoming.users.filter(u => u && u.id);
          else { const merged = new Map(S.users.map(u => [u.id, u])); incoming.users.filter(u => u && u.id).forEach(u => merged.set(u.id, u)); S.users = [...merged.values()]; }
          await putUsers();
        }
        if (!db) syncMem();
        toast(mode === "replace" ? "Copia importada" : "Copia combinada");
      } catch (err) { toast(failMsg(err)); }
    };
  } catch { toast("No se pudo leer la copia. Elige un JSON de Mostrador."); }
  finally { $("#backupFile").value = ""; }
}

async function exportCsv(btn) {
  if (!exigir("datos.exportar", "exportar el inventario")) return;
  await saveExcel("inventario-" + isoDay(new Date()), inventoryBook(), btn);
}
async function saveFile(filename, data) {
  if (!downloads && window.claude) { toast("Descargar no está disponible en esta vista."); return; }
  if (!downloads) {
    // fuera de claude.ai (GitHub Pages o archivo) se descarga con un enlace normal
    const type = /\.xlsx$/i.test(filename) ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : /\.csv$/i.test(filename) ? "text/csv" : /\.html?$/i.test(filename) ? "text/html" : "text/plain";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: type + ";charset=utf-8" }));
    a.download = filename;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return;
  }
  try { await downloads.save({ filename, data }); } catch (e) { if (e && e.code !== "declined") toast("No se pudo descargar el archivo."); }
}

