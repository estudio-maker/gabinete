// ESM · copia de Gabinete con nombre y marca propios, sin datos y con su propia base de Supabase.
// La arma scripts/build-marca.mjs a partir de la app de Gabinete, así recibe las mismas funciones.
// Cada cambio de texto se tiene que encontrar en el original: si Gabinete cambia un texto, el armado avisa.

export const nombre = "ESM";
export const titulo = "ESM · Tareas del equipo";
export const appUrl = "https://esm-equipo.onrender.com/";
export const host = "esm-equipo.onrender.com";

// Proyecto de Supabase de ESM (separado del de Gabinete). Creado el 2026-10-28 en la cuenta de ESM (São Paulo).
export const supabase = {
  ref: "mgmaryhqtfqmpyjgjtrz",
  key: "sb_publishable_NHQFiCuulShegzop2qK32A_rwB3p1mM",
  // primer administrador: con este mail se entra la primera vez y se carga al equipo
  admin: { email: "estudio@perezramirezarquitectura.com", nombre: "Jorge", rol: "Administrador" },
  contacto: "mailto:estudio@perezramirezarquitectura.com"
};

// Avisos por mail (Apps Script). Vacío = la app ofrece copiar el mensaje y mandarlo a mano.
export const notifyUrl = "";

const FEC = "2026-10-28";
// Lo que se muestra la primera vez que alguien entra (reemplaza las novedades de Gabinete)
export const bienvenida = [
  ["boards", "<b>Un tablero por carrera:</b> cada uno con sus columnas Pendiente, En curso, En revisión y Terminado. Arrastrá las tareas con el mouse, o en el celular mantenelas apretadas y movelas a otra columna, tablero o persona."],
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
  ['Creá un tablero por cada obra o proyecto del estudio.', 'Creá un tablero por cada carrera.'],
  ['Sumá a cada persona del estudio para poder asignarle tareas.', 'Sumá a cada persona de la empresa para poder asignarle tareas.'],
  ['Agenda compartida del estudio:', 'Agenda compartida de la empresa:'],
  ['con los que trabaja el estudio.', 'con los que trabaja la empresa.'],
  ['<b>Gabinete</b><span>Tareas del estudio</span>', '<b>Tareas del equipo</b>'],
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
  ['<span>Tablero (obra o proyecto)</span>', '<span>Tablero (carrera)</span>'],
  ['Un tablero por cada obra o proyecto.', 'Un tablero por cada carrera.'],
  ['[["obra","Obra"],["proyecto","Proyecto"]]', '[["obra","Carrera"],["proyecto","Proyecto"]]'],
  ['placeholder="Ej. Dibujante BIM, Dirección de obra"', 'placeholder="Ej. Logística, Inscripciones, Prensa"'],
  ['placeholder="Ej. Enviar planos de instalación sanitaria al cliente"', 'placeholder="Ej. Confirmar el permiso municipal del circuito"'],
  ['const pre=kind==="proyecto"?"P":"O";', 'const pre=kind==="proyecto"?"P":"C";'],
  // ESM no usa tableros de tipo "Proyecto": solo carreras
  ['${sec("proyecto","Proyectos")}', ''],
  ['${grp("proyecto","Proyectos")}', ''],
  ['["obra","proyecto"].map(k=>', '["obra"].map(k=>'],
  ['<div class="fld"><span>Tipo</span><div class="seg" role="group">', '<div class="fld" hidden><span>Tipo</span><div class="seg" role="group">']
];

// Funciones de Supabase (push y gcal)
export const textosFunciones = [
  ['https://estudio-maker.github.io/gabinete/', appUrl],
  ['mailto:estudio@perezramirezarquitectura.com', supabase.contacto],
  ['const CAL_NAME = "Gabinete";', 'const CAL_NAME = "ESM";'],
  ['"Gabinete se actualizó"', '"ESM se actualizó"'],
  ['title: "Gabinete"', 'title: "ESM"']
];

// Versión propia de ESM (se suma a la de Gabinete). Subirla cada vez que se publica un cambio solo de ESM,
// así los celulares ven el aviso "Hay una versión nueva".
export const versionMarca = 3;

