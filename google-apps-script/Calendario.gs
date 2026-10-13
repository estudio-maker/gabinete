/**
 * Gabinete · Pérez Ramírez Arquitectura
 * Sincronización con Google Calendar de la cuenta que publica este script
 * (estudio@perezramirezarquitectura.com). Va en el mismo proyecto que Avisos.gs:
 * doPost() de Avisos.gs deriva acá los pedidos con action "gcal".
 *
 * En los dos sentidos:
 *  - Gabinete → Google: las tareas abiertas con fecha en las que el dueño de la cuenta es
 *    responsable se copian como eventos de todo el día en un calendario propio "Gabinete"
 *    (se crea solo). Si la tarea cambia de fecha o título se actualiza; si se termina, se
 *    borra o se le quita la fecha, el evento se elimina.
 *  - Google → Gabinete: devuelve los eventos de los calendarios visibles de la cuenta para
 *    mostrarlos en el calendario de Gabinete.
 *
 * Seguridad: solo responde a quien tiene una sesión válida de Gabinete con el mismo mail que
 * la cuenta de Google del script. Al resto del equipo le contesta owner:false y nada más, así
 * que nadie más ve la agenda personal. Las tareas se leen con la sesión de esa persona, con
 * los mismos permisos que tiene en la app.
 */
var GCAL_NOMBRE = 'Gabinete';
var GCAL_TZ = 'America/Asuncion';
var GCAL_ESTADOS = { todo: 'Pendiente', doing: 'En curso', review: 'En revisión', done: 'Terminado' };

function calendario(pedido) {
  var token = pedido.token;
  if (!token) return { ok: false, error: 'Pedido inválido' };
  var H = { apikey: SUPA_KEY, Authorization: 'Bearer ' + token };
  var u = UrlFetchApp.fetch(SUPA_URL + '/auth/v1/user', { headers: H, muteHttpExceptions: true });
  if (u.getResponseCode() !== 200) return { ok: false, error: 'Tu sesión venció. Volvé a entrar.' };
  var email = String(JSON.parse(u.getContentText()).email || '').toLowerCase();
  var cuenta = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (!cuenta || email !== cuenta) return { ok: true, owner: false };

  var leer = function (ruta) {
    var r = UrlFetchApp.fetch(SUPA_URL + '/rest/v1/' + ruta, { headers: H, muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error('No se pudo leer la base (' + r.getResponseCode() + ')');
    return JSON.parse(r.getContentText());
  };
  var yo = leer('members?email=eq.' + encodeURIComponent(email) + '&select=id')[0];
  if (!yo) return { ok: false, error: 'Tu usuario no está habilitado en Gabinete.' };

  var res = { ok: true, owner: true, cuenta: cuenta };
  var lock = LockService.getScriptLock();
  if (pedido.sync && lock.tryLock(25000)) {
    try { res.sync = sincronizar(leer, yo.id); } finally { lock.releaseLock(); }
  }
  if (pedido.desde && pedido.hasta) res.events = eventosGoogle(pedido.desde, pedido.hasta);
  return res;
}

/* Gabinete → Google */
function sincronizar(leer, yo) {
  var inicio = Date.now();
  var desde = new Date(); desde.setDate(desde.getDate() - 365);
  var hasta = new Date(); hasta.setFullYear(hasta.getFullYear() + 3);
  var tareas = leer('tasks?due=not.is.null&status=neq.done&due=gte.' + fechaTxt(desde) +
    '&select=id,title,notes,due,status,project_id,assignee_id,co_assignees');
  var tableros = {};
  leer('projects?select=id,name,code').forEach(function (p) { tableros[p.id] = p; });

  var cal = calendarioGabinete();
  var existentes = {};
  cal.getEvents(desde, hasta).forEach(function (ev) {
    var id = ev.getTag('gabinete');
    if (!id) return; // eventos cargados a mano en el calendario: no se tocan
    if (existentes[id]) { ev.deleteEvent(); return; } // duplicado
    existentes[id] = ev;
  });

  var n = { creadas: 0, actualizadas: 0, borradas: 0, pendiente: false };
  var quedan = {};
  tareas.forEach(function (t) {
    if (t.assignee_id !== yo && (t.co_assignees || []).indexOf(yo) < 0) return;
    quedan[t.id] = true;
    if (Date.now() - inicio > 240000) { n.pendiente = true; return; }
    var p = tableros[t.project_id];
    var titulo = (p ? (p.code ? p.code : p.name) + ' · ' : '') + t.title;
    var desc = 'Tarea de Gabinete\nTablero: ' + (p ? (p.code ? p.code + ' · ' : '') + p.name : 'Sin tablero') +
      '\nEstado: ' + (GCAL_ESTADOS[t.status] || t.status) + (t.notes ? '\nNotas: ' + String(t.notes).slice(0, 500) : '') +
      '\n\nAbrir la tarea: ' + APP_URL + '#tarea-' + t.id;
    var huella = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, titulo + '|' + t.due + '|' + desc, Utilities.Charset.UTF_8));
    var ev = existentes[t.id];
    if (ev && ev.getTag('huella') === huella) return;
    var dia = fechaDe(t.due);
    if (ev) {
      ev.setTitle(titulo); ev.setDescription(desc); ev.setAllDayDate(dia); n.actualizadas++;
    } else {
      ev = cal.createAllDayEvent(titulo, dia, { description: desc });
      ev.setTag('gabinete', t.id); n.creadas++;
    }
    ev.setTag('huella', huella);
  });
  Object.keys(existentes).forEach(function (id) {
    if (!quedan[id]) { existentes[id].deleteEvent(); n.borradas++; }
  });
  return n;
}

