// ---- Función "gcal" de Gabinete (Supabase Edge Function): sincronización con Google Calendar ----
// Cada persona del equipo conecta su propia cuenta de Google desde Gabinete. Desde ahí:
//  - Gabinete → Google: las tareas con fecha en las que es responsable (abiertas y NO privadas) se copian
//    como eventos de día completo a un calendario "Gabinete" que se crea en su Google Calendar. Cuando
//    alguien (cualquiera del equipo) cambia la fecha, el título, el tablero o los responsables, la base
//    llama a esta función y se actualiza el calendario de cada responsable. Si la tarea se termina, se
//    borra, se le quita la fecha o se marca privada, el evento se quita.
//  Solo va de Gabinete a Google: el calendario personal de cada uno no entra a Gabinete.
//
// Acciones (POST JSON):
//   con la sesión del usuario en Authorization:
//     status      -> si está conectado y con qué cuenta
//     connect     -> devuelve el enlace de Google para autorizar
//     disconnect  -> quita la conexión y borra el calendario "Gabinete" de su Google
//     sync        -> vuelve a sincronizar todas sus tareas
//   con la clave de push_cron (la usa la base):
//     task        -> sincroniza una tarea {id} para todos sus responsables conectados
//     sync_all    -> sincroniza todas las tareas de todas las personas conectadas (red de seguridad)
// GET ?code&state -> vuelta desde Google después de autorizar.
//
// Secretos que hay que cargar en Supabase: GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.
// "Verify JWT" desactivado: la función controla sola quién la llama.
const SUPA = Deno.env.get("SUPABASE_URL") || "";
let SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
if (!SRK) { try { const k = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); SRK = k.default || Object.values(k)[0] || ""; } catch (_) {} }
const GID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const GSECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const APP = "https://estudio-maker.github.io/gabinete/";
const REDIRECT = SUPA.replace(/^http:/, "https:") + "/functions/v1/gcal";
const SCOPES = "email https://www.googleapis.com/auth/calendar.app.created";
const CAL_NAME = "Gabinete";
const TZ = "America/Asuncion";
const STATUS = { todo: "Pendiente", doing: "En curso", review: "En revisión", done: "Terminado" };
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const svcHeaders = () => SRK.startsWith("sb_") ? { apikey: SRK } : { apikey: SRK, Authorization: "Bearer " + SRK };
const te = new TextEncoder();

async function rest(path, init = {}) {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, { ...init, headers: { ...svcHeaders(), "Content-Type": "application/json", ...(init.headers || {}) } });
  const t = await r.text(); if (!r.ok) throw new Error(`${path.split("?")[0]} ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}
async function caller(req) {
  const tok = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!tok) return null;
  const r = await fetch(`${SUPA}/auth/v1/user`, { headers: { apikey: SRK, Authorization: "Bearer " + tok } });
  if (!r.ok) return null; const u = await r.json(); const email = String(u.email || "").toLowerCase(); if (!email) return null;
  return (await rest(`members?email=eq.${encodeURIComponent(email)}&select=id,name,email`))[0] || null;
}

// ---- estado firmado para la vuelta de Google ----
const b64u = (buf) => { let s = ""; for (const x of new Uint8Array(buf)) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
async function sign(txt) {
  const k = await crypto.subtle.importKey("raw", te.encode(GSECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", k, te.encode(txt)));
}
async function makeState(memberId) { const p = memberId + "." + (Date.now() + 15 * 60e3); return p + "." + await sign(p); }
async function readState(st) {
  const [m, exp, sig] = String(st || "").split("."); if (!UUID.test(m || "") || !(+exp > Date.now())) return null;
  return sig === await sign(m + "." + exp) ? m : null;
}

// ---- Google ----
class GErr extends Error { status = 0; constructor(status, msg) { super(msg); this.status = status; } }
async function token(acc) {
  if (acc._at && acc._exp > Date.now()) return acc._at;
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: GID, client_secret: GSECRET, refresh_token: acc.refresh_token, grant_type: "refresh_token" }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (j.error === "invalid_grant") {
      await rest(`gcal_cuentas?member_id=eq.${acc.member_id}`, { method: "PATCH", body: JSON.stringify({ last_error: "Google quitó el permiso. Volvé a conectar." }) });
      acc.revoked = true;
    }
    throw new GErr(401, "Google: " + (j.error_description || j.error || r.status));
  }
  acc._at = j.access_token; acc._exp = Date.now() + (j.expires_in - 60) * 1000; return acc._at;
}
async function g(acc, path, init = {}) {
  const r = await fetch("https://www.googleapis.com/calendar/v3/" + path, { ...init, headers: { Authorization: "Bearer " + await token(acc), "Content-Type": "application/json", ...(init.headers || {}) } });
  if (r.status === 204) return null;
  const t = await r.text(); if (!r.ok) throw new GErr(r.status, `Google ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}
