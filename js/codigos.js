// ---------- códigos de barras ----------
// Crear: los códigos nuevos son EAN-13 de uso interno (empiezan con 20) y sirven solo en esta tienda.
// Dibujar: 13 dígitos válidos van como EAN-13; cualquier otro código sin tildes ni ñ, como Code 128.
const CODE128 = "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232".split(" ");
const EAN_L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const EAN_PARIDAD = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];
function eanDigito(cuerpo) {
  const suma = [...cuerpo].reduce((a, d, i) => a + Number(d) * (i % 2 ? 3 : 1), 0);
  return String((10 - suma % 10) % 10);
}
const esEan13 = c => /^\d{13}$/.test(c) && eanDigito(c.slice(0, 12)) === c[12];
function ean13Modulos(c) {
  const inv = bits => [...bits].map(b => b === "1" ? "0" : "1").join("");
  const paridad = EAN_PARIDAD[Number(c[0])];
  const izq = [...c.slice(1, 7)].map((d, i) => {
    const l = EAN_L[Number(d)];
    return paridad[i] === "L" ? l : [...inv(l)].reverse().join("");
  }).join("");
  const der = [...c.slice(7)].map(d => inv(EAN_L[Number(d)])).join("");
  return "101" + izq + "01010" + der + "101";
}
function code128Modulos(c) {
  if (!/^[\x20-\x7e]+$/.test(c)) return null;
  // solo dígitos en cantidad par: el juego C los comprime y la barra sale más corta
  const pares = /^\d+$/.test(c) && c.length % 2 === 0;
  const valores = pares ? [105, ...c.match(/\d\d/g).map(Number)] : [104, ...[...c].map(ch => ch.charCodeAt(0) - 32)];
  const control = valores.reduce((a, v, i) => a + v * (i || 1), 0) % 103;
  const anchos = [...valores, control].map(v => CODE128[v]).join("") + "2331112";
  return [...anchos].map((w, i) => (i % 2 ? "0" : "1").repeat(Number(w))).join("");
}
const barraModulos = c => esEan13(c) ? ean13Modulos(c) : code128Modulos(c);
// mod = ancho de la barra más fina en mm; se deja el margen blanco que el lector necesita a cada lado
function barraSvg(codigo, mod = 0.33, alto = 12) {
  const bits = barraModulos(String(codigo || "").trim());
  if (!bits) return "";
  const margen = 11, ancho = bits.length + margen * 2;
  const trazos = [...bits.matchAll(/1+/g)].map(m => `M${m.index + margen} 0h${m[0].length}v1h-${m[0].length}z`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} 1" preserveAspectRatio="none" shape-rendering="crispEdges" width="${(ancho * mod).toFixed(2)}mm" height="${alto}mm" role="img" aria-label="Código de barras ${esc(codigo)}"><rect width="${ancho}" height="1" fill="#fff"/><path d="${trazos}" fill="#000"/></svg>`;
}
// barra más fina que entra en el ancho: 0.375 y 0.25 mm calzan con los puntos de una ticketera de 203 dpi
function barraMod(codigo, disponible) {
  const bits = barraModulos(codigo), ancho = (bits ? bits.length : 0) + 22;
  return ancho * 0.375 <= disponible ? 0.375 : ancho * 0.25 <= disponible ? 0.25 : disponible / ancho;
}
// el lector puede entregar un UPC con un cero de más; por eso los ceros iniciales no cuentan al comparar
const codigoClave = c => {
  const t = String(c || "").trim().toUpperCase();
  return /^\d+$/.test(t) ? t.replace(/^0+(?=\d)/, "") : t;
};
function buscarCodigo(codigo) {
  const k = codigoClave(codigo);
  if (!k) return null;
  for (const p of S.products) {
    const v = (p.variantes || []).find(x => codigoClave(x.codigo) === k);
    if (v) return { p, v };
  }
  const p = S.products.find(x => codigoClave(x.codigo) === k);
  if (!p) return null;
  return { p, v: p.variantes && p.variantes.length === 1 ? p.variantes[0] : undefined };
}
const pareceCodigo = t => /^[0-9A-Za-z-]{6,}$/.test(String(t).trim()) && /\d/.test(t);
const codigosUsados = () => new Set(S.products.flatMap(p => [p.codigo, ...(p.variantes || []).map(v => v.codigo)]).filter(Boolean).map(codigoClave));
function nuevoCodigoBarras(usados) {
  for (;;) {
    const cuerpo = "20" + [...crypto.getRandomValues(new Uint8Array(10))].map(b => b % 10).join("");
    const c = cuerpo + eanDigito(cuerpo);
    if (!usados.has(codigoClave(c))) { usados.add(codigoClave(c)); return c; }
  }
}
// devuelve el problema al guardar: un mismo código en dos productos no se podría leer sin dudas
function conflictoCodigo(p, antes) {
  const propios = new Set(antes ? [antes.codigo, ...(antes.variantes || []).map(v => v.codigo)].filter(Boolean).map(codigoClave) : []);
  const codigos = [p.codigo, ...(p.variantes || []).map(v => v.codigo)].filter(Boolean);
  const vistos = new Set();
  for (const c of codigos) {
    const k = codigoClave(c), repetido = vistos.has(k);
    vistos.add(k);
    if (repetido && !propios.has(k)) return `El código ${c} está repetido en este producto.`;
    if (propios.has(k)) continue;
    const otro = S.products.find(x => x.id !== p.id && [x.codigo, ...(x.variantes || []).map(v => v.codigo)].some(y => y && codigoClave(y) === k));
    if (otro) return `El código ${c} ya lo usa «${otro.nombre}».`;
  }
  return "";
}

