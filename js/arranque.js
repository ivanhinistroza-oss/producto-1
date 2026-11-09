// ---------- arranque ----------
S.group = store.get("mostrador.group") || "categoria";
const h = (location.hash || "").slice(1);
if (VIEWS.includes(h)) S.view = h;
renderLogin();

(async () => {
  if (fbMode) return iniciarFirebase();
  const c = window.claude;
  const [d, dl] = c && c.use ? await Promise.all([c.use("db").catch(() => null), c.use("downloads").catch(() => null)]) : [null, null];
  db = d; downloads = dl;
  if (!db) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem("mostrador.data") || "null"); } catch {}
    if (saved) {
      mem.products = new Map((saved.products || []).filter(p => p && p.id).map(p => [p.id, p]));
      mem.notes = new Map((saved.notes || []).filter(n => n && n.id).map(n => [n.id, n]));
      mem.users = new Map((saved.users || []).filter(u => u && u.id).map(u => [u.id, u]));
      mem.quotes = new Map((saved.quotes || []).filter(q => q && q.id).map(q => [q.id, q]));
      mem.cajas = new Map((saved.cajas || []).filter(x => x && x.id).map(x => [x.id, x]));
      if (saved.settings) S.settings = { ...S.settings, ...saved.settings };
      syncMem();
    }
    S.loaded = true;
    try { sessionId = sessionStorage.getItem("mostrador.session"); } catch {}
    if (usuarioActual()) renderApp(); else renderLogin();
    const b = $("#banner");
    b.textContent = "Tus datos se guardan en este navegador. Exporta copias periódicas para respaldarlos.";
    b.hidden = false;
    return renderAll();
  }
  escucharDatos();
})();
// escucha productos, notas, ajustes y usuarios del almacén (db de claude.ai o negocio de Firebase)
function escucharDatos() {
  let gotP = false, gotN = false, gotU = false;
  const ready = () => {
    if (!(gotP && gotN && gotU)) return;
    const first = !S.loaded;
    S.loaded = true;
    if (!fbMode) { try { sessionId = sessionStorage.getItem("mostrador.session"); } catch {} }
    if (usuarioActual()) { if (first || $("#authScreen")) renderApp(); else { aplicarPermisosUI(); renderAll(); } }
    else if (fbMode) fbSinAcceso();
    else renderLogin();
    if (first && fbMode) setTimeout(nombresReservarExistentes, 4000);
  };
  const sinPermiso = e => fbMode && e && e.code === "permission-denied" && fbSinAcceso();
  db.collection("products").onSnapshot(snap => {
    S.products = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .map(p => {
        // conserva el conteo local mientras haya un guardado pendiente del producto o de una de sus variantes
        const pending = pendingStock.has(p.id) || [...pendingStock.keys()].some(k => k.startsWith(p.id + ":"));
        const local = pending && S.products.find(x => x.id === p.id);
        return local ? { ...p, stock: local.stock, ...(local.variantes ? { variantes: local.variantes } : {}) } : p;
      });
    simCache.clear(); gotP = true; ready();
    if (fbMode) webSync();
    // no redibujar mientras se escribe en el stock de una fila
    const a = document.activeElement;
    if (S.view === "inventario" && a && a.dataset && a.dataset.stk) return;
    if (dlg.open && S.view === "inventario") return;
    renderAll();
  }, e => { if (sinPermiso(e)) return; $("#banner").textContent = "Se perdió la conexión con el almacén. Recarga la página."; $("#banner").hidden = false; });
  if (db.notesDesde) {
    const notasDb = db;
    let notasCortar = null;
    notasEscuchar = desde => {
      if (db !== notasDb) return;
      if (notasCortar) notasCortar();
      notasDesde = desde;
      notasDeCache = true;
      const primera = !gotN;
      notasCortar = db.notesDesde(desde, snap => {
        const cambio = notasDeCache !== snap.fromCache;
        notasDeCache = snap.fromCache;
        S.notes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const antes = gotN;
        gotN = true; ready();
        if (snap.cambios || cambio || !antes) renderAll();
      }, sinPermiso);
      if (!primera) renderAll();
    };
    const corte = new Date();
    corte.setDate(corte.getDate() - NOTAS_DIAS);
    notasInicio = corte.toISOString();
    notasEscuchar(notasInicio);
    // el número de la próxima nota no depende de cuántas se hayan descargado
    db.lastNotes().then(r => { notasFolioMax = r[0] ? n2(r[0].folio) : 0; if (S.view === "venta") renderAll(); }).catch(() => {});
    // cambios de stock por talla que quedaron pendientes de una venta o conteo sin internet
    setTimeout(stockPendienteEnviar, 3000);
  } else db.collection("notes").onSnapshot(snap => {
    S.notes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    gotN = true; ready(); renderAll();
  }, sinPermiso);
  // las cotizaciones no detienen la app: si las reglas de Firebase aún no las permiten, solo se avisa
  const quotesDb = db;
  const escucharCotizaciones = () => db.collection("quotes").onSnapshot(snap => {
    S.quotes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    quotesBlocked = false;
    if (S.view === "cotizaciones" || S.view === "reportes") renderAll();
  }, e => {
    quotesBlocked = !!(e && e.code === "permission-denied");
    if (S.view === "cotizaciones") renderAll();
    // tras un error Firebase deja de avisar cambios: se vuelve a escuchar (por ejemplo, después de publicar las reglas)
    setTimeout(() => { if (db === quotesDb) escucharCotizaciones(); }, 10000);
  });
  escucharCotizaciones();
  // la caja tampoco detiene la app: sin las reglas nuevas se sigue vendiendo y solo se avisa en la vista Caja
  const cajasDb = db;
  const cajasLlegan = snap => {
    S.cajas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cajasBlocked = false;
    if (S.view === "caja" || S.view === "venta") renderAll();
  };
  const cajasFallan = e => {
    cajasBlocked = !!(e && e.code === "permission-denied");
    if (S.view === "caja") renderAll();
    setTimeout(() => { if (db === cajasDb) escucharCajas(); }, 10000);
  };
  const escucharCajas = () => db.cajasRecientes ? db.cajasRecientes(cajasLlegan, cajasFallan) : db.collection("cajas").onSnapshot(cajasLlegan, cajasFallan);
  escucharCajas();
  db.doc("settings/app").onSnapshot(s => { if (s.exists) { S.settings = { negocio: "Mi negocio", moneda: "S/", ...s.data() }; if (fbMode) webSync(); renderAll(); } }, () => {});
  if (fbMode) {
    db.collection("miembros").onSnapshot(snap => {
      S.users = snap.docs.map(d => ({ id: d.id, usuario: d.data().email, ...d.data() }));
      gotU = true; ready();
    }, sinPermiso);
  } else {
    db.doc("settings/users").onSnapshot(s => { S.users = s.exists ? (s.data().list || []) : []; gotU = true; ready(); }, () => { gotU = true; ready(); });
  }
}
// ---------- instalación PWA ----------
let installPrompt = null;
const installButton = $("#installApp");
const isInstalled = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
if (installButton) {
  const updateInstallButton = () => { installButton.hidden = isInstalled() || !installPrompt; };
  updateInstallButton();
  window.addEventListener("beforeinstallprompt", event => {
    if (isInstalled()) return;
    event.preventDefault();
    installPrompt = event;
    updateInstallButton();
  });
  window.addEventListener("appinstalled", () => { installPrompt = null; updateInstallButton(); });
  installButton.addEventListener("click", async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    updateInstallButton();
    try { await prompt.prompt(); } catch {}
  });
}
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
// en iPhone no hay botón de instalar: se indica una sola vez cómo hacerlo
if (isIOS && isSafari && !isInstalled() && /^https?:$/.test(location.protocol) && !window.claude && !store.get("mostrador.iosHint")) {
  store.set("mostrador.iosHint", true);
  setTimeout(() => toast("Para instalar: Compartir → Agregar a pantalla de inicio"), 1200);
}
try {
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !window.claude) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
} catch {}
