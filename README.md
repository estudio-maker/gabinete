# Gabinete · Pérez Ramírez Arquitectura

Sistema de tareas del estudio: tableros por obra y proyecto, equipo, calendario e historial.
Funciona en la computadora y en el celular desde el mismo enlace.

- **App:** `index.html` (se publica con GitHub Pages).
- **Datos:** Supabase (proyecto "Gabinete Perez Ramirez Arquitectura", región São Paulo).
- **Base de datos:** el esquema está en `supabase/01_esquema.sql`.

Para entrar, cada persona abre el enlace, escribe su mail y recibe un código.
Solo pueden entrar los mails que un administrador cargó en **Equipo → Gestionar equipo**.

## Google Calendar

El calendario se sincroniza con el Google Calendar de la cuenta que publica el Apps Script de avisos
(`google-apps-script/`, cuenta estudio@perezramirezarquitectura.com). Solo lo ve quien entra a Gabinete
con ese mismo mail:

- Sus eventos de Google aparecen en **Calendario** (botón *Google Calendar* para mostrarlos u ocultarlos).
- Sus tareas abiertas con fecha se copian a un calendario **Gabinete** de su Google Calendar. Se actualizan
  al cambiarlas (desde cualquier usuario, mientras tenga Gabinete abierto) y se quitan al terminarlas.

Para activarlo: en el proyecto de Apps Script agregar el archivo `Calendario.gs`, reemplazar `Avisos.gs`,
y en *Implementar → Gestionar implementaciones* editar la implementación existente con **Versión nueva**
(así la URL no cambia). Google pide autorizar el permiso de Calendar una vez.