/* Google → Gabinete */
function eventosGoogle(desdeTxt, hastaTxt) {
  var a = fechaDe(desdeTxt), b = fechaDe(hastaTxt);
  b.setDate(b.getDate() + 1);
  if (!(b > a) || b - a > 100 * 864e5) throw new Error('Rango de fechas inválido');
  var propio = calendarioGabinete().getId();
  var out = [];
  CalendarApp.getAllCalendars().forEach(function (c) {
    if (c.getId() === propio || c.isHidden() || !c.isSelected()) return;
    var nombre = c.getName(), color = c.getColor();
    c.getEvents(a, b).forEach(function (e) {
      var todo = e.isAllDayEvent();
      var ini = todo ? e.getAllDayStartDate() : e.getStartTime();
      var fin = todo ? e.getAllDayEndDate() : e.getEndTime();
      out.push({
        id: e.getId() + '|' + ini.getTime(),
        t: e.getTitle() || '(Sin título)',
        s: todo ? fechaTxt(ini) : Utilities.formatDate(ini, GCAL_TZ, 'yyyy-MM-dd'),
        e: todo ? fechaTxt(new Date(Math.max(ini.getTime(), fin.getTime() - 864e5)))
          : Utilities.formatDate(new Date(Math.max(ini.getTime(), fin.getTime() - 1)), GCAL_TZ, 'yyyy-MM-dd'),
        h: todo ? '' : Utilities.formatDate(ini, GCAL_TZ, 'HH:mm'),
        hf: todo ? '' : Utilities.formatDate(fin, GCAL_TZ, 'HH:mm'),
        l: e.getLocation() || '',
        c: nombre,
        col: color
      });
    });
  });
  out.sort(function (x, y) { return x.s < y.s ? -1 : x.s > y.s ? 1 : (x.h || '') < (y.h || '') ? -1 : 1; });
  return out;
}

function calendarioGabinete() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('gcal_id');
  var c = id ? CalendarApp.getCalendarById(id) : null;
  if (c) return c;
  c = CalendarApp.getCalendarsByName(GCAL_NOMBRE).filter(function (x) { return x.isOwnedByMe(); })[0];
  if (!c) {
    c = CalendarApp.createCalendar(GCAL_NOMBRE, {
      summary: 'Tareas de Gabinete con fecha. Se actualiza solo desde el sistema; los cambios hechos acá no vuelven a Gabinete.',
      color: CalendarApp.Color.TEAL,
      timeZone: GCAL_TZ
    });
  }
  props.setProperty('gcal_id', c.getId());
  return c;
}
function fechaDe(s) { var p = String(s).split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }
// Fechas de día completo: en la zona del proyecto de Apps Script (la misma que usa new Date(a, m, d))
function fechaTxt(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