const calPath = (acc) => "calendars/" + encodeURIComponent(acc.calendar_id);

async function ensureCalendar(acc) {
  if (acc.calendar_id) {
    try { await g(acc, calPath(acc)); return; } catch (e) { if (!(e instanceof GErr) || (e.status !== 404 && e.status !== 410)) throw e; }
    await rest(`gcal_eventos?member_id=eq.${acc.member_id}`, { method: "DELETE" }); // el calendario ya no existe
  }
  const c = await g(acc, "calendars", { method: "POST", body: JSON.stringify({ summary: CAL_NAME, timeZone: TZ,
    description: "Tareas de Gabinete con fecha. Se actualiza solo desde el sistema; los cambios hechos acá no vuelven a Gabinete." }) });
  acc.calendar_id = c.id;
  await rest(`gcal_cuentas?member_id=eq.${acc.member_id}`, { method: "PATCH", body: JSON.stringify({ calendar_id: c.id }) });
}

// ---- tareas → eventos ----
const addDay = (s) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const resp = (t) => [...new Set([t.assignee_id, ...(t.co_assignees || [])].filter(Boolean))];
const wanted = (t) => t && t.due && t.status !== "done" && !t.private;
async function hash(s) { return b64u(await crypto.subtle.digest("SHA-256", te.encode(s))).slice(0, 22); }
async function eventBody(t, projs, members) {
  const p = projs[t.project_id];
  const summary = (p ? (p.code || p.name) + " · " : "") + t.title;
  const who = resp(t).map(id => members[id]).filter(Boolean).join(", ");
  const description = `Tarea de Gabinete\nTablero: ${p ? (p.code ? p.code + " · " : "") + p.name : "Sin tablero"}\nEstado: ${STATUS[t.status] || t.status}` +
    (who ? `\nResponsables: ${who}` : "") + (t.notes ? `\nNotas: ${String(t.notes).slice(0, 500)}` : "") + `\n\nAbrir la tarea: ${APP}#tarea-${t.id}`;
  const body = { summary, description, start: { date: t.due }, end: { date: addDay(t.due) }, transparency: "transparent",
    source: { title: "Gabinete", url: APP + "#tarea-" + t.id }, extendedProperties: { private: { gabinete: t.id } } };
  return { body, huella: await hash(JSON.stringify(body)) };
}
async function lookups(tasks) {
  const pids = [...new Set(tasks.map(t => t.project_id).filter(Boolean))];
  const projs = pids.length ? Object.fromEntries((await rest(`projects?id=in.(${pids.join(",")})&select=id,name,code`)).map(p => [p.id, p])) : {};
  const members = Object.fromEntries((await rest("members?select=id,name")).map(m => [m.id, m.name]));
  return { projs, members };
}
async function putEvent(acc, t, row, ev) {
  if (row && row.event_id) {
    if (row.huella === ev.huella) return "igual";
    try { await g(acc, `${calPath(acc)}/events/${encodeURIComponent(row.event_id)}`, { method: "PUT", body: JSON.stringify(ev.body) }); }
    catch (e) { if (!(e instanceof GErr) || (e.status !== 404 && e.status !== 410)) throw e; row = null; }
    if (row) { await rest(`gcal_eventos?task_id=eq.${t.id}&member_id=eq.${acc.member_id}`, { method: "PATCH", body: JSON.stringify({ huella: ev.huella }) }); return "actualizada"; }
  }
  const e = await g(acc, `${calPath(acc)}/events`, { method: "POST", body: JSON.stringify(ev.body) });
  await rest("gcal_eventos?on_conflict=task_id,member_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ task_id: t.id, member_id: acc.member_id, event_id: e.id, huella: ev.huella }) });
  return "creada";
}
async function dropEvent(acc, row) {
  if (row.event_id) {
    try { await g(acc, `${calPath(acc)}/events/${encodeURIComponent(row.event_id)}`, { method: "DELETE" }); }
    catch (e) { if (!(e instanceof GErr) || (e.status !== 404 && e.status !== 410)) throw e; }
  }
  await rest(`gcal_eventos?task_id=eq.${row.task_id}&member_id=eq.${row.member_id}`, { method: "DELETE" });
}
const TASK_COLS = "id,title,notes,due,status,private,project_id,assignee_id,co_assignees";

/** Sincroniza todas las tareas de una persona conectada. */
async function syncMember(acc) {
  const n = { creadas: 0, actualizadas: 0, quitadas: 0 };
  try {
    await ensureCalendar(acc);
    const id = acc.member_id;
    const tasks = (await rest(`tasks?due=not.is.null&status=neq.done&private=is.false&or=(assignee_id.eq.${id},co_assignees.cs.{${id}})&select=${TASK_COLS}`)).filter(wanted);
    const rows = Object.fromEntries((await rest(`gcal_eventos?member_id=eq.${id}&select=*`)).map(r => [r.task_id, r]));
    const { projs, members } = await lookups(tasks);
    for (const t of tasks) {
      const r = await putEvent(acc, t, rows[t.id], await eventBody(t, projs, members));
      if (r === "creada") n.creadas++; else if (r === "actualizada") n.actualizadas++;
      delete rows[t.id];
    }
    for (const r of Object.values(rows)) { await dropEvent(acc, r); n.quitadas++; }
    // Limpieza: eventos de Gabinete que quedaron sin registro (por ejemplo, dos cambios casi al mismo tiempo).
    // Los eventos que la persona cargue a mano en ese calendario no se tocan.
    const known = new Set((await rest(`gcal_eventos?member_id=eq.${id}&select=event_id`)).map(r => r.event_id));
    let page = "";
    for (let i = 0; i < 20; i++) {
      const q = new URLSearchParams({ maxResults: "250" }); if (page) q.set("pageToken", page);
      const r = await g(acc, `${calPath(acc)}/events?${q}`);
      for (const e of r.items || []) {
        const tid = e.extendedProperties && e.extendedProperties.private && e.extendedProperties.private.gabinete;
        if (tid && e.status !== "cancelled" && !known.has(e.id) && Date.parse(e.created || 0) < Date.now() - 120e3) {
          try { await g(acc, `${calPath(acc)}/events/${encodeURIComponent(e.id)}`, { method: "DELETE" }); n.quitadas++; }
          catch (x) { if (!(x instanceof GErr) || (x.status !== 404 && x.status !== 410)) throw x; }
        }
      }
      if (!(page = r.nextPageToken)) break;
    }
    await rest(`gcal_cuentas?member_id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ last_sync: new Date().toISOString(), last_error: null }) });
  } catch (e) {
    if (!acc.revoked) await rest(`gcal_cuentas?member_id=eq.${acc.member_id}`, { method: "PATCH", body: JSON.stringify({ last_error: String(e.message || e).slice(0, 300) }) }).catch(() => {});
    throw e;
  }
  return n;
}
/** Sincroniza una tarea en el calendario de cada responsable conectado (y la quita de quien ya no lo es). */
async function syncTask(id) {
  const t = (await rest(`tasks?id=eq.${id}&select=${TASK_COLS}`))[0] || null;
  const rows = await rest(`gcal_eventos?task_id=eq.${id}&select=*`);
  const want = wanted(t) ? resp(t) : [];
  const ids = [...new Set([...want, ...rows.map(r => r.member_id)])];
  if (!ids.length) return { cuentas: 0 };
  const accs = await rest(`gcal_cuentas?member_id=in.(${ids.join(",")})&select=*`);
  const lk = want.length ? await lookups([t]) : null;
  const ev = want.length ? await eventBody(t, lk.projs, lk.members) : null;
  let done = 0;
  for (const acc of accs) {
    if (!acc.calendar_id) continue;
    const row = rows.find(r => r.member_id === acc.member_id);
    try {
      if (want.includes(acc.member_id)) await putEvent(acc, t, row, ev);
      else if (row) await dropEvent(acc, row);
      done++;
    } catch (e) { console.warn("gcal task", acc.member_id, String(e)); }
  }
  return { cuentas: done };
}

// ---- vuelta desde Google ----
async function oauthReturn(url) {
  const back = (tag) => new Response(null, { status: 302, headers: { Location: APP + "#gcal-" + tag } });
  if (url.searchParams.get("error")) return back("cancelado");
  const member = await readState(url.searchParams.get("state"));
  const code = url.searchParams.get("code");
  if (!member || !code) return back("error");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: GID, client_secret: GSECRET, redirect_uri: REDIRECT, grant_type: "authorization_code" }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) { console.warn("gcal oauth", JSON.stringify(j)); return back("error"); }
  const granted = String(j.scope || "");
  if (!granted.includes("calendar.app.created")) return back("permisos");
  const prev = (await rest(`gcal_cuentas?member_id=eq.${member}&select=*`))[0];
  const refresh = j.refresh_token || (prev && prev.refresh_token);
  if (!refresh) return back("error");
  const acc = { member_id: member, refresh_token: refresh, calendar_id: prev ? prev.calendar_id : null, _at: j.access_token, _exp: Date.now() + (j.expires_in - 60) * 1000 };
  let email = "";
  try {
    const u = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: "Bearer " + j.access_token } });
    if (u.ok) email = String((await u.json()).email || "");
  } catch (_) {}
  if (prev && prev.google_email && email && prev.google_email !== email) {
    // Cambió de cuenta de Google: el calendario anterior queda en la otra cuenta
    acc.calendar_id = null; await rest(`gcal_eventos?member_id=eq.${member}`, { method: "DELETE" });
  }
  await rest("gcal_cuentas?on_conflict=member_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ member_id: member, refresh_token: refresh, google_email: email, calendar_id: acc.calendar_id, connected_at: new Date().toISOString(), last_error: null }) });
  try { await syncMember(acc); } catch (e) { console.warn("gcal first sync", String(e)); }
  return back("ok");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!SUPA || !SRK) return J({ ok: false, error: "La función no tiene acceso a la base." }, 500);
    if (!GID || !GSECRET) return J({ ok: false, error: "Falta configurar la conexión con Google." }, 500);
    if (req.method === "GET") return await oauthReturn(new URL(req.url));
    if (req.method !== "POST") return J({ ok: false, error: "Usá POST" }, 405);
    const b = await req.json().catch(() => ({}));
    if (b.secret && (b.action === "task" || b.action === "sync_all")) {
      const row = (await rest("push_cron?id=eq.1&select=secret"))[0];
      if (!row || String(b.secret) !== row.secret) return J({ ok: false, error: "Clave inválida" }, 401);
      if (b.action === "task") return UUID.test(b.id || "") ? J({ ok: true, ...(await syncTask(b.id)) }) : J({ ok: false, error: "Tarea inválida" }, 400);
      const accs = await rest("gcal_cuentas?calendar_id=not.is.null&select=*"); let ok = 0;
      for (const acc of accs) { try { await syncMember(acc); ok++; } catch (e) { console.warn("gcal sync_all", acc.member_id, String(e)); } }
      return J({ ok: true, cuentas: accs.length, sincronizadas: ok });
    }
    const me = await caller(req); if (!me) return J({ ok: false, error: "Sesión no válida o usuario no habilitado." }, 401);
    const acc = (await rest(`gcal_cuentas?member_id=eq.${me.id}&select=*`))[0] || null;
    if (b.action === "status") return J({ ok: true, connected: !!acc, email: acc ? acc.google_email : "", error: acc ? acc.last_error : null, last_sync: acc ? acc.last_sync : null });
    if (b.action === "connect") {
      const q = new URLSearchParams({ client_id: GID, redirect_uri: REDIRECT, response_type: "code", scope: SCOPES, access_type: "offline",
        prompt: "consent", include_granted_scopes: "true", state: await makeState(me.id) });
      if (/^[^@\s]+@[^@\s]+$/.test(me.email || "")) q.set("login_hint", me.email);
      return J({ ok: true, url: "https://accounts.google.com/o/oauth2/v2/auth?" + q });
    }
    if (!acc) return J({ ok: true, connected: false });
    if (b.action === "disconnect") {
      if (acc.calendar_id) { try { await g(acc, calPath(acc), { method: "DELETE" }); } catch (e) { console.warn("gcal delete cal", String(e)); } }
      try { await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(acc.refresh_token), { method: "POST" }); } catch (_) {}
      await rest(`gcal_cuentas?member_id=eq.${me.id}`, { method: "DELETE" });
      return J({ ok: true, connected: false });
    }
    if (b.action === "sync") return J({ ok: true, connected: true, ...(await syncMember(acc)) });
    return J({ ok: false, error: "Acción desconocida" }, 400);
  } catch (e) { console.error(e); return J({ ok: false, error: String(e && e.message || e) }, 500); }
});
