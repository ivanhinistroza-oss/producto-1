// ---------- caja: apertura y cierre ----------
// Una sola caja abierta por negocio. Compara el efectivo esperado (monto inicial + ventas en efectivo
// desde la apertura) con el contado. Yape, Plin, tarjeta y transferencia se informan, pero no entran al efectivo.
let cajaForm = { inicial: "", contado: "", obs: "" }, cajasBlocked = false;
const cajaAbierta = () => S.cajas.filter(c => c.estado === "abierta").sort((a, b) => String(b.abiertaEn).localeCompare(String(a.abiertaEn)))[0] || null;
const cajasCerradas = () => S.cajas.filter(c => c.estado === "cerrada").sort((a, b) => String(b.cerradaEn).localeCompare(String(a.cerradaEn)));
// acepta 150, 150.50 o 150,50; lo demás (como 1,200) se rechaza para no leer mal el monto
function cajaMonto(txt) {
  const t = String(txt || "").trim().replace(",", ".");
  return /^\d+(\.\d{1,2})?$/.test(t) ? round2(t) : null;
}
function cajaResumen(c) {
  const notes = S.notes.filter(n => String(n.fecha) >= c.abiertaEn);
  const ok = notes.filter(n => n.estado !== "anulada");
  const pagos = pagoResumen(notes);
  const efectivo = pagos.find(d => d.label === PAGO_INICIAL)?.total || 0;
  return {
    pagos, efectivo, esperado: round2(n2(c.montoInicial) + efectivo),
    ventasCount: ok.length, ventasTotal: round2(ok.reduce((a, n) => a + n2(n.total), 0)), anuladas: notes.length - ok.length,
  };
}
function cajaDifTxt(d) {
  d = round2(d);
  return d === 0 ? "Cuadra" : d < 0 ? "Faltan " + money(-d) : "Sobran " + money(d);
}
function cajaTicketHtml(c) {
  const tr = (a, b, cls = "") => `<div class="tr ${cls}"><span>${esc(a)}</span><span>${esc(b)}</span></div>`;
  return `<div class="ticket">
    <div class="c biz">${esc(S.settings.negocio)}</div>
    <div class="c"><b>CIERRE DE CAJA</b></div><hr>
    ${tr("Apertura", fmtDate(c.abiertaEn))}${tr("Abrió", c.abiertaPorNombre || "")}
    ${tr("Cierre", fmtDate(c.cerradaEn))}${tr("Cerró", c.cerradaPorNombre || "")}<hr>
    ${tr("Monto inicial", money(c.montoInicial))}${tr("Ventas en efectivo", money(c.efectivo))}
    ${tr("Efectivo esperado", money(c.esperado))}${tr("Efectivo contado", money(c.contado))}
    ${tr(n2(c.diferencia) === 0 ? "Diferencia" : n2(c.diferencia) < 0 ? "Faltante" : "Sobrante", money(Math.abs(n2(c.diferencia))), "tot")}<hr>
    <div><b>Ventas por medio de pago</b></div>
    ${(c.pagos || []).map(d => tr(d.label + " (" + d.count + ")", money(d.total))).join("") || `<div>Sin ventas</div>`}
    ${tr("Total vendido", money(c.ventasTotal))}
    ${c.anuladas ? tr("Notas anuladas", String(c.anuladas)) : ""}
    ${c.obsCierre ? `<hr><div class="wrap">Obs.: ${esc(c.obsCierre)}</div>` : ""}
  </div>`;
}
// copia de seguridad: en Firebase solo se escuchan los últimos cierres; si las reglas aún no lo permiten, no bloquea la copia
async function cajasCompletas() {
  if (!db || !db.cajasServidor || cajasBlocked) return S.cajas;
  const snap = await db.cajasServidor();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function putCaja(c) {
  const body = { ...c }; delete body.id;
  if (db) await db.collection("cajas").doc(c.id).set(body);
  else { mem.cajas.set(c.id, { ...c }); syncMem(); }
}
async function patchCaja(id, patch) {
  if (db) await db.collection("cajas").doc(id).update(patch);
  else { const c = mem.cajas.get(id); if (c) Object.assign(c, patch); syncMem(); }
}
function renderCaja() {
  if (!exigir("caja.usar", "usar la caja")) return;
  // con Firebase solo se escuchan las notas recientes: una caja abierta hace muchos días necesita las suyas
  const abiertaAntes = cajaAbierta();
  if (abiertaAntes) notasAsegurar(new Date(abiertaAntes.abiertaEn));
  const el = $("#v-caja");
  const focusId = document.activeElement && document.activeElement.id;
  const caret = focusId && document.activeElement.selectionStart;
  const abierta = cajaAbierta(), cerradas = cajasCerradas(), ultimo = cerradas[0], ver = puede("caja.ver");
  const res = abierta && cajaResumen(abierta);
  const deOtroDia = abierta && new Date(abierta.abiertaEn).toDateString() !== new Date().toDateString();
  const panel = abierta ? `
      <div class="panel">
        <h2>Cerrar caja</h2>
        ${navigator.onLine === false ? `<p class="banner">Sin conexión: este cierre solo cuenta las ventas guardadas en este equipo.</p>` : ""}
        ${deOtroDia ? `<p class="banner">Esta caja sigue abierta desde otro día. Ciérrala para empezar la jornada con el monto correcto.</p>` : ""}
        <div class="stats caja-stats">
          <div class="stat"><b class="num">${money(abierta.montoInicial)}</b><span>Monto inicial</span></div>
          <div class="stat"><b>${fmtDate(abierta.abiertaEn)}</b><span>Abrió ${esc(abierta.abiertaPorNombre || "")}</span></div>
          <div class="stat"><b>${res.ventasCount}</b><span>Ventas desde la apertura</span></div>
        </div>
        ${ver ? `<div class="caja-lines">
          ${res.pagos.map(d => `<div class="tr"><span>${esc(d.label)} (${d.count})</span><span class="num">${money(d.total)}</span></div>`).join("") || `<p class="muted">Aún no hay ventas en esta caja.</p>`}
          <div class="tr caja-total"><span>Efectivo esperado en caja</span><span class="num">${money(res.esperado)}</span></div>
        </div>` : `<p class="muted">Cuenta el efectivo de la caja y escribe el total. El resultado aparece al cerrar.</p>`}
        <label class="f"><span>Efectivo contado</span><input type="text" inputmode="decimal" id="c-contado" value="${esc(cajaForm.contado)}" placeholder="0.00" autocomplete="off"></label>
        ${ver ? `<p class="muted" id="c-dif" aria-live="polite"></p>` : ""}
        <label class="f"><span>Observaciones</span><textarea id="c-obs" rows="2" placeholder="Opcional">${esc(cajaForm.obs)}</textarea></label>
        <div class="caja-actions"><button class="btn primary" id="c-cerrar">Cerrar caja</button></div>
      </div>` : `
      <div class="panel">
        <h2>Abrir caja</h2>
        <p class="muted">Cuenta el efectivo con el que empiezas, por ejemplo el sencillo para dar vuelto.</p>
        <label class="f"><span>Monto inicial en efectivo</span><input type="text" inputmode="decimal" id="c-inicial" value="${esc(cajaForm.inicial)}" placeholder="0.00" autocomplete="off"></label>
        <div class="caja-actions"><button class="btn primary" id="c-abrir">Abrir caja</button></div>
      </div>`;
  el.innerHTML = `
    <div class="toolbar"><h1 style="margin-right:auto">Caja</h1><span class="chip ${abierta ? "ex" : ""}">${abierta ? "Abierta" : "Cerrada"}</span></div>
    ${cajasBlocked ? `<p class="banner">Para guardar la caja falta actualizar las reglas de Firebase: copia el archivo <b>firestore.rules</b> en Firestore → Reglas → Publicar.</p>` : ""}
    ${notasAviso()}
    <div class="caja-grid">
      ${panel}
      ${ultimo ? `<div class="caja-last"><h2>Último cierre</h2>${cajaTicketHtml(ultimo)}<div class="ticket-actions"><button class="btn" data-caja-print="${esc(ultimo.id)}">Imprimir cierre</button></div></div>` : ""}
    </div>
    ${ver && cerradas.length ? `<h2 class="caja-hist">Cierres anteriores</h2><div class="summary-table-wrap"><table class="user-table caja-tabla">
      <thead><tr><th>Cierre</th><th>Cerró</th><th class="num">Esperado</th><th class="num">Contado</th><th>Resultado</th><th></th></tr></thead>
      <tbody>${cerradas.slice(0, 30).map(c => `<tr><td>${fmtDate(c.cerradaEn)}</td><td>${esc(c.cerradaPorNombre || "")}</td><td class="num">${money(c.esperado)}</td><td class="num">${money(c.contado)}</td>
        <td><span class="chip ${n2(c.diferencia) === 0 ? "ex" : n2(c.diferencia) < 0 ? "out" : "low"}">${esc(cajaDifTxt(c.diferencia))}</span></td>
        <td><button class="btn" data-caja-print="${esc(c.id)}">Imprimir</button></td></tr>`).join("")}</tbody>
    </table></div>${cerradas.length > 30 ? `<p class="muted">Se muestran los últimos 30 cierres.</p>` : ""}` : ""}`;
  cajaDifActualizar(res);
  if (focusId === "c-contado" || focusId === "c-inicial" || focusId === "c-obs") {
    const i = $("#" + focusId);
    if (i) { i.focus(); i.setSelectionRange(caret, caret); }
  }
}
function cajaDifActualizar(res) {
  const out = $("#c-dif"); if (!out || !res) return;
  const contado = cajaMonto(cajaForm.contado);
  out.textContent = contado === null ? "" : cajaDifTxt(contado - res.esperado);
}
$("#v-caja").addEventListener("input", e => {
  const id = e.target.id;
  if (id === "c-inicial") cajaForm.inicial = e.target.value;
  else if (id === "c-obs") cajaForm.obs = e.target.value;
  else if (id === "c-contado") {
    cajaForm.contado = e.target.value;
    const abierta = cajaAbierta();
    if (abierta) cajaDifActualizar(cajaResumen(abierta));
  }
});
$("#v-caja").addEventListener("click", async e => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.cajaPrint) {
    const c = S.cajas.find(x => x.id === t.dataset.cajaPrint); if (!c) return;
    if (canPrintLocally()) printFrame(printHtml(null, false, cajaTicketHtml(c)), (S.settings.papel === "58" ? 58 : 80) + "mm", t);
    else await saveFile("cierre-caja-" + isoDay(new Date(c.cerradaEn)) + ".html", printHtml(null, true, cajaTicketHtml(c)));
    return;
  }
  if (t.id !== "c-abrir" && t.id !== "c-cerrar") return;
  if (!exigir("caja.usar", "usar la caja")) return;
  const user = usuarioActual();
  if (t.id === "c-abrir") {
    if (cajaAbierta()) return toast("Ya hay una caja abierta");
    const monto = cajaMonto(cajaForm.inicial);
    if (monto === null) return toast("Escribe el monto inicial, por ejemplo 150.50");
    t.disabled = true;
    try {
      await putCaja({ id: uid(), estado: "abierta", abiertaEn: new Date().toISOString(), abiertaPorId: user.id, abiertaPorNombre: user.nombre || "", montoInicial: monto });
      cajaForm.inicial = "";
      toast("Caja abierta con " + money(monto));
      renderAll();
    } catch (err) { t.disabled = false; toast(failMsg(err)); }
    return;
  }
  const abierta = cajaAbierta(); if (!abierta) return;
  const contado = cajaMonto(cajaForm.contado);
  if (contado === null) return toast("Escribe el efectivo contado, por ejemplo 150.50");
  if (notasEscuchar && notasDesde !== notasInicio && notasDeCache) return toast("Faltan ventas por cargar. Inténtalo cuando haya internet.");
  if (!confirm("¿Cerrar la caja con " + money(contado) + " contados? Después no se puede reabrir.")) return;
  t.disabled = true;
  const cerradaEn = new Date().toISOString(), res = cajaResumen(abierta), diferencia = round2(contado - res.esperado);
  try {
    await patchCaja(abierta.id, {
      estado: "cerrada", cerradaEn, cerradaPorId: user.id, cerradaPorNombre: user.nombre || "", contado, diferencia,
      esperado: res.esperado, efectivo: res.efectivo, ventasTotal: res.ventasTotal, ventasCount: res.ventasCount,
      anuladas: res.anuladas, pagos: res.pagos, obsCierre: cajaForm.obs.trim(),
    });
    cajaForm.contado = ""; cajaForm.obs = "";
    toast("Caja cerrada. " + cajaDifTxt(diferencia));
    renderAll();
  } catch (err) { t.disabled = false; toast(failMsg(err)); }
});


