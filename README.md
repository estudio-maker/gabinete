# Gabinete · Pérez Ramírez Arquitectura

Sistema de tareas del estudio: tableros por obra y proyecto, equipo, calendario e historial.
Funciona en la computadora y en el celular desde el mismo enlace.

- **App:** `index.html` (se publica con GitHub Pages).
- **Datos:** Supabase (proyecto "Gabinete Perez Ramirez Arquitectura", región São Paulo).
- **Base de datos:** el esquema está en `supabase/01_esquema.sql`.

Para entrar, cada persona abre el enlace, escribe su mail y recibe un código.
Solo pueden entrar los mails que un administrador cargó en **Equipo → Gestionar equipo**.

## Google Calendar

Cada persona conecta su propia cuenta de Google en **Mi cuenta** (o con el botón del **Calendario**):

- Sus tareas abiertas con fecha (no privadas) se copian a un calendario **Gabinete** de su Google Calendar.
  Cuando cualquiera del equipo cambia la fecha, el título, el tablero o los responsables, se actualiza
  el calendario de cada responsable. Al terminar, borrar, quitar la fecha o marcar privada, se quita.
- Va solo de Gabinete a Google: los eventos del calendario personal no entran a Gabinete.

Piezas: función `supabase/functions/gcal` (Verify JWT desactivado; secretos `GOOGLE_CLIENT_ID` y
`GOOGLE_CLIENT_SECRET` de un cliente OAuth "Aplicación web" de Google Cloud con la API de Calendar habilitada
y como URI de redirección `https://upvcwajccsmnqqvltgxp.supabase.co/functions/v1/gcal`) y `supabase/08_google_calendar.sql`
(tablas, disparador sobre tareas y revisión cada 30 minutos). La pantalla de consentimiento de Google tiene que estar
publicada ("En producción"); en modo de prueba Google corta el permiso a los 7 días.
