// ---------- Excel ----------
// Un libro es { title, period, kpis, sheets: [{ name, title, cols, rows, foot, notes, muted }] }. Formato sobrio para el contador.
// Tipo de columna: "m" dinero, "q" cantidad, "p" porcentaje (0 a 100), "d" fecha, "dt" fecha y hora, "c" texto centrado.
// Una celda puede ser { f, v }: fórmula con {r} (fila), {first} y {last} (filas de datos), más su valor ya calculado.
// En el pie, "sum" suma la columna y respeta los filtros de Excel.
let excelLoad = null;
function loadExcel() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  excelLoad = excelLoad || new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
    s.onload = () => ok(window.ExcelJS);
    s.onerror = () => { excelLoad = null; s.remove(); fail(new Error("excel")); };
    document.head.append(s);
  });
  return excelLoad;
}
const XL = { head: "FF1F3864", foot: "FFF2F2F2", line: "FFBFBFBF", muted: "FF7F7F7F", fg: "FF000000", font: "Arial" };
const XL_ESTADO = { Agotado: "FFC00000", Anulada: "FFC00000", Vencida: "FFC00000", Reponer: "FFBF6900", Pendiente: "FFBF6900" };
const xlFont = (o = {}) => ({ name: XL.font, size: 10, color: { argb: XL.fg }, ...o });
const xlFill = argb => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const xlEdge = style => ({ style, color: { argb: XL.line } });
const xlBox = { top: xlEdge("thin"), left: xlEdge("thin"), bottom: xlEdge("thin"), right: xlEdge("thin") };
const xlLetter = n => { let s = ""; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
// Excel guarda la hora sin zona horaria: se pasa la hora local tal como se ve en la app
const xlDate = iso => { const d = new Date(iso); return isNaN(d) ? "" : new Date(d.getTime() - d.getTimezoneOffset() * 60000); };
const xlSum = (rows, k) => rows.reduce((a, r) => a + n2(r[k] && r[k].v !== undefined ? r[k].v : r[k]), 0);
function xlSheetName(name, used) {
  const base = String(name).replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 28) || "Hoja";
  let out = base;
  for (let i = 2; used.has(out.toLowerCase()); i++) out = base + " " + i;
  used.add(out.toLowerCase());
  return out;
}
function xlWorkbook(ExcelJS, book) {
  const wb = new ExcelJS.Workbook(), s = S.settings, user = usuarioActual();
  wb.creator = "Mostrador"; wb.created = new Date();
  const used = new Set();
  const moneda = String(s.moneda || "S/").replace(/"/g, "");
  // formato contable: dos decimales, negativos en rojo entre paréntesis y cero como guion
  const moneyFmt = '#,##0.00_);[Red](#,##0.00);"-"_)';
  const razon = s.razonSocial || s.negocio || "Mi negocio";
  const pairs = [
    [["RUC", s.ruc || "Sin registrar (complétalo en Configuración)"], ["RAZÓN SOCIAL", razon], ...(s.razonSocial && s.negocio ? [["NOMBRE COMERCIAL", s.negocio]] : [])],
    [["PERÍODO", book.period || "—"], ["MONEDA", moneda === "S/" ? "Soles (S/)" : moneda]],
    [["EMITIDO", fmtDate(new Date().toISOString())], ...(user ? [["ELABORADO POR", user.nombre]] : [])],
  ];
  book.sheets.forEach((sheet, index) => {
    const ws = wb.addWorksheet(xlSheetName(sheet.name, used));
    const cols = sheet.cols, n = cols.length;
    const titleOf = c => c.t === "m" ? `${c.h} (${moneda})` : c.h;
    const shown = (v, t) => {
      const x = v && v.v !== undefined ? v.v : v;
      if (t === "m") return n2(x).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "  ";
      if (t === "q") return qty(x);
      if (t === "p") return "100.0 %";
      if (t === "d") return "00/00/0000";
      if (t === "dt") return "00/00/0000 00:00";
      return String(x == null ? "" : x);
    };
    const widths = cols.map((c, k) => Math.min(c.max || 44, Math.max(
      Math.ceil(titleOf(c).length / (titleOf(c).length > 14 ? 2 : 1)) + 6, 8,
      ...sheet.rows.slice(0, 2000).map(r => shown(r[k], c.t).length + 2),
      sheet.foot ? (sheet.foot[k] === "sum" ? shown(xlSum(sheet.rows, k), c.t).length + 3 : c.t ? shown(sheet.foot[k], c.t).length + 2 : 0) : 0)));
    ws.columns = widths.map(width => ({ width }));
    const totalWidth = widths.reduce((a, w) => a + w, 0);

    // encabezado: título y datos de la empresa
    ws.mergeCells(1, 1, 1, n);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = (sheet.title || book.title).toUpperCase();
    titleCell.font = xlFont({ bold: true, size: 13, color: { argb: XL.head } });
    titleCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    ws.getRow(1).height = 26;
    const kpiLine = index === 0 && book.kpis && book.kpis.length ? [["RESUMEN", book.kpis.map(([k, v]) => k + ": " + v).join("  ·  ")]] : null;
    const lines = kpiLine ? [...pairs, kpiLine] : pairs;
    lines.forEach((pair, i) => {
      const r = i + 2;
      ws.mergeCells(r, 1, r, n);
      const parts = pair.flatMap(([k, v], j) => [{ font: xlFont({ bold: true }), text: (j ? "     " : "") + k + ": " }, { font: xlFont(), text: String(v) }]);
      const cell = ws.getCell(r, 1);
      cell.value = { richText: parts };
      cell.alignment = { vertical: "middle", wrapText: true };
      ws.getRow(r).height = 15 * Math.ceil(parts.reduce((a, p) => a + p.text.length, 0) * 1.1 / totalWidth);
    });
    const hr = lines.length + 3, first = hr + 1, last = hr + sheet.rows.length;

    const align = c => ["m", "q", "p"].includes(c.t) ? "right" : ["c", "d", "dt"].includes(c.t) ? "center" : "left";
    const headRow = ws.getRow(hr);
    headRow.height = 32;
    cols.forEach((c, k) => {
      const cell = headRow.getCell(k + 1);
      cell.value = titleOf(c);
      cell.font = xlFont({ bold: true, color: { argb: "FFFFFFFF" } });
      cell.fill = xlFill(XL.head);
      cell.border = xlBox;
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });

    const fill = (v, r) => v && v.f ? { formula: v.f.replace(/\{r\}/g, r).replace(/\{first\}/g, first).replace(/\{last\}/g, last), result: v.v } : v;
    const format = (cell, c, value) => {
      cell.alignment = { vertical: "middle", wrapText: !["m", "q", "p"].includes(c.t), horizontal: align(c) };
      if (c.t === "m") cell.numFmt = moneyFmt;
      else if (c.t === "q") cell.numFmt = Number.isInteger(n2(value && value.result !== undefined ? value.result : value)) ? "#,##0" : "#,##0.00#";
      else if (c.t === "p") cell.numFmt = "0.0%";
      else if (c.t === "d") cell.numFmt = "dd/mm/yyyy";
      else if (c.t === "dt") cell.numFmt = "dd/mm/yyyy hh:mm";
    };
    sheet.rows.forEach((values, i) => {
      const r = first + i, row = ws.getRow(r), muted = sheet.muted && sheet.muted(values);
      cols.forEach((c, k) => {
        const cell = row.getCell(k + 1);
        let v = fill(values[k], r);
        if (c.t === "p" && typeof v === "number") v = v / 100;
        if ((c.t === "d" || c.t === "dt") && v) v = xlDate(v);
        if (c.t === "c" && /^[1-9]\d{0,3}$/.test(String(v))) v = Number(v); // una talla 38 es un número, no texto
        format(cell, c, v);
        cell.value = v === undefined ? "" : v;
        cell.font = xlFont({ color: { argb: muted ? XL.muted : XL.fg } });
        cell.border = xlBox;
        if (c.h === "Estado" && XL_ESTADO[v]) cell.font = xlFont({ bold: true, color: { argb: XL_ESTADO[v] } });
      });
    });
    if (!sheet.rows.length) {
      ws.mergeCells(first, 1, first, n);
      const cell = ws.getCell(first, 1);
      cell.value = "Sin datos para este período.";
      cell.font = xlFont({ italic: true, color: { argb: XL.muted } });
      cell.alignment = { horizontal: "center" };
    } else ws.autoFilter = { from: { row: hr, column: 1 }, to: { row: last, column: n } };

    let end = Math.max(last, first);
    if (sheet.foot && sheet.rows.length) {
      end = last + 1;
      const row = ws.getRow(end);
      row.height = 20;
      cols.forEach((c, k) => {
        const cell = row.getCell(k + 1), letter = xlLetter(k + 1);
        let v = sheet.foot[k];
        if (v === "sum") v = { formula: `SUBTOTAL(109,${letter}${first}:${letter}${last})`, result: xlSum(sheet.rows, k) };
        else v = fill(v, end);
        if (c.t === "p" && typeof v === "number") v = v / 100;
        format(cell, c, v);
        cell.alignment = { vertical: "middle", horizontal: typeof v === "string" ? "left" : align(c) };
        cell.value = v === undefined ? "" : v;
        cell.font = xlFont({ bold: true });
        cell.fill = xlFill(XL.foot);
        // doble línea bajo los totales, como en los libros contables
        cell.border = { top: { style: "thin", color: { argb: XL.fg } }, bottom: { style: "double", color: { argb: XL.fg } } };
      });
    }
    let noteRow = end + 2;
    (sheet.notes || []).filter(Boolean).forEach(text => {
      ws.mergeCells(noteRow, 1, noteRow, n);
      const cell = ws.getCell(noteRow, 1);
      cell.value = text;
      cell.font = xlFont({ italic: true, size: 9, color: { argb: "FF404040" } });
      cell.alignment = { wrapText: true, vertical: "top" };
      ws.getRow(noteRow).height = 13 * Math.ceil(text.length * 0.95 / totalWidth);
      noteRow++;
    });

    ws.views = [{ state: "frozen", ySplit: hr, showGridLines: false }];
    ws.pageSetup = { paperSize: 9, orientation: totalWidth > 90 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${hr}:${hr}`, horizontalCentered: true, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 } };
    ws.headerFooter.oddFooter = `&L${String(razon).replace(/&/g, "&&")}&RPágina &P de &N`;
  });
  return wb;
}
// Versión simple por si no se puede armar el Excel (sin internet o dentro de claude.ai)
function bookCsv(book) {
  const rows = [[book.title + (book.period ? " · " + book.period : "")], []];
  const plain = (v, t) => { const x = v && v.v !== undefined ? v.v : v; return t === "d" ? fmtDay(x) : t === "dt" ? fmtDate(x) : typeof x === "number" ? round2(x) : x == null ? "" : x; };
  book.sheets.forEach(sh => {
    const cols = sh.cols.map((c, k) => [c, k]);
    rows.push([sh.name], cols.map(([c]) => c.h));
    sh.rows.forEach(r => rows.push(cols.map(([c, k]) => plain(r[k], c.t))));
    if (sh.foot) rows.push(cols.map(([c, k]) => sh.foot[k] === "sum" ? round2(xlSum(sh.rows, k)) : plain(sh.foot[k], c.t)));
    rows.push([]);
  });
  return csvText(rows);
}
async function saveExcel(name, book, btn) {
  if (downloads) {
    // dentro de claude.ai sigue saliendo CSV (el Excel no está probado ahí): se avisa en vez de cambiarlo en silencio
    toast("Aquí se descarga en CSV. Para el Excel con formato, abre Mostrador desde su página publicada.");
    return saveFile(name + ".csv", bookCsv(book));
  }
  const label = btn && btn.textContent;
  if (btn) { btn.disabled = true; btn.textContent = "Preparando Excel…"; }
  try {
    const ExcelJS = await loadExcel();
    const buffer = await xlWorkbook(ExcelJS, book).xlsx.writeBuffer();
    await saveFile(name + ".xlsx", buffer);
  } catch (e) {
    console.error(e);
    toast("No se pudo preparar el Excel (¿sin internet?). Se descargó una versión simple en CSV.");
    await saveFile(name + ".csv", bookCsv(book));
  } finally {
    if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = label; }
  }
}
function inventoryBook() {
  const cols = [{ h: "N.º", t: "c" }, { h: "Código" }, { h: "Producto" }, { h: "Categoría" }, { h: "Talla", t: "c" }, { h: "Color", t: "c" }, { h: "Unidad", t: "c" }, { h: "Stock", t: "q" }, { h: "Precio unitario", t: "m" }, { h: "Valor total", t: "m" }, { h: "Stock mínimo", t: "q" }, { h: "Estado", t: "c" }];
  const rows = [], cats = new Map();
  const add = (p, v) => {
    const precio = n2(v ? v.precio ?? p.precio : p.precio), stock = n2(v ? v.stock : p.stock), min = n2(v ? v.minimo ?? p.minimo : p.minimo);
    const cat = p.categoria || "Sin categoría", valor = Math.max(0, stock) * precio;
    rows.push([rows.length + 1, (v && v.codigo) || p.codigo || "", p.nombre, cat, (v && v.talla) || "", (v && v.color) || "", p.unidad || "und", stock, precio, { f: "ROUND(MAX(H{r},0)*I{r},2)", v: round2(valor) }, min, stock <= 0 ? "Agotado" : stock <= min ? "Reponer" : "OK"]);
    const d = cats.get(cat) || { ids: new Set(), units: 0, value: 0 };
    d.ids.add(p.id); d.units += Math.max(0, stock); d.value += round2(valor); cats.set(cat, d);
  };
  [...S.products].sort((a, b) => (a.categoria || "Sin categoría").localeCompare(b.categoria || "Sin categoría", "es") || a.nombre.localeCompare(b.nombre, "es")).forEach(p => {
    if (p.variantes && p.variantes.length) [...p.variantes].sort((a, b) => byTalla(a.talla || "", b.talla || "") || byColor(a.color || "", b.color || "")).forEach(v => add(p, v));
    else add(p);
  });
  const value = [...cats.values()].reduce((a, d) => a + d.value, 0), units = [...cats.values()].reduce((a, d) => a + d.units, 0);
  const aviso = "Valorizado a precio de venta. Para el inventario contable se usa el costo de compra, que puedes anotar en cada producto.";
  return {
    title: "Inventario valorizado a precio de venta", period: "Al " + fmtDay(new Date()),
    kpis: [["Productos", qty(S.products.length)], ["Unidades", qty(units)], ["Valor total", money(value)], ["Por reponer", qty(rows.filter(r => r[11] !== "OK").length)]],
    sheets: [
      { name: "Inventario", cols, rows, notes: [aviso], foot: ["", "", "TOTAL", "", "", "", "", "sum", "", "sum", "", ""] },
      { name: "Por categoría", title: "Inventario valorizado por categoría", notes: [aviso],
        cols: [{ h: "Categoría" }, { h: "Productos", t: "q" }, { h: "Unidades", t: "q" }, { h: "Valor total", t: "m" }, { h: "% del valor", t: "p" }],
        rows: [...cats].sort((a, b) => b[1].value - a[1].value).map(([k, d]) => [k, d.ids.size, d.units, d.value, value ? d.value / value * 100 : 0]),
        foot: ["TOTAL", "sum", "sum", "sum", value ? 100 : 0] },
    ],
  };
}
// Registro de ventas para el contador. El IGV se calcula suponiendo que los precios ya lo incluyen.
const IGV_TASA = 0.18;
function salesBook(notes, period) {
  const sorted = [...notes].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const base = t => round2(n2(t) / (1 + IGV_TASA));
  const isVoid = r => r.includes("Anulada");
  const docType = d => /^\d{11}$/.test(d) ? "RUC" : /^\d{8}$/.test(d) ? "DNI" : d ? "Otro" : "Sin doc.";
  const numero = f => String(f).padStart(5, "0");
  // las anuladas quedan en el registro con importe cero, para no romper el correlativo ni los totales
  const reg = sorted.map((n, i) => {
    const anulada = n.estado === "anulada", t = anulada ? 0 : round2(n.total), b = anulada ? 0 : base(n.total), doc = String(n.doc || "").trim();
    return [i + 1, n.fecha || "", "Nota de venta", "NV", numero(n.folio), docType(doc), doc, n.cliente || "Público en general", { f: "ROUND(K{r}/" + (1 + IGV_TASA) + ",2)", v: b }, { f: "K{r}-I{r}", v: round2(t - b) }, t, anulada ? "Anulada" : "Emitida", n.pago || PAGO_SIN_DATO, n.vendedorNombre || "", n.obs || ""];
  });
  const months = new Map();
  sorted.forEach(n => {
    const d = new Date(n.fecha), key = d.getFullYear() * 100 + d.getMonth();
    const m = months.get(key) || { label: d.toLocaleDateString("es", { month: "long", year: "numeric" }), ok: 0, bad: 0, base: 0, total: 0 };
    if (n.estado === "anulada") m.bad++; else { m.ok++; m.base += base(n.total); m.total += round2(n.total); }
    months.set(key, m);
  });
  const ok = sorted.filter(n => n.estado !== "anulada");
  const items = ok.flatMap(n => (n.items || []).map(i => {
    const prod = S.products.find(p => p.id === i.productId), v = prod && (prod.variantes || []).find(x => x.id === i.variantId);
    return [n.fecha || "", folioTxt(n.folio), n.cliente || "Público en general", (v && v.codigo) || (prod && prod.codigo) || "", i.variantId ? String(i.nombre || "").replace(/\s+–\s+[^–]*$/, "") : i.nombre || "", i.talla || "", i.color || "", i.unidad || "und", n2(i.cant), n2(i.precio), { f: "ROUND(I{r}*J{r},2)", v: round2(n2(i.cant) * n2(i.precio)) }];
  }));
  const total = reg.reduce((a, r) => a + r[10], 0), baseTotal = reg.reduce((a, r) => a + r[8].v, 0), voided = sorted.length - ok.length;
  const rango = sorted.length ? (() => { const a = fmtDay(sorted[0].fecha), z = fmtDay(sorted[sorted.length - 1].fecha); return a === z ? a : "Del " + a + " al " + z; })() : "Sin ventas";
  const avisoIgv = "Montos con IGV del " + IGV_TASA * 100 + " % calculado, suponiendo que los precios lo incluyen. Si tu régimen no separa IGV (por ejemplo, Nuevo RUS), usa solo la columna Total.";
  const avisoSunat = "Las notas de venta son comprobantes internos, no comprobantes de pago electrónicos de SUNAT.";
  const avisoAnuladas = voided ? "Las notas anuladas figuran con importe cero." : "";
  return {
    title: "Registro de ventas", period: period || rango,
    sheets: [
      { name: "Resumen mensual", title: "Resumen mensual de ventas", notes: [avisoIgv, avisoSunat],
        cols: [{ h: "Mes" }, { h: "Notas emitidas", t: "q" }, { h: "Notas anuladas", t: "q" }, { h: "Base imponible", t: "m" }, { h: "IGV", t: "m" }, { h: "Total", t: "m" }],
        rows: [...months].sort((a, b) => a[0] - b[0]).map(([, m]) => [m.label.charAt(0).toUpperCase() + m.label.slice(1), m.ok, m.bad, round2(m.base), round2(m.total - m.base), round2(m.total)]),
        foot: ["TOTAL", "sum", "sum", "sum", "sum", "sum"] },
      { name: "Medios de pago", title: "Ventas por medio de pago", notes: ["Solo notas emitidas: el total coincide con el del registro de ventas. Importes con IGV incluido. El medio de pago lo anota quien vende; concíliese con el banco o la caja."],
        cols: [{ h: "Medio de pago" }, { h: "Notas", t: "q" }, { h: "Total", t: "m" }, { h: "% del total", t: "p" }],
        rows: pagoResumen(ok).map(d => [d.label, d.count, d.total, total ? d.total / total * 100 : 0]),
        foot: ["TOTAL", "sum", "sum", total ? 100 : 0] },
      { name: "Registro de ventas", muted: isVoid, notes: [avisoIgv, avisoSunat, avisoAnuladas],
        cols: [{ h: "N.º", t: "c" }, { h: "Fecha de emisión", t: "d" }, { h: "Tipo de documento" }, { h: "Serie", t: "c" }, { h: "Número", t: "c" }, { h: "Tipo doc. cliente", t: "c" }, { h: "N.º doc. cliente", t: "c" }, { h: "Cliente" }, { h: "Base imponible", t: "m" }, { h: "IGV", t: "m" }, { h: "Total", t: "m" }, { h: "Estado", t: "c" }, { h: "Medio de pago", t: "c" }, { h: "Atendió" }, { h: "Observaciones", max: 32 }],
        rows: reg, foot: ["", "", "", "", "", "", "", "TOTAL", "sum", "sum", "sum", "", "", "", ""] },
      { name: "Detalle de productos", title: "Detalle de productos vendidos", notes: ["Solo notas emitidas: el total coincide con el del registro de ventas. Importes con IGV incluido."],
        cols: [{ h: "Fecha", t: "d" }, { h: "N.º de nota", t: "c" }, { h: "Cliente" }, { h: "Código" }, { h: "Producto" }, { h: "Talla", t: "c" }, { h: "Color", t: "c" }, { h: "Unidad", t: "c" }, { h: "Cantidad", t: "q" }, { h: "Precio unitario", t: "m" }, { h: "Importe", t: "m" }],
        rows: items, foot: ["", "", "", "", "TOTAL", "", "", "", "sum", "", "sum"] },
    ],
  };
}
function reportBook(rep) {
  return {
    title: rep.title, period: rep.period, kpis: rep.kpis,
    sheets: rep.sections.map((sec, i) => ({
      name: sec.title, title: rep.title + " · " + sec.title, cols: sec.cols.map(([h, t]) => ({ h, t })), rows: sec.rows, foot: sec.foot,
      notes: i === rep.sections.length - 1 ? [rep.note] : [],
      muted: r => r.includes("Anulada"),
    })),
  };
}

