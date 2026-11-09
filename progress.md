# Progreso de Mostrador

Memoria de trabajo. Léela al empezar cada sesión y actualízala al terminar cada tarea importante. Mantenla breve: los detalles técnicos y el mapa del código están en `CLAUDE.md`.

## Objetivo

Mostrador (`mostrador.html`) es una app de inventario y ventas para la tienda de Iván en Perú. Funciona en varios equipos con Firebase y se publica en https://ivanhinistroza-oss.github.io/producto-1/

## Estado actual (09-11-2026)

- Todo está commiteado y subido a `master`. Último commit: 00b02a6.
- `CLAUDE.md` y `progress.md` tienen cambios sin commitear.

## Últimos cambios

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
- **Etiquetas en la etiquetadora:** Iván hará una prueba. Si salen corridas, mandará una foto y habrá que ajustar `ETQ_ROLLO2`.
- **Ideas sin autorizar** (no hacerlas sin que Iván las pida):
  - importar desde Excel;
  - gastos de caja;
  - sucursales;
  - clientes con crédito;
  - compras y costos;
  - aviso de consumo de Firebase;
  - facturación SUNAT.
- **Deuda de código:** `renderResumen` está en una sola línea enorme.
- **Detalles por corregir:**
  - el README dice rama `main`, pero es `master`;
  - el artifact de claude.ai está desactualizado.
