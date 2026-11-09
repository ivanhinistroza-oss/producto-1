# Progreso de Mostrador

Memoria de trabajo. Léela al empezar cada sesión y actualízala al terminar cada tarea importante. Mantenla breve: los detalles técnicos y el mapa del código están en `CLAUDE.md`.

## Objetivo

Mostrador (`mostrador.html`) es una app de inventario y ventas para la tienda de Iván en Perú. Funciona en varios equipos con Firebase y se publica en https://ivanhinistroza-oss.github.io/producto-1/

## Estado actual (09-11-2026)

- Todo está commiteado y subido a `master`. Último commit: 21ed404 (agrega este archivo).
- `CLAUDE.md` tiene cambios sin commitear (a propósito).
- Commits desde PowerShell: escribe el mensaje con `[IO.File]::WriteAllText`, porque `Set-Content -Encoding utf8` mete un BOM al inicio.

## Últimos cambios

- **Sin commitear, costo y ganancia (09-11-2026):**
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
  - el artifact de claude.ai está desactualizado.
