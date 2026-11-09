// ---------- reportes ----------
const REPORT_TYPES = [["ventas", "Ventas"], ["productos", "Productos más vendidos"], ["ganancias", "Ganancias y márgenes"],["inventario", "Inventario valorizado"], ["reponer", "Stock por reponer"], ["cotizaciones", "Cotizaciones"]];
const REPORT_PERIODS = [["today", "Hoy"], ["7d", "Últimos 7 días"], ["30d", "Últimos 30 días"], ["month", "Este mes"], ["lastmonth", "Mes anterior"], ["custom", "Elegir fechas"]];
let reportType = store.get("mostrador.reportType") || "ventas";
let reportPeriod = store.get("mostrador.reportPeriod") || "month";
const isoDay = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
// "Elegir fechas" empieza en el mes actual, del día 1 a hoy
let reportFrom = isoDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), reportTo = isoDay(new Date());
function reportRange() {
  const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from = new Date(today), to = new Date(today);
  if (reportPeriod === "7d") from.setDate(from.getDate() - 6);
  else if (reportPeriod === "30d") from.setDate(from.getDate() - 29);
  else if (reportPeriod === "month") from.setDate(1);
  else if (reportPeriod === "lastmonth") { from = new Date(today.getFullYear(), today.getMonth() - 1, 1); to = new Date(today.getFullYear(), today.getMonth(), 0); }
  else if (reportPeriod === "custom") {
    const a = new Date((reportFrom || isoDay(today)) + "T00:00"), b = new Date((reportTo || isoDay(today)) + "T00:00");
    if (!isNaN(a)) from = a;
    if (!isNaN(b)) to = b;
    if (from > to) [from, to] = [to, from];
  }
  const end = new Date(to); end.setHours(23, 59, 59, 999);
  return { from, to, end, label: isoDay(from) === isoDay(to) ? fmtDay(from) : fmtDay(from) + " al " + fmtDay(to) };
}
const inRange = (iso, r) => { const d = new Date(iso); return !isNaN(d) && d >= r.from && d <= r.end; };
const variantLabel = v => [v.talla, v.color].filter(Boolean).join(" / ");
// Cada reporte: indicadores y tablas. Las columnas dicen cómo mostrar cada valor ("m" dinero, "q" cantidad, "p" porcentaje).
function buildReport() {
  const r = reportRange();
  const needsPeriod = !["inventario", "reponer"].includes(reportType);
  const rep = { title: (REPORT_TYPES.find(x => x[0] === reportType) || REPORT_TYPES[0])[1], period: needsPeriod ? r.label : "Al " + fmtDay(new Date()), kpis: [], sections: [], note: "" };
  if (reportType === "ventas") {
    const notes = S.notes.filter(n => inRange(n.fecha, r)).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const valid = notes.filter(n => n.estado !== "anulada");
    const units = n => (n.items || []).reduce((a, i) => a + itemUnits(i), 0);
    const total = valid.reduce((a, n) => a + n2(n.total), 0), count = valid.length, u = valid.reduce((a, n) => a + units(n), 0);
    rep.kpis = [["Total vendido", money(total)], ["Ventas", qty(count)], ["Ticket promedio", money(count ? total / count : 0)], ["Unidades", qty(u)]];
    const days = new Map();
    valid.forEach(n => { const k = isoDay(new Date(n.fecha)); const d = days.get(k) || { count: 0, units: 0, total: 0 }; d.count++; d.units += units(n); d.total += n2(n.total); days.set(k, d); });
    rep.sections.push({ title: "Ventas por día", cols: [["Fecha"], ["Ventas", "q"], ["Unidades", "q"], ["Total", "m"]],
      rows: [...days].map(([k, d]) => [fmtDay(k + "T00:00"), d.count, d.units, d.total]), foot: ["Total", count, u, total] });
    const sellers = new Map();
    valid.forEach(n => { const k = n.vendedorNombre || "Sin nombre"; const d = sellers.get(k) || { count: 0, total: 0 }; d.count++; d.total += n2(n.total); sellers.set(k, d); });
    if (sellers.size > 1) rep.sections.push({ title: "Por vendedor", cols: [["Vendedor"], ["Ventas", "q"], ["Total", "m"], ["% del total", "p"]],
      rows: [...sellers].sort((a, b) => b[1].total - a[1].total).map(([k, d]) => [k, d.count, d.total, total ? d.total / total * 100 : 0]) });
    rep.sections.push({ title: "Por medio de pago", cols: [["Medio de pago"], ["Ventas", "q"], ["Total", "m"], ["% del total", "p"]],
      rows: pagoResumen(valid).map(d => [d.label, d.count, d.total, total ? d.total / total * 100 : 0]), foot: ["Total", count, total, total ? 100 : 0] });
    rep.sections.push({ title: "Detalle de ventas", cols: [["Fecha y hora"], ["N.º"], ["Cliente"], ["Atendió"], ["Medio de pago"], ["Estado"], ["Total", "m"]],
      rows: notes.map(n => [fmtDate(n.fecha), folioTxt(n.folio), n.cliente || "Público en general", n.vendedorNombre || "", n.pago || PAGO_SIN_DATO, n.estado === "anulada" ? "Anulada" : "Emitida", n2(n.total)]), foot: ["Total (sin anuladas)", "", "", "", "", "", total] });
    const voided = notes.length - valid.length;
    if (voided) rep.note = voided === 1 ? "1 nota anulada aparece en el detalle, pero no suma." : voided + " notas anuladas aparecen en el detalle, pero no suman.";
  } else if (reportType === "productos") {
    const map = new Map();
    S.notes.filter(n => n.estado !== "anulada" && inRange(n.fecha, r)).forEach(n => (n.items || []).forEach(i => {
      if (!i.productId) return; // descuentos e ítems libres no son productos
      const k = i.productId + ":" + (i.variantId || ""), p = S.products.find(x => x.id === i.productId);
      const d = map.get(k) || { nombre: i.nombre, cat: p?.categoria || "", units: 0, amount: 0 };
      d.units += n2(i.cant); d.amount += n2(i.cant) * n2(i.precio); map.set(k, d);
    }));
    const rows = [...map.values()].sort((a, b) => b.amount - a.amount);
    const total = rows.reduce((a, x) => a + x.amount, 0), units = rows.reduce((a, x) => a + x.units, 0);
    rep.kpis = [["Productos distintos", qty(rows.length)], ["Unidades vendidas", qty(units)], ["Ingresos", money(total)], ["Más vendido", rows[0] ? rows[0].nombre : "—"]];
    rep.sections.push({ title: "Ranking por ingresos", cols: [["#", "q"], ["Producto"], ["Categoría"], ["Unidades", "q"], ["Ingresos", "m"], ["% del total", "p"]],
      rows: rows.map((x, k) => [k + 1, x.nombre, x.cat || "Sin categoría", x.units, x.amount, total ? x.amount / total * 100 : 0]), foot: ["", "Total", "", units, total, total ? 100 : 0] });
  } else if (reportType === "ganancias") {
    const g = gananciaDe(S.notes.filter(n => n.estado !== "anulada" && inRange(n.fecha, r)));
    const filas = [...g.productos.values()].map(d => ({ ...d, ganancia: d.ingresos - d.costo })).sort((a, b) => b.ganancia - a.ganancia);
    rep.kpis = [["Ganancia", money(g.ganancia)], ["Margen", Math.round(g.margen) + " %"], ["Ventas con costo", money(g.ingresos)], ["Costo de lo vendido", money(g.costo)]];
    rep.sections.push({ title: "Ganancia por producto", cols: [["Producto"], ["Categoría"], ["Unidades", "q"], ["Ventas", "m"], ["Costo", "m"], ["Ganancia", "m"], ["Margen", "p"]],
      rows: filas.map(d => [d.nombre, d.cat || "Sin categoría", d.unidades, d.ingresos, d.costo, d.ganancia, d.ingresos ? d.ganancia / d.ingresos * 100 : 0])
        .concat(g.descuentos ? [["Descuentos", "", "", g.descuentos, 0, g.descuentos, ""]] : []),
      foot: ["Total", "", "", g.ingresos, g.costo, g.ganancia, g.margen] });
    rep.note = "Margen = ganancia ÷ precio de venta." +
      (g.lineasSinCosto ? ` No se cuentan ${money(g.sinCosto)} vendidos en productos sin costo: agrégales el costo en Inventario.` : "");
  } else if (reportType === "inventario") {
    const rows = [...S.products].sort((a, b) => (a.categoria || "").localeCompare(b.categoria || "", "es") || a.nombre.localeCompare(b.nombre, "es"))
      .flatMap(p => p.variantes && p.variantes.length
        ? p.variantes.map(v => [p.nombre + " – " + variantLabel(v), p.categoria || "Sin categoría", v.codigo || p.codigo || "", n2(v.stock), n2(v.precio ?? p.precio), Math.max(0, n2(v.stock)) * n2(v.precio ?? p.precio)])
        : [[p.nombre, p.categoria || "Sin categoría", p.codigo || "", n2(p.stock), n2(p.precio), Math.max(0, n2(p.stock)) * n2(p.precio)]]);
    const units = rows.reduce((a, x) => a + Math.max(0, x[3]), 0), value = rows.reduce((a, x) => a + x[5], 0);
    const cats = new Map(); rows.forEach(x => { const d = cats.get(x[1]) || { units: 0, value: 0 }; d.units += Math.max(0, x[3]); d.value += x[5]; cats.set(x[1], d); });
    rep.kpis = [["Productos", qty(S.products.length)], ["Unidades en stock", qty(units)], ["Valor a precio de venta", money(value)], ["Categorías", qty(cats.size)]];
    rep.sections.push({ title: "Por categoría", cols: [["Categoría"], ["Unidades", "q"], ["Valor", "m"], ["% del valor", "p"]],
      rows: [...cats].sort((a, b) => b[1].value - a[1].value).map(([k, d]) => [k, d.units, d.value, value ? d.value / value * 100 : 0]) });
    rep.sections.push({ title: "Detalle de productos", cols: [["Producto"], ["Categoría"], ["Código"], ["Stock", "q"], ["Precio", "m"], ["Valor", "m"]], rows, foot: ["Total", "", "", units, "", value] });
  } else if (reportType === "reponer") {
    const rows = [];
    S.products.forEach(p => {
      const vs = p.variantes || [];
      const add = (name, stock, min) => { if (stock <= 0 || stock <= min) rows.push([name, p.categoria || "Sin categoría", stock <= 0 ? "Agotado" : "Reponer", stock, min]); };
      if (vs.length) vs.forEach(v => add(p.nombre + " – " + variantLabel(v), n2(v.stock), n2(v.minimo ?? p.minimo)));
      else add(p.nombre, n2(p.stock), n2(p.minimo));
    });
    rows.sort((a, b) => (a[2] === "Agotado" ? 0 : 1) - (b[2] === "Agotado" ? 0 : 1) || a[1].localeCompare(b[1], "es") || a[0].localeCompare(b[0], "es"));
    const out = rows.filter(x => x[2] === "Agotado").length;
    rep.kpis = [["Por reponer", qty(rows.length)], ["Agotados", qty(out)], ["Bajo el mínimo", qty(rows.length - out)], ["Productos revisados", qty(S.products.length)]];
    rep.sections.push({ title: "Lista para pedir", cols: [["Producto"], ["Categoría"], ["Estado"], ["Stock", "q"], ["Mínimo", "q"]], rows });
  } else if (reportType === "cotizaciones") {
    const quotes = S.quotes.filter(q => inRange(q.fecha, r)).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const sold = quotes.filter(q => q.estado === "vendida"), pend = quotes.filter(q => quoteState(q) === "Pendiente");
    const total = quotes.reduce((a, q) => a + n2(q.total), 0);
    rep.kpis = [["Cotizaciones", qty(quotes.length)], ["Monto cotizado", money(total)], ["Vendidas", qty(sold.length) + (quotes.length ? " (" + Math.round(sold.length / quotes.length * 100) + " %)" : "")], ["Pendientes", qty(pend.length)]];
    rep.sections.push({ title: "Detalle de cotizaciones", cols: [["Fecha"], ["N.º"], ["Cliente"], ["Válida hasta"], ["Estado"], ["Total", "m"]],
      rows: quotes.map(q => [fmtDay(q.fecha), quoteNum(q.numero), q.cliente || "Cliente", fmtDay(quoteExpiry(q)), quoteState(q), n2(q.total)]), foot: ["Total", "", "", "", "", total] });
  }
  return rep;
}
function reportCell(v, type) {
  if (v === "" || v == null) return "";
  if (type === "m") return money(v);
  if (type === "q") return qty(v);
  if (type === "p") return n2(v).toLocaleString("es", { maximumFractionDigits: 1 }) + " %";
  return esc(v);
}
function reportDocHtml(rep) {
  const user = usuarioActual();
  const table = sec => `<h2>${esc(sec.title)}</h2>
    ${sec.rows.length ? `<table>
      <thead><tr>${sec.cols.map(([t, type]) => `<th class="${type ? "n" : ""}">${esc(t)}</th>`).join("")}</tr></thead>
      <tbody>${sec.rows.map(row => `<tr>${row.map((v, k) => `<td class="${sec.cols[k][1] ? "n" : ""}">${reportCell(v, sec.cols[k][1])}</td>`).join("")}</tr>`).join("")}</tbody>
      ${sec.foot ? `<tfoot><tr>${sec.foot.map((v, k) => `<td class="${sec.cols[k][1] ? "n" : ""}">${reportCell(v, typeof v === "number" ? sec.cols[k][1] : "")}</td>`).join("")}</tr></tfoot>` : ""}
    </table>` : `<p class="a4-empty">Sin datos para este período.</p>`}`;
  return `<article class="a4 a4-page">
    ${docHeadHtml("REPORTE", rep.period)}
    <h2 style="font-size:1.35em;margin-top:14px">${esc(rep.title)}</h2>
    <div class="a4-sub" style="margin-top:0">Generado el ${esc(fmtDate(new Date().toISOString()))}${user ? " por " + esc(user.nombre) : ""}</div>
    <div class="a4-kpis">${rep.kpis.map(([k, v]) => `<div class="a4-kpi"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div>
    ${rep.sections.map(table).join("")}
    ${rep.note ? `<p class="a4-sub">${esc(rep.note)}</p>` : ""}
    ${docFootHtml("")}
  </article>`;
}
// --- tablero de Reportes ---
let reportTopMode = store.get("mostrador.reportTop") === "cantidad" ? "cantidad" : "monto";
let reportDocAbierto = false;
const REP_VACIO = "Parece que no hubo ventas durante este período. Prueba seleccionando un rango de fechas diferente.";
const repVacio = (txt = REP_VACIO) => `<p class="rep-empty">${esc(txt)}</p>`;
// tarjeta con título, ayuda, controles opcionales y enlace al detalle
function repCard(titulo, ayuda, cuerpo, { extra = "", ir = "" } = {}) {
  return `<article class="rep-card">
    <header>
      <h2>${esc(titulo)}</h2>
      <span class="rep-help" tabindex="0" role="img" aria-label="${esc(ayuda)}" data-tip="${esc(ayuda)}">?</span>
      <span class="rep-tools">${extra}${ir ? `<button class="rep-open" data-rep-ir="${esc(ir)}" aria-label="Ver detalle de ${esc(titulo)}" title="Ver detalle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6M14 4h6v6M20 4l-9 9"/></svg></button>` : ""}</span>
    </header>
    <div class="rep-body">${cuerpo}</div>
  </article>`;
}
// barras por hora (un día), por día (hasta 62) o por mes
function repTramos(notes, r) {
  const dias = Math.round((r.to - r.from) / 86400000) + 1, tramos = new Map();
  const clave = d => dias === 1 ? String(d.getHours()) : dias <= 62 ? isoDay(d) : d.getFullYear() + "-" + (d.getMonth() + 1);
  if (dias === 1) for (let h = 0; h < 24; h++) tramos.set(String(h), { label: String(h).padStart(2, "0") + ":00", total: 0, count: 0 });
  else if (dias <= 62) for (const d = new Date(r.from); d <= r.to; d.setDate(d.getDate() + 1)) tramos.set(isoDay(d), { label: fmtDay(d), total: 0, count: 0 });
  else for (const d = new Date(r.from.getFullYear(), r.from.getMonth(), 1); d <= r.to; d.setMonth(d.getMonth() + 1)) tramos.set(clave(d), { label: d.toLocaleDateString("es-PE", { month: "short", year: "numeric" }), total: 0, count: 0 });
  notes.forEach(n => {
    const t = tramos.get(clave(new Date(n.fecha)));
    if (t) { t.total = round2(t.total + n2(n.total)); t.count++; }
  });
  return [...tramos.values()];
}
function repColumnas(tramos) {
  const max = Math.max(...tramos.map(t => t.total), 0);
  const cols = tramos.map((t, i) => {
    const tip = `${t.label}: ${money(t.total)} · ${t.count} ${t.count === 1 ? "venta" : "ventas"}`;
    return `<button class="rep-col ${i >= tramos.length / 2 ? "der" : ""}" data-tip="${esc(tip)}" aria-label="${esc(tip)}"><i class="${t.total ? "" : "cero"}" style="height:${t.total ? Math.max(2, t.total / max * 100) : 0}%"></i></button>`;
  }).join("");
  return `<div class="rep-chart">
    <span class="rep-max">${money(max)}</span>
    <div class="rep-cols">${cols}</div>
    <div class="rep-axis"><span>${esc(tramos[0].label)}</span><span>${esc(tramos[tramos.length - 1].label)}</span></div>
  </div>`;
}
function repBarras(filas) {
  const max = Math.max(...filas.map(f => f.valor), 0) || 1;
  return `<div class="rep-bars">${filas.map(f => `<div class="rep-bar">
    <div class="rep-bar-txt"><span>${esc(f.label)}</span><b class="num">${esc(f.texto)}</b></div>
    <div class="rep-track"><i style="width:${Math.max(1, f.valor / max * 100)}%"></i></div>
  </div>`).join("")}</div>`;
}
function repProductos(ok) {
  const m = new Map();
  ok.forEach(n => (n.items || []).forEach(i => {
    const k = i.productId || norm(i.nombre), p = i.productId && S.products.find(x => x.id === i.productId);
    const d = m.get(k) || { label: p ? p.nombre : i.variantId ? String(i.nombre || "").replace(/\s+–\s+[^–]*$/, "") : i.nombre || "Sin nombre", monto: 0, cantidad: 0 };
    d.monto = round2(d.monto + n2(i.cant) * n2(i.precio));
    d.cantidad += itemUnits(i);
    m.set(k, d);
  }));
  return [...m.values()].sort((a, b) => b[reportTopMode] - a[reportTopMode]).slice(0, 6)
    .map(d => ({ label: d.label, valor: d[reportTopMode], texto: reportTopMode === "monto" ? money(d.monto) : qty(d.cantidad) + " und" }));
}
function repVendedores(ok) {
  const m = new Map();
  ok.forEach(n => {
    const k = n.vendedorNombre || "Sin registrar", d = m.get(k) || { label: k, total: 0, count: 0 };
    d.total = round2(d.total + n2(n.total));
    d.count++;
    m.set(k, d);
  });
  return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 6)
    .map(d => ({ label: d.label, valor: d.total, texto: money(d.total) + " · " + d.count + (d.count === 1 ? " venta" : " ventas") }));
}
function repVistaGeneral(ok, notes, r) {
  const total = round2(ok.reduce((a, n) => a + n2(n.total), 0));
  const unidades = ok.reduce((a, n) => a + (n.items || []).reduce((b, i) => b + itemUnits(i), 0), 0);
  // contra la misma cantidad de días justo antes del período
  const dias = Math.round((r.to - r.from) / 86400000) + 1;
  const desde = new Date(r.from); desde.setDate(desde.getDate() - dias);
  const previo = S.notes.filter(n => n.estado !== "anulada" && new Date(n.fecha) >= desde && new Date(n.fecha) < r.from).reduce((a, n) => a + n2(n.total), 0);
  const cambio = previo > 0 ? Math.round((total - previo) / previo * 100) : null;
  const kpi = (v, t) => `<div class="rep-kpi"><b class="num">${esc(v)}</b><span>${esc(t)}</span></div>`;
  return `<div class="rep-kpis">
    ${kpi(money(total), "Total vendido")}
    ${kpi(qty(ok.length), "Ventas")}
    ${kpi(money(ok.length ? total / ok.length : 0), "Ticket promedio")}
    ${kpi(qty(unidades), "Unidades vendidas")}
    ${kpi(qty(notes.length - ok.length), "Notas anuladas")}
    ${kpi(cambio === null ? "—" : (cambio > 0 ? "+" : "") + cambio + "%", `Frente a los ${dias} ${dias === 1 ? "día" : "días"} anteriores`)}
  </div>`;
}
function repGanancia(ok) {
  const g = gananciaDe(ok);
  if (!g.ingresos && !g.costo) return repVacio("Aún no hay costos. Edita tus productos en Inventario y escribe el «Costo de compra» para ver cuánto ganas.");
  const kpi = (v, t) => `<div class="rep-kpi"><b class="num">${esc(v)}</b><span>${esc(t)}</span></div>`;
  const top = [...g.productos.values()].map(d => ({ label: d.nombre, valor: Math.max(0, d.ingresos - d.costo), ganancia: d.ingresos - d.costo, margen: d.ingresos ? (d.ingresos - d.costo) / d.ingresos * 100 : 0 }))
    .sort((a, b) => b.ganancia - a.ganancia).slice(0, 5)
    .map(d => ({ ...d, texto: money(d.ganancia) + " · " + Math.round(d.margen) + " %" }));
  return `<div class="rep-kpis">
    ${kpi(money(g.ganancia), "Ganancia")}
    ${kpi(Math.round(g.margen) + " %", "Margen")}
    ${kpi(money(g.costo), "Costo de lo vendido")}
  </div>
  ${top.length ? `<p class="muted rep-mini">Los que más ganancia dejan</p>${repBarras(top)}` : ""}
  ${g.lineasSinCosto ? `<p class="muted rep-mini">No incluye ${esc(money(g.sinCosto))} vendidos en productos sin costo.</p>` : ""}`;
}
function renderReportes() {
  if (!exigir("estadisticas.ver", "ver reportes")) return;
  const el = $("#v-reportes");
  const needsPeriod = !["inventario", "reponer"].includes(reportType);
  const r = reportRange();
  // el período y los mismos días anteriores, para la comparación de Vista general
  const notasDias = Math.round((r.to - r.from) / 86400000) + 1, notasIni = new Date(r.from);
  notasIni.setDate(notasIni.getDate() - notasDias);
  notasAsegurar(notasIni);
  const notes = S.notes.filter(n => inRange(n.fecha, r)), ok = notes.filter(n => n.estado !== "anulada");
  const pagos = [...pagoResumen(notes)].sort((a, b) => b.count - a.count || b.total - a.total);
  const hay = ok.length > 0;
  el.innerHTML = `
    ${notasAviso()}<div class="toolbar rep-top">
      <div style="margin-right:auto"><h1>Reportes</h1><p class="muted rep-sub">${esc(S.settings.negocio || "")} · ${esc(r.label)}</p></div>
      <label class="rep-period"><select id="r-period" aria-label="Período">${REPORT_PERIODS.map(([k, t]) => `<option value="${k}" ${k === reportPeriod ? "selected" : ""}>${t}</option>`).join("")}</select></label>
    </div>
    ${reportPeriod === "custom" ? `<div class="grid2 rep-fechas">
      <label class="f"><span>Desde</span><input type="date" id="r-from" value="${isoDay(r.from)}"></label>
      <label class="f"><span>Hasta</span><input type="date" id="r-to" value="${isoDay(r.to)}"></label>
    </div>` : ""}
    <div class="rep-grid">
      ${repCard("Ventas", "Total vendido en cada tramo del período. Las notas anuladas no suman.", hay ? repColumnas(repTramos(ok, r)) : repVacio(), { ir: "ventas" })}
      ${repCard("Vista general", "Los números principales del período.", hay ? repVistaGeneral(ok, notes, r) : repVacio(), { ir: "ventas" })}
      ${repCard("Ventas por vendedor", "Cuánto vendió cada persona, según quién emitió la nota.", hay ? repBarras(repVendedores(ok)) : repVacio())}
      ${repCard("Productos más vendidos", "Los 6 productos que más vendieron, por dinero o por unidades.", hay ? repBarras(repProductos(ok)) : repVacio(), {
        ir: "productos",
        extra: `<select id="r-top" aria-label="Ordenar productos por"><option value="monto" ${reportTopMode === "monto" ? "selected" : ""}>Monto</option><option value="cantidad" ${reportTopMode === "cantidad" ? "selected" : ""}>Cantidad</option></select>`,
      })}
      ${repCard("Ganancia", "Precio de venta menos el costo de compra de lo vendido. Solo cuenta los productos que tienen costo.", hay ? repGanancia(ok) : repVacio(), { ir: "ganancias" })}
      ${repCard("Formas de pago más utilizadas", "Ordenadas por número de ventas. Es lo que se anotó al vender.", hay ? repBarras(pagos.map(d => ({ label: d.label, valor: d.count, texto: d.count + (d.count === 1 ? " venta" : " ventas") + " · " + money(d.total) }))) : repVacio(), { ir: "ventas" })}
      ${repCard("Pedidos web", "Pedidos hechos en tu tienda web.", repVacio("Todavía no hay datos: los pedidos de tu tienda web llegan por WhatsApp y no se guardan en Mostrador."))}
    </div>
    <details class="rep-doc" id="r-doc" ${reportDocAbierto ? "open" : ""}>
      <summary>Reporte para imprimir o descargar</summary>
      <div class="panel report-controls">
        <label class="f"><span>Reporte</span><select id="r-type">${REPORT_TYPES.map(([k, t]) => `<option value="${k}" ${k === reportType ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        ${needsPeriod ? "" : `<p class="muted" style="margin:0">Muestra el stock de hoy.</p>`}
        <div class="actions">
          <button class="btn primary" id="r-print">Imprimir A4 / PDF</button>
          <button class="btn" id="r-csv">Descargar Excel</button>
        </div>
        <p class="muted" style="margin:0;font-size:13px">Para tener el PDF, toca <b>Imprimir A4 / PDF</b> y en la impresora elige <b>Guardar como PDF</b>.</p>
      </div>
      ${reportDocAbierto ? `<div class="a4-stage">${reportDocHtml(buildReport())}</div>` : ""}
    </details>`;
}
$("#v-reportes").addEventListener("change", e => {
  const t = e.target;
  if (t.id === "r-type") { reportType = t.value; store.set("mostrador.reportType", reportType); }
  else if (t.id === "r-period") {
    reportPeriod = t.value; store.set("mostrador.reportPeriod", reportPeriod);
  }
  else if (t.id === "r-from") reportFrom = t.value;
  else if (t.id === "r-to") reportTo = t.value;
  else if (t.id === "r-top") { reportTopMode = t.value; store.set("mostrador.reportTop", reportTopMode); }
  else return;
  renderReportes();
});
// "toggle" no sube: se escucha en captura para recordar si el reporte quedó abierto
$("#v-reportes").addEventListener("toggle", e => {
  if (e.target.id !== "r-doc" || reportDocAbierto === e.target.open) return;
  reportDocAbierto = e.target.open;
  renderReportes();
}, true);
$("#v-reportes").addEventListener("click", async e => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.repIr === "ventas") return go("ventas");
  if (t.dataset.repIr === "productos" || t.dataset.repIr === "ganancias") {
    reportType = t.dataset.repIr; store.set("mostrador.reportType", reportType);
    reportDocAbierto = true;
    renderReportes();
    return $("#r-doc").scrollIntoView({ behavior: "smooth" });
  }
  if (t.classList.contains("rep-col")) return;
  const rep = buildReport();
  const name = ("reporte-" + reportType + "-" + isoDay(new Date())).toLowerCase();
  if (t.id === "r-print") return printA4(name, reportDocHtml(rep), t);
  if (t.id === "r-csv") {
    if (!exigir("datos.exportar", "descargar reportes")) return;
    const r = reportRange();
    return saveExcel(name, reportType === "ventas" ? salesBook(S.notes.filter(n => inRange(n.fecha, r)), rep.period) : reportBook(rep), t);
  }
});

