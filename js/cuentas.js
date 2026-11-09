function fbError(e) {
  const c = String(e && e.code || "");
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return "Correo o contraseña incorrectos.";
  if (c.includes("email-already-in-use")) return "Ese correo ya tiene cuenta. Usa Entrar.";
  if (c.includes("weak-password")) return "La contraseña debe tener al menos 6 caracteres.";
  if (c.includes("invalid-email")) return "Ese correo no es válido.";
  if (c.includes("too-many-requests")) return "Demasiados intentos. Espera unos minutos.";
  if (c.includes("network") || c.includes("unavailable")) return "Sin conexión. Revisa tu internet.";
  if (c.includes("permission-denied")) return "No tienes permiso para esto.";
  return "Algo falló. Inténtalo otra vez.";
}
function fbPantalla(html) {
  document.querySelector("header.top").hidden = true;
  document.querySelector("main.wrap").hidden = true;
  let el = $("#authScreen");
  if (!el) {
    el = document.createElement("div");
    el.id = "authScreen";
    el.className = "auth-screen";
    document.body.append(el);
  }
  el.innerHTML = html;
  return el;
}
function fbCargando(texto = "Cargando…") {
  fbPantalla('<div class="auth-card"><p class="muted">' + esc(texto) + "</p></div>");
}

function renderFbLogin(modo = "entrar", error = "", email = "", aviso = "") {
  const crear = modo === "crear";
  fbPantalla(`<form class="auth-card" id="fbAuth">
    <h1>${crear ? "Crear cuenta" : "Entrar a Mostrador"}</h1>
    ${crear ? '<label class="f"><span>Tu nombre</span><input name="nombre" autocomplete="name" required></label>' : ""}
    <label class="f"><span>Correo</span><input name="email" type="email" autocomplete="email" value="${esc(email)}" required></label>
    <label class="f"><span>Contraseña</span><input name="clave" type="password" minlength="6" autocomplete="${crear ? "new-password" : "current-password"}" required></label>
    ${crear ? '<label class="f"><span>Repite la contraseña</span><input name="clave2" type="password" minlength="6" autocomplete="new-password" required></label>' : ""}
    ${aviso ? `<p class="muted">${esc(aviso)}</p>` : ""}
    <p class="warnline">${esc(error)}</p>
    <button class="btn primary" type="submit">${crear ? "Crear cuenta" : "Entrar"}</button>
    <button class="btn" type="button" id="fbSwitch">${crear ? "Ya tengo cuenta" : "Crear cuenta nueva"}</button>
    ${crear ? "" : '<button class="btn ghost" type="button" id="fbReset">Olvidé mi contraseña</button>'}
  </form>`);
  const form = $("#fbAuth");
  $("#fbSwitch").onclick = () => renderFbLogin(crear ? "entrar" : "crear", "", form.email.value);
  if (!crear) $("#fbReset").onclick = async () => {
    const correo = form.email.value.trim();
    if (!correo) return renderFbLogin("entrar", "Escribe tu correo y vuelve a pulsar «Olvidé mi contraseña».");
    try {
      await fb.A.sendPasswordResetEmail(fb.auth, correo);
      renderFbLogin("entrar", "", correo, "Si ese correo tiene cuenta, te llegó un mensaje para crear una contraseña nueva. Revisa también Spam.");
    } catch (e) { renderFbLogin("entrar", fbError(e), correo); }
  };
  form.onsubmit = async e => {
    e.preventDefault();
    const d = new FormData(form);
    const correo = String(d.get("email")).trim(), clave = String(d.get("clave"));
    form.querySelector('[type="submit"]').disabled = true;
    try {
      if (crear) {
        if (clave !== d.get("clave2")) return renderFbLogin("crear", "Las contraseñas no coinciden.", correo);
        fbNombrePendiente = String(d.get("nombre")).trim();
        const cred = await fb.A.createUserWithEmailAndPassword(fb.auth, correo, clave);
        await fb.A.updateProfile(cred.user, { displayName: fbNombrePendiente }).catch(() => {});
      } else {
        await fb.A.signInWithEmailAndPassword(fb.auth, correo, clave);
      }
      // onAuthStateChanged sigue desde aquí
    } catch (err) { renderFbLogin(modo, fbError(err), correo); }
  };
}

