// ---------- ticket ----------
// Monto en letras como en las boletas: 120.5 → "CIENTO VEINTE CON 50/100 SOLES".
function numeroALetras(value, moneda = "S/") {
  const n = Math.round(Math.abs(n2(value)) * 100) / 100;
  const ent = Math.floor(n), cents = Math.round((n - ent) * 100);
  const u = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
  const d10 = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"];
  const d20 = ["veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
  const dec = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
  const cen = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];
  const under = x => {
    if (!x) return "";
    if (x === 100) return "cien";
    if (x < 10) return u[x];
    if (x < 20) return d10[x - 10];
    if (x < 30) return d20[x - 20];
    if (x < 100) return dec[Math.floor(x / 10)] + (x % 10 ? " y " + u[x % 10] : "");
    return cen[Math.floor(x / 100)] + (x % 100 ? " " + under(x % 100) : "");
  };
  // Delante de "mil" y "millones": "veintiún mil", "ciento un mil"
  const apocope = x => under(x).replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");
  const miles = x => x === 0 ? "" : x === 1 ? "mil" : apocope(x) + " mil";
  const millones = Math.floor(ent / 1000000), resto = ent % 1000000;
  const words = [
    millones === 1 ? "un millón" : millones ? apocope(millones) + " millones" : "",
    miles(Math.floor(resto / 1000)),
    under(resto % 1000)
  ].filter(Boolean).join(" ") || "cero";
  const nombreMoneda = moneda === "S/" ? "SOLES" : moneda;
  return `${words.toUpperCase()} CON ${String(cents).padStart(2, "0")}/100 ${nombreMoneda}`.trim();
}
// settings permite mostrar la vista previa de Configuración sin guardar.
function ticketHtml(n, preview, settings = S.settings) {
  const items = n.items || [];
  const s = settings || {};
  const narrow = s.papel === "58";
  const address = [s.direccion, s.ciudad].filter(Boolean).map(esc).join(" · ");
  const social = [
    s.facebook && "Facebook: " + esc(s.facebook),
    s.instagram && "Instagram: " + esc(s.instagram),
    s.tiktok && "TikTok: " + esc(s.tiktok),
    s.web && "Tienda virtual: " + esc(s.web)
  ].filter(Boolean);
  const importe = i => money(n2(i.cant) * n2(i.precio));
  const rows = items.map(i => narrow
    ? `<div class="product-row narrow-row"><span class="desc">${esc(i.nombre)}</span><span class="small-detail">${qty(i.cant)} × ${money(i.precio)} = ${importe(i)}</span></div>`
    : `<div class="product-row"><span>${qty(i.cant)}</span><span class="desc">${esc(i.nombre)}</span><span>${money(i.precio)}</span><span>${importe(i)}</span></div>`).join("");
  return `<div class="ticket ${narrow ? "paper58" : "paper80"}" aria-label="Vista de la nota">
    ${n.estado === "anulada" ? `<div class="void">ANULADA</div>` : ""}
    ${/^data:image\//.test(s.logo || "") ? `<div class="c logo"><img src="${esc(s.logo)}" alt=""></div>` : ""}
    <div class="c biz">${esc(s.negocio || "Mi negocio")}</div>
    ${s.razonSocial ? `<div class="c wrap">${esc(s.razonSocial)}</div>` : ""}
    ${s.ruc ? `<div class="c">RUC: ${esc(s.ruc)}</div>` : ""}
    ${address ? `<div class="c wrap">${address}</div>` : ""}
    ${s.telefono ? `<div class="c">Tel./WhatsApp: ${esc(s.telefono)}</div>` : ""}
    ${s.correo ? `<div class="c wrap">${esc(s.correo)}</div>` : ""}
    <div class="receipt-box c"><b>NOTA DE VENTA</b><br><b>${folioTxt(n.folio)}</b>${preview ? " (borrador)" : ""}</div>
    <div>Fecha y hora: ${esc(fmtDate(n.fecha))}</div>
    <div>Cliente: ${esc(n.cliente || "Público en general")}</div>
    ${n.doc ? `<div>Doc.: ${esc(n.doc)}</div>` : ""}
    ${n.vendedorNombre ? `<div>Atendió: ${esc(n.vendedorNombre)}</div>` : ""}
    <hr>
    ${narrow
      ? `<div class="product-head narrow-row"><span>DESCRIPCIÓN</span><span class="small-detail">CANT × P.UNIT = IMPORTE</span></div>`
      : `<div class="product-head"><span>CANT</span><span>DESCRIPCIÓN</span><span>P.UNIT</span><span>IMPORTE</span></div>`}
    ${rows || `<div class="c" style="opacity:.6">Sin productos todavía</div>`}
    <div class="tr" style="margin-top:4px"><span>Artículos</span><span>${qty(items.reduce((a, i) => a + itemUnits(i), 0))}</span></div>
    <div class="tr tot"><span>TOTAL</span><span>${money(n.total)}</span></div>
    ${s.montoEnLetras !== false ? `<div class="amount-words">SON: ${esc(numeroALetras(n.total, s.moneda || "S/"))}</div>` : ""}
    ${n.pago ? `<div class="tr"><span>Medio de pago</span><span>${esc(n.pago)}</span></div>` : ""}
    ${n.obs ? `<hr><div class="wrap">Obs.: ${esc(n.obs)}</div>` : ""}
    ${s.mostrarRedes !== false && social.length ? `<hr><div class="c"><b>Síguenos</b></div>${social.map(x => `<div class="c wrap">${x}</div>`).join("")}` : ""}
    <hr><div class="c">${esc(s.mensajeFinal || "Gracias por su compra")}</div>
    <div class="c disclaimer">Este documento no es un comprobante de pago</div>
  </div>`;
}
function ticketText(n) {
  const W = 36, pad = (l, r) => { l = String(l); r = String(r); const sp = W - l.length - r.length; return sp >= 1 ? l + " ".repeat(sp) + r : l + "\n" + " ".repeat(Math.max(0, W - r.length)) + r; };
  const ctr = s => { s = String(s); const p = Math.max(0, Math.floor((W - s.length) / 2)); return " ".repeat(p) + s; };
  const hr = "-".repeat(W);
  const s = S.settings || {};
  const L = [ctr((s.negocio || "Mi negocio").toUpperCase())];
  if (s.razonSocial) L.push(ctr(s.razonSocial));
  if (s.ruc) L.push(ctr("RUC: " + s.ruc));
  if (s.direccion) L.push(ctr(s.direccion));
  if (s.ciudad) L.push(ctr(s.ciudad));
  if (s.telefono) L.push(ctr("Tel./WhatsApp: " + s.telefono));
  if (s.correo) L.push(ctr(s.correo));
  L.push(hr, ctr("NOTA DE VENTA"), ctr(folioTxt(n.folio)), hr,
    "Fecha y hora: " + fmtDate(n.fecha), "Cliente: " + (n.cliente || "Público en general"));
  if (n.doc) L.push("Doc.: " + n.doc);
  if (n.vendedorNombre) L.push("Atendió: " + n.vendedorNombre);
  L.push(hr, pad("DESCRIPCIÓN", "IMPORTE"), hr);
  (n.items || []).forEach(i => {
    L.push(i.nombre);
    L.push(pad("  " + qty(i.cant) + " x " + money(i.precio), money(n2(i.cant) * n2(i.precio))));
  });
  L.push(hr, pad("TOTAL", money(n.total)));
  if (s.montoEnLetras !== false) L.push("SON: " + numeroALetras(n.total, s.moneda || "S/"));
  if (n.pago) L.push(pad("Medio de pago", n.pago));
  if (n.obs) L.push(hr, "Obs.: " + n.obs);
  if (n.estado === "anulada") L.push(hr, ctr("*** NOTA ANULADA ***"));
  const social = [
    s.facebook && "Facebook: " + s.facebook,
    s.instagram && "Instagram: " + s.instagram,
    s.tiktok && "TikTok: " + s.tiktok,
    s.web && "Tienda virtual: " + s.web
  ].filter(Boolean);
  if (s.mostrarRedes !== false && social.length) L.push(hr, ctr("Síguenos"), ...social);
  L.push(hr, ctr(s.mensajeFinal || "Gracias por su compra"), ctr("No es comprobante de pago"));
  return L.join("\n");
}
// Archivo independiente para la ticketera: al abrirlo se lanza el diálogo de impresión.
function printHtml(n, autoPrint = true, cuerpo = "") {
  const w = S.settings.papel === "58" ? 58 : 80;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${n ? esc(folioTxt(n.folio)) : "Cierre de caja"}</title>
<style>
@page{size:${w}mm auto;margin:0}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#000;font-family:"Courier New",Consolas,monospace;font-size:${w === 58 ? 10.5 : 12}px;line-height:1.35}
.ticket{width:${w}mm;padding:3mm ${w === 58 ? 2 : 3}mm 6mm;position:relative}
.c{text-align:center}.biz{font-weight:700;font-size:1.25em;text-transform:uppercase}
.wrap,.desc,.amount-words{overflow-wrap:anywhere;word-break:break-word}
.receipt-box{border:1px solid #000;padding:1.5mm;margin:2mm 0}
.product-head,.product-row{display:grid;grid-template-columns:3.2em minmax(0,1fr) auto auto;gap:1mm;border-bottom:1px dotted #000;padding:1mm 0}
.product-head{font-weight:700}
.product-row>span:not(.desc){text-align:right;white-space:nowrap}
.narrow-row{display:block}
.small-detail{display:block;text-align:right}
.amount-words{font-size:.9em;margin-top:1mm}
.disclaimer{font-size:.8em;margin-top:2mm}
.logo img{display:block;margin:0 auto 2mm;max-width:75%;max-height:24mm;filter:grayscale(1)}
hr{border:0;border-top:1px dashed #000;margin:2mm 0}
.tr{display:flex;justify-content:space-between;gap:2mm}.tr span:first-child{min-width:0;overflow-wrap:anywhere}
.tot{font-weight:700;font-size:1.3em}
.void{border:2px solid #000;text-align:center;font-weight:700;letter-spacing:.1em;margin-bottom:2mm}
.hint{font-family:system-ui,sans-serif;font-size:14px;max-width:420px;margin:16px auto;padding:0 16px;color:#333}
.hint button{font:inherit;font-weight:600;padding:8px 14px;cursor:pointer}
@media screen{body{background:#e9ecea}.ticket{background:#fff;margin:16px auto;box-shadow:0 2px 10px rgb(0 0 0 / .15)}}
@media print{.hint{display:none}}
</style></head><body>
<div class="hint"><p>Si no se abrió la ventana de impresión, presiona <b>Ctrl + P</b> o el botón. Elige tu ticketera, papel de ${w} mm y márgenes <b>Ninguno</b>.</p><button onclick="print()">Imprimir</button></div>
${cuerpo || ticketHtml(n)}
${autoPrint ? '<script>addEventListener("load",function(){setTimeout(function(){print()},300)})<\/script>' : ""}
</body></html>`;
}
function canPrintLocally() { return !db || fbMode; }
// Bloquea dobles clics mientras se prepara la impresión, pero nunca para siempre:
// el bloqueo se libera al volver de print() o, como respaldo, a los 15 s.
let printingFrame = null, printingSince = 0;
function printLocal(n, button) {
  printFrame(printHtml(n, false), (S.settings.papel === "58" ? 58 : 80) + "mm", button);
}
// Imprime un documento completo (ticket o A4) desde un iframe oculto del ancho del papel.
function printFrame(html, width, button) {
  if (printingFrame && Date.now() - printingSince < 15000) return;
  // Un iframe de una impresión anterior que no avisó afterprint se quita al empezar otra.
  document.querySelectorAll("iframe[data-ticket-print]").forEach(f => f.remove());
  const frame = document.createElement("iframe");
  frame.dataset.ticketPrint = "1";
  printingFrame = frame; printingSince = Date.now();
  if (button) button.disabled = true;
  frame.title = "Impresión";
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${width};height:1000px;border:0;visibility:visible`;
  let started = false;
  const unlock = () => {
    if (printingFrame === frame) printingFrame = null;
    if (button) button.disabled = false;
  };
  const finish = () => { frame.remove(); unlock(); };
  frame.onload = () => {
    if (started || !frame.contentDocument || !frame.contentDocument.querySelector(".ticket,.a4,.hoja")) return;
    started = true;
    const win = frame.contentWindow, doc = frame.contentDocument;
    win.addEventListener("afterprint", finish, { once: true });
    Promise.resolve(doc.fonts && doc.fonts.ready).then(() => new Promise(resolve => {
      if (win.requestAnimationFrame) win.requestAnimationFrame(() => setTimeout(resolve, 50));
      else setTimeout(resolve, 100);
    })).then(() => {
      if (printingFrame !== frame) return;
      win.focus();
      win.print();
      // Chrome y Edge vuelven de print() al cerrar la vista previa; el iframe se queda hasta afterprint.
      setTimeout(unlock, 500);
    }).catch(finish);
  };
  frame.onerror = finish;
  frame.srcdoc = html;
  document.body.append(frame);
}