// --- leer con la cámara ---
// Chrome en Android trae el lector; iPhone y computadoras cargan esta librería la primera vez (después queda guardada).
const LECTOR_LIB = "https://cdn.jsdelivr.net/npm/barcode-detector@3.2.3/dist/es/ponyfill.js";
const LECTOR_FORMATOS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "code_93", "codabar", "itf"];
let lector = null, scanStream = null, scanTimer = 0, scanTurno = 0;
async function crearLector() {
  if (lector) return lector;
  if ("BarcodeDetector" in window) {
    try {
      const soporta = await BarcodeDetector.getSupportedFormats();
      const formatos = LECTOR_FORMATOS.filter(f => soporta.includes(f));
      if (formatos.includes("ean_13") && formatos.includes("code_128")) return (lector = new BarcodeDetector({ formats: formatos }));
    } catch {}
  }
  const m = await import(LECTOR_LIB);
  return (lector = new m.BarcodeDetector({ formats: LECTOR_FORMATOS }));
}
function scanAviso() {
  try {
    if (navigator.vibrate) navigator.vibrate(60);
    const ctx = new (window.AudioContext || window.webkitAudioContext)(), o = ctx.createOscillator(), g = ctx.createGain();
    g.gain.value = 0.08;
    o.frequency.value = 1500;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.08);
    o.onended = () => ctx.close();
  } catch {}
}
function scanError(err) {
  if (!navigator.mediaDevices) return "Aquí no se puede usar la cámara. Abre Mostrador desde su enlace web o usa un lector USB.";
  const n = err && err.name;
  if (n === "NotAllowedError" || n === "SecurityError") return "Falta el permiso de la cámara. Actívalo en los permisos del navegador y vuelve a intentar.";
  if (n === "NotFoundError" || n === "OverconstrainedError") return "No encontramos una cámara en este equipo. Puedes usar un lector USB.";
  if (n === "NotReadableError") return "Otra aplicación está usando la cámara. Ciérrala y vuelve a intentar.";
  return "No se pudo abrir la cámara. Vuelve a intentar.";
}
// onCodigo recibe lo leído y devuelve el mensaje a mostrar, o false para cerrar la cámara
async function abrirEscaner(onCodigo, inicio = "Apunta la cámara al código de barras.") {
  const dialogo = $("#scanDlg"), video = $("#scanVideo"), msg = $("#scanMsg");
  const turno = ++scanTurno;
  msg.textContent = "Abriendo la cámara…";
  dialogo.showModal();
  try {
    if (!navigator.mediaDevices) throw new Error("sin cámara");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
    if (turno !== scanTurno) { stream.getTracks().forEach(t => t.stop()); return; }
    scanStream = stream;
    video.srcObject = stream;
    await video.play();
  } catch (err) {
    if (turno === scanTurno) msg.textContent = scanError(err);
    return;
  }
  let detector;
  try { detector = await crearLector(); }
  catch {
    if (turno === scanTurno) msg.textContent = "No se pudo preparar el lector de la cámara. La primera vez necesita internet; revisa la conexión y vuelve a intentar.";
    return;
  }
  if (turno !== scanTurno) return;
  msg.textContent = inicio;
  let anterior = "", ultimo = "", ultimoVisto = 0;
  const leer = async () => {
    if (turno !== scanTurno) return;
    let codigo = "";
    try {
      if (video.readyState >= 2) {
        const r = await detector.detect(video);
        codigo = (r[0] && r[0].rawValue || "").trim();
      }
    } catch {}
    if (turno !== scanTurno) return;
    const ahora = Date.now();
    // dos lecturas iguales seguidas evitan lecturas falsas; el mismo código vale otra vez solo si salió de la cámara
    if (ultimo && codigo !== ultimo && ahora - ultimoVisto > 1500) ultimo = "";
    if (codigo && codigo === ultimo) ultimoVisto = ahora;
    if (codigo && codigo === anterior && codigo !== ultimo) {
      ultimo = codigo;
      ultimoVisto = ahora;
      scanAviso();
      const r = onCodigo(codigo);
      if (r === false) { dialogo.close(); return; }
      msg.textContent = r;
    }
    anterior = codigo;
    scanTimer = setTimeout(leer, 120);
  };
  leer();
}
$("#scanDlg").addEventListener("close", () => {
  scanTurno++;
  clearTimeout(scanTimer);
  if (scanStream) scanStream.getTracks().forEach(t => t.stop());
  scanStream = null;
  $("#scanVideo").srcObject = null;
});
$("#scanClose").addEventListener("click", () => $("#scanDlg").close());

