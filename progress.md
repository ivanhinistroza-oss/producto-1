# Progreso de Mostrador

Memoria de trabajo. Léela al empezar cada sesión y actualízala al terminar cada tarea importante. Mantenla breve: los detalles técnicos y el mapa del código están en `CLAUDE.md`.

## Objetivo

Mostrador (`mostrador.html` + `css/` + `js/`) es una app de inventario y ventas para la tienda de Iván en Perú. Funciona en varios equipos con Firebase y se publica en https://ivanhinistroza-oss.github.io/producto-1/

## Estado actual (09-11-2026)

- Último commit: 76c5d82 (app separada en varios archivos), ya publicado y comprobado en GitHub Pages.
- Sin commitear: `sw.js` (caché `mostrador-v5`) siempre pregunta al servidor por la versión nueva; antes el navegador podía usar hasta 10 minutos una copia vieja. Probado con un servidor que imita a GitHub, también sin internet.
- `CLAUDE.md` tiene cambios sin commitear (a propósito).
- Commits desde PowerShell: escribe el mensaje con `[IO.File]::WriteAllText`, porque `Set-Content -Encoding utf8` mete un BOM al inicio.

## Últimos cambios

- **76c5d82, app separada en archivos:**
  - `mostrador.html` quedó solo con el HTML; los estilos están en `css/estilos.css`, y el código en 19 archivos dentro de `js/` (mapa en `CLAUDE.md`);
  - la app funciona igual: el código unido es idéntico al original, y las 10 vistas muestran el mismo texto que antes;
  - `sw.js` (caché `mostrador-v4`) guarda los archivos nuevos, y la página, el CSS y el JS van primero por la red, para que los celulares reciban los cambios;
  - el modo artifact de claude.ai (un solo archivo) ya no se mantiene.

- **ddb2330, costo y ganancia:**
  - campo «Costo de compra» opcional en el producto (`p.costo`), con aviso de cuánto se gana por unidad;
  - cada venta guarda el costo en la línea (`item.costo`); las ventas antiguas usan el costo actual (`itemCosto`, `gananciaDe`);
  - Reportes: tarjeta «Ganancia» y reporte imprimible/Excel «Ganancias y márgenes» (con fila de descuentos);
  - los productos sin costo no entran en el margen y se avisa cuánto quedó fuera.

- **00b02a6, etiquetas:**
  - imprimir las etiquetas de un producto (una por prenda en stock);
  - rollo de 2 columnas de 50×25 mm;
  - rollo de 1 columna sin hojas en blanco.
- **3c0b390, productos:**
  - sin nombres repetidos (reserva con transacción en `nombres/`);
  - chips para elegir la categoría;
  - total por color.
- **255aadf, ventas:**
  - seguras con varios equipos (transacciones, folio único y cola sin conexión);
  - combinaciones ordenadas por color.

## Decisiones importantes

- Commit y push solo cuando Iván lo pide. No incluir `CLAUDE.md` en los commits salvo que lo pida.
- Usar Codex solo cuando lo pide, y revisar siempre lo que dice: a veces da avisos falsos.
- Nunca escribir contraseñas, crear cuentas en el Firebase real ni pedir la Clave SOL.
- Firebase sigue en el plan Spark (gratis). Pasar a Blaze lo decide Iván.
- Las reglas de Firestore las publica Iván a mano.

## Pendientes

- **Iván prueba la app separada en archivos** en su celular y su computadora: entrar, vender, imprimir el ticket y las etiquetas. Si el celular muestra la versión vieja, debe cerrar la app y volver a abrirla.

- **Iván prueba en su cuenta real:**
  - ventas desde dos equipos;
  - nombres repetidos;
  - chips de categoría;
  - totales por color.
- **Iván anota el costo de sus productos** para que Reportes muestre la ganancia.
- **Primer inicio lento en un equipo nuevo:** es normal (descarga Firebase y todos los productos con fotos; después usa la caché). Si molesta, se podría mostrar el inventario mientras carga o sacar las fotos del documento del producto.
- **Etiquetas en la etiquetadora:** Iván hará una prueba. Si salen corridas, mandará una foto y habrá que ajustar `ETQ_ROLLO2`.
- **Ideas sin autorizar** (no hacerlas sin que Iván las pida):
  - importar desde Excel;
  - gastos de caja;
  - sucursales;
  - clientes con crédito;
  - compras (el costo por producto ya existe; falta registrar compras a proveedores);
  - aviso de consumo de Firebase;
  - facturación SUNAT.
- **Deuda de código:** `renderResumen` está en una sola línea enorme.
- **Detalles por corregir:**
  - el README dice rama `main`, pero es `master`;
  - el artifact de claude.ai está desactualizado y ya no se mantiene, porque la app ya no es un solo archivo.
