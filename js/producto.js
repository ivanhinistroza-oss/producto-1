// ---------- diálogo producto ----------
const dlg = $("#dlg");
let editing = null;
let editFoto = ""; // foto del producto que se está editando ("" = sin foto)
// ---------- costo y ganancia ----------
const tieneCosto = p => p && p.costo != null && p.costo !== "";
// muestra en el editor cuánto se gana por unidad al precio de venta
function margenVista() {
  const el = $("#p-margen"), costo = $("#p-costo").value, precio = n2($("#p-precio").value);
  if (costo === "" || !precio) { el.textContent = "Con el costo, Reportes te muestra cuánto ganas."; return; }
  const gana = precio - n2(costo);
  el.textContent = gana >= 0
    ? `Ganas ${money(gana)} por unidad (${Math.round(gana / precio * 100)} % del precio).`
    : `Pierdes ${money(-gana)} por unidad: el costo es mayor que el precio.`;
}
["#p-precio", "#p-costo"].forEach(s => $(s).addEventListener("input", margenVista));
// costo de una línea vendida: el que se guardó al vender; las ventas de antes usan el costo actual del producto
function itemCosto(i) {
  if (i.costo != null) return n2(i.costo);
  const p = i.productId && S.products.find(x => x.id === i.productId);
  return tieneCosto(p) ? n2(p.costo) : null;
}
// ganancia de un grupo de notas emitidas. Los productos sin costo no entran en la cuenta;
// los descuentos (líneas en negativo) sí, porque bajan lo que se ganó.
function gananciaDe(ok) {
  const g = { ingresos: 0, costo: 0, descuentos: 0, sinCosto: 0, lineasSinCosto: 0, productos: new Map() };
  ok.forEach(n => (n.items || []).forEach(i => {
    const monto = n2(i.cant) * n2(i.precio), c = itemCosto(i);
    if (monto < 0) { g.ingresos += monto; g.descuentos += monto; return; }
    if (c == null) { g.sinCosto += monto; g.lineasSinCosto++; return; }
    const costo = n2(i.cant) * c;
    g.ingresos += monto; g.costo += costo;
    const p = i.productId && S.products.find(x => x.id === i.productId);
    const k = i.productId || norm(i.nombre);
    const d = g.productos.get(k) || { nombre: p ? p.nombre : String(i.nombre || "").replace(/\s+–\s+[^–]*$/, ""), cat: p?.categoria || "", unidades: 0, ingresos: 0, costo: 0 };
    d.unidades += n2(i.cant); d.ingresos += monto; d.costo += costo;
    g.productos.set(k, d);
  }));
  g.ganancia = round2(g.ingresos - g.costo);
  g.margen = g.ingresos > 0 ? g.ganancia / g.ingresos * 100 : 0;
  return g;
}
function openProduct(id) {
  if (!exigir(id ? "producto.editar" : "producto.crear", id ? "editar productos" : "crear productos")) return;
  editing = id ? S.products.find(p => p.id === id) : null;
  $("#pformTitle").textContent = editing ? "Editar producto" : "Nuevo producto";
  $("#p-nombre").value = editing ? editing.nombre : "";
  $("#p-categoria").value = editing ? editing.categoria || "" : "";
  $("#p-codigo").value = editing ? editing.codigo || "" : "";
  codigoVista();
  $("#p-precio").value = editing ? n2(editing.precio) : "";
  $("#p-stock").value = editing ? n2(editing.stock) : "";
  $("#p-minimo").value = editing ? n2(editing.minimo) : "";
  $("#p-costo").value = editing && tieneCosto(editing) ? n2(editing.costo) : "";
  margenVista();
  $("#p-unidad").value = editing ? editing.unidad || "und" : "und";
  openVariantEditor(editing);
  editFoto = editing && fotoOk(editing) ? editing.foto : "";
  showFoto();
  $("#p-web-row").hidden = !webVinculada();
  $("#p-web").checked = !!(editing && editing.web);
  $("#p-err").hidden = true;
  avisoNombreRepetido();
  const del = $("#p-del"); del.hidden = !editing; del.classList.remove("armed"); del.textContent = "Eliminar";
  catTodas = false;
  renderCatChips();
  showSimilar();
  dlg.showModal();
  setTimeout(() => $("#p-nombre").focus(), 30);
}
// Tallas y colores del producto que se edita: se eligen tocando; cada combinación es una fila con su stock
const pick = { tallas: [], colores: [], set: "Letras", skip: new Set() };
const comboKey = (t, c) => norm(t || "") + "|" + norm(c || "");
function openVariantEditor(p) {
  const vs = (p && p.variantes) || [];
  pick.tallas = uniq(vs.map(v => v.talla));
  pick.colores = uniq(vs.map(v => v.color));
  pick.skip = new Set();
  // abre el grupo de tallas que más coincide con las del producto
  const [best, hits] = Object.keys(TALLAS).map(k => [k, pick.tallas.filter(t => TALLAS[k].some(x => norm(x) === norm(t))).length]).sort((a, b) => b[1] - a[1])[0];
  pick.set = hits ? best : "Letras";
  $("#p-talla-otra").value = ""; $("#p-color-otro").value = "";
  $("#p-variants").innerHTML = "";
  vs.forEach(v => addVariantEditor(v, true));
  // una combinación que no sale de cruzar las tallas y colores elegidos se trata como hecha a mano
  const all = new Set(combos().map(([t, c]) => comboKey(t, c)));
  const rows = [...$("#p-variants").querySelectorAll("[data-variant-row]")], have = new Set(rows.map(r => comboKey(rowVal(r, "talla"), rowVal(r, "color"))));
  rows.forEach(r => { if (!all.has(comboKey(rowVal(r, "talla"), rowVal(r, "color")))) setLoose(r); });
  // las combinaciones que el producto no tiene no se agregan solas al tocar otra talla o color
  all.forEach(k => { if (!have.has(k)) pick.skip.add(k); });
  pick.masColores = false;
  layoutVariantRows();
  $("#p-variations").open = vs.length > 0;
  renderPick();
}
const rowVal = (r, k) => r.querySelector(`[data-vfield="${k}"]`).value.trim();
function combos() {
  const ts = pick.tallas.length ? pick.tallas : [""], cs = pick.colores.length ? pick.colores : [""];
  return pick.tallas.length || pick.colores.length ? ts.flatMap(t => cs.map(c => [t, c])) : [];
}
function renderPick() {
  // las tallas y colores propios (no de la lista) que se usaron en cualquier producto también aparecen para tocar
  const usadasT = uniq([...pick.tallas, ...S.products.flatMap(p => (p.variantes || []).map(v => v.talla))]).filter(t => !Object.values(TALLAS).flat().some(x => norm(x) === norm(t)));
  const usadasC = uniq([...pick.colores, ...S.products.flatMap(p => (p.variantes || []).map(v => v.color))]).filter(c => !Object.keys(COLORES).some(x => norm(x) === norm(c)));
  const on = (list, x) => list.some(y => norm(y) === norm(x));
  const chip = (kind, x, list, pre = "") => `<button type="button" data-pick="${kind}" data-value="${esc(x)}" aria-pressed="${on(list, x)}">${pre}${esc(x)}</button>`;
  const fuera = pick.tallas.filter(t => !on(TALLAS[pick.set], t) && !on(usadasT, t)); // elegidas de otro grupo: siguen a la vista
  $("#p-tallaset").innerHTML = Object.keys(TALLAS).map(k => `<button type="button" data-tallaset="${esc(k)}" aria-pressed="${k === pick.set}">${esc(k)}</button>`).join("");
  $("#p-tallas").innerHTML = uniq([...TALLAS[pick.set], ...fuera, ...usadasT]).sort(byTalla).map(t => chip("talla", t, pick.tallas)).join("");
  // los colores más comunes, los elegidos y los propios a la vista; el resto detrás de «+ N colores más»
  const todos = [...Object.keys(COLORES), ...usadasC];
  const visibles = pick.masColores ? todos : todos.filter((c, i) => i < 8 || on(pick.colores, c) || usadasC.includes(c));
  const ocultos = todos.length - visibles.length;
  const mas = ocultos ? `<button type="button" class="pick-more" data-pick-more>+ ${ocultos} colores más</button>`
    : pick.masColores ? `<button type="button" class="pick-more" data-pick-more>Menos colores</button>` : "";
  $("#p-colores").innerHTML = visibles.map(c => chip("color", c, pick.colores, swatch(c))).join("") + mas;
  updateVariantSummary();
}
// ordena las filas por color y talla; si algún color tiene varias tallas, las agrupa bajo el color con su total
function layoutVariantRows() {
  const box = $("#p-variants");
  box.querySelectorAll(".var-group").forEach(g => g.remove());
  const rows = [...box.querySelectorAll("[data-variant-row]")];
  const fijas = rows.filter(r => !("loose" in r.dataset))
    .sort((a, b) => byColor(rowVal(a, "color"), rowVal(b, "color")) || byTalla(rowVal(a, "talla"), rowVal(b, "talla")));
  const sueltas = rows.filter(r => "loose" in r.dataset);
  const colores = uniq(fijas.map(r => rowVal(r, "color")));
  const agrupar = colores.some(Boolean) && fijas.length > colores.length;
  box.classList.toggle("agrupado", agrupar);
  const grupo = (html, color) => {
    const g = document.createElement("div");
    g.className = "var-group";
    g.innerHTML = (color ? swatch(color) : "") + `<span>${html}</span><span class="muted" data-group-total></span>`;
    box.append(g);
  };
  let actual = null;
  fijas.forEach(r => {
    const t = rowVal(r, "talla"), c = rowVal(r, "color");
    if (agrupar && norm(c) !== actual) { actual = norm(c); grupo(esc(c || "Sin color"), c); }
    r.querySelector(".var-label").textContent = agrupar ? (t || "Sin talla") : [t, c].filter(Boolean).join(" / ");
    box.append(r);
  });
  if (agrupar && sueltas.length) grupo("Agregadas a mano");
  sueltas.forEach(r => box.append(r));
  $("#p-var-head").firstElementChild.textContent = agrupar ? "Talla" : "Combinación";
  updateVariantSummary();
}
function updateVariantSummary() {
  // total de cada grupo de color
  let g = null;
  const tot = new Map();
  for (const el of $("#p-variants").children) {
    if (el.classList.contains("var-group")) { g = el; tot.set(g, 0); }
    else if (g && "variantRow" in el.dataset) tot.set(g, tot.get(g) + n2(rowVal(el, "stock")));
  }
  tot.forEach((n, el) => { el.querySelector("[data-group-total]").textContent = qty(n) + " und"; });
  const rows = $("#p-variants").querySelectorAll("[data-variant-row]");
  $("#p-var-head").hidden = !rows.length;
  $("#p-var-sum").textContent = rows.length ? `Tallas y colores · ${rows.length} ${rows.length === 1 ? "combinación" : "combinaciones"}` : "Tallas y colores (opcional)";
  // con variantes, el stock del producto es la suma de todas
  const stock = $("#p-stock");
  stock.readOnly = rows.length > 0;
  stock.title = rows.length ? "Es la suma del stock de cada talla y color" : "";
  if (rows.length) stock.value = [...rows].reduce((a, r) => a + n2(rowVal(r, "stock")), 0);
}
// agrega las combinaciones nuevas, quita las de tallas o colores desmarcados y ordena la lista
function syncVariantRows() {
  const box = $("#p-variants"), want = combos().filter(([t, c]) => !pick.skip.has(comboKey(t, c)));
  const wantKeys = new Set(want.map(([t, c]) => comboKey(t, c)));
  let perdido = 0;
  box.querySelectorAll("[data-variant-row]:not([data-loose])").forEach(r => {
    if (!wantKeys.has(comboKey(rowVal(r, "talla"), rowVal(r, "color")))) { if (n2(rowVal(r, "stock"))) perdido++; r.remove(); }
  });
  const have = new Set([...box.querySelectorAll("[data-variant-row]")].map(r => comboKey(rowVal(r, "talla"), rowVal(r, "color"))));
  want.forEach(([talla, color]) => { if (!have.has(comboKey(talla, color))) addVariantEditor({ talla, color, stock: 0 }, true); });
  if (perdido) toast("Se quitaron combinaciones que tenían stock. Si fue un error, toca Cancelar.");
  layoutVariantRows();
}
function setLoose(row) {
  const t = rowVal(row, "talla"), c = rowVal(row, "color");
  row.dataset.loose = "";
  row.firstElementChild.outerHTML = `<div class="var-loose"><input type="text" data-vfield="talla" value="${esc(t)}" placeholder="Talla" aria-label="Talla"><input type="text" data-vfield="color" value="${esc(c)}" placeholder="Color" aria-label="Color"></div>`;
}
function addVariantEditor(v = {}, auto = false) {
  const row = document.createElement("div");
  row.className = "var-edit";
  row.dataset.variantRow = "";
  row.dataset.variantId = v.id || uid();
  const name = [v.talla, v.color].filter(Boolean).join(" / ");
  row.innerHTML = `<div class="var-name">${v.color ? swatch(v.color) : ""}<span class="var-label">${esc(name)}</span><input type="hidden" data-vfield="talla" value="${esc(v.talla || "")}"><input type="hidden" data-vfield="color" value="${esc(v.color || "")}"></div>
    <input data-vfield="stock" type="number" min="0" step="1" inputmode="numeric" value="${n2(v.stock)}" aria-label="Stock ${esc(name)}">
    <input data-vfield="precio" type="number" min="0" step="0.01" inputmode="decimal" value="${v.precio == null ? "" : n2(v.precio)}" placeholder="Igual" aria-label="Precio ${esc(name)} (vacío = precio del producto)">
    <input type="text" data-vfield="codigo" value="${esc(v.codigo || "")}" placeholder="Código (opcional)" aria-label="Código ${esc(name)}">
    <button type="button" class="x" data-rmvariant aria-label="Quitar ${esc(name || "combinación")}">✕</button>`;
  $("#p-variants").append(row);
  if (!auto) { setLoose(row); row.querySelector("input").focus(); }
}
document.getElementById("pform").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.tallaset) { pick.set = b.dataset.tallaset; return renderPick(); }
  if ("pickMore" in b.dataset) { pick.masColores = !pick.masColores; return renderPick(); }
  if ("catMore" in b.dataset) { catTodas = !catTodas; return renderCatChips(); }
  if (b.dataset.cat !== undefined) {
    $("#p-categoria").value = b.dataset.cat;
    showSimilar(); return renderCatChips();
  }
  if (b.dataset.pick) {
    const list = b.dataset.pick === "talla" ? pick.tallas : pick.colores, x = b.dataset.value, i = list.findIndex(y => norm(y) === norm(x));
    if (i >= 0) list.splice(i, 1); else list.push(x);
    pick.skip = new Set([...pick.skip].filter(k => !k.split("|").includes(norm(x))));
    syncVariantRows(); return renderPick();
  }
  if (b.dataset.pickAdd) {
    const inp = b.dataset.pickAdd === "talla" ? $("#p-talla-otra") : $("#p-color-otro"), x = inp.value.trim(), list = b.dataset.pickAdd === "talla" ? pick.tallas : pick.colores;
    if (!x) return inp.focus();
    if (!list.some(y => norm(y) === norm(x))) list.push(x);
    inp.value = "";
    syncVariantRows(); return renderPick();
  }
});
["#p-talla-otra", "#p-color-otro"].forEach(sel => $(sel).addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); e.target.nextElementSibling.click(); }
}));
$("#p-addvariant").onclick = () => {
  addVariantEditor();
  layoutVariantRows();
  const nueva = [...$("#p-variants").querySelectorAll("[data-loose]")].pop();
  if (nueva) nueva.querySelector("input").focus();
};
$("#p-variants").addEventListener("click", e => {
  const row = e.target.closest("[data-rmvariant]") && e.target.closest("[data-variant-row]"); if (!row) return;
  // una combinación quitada a mano no vuelve a aparecer al tocar otra talla o color
  if (!("loose" in row.dataset)) pick.skip.add(comboKey(rowVal(row, "talla"), rowVal(row, "color")));
  row.remove(); layoutVariantRows();
});
$("#p-variants").addEventListener("input", e => { if (e.target.dataset.vfield === "stock") updateVariantSummary(); });
function showSimilar() {
  const box = $("#p-similar");
  const sims = mostSimilar($("#p-nombre").value, editing && editing.id);
  if (!sims.length) { box.hidden = true; return; }
  const catCount = {};
  sims.forEach(x => { const c = (x.p.categoria || "").trim(); if (c) catCount[c] = (catCount[c] || 0) + x.s; });
  const sug = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
  const cur = $("#p-categoria").value.trim();
  box.innerHTML = `<b>Se parece a:</b><ul>${sims.map(x => `<li><span>${esc(x.p.nombre)}${x.p.categoria ? ` <span class="muted">· ${esc(x.p.categoria)}</span>` : ""}</span><span class="pct">${Math.round(x.s * 100)}%</span></li>`).join("")}</ul>
    ${sug && sug[0] !== cur ? `<div><button type="button" class="btn" id="useCat">Usar categoría «${esc(sug[0])}»</button></div>` : ""}`;
  box.hidden = false;
  const b = $("#useCat"); if (b) b.onclick = () => { $("#p-categoria").value = sug[0]; showSimilar(); renderCatChips(); };
}
// dos productos con el mismo nombre se confunden al vender: se avisa mientras se escribe y no se deja guardar.
// Cuenta como igual aunque cambien mayúsculas, tildes, espacios o signos («Colchón  King» = «colchon king»).
function productoConNombre(nombre, exceptoId) {
  const clave = norm(nombre);
  return clave ? S.products.find(x => x.id !== exceptoId && norm(x.nombre) === clave) : null;
}
function avisoNombreRepetido() {
  const el = $("#p-nombre-aviso"), otro = productoConNombre($("#p-nombre").value, editing && editing.id);
  el.textContent = otro ? `Ya existe un producto llamado «${otro.nombre}». Cambia el nombre (por ejemplo, agrega la medida o la marca) o edita ese producto.` : "";
  el.hidden = !otro;
  return !!otro;
}
$("#p-nombre").addEventListener("input", showSimilar);
$("#p-nombre").addEventListener("input", avisoNombreRepetido);
$("#p-categoria").addEventListener("input", showSimilar);
$("#p-categoria").addEventListener("input", renderCatChips);
// Categorías que ya se usan, para elegir tocando. Las que solo cambian en mayúsculas o tildes
// («colchones», «Colchones») cuentan como una, con la escritura más usada.
function categoriasUsadas(exceptoId) {
  const m = new Map();
  S.products.forEach(p => {
    if (p.id === exceptoId) return;
    const c = (p.categoria || "").trim(); if (!c) return;
    const k = norm(c), e = m.get(k) || { n: 0, formas: new Map() };
    e.n++; e.formas.set(c, (e.formas.get(c) || 0) + 1); m.set(k, e);
  });
  return [...m].map(([k, e]) => ({ k, nombre: [...e.formas].sort((a, b) => b[1] - a[1])[0][0], n: e.n }))
    .sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, "es"));
}
// lo escrito se guarda con la escritura de la categoría que ya existe
function categoriaCanonica(texto) {
  // sin contar el producto que se edita: así se puede corregir la escritura de una categoría propia
  const k = norm(texto), c = k && categoriasUsadas(editing && editing.id).find(x => x.k === k);
  return c ? c.nombre : texto.trim();
}
const CAT_VISIBLES = 10;
let catTodas = false;
function renderCatChips() {
  const box = $("#p-cats"), escrito = norm($("#p-categoria").value), todas = categoriasUsadas();
  const elegida = todas.find(c => c.k === escrito);
  // mientras se escribe una que no existe, solo las que la contienen
  const filtradas = escrito && !elegida ? todas.filter(c => c.k.includes(escrito)) : todas;
  let lista = catTodas ? filtradas : filtradas.slice(0, CAT_VISIBLES);
  if (elegida && !lista.includes(elegida)) lista = [elegida, ...lista];
  const ocultas = filtradas.length - lista.filter(c => filtradas.includes(c)).length;
  const mas = ocultas ? `<button type="button" class="pick-more" data-cat-more>+ ${ocultas} más</button>`
    : catTodas && filtradas.length > CAT_VISIBLES ? `<button type="button" class="pick-more" data-cat-more>Ver menos</button>` : "";
  box.hidden = !lista.length;
  box.innerHTML = `<span class="cat-chips-label">${escrito && !elegida ? "Parecidas que ya usas" : "Tus categorías"}</span>
    <div class="pick-chips">${lista.map(c => `<button type="button" data-cat="${esc(c.nombre)}" aria-pressed="${c === elegida}" title="${c.n} producto${c.n === 1 ? "" : "s"}">${esc(c.nombre)} <span class="n">${c.n}</span></button>`).join("")}${mas}</div>`;
}
$("#p-cancel").onclick = () => dlg.close();
function showFoto() {
  const prev = $("#p-foto-prev");
  prev.innerHTML = editFoto ? `<img src="${esc(editFoto)}" alt="Foto del producto">` : `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/></svg>`;
  $("#p-foto-pick").textContent = editFoto ? "Cambiar foto" : "Agregar foto";
  $("#p-foto-rm").hidden = !editFoto;
}
// La foto se recorta al centro en un cuadrado de 240 px y se guarda en JPG (unos 15 KB)
// dentro del producto, así llega a todos los equipos sin un servicio de archivos aparte.
async function fotoDesdeArchivo(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url; });
    const side = Math.min(img.naturalWidth, img.naturalHeight), size = Math.min(240, side);
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, size, size); // las imágenes con fondo transparente quedan sobre blanco
    g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return c.toDataURL("image/jpeg", 0.8);
  } finally { URL.revokeObjectURL(url); }
}
$("#p-foto-pick").onclick = () => $("#p-foto-file").click();
$("#p-foto-rm").onclick = () => { editFoto = ""; showFoto(); };
$("#p-foto-file").addEventListener("change", async e => {
  const file = e.target.files[0]; e.target.value = "";
  if (!file) return;
  if (!/^image\//.test(file.type)) return toast("Elige un archivo de imagen (JPG o PNG).");
  try { editFoto = await fotoDesdeArchivo(file); showFoto(); }
  catch { toast("No se pudo abrir esa imagen."); }
});
$("#p-del").onclick = async e => {
  const b = e.currentTarget;
  if (!b.classList.contains("armed")) { b.classList.add("armed"); b.textContent = "Confirmar eliminación"; return; }
  try { await removeProduct(editing.id); dlg.close(); toast("Producto eliminado"); } catch (err) { toast(failMsg(err)); }
};
$("#pform").addEventListener("submit", async e => {
  e.preventDefault();
  const nombre = $("#p-nombre").value.trim();
  if (!nombre) { const er = $("#p-err"); er.textContent = "Escribe el nombre del producto."; er.hidden = false; return; }
  // los repetidos que ya existían se pueden seguir editando mientras no se toque el nombre
  const repetido = avisoNombreRepetido();
  if (repetido && (!editing || norm(nombre) !== norm(editing.nombre))) { $("#p-nombre").focus(); return; }
  const p = {
    ...(editing || {}),
    id: editing ? editing.id : uid(),
    nombre, categoria: categoriaCanonica($("#p-categoria").value), codigo: $("#p-codigo").value.trim(),
    precio: n2($("#p-precio").value), stock: n2($("#p-stock").value), minimo: n2($("#p-minimo").value),
    unidad: $("#p-unidad").value, actualizado: new Date().toISOString(),
  };
  const variants=[...$("#p-variants").querySelectorAll("[data-variant-row]")].map(r=>{const get=k=>r.querySelector(`[data-vfield="${k}"]`).value;const v={id:r.dataset.variantId,talla:get("talla").trim(),color:get("color").trim(),stock:n2(get("stock"))};if(get("codigo").trim())v.codigo=get("codigo").trim();if(get("precio")!=="")v.precio=n2(get("precio"));return v;}).filter(v=>v.talla||v.color);
  if(variants.length){p.variantes=variants;p.stock=variants.reduce((a,v)=>a+n2(v.stock),0);}else delete p.variantes;
  const choque = conflictoCodigo(p, editing);
  if (choque) { const er = $("#p-err"); er.textContent = choque; er.hidden = false; return; }
  if ($("#p-costo").value !== "") p.costo = n2($("#p-costo").value); else delete p.costo;
  if (editFoto) p.foto = editFoto; else delete p.foto;
  fotoLista = null;
  if (!editing) p.creado = p.actualizado;
  if (webVinculada()) { if ($("#p-web").checked) p.web = true; else delete p.web; }
  delete p.ejemplo;
  const btn = $("#p-save"); btn.disabled = true;
  try { await putProductUnico(p, editing); dlg.close(); toast(editing ? "Producto actualizado" : "Producto guardado"); }
  catch (err) {
    if (err.aviso) { const a = $("#p-nombre-aviso"); a.textContent = err.aviso; a.hidden = false; $("#p-nombre").focus(); }
    else { const er = $("#p-err"); er.textContent = failMsg(err); er.hidden = false; }
  }
  finally { btn.disabled = false; }
});