// --- qué hacer con un código leído ---
function ventaCodigo(codigo) {
  const hit = buscarCodigo(codigo);
  if (!hit) return "No hay ningún producto con el código " + codigo;
  if (hit.p.variantes && hit.p.variantes.length && !hit.v) {
    pickQ = codigo;
    renderVenta();
    return "Elige la talla y el color de " + hit.p.nombre + " en la lista.";
  }
  addLine(hit.p, hit.v);
  return "Agregado: " + hit.p.nombre + (hit.v ? " – " + [hit.v.talla, hit.v.color].filter(Boolean).join(" / ") : "");
}
function cotizacionCodigo(codigo) {
  const hit = buscarCodigo(codigo);
  if (!hit) return "No hay ningún producto con el código " + codigo;
  quotePickQ = codigo;
  renderQuoteEditor();
  if (hit.p.variantes && hit.p.variantes.length && !hit.v) return "Elige la talla y el color de " + hit.p.nombre + " en la lista.";
  const b = [...document.querySelectorAll("#v-cotizaciones [data-addline]")].find(x => x.dataset.addline === hit.p.id && (!hit.v || x.dataset.variant === hit.v.id));
  if (b) b.click();
  return "Agregado: " + hit.p.nombre + (hit.v ? " – " + [hit.v.talla, hit.v.color].filter(Boolean).join(" / ") : "");
}
// devuelve el mensaje; si el código no existe y se puede crear, abre el producto nuevo con ese código
function inventarioCodigo(codigo) {
  if (buscarCodigo(codigo)) {
    S.q = codigo;
    renderInventario();
    return "";
  }
  S.q = "";
  renderInventario();
  if (!puede("producto.crear")) return "No hay ningún producto con el código " + codigo;
  openProduct(null);
  $("#p-codigo").value = codigo;
  codigoVista();
  $("#p-nombre").focus();
  return "Ese código es nuevo: completa los datos del producto.";
}
// lector USB o Bluetooth con el cursor fuera de un campo: escribe muy rápido y termina con Enter
let cunaTexto = "", cunaHora = 0;
document.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey || !usuarioActual() || document.querySelector("dialog[open]")) return;
  const a = document.activeElement;
  if (a && a.matches("input,textarea,select,[contenteditable]")) return;
  if (S.view !== "venta" && S.view !== "inventario" && !(S.view === "cotizaciones" && quoteEdit)) return;
  const ahora = Date.now();
  if (e.key === "Enter") {
    const codigo = cunaTexto;
    cunaTexto = "";
    if (codigo.length < 4 || ahora - cunaHora > 100) return;
    e.preventDefault();
    const m = S.view === "venta" ? ventaCodigo(codigo) : S.view === "inventario" ? inventarioCodigo(codigo) : cotizacionCodigo(codigo);
    if (m) toast(m);
  } else if (e.key.length === 1) {
    if (ahora - cunaHora > 100) cunaTexto = "";
    cunaTexto += e.key;
    cunaHora = ahora;
  }
});