function datosLocales() {
  try {
    const d = JSON.parse(localStorage.getItem("mostrador.data") || "null");
    if (d && ((d.products || []).length || (d.notes || []).length)) return d;
  } catch {}
  return null;
}
function renderFbNegocio(error = "") {
  const user = fb.auth.currentUser;
  const local = datosLocales();
  fbPantalla(`<div class="auth-card">
    <h1>Tu negocio</h1>
    <p class="muted">Entraste como ${esc(user.email)}</p>
    ${error ? `<p class="warnline" role="alert">${esc(error)}</p>` : ""}
    <form id="fbCrear" class="f-stack">
      <h2>Crear mi negocio</h2>
      <label class="f"><span>Nombre del negocio</span><input name="negocio" required value="${esc(local?.settings?.negocio && local.settings.negocio !== "Mi negocio" ? local.settings.negocio : "")}"></label>
      ${local ? `<label class="check"><input type="checkbox" name="copiar" checked> Copiar lo que ya tengo en este equipo (${(local.products || []).length} productos y ${(local.notes || []).length} notas)</label>` : ""}
      <button class="btn primary" type="submit">Crear negocio</button>
    </form>
    <hr class="auth-sep">
    <form id="fbUnirme" class="f-stack">
      <h2>Unirme con un código</h2>
      <p class="muted">Pídele el código al administrador del negocio.</p>
      <label class="f"><span>Código</span><input name="codigo" required autocomplete="off" autocapitalize="characters" placeholder="ABCD-2345"></label>
      <button class="btn" type="submit">Unirme</button>
    </form>
    <button class="btn ghost" type="button" id="fbSalir">Cerrar sesión</button>
  </div>`);
  $("#fbSalir").onclick = () => fb.A.signOut(fb.auth);
  $("#fbCrear").onsubmit = async e => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    if (!navigator.onLine) return renderFbNegocio("Necesitas internet para crear tu negocio.");
    fbCargando("Creando tu negocio…");
    try { await crearNegocio(String(d.get("negocio")).trim(), d.get("copiar") ? local : null); }
    catch (err) { renderFbNegocio(fbError(err)); }
  };
  $("#fbUnirme").onsubmit = async e => {
    e.preventDefault();
    const codigo = String(new FormData(e.currentTarget).get("codigo")).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!navigator.onLine) return renderFbNegocio("Necesitas internet para unirte.");
    fbCargando("Revisando el código…");
    try { await unirmeConCodigo(codigo); }
    catch (err) { renderFbNegocio(err.message && !err.code ? err.message : fbError(err)); }
  };
}
function fbNombreUsuario(user) {
  return user.displayName || fbNombrePendiente || user.email.split("@")[0];
}
async function crearNegocio(nombre, local) {
  const { F, fs } = fb, user = fb.auth.currentUser;
  const nid = F.doc(F.collection(fs, "negocios")).id;
  const batch = F.writeBatch(fs);
  batch.set(F.doc(fs, "negocios/" + nid), { nombre, dueno: user.uid, creado: F.serverTimestamp() });
  batch.set(F.doc(fs, "negocios/" + nid + "/miembros/" + user.uid), {
    nombre: fbNombreUsuario(user), email: user.email, rol: "admin", activo: true, unido: F.serverTimestamp(),
  });
  batch.set(F.doc(fs, "usuarios/" + user.uid), { negocioId: nid, email: user.email });
  await batch.commit();
  // va aparte: las reglas exigen que ya exista el administrador
  const ajustes = { moneda: "S/", papel: "80", ...(local?.settings || {}), negocio: nombre };
  await F.setDoc(F.doc(fs, "negocios/" + nid + "/settings/app"), ajustes);
  if (local) await copiarDatosLocales(nid, local);
  await abrirNegocio(nid);
}
async function copiarDatosLocales(nid, local) {
  const { F, fs } = fb;
  const docs = [
    ...(local.products || []).filter(p => p && p.id).map(p => ["products", p]),
    ...(local.notes || []).filter(n => n && n.id).map(n => ["notes", n]),
    ...(local.quotes || []).filter(q => q && q.id).map(q => ["quotes", q]),
    ...(local.cajas || []).filter(x => x && x.id).map(x => ["cajas", x]),
  ];
  // un lote de Firestore admite hasta 500 escrituras
  for (let i = 0; i < docs.length; i += 400) {
    fbCargando("Copiando tus datos… " + Math.min(i + 400, docs.length) + " de " + docs.length);
    const batch = F.writeBatch(fs);
    docs.slice(i, i + 400).forEach(([col, item]) => {
      const body = { ...item }; delete body.id;
      batch.set(F.doc(fs, "negocios/" + nid + "/" + col + "/" + item.id), body);
    });
    await batch.commit();
  }
}
async function unirmeConCodigo(codigo) {
  const { F, fs } = fb, user = fb.auth.currentUser;
  if (codigo.length !== 8) throw new Error("El código tiene 8 letras y números, por ejemplo ABCD-2345.");
  const invRef = F.doc(fs, "invitaciones/" + codigo);
  const inv = await F.getDoc(invRef);
  if (!inv.exists()) throw new Error("Ese código no existe. Revisa que esté bien escrito.");
  const d = inv.data();
  if (d.usadoPor && d.usadoPor !== user.uid) throw new Error("Ese código ya se usó. Pide uno nuevo.");
  if (d.expira.toMillis() < Date.now()) throw new Error("Ese código venció. Pide uno nuevo.");
  const batch = F.writeBatch(fs);
  if (!d.usadoPor) batch.update(invRef, { usadoPor: user.uid });
  batch.set(F.doc(fs, "negocios/" + d.negocioId + "/miembros/" + user.uid), {
    nombre: fbNombreUsuario(user), email: user.email, rol: d.rol, activo: true, codigo, unido: F.serverTimestamp(),
  });
  batch.set(F.doc(fs, "usuarios/" + user.uid), { negocioId: d.negocioId, email: user.email });
  await batch.commit();
  await abrirNegocio(d.negocioId);
}
async function fbEntrar(user) {
  fbCargando("Cargando tu negocio…");
  const { F, fs } = fb;
  try {
    const perfil = await F.getDoc(F.doc(fs, "usuarios/" + user.uid));
    const nid = perfil.exists() ? perfil.data().negocioId : null;
    if (!nid) return renderFbNegocio();
    const miembro = await F.getDoc(F.doc(fs, "negocios/" + nid + "/miembros/" + user.uid));
    if (!miembro.exists()) return renderFbNegocio();
    if (!miembro.data().activo) return renderFbNegocio("Tu acceso a ese negocio está desactivado. Habla con el administrador, o crea o únete a otro negocio.");
    await abrirNegocio(nid);
  } catch (err) {
    renderFbNegocio(fbError(err));
  }
}
function fbSinAcceso() {
  if (!fb || !fb.negocioId) return;
  fbDetener();
  renderFbNegocio("Tu acceso a ese negocio fue desactivado. Habla con el administrador.");
}
async function abrirNegocio(nid) {
  const { F, fs } = fb, user = fb.auth.currentUser;
  fbCargando("Cargando tu negocio…");
  fb.negocioId = nid;
  try { fb.dueno = (await F.getDoc(F.doc(fs, "negocios/" + nid))).data()?.dueno || null; } catch {}
  db = fbDb(nid);
  sessionId = user.uid;
  escucharDatos();
  mostrarConexion();
}
function mostrarConexion() {
  const b = $("#banner");
  b.textContent = navigator.onLine ? "" : "Sin internet: las ventas se guardan en este equipo y se envían solas cuando vuelva la conexión.";
  b.hidden = navigator.onLine;
}
window.addEventListener("online", () => { if (fbMode && db) mostrarConexion(); });
window.addEventListener("offline", () => { if (fbMode && db) mostrarConexion(); });

async function iniciarFirebase() {
  fbCargando();
  try { fb = await cargarFirebase(); }
  catch {
    fbPantalla('<div class="auth-card"><h1>Sin conexión</h1><p class="muted">La primera vez que abres Mostrador en este equipo necesitas internet. Conéctate y recarga la página.</p><button class="btn primary" onclick="location.reload()">Reintentar</button></div>');
    return;
  }
  fb.A.onAuthStateChanged(fb.auth, user => {
    fbDetener();
    if (user) fbEntrar(user);
    else renderFbLogin();
  });
}

// ---------- usuarios con Firebase ----------
const INVITE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function nuevoCodigo() {
  return [...crypto.getRandomValues(new Uint8Array(8))].map(b => INVITE_CHARS[b % INVITE_CHARS.length]).join("");
}
const codigoTxt = c => c.slice(0, 4) + "-" + c.slice(4);
function escucharInvitaciones() {
  if (fb.invUnsub) return;
  const { F, fs } = fb;
  const q = F.query(F.collection(fs, "invitaciones"), F.where("negocioId", "==", fb.negocioId));
  fb.invUnsub = fbTrack(F.onSnapshot(q, snap => {
    fbInvitaciones = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (S.view === "usuarios") renderUsuariosFb();
  }, () => {}));
}
function renderUsuariosFb() {
  escucharInvitaciones();
  const el = $("#v-usuarios");
  const yo = sessionId;
  const fijo = u => u.id === yo || u.id === fb.dueno;
  const rolTxt = r => r === "admin" ? "Administrador" : "Vendedor";
  const vigentes = fbInvitaciones
    .filter(i => !i.usadoPor && i.expira && i.expira.toMillis() > Date.now())
    .sort((a, b) => b.expira.toMillis() - a.expira.toMillis());
  const usuarios = [...S.users].sort((a, b) => (b.activo - a.activo) || String(a.nombre).localeCompare(String(b.nombre), "es"));
  el.innerHTML = `<h1>Usuarios</h1>
    <section class="panel" style="margin:14px 0">
      <h2>Invitar a alguien</h2>
      <p class="muted">Crea un código y dáselo a la persona. En su celular o computadora abre Mostrador, crea su cuenta y elige <b>Unirme con un código</b>. Cada código sirve para una sola persona y vence en ${INVITE_HOURS} horas.</p>
      <div class="toolbar">
        <label class="f" style="flex:0 1 200px"><span>Entrará como</span><select id="invRol"><option value="vendedor">Vendedor</option><option value="admin">Administrador</option></select></label>
        <button class="btn primary" id="invCrear">Crear código</button>
      </div>
      ${vigentes.length ? `<div class="invite-list">${vigentes.map(i => `<div class="invite-row"><b class="invite-code num">${codigoTxt(i.id)}</b><span class="chip">${rolTxt(i.rol)}</span><span class="muted">vence ${fmtDate(i.expira.toDate().toISOString())}</span><button class="btn ghost" data-inv-copy="${esc(i.id)}">Copiar</button><button class="btn ghost" data-inv-del="${esc(i.id)}">Borrar</button></div>`).join("")}</div>` : ""}
    </section>
    <div class="summary-table-wrap"><table class="user-table">
      <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
      <tbody>${usuarios.map(u => `<tr>
        <td>${esc(u.nombre)}${u.id === yo ? ' <span class="chip">tú</span>' : ""}${u.id === fb.dueno ? ' <span class="chip">dueño</span>' : ""}</td>
        <td>${esc(u.email || "")}</td>
        <td>${fijo(u) ? rolTxt(u.rol) : `<select data-frol="${esc(u.id)}"><option value="vendedor" ${u.rol !== "admin" ? "selected" : ""}>Vendedor</option><option value="admin" ${u.rol === "admin" ? "selected" : ""}>Administrador</option></select>`}</td>
        <td>${u.activo ? "Activo" : '<span class="chip out">Desactivado</span>'}</td>
        <td>${fijo(u) ? "" : `<button class="btn" data-ftoggle="${esc(u.id)}">${u.activo ? "Desactivar" : "Activar"}</button>`}</td>
      </tr>`).join("")}</tbody>
    </table></div>
    <p class="muted" style="margin-top:12px">Cada persona entra con su propio correo y contraseña. Firebase revisa los permisos en el servidor: un vendedor no puede editar productos, anular notas ni ver las estadísticas aunque lo intente.</p>`;
}
function fbMiembroRef(id) { return fb.F.doc(fb.fs, "negocios/" + fb.negocioId + "/miembros/" + id); }
$("#v-usuarios").addEventListener("change", async e => {
  const id = fbMode && e.target.dataset.frol;
  if (!id || !exigir("usuarios.gestionar", "cambiar roles")) return;
  try { await fbWrite(fb.F.updateDoc(fbMiembroRef(id), { rol: e.target.value })); toast("Rol actualizado"); }
  catch (err) { toast(fbError(err)); renderUsuariosFb(); }
});
$("#v-usuarios").addEventListener("click", async e => {
  if (!fbMode) return;
  const b = e.target.closest("button");
  if (!b || !exigir("usuarios.gestionar", "gestionar usuarios")) return;
  const { F, fs } = fb;
  try {
    if (b.id === "invCrear") {
      if (!navigator.onLine) return toast("Necesitas internet para crear un código");
      b.disabled = true;
      const codigo = nuevoCodigo();
      await F.setDoc(F.doc(fs, "invitaciones/" + codigo), {
        negocioId: fb.negocioId, negocioNombre: S.settings.negocio, rol: $("#invRol").value,
        creadoPor: sessionId, creado: F.serverTimestamp(),
        expira: F.Timestamp.fromMillis(Date.now() + INVITE_HOURS * 3600e3), usadoPor: null,
      });
      toast("Código " + codigoTxt(codigo) + " creado");
    } else if (b.dataset.invCopy) {
      try { await navigator.clipboard.writeText(codigoTxt(b.dataset.invCopy)); toast("Código copiado"); }
      catch { toast("Código: " + codigoTxt(b.dataset.invCopy)); }
    } else if (b.dataset.invDel) {
      await fbWrite(F.deleteDoc(F.doc(fs, "invitaciones/" + b.dataset.invDel)));
      toast("Código borrado");
    } else if (b.dataset.ftoggle) {
      const u = S.users.find(x => x.id === b.dataset.ftoggle);
      if (!u) return;
      if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = u.activo ? "Confirmar desactivación" : "Confirmar activación"; return; }
      await fbWrite(F.updateDoc(fbMiembroRef(u.id), { activo: !u.activo }));
    }
  } catch (err) { toast(fbError(err)); b.disabled = false; }
});