// Cambios de funciones que tiene solo ESM, aplicados sobre el código de Gabinete antes de los textos.
// Fecha de la carrera en cada tablero: se ve en el tablero, en el Calendario y en Google Calendar.
export const parches = [
  ['place:"place",color:"color",archived', 'place:"place",eventDate:"event_date",color:"color",archived'],
  ['"due","start_date","due_time"]);', '"due","start_date","due_time","event_date"]);'],
  ['"dueTime","createdBy","uid"]);', '"dueTime","createdBy","uid","eventDate"]);'],
  ['<label class="fld"><span>Ubicación</span><input class="inp" id="pj-place" value="${esc(p.place||"")}" placeholder="Opcional"></label></div>',
   '<label class="fld"><span>Ubicación</span><input class="inp" id="pj-place" value="${esc(p.place||"")}" placeholder="Opcional"></label></div>\n<label class="fld"><span>Fecha de la carrera <span class="muted" style="font-weight:400">aparece en el Calendario y en Google Calendar</span></span><input class="inp" type="date" id="pj-date" value="${esc(p.eventDate||"")}"></label>'],
  ['place:$("#pj-place").value.trim()};', 'place:$("#pj-place").value.trim(),eventDate:$("#pj-date").value||""};'],
  ['${p.private?" · Privado, solo lo ven los designados":""}</span></div>',
   '${p.private?" · Privado, solo lo ven los designados":""}${p.eventDate?" · 🏁 Carrera: "+esc(fmtD(p.eventDate)+" "+pYmd(p.eventDate).getFullYear()):""}</span></div>'],
  // Calendario: la fecha de cada carrera arriba de las tareas del día
  ['const by={}; ts.forEach', 'const evs={}; projectsL().forEach(p=>{ if(p.eventDate&&(!pid||p.id===pid)) (evs[p.eventDate]=evs[p.eventDate]||[]).push(p); });\n  const by={}; ts.forEach'],
  ['<span class="dn">${d.getDate()}</span>', '<span class="dn">${d.getDate()}${evs[ds]?" 🏁":""}</span>'],
  ['<div class="dchips">${L.slice(0,tn)', '<div class="dchips">${(evs[ds]||[]).map(p=>`<div class="cc ev" data-act="openProj" data-pid="${esc(p.id)}" style="${pc(p)}" title="Carrera: ${esc(p.name)}"><span class="cb">Carrera</span><span>🏁 ${esc(p.name)}</span></div>`).join("")}${L.slice(0,tn)'],
  ['${sl.length?groupByBoard(sl)', '${(evs[sel]||[]).map(p=>`<div class="cc ev" data-act="openProj" data-pid="${esc(p.id)}" style="${pc(p)};margin-bottom:10px;padding:8px 10px;font-size:14px"><span class="cb">Carrera</span><span>🏁 <b>${esc(p.name)}</b>${p.place?" · "+esc(p.place):""}</span></div>`).join("")}${sl.length?groupByBoard(sl)'],
  ['.cc{flex-direction:column', '.cc.ev{cursor:pointer;font-weight:600;background:color-mix(in srgb,var(--pc) 16%,var(--sheet))}\n.cc{flex-direction:column']
];