// --- código en el editor de producto ---
function codigoVista() {
  const caja = $("#p-cod-vista"), c = $("#p-codigo").value.trim();
  caja.hidden = !c;
  if (!c) { caja.innerHTML = ""; return; }
  const svg = barraSvg(c, barraMod(c, 70), 14);
  caja.innerHTML = svg ? svg + `<span class="num">${esc(c)}</span>` : `<span class="warnline">Este código tiene tildes o ñ y no se puede imprimir como barras.</span>`;
}
function codigosFormulario() {
  return [$("#p-codigo").value, ...[...$("#p-variants").querySelectorAll('[data-vfield="codigo"]')].map(i => i.value)].map(codigoClave).filter(Boolean);
}
$("#p-codigo").addEventListener("input", codigoVista);
$("#p-cod-crear").addEventListener("click", () => {
  const actual = $("#p-codigo").value.trim();
  if (actual && !confirm("Este producto ya tiene el código " + actual + ". ¿Reemplazarlo por uno nuevo?")) return;
  $("#p-codigo").value = nuevoCodigoBarras(new Set([...codigosUsados(), ...codigosFormulario()]));
  codigoVista();
});
$("#p-cod-scan").addEventListener("click", () => abrirEscaner(codigo => {
  $("#p-codigo").value = codigo;
  codigoVista();
  return false;
}));
$("#p-var-crear").addEventListener("click", () => {
  const usados = new Set([...codigosUsados(), ...codigosFormulario()]);
  const vacios = [...$("#p-variants").querySelectorAll('[data-vfield="codigo"]')].filter(i => !i.value.trim());
  if (!vacios.length) return toast("Todas las combinaciones ya tienen código");
  vacios.forEach(i => { i.value = nuevoCodigoBarras(usados); });
  toast(vacios.length === 1 ? "Código creado" : vacios.length + " códigos creados");
});
// lee los códigos de fábrica uno por uno y avisa qué combinación toca
$("#p-var-scan").addEventListener("click", () => {
  const nombre = fila => [rowVal(fila, "talla"), rowVal(fila, "color")].filter(Boolean).join(" / ") || "esta combinación";
  const faltan = () => [...$("#p-variants").querySelectorAll("[data-variant-row]")].filter(f => !f.querySelector('[data-vfield="codigo"]').value.trim());
  if (!faltan().length) return toast("Todas las combinaciones ya tienen código");
  abrirEscaner(codigo => {
    const fila = faltan()[0];
    if (!fila) return false;
    if (codigosFormulario().includes(codigoClave(codigo))) return "Ese código ya está en otra combinación. Escanea: " + nombre(fila);
    fila.querySelector('[data-vfield="codigo"]').value = codigo;
    const sigue = faltan()[0];
    return sigue ? "Listo. Ahora escanea: " + nombre(sigue) : false;
  }, "Escanea: " + nombre(faltan()[0]));
});
// un lector USB termina con Enter: aquí no debe guardar el producto
$("#pform").addEventListener("keydown", e => {
  if (e.key === "Enter" && (e.target.id === "p-codigo" || e.target.dataset.vfield === "codigo")) e.preventDefault();
});

