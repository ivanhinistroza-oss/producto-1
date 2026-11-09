const VIEWS = ["inventario", "venta", "notas", "caja", "cotizaciones", "ventas", "reportes", "resumen", "usuarios", "config"];
function go(view) {
  const needed = view === "ventas" || view === "resumen" || view === "reportes" ? "estadisticas.ver"
    : view === "usuarios" ? "usuarios.gestionar" : view === "config" ? "ajustes.editar" : view === "cotizaciones" ? "cotizacion.ver" : view === "caja" ? "caja.usar" : null;
  if (needed && !exigir(needed, "abrir " + view)) view = "inventario";
  if (!puede("inventario.ver") && view === "inventario") return;
  S.view = view;
  configDraft = null; // lo no guardado en Configuración se descarta al cambiar de vista
  document.querySelectorAll("nav.tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.view === view));
  $("#mobileTitle").textContent = mobileViewTitles[view] || "Mostrador";
  setMobileMenu(false);
  VIEWS.forEach(v => $("#v-" + v).hidden = v !== view);
  try { history.replaceState(null, "", "#" + view); } catch {}
  renderAll();
  window.scrollTo({ top: 0 });
}
function renderAll() {
  $("#bizName").textContent = S.settings.negocio;
  if (S.view === "inventario") renderInventario();
  else if (S.view === "venta") renderVenta();
  else if (S.view === "resumen") renderResumen();
  else if (S.view === "ventas") renderVentas();
  else if (S.view === "cotizaciones") renderCotizaciones();
  else if (S.view === "caja") renderCaja();
  else if (S.view === "reportes") renderReportes();
  else if (S.view === "usuarios") renderUsuarios();
  else if (S.view === "config") renderConfig();
  else renderNotas();
}

