/**
 * Gabinete · Pérez Ramírez Arquitectura
 * Envía el aviso por mail cuando se asigna una tarea (a uno o a varios responsables).
 * Se publica como "Aplicación web" desde la cuenta estudio@perezramirezarquitectura.com
 * (Ejecutar como: yo · Quién tiene acceso: cualquier usuario).
 *
 * Seguridad: solo envía si quien lo pide tiene una sesión válida de Gabinete y está
 * habilitado en el equipo. El destinatario y el contenido se leen de la base de datos,
 * nunca del pedido, así que no se puede usar para mandar mails arbitrarios.
 */
var SUPA_URL = 'https://upvcwajccsmnqqvltgxp.supabase.co';
var SUPA_KEY = 'sb_publishable_JszZ8ruwGr9Y2jRznvsm8A_IRgq1aTE';
var APP_URL = 'https://estudio-maker.github.io/gabinete/';
var REMITENTE = 'Gabinete · Pérez Ramírez Arquitectura';

var ESTADOS = { todo: 'Pendiente', doing: 'En curso', review: 'En revisión', done: 'Terminado' };
var PRIORIDADES = ['Normal', 'Alta', 'Urgente'];
var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function doGet() {
  return salida({ ok: true, servicio: 'Avisos de Gabinete' });
}

function doPost(e) {
  try {
    var pedido = JSON.parse(e.postData.contents || '{}');
    var token = pedido.token;
    var taskId = String(pedido.taskId || '');
    if (!token || !/^[0-9a-f-]{36}$/.test(taskId)) return salida({ ok: false, error: 'Pedido inválido' });

    var H = { apikey: SUPA_KEY, Authorization: 'Bearer ' + token };
    var u = UrlFetchApp.fetch(SUPA_URL + '/auth/v1/user', { headers: H, muteHttpExceptions: true });
    if (u.getResponseCode() !== 200) return salida({ ok: false, error: 'Tu sesión venció. Volvé a entrar.' });
    var usuario = JSON.parse(u.getContentText());

    var leer = function (ruta) {
      var r = UrlFetchApp.fetch(SUPA_URL + '/rest/v1/' + ruta, { headers: H, muteHttpExceptions: true });
      if (r.getResponseCode() !== 200) throw new Error('No se pudo leer la base (' + r.getResponseCode() + ')');
      return JSON.parse(r.getContentText());
    };

    var quien = leer('members?email=eq.' + encodeURIComponent(String(usuario.email || '').toLowerCase()) + '&select=name,email')[0];
    if (!quien) return salida({ ok: false, error: 'Tu usuario no está habilitado en Gabinete.' });

    var t = leer('tasks?id=eq.' + taskId + '&select=*')[0];
    if (!t) return salida({ ok: false, error: 'No se encontró la tarea.' });
    var asignados = [t.assignee_id].concat(t.co_assignees || []).filter(function (x) { return !!x; });
    if (!asignados.length) return salida({ ok: false, error: 'La tarea no tiene responsable.' });
    var destino = pedido.to ? String(pedido.to) : asignados[0];
    if (asignados.indexOf(destino) < 0) return salida({ ok: false, error: 'Esa persona no es responsable de la tarea.' });
    var m = leer('members?id=eq.' + destino + '&select=name,email')[0];
    if (!m || !m.email) return salida({ ok: false, error: 'El responsable no tiene mail cargado.' });
    var p = t.project_id ? leer('projects?id=eq.' + t.project_id + '&select=name,code')[0] : null;

    // Límite: 30 avisos cada 10 minutos por persona
    var cache = CacheService.getScriptCache();
    var clave = 'n:' + usuario.id;
    var n = Number(cache.get(clave) || 0);
    if (n >= 30) return salida({ ok: false, error: 'Demasiados avisos seguidos. Esperá unos minutos.' });
    cache.put(clave, String(n + 1), 600);

    var tablero = p ? ((p.code ? p.code + ' · ' : '') + p.name) : 'Sin tablero';
    var vence = t.due ? fechaLarga(t.due) : 'Sin fecha';
    var enlace = APP_URL + '#tarea-' + t.id;
    var nombre = primerNombre(m.name);
    var asunto = 'Tarea asignada: ' + t.title + ' (' + (p ? p.name : 'Gabinete') + ')';

    var texto = 'Hola ' + nombre + ',\n\n' + quien.name + ' te asignó una tarea en Gabinete.\n\n' +
      'Tarea: ' + t.title + '\nTablero: ' + tablero + '\nEstado: ' + (ESTADOS[t.status] || t.status) +
      '\nVence: ' + vence + '\nPrioridad: ' + (PRIORIDADES[t.prio || 0]) + (t.notes ? '\nNotas: ' + t.notes : '') +
      '\n\nAbrir la tarea: ' + enlace + '\nAbrir el sistema: ' + APP_URL + '\n';

    var fila = function (k, v) {
      return '<tr><td style="padding:4px 14px 4px 0;color:#7C858A;font-size:13px;white-space:nowrap">' + k +
        '</td><td style="padding:4px 0;font-size:14px;color:#16191B">' + esc(v) + '</td></tr>';
    };
    var html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#16191B">' +
      '<div style="background:#1E2326;color:#EEF0EE;padding:14px 20px;border-radius:10px 10px 0 0;font-size:13px;letter-spacing:.12em;text-transform:uppercase;font-weight:bold">Gabinete · Pérez Ramírez Arquitectura</div>' +
      '<div style="border:1px solid #D6DBD9;border-top:0;border-radius:0 0 10px 10px;padding:20px">' +
      '<p style="margin:0 0 6px;font-size:14px">Hola ' + esc(nombre) + ',</p>' +
      '<p style="margin:0 0 16px;font-size:14px">' + esc(quien.name) + ' te asignó una tarea:</p>' +
      '<p style="margin:0 0 14px;font-size:19px;font-weight:bold">' + esc(t.title) + '</p>' +
      '<table style="border-collapse:collapse;margin:0 0 18px">' + fila('Tablero', tablero) + fila('Estado', ESTADOS[t.status] || t.status) +
      fila('Vence', vence) + fila('Prioridad', PRIORIDADES[t.prio || 0]) + (t.notes ? fila('Notas', String(t.notes).slice(0, 400)) : '') + '</table>' +
      '<a href="' + enlace + '" style="display:inline-block;background:#1F5E5B;color:#FFFFFF;text-decoration:none;padding:11px 18px;border-radius:7px;font-size:14px;font-weight:bold">Abrir la tarea</a>' +
      '<span style="display:inline-block;width:10px"></span><a href="' + APP_URL + '" style="color:#1F5E5B;font-size:14px">Ir al sistema</a>' +
      '<p style="margin:18px 0 0;font-size:12px;color:#7C858A">Para entrar escribí tu mail en la pantalla de ingreso y usá el código que te llega. Funciona en la computadora y en el celular.</p>' +
      '</div></div>';

    MailApp.sendEmail({ to: m.email, subject: asunto, body: texto, htmlBody: html, name: REMITENTE, replyTo: quien.email });
    return salida({ ok: true });
  } catch (err) {
    return salida({ ok: false, error: String(err && err.message || err) });
  }
}

function salida(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function primerNombre(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
function fechaLarga(s) {
  var p = String(s).split('-'); var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()];
}