// --- etiquetas ---
const ETQ_TAMANOS = {
  a4: { titulo: "Hoja A4 (3 columnas)", ancho: 63.5 },
  e50x2: { titulo: "Rollo de 2 columnas 50 × 25 mm (2\" × 1\")", ancho: 50 },
  e50: { titulo: "Rollo de 1 columna 50 × 25 mm", ancho: 50 },
  ticket: { titulo: "Ticketera", ancho: 0 },
};
// rollo de 2 columnas de 50 × 25 mm (2" × 1"): 2 mm entre etiquetas, como la mayoría de esos rollos
const ETQ_ROLLO2 = { separacion: 2, anchoPagina: 102 };
const ETQ_FILAS = 100;
const etq = { q: "", cant: new Map(), tam: "a4", precio: true, solo: null }; // solo: id del producto si se abrió desde su detalle
const etqClave = (p, v) => p.id + ":" + (v ? v.id : "");
const etqTodas = () => S.products.flatMap(p => p.variantes && p.variantes.length ? p.variantes.map(v => ({ p, v })) : [{ p, v: null }]);
const etqNombre = f => f.p.nombre + (f.v ? " – " + [f.v.talla, f.v.color].filter(Boolean).join(" / ") : "");
const etqCodigo = f => f.v ? f.v.codigo || "" : f.p.codigo || "";
function etqVisibles() {
  const q = norm(etq.q);
  return etqTodas().filter(f => !etq.solo || f.p.id === etq.solo).filter(f => !q || norm(etqNombre(f) + " " + (f.p.categoria || "") + " " + etqCodigo(f)).includes(q))
    .sort(etqOrden);
}
// por producto y, dentro de cada uno, por color y talla (XS, S, M…), igual que el cuadro de tallas
const etqOrden = (a, b) => a.p.nombre.localeCompare(b.p.nombre, "es") || a.p.id.localeCompare(b.p.id)
  || byColor((a.v && a.v.color) || "", (b.v && b.v.color) || "") || byTalla((a.v && a.v.talla) || "", (b.v && b.v.talla) || "");
