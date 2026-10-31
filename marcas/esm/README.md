# ESM · copia de Gabinete para el equipo de ESM

Misma app que Gabinete (todas las funciones), con nombre y logo de ESM, sin datos y con su propia base de Supabase.
No se copia el código: `scripts/build-marca.mjs esm` la arma desde el `index.html` de Gabinete cambiando los textos
que están en `marca.mjs`. Así cada mejora de Gabinete llega también a ESM. Si un texto de Gabinete cambia,
el armado se frena y dice cuál hay que actualizar en `marca.mjs`.

- **Armar:** `npm install --no-save --no-package-lock javascript-obfuscator@4.1.1 html-minifier-terser@7.2.0 && node scripts/build-marca.mjs esm`
  → `_marcas/esm/sitio` (lo que se publica) y `_marcas/esm/supabase` (`instalar.sql` y las funciones `push` y `gcal`).
- **Publicación:** sitio estático en Render (`esm-equipo.onrender.com`) con ese mismo comando y carpeta `_marcas/esm/sitio`.
- **Base de datos:** proyecto de Supabase propio. Se corre una vez `_marcas/esm/supabase/instalar.sql`, se publican las funciones
  `push` y `gcal` con *Verify JWT* desactivado y en Authentication la plantilla del mail manda el código (`{{ .Token }}`).
- **Video de instalación:** `tutorial/` (página y videos). Se rehacen con `video/`: `node shot.js` (capturas del ingreso),
  `node escenas.js` (escenas) y `python armar_video.py` (con voz, en una computadora con internet; `--sin-voz` sin voz).
- **Pendiente por cuenta propia de ESM:** avisos por mail (Apps Script, hoy la app ofrece copiar el mensaje) y el cliente
  de Google Calendar (OAuth) del proyecto nuevo.
