// ---------- navegación ----------
function renderUsuarios() {
  if (!exigir("usuarios.gestionar", "gestionar usuarios")) return;
  if (fbMode) return renderUsuariosFb();
  const el = $("#v-usuarios");
  const admins = S.users.filter(u => u.rol === "admin" && u.activo).length;
  el.innerHTML = `<h1>Usuarios</h1><form id="newUser" class="panel" style="margin:14px 0"><h2>Nuevo usuario</h2><div class="grid2"><label class="f"><span>Nombre</span><input name="nombre" required></label><label class="f"><span>Usuario</span><input name="usuario" required></label><label class="f"><span>Rol</span><select name="rol"><option value="vendedor">Vendedor</option><option value="admin">Administrador</option></select></label><label class="f"><span>PIN</span><input name="pin" type="password" minlength="4" maxlength="12" required></label><label class="f"><span>Confirmar PIN</span><input name="confirmacion" type="password" minlength="4" maxlength="12" required></label></div><p class="warnline" id="userError" hidden></p><button class="btn primary">Crear usuario</button></form><div class="summary-table-wrap"><table class="user-table"><thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${S.users.map(u=>`<tr><td>${esc(u.nombre)}</td><td>${esc(u.usuario)}</td><td><select data-role="${esc(u.id)}"><option value="admin" ${u.rol==="admin"?"selected":""}>Administrador</option><option value="vendedor" ${u.rol==="vendedor"?"selected":""}>Vendedor</option></select></td><td>${u.activo?"Activo":"Inactivo"}</td><td><button class="btn" data-reset="${esc(u.id)}">Restablecer PIN</button><button class="btn" data-toggle="${esc(u.id)}">${u.activo?"Desactivar":"Activar"}</button></td></tr>`).join("")}</tbody></table></div><section class="panel" style="margin-top:16px"><h2>Intentos bloqueados</h2><div class="summary-table-wrap"><table class="user-table"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th></tr></thead><tbody>${audit.slice(0,50).map(a=>`<tr><td>${fmtDate(a.fecha)}</td><td>${esc(a.usuario)}</td><td>${esc(a.accion)}</td></tr>`).join("")||"<tr><td colspan=3>Sin registros</td></tr>"}</tbody></table></div><p class="muted">Este control organiza el trabajo en el mostrador. Como todo funciona en el navegador, no reemplaza la seguridad de un sistema con servidor.</p></section>`;
  $("#newUser").onsubmit = async e => { e.preventDefault(); if (!exigir("usuarios.gestionar", "crear usuarios")) return; const f = new FormData(e.currentTarget); if (f.get("pin") !== f.get("confirmacion")) { $("#userError").textContent="Los PIN no coinciden."; $("#userError").hidden=false; return; } try { await crearUsuario({ nombre:f.get("nombre"), usuario:f.get("usuario"), rol:f.get("rol"), pin:f.get("pin") }); renderUsuarios(); } catch(err) { $("#userError").textContent=err.message; $("#userError").hidden=false; } };
  el.onchange = async e => { const id=e.target.dataset.role; if (!id) return; if (!exigir("usuarios.gestionar","cambiar roles")) return; const u=S.users.find(x=>x.id===id); if (!u) return; if (u.rol==="admin" && e.target.value!=="admin" && u.activo && admins<=1) { toast("No puedes bajar al último administrador activo"); return renderUsuarios(); } u.rol=e.target.value; await putUsers(); aplicarPermisosUI(); if (u.id === sessionId && u.rol !== "admin") return go("inventario"); renderUsuarios(); };
  el.onclick = async e => {
    const button = e.target.closest("button");
    if (!button) return;
    if (!exigir("usuarios.gestionar", "gestionar usuarios")) return;
    const id = button.dataset.toggle || button.dataset.reset || button.dataset.resetSave;
    const user = S.users.find(item => item.id === id);
    if (!user) return;
    if (button.dataset.toggle) {
      if (!button.dataset.armed) {
        button.dataset.armed = "1";
        button.textContent = user.activo ? "Confirmar desactivación" : "Confirmar activación";
        return;
      }
      if (user.id === sessionId) {
        toast("No puedes desactivarte a ti mismo");
        return;
      }
      if (user.activo && user.rol === "admin" && admins <= 1) {
        toast("No puedes desactivar al último administrador activo");
        return;
      }
      user.activo = !user.activo;
      await putUsers();
      renderUsuarios();
      return;
    }
    if (button.dataset.reset) {
      const cell = button.closest("td");
      cell.innerHTML = '<input type="password" data-newpin="' + esc(user.id) + '" minlength="4" maxlength="12" placeholder="PIN nuevo"><button class="btn" data-reset-save="' + esc(user.id) + '">Guardar PIN</button>';
      return;
    }
    if (button.dataset.resetSave) {
      const input = el.querySelector('[data-newpin="' + user.id + '"]');
      const pin = input?.value || "";
      if (pin.length < 4 || pin.length > 12) {
        toast("El PIN debe tener 4 a 12 caracteres");
        return;
      }
      const salt = makeSalt();
      user.salt = salt;
      user.pinHash = await hashPin(salt, pin);
      await putUsers();
      renderUsuarios();
      toast("PIN restablecido");
    }
  };
}
