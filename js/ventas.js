// ---------- ventas ----------
let salesPeriod = store.get("mostrador.salesPeriod") || "30d";
let salesCompare = store.get("mostrador.salesCompare") || "prev"; // prev | year | none
let salesMetric = "total"; // total (importe) | count (número de ventas)
let salesTopMode = "units", salesQ = "", salesSort = "fecha", salesDir = -1, salesLimit = 25;
const salesPeriods = [["today", "Hoy"], ["7d", "7 días"], ["30d", "30 días"], ["month", "Este mes"], ["all", "Todo"]];
const salesCompares = [["prev", "Período anterior"], ["year", "Año pasado"], ["none", "Sin comparar"]];
const DIA_MS = 86400000;
const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const enRango = (n, r) => { const d = new Date(n.fecha); return !Number.isNaN(d.getTime()) && d >= r.start && d <= r.end; };
// el período elegido va desde su primer día hasta este momento
function salesRange() {
  if (salesPeriod === "all") return null;
  const now = new Date(), hoy = dayStart(now);
  const start = salesPeriod === "7d" ? addDays(hoy, -6) : salesPeriod === "30d" ? addDays(hoy, -29)
    : salesPeriod === "month" ? new Date(hoy.getFullYear(), hoy.getMonth(), 1) : hoy;
  return { start, end: now, days: Math.round((hoy - start) / DIA_MS) + 1 };
}
// período con el que se compara: mismo largo y hasta el mismo momento (por ejemplo, ayer hasta esta hora),
// para no comparar un día a medias contra uno completo
function salesCompareRange() {
  const r = salesRange();
  if (!r || salesCompare === "none") return null;
  let start;
  if (salesCompare === "year") { start = new Date(r.start); start.setFullYear(start.getFullYear() - 1); }
  else if (salesPeriod === "month") start = new Date(r.start.getFullYear(), r.start.getMonth() - 1, 1);
  else start = addDays(r.start, -r.days);
  let end = new Date(start.getTime() + (r.end - r.start));
  // un mes anterior más corto (febrero) no se mete en el mes siguiente
  if (salesPeriod === "month" && salesCompare === "prev") end = new Date(Math.min(end, new Date(start.getFullYear(), start.getMonth() + 1, 1) - 1));
  const corto = salesCompare === "year" ? "Año pasado" : salesPeriod === "today" ? "Ayer" : salesPeriod === "month" ? "Mes anterior" : "Período anterior";
  return { start, end, days: r.days, corto };
}
function salesInPeriod() {
  const r = salesRange();
  return r ? S.notes.filter(n => enRango(n, r)) : [...S.notes];
}
// la fecha más antigua que necesita Ventas con las notas que escucha el equipo (el año pasado se pide aparte)
function salesDesde() {
  const r = salesRange();
  if (!r) return null;
  const cr = salesCompare === "prev" ? salesCompareRange() : null;
  return cr ? cr.start : r.start;
}
// notas del período de comparación; si quedan antes de lo que escucha el equipo, se piden una sola vez por días completos
const salesRangoCache = new Map();
function salesCompareNotes(cr) {
  if (!cr) return null;
  if (!db || !db.notesRango || !notasDesde || cr.start.toISOString() >= notasDesde) return S.notes.filter(n => enRango(n, cr));
  const a = dayStart(cr.start).toISOString(), b = addDays(dayStart(cr.end), 1).toISOString(), key = a + "|" + b;
  let e = salesRangoCache.get(key);
  if (!e) {
    e = { notes: null, error: false };
    salesRangoCache.set(key, e);
    db.notesRango(a, b).then(docs => { e.notes = docs; }).catch(() => { e.error = true; salesRangoCache.delete(key); })
      .then(() => { if (S.view === "ventas") renderVentas(); });
  }
  return e.notes ? e.notes.filter(n => enRango(n, cr)) : e.error ? "error" : "loading";
}
function salesMetrics(notes) {
  const valid = notes.filter(n => n.estado !== "anulada");
  const total = valid.reduce((a, n) => a + n2(n.total), 0);
  return { total, count: valid.length, average: valid.length ? total / valid.length : 0, units: valid.reduce((a, n) => a + n.items.reduce((b, i) => b + itemUnits(i), 0), 0) };
}
// cambio porcentual con flecha; el color lo da la clase (verde sube, rojo baja) y la flecha lo dice sin color
function salesDelta(a, b) {
  if (!b) return a ? { cls: "new", txt: "nuevo" } : null;
  const p = Math.round((a - b) / b * 100);
  return { cls: p > 0 ? "up" : p < 0 ? "down" : "", txt: (p > 0 ? "▲ " : p < 0 ? "▼ " : "= ") + Math.abs(p) + " %" };
}
const deltaHtml = (a, b) => { const d = salesDelta(a, b); return d ? `<span class="delta ${d.cls}">${d.txt}</span>` : ""; };
function salesKpis(notes, prevNotes, cmp) {
  const cur = salesMetrics(notes), prior = Array.isArray(prevNotes) ? salesMetrics(prevNotes) : null;
  const fmt = { total: money, count: qty, average: money, units: qty };
  const context = key => {
    if (!cmp) return salesPeriod === "all" ? "todo el historial" : "sin comparar";
    if (prevNotes === "loading") return "cargando " + cmp.corto.toLowerCase() + "…";
    if (prevNotes === "error") return "sin conexión para comparar";
    if (!prior[key]) return `${cmp.corto}: sin ventas`;
    return `${deltaHtml(cur[key], prior[key])} · ${cmp.corto}: ${fmt[key](prior[key])}`;
  };
  const data = [["Total vendido", money(cur.total), "total"], ["Ventas", qty(cur.count), "count"], ["Ticket promedio", money(cur.average), "average"], ["Unidades vendidas", qty(cur.units), "units"]];
  return `<div class="summary-stats">${data.map(x => `<div class="summary-stat"><span class="summary-stat-label">${x[0]}</span><b class="summary-stat-value">${x[1]}</b><span class="summary-stat-context">${context(x[2])}</span></div>`).join("")}</div>`;
}
// suma las notas emitidas en barras de una hora, un día o una semana desde «start»
function salesSeries(notes, start, length, unit) {
  const paso = unit === "week" ? 7 : 1;
  const bs = Array.from({ length }, (_, i) => ({ total: 0, count: 0, hour: unit === "hour" ? i : null, date: unit === "hour" ? null : addDays(start, i * paso) }));
  notes.forEach(n => {
    if (n.estado === "anulada") return;
    const d = new Date(n.fecha);
    if (Number.isNaN(d.getTime())) return;
    const i = unit === "hour" ? d.getHours() : Math.floor(Math.round((dayStart(d) - start) / DIA_MS) / paso);
    if (i >= 0 && i < length) { bs[i].total = round2(bs[i].total + n2(n.total)); bs[i].count++; }
  });
  return bs;
}
// tope del eje con números redondos; con cantidades, la mitad también es entera
function niceMax(m, enteros) {
  if (m <= 0) return 0;
  const p = 10 ** Math.floor(Math.log10(m));
  const r = (enteros ? [1, 2, 4, 6, 8, 10] : [1, 2, 2.5, 5, 10]).map(k => k * p).find(v => v >= m);
  return enteros ? Math.max(2, r) : r;
}
const salesVal = b => salesMetric === "count" ? b.count : b.total;
const salesFmt = v => salesMetric === "count" ? qty(v) : money(v);
const ventasTxt = n => qty(n) + (n === 1 ? " venta" : " ventas");
function salesWhen(b, unit) {
  if (unit === "hour") return b.hour + ":00 a " + b.hour + ":59";
  if (unit === "week") return "Semana del " + b.date.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
  return b.date.toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" });
}
function salesTipTxt(b, pb, unit, cmp) {
  let t = salesWhen(b, unit) + "\n" + money(b.total) + " · " + ventasTxt(b.count);
  if (pb) {
    const d = salesDelta(salesVal(b), salesVal(pb));
    t += "\n" + cmp.corto + (unit === "hour" ? "" : " (" + salesWhen(pb, unit) + ")") + ": " + money(pb.total) + " · " + ventasTxt(pb.count) + (d ? "\nCambio: " + d.txt : "");
  }
  return t;
}
function renderSalesChart(notes, prevNotes, cmp) {
  const r = salesRange(), now = new Date();
  let unit = "day", start = r && r.start, length = r ? r.days : 1;
  if (salesPeriod === "today") { unit = "hour"; length = 24; }
  else if (!r) {
    const fechas = notes.map(n => new Date(n.fecha)).filter(d => !Number.isNaN(d.getTime()));
    start = dayStart(fechas.length ? new Date(Math.min(...fechas)) : now);
    length = Math.round((dayStart(now) - start) / DIA_MS) + 1;
    // en «Todo» con más de 60 días, las barras son semanas que empiezan el lunes
    if (length > 60) { unit = "week"; start = addDays(start, -((start.getDay() + 6) % 7)); length = Math.floor(Math.round((dayStart(now) - start) / DIA_MS) / 7) + 1; }
  }
  let cur = salesSeries(notes, start, length, unit);
  let prev = cmp && Array.isArray(prevNotes) ? salesSeries(prevNotes, dayStart(cmp.start), length, unit) : null;
  if (unit === "hour") {
    // horario visible: de 8 a 20 h, ampliado si hubo ventas fuera de ese rango
    const usadas = [...cur, ...(prev || [])].filter(b => b.count).map(b => b.hour);
    const lo = Math.min(8, ...usadas), hi = Math.max(20, ...usadas);
    cur = cur.slice(lo, hi + 1); prev = prev && prev.slice(lo, hi + 1);
  }
  const trend = salesMetric === "total" && unit !== "hour" && !notasAviso() ? salesTrend(cur, unit === "week") : null;
  const max = Math.max(0, ...cur.map(salesVal), ...(prev || []).map(salesVal), trend ? trend.max : 0);
  const tope = niceMax(max, salesMetric === "count");
  const alto = v => tope ? (v / tope * 100).toFixed(2) + "%" : "0";
  const cada = unit === "hour" ? 2 : cur.length <= 10 ? 1 : Math.ceil(cur.length / 8);
  const bars = cur.map((b, i) => {
    const pb = prev && prev[i], v = salesVal(b);
    return `<div class="sales-bar-col" data-tip="${esc(salesTipTxt(b, pb, unit, cmp))}">${pb && salesVal(pb) ? `<div class="sales-bar prev" style="height:${alto(salesVal(pb))}"></div>` : ""}<div class="sales-bar${v ? "" : " zero"}" style="${v ? "height:" + alto(v) : ""}"></div></div>`;
  }).join("");
  const labels = cur.map((b, i) => `<span>${i % cada === 0 || i === cur.length - 1 && cur.length <= 10 ? esc(unit === "hour" ? b.hour + ":00" : b.date.toLocaleDateString("es", { day: "2-digit", month: "short" })) : ""}</span>`).join("");
  const ancho = Math.max(600, cur.length * (unit === "hour" ? 24 : 12));
  const titulo = unit === "hour" ? "Ventas por hora" : unit === "week" ? "Ventas por semana" : "Ventas por día";
  const sinVentas = !cur.some(b => b.count) && !(prev || []).some(b => b.count);
  const leyenda = [
    `<span><i></i>${salesPeriod === "today" ? "Hoy" : "Este período"}</span>`,
    prev ? `<span><i class="prev"></i>${esc(cmp.corto)}</span>` : "",
    trend ? `<span><i class="line"></i>Tendencia</span>` : "",
  ].join("");
  const espera = cmp && prevNotes === "loading" ? `<p class="muted sales-note">Cargando ${esc(cmp.corto.toLowerCase())}…</p>` : cmp && prevNotes === "error" ? `<p class="muted sales-note">Sin conexión: no se pudo traer ${esc(cmp.corto.toLowerCase())} para comparar.</p>` : "";
  return `<section class="dash-card dash-wide"><div class="dash-heading sales-head"><h2>${titulo}</h2>
      <span class="sales-top-toggle" role="group" aria-label="Qué medir"><button data-sales-metric="total" aria-pressed="${salesMetric === "total"}">Importe</button><button data-sales-metric="count" aria-pressed="${salesMetric === "count"}">N.º de ventas</button></span></div>
    ${sinVentas ? `<div class="sales-empty">Aún no hay ventas en este período. <button class="btn primary" data-view="venta">Nueva venta</button></div>` : `
    <div class="sales-legend sales-legend-top">${leyenda}</div>
    <div class="sales-chart-wrap"><div class="sales-chart${prev ? " compara" : ""}" style="grid-template-columns:64px minmax(${ancho}px,1fr)">
      <div class="sales-axis"><span>${salesFmt(tope)}</span><span>${salesFmt(tope / 2)}</span><span>${salesFmt(0)}</span></div>
      <div class="sales-plot" role="img" aria-label="${esc(titulo)}. El detalle de cada venta está en la tabla de abajo.">${bars}${trend && tope ? trendSvg(trend, cur.length, tope) : ""}</div>
    </div><div class="sales-xlabels" style="min-width:${ancho + 64}px">${labels}</div></div>
    ${espera}
    ${trend ? `<p class="sales-trend"><b>${esc(trend.title)}</b>${esc(trend.change)}${trend.restNote ? `<small>${esc(trend.restNote)}</small>` : ""}</p>` : ""}`}
  </section>`;
}
// qué días de la semana se vende más, comparado con el otro período
function renderWeekdays(notes, prevNotes, cmp) {
  if (salesPeriod === "today") return "";
  const dias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"], largos = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  const sumar = list => {
    const a = dias.map(() => ({ total: 0, count: 0 }));
    list.forEach(n => {
      if (n.estado === "anulada") return;
      const d = new Date(n.fecha);
      if (Number.isNaN(d.getTime())) return;
      const x = a[(d.getDay() + 6) % 7]; x.total = round2(x.total + n2(n.total)); x.count++;
    });
    return a;
  };
  const cur = sumar(notes), prev = cmp && Array.isArray(prevNotes) ? sumar(prevNotes) : null;
  if (!cur.some(b => b.count)) return "";
  const tope = Math.max(1, ...cur.map(salesVal), ...(prev || []).map(salesVal));
  const mejor = cur.reduce((m, b, i) => salesVal(b) > salesVal(cur[m]) ? i : m, 0);
  const cols = cur.map((b, i) => {
    const pb = prev && prev[i], d = pb ? salesDelta(salesVal(b), salesVal(pb)) : null;
    const tip = largos[i][0].toUpperCase() + largos[i].slice(1) + "\n" + money(b.total) + " · " + ventasTxt(b.count) + (pb ? "\n" + cmp.corto + ": " + money(pb.total) + " · " + ventasTxt(pb.count) + (d ? "\nCambio: " + d.txt : "") : "");
    const barra = (v, cls) => `<i class="${cls}${v ? "" : " zero"}" style="${v ? "height:" + (v / tope * 100).toFixed(2) + "%" : ""}"></i>`;
    return `<div class="wk-col${prev ? " compara" : ""}" data-tip="${esc(tip)}">${barra(salesVal(b), "")}${prev ? barra(salesVal(pb), "prev") : ""}</div>`;
  }).join("");
  return `<section class="dash-card"><div class="dash-heading"><h2>Por día de la semana</h2><span class="dash-subtitle">mejor día: ${largos[mejor]} (${salesFmt(salesVal(cur[mejor]))})</span></div>
    ${prev ? `<div class="sales-legend sales-legend-top"><span><i></i>Este período</span><span><i class="prev"></i>${esc(cmp.corto)}</span></div>` : ""}
    <div class="wk-chart">${cols}</div><div class="wk-labels">${dias.map(d => `<span>${d}</span>`).join("")}</div></section>`;
}
// cada medio de pago tiene siempre el mismo color, por su lugar en la lista y no por cuánto vendió
const pagoColor = label => { const i = MEDIOS_PAGO.indexOf(label); return i >= 0 && i < 5 ? `var(--c${i + 1})` : "var(--c-otro)"; };
function renderPagos(notes, prevNotes, cmp) {
  const rows = pagoResumen(notes);
  if (!rows.length) return "";
  const prior = cmp && Array.isArray(prevNotes) ? new Map(pagoResumen(prevNotes).map(d => [d.label, d])) : null;
  const total = rows.reduce((a, d) => a + d.total, 0) || 1;
  const pct = d => Math.round(d.total / total * 100);
  const stack = rows.filter(d => d.total > 0).map(d => `<span style="flex-grow:${d.total};background:${pagoColor(d.label)}" data-tip="${esc(d.label + "\n" + money(d.total) + " · " + pct(d) + " %\n" + qty(d.count) + (d.count === 1 ? " nota" : " notas"))}"></span>`).join("");
  const filas = rows.map(d => `<tr data-tip="${esc(d.label + ": " + money(d.total))}"><td><i class="sw" style="background:${pagoColor(d.label)}"></i>${esc(d.label)}</td><td class="num">${money(d.total)}</td><td class="num">${pct(d)} %</td><td class="num notas">${qty(d.count)}</td>${prior ? `<td class="num">${deltaHtml(d.total, prior.get(d.label)?.total || 0) || "—"}</td>` : ""}</tr>`).join("");
  return `<section class="dash-card"><div class="dash-heading"><h2>Por medio de pago</h2><span class="dash-subtitle">sin contar anuladas</span></div>
    <div class="pay-stack" role="img" aria-label="Reparto por medio de pago; los montos están en la tabla">${stack}</div>
    <div class="pay-wrap"><table class="pay-table"><thead><tr><th>Medio</th><th class="num">Importe</th><th class="num">%</th><th class="num notas">Notas</th>${prior ? `<th class="num" title="${esc("Cambio vs. " + cmp.corto.toLowerCase())}">Cambio</th>` : ""}</tr></thead><tbody>${filas}</tbody></table></div></section>`;
}
// Parábola de tendencia: ajuste por mínimos cuadrados y = a + b·x + c·x² sobre las ventas de cada barra
// (x de 0 a 1). Describe el período, no predice. Diseñada junto con Codex.
function salesTrend(buckets, weekly) {
  const n = buckets.length;
  if (salesPeriod === "today" || n < 5) return null;
  // un día de la semana sin ninguna venta en todo el período se toma como día de descanso y no cuenta
  let rest = [];
  if (!weekly) {
    const byDay = new Map();
    buckets.forEach(b => { const k = b.date.getDay(), e = byDay.get(k) || { n: 0, sold: 0 }; e.n++; if (b.total) e.sold++; byDay.set(k, e); });
    rest = [...byDay].filter(([, e]) => e.n >= 2 && !e.sold).map(([k]) => k);
  }
  const pts = buckets.map((b, i) => ({ x: i / (n - 1), y: b.total, day: b.date && b.date.getDay() })).filter(p => !rest.includes(p.day));
  if (pts.length < 5 || pts.filter(p => p.y > 0).length < 3) return null;
  // ecuaciones normales 3 × 3 resueltas por Cramer
  const sx = k => pts.reduce((a, p) => a + p.x ** k, 0), sxy = k => pts.reduce((a, p) => a + p.x ** k * p.y, 0);
  const [s0, s1, s2, s3, s4] = [0, 1, 2, 3, 4].map(sx), [t0, t1, t2] = [0, 1, 2].map(sxy);
  const det3 = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const M = [[s0, s1, s2], [s1, s2, s3], [s2, s3, s4]], D = det3(M);
  if (!D) return null;
  const solve = col => det3(M.map((r, i) => r.map((v, j) => j === col ? [t0, t1, t2][i] : v))) / D;
  const a = solve(0), b = solve(1), c = solve(2);
  const f = x => a + b * x + c * x * x;
  const mean = t0 / pts.length;
  const ssTot = pts.reduce((acc, p) => acc + (p.y - mean) ** 2, 0), ssRes = pts.reduce((acc, p) => acc + (p.y - f(p.x)) ** 2, 0);
  const r2 = ssTot ? 1 - ssRes / ssTot : 1;
  // pendientes medidas en todo el período (cuánto cambiaría la venta de punta a punta a ese ritmo),
  // comparadas con el 15 % del promedio (mínimo S/ 1, para no exagerar con montos chicos)
  const step = 1 / (n - 1), tol = 0.15 * Math.max(mean, 1);
  const startSlope = b, endSlope = b + 2 * c, bend = Math.abs(2 * c) >= 2 * tol; // "acelera / se frena" solo si se nota
  const curve = Array.from({ length: 61 }, (_, i) => f(i / 60)), flat = Math.max(...curve) - Math.min(...curve) < tol;
  const xv = c ? -b / (2 * c) : -1;
  const turn = xv > step / 2 && xv < 1 - step / 2 && Math.sign(startSlope) !== Math.sign(endSlope) && Math.abs(startSlope) >= tol;
  // la parábola siempre "vuelve": si después del pico o del valle cambia poco, se dice que se mantiene
  const settled = turn && Math.abs(f(1) - f(xv)) < 2 * tol;
  const vDate = turn ? buckets[Math.round(xv * (n - 1))].date : null;
  const when = vDate ? (weekly ? "la semana del " : "el ") + vDate.toLocaleDateString("es", { day: "numeric", month: "long" }) : "";
  const around = when.replace(/^el /, "del ").replace(/^la /, "de la ");
  let title;
  // una línea casi plana es "estable" aunque el R² sea bajo (sin tendencia no hay nada que explicar)
  if (flat) title = "Las ventas se mantienen estables.";
  else if (r2 < 0.3) title = "Las ventas cambian mucho de un " + (weekly ? "período" : "día") + " a otro; la línea es solo una guía.";
  else if (Math.abs(endSlope) < tol || settled) title = turn ? (startSlope > 0 ? `Subieron hasta ${when} y ahora se mantienen.` : `Bajaron hasta ${when} y ahora se mantienen.`)
    : Math.abs(startSlope) >= tol ? (startSlope > 0 ? "Las ventas subieron y ahora se mantienen." : "Las ventas bajaron y ahora se mantienen.") : "Las ventas se mantienen estables.";
  else if (endSlope > 0) title = turn ? `Venían bajando, tocaron su punto más bajo alrededor ${around} y ya se están recuperando.` : !bend ? "Las ventas van subiendo." : c > 0 ? "Las ventas van subiendo y cada vez más rápido." : "Las ventas suben, pero cada vez más lento.";
  else title = turn ? `Llegaron a su punto más alto alrededor ${around} y ahora van bajando.` : !bend ? "Las ventas van bajando." : c < 0 ? "Las ventas van bajando y cada vez más rápido." : "Las ventas bajan, pero cada vez más lento.";
  const from = Math.max(0, f(0)), to = Math.max(0, f(1)), per = weekly ? "por semana" : "por día";
  const change = !flat && r2 >= 0.3 && Math.abs(to - from) >= tol ? `La línea pasó de unos ${money(from)} a ${money(to)} ${per}.` : "";
  const plural = d => /s$/.test(d) ? d : d + "s";
  const restNames = rest.sort((x, y) => (x + 6) % 7 - (y + 6) % 7).map(k => plural(new Date(2024, 0, 7 + k).toLocaleDateString("es", { weekday: "long" })));
  const restNote = restNames.length ? `No se cuentan los ${restNames.length > 1 ? restNames.slice(0, -1).join(", los ") + " ni los " + restNames.at(-1) : restNames[0]}: no hubo ventas en ninguno de esos días (seguramente la tienda no abre).` : "";
  const samples = Array.from({ length: 61 }, (_, i) => i / 60);
  return { f, title, change, restNote, max: Math.max(...samples.map(x => Math.max(0, f(x)))), samples };
}
function trendSvg(trend, n, top) {
  const d = trend.samples.map((x, i) => `${i ? "L" : "M"}${(x * (n - 1) + 0.5).toFixed(3)} ${(top - Math.min(top, Math.max(0, trend.f(x)))).toFixed(2)}`).join(" ");
  return `<svg class="sales-trend-svg" viewBox="0 0 ${n} ${top}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" vector-effect="non-scaling-stroke"/></svg>`;
}
function salesTopData(notes) {
  const products=new Map(),variants=new Map(),categories=new Map();
  notes.filter(n=>n.estado!=="anulada").forEach(n=>n.items.forEach(i=>{const p=S.products.find(x=>x.id===i.productId),savedName=i.variantId?String(i.nombre||"").replace(/\s+–\s+[^–]*$/,""):i.nombre,name=p?p.nombre:savedName,key=i.productId||name,units=n2(i.cant),amount=units*n2(i.precio);if(!products.has(key))products.set(key,{label:name,units:0,amount:0});products.get(key).units+=units;products.get(key).amount+=amount;if(i.variantId){const v=(p?.variantes||[]).find(x=>x.id===i.variantId),size=i.talla||v?.talla||"Sin talla",color=i.color||v?.color||"Sin color",vk=key+size+color;if(!variants.has(vk))variants.set(vk,{label:`${name} – ${size} / ${color}`,value:0});variants.get(vk).value+=units;}else{const cat=p?.categoria||"Sin categoría";categories.set(cat,(categories.get(cat)||0)+units);}}));
  const top=[...products].map(([key,x])=>({...x,key,value:salesTopMode==="units"?x.units:x.amount})).sort((a,b)=>b.value-a.value).slice(0,10), detail=variants.size?[...variants.values()].sort((a,b)=>b.value-a.value).slice(0,8):[...categories].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value).slice(0,8);
  return {top,detail,variants:variants.size>0,products};
}
function renderTopProducts(notes, prevNotes, cmp) {
  const data = salesTopData(notes), prior = cmp && Array.isArray(prevNotes) ? salesTopData(prevNotes).products : null;
  const empty = `<div class="sales-empty">Aún no hay ventas en este período. <button class="btn primary" data-view="venta">Nueva venta</button></div>`;
  const tope = Math.max(1, ...data.top.map(y => y.value)), topeDet = Math.max(1, ...data.detail.map(y => y.value));
  const productRows = data.top.map((x, i) => {
    const p = prior && prior.get(x.key), pv = p ? (salesTopMode === "units" ? p.units : p.amount) : 0;
    const tip = x.label + "\n" + qty(x.units) + " und · " + money(x.amount) + (prior ? "\n" + cmp.corto + ": " + (p ? qty(p.units) + " und · " + money(p.amount) : "sin ventas") : "");
    return `<div class="bar-row" data-tip="${esc(tip)}"><span class="bar-label"><span class="rank">${i + 1}.</span>${esc(x.label)}</span><span class="bar-track"><span class="bar s1" style="width:calc((100% - ${prior ? 15 : 11}em) * ${(x.value / tope).toFixed(4)})"></span><span class="bar-val num">${qty(x.units)} und · ${money(x.amount)}${prior ? " " + deltaHtml(x.value, pv) : ""}</span></span></div>`;
  }).join("");
  const detailRows = data.detail.map((x, i) => `<div class="bar-row" data-tip="${esc(x.label + "\n" + qty(x.value) + " und")}"><span class="bar-label"><span class="rank">${i + 1}.</span>${esc(x.label)}</span><span class="bar-track"><span class="bar s1" style="width:calc((100% - 5em) * ${(x.value / topeDet).toFixed(4)})"></span><span class="bar-val num">${qty(x.value)} und</span></span></div>`).join("");
  return `<div class="dash-grid"><section class="dash-card"><div class="dash-heading"><h2>Productos más vendidos</h2><span class="sales-top-toggle"><button data-sales-mode="units" aria-pressed="${salesTopMode === "units"}">Unidades</button><button data-sales-mode="amount" aria-pressed="${salesTopMode === "amount"}">Ingresos</button></span>${prior ? `<span class="dash-subtitle">cambio vs. ${esc(cmp.corto.toLowerCase())}</span>` : ""}</div>${productRows ? `<div class="bars">${productRows}</div>` : empty}</section><section class="dash-card"><div class="dash-heading"><h2>Tallas y colores más vendidos</h2><span class="dash-subtitle">${data.variants ? "por unidades" : "por categoría · unidades"}</span></div>${detailRows ? `<div class="bars">${detailRows}</div>` : empty}</section></div>`;
}
function renderSalesTable(notes) {
  const query=norm(salesQ),rows=notes.filter(n=>!query||norm([folioTxt(n.folio),n.cliente,n.pago,...n.items.map(i=>i.nombre)].join(" ")).includes(query));
  rows.sort((a,b)=>{
    let v=0;
    if(salesSort==="folio")v=n2(a.folio)-n2(b.folio);
    else if(salesSort==="cliente")v=String(a.cliente||"").localeCompare(String(b.cliente||""),"es");
    else if(salesSort==="total")v=n2(a.total)-n2(b.total);
    else if(salesSort==="productos")v=a.items.map(i=>i.nombre).join(" ").localeCompare(b.items.map(i=>i.nombre).join(" "),"es");
    else if(salesSort==="unidades")v=a.items.reduce((x,i)=>x+n2(i.cant),0)-b.items.reduce((x,i)=>x+n2(i.cant),0);
    else if(salesSort==="pago")v=String(a.pago||PAGO_SIN_DATO).localeCompare(String(b.pago||PAGO_SIN_DATO),"es");
    else if(salesSort==="estado")v=String(a.estado||"").localeCompare(String(b.estado||""),"es");
    else v=new Date(a.fecha)-new Date(b.fecha);
    return v*salesDir;
  });
  const shown=rows.slice(0,salesLimit), columns=[["fecha","Fecha y hora"],["folio","N.º"],["cliente","Cliente"],["productos","Productos"],["unidades","Unidades"],["total","Total"],["pago","Medio de pago"],["estado","Estado"]];
  const body=shown.map(n=>{const summary=n.items.map(i=>{
    // el nombre de la línea ya trae " – talla / color" desde Nueva venta; solo se agrega si falta
    const variant=[i.talla,i.color].filter(Boolean).join(" / ");
    const name=i.nombre||"Producto";
    return `${name}${variant&&!name.includes(variant)?` – ${variant}`:""} ×${qty(i.cant)}`;
  }).join(", "),units=n.items.reduce((a,i)=>a+n2(i.cant),0),voided=n.estado==="anulada";return `<tr data-sales-note="${esc(n.id)}"><td class="${voided?"voided":""}">${esc(fmtDate(n.fecha))}</td><td class="${voided?"voided":""}">${esc(folioTxt(n.folio))}</td><td class="${voided?"voided":""}">${esc(n.cliente||"Público en general")}</td><td class="${voided?"voided":""}" title="${esc(summary)}"><span class="sales-summary">${esc(summary)}</span></td><td class="num ${voided?"voided":""}">${qty(units)}</td><td class="num ${voided?"voided":""}">${money(n.total)}</td><td class="${voided?"voided":""}">${esc(n.pago||PAGO_SIN_DATO)}</td><td><span class="chip ${voided?"out":""}">${voided?"Anulada":"Emitida"}</span></td></tr>`;}).join("");
  // las anuladas se muestran en la tabla pero no suman, igual que en los indicadores
  const units=notes.reduce((a,n)=>a+(n.estado==="anulada"?0:n.items.reduce((b,i)=>b+n2(i.cant),0)),0),total=notes.reduce((a,n)=>a+(n.estado==="anulada"?0:n2(n.total)),0);
  return `<div class="toolbar"><h2 style="margin-right:auto">Todas las ventas</h2><input class="grow" type="search" id="salesSearch" placeholder="Buscar cliente, folio o producto" value="${esc(salesQ)}"><button class="btn" id="salesExport">Exportar Excel</button></div><div class="summary-table-wrap"><table class="summary-table sales-table"><thead><tr>${columns.map(([key,title])=>`<th><button data-sales-sort="${key}">${title}${salesSort===key?(salesDir===1?" ↑":" ↓"):""}</button></th>`).join("")}</tr></thead><tbody>${body||`<tr><td colspan="8" class="sales-empty">Aún no hay ventas en este período. <button class="btn primary" data-view="venta">Nueva venta</button></td></tr>`}</tbody><tfoot><tr><td colspan="4">Totales del período</td><td class="num">${qty(units)}</td><td class="num">${money(total)}</td><td colspan="2"></td></tr></tfoot></table></div>${shown.length<rows.length?`<div class="toolbar" style="justify-content:center;margin-top:12px"><button class="btn" id="salesMore">Mostrar más</button></div>`:""}`;
}
function renderVentas() {
  if (!exigir("estadisticas.ver", "ver estadísticas")) return;
  chartTip.hidden = true;
  const hadSearchFocus = document.activeElement && document.activeElement.id === "salesSearch";
  notasAsegurar(salesDesde());
  const cargando = !!(notasEscuchar && notasDesde !== notasInicio && notasDeCache);
  const el = $("#v-ventas"), notes = salesInPeriod(), cmp = salesCompareRange(), prevNotes = cmp && cargando ? "loading" : salesCompareNotes(cmp);
  const fecha = d => d.toLocaleDateString("es", { day: "numeric", month: "short", year: salesCompare === "year" ? "numeric" : undefined });
  const rango = !cmp ? "" : salesPeriod === "today"
    ? fecha(cmp.start) + ", hasta las " + cmp.end.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
    : fecha(cmp.start) + " al " + fecha(cmp.end) + ", hasta la misma hora";
  const todo = salesPeriod === "all";
  const compara = `<div class="sales-compare"><span>Comparar con</span><div class="seg">${salesCompares.map(([k, l]) => `<button data-sales-compare="${k}" aria-pressed="${todo ? k === "none" : salesCompare === k}"${todo && k !== "none" ? " disabled" : ""}>${l}</button>`).join("")}</div><span class="muted">${todo ? "Elige un período para comparar." : esc(rango)}</span></div>`;
  el.innerHTML = `<div class="toolbar"><h1 style="margin-right:auto">Ventas</h1><div class="seg">${salesPeriods.map(([key, label]) => `<button data-sales-period="${key}" aria-pressed="${salesPeriod === key}">${label}</button>`).join("")}</div></div>${compara}${notasAviso()}${salesKpis(notes, prevNotes, cmp)}${renderSalesChart(notes, prevNotes, cmp)}<div class="dash-grid sales-pair">${renderWeekdays(notes, prevNotes, cmp)}${renderPagos(notes, prevNotes, cmp)}</div>${renderTopProducts(notes, prevNotes, cmp)}${renderSalesTable(notes)}`;
  if (hadSearchFocus) { const input = $("#salesSearch"); input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
}
// detalle al pasar el mouse o tocar una barra: un solo cuadro flotante para toda la vista
const chartTip = document.createElement("div");
chartTip.className = "chart-tip";
chartTip.hidden = true;
chartTip.setAttribute("role", "tooltip");
document.body.append(chartTip);
function chartTipMove(e) {
  const t = e.target.closest && e.target.closest("[data-tip]");
  if (!t) { chartTip.hidden = true; return; }
  chartTip.textContent = t.dataset.tip;
  chartTip.hidden = false;
  const w = chartTip.offsetWidth, h = chartTip.offsetHeight;
  let x = e.clientX + 14, y = e.clientY - h - 12;
  if (x + w > innerWidth - 8) x = e.clientX - w - 14;
  if (y < 8) y = e.clientY + 18;
  chartTip.style.left = Math.max(8, x) + "px";
  chartTip.style.top = y + "px";
}
$("#v-ventas").addEventListener("pointermove", chartTipMove);
$("#v-ventas").addEventListener("pointerdown", chartTipMove);
$("#v-ventas").addEventListener("pointerleave", () => { chartTip.hidden = true; });
addEventListener("scroll", () => { chartTip.hidden = true; }, { passive: true });
$("#v-ventas").addEventListener("input", e => { if (e.target.id === "salesSearch") { salesQ = e.target.value; salesLimit = 25; renderVentas(); } });
$("#v-ventas").addEventListener("click", e => {
  const t = e.target.closest("button, tr[data-sales-note]");
  if (!t) return;
  if (t.dataset.view) return go(t.dataset.view);
  if (t.dataset.salesPeriod) { salesPeriod = t.dataset.salesPeriod; store.set("mostrador.salesPeriod", salesPeriod); salesLimit = 25; return renderVentas(); }
  if (t.dataset.salesCompare) { salesCompare = t.dataset.salesCompare; store.set("mostrador.salesCompare", salesCompare); return renderVentas(); }
  if (t.dataset.salesMetric) { salesMetric = t.dataset.salesMetric; return renderVentas(); }
  if (t.dataset.salesMode) { salesTopMode = t.dataset.salesMode; return renderVentas(); }
  if (t.dataset.salesSort) { if (salesSort === t.dataset.salesSort) salesDir *= -1; else { salesSort = t.dataset.salesSort; salesDir = t.dataset.salesSort === "fecha" ? -1 : 1; } return renderVentas(); }
  if (t.id === "salesMore") { salesLimit += 25; return renderVentas(); }
  if (t.id === "salesExport") return exportSalesCsv(salesInPeriod(), t);
  if (t.dataset.salesNote) { S.selNote = t.dataset.salesNote; return go("notas"); }
});
async function exportSalesCsv(notes, btn) {
  if (!exigir("datos.exportar", "exportar ventas")) return;
  await saveExcel("ventas-" + isoDay(new Date()), salesBook(notes), btn);
}

const mobileViewTitles = {
  inventario: "Inventario",
  venta: "Nueva venta",
  notas: "Notas",
  caja: "Caja",
  cotizaciones: "Cotizaciones",
  ventas: "Ventas",
  reportes: "Reportes",
  resumen: "Resumen",
  usuarios: "Usuarios",
  config: "Configuración"
};
function setMobileMenu(open) {
  const header = document.querySelector("header.top");
  const toggle = document.querySelector(".mobile-menu-button");
  header.classList.toggle("menu-open", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  document.body.classList.toggle("menu-locked", open);
}
document.querySelector(".mobile-menu-button").addEventListener("click", () => {
  setMobileMenu(!document.querySelector("header.top").classList.contains("menu-open"));
});
document.querySelector(".drawer-close").addEventListener("click", () => setMobileMenu(false));
document.querySelector(".drawer-backdrop").addEventListener("click", () => setMobileMenu(false));
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && document.querySelector("header.top").classList.contains("menu-open")) {
    setMobileMenu(false);
  }
});

