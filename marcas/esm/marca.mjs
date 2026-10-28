// ESM · copia de Gabinete con nombre y marca propios, sin datos y con su propia base de Supabase.
// La arma scripts/build-marca.mjs a partir de la app de Gabinete, así recibe las mismas funciones.
// Cada cambio de texto se tiene que encontrar en el original: si Gabinete cambia un texto, el armado avisa.

export const nombre = "ESM";
export const titulo = "ESM · Tareas del equipo";
export const appUrl = "https://esm-equipo.onrender.com/";
export const host = "esm-equipo.onrender.com";

// Proyecto de Supabase de ESM (separado del de Gabinete). Se completa al crearlo.
export const supabase = {
  ref: "REF_PENDIENTE",
  key: "KEY_PENDIENTE",
  // primer administrador: con este mail se entra la primera vez y se carga al equipo
  admin: { email: "estudio@perezramirezarquitectura.com", nombre: "Jorge", rol: "Administrador" },
  contacto: "mailto:estudio@perezramirezarquitectura.com"
};

// Avisos por mail (Apps Script). Vacío = la app ofrece copiar el mensaje y mandarlo a mano.
export const notifyUrl = "";

const FEC = "2026-10-28";
// Lo que se muestra la primera vez que alguien entra (reemplaza las novedades de Gabinete)
export const bienvenida = [
  ["boards", "<b>Tableros por carrera o proyecto:</b> cada uno con sus columnas Pendiente, En curso, En revisión y Terminado. Arrastrá las tareas con el mouse, o en el celular mantenelas apretadas y movelas a otra columna, tablero o persona."],
  ["team", "<b>Equipo:</b> el administrador suma a cada persona con su mail en <b>Equipo → Gestionar equipo</b>. Cada uno entra con su mail y un código, desde la computadora o el celular."],
  ["home", "<b>Mis tareas</b> se ordena sola: primero lo vencido o que vence hoy, después lo urgente. Tocá las tarjetas de arriba para ver directo esas tareas."],
  ["cal", "<b>Calendario</b> con todas las tareas con fecha, y conexión opcional con tu Google Calendar en <b>Mi cuenta</b>."],
  ["bell", "<b>Notificaciones</b> en el celular y la computadora cuando te asignan una tarea y cuando está por vencer. Activalas en <b>Mi cuenta → Notificaciones</b>."],
  ["chat", "<b>Recordar por WhatsApp</b> a un responsable con el mensaje ya escrito, y <b>Proveedores</b> con la agenda compartida de la empresa."],
  ["lock", "<b>Tareas y tableros privados</b>, checklist, archivo de tareas terminadas, <b>Historial</b> de todos los movimientos y <b>Control del equipo</b> para los administradores."]
];
export const fechaBienvenida = FEC;

// Etapas de una carrera (reemplazan a las etapas de obra)
export const etapas = ["Planificación", "Permisos y municipalidad", "Sponsors", "Inscripciones", "Circuito y logística",
  "Kits y remeras", "Prensa y redes", "Día de la carrera", "Resultados y cierre"];

// [texto original, texto ESM, cuántas veces aparece (por defecto 1)]
export const textos = [
  ['<title>Gabinete · Pérez Ramírez Arquitectura</title>', `<title>${titulo}</title>`],
  ['content="Gabinete"', 'content="ESM"'],
  ['<h2>Abriendo el gabinete…</h2>', '<h2>Abriendo ESM…</h2>'],
  ['Conectando con los tableros compartidos del estudio.', 'Conectando con los tableros compartidos del equipo.'],
  ['alt="Pérez Ramírez Arquitectura"', 'alt="ESM"', 2],
  ['<h1>Gabinete</h1>', '<h1>Tareas del equipo</h1>'],
  ['"Alguien del estudio"', '"Alguien del equipo"'],
  ['te asignó una tarea en Gabinete, el sistema de tareas de Pérez Ramírez Arquitectura.', 'te asignó una tarea en ESM, el sistema de tareas del equipo.'],
  ['>Gabinete · Pérez Ramírez Arquitectura</div>', '>ESM · Tareas del equipo</div>'],
  ['Creá un tablero por cada obra o proyecto del estudio.', 'Creá un tablero por cada carrera o proyecto.'],
  ['Sumá a cada persona del estudio para poder asignarle tareas.', 'Sumá a cada persona de la empresa para poder asignarle tareas.'],
  ['Agenda compartida del estudio:', 'Agenda compartida de la empresa:'],
  ['con los que trabaja el estudio.', 'con los que trabaja la empresa.'],
  ['<b>Gabinete</b><span>Tareas del estudio</span>', '<b>ESM</b><span>Tareas del equipo</span>'],
  ['label="Resto del estudio"', 'label="Resto del equipo"'],
  ['<div class="mgrp">Resto del estudio</div>', '<div class="mgrp">Resto del equipo</div>'],
  ['<h2>Equipo del estudio</h2>', '<h2>Equipo de ESM</h2>'],
  ['Primero cargá al equipo del estudio.', 'Primero cargá al equipo.'],
  ['<p>El sistema de tareas del estudio.</p>', '<p>Organización interna del equipo de ESM.</p>'],
  ['Pedile al administrador del estudio', 'Pedile al administrador'],
  ['estudio-maker.github.io/gabinete', host, 2],
  ['<b>estudio-maker.github.io</b>', `<b>${host}</b>`],
  // obras → carreras (la clave interna "obra" de la base no cambia)
  ['kind==="obra"?"obra":"proyecto"', 'kind==="obra"?"carrera":"proyecto"'],
  ['${sec("obra","Obras")}', '${sec("obra","Carreras")}'],
  ['p.kind==="proyecto"?"Proyecto":"Obra"', 'p.kind==="proyecto"?"Proyecto":"Carrera"'],
  ['p.kind==="proyecto"?"Proy.":"Obra"', 'p.kind==="proyecto"?"Proy.":"Carr."', 3],
  ['p.kind==="proyecto"?"este proyecto":"esta obra"', 'p.kind==="proyecto"?"este proyecto":"esta carrera"', 2],
  ['${grp("obra","Obras")}', '${grp("obra","Carreras")}'],
  ['placeholder="Buscar tareas, obras, personas"', 'placeholder="Buscar tareas, carreras, personas"'],
  ['k==="obra"?"Obras":"Proyectos"', 'k==="obra"?"Carreras":"Proyectos"'],
  ['<span>Tablero (obra o proyecto)</span>', '<span>Tablero (carrera o proyecto)</span>'],
  ['Un tablero por cada obra o proyecto.', 'Un tablero por cada carrera o proyecto.'],
  ['[["obra","Obra"],["proyecto","Proyecto"]]', '[["obra","Carrera"],["proyecto","Proyecto"]]'],
  ['placeholder="Ej. Dibujante BIM, Dirección de obra"', 'placeholder="Ej. Logística, Inscripciones, Prensa"'],
  ['placeholder="Ej. Enviar planos de instalación sanitaria al cliente"', 'placeholder="Ej. Confirmar el permiso municipal del circuito"'],
  ['const pre=kind==="proyecto"?"P":"O";', 'const pre=kind==="proyecto"?"P":"C";']
];

// Funciones de Supabase (push y gcal)
export const textosFunciones = [
  ['https://estudio-maker.github.io/gabinete/', appUrl],
  ['mailto:estudio@perezramirezarquitectura.com', supabase.contacto],
  ['const CAL_NAME = "Gabinete";', 'const CAL_NAME = "ESM";'],
  ['"Gabinete se actualizó"', '"ESM se actualizó"'],
  ['title: "Gabinete"', 'title: "ESM"']
];