// Google Calendar: la fecha de cada carrera como evento de todo el día para quienes ven ese tablero.
export const parchesFunciones = { gcal: [
  ['    for (const r of Object.values(rows)) { await dropEvent(acc, r); n.quitadas++; }',
   `    for (const p of await boardsFor(id)) {
      const r = await putEvent(acc, p, rows[p.id], await boardBody(p));
      if (r === "creada") n.creadas++; else if (r === "actualizada") n.actualizadas++;
      delete rows[p.id];
    }
    for (const r of Object.values(rows)) { await dropEvent(acc, r); n.quitadas++; }`],
  ['/** Sincroniza una tarea en el calendario',
   `// ---- fecha de la carrera de cada tablero ----
const BOARD_COLS = "id,name,code,place,private,team,lead,created_by,event_date,archived";
const seesBoard = (p, id, admin) => !p.private || admin || p.created_by === id || p.lead === id || (p.team || []).includes(id);
async function boardsFor(id) {
  const ps = await rest(\`projects?event_date=not.is.null&archived=eq.false&select=\${BOARD_COLS}\`);
  const admin = !!((await rest(\`members?id=eq.\${id}&select=is_admin\`))[0] || {}).is_admin;
  return ps.filter(p => seesBoard(p, id, admin));
}
async function boardBody(p) {
  const body = { summary: "🏁 " + (p.code ? p.code + " · " : "") + p.name,
    description: "Fecha de la carrera en ESM" + (p.place ? "\\nLugar: " + p.place : "") + "\\n\\nAbrir ESM: " + APP,
    start: { date: p.event_date }, end: { date: addDay(p.event_date) }, reminders: { useDefault: true }, transparency: "transparent",
    source: { title: "ESM", url: APP }, extendedProperties: { private: { gabinete: p.id } } };
  if (p.private) body.visibility = "private";
  return { body, huella: await hash(JSON.stringify(body)) };
}
async function syncBoard(id) {
  const p = (await rest(\`projects?id=eq.\${id}&select=\${BOARD_COLS}\`))[0] || null;
  const rows = await rest(\`gcal_eventos?task_id=eq.\${id}&select=*\`);
  const accs = await rest("gcal_cuentas?calendar_id=not.is.null&select=*");
  const admins = new Set((await rest("members?is_admin=eq.true&select=id")).map(m => m.id));
  const ev = p && p.event_date && !p.archived ? await boardBody(p) : null;
  let done = 0;
  for (const acc of accs) {
    const row = rows.find(r => r.member_id === acc.member_id);
    try {
      if (ev && seesBoard(p, acc.member_id, admins.has(acc.member_id))) await putEvent(acc, p, row, ev);
      else if (row) await dropEvent(acc, row);
      done++;
    } catch (e) { console.warn("gcal board", acc.member_id, String(e)); }
  }
  return { cuentas: done };
}
/** Sincroniza una tarea en el calendario`],
  ['if (b.secret && (b.action === "task" || b.action === "sync_all")) {',
   'if (b.secret && (b.action === "task" || b.action === "board" || b.action === "sync_all")) {'],
  ['      if (b.action === "task") return UUID.test',
   '      if (b.action === "board") return UUID.test(b.id || "") ? J({ ok: true, ...(await syncBoard(b.id)) }) : J({ ok: false, error: "Tablero inválido" }, 400);\n      if (b.action === "task") return UUID.test']
] };

// Identidad visual de ESM: azul de la marca (#0071CD) para lo que se toca y lo que está "en curso",
// azul noche en las barras para que el logo blanco resalte, y el amarillo se queda para avisos y botones de acción.
export const colorTema = "#0B2545";
export const css = `
:root{--paper:#EDF0F3;--colbg:#F5F7F9;--line:#D5DCE3;--line2:#E6EAEE;--grid:rgba(0,113,205,.06);
  --band:#0B2545;--bandfg:#EEF3F8;
  --accent:#0071CD;--accent2:#0A84E0;--accentbg:#E3EFFA;
  --st-doing:#0071CD;--c0:#0071CD}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --paper:#0C1218;--sheet:#151D25;--colbg:#111820;--line:#26323D;--line2:#1D2730;--grid:rgba(90,174,245,.05);
  --band:#06111D;--accent:#5AAEF5;--accent2:#3C97E6;--accentbg:#0E2A44;--st-doing:#5AAEF5;--c0:#5AAEF5}}
:root[data-theme="dark"]{
  --paper:#0C1218;--sheet:#151D25;--colbg:#111820;--line:#26323D;--line2:#1D2730;--grid:rgba(90,174,245,.05);
  --band:#06111D;--accent:#5AAEF5;--accent2:#3C97E6;--accentbg:#0E2A44;--st-doing:#5AAEF5;--c0:#5AAEF5}
.login{background:radial-gradient(120% 90% at 50% 0%,#0071CD 0%,#0B2545 62%)}
.login img.lg{width:220px}
.brand img{width:150px}
`;
