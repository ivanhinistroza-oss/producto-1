// ---------- documentos A4 (cotizaciones y reportes) ----------
// La hoja se ve igual en pantalla y al imprimir: este CSS también se copia en el archivo que se imprime.
const A4_CSS = `
.a4{background:#fff;color:#1d2622;font-family:"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif;font-size:12px;line-height:1.45;--a4-accent:#0d6e5f;--a4-soft:#e3f1ed;--a4-line:#d5ddd9;--a4-muted:#5f6f68}
.a4 *{box-sizing:border-box}
.a4-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding-bottom:14px;border-bottom:3px solid var(--a4-accent)}
.a4-biz{display:flex;gap:12px;align-items:flex-start;min-width:0}
.a4-biz img{max-width:90px;max-height:70px;object-fit:contain}
.a4-biz h1{margin:0 0 2px;font-size:1.45em;line-height:1.2;color:var(--a4-accent)}
.a4-biz p{margin:0;color:var(--a4-muted);overflow-wrap:anywhere}
.a4-doc{flex:none;text-align:right}
.a4-kind{font-size:1.5em;font-weight:700;letter-spacing:.04em;color:var(--a4-accent)}
.a4-num{display:inline-block;margin-top:4px;padding:3px 10px;border-radius:4px;background:var(--a4-soft);font-weight:700;font-family:Consolas,"Courier New",monospace}
.a4-meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
.a4-box{border:1px solid var(--a4-line);border-radius:6px;padding:10px 12px;min-width:0}
.a4-box h3,.a4-kpi span{margin:0 0 6px;font-size:.8em;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--a4-muted)}
.a4-box b{overflow-wrap:anywhere}
.a4-kv{display:flex;justify-content:space-between;gap:10px}
.a4 table{width:100%;border-collapse:collapse;margin:6px 0 4px}
.a4 th{background:var(--a4-accent);color:#fff;font-weight:600;text-align:left;padding:7px 8px;font-size:.92em}
.a4 td{padding:7px 8px;border-bottom:1px solid var(--a4-line);vertical-align:top;overflow-wrap:anywhere}
.a4 tbody tr:nth-child(even) td{background:#f5f8f7}
.a4 .n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.a4 tfoot td{font-weight:700;border-bottom:0;border-top:2px solid var(--a4-accent)}
.a4 tr{break-inside:avoid}
.a4-totals{margin-left:auto;width:min(280px,100%);margin-top:8px}
.a4-totals .a4-kv{padding:4px 8px}
.a4-totals .a4-grand{background:var(--a4-accent);color:#fff;border-radius:4px;font-size:1.2em;font-weight:700;padding:8px}
.a4-words{margin-top:8px;font-size:.92em;color:var(--a4-muted)}
.a4-notes p{margin:0;white-space:pre-wrap}
.a4 h2{font-size:1.05em;margin:18px 0 4px;color:var(--a4-accent)}
.a4-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:14px 0}
.a4-kpi{border:1px solid var(--a4-line);border-radius:6px;padding:8px 10px;min-width:0}
.a4-kpi span{display:block;margin:0}
.a4-kpi b{font-size:1.25em;overflow-wrap:anywhere}
.a4-sub{color:var(--a4-muted);margin-top:8px}
.a4-empty{color:var(--a4-muted)}
.a4-stamp{display:inline-block;border:2px solid currentColor;padding:1px 8px;border-radius:4px;font-weight:700;font-size:.85em;margin-top:6px}
.a4-foot{margin-top:24px;padding-top:10px;border-top:1px solid var(--a4-line);color:var(--a4-muted);font-size:.88em;text-align:center}
.a4-foot p{margin:2px 0}
`;
document.head.append(Object.assign(document.createElement("style"), { textContent: A4_CSS }));
const fmtDay = d => { d = new Date(d); return isNaN(d) ? "" : d.toLocaleDateString("es", { day: "2-digit", month: "2-digit", year: "numeric" }); };
const round2 = v => Math.round(n2(v) * 100) / 100;
function socialLinks(s) {
  return [
    s.facebook && "Facebook: " + s.facebook,
    s.instagram && "Instagram: " + s.instagram,
    s.tiktok && "TikTok: " + s.tiktok,
    s.web && "Tienda virtual: " + s.web
  ].filter(Boolean);
}
// Cabecera como en Treinta: logo y datos del negocio a la izquierda, tipo y número del documento a la derecha.
function docHeadHtml(kind, number) {
  const s = S.settings;
  const address = [s.direccion, s.ciudad].filter(Boolean).join(" · ");
  const contact = [s.telefono && "Tel./WhatsApp: " + s.telefono, s.correo].filter(Boolean).join(" · ");
  return `<div class="a4-head">
    <div class="a4-biz">
      ${/^data:image\//.test(s.logo || "") ? `<img src="${esc(s.logo)}" alt="">` : ""}
      <div>
        <h1>${esc(s.negocio || "Mi negocio")}</h1>
        ${s.razonSocial ? `<p>${esc(s.razonSocial)}</p>` : ""}
        ${s.ruc ? `<p>RUC: ${esc(s.ruc)}</p>` : ""}
        ${address ? `<p>${esc(address)}</p>` : ""}
        ${contact ? `<p>${esc(contact)}</p>` : ""}
      </div>
    </div>
    <div class="a4-doc"><div class="a4-kind">${esc(kind)}</div>${number ? `<div class="a4-num">${esc(number)}</div>` : ""}</div>
  </div>`;
}
function docFootHtml(note) {
  const s = S.settings, social = s.mostrarRedes !== false ? socialLinks(s) : [];
  return `<div class="a4-foot">
    ${note ? `<p>${esc(note)}</p>` : ""}
    ${social.length ? `<p>${esc(social.join(" · "))}</p>` : ""}
  </div>`;
}
function a4PrintHtml(title, body, autoPrint) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
@page{size:A4;margin:12mm}
*{box-sizing:border-box}
body{margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
${A4_CSS}
.hint{font-family:system-ui,sans-serif;font-size:14px;max-width:210mm;margin:16px auto;padding:0 16px;color:#333}
.hint button{font:inherit;font-weight:600;padding:8px 14px;cursor:pointer}
@media screen{body{background:#e9ecea}.a4{max-width:210mm;margin:0 auto 16px;padding:14mm;box-shadow:0 2px 10px rgb(0 0 0 / .15)}}
@media print{.hint{display:none}}
</style></head><body>
<div class="hint"><p>Si no se abrió la ventana de impresión, presiona <b>Ctrl + P</b> o el botón. Elige papel <b>A4</b>. Para guardarlo como PDF, en «Impresora» o «Destino» elige <b>Guardar como PDF</b>.</p><button onclick="print()">Imprimir</button></div>
${body}
${autoPrint ? '<script>addEventListener("load",function(){setTimeout(function(){print()},300)})<\/script>' : ""}
</body></html>`;
}
// En claude.ai no se puede imprimir desde la página: se descarga el archivo listo para imprimir.
async function printA4(title, body, button) {
  if (canPrintLocally()) {
    printFrame(a4PrintHtml(title, body, false), "210mm", button);
    toast("Elige papel A4. Para PDF: «Guardar como PDF».");
  }
  else await saveFile(title + ".html", a4PrintHtml(title, body, true));
}
function csvText(rows) {
  return "﻿" + rows.map(r => r.map(v => /[",;\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(",")).join("\n");
}

// ---------- cotizaciones ----------
const quoteNum = n => "COT-" + String(n).padStart(5, "0");
const blankQuote = () => ({ id: null, numero: null, cliente: "", doc: "", telefono: "", direccion: "", validez: 15, descuento: "", obs: store.get("mostrador.quoteObs") || "", items: [] });
let quoteEdit = store.get("mostrador.quoteDraft"); // null: se ve la lista; un objeto: se está armando una cotización
let quoteQ = "", quotePickQ = "", selQuote = null, quotesBlocked = false;
const saveQuoteDraft = () => store.set("mostrador.quoteDraft", quoteEdit);
const quoteSubtotal = q => (q.items || []).reduce((a, i) => a + n2(i.cant) * n2(i.precio), 0);
const nextQuoteNum = () => S.quotes.reduce((m, q) => Math.max(m, n2(q.numero)), 0) + 1;
function quoteExpiry(q) { const d = new Date(q.fecha || Date.now()); d.setDate(d.getDate() + (n2(q.validez) || 15)); return d; }
function quoteState(q) {
  if (q.estado === "vendida") return "Vendida";
  const end = quoteExpiry(q); end.setHours(23, 59, 59, 999);
  return end < new Date() ? "Vencida" : "Pendiente";
}
function quoteDocHtml(q, preview) {
  const s = S.settings;
  const items = (q.items || []).filter(i => n2(i.cant) > 0);
  const sub = round2(quoteSubtotal({ items }));
  const desc = Math.min(round2(q.descuento), sub);
  const total = round2(sub - desc);
  const state = preview ? "" : quoteState(q);
  return `<article class="a4 a4-page">
    ${docHeadHtml("COTIZACIÓN", quoteNum(q.numero) + (preview ? " (borrador)" : ""))}
    <div class="a4-meta">
      <div class="a4-box"><h3>Cliente</h3>
        <b>${esc(q.cliente || "Cliente")}</b>
        ${q.doc ? `<div>DNI / RUC: ${esc(q.doc)}</div>` : ""}
        ${q.telefono ? `<div>Tel.: ${esc(q.telefono)}</div>` : ""}
        ${q.direccion ? `<div>${esc(q.direccion)}</div>` : ""}
      </div>
      <div class="a4-box"><h3>Detalle</h3>
        <div class="a4-kv"><span>Fecha de emisión</span><b>${fmtDay(q.fecha || Date.now())}</b></div>
        <div class="a4-kv"><span>Válida hasta</span><b>${fmtDay(quoteExpiry(q))}</b></div>
        ${q.vendedorNombre ? `<div class="a4-kv"><span>Atendió</span><b>${esc(q.vendedorNombre)}</b></div>` : ""}
        ${state && state !== "Pendiente" ? `<span class="a4-stamp">${state.toUpperCase()}</span>` : ""}
      </div>
    </div>
    <table>
      <thead><tr><th style="width:2.4em">#</th><th>Descripción</th><th class="n">Cant.</th><th class="n">P. unit.</th><th class="n">Importe</th></tr></thead>
      <tbody>${items.map((i, k) => `<tr><td>${k + 1}</td><td>${esc(i.nombre)}</td><td class="n">${qty(i.cant)} ${esc(i.unidad || "")}</td><td class="n">${money(i.precio)}</td><td class="n">${money(n2(i.cant) * n2(i.precio))}</td></tr>`).join("")
        || `<tr><td colspan="5" class="a4-empty">Agrega productos a la cotización.</td></tr>`}</tbody>
    </table>
    <div class="a4-totals">
      <div class="a4-kv"><span>Subtotal</span><span class="n">${money(sub)}</span></div>
      ${desc ? `<div class="a4-kv"><span>Descuento</span><span class="n">− ${money(desc)}</span></div>` : ""}
      <div class="a4-kv a4-grand"><span>TOTAL</span><span class="n">${money(total)}</span></div>
    </div>
    ${s.montoEnLetras !== false ? `<div class="a4-words">SON: ${esc(numeroALetras(total, s.moneda || "S/"))}</div>` : ""}
    ${q.obs ? `<div class="a4-notes"><h2>Condiciones y notas</h2><p>${esc(q.obs)}</p></div>` : ""}
    ${docFootHtml("Precios sujetos a stock disponible. Esta cotización no es un comprobante de pago.")}
  </article>`;
}
function renderCotizaciones() {
  if (!exigir("cotizacion.ver", "ver cotizaciones")) return;
  if (quoteEdit) return renderQuoteEditor();
  const el = $("#v-cotizaciones");
  const focusId = document.activeElement && document.activeElement.id;
  const quotes = [...S.quotes].sort((a, b) => n2(b.numero) - n2(a.numero));
  const q = norm(quoteQ);
  const list = quotes.filter(x => !q || norm(quoteNum(x.numero) + " " + (x.cliente || "") + " " + (x.doc || "") + " " + (x.items || []).map(i => i.nombre).join(" ")).includes(q));
  if (!selQuote || !S.quotes.some(x => x.id === selQuote)) selQuote = list[0] && list[0].id;
  const sel = S.quotes.find(x => x.id === selQuote);
  const pending = quotes.filter(x => quoteState(x) === "Pendiente");
  const chip = st => `<span class="chip ${st === "Vencida" ? "out" : st === "Vendida" ? "ex" : "low"}">${st}</span>`;
  el.innerHTML = `
    <div class="toolbar"><h1 style="margin-right:auto">Cotizaciones</h1><button class="btn primary" id="q-new">+ Nueva cotización</button></div>
    ${quotesBlocked ? `<p class="banner">Para guardar cotizaciones falta actualizar las reglas de Firebase: copia el archivo <b>firestore.rules</b> en Firestore → Reglas → Publicar.</p>` : ""}
    <div class="stats">
      <div class="stat"><b>${quotes.length}</b><span>Cotizaciones</span></div>
      <div class="stat"><b>${pending.length}</b><span>Pendientes</span></div>
      <div class="stat"><b>${money(pending.reduce((a, x) => a + n2(x.total), 0))}</b><span>Por cerrar</span></div>
      <div class="stat"><b>${quotes.filter(x => x.estado === "vendida").length}</b><span>Vendidas</span></div>
    </div>
    <div class="quotes">
      <div>
        <div class="toolbar"><input class="grow" type="search" id="quoteSearch" placeholder="Buscar por número, cliente o producto" value="${esc(quoteQ)}"></div>
        ${!S.loaded ? `<div class="empty">Cargando…</div>` : !quotes.length
          ? `<div class="empty"><h2>Aún no hay cotizaciones</h2><p>Arma una con <b>+ Nueva cotización</b>, imprímela en A4 o guárdala como PDF. Cuando el cliente acepte, conviértela en venta.</p></div>`
          : `<div class="list">${list.map(x => `<button class="nrow" data-quote="${esc(x.id)}" aria-current="${x.id === selQuote}">
              <span class="fol">${quoteNum(x.numero)}</span>
              <span class="who">${esc(x.cliente || "Cliente")}<small>${fmtDay(x.fecha)} · ${(x.items || []).length} ${(x.items || []).length === 1 ? "ítem" : "ítems"}</small></span>
              <span class="amt num">${money(x.total)}<small>${chip(quoteState(x))}</small></span></button>`).join("") || `<div class="empty">Ninguna cotización coincide.</div>`}</div>`}
      </div>
      <div>
        ${sel ? `<div class="doc-actions">
            <button class="btn primary" id="q-print">Imprimir A4 / PDF</button>
            <button class="btn" id="q-wa">Enviar por WhatsApp</button>
            ${sel.estado !== "vendida" && puede("venta.crear") ? `<button class="btn" id="q-sell">Convertir en venta</button>` : ""}
            ${puede("cotizacion.editar") && sel.estado !== "vendida" ? `<button class="btn" id="q-edit">Editar</button>` : ""}
            <button class="btn" id="q-copy">Duplicar</button>
            ${puede("cotizacion.eliminar") ? `<button class="btn danger" id="q-del">Eliminar</button>` : ""}
          </div>
          ${sel.estado === "vendida" && sel.notaFolio ? `<p class="muted" style="margin:0 0 10px">Vendida con la nota ${folioTxt(sel.notaFolio)}.</p>` : ""}
          <div class="a4-stage">${quoteDocHtml(sel)}</div>` : ""}
      </div>
    </div>`;
  if (focusId === "quoteSearch") { const i = $("#quoteSearch"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}
function renderQuoteEditor() {
  const el = $("#v-cotizaciones");
  const focusId = document.activeElement && document.activeElement.id;
  const caret = focusId && document.activeElement.selectionStart;
  const qd = quoteEdit;
  const res = productMatches(quotePickQ);
  const sub = quoteSubtotal(qd);
  const total = Math.max(0, round2(sub - n2(qd.descuento)));
  const validez = n2(qd.validez) || 15;
  el.innerHTML = `
    <div class="toolbar"><h1 style="margin-right:auto">${qd.id ? "Editar cotización" : "Nueva cotización"}</h1><span class="muted num">${quoteNum(qd.numero || nextQuoteNum())}</span></div>
    <div class="quote-editor">
      <div class="panel">
        <div class="grid2">
          <label class="f"><span>Cliente</span><input type="text" id="q-cliente" value="${esc(qd.cliente)}" placeholder="Nombre o empresa" autocomplete="off"></label>
          <label class="f"><span>DNI / RUC</span><input type="text" id="q-doc" value="${esc(qd.doc)}" placeholder="Opcional" autocomplete="off"></label>
          <label class="f"><span>Teléfono / WhatsApp</span><input type="text" id="q-tel" value="${esc(qd.telefono)}" placeholder="Opcional" inputmode="tel" autocomplete="off"></label>
          <label class="f"><span>Dirección o correo</span><input type="text" id="q-dir" value="${esc(qd.direccion)}" placeholder="Opcional" autocomplete="off"></label>
        </div>
        <div class="picker">
          <div class="scan-row"><label class="f"><span>Agregar producto</span><input type="search" id="q-pick" value="${esc(quotePickQ)}" placeholder="Escribe nombre o código" autocomplete="off"></label><button type="button" class="btn" id="q-scan"><svg class="bc-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3M8 9v6M11 9v6M14 9v6M17 9v6"/></svg>Escanear</button></div>
          ${norm(quotePickQ) ? pickerResultsHtml(res, `Agregar «${esc(quotePickQ)}» como ítem libre`) : ""}
        </div>
        <div class="lines">
          ${qd.items.length ? `<div class="line line-head"><span>Producto</span><span style="text-align:right">Cant.</span><span style="text-align:right">Precio</span><span class="sub">Importe</span><span></span></div>` : ""}
          ${qd.items.map((i, k) => `<div class="line">
              <div class="nm">${esc(i.nombre)}<small>${i.productId ? esc(i.unidad || "und") : "ítem libre"}</small></div>
              <input type="number" id="ql-cant-${k}" data-qcant="${k}" value="${i.cant}" min="0" step="1" inputmode="decimal" aria-label="Cantidad">
              <input type="number" id="ql-precio-${k}" data-qprecio="${k}" value="${i.precio}" min="0" step="0.01" inputmode="decimal" aria-label="Precio unitario">
              <span class="sub">${money(n2(i.cant) * n2(i.precio))}</span>
              <button class="x" data-qrm="${k}" aria-label="Quitar ${esc(i.nombre)}">×</button>
            </div>`).join("") || `<p class="muted" style="margin:4px 0">Busca un producto arriba. Si no está en tu inventario, agrégalo como ítem libre.</p>`}
        </div>
        <div class="grid2">
          <label class="f"><span>Válida por</span><select id="q-validez">${[7, 15, 30, 60].map(d => `<option value="${d}" ${d === validez ? "selected" : ""}>${d} días</option>`).join("")}</select></label>
          <label class="f"><span>Descuento (${esc(S.settings.moneda)})</span><input type="text" id="q-desc" value="${esc(qd.descuento)}" inputmode="decimal" autocomplete="off" placeholder="0.00"></label>
        </div>
        <label class="f"><span>Condiciones y notas</span><textarea id="q-obs" placeholder="Ej. Precios incluyen IGV. Entrega en 3 días hábiles. Adelanto del 50 %.">${esc(qd.obs)}</textarea></label>
        <div class="total-row"><span>Total</span><b>${money(total)}</b></div>
        <div class="actions">
          <button class="btn ghost" id="q-cancel">Cancelar</button>
          <div class="r"><button class="btn primary" id="q-save" ${qd.items.some(i => n2(i.cant) > 0) ? "" : "disabled"}>Guardar cotización</button></div>
        </div>
      </div>
      <div class="a4-stage">${quoteDocHtml({ ...qd, numero: qd.numero || nextQuoteNum(), fecha: qd.fecha || new Date().toISOString(), vendedorNombre: qd.vendedorNombre || usuarioActual()?.nombre }, true)}</div>
    </div>`;
  if (focusId && document.getElementById(focusId)) { const i = document.getElementById(focusId); i.focus(); try { i.setSelectionRange(caret, caret); } catch {} }
}
// html2pdf se carga solo la primera vez que se envía una cotización.
let html2pdfLoad = null;
function loadHtml2pdf() {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  html2pdfLoad = html2pdfLoad || new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    s.onload = () => ok(window.html2pdf);
    s.onerror = () => { html2pdfLoad = null; s.remove(); fail(new Error("pdf")); };
    document.head.append(s);
  });
  return html2pdfLoad;
}
async function quotePdfBlob(q) {
  const html2pdf = await loadHtml2pdf();
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;left:-10000px;top:0;width:186mm;background:#fff";
  box.innerHTML = quoteDocHtml(q);
  const page = box.firstElementChild;
  page.style.cssText = "padding:0;max-width:none;box-shadow:none;border-radius:0";
  document.body.append(box);
  try {
    return await html2pdf().set({
      margin: 12,
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: { scale: 2, backgroundColor: "#fff", scrollX: 0, scrollY: 0 }, // sin esto, con la página desplazada sale en blanco
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"], avoid: "tr" },
    }).from(page).outputPdf("blob");
  } finally { box.remove(); }
}
// WhatsApp no deja adjuntar archivos con un enlace: en el celular se comparte el PDF
// (eliges WhatsApp y el contacto); en la computadora se abre el chat del número y se descarga el PDF.
let quotePdfCache = null; // { key, blob }: el PDF ya hecho, para compartirlo al tocar de nuevo
async function sendQuotePdf(q, btn) {
  const phone = String(q.telefono || "").replace(/\D/g, "");
  const to = phone.length === 9 ? "51" + phone : phone; // celular peruano sin código de país
  const name = quoteNum(q.numero) + (q.cliente ? " " + q.cliente.replace(/[\\/:*?"<>|]/g, "") : "") + ".pdf";
  const text = `Hola${q.cliente ? " " + q.cliente : ""}, te envío la cotización ${quoteNum(q.numero)} de ${S.settings.negocio}. Total: ${money(q.total)}.`;
  const phoneShare = !!navigator.canShare && matchMedia("(pointer:coarse)").matches;
  // la ventana se abre en el mismo toque; si se abre después de crear el PDF, el navegador la bloquea
  if (!phoneShare) window.open("https://wa.me/" + to + "?text=" + encodeURIComponent(text), "_blank", "noopener");
  const key = JSON.stringify([q, S.settings]);
  let blob = quotePdfCache && quotePdfCache.key === key ? quotePdfCache.blob : null;
  if (!blob) {
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = "Preparando PDF…";
    try { blob = await quotePdfBlob(q); quotePdfCache = { key, blob }; }
    catch { toast("No se pudo crear el PDF. Revisa tu internet."); return; }
    finally { btn.disabled = false; btn.textContent = label; }
  }
  if (phoneShare) {
    const file = new File([blob], name, { type: "application/pdf" });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); return; }
      catch (e) {
        if (e.name === "AbortError") return;
        // crear el PDF tardó y el celular ya no permite compartir: el siguiente toque comparte al instante
        if (e.name === "NotAllowedError") { toast("PDF listo. Toca otra vez «Enviar por WhatsApp»."); return; }
      }
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(phoneShare ? "PDF descargado. Adjúntalo en el chat de WhatsApp." : "PDF descargado. Arrástralo al chat de WhatsApp que se abrió.");
}
async function saveQuote(btn) {
  const qd = quoteEdit;
  const prev = qd.id ? S.quotes.find(x => x.id === qd.id) : null;
  if (!exigir(prev ? "cotizacion.editar" : "cotizacion.crear", "guardar cotizaciones")) return;
  const items = qd.items.filter(i => n2(i.cant) > 0).map(i => ({ ...i, cant: n2(i.cant), precio: n2(i.precio) }));
  if (!items.length) return;
  const subtotal = round2(quoteSubtotal({ items }));
  const descuento = Math.min(round2(qd.descuento), subtotal);
  const user = usuarioActual();
  const quote = {
    ...(prev || {}),
    id: prev ? prev.id : uid(),
    numero: prev ? prev.numero : nextQuoteNum(),
    fecha: prev ? prev.fecha : new Date().toISOString(),
    cliente: qd.cliente.trim(), doc: qd.doc.trim(), telefono: qd.telefono.trim(), direccion: qd.direccion.trim(),
    validez: n2(qd.validez) || 15, obs: qd.obs.trim(), items, subtotal, descuento, total: round2(subtotal - descuento),
    estado: prev ? prev.estado || "pendiente" : "pendiente",
    vendedorId: prev ? prev.vendedorId : user?.id, vendedorNombre: prev ? prev.vendedorNombre : user?.nombre,
  };
  btn.disabled = true;
  try {
    await putQuote(quote);
    store.set("mostrador.quoteObs", quote.obs);
    quoteEdit = null; quotePickQ = ""; saveQuoteDraft();
    selQuote = quote.id;
    toast("Cotización " + quoteNum(quote.numero) + " guardada");
    renderCotizaciones();
  } catch (err) { toast(failMsg(err)); btn.disabled = false; }
}
$("#v-cotizaciones").addEventListener("click", async e => {
  const t = e.target.closest("button"); if (!t) return;
  const sel = S.quotes.find(x => x.id === selQuote);
  if (t.dataset.quote) { selQuote = t.dataset.quote; return renderCotizaciones(); }
  if (t.id === "q-new") {
    if (!exigir("cotizacion.crear", "crear cotizaciones")) return;
    quoteEdit = blankQuote(); quotePickQ = ""; saveQuoteDraft(); return renderCotizaciones();
  }
  // editor
  if (quoteEdit) {
    if (t.id === "q-scan") return abrirEscaner(cotizacionCodigo, "Apunta la cámara a cada producto. Se agregan solos; toca Listo al terminar.");
    if (t.dataset.addline) {
      const p = S.products.find(x => x.id === t.dataset.addline); if (!p) return;
      const v = t.dataset.variant && p.variantes && p.variantes.find(x => x.id === t.dataset.variant);
      if (p.variantes && p.variantes.length && !v) return;
      const ex = quoteEdit.items.find(i => i.productId === p.id && i.variantId === (v && v.id));
      if (ex) ex.cant = n2(ex.cant) + 1; else quoteEdit.items.push(itemFromProduct(p, v));
      quotePickQ = ""; saveQuoteDraft(); renderQuoteEditor(); return $("#q-pick").focus();
    }
    if (t.dataset.quickadd) {
      quoteEdit.items.push({ nombre: quotePickQ.trim(), unidad: "und", cant: 1, precio: 0 });
      quotePickQ = ""; saveQuoteDraft(); renderQuoteEditor();
      const k = quoteEdit.items.length - 1; const input = $("#ql-precio-" + k); if (input) { input.focus(); input.select(); }
      return;
    }
    if (t.dataset.qrm) { quoteEdit.items.splice(+t.dataset.qrm, 1); saveQuoteDraft(); return renderQuoteEditor(); }
    if (t.id === "q-cancel") { quoteEdit = null; quotePickQ = ""; saveQuoteDraft(); return renderCotizaciones(); }
    if (t.id === "q-save") return saveQuote(t);
    return;
  }
  if (!sel) return;
  if (t.id === "q-print") return printA4(quoteNum(sel.numero) + " " + (sel.cliente || "cotizacion"), quoteDocHtml(sel), t);
  if (t.id === "q-wa") return sendQuotePdf(sel, t);
  if (t.id === "q-edit") {
    if (!exigir("cotizacion.editar", "editar cotizaciones")) return;
    quoteEdit = { ...structuredClone(sel), descuento: sel.descuento || "" }; quotePickQ = ""; saveQuoteDraft(); return renderCotizaciones();
  }
  if (t.id === "q-copy") {
    if (!exigir("cotizacion.crear", "crear cotizaciones")) return;
    quoteEdit = { ...blankQuote(), cliente: sel.cliente || "", doc: sel.doc || "", telefono: sel.telefono || "", direccion: sel.direccion || "", validez: sel.validez || 15, descuento: sel.descuento || "", obs: sel.obs || "", items: structuredClone(sel.items || []) };
    quotePickQ = ""; saveQuoteDraft(); toast("Copia lista para editar"); return renderCotizaciones();
  }
  if (t.id === "q-sell") {
    if (!exigir("venta.crear", "crear ventas")) return;
    if (draft.items.length && !t.classList.contains("armed")) { t.classList.add("armed"); t.textContent = "Reemplazar la venta en curso"; return; }
    const items = (sel.items || []).map(i => ({ ...i }));
    // el descuento de la cotización pasa a la venta como una línea negativa que no toca el stock
    if (n2(sel.descuento)) items.push({ nombre: "Descuento " + quoteNum(sel.numero), unidad: "", cant: 1, precio: -n2(sel.descuento) });
    draft = { cliente: sel.cliente || "", doc: sel.doc || "", obs: "Según cotización " + quoteNum(sel.numero), items, cotizacionId: sel.id };
    saveDraft(); toast("Cotización cargada en Nueva venta. Revisa y emite la nota.");
    return go("venta");
  }
  if (t.id === "q-del") {
    if (!exigir("cotizacion.eliminar", "eliminar cotizaciones")) return;
    if (!t.classList.contains("armed")) { t.classList.add("armed"); t.textContent = "Confirmar eliminación"; return; }
    try { await deleteQuote(sel.id); selQuote = null; toast("Cotización eliminada"); } catch (err) { toast(failMsg(err)); }
  }
});
$("#v-cotizaciones").addEventListener("input", e => {
  const t = e.target;
  if (t.id === "quoteSearch") { quoteQ = t.value; return renderCotizaciones(); }
  if (!quoteEdit) return;
  const fields = { "q-cliente": "cliente", "q-doc": "doc", "q-tel": "telefono", "q-dir": "direccion", "q-obs": "obs", "q-validez": "validez", "q-desc": "descuento" };
  if (t.id === "q-pick") quotePickQ = t.value;
  else if (fields[t.id]) quoteEdit[fields[t.id]] = t.value;
  else if (t.dataset.qcant) quoteEdit.items[+t.dataset.qcant].cant = t.value === "" ? "" : n2(t.value);
  else if (t.dataset.qprecio) quoteEdit.items[+t.dataset.qprecio].precio = t.value === "" ? "" : n2(t.value);
  else return;
  saveQuoteDraft(); renderQuoteEditor();
});
$("#v-cotizaciones").addEventListener("keydown", e => {
  if (e.target.id === "q-pick" && e.key === "Enter") {
    e.preventDefault();
    const t = quotePickQ.trim();
    if (buscarCodigo(t)) { const m = cotizacionCodigo(t); if (m.startsWith("Elige")) toast(m); return; }
    if (pareceCodigo(t) && !productMatches(t).some(x => x.s >= 1)) {
      quotePickQ = ""; renderQuoteEditor();
      return toast("No hay ningún producto con el código " + t);
    }
    const b = $("#v-cotizaciones [data-addline]") || $("#v-cotizaciones [data-quickadd]");
    if (b) b.click();
  }
});

