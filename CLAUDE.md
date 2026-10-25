# Mostrador — contexto del proyecto

App web de inventario y notas de venta para una tienda pequeña en Perú (moneda S/, DNI/RUC). El dueño es Iván; escribe en español y no es programador: explícale en español sencillo, con pasos concretos.

## Archivos

- `mostrador.html`: toda la app en un solo archivo (HTML + CSS + JS vanilla, sin librerías ni build).
- `index.html`: redirige a `mostrador.html` (para GitHub Pages).
- `README.md`: publicar en GitHub Pages, imprimir, copias de seguridad.
- Repo: https://github.com/ivanhinistroza-oss/producto-1 (rama `master`). El usuario hace `git push` él mismo; no hagas push salvo que lo pida.

## Dónde corre y dónde guarda datos

La app detecta su entorno al arrancar (`claude.use("db")`):

1. **claude.ai artifact** (https://claude.ai/artifact/PMpTiMmw6pFXKAbB2NbrUG): datos en la base `db` del artifact (colecciones `products`, `notes`, documentos `settings/app` y `settings/users`). Ahí `window.print()` está bloqueado, así que el ticket se descarga (`downloads.save`). **Ojo:** ese artifact NO está actualizado: no tiene variaciones, Resumen nuevo, Ventas, menú lateral ni usuarios. Republicarlo requiere el tool Artifact con `url` y probar el modo db.
2. **Servida por http(s) fuera de claude.ai** (GitHub Pages, localhost): **Firebase** (`fbMode`). Proyecto `producto-1-5a3c5`, SDK 12.19.0 desde gstatic con `import()`. Cada persona entra con correo y contraseña; `usuarios/{uid}.negocioId` apunta a su negocio; datos en `negocios/{id}/products|notes|settings|miembros`. `fbDb(nid)` imita la API de la db de claude.ai, así el resto del código no cambia. Invitaciones de un solo uso en `invitaciones/{código}` (48 h). Permisos reales en `firestore.rules` (Iván las pega en Firestore → Reglas). Caché persistente para vender sin internet; `fbWrite` no espera al servidor si no hay conexión. Al crear el negocio ofrece copiar `localStorage["mostrador.data"]`. Para probar sin la cuenta real: copia del HTML con `FB_SDK` apuntando a módulos falsos locales.
3. **Abierta como archivo** (file://): datos en `localStorage["mostrador.data"]` = `{products, notes, settings, users}`. "Imprimir ticket" imprime directo con un iframe oculto (`printLocal`). Hay Exportar/Importar copia en JSON.

## Funciones (vistas del menú)

Menú vertical a la izquierda en escritorio (≥900px) y barra inferior en el celular.

- **Inventario**: productos con categoría, código, precio, stock y mínimo. Conteo con −/+. Agrupación "Por categoría" o "Por semejanza" (similitud de nombres por tokens y trigramas: `similarity`, `clusters`, `mostSimilar`). Al crear un producto sugiere la categoría según los productos parecidos.
- **Variaciones**: `producto.variantes = [{id, talla, color, stock, minimo?, codigo?, precio?}]`. El stock total es la suma (`totalStock`). La venta elige la variante; la línea guarda `variantId`, `talla` y `color`, y su `nombre` ya incluye " – M / Negro".
- **Nueva venta → nota de venta** (folio NV-00001). Descuenta stock (`adjustStock`). Anular devuelve stock. El ticket se imprime en 58 u 80 mm (`ticketHtml`, `printHtml`, `ticketText`). Cada nota guarda `vendedorId` y `vendedorNombre` ("Atendió: …").
- **Notas de venta**: historial, reimpresión, copiar o descargar .txt, anular.
- **Ventas**: período (Hoy, 7 días, 30 días, Este mes, Todo), indicadores con comparación contra el período anterior, barras por día u hora, productos y variantes más vendidos, tabla de todas las ventas y CSV. Las anuladas no suman en las métricas.
- **Resumen**: indicadores de stock, alertas (agotado o reponer, por variante), barras por categoría y top 10, mapa de calor talla × color, tabla de todos los productos.
- **Usuarios** (solo admin): inicio de sesión simulado. PIN con SHA-256 + salt (`hashPin`). Sesión en `sessionStorage["mostrador.session"]`. Bloqueo de 30 s tras 5 fallos. Auditoría de intentos bloqueados en `localStorage["mostrador.audit"]` (50 registros).

- **Tienda web** (solo Firebase): en Configuración, "Vincular con mi tienda web" guarda `settings.webVinculada` y `catalogo/{negocioId}` = `{activa, negocio}`. Los productos con `web: true` («Mostrar en la web» en el editor) se copian a `catalogo/{negocioId}/productos/{id}` con solo nombre, código, categoría, stock y variantes (`webSync`, `webPublicar`: escribe solo lo que cambió y se dispara con cada snapshot de productos). El código de vinculación es el `negocioId`. La web (`C:\Users\IVAN\Desktop\web`, `js/mostrador-link.js`) lo lee sin iniciar sesión. Cada negocio tiene su vitrina; sin vincular, nada cambia.

## Permisos (roles)

`PERMISOS = { admin: ["*"], vendedor: ["inventario.ver","venta.crear","nota.ver","nota.imprimir"] }`, con `puede(permiso)` y `exigir(permiso, accion)` (registra, avisa con toast y devuelve false).

- Permisos del admin: `producto.crear/editar/eliminar`, `stock.ajustar`, `nota.anular`, `datos.exportar/importar`, `ajustes.editar`, `estadisticas.ver`, `usuarios.gestionar`.
- El bloqueo va en dos capas: la lógica (exigir al inicio de cada función sensible y en `go(view)`) y la interfaz (atributo `hidden`; la regla CSS `[hidden]{display:none!important}` es necesaria fuera de claude.ai).
- La venta del vendedor descuenta stock por `saleAdjusting` sin pedir `stock.ajustar`.
- Es control de orden interno, no seguridad real (todo corre en el navegador). La app lo dice en la vista Usuarios.

## Cómo probar cambios

1. Verifica la sintaxis: `awk '/<script>/{f=1;next}/<\/script>/{f=0}f' mostrador.html > "$TEMP/m.js" && node --check "$TEMP/m.js"`.
2. Para probar en el navegador integrado:
   - Sirve la carpeta con un servidor estático de Node en el puerto 8765, mediante `.claude/launch.json` y `preview_start`.
   - Siembra datos de ejemplo en `localStorage["mostrador.data"]`.
   - Revisa a ancho de escritorio y de 375px (dos iframes en una página de prueba), los números calculados a mano y los errores de consola.
   - Al terminar, borra los datos de prueba y el `launch.json` temporal.
3. Para probar como vendedor: crea admin y vendedor en el primer arranque y fuerza `.click()` en botones ocultos para comprobar la capa lógica.

## Estado y pendientes (al 22-10-2026)

- Usuarios, roles e inicio de sesión están en el commit "Agregar usuarios, roles e inicio de sesión…", hecho en local. Revisa con `git status` si el usuario ya hizo `git push`.
- Flujo con Codex: el usuario suele pedir "dile a Codex que…" mediante `/codex:rescue`. Codex a menudo deja partes sin terminar, rompe tildes al escribir con PowerShell y compacta el código en líneas muy largas. Revisa siempre el diff y prueba en el navegador antes de dar algo por bueno.
- **Deuda de código:** `renderResumen` y otras funciones están en una sola línea enorme. Conviene reformatearlas.
- **Hallazgos de revisión aún abiertos:**
  - un conteo rápido −/+ puede pisar el descuento de una venta (debounce de `setStockLocal`, sin variantes);
  - un fallo a mitad de `emitNote` o de la anulación deja datos a medias;
  - el folio puede repetirse con dos dispositivos;
  - `adjustStock` lee y escribe sobre una copia local que puede estar desactualizada.
- **Facturación SUNAT** (boletas y facturas): no implementada. Se comparó Nubefact (S/ 70 al mes), Lucode (desde S/ 0) y APIsPERU (S/ 25 + IGV). Haría falta un proveedor PSE/OSE y un servidor pequeño (por ejemplo Cloudflare Workers) que guarde la clave. Falta saber el régimen tributario del usuario.
- **GitHub Pages:** el README dice rama `main`, pero la rama es `master`. En GitHub Free el repo debe ser público para usar Pages.