function etqTotal() {
  const n = [...etq.cant.values()].reduce((a, x) => a + x, 0);
  $("#etqTotal").textContent = n === 1 ? "1 etiqueta" : n + " etiquetas";
  $("#etqPrint").disabled = !n;
}
function etqLista() {
  const filas = etqVisibles();
  $("#etqFilas").innerHTML = filas.slice(0, ETQ_FILAS).map(f => {
    const k = etqClave(f.p, f.v), c = etqCodigo(f);
    return `<div class="etq-fila"><div><b>${esc(etqNombre(f))}</b><small class="${c ? "num" : "muted"}">${c ? esc(c) : "Sin código: se crea al imprimir"}</small></div>
      <input type="number" min="0" step="1" inputmode="numeric" data-etq="${esc(k)}" value="${etq.cant.get(k) || 0}" aria-label="Etiquetas de ${esc(etqNombre(f))}"></div>`;
  }).join("") + (filas.length > ETQ_FILAS ? `<p class="muted">Se muestran ${ETQ_FILAS} de ${filas.length}. Busca para ver los demás; «Una de cada» y «Según el stock» cuentan a todos.</p>` : "") || `<p class="muted">Ningún producto coincide con la búsqueda.</p>`;
  etqTotal();
}
function etqSoloHtml() {
  const p = etq.solo && S.products.find(x => x.id === etq.solo), box = $("#etqSolo");
  box.hidden = !p;
  box.innerHTML = p ? `<span>Solo <b>${esc(p.nombre)}</b>: una etiqueta por cada prenda en stock. Cambia los números si quieres otra cantidad.</span><button type="button" class="btn ghost" data-etq-ver-todos>Ver todos los productos</button>` : "";
}
// productoId: abre solo ese producto, con una etiqueta por cada prenda que hay en stock
function abrirEtiquetas(productoId = null) {
  if (!exigir("producto.editar", "crear etiquetas")) return;
  const guardado = store.get("mostrador.etiquetas") || {};
  etq.q = "";
  etq.cant = new Map();
  etq.solo = productoId && S.products.some(p => p.id === productoId) ? productoId : null;
  if (etq.solo) etqVisibles().forEach(f => {
    const n = Math.max(0, Math.floor(n2(f.v ? f.v.stock : f.p.stock)));
    if (n) etq.cant.set(etqClave(f.p, f.v), n);
  });
  etqSoloHtml();
  etq.tam = ETQ_TAMANOS[guardado.tam] ? guardado.tam : "a4";
  etq.precio = guardado.precio !== false;
  $("#etqQ").value = "";
  $("#etqTam").innerHTML = Object.entries(ETQ_TAMANOS).map(([k, t]) => `<option value="${k}">${esc(k === "ticket" ? t.titulo + " de " + (S.settings.papel === "58" ? 58 : 80) + " mm" : t.titulo)}</option>`).join("");
  $("#etqTam").value = etq.tam;
  $("#etqPrecio").checked = etq.precio;
  $("#etqMsg").hidden = true;
  etqLista();
  $("#labelDlg").showModal();
}
function etiquetasHtml(lista, tam, conPrecio, autoPrint) {
  const rollo = S.settings.papel === "58" ? 58 : 80;
  const ancho = tam === "ticket" ? rollo : ETQ_TAMANOS[tam].ancho, util = ancho - 3;
  const rollo50 = tam === "e50" || tam === "e50x2";
  const alto = rollo50 ? 8.5 : 13;
  // la talla y el color van en su propia línea, en negrita: aunque el nombre largo se corte, siempre se leen
  const etiqueta = f => {
    const c = etqCodigo(f), precio = n2(f.v && f.v.precio != null ? f.v.precio : f.p.precio);
    const variante = f.v ? [f.v.talla, f.v.color].filter(Boolean).join(" · ") : "";
    return `<div class="e"><div class="n">${esc(f.p.nombre)}</div>${variante ? `<div class="v">${esc(variante)}</div>` : ""}${barraSvg(c, barraMod(c, util), alto)}<div class="c">${esc(c)}</div>${conPrecio ? `<div class="p">${esc(money(precio))}</div>` : ""}</div>`;
  };
  const pagina = {
    a4: `@page{size:A4;margin:10mm 7mm}.hoja-a4{display:grid;grid-template-columns:repeat(3,63.5mm);grid-auto-rows:38.1mm;gap:0 2.5mm}`,
    // una etiqueta por página del rollo. Un poco más baja que la página: si el navegador redondea hacia arriba,
    // no pasa a una segunda página (eso dejaría una etiqueta en blanco entre cada una). La última no fuerza salto.
    e50: `@page{size:50mm 25mm;margin:0}html,body{width:50mm}.e{height:24.5mm;break-after:page}.e:last-child{break-after:auto}.n{white-space:nowrap}`,
    // dos etiquetas por fila: la página es una fila del rollo (50 + 2 de separación + 50 mm)
    e50x2: `@page{size:${ETQ_ROLLO2.anchoPagina}mm 25mm;margin:0}html,body{width:${ETQ_ROLLO2.anchoPagina}mm}
.fila{display:flex;gap:${ETQ_ROLLO2.separacion}mm;height:24.5mm;break-after:page}.fila:last-child{break-after:auto}
.fila .e{width:50mm;height:24.5mm;flex:none}.n{white-space:nowrap}`,
    ticket: `@page{size:${rollo}mm auto;margin:0}.e{width:${rollo}mm;padding:2mm 1.5mm 3mm;border-bottom:1px dashed #000}`,
  }[tam];
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Etiquetas</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif}
.e{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.4mm;overflow:hidden;break-inside:avoid;text-align:center;padding:1mm 1.5mm}
.e svg{display:block;flex:none}
.n{font-size:7.5pt;line-height:1.1;max-width:100%;overflow:hidden;text-overflow:ellipsis;max-height:2.2em}
.v{font-size:8.5pt;font-weight:700;line-height:1.05;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c{font-size:7pt;letter-spacing:.04em;line-height:1}
.p{font-size:10pt;font-weight:700;line-height:1.05}
${pagina}
</style></head><body><main class="hoja hoja-${tam}">${tam === "e50x2"
    ? Array.from({ length: Math.ceil(lista.length / 2) }, (_, i) => `<div class="fila">${lista.slice(i * 2, i * 2 + 2).map(etiqueta).join("")}</div>`).join("")
    : lista.map(etiqueta).join("")}</main>
${autoPrint ? '<script>addEventListener("load",function(){setTimeout(function(){print()},300)})<\/script>' : ""}
</body></html>`;
}
async function etqImprimir(btn) {
  if (!exigir("producto.editar", "crear etiquetas")) return;
  const msg = $("#etqMsg");
  msg.hidden = true;
  const elegidas = etqTodas().filter(f => etq.cant.get(etqClave(f.p, f.v)) > 0).sort(etqOrden);
  if (!elegidas.length) return;
  const malo = elegidas.find(f => etqCodigo(f) && !barraModulos(etqCodigo(f).trim()));
  if (malo) {
    msg.textContent = `El código de «${etqNombre(malo)}» tiene tildes o ñ y no se puede imprimir. Cámbialo en el producto.`;
    msg.hidden = false;
    return;
  }
  const total = elegidas.reduce((a, f) => a + etq.cant.get(etqClave(f.p, f.v)), 0);
  if (total > 300 && !confirm("Vas a imprimir " + total + " etiquetas. ¿Continuar?")) return;
  btn.disabled = true;
  try {
    // los códigos que faltan se guardan antes de imprimir, para que la etiqueta impresa ya funcione al vender
    const usados = codigosUsados(), cambios = new Map(), hoy = new Date().toISOString();
    for (const f of elegidas) {
      if (etqCodigo(f)) continue;
      const c = cambios.get(f.p.id) || { actualizado: hoy };
      if (f.v) {
        c.variantes = c.variantes || f.p.variantes.map(v => ({ ...v }));
        c.variantes.find(v => v.id === f.v.id).codigo = nuevoCodigoBarras(usados);
      } else c.codigo = nuevoCodigoBarras(usados);
      cambios.set(f.p.id, c);
    }
    for (const [id, c] of cambios) await patchProduct(id, c);
    const claves = elegidas.flatMap(f => Array(etq.cant.get(etqClave(f.p, f.v))).fill(etqClave(f.p, f.v)));
    const actuales = new Map(etqTodas().map(f => [etqClave(f.p, f.v), f]));
    const lista = claves.map(k => actuales.get(k)).map(f => ({ ...f, ...codigoActual(f, cambios) }));
    store.set("mostrador.etiquetas", { tam: etq.tam, precio: etq.precio });
    const ancho = etq.tam === "a4" ? "210mm" : etq.tam === "e50" ? "50mm" : etq.tam === "e50x2" ? ETQ_ROLLO2.anchoPagina + "mm" : (S.settings.papel === "58" ? 58 : 80) + "mm";
    if (canPrintLocally()) printFrame(etiquetasHtml(lista, etq.tam, etq.precio, false), ancho, btn);
    else await saveFile("etiquetas.html", etiquetasHtml(lista, etq.tam, etq.precio, true));
    etqLista();
    if (cambios.size) toast("Códigos nuevos guardados");
  } catch (err) {
    msg.textContent = failMsg(err);
    msg.hidden = false;
  } finally {
    if (!printingFrame) btn.disabled = false;
    etqTotal();
  }
}
// con Firebase el producto puede tardar en actualizarse en pantalla: se usan los códigos recién creados
function codigoActual(f, cambios) {
  const c = cambios.get(f.p.id);
  if (!c) return {};
  if (f.v) return c.variantes ? { v: c.variantes.find(v => v.id === f.v.id) } : {};
  return c.codigo ? { p: { ...f.p, codigo: c.codigo } } : {};
}
$("#etqQ").addEventListener("input", e => { etq.q = e.target.value; etqLista(); });
$("#etqTam").addEventListener("change", e => { etq.tam = e.target.value; });
$("#etqPrecio").addEventListener("change", e => { etq.precio = e.target.checked; });
$("#etqFilas").addEventListener("input", e => {
  const k = e.target.dataset.etq;
  if (!k) return;
  const n = Math.max(0, Math.floor(n2(e.target.value)));
  if (n) etq.cant.set(k, n); else etq.cant.delete(k);
  etqTotal();
});
$("#labelDlg").addEventListener("click", e => {
  const t = e.target.closest("button");
  if (!t) return;
  if (t.id === "etqCerrar") return $("#labelDlg").close();
  if (t.id === "etqPrint") return etqImprimir(t);
  if ("etqVerTodos" in t.dataset) { etq.solo = null; etqSoloHtml(); return etqLista(); }
  const modo = t.dataset.etqTodo;
  if (!modo) return;
  etqVisibles().forEach(f => {
    const k = etqClave(f.p, f.v), stock = Math.max(0, Math.floor(n2(f.v ? f.v.stock : f.p.stock)));
    const n = modo === "uno" ? 1 : modo === "stock" ? stock : 0;
    if (n) etq.cant.set(k, n); else etq.cant.delete(k);
  });
  etqLista();
});

