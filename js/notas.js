// ---------- notas ----------
let notesQ = "";
// Con Firebase cada equipo escucha solo las notas recientes; leer el historial completo en cada
// apertura gastaría la cuota y haría lenta la app. Las vistas piden más con notasAsegurar(desde).
const NOTAS_DIAS = 14, NOTAS_PAGINA = 100;
let notasDesde = null, notasInicio = null, notasDeCache = false, notasFolioMax = 0, notasEscuchar = null, notasLimite = NOTAS_PAGINA;
function notasAsegurar(desde) {
  if (!notasEscuchar || !notasDesde) return;
  const iso = desde ? desde.toISOString() : null;
  if (iso && iso >= notasDesde) return;
  notasEscuchar(iso);
}
// aviso para no presentar como total lo que todavía no terminó de llegar
function notasAviso() {
  if (!notasEscuchar || notasDesde === notasInicio || !notasDeCache) return "";
  return navigator.onLine === false
    ? `<p class="banner">Sin conexión: estos números pueden no incluir ventas antiguas.</p>`
    : `<p class="banner">Cargando las ventas de este período…</p>`;
}
function renderNotas() {
  if (!exigir("nota.ver", "ver notas")) return;
  const el = $("#v-notas");
  const focusId = document.activeElement && document.activeElement.id;
  const notes = [...S.notes].sort((a, b) => n2(b.folio) - n2(a.folio));
  const q = norm(notesQ);
  const list = notes.filter(n => !q || norm(folioTxt(n.folio) + " " + (n.cliente || "") + " " + (n.doc || "") + " " + (n.pago || "") + " " + n.items.map(i => i.nombre).join(" ")).includes(q));
  if (!S.selNote || !S.notes.some(n => n.id === S.selNote)) S.selNote = list[0] && list[0].id;
  const sel = S.notes.find(n => n.id === S.selNote);
  const today = new Date().toDateString();
  const todays = notes.filter(n => n.estado !== "anulada" && new Date(n.fecha).toDateString() === today);
  const valid = notes.filter(n => n.estado !== "anulada");
  el.innerHTML = `
    <div class="toolbar"><h1 style="margin-right:auto">Notas de venta</h1><button class="btn primary" data-view="venta">+ Nueva venta</button></div>
    <div class="stats">
      <div class="stat"><b>${todays.length}</b><span>Notas de hoy</span></div>
      ${puede("estadisticas.ver") ? `<div class="stat"><b>${money(todays.reduce((a, n) => a + n2(n.total), 0))}</b><span>Vendido hoy</span></div>` : ""}
      <div class="stat"><b>${valid.length}</b><span>Notas emitidas${notasDesde ? ` (${NOTAS_DIAS} días)` : ""}</span></div>
      ${puede("estadisticas.ver") ? `<div class="stat"><b>${money(valid.reduce((a, n) => a + n2(n.total), 0))}</b><span>Total vendido${notasDesde ? ` (${NOTAS_DIAS} días)` : ""}</span></div>` : ""}
    </div>
    ${notasAviso()}
    <div class="notes">
      <div>
        <div class="toolbar"><input class="grow" type="search" id="notesSearch" placeholder="Buscar por folio, cliente o producto" value="${esc(notesQ)}"></div>
        ${!S.loaded ? `<div class="empty">Cargando notas…</div>` : !notes.length ? `<div class="empty"><h2>Aún no hay notas</h2><p>Crea una en <b>Nueva venta</b>. Cada nota emitida descuenta los productos del inventario.</p></div>` :
          `<div class="list">${list.slice(0, notasLimite).map(n => `<button class="nrow ${n.estado === "anulada" ? "voided" : ""}" data-note="${esc(n.id)}" aria-current="${n.id === S.selNote}">
            <span class="fol">${folioTxt(n.folio)}</span>
            <span class="who">${esc(n.cliente || "Público en general")}<small>${fmtDate(n.fecha)} · ${n.items.length} ${n.items.length === 1 ? "ítem" : "ítems"}${n.pago ? " · " + esc(n.pago) : ""}${n.estado === "anulada" ? " · anulada" : ""}</small></span>
            <span class="amt num">${money(n.total)}</span></button>`).join("") || `<div class="empty">Ninguna nota coincide.</div>`}</div>`}
        ${list.length > notasLimite ? `<div class="inv-mas" style="margin:10px 0 0"><span class="muted">Se muestran ${notasLimite} de ${list.length} notas.</span><button class="btn" id="n-mas">Ver más</button></div>` : ""}
        ${notasDesde ? `<div class="inv-mas" style="margin:10px 0 0"><span class="muted">Se ven las notas de los últimos ${NOTAS_DIAS} días.</span><button class="btn" id="n-todas">Ver todas las notas</button></div>` : ""}
      </div>
      <div style="display:flex;flex-direction:column">
        ${sel ? ticketHtml(sel) + `<div class="ticket-actions">
            <button class="btn primary" id="n-print" ${puede("nota.imprimir") ? "" : "hidden"}>Imprimir ticket</button>
            <button class="btn" id="n-copy" ${puede("nota.imprimir") ? "" : "hidden"}>Copiar texto</button>
            <button class="btn" id="n-dl" ${puede("nota.imprimir") ? "" : "hidden"}>Descargar .txt</button>
            ${sel.estado !== "anulada" && puede("nota.anular") ? `<button class="btn danger" id="n-void">Anular y devolver stock</button>` : ""}
          </div>` : ""}
      </div>
    </div>`;
  if (focusId === "notesSearch") { const i = $("#notesSearch"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}
$("#v-notas").addEventListener("input", e => { if (e.target.id === "notesSearch") { notesQ = e.target.value; notasLimite = NOTAS_PAGINA; renderNotas(); } });
$("#v-notas").addEventListener("click", async e => {
  const t = e.target.closest("button"); if (!t) return;
  const sel = S.notes.find(n => n.id === S.selNote);
  if (t.id === "n-mas") { notasLimite += NOTAS_PAGINA; return renderNotas(); }
  if (t.id === "n-todas") return notasAsegurar(null);
  if (t.dataset.note) { S.selNote = t.dataset.note; return renderNotas(); }
  if ((t.id === "n-copy" || t.id === "n-print" || t.id === "n-dl") && !exigir("nota.imprimir", "imprimir notas")) return;
  if (t.id === "n-copy" && sel) {
    const txt = ticketText(sel);
    try { await navigator.clipboard.writeText(txt); toast("Nota copiada"); }
    catch { const ta = document.createElement("textarea"); ta.value = txt; document.body.append(ta); ta.select(); try { document.execCommand("copy"); toast("Nota copiada"); } catch { toast("Selecciona y copia el texto manualmente"); } ta.remove(); }
    return;
  }
  if (t.id === "n-print" && sel) {
    if (canPrintLocally()) printLocal(sel, t);
    else await saveFile(folioTxt(sel.folio) + "-ticket.html", printHtml(sel));
    return;
  }
  if (t.id === "n-dl" && sel) return saveFile(folioTxt(sel.folio) + ".txt", ticketText(sel));
  if (t.id === "n-void" && sel) {
    if (!exigir("nota.anular", "anular notas")) return;
    if (!t.classList.contains("armed")) { t.classList.add("armed"); t.textContent = "Confirmar anulación"; return; }
    t.disabled = true;
    try {
      await flushPendingStock();
      if (usaTransacciones()) await fbMovimiento({ deltas: deltasDe(sel.items, +1), anular: sel });
      else {
        const changed = await adjustStock(sel.items, +1);
        try { await putNote({ ...sel, items: sel.items.map(i => ({ ...i })), estado: "anulada", anulada: new Date().toISOString() }); }
        catch (err) {
          await restoreProducts(changed);
          try { await putNote(sel); } catch {}
          throw err;
        }
      }
      toast("Nota anulada; el stock se devolvió al inventario");
    } catch (err) { toast(err.aviso || "No se pudo anular; no se cambió nada. " + failMsg(err)); t.disabled = false; }
  }
});

