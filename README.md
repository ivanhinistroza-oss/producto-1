# Mostrador

Aplicación web sencilla de inventario y notas de venta. No necesita servidor ni base de datos para el uso individual: guarda los productos, las notas y los ajustes en el almacenamiento local del navegador donde la abras. Los datos no se sincronizan entre dispositivos ni se envían al sitio. Usa **Exportar copia** periódicamente y conserva el JSON en un lugar seguro.

## Publicar en GitHub Pages

1. Sube `index.html` y `mostrador.html` a la rama `main` del repositorio.
2. Abre **Settings > Pages**.
3. En **Build and deployment**, selecciona **Deploy from a branch**.
4. Selecciona la rama **main** y la carpeta **/ (root)**; guarda.
5. Abre la URL que GitHub Pages muestra en esa sección.

GitHub Pages en repositorios privados requiere un plan pagado compatible. En GitHub Free, el repositorio debe ser público para publicar con Pages. Consulta [los planes de GitHub](https://docs.github.com/en/get-started/learning-about-github/githubs-plans) y la [guía de publicación de Pages](https://docs.github.com/en/pages/quickstart).

## Imprimir tickets

Pulsa **Imprimir ticket** y el navegador abrirá su diálogo de impresión. Elige la impresora y el tamaño de papel configurado (58 u 80 mm). La impresión silenciosa requiere configurar el navegador o el equipo; la app web no puede elegir una impresora del sistema por sí sola.

Como opción para un equipo dedicado, se puede crear un acceso directo de Chrome cuyo destino incluya `--kiosk-printing`, por ejemplo:

```text
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing https://TU-USUARIO.github.io/TU-REPOSITORIO/
```

Chrome puede enviar la impresión sin mostrar el diálogo en ese modo. Configura primero la impresora predeterminada de Windows y prueba el acceso directo en ese equipo. Esta opción es intencionalmente opcional y no está configurada por la aplicación.

## Copias de seguridad

- **Exportar copia** descarga un archivo JSON con productos, notas y ajustes.
- **Importar copia** permite **Combinar** por identificador o **Reemplazar todo** tras confirmarlo dentro de la página.
- Al limpiar los datos del navegador o cambiar de navegador/dispositivo, los datos locales no estarán disponibles allí; importa una copia para recuperarlos.