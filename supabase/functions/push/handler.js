// ---- Función "push" de Gabinete (Supabase Edge Function) ----
// Acciones (POST JSON, con la sesión del usuario en Authorization):
//   key          -> devuelve la clave pública VAPID (la crea la primera vez y la guarda en la base)
//   subscribe    -> guarda la suscripción de este dispositivo
//   unsubscribe  -> la borra
//   notify       -> avisa a responsables de una tarea (solo a quienes están asignados)
//   test         -> manda una notificación de prueba a mis dispositivos
//   update_all   -> (solo admin) avisa a todos los dispositivos que hay una versión nueva
//   due_daily    -> avisa a cada responsable de sus tareas que vencen en los próximos 3 días (hoy incluido).
//                   La llama todos los días el cron de la base (con la clave de push_cron) o un admin a mano.
//                   Cada persona recibe un solo aviso por día aunque se llame varias veces.
// No necesita claves cargadas a mano: usa las variables que Supabase da a cada función.
const SUPA = Deno.env.get("SUPABASE_URL");
let SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
if (!SRK) { try { const k = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); SRK = k.default || Object.values(k)[0] || ""; } catch (_) {} }
const APP = "https://estudio-maker.github.io/gabinete/";
const SUBJECT = "mailto:estudio@perezramirezarquitectura.com";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const TZ = "America/Asuncion";
const DUE_DAYS = 3;
const MES3 = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const svcHeaders = () => SRK.startsWith("sb_") ? { apikey: SRK } : { apikey: SRK, Authorization: "Bearer " + SRK };

async function rest(path, init = {}) {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, { ...init, headers: { ...svcHeaders(), "Content-Type": "application/json", ...(init.headers || {}) } });
  const t = await r.text(); if (!r.ok) throw new Error(`${path.split("?")[0]} ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}
let VAPID = null;
async function vapid() {
  if (VAPID) return VAPID;
  const row = (await rest("push_config?id=eq.1&select=data"))[0];
  if (row) return (VAPID = row.data);
  const v = await generateVapid();
  await rest("push_config?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ id: 1, data: v }) });
  return (VAPID = (await rest("push_config?id=eq.1&select=data"))[0].data);
}
async function caller(req) {
  const tok = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!tok) return null;
  const r = await fetch(`${SUPA}/auth/v1/user`, { headers: { apikey: SRK, Authorization: "Bearer " + tok } });
  if (!r.ok) return null; const u = await r.json(); const email = String(u.email || "").toLowerCase(); if (!email) return null;
  return (await rest(`members?email=eq.${encodeURIComponent(email)}&select=id,name,email`))[0] || null;
}
async function deliver(subs, payload) {
  const v = await vapid(); let ok = 0;
  await Promise.all(subs.map(async s => {
    try {
      const st = await sendPush(s, payload, v, SUBJECT);
      if (st >= 200 && st < 300) { ok++; await rest(`push_subs?id=eq.${s.id}`, { method: "PATCH", body: JSON.stringify({ last_ok: new Date().toISOString() }) }); }
      else if (st === 404 || st === 410) await rest(`push_subs?id=eq.${s.id}`, { method: "DELETE" });
      else console.warn("push status", st, new URL(s.endpoint).host);
    } catch (e) { console.warn("push error", String(e)); }
  }));
  return ok;
}

// ---- avisos de vencimiento ----
const ymdIn = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const addDays = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diffDays = (a, b) => Math.round((Date.parse(a + "T12:00:00Z") - Date.parse(b + "T12:00:00Z")) / 864e5);
const whenTxt = (n, due) => n === 0 ? "hoy" : n === 1 ? "mañana" : `en ${n} días (${+due.slice(8)} ${MES3[+due.slice(5, 7) - 1]})`;

async function dueDaily(force) {
  const today = ymdIn(new Date()), lim = addDays(today, DUE_DAYS);
  const tasks = await rest(`tasks?status=neq.done&due=gte.${today}&due=lte.${lim}&select=id,title,project_id,assignee_id,co_assignees,due&order=due.asc`);
  const byMember = {};
  for (const t of tasks) for (const m of new Set([t.assignee_id, ...(t.co_assignees || [])].filter(Boolean))) (byMember[m] = byMember[m] || []).push(t);
  let ids = Object.keys(byMember);
  if (!ids.length) return { today, tasks: 0, people: 0, sent: 0 };
  if (!force) {
    const done = new Set((await rest(`push_avisos?dia=eq.${today}&select=member_id`)).map(r => r.member_id));
    ids = ids.filter(id => !done.has(id));
  }
  const pids = [...new Set(tasks.map(t => t.project_id).filter(Boolean))];
  const projs = pids.length ? Object.fromEntries((await rest(`projects?id=in.(${pids.join(",")})&select=id,name`)).map(p => [p.id, p.name])) : {};
  const subs = ids.length ? await rest(`push_subs?member_id=in.(${ids.join(",")})&select=*`) : [];
  let sent = 0, people = 0;
  for (const id of ids) {
    const L = byMember[id], mine = subs.filter(s => s.member_id === id);
    if (mine.length) {
      let payload;
      if (L.length === 1) {
        const t = L[0], n = diffDays(t.due, today);
        payload = { title: n === 0 ? "Vence hoy" : `Vence ${whenTxt(n, t.due)}`, body: t.title + (projs[t.project_id] ? ` · ${projs[t.project_id]}` : ""), url: APP + "#tarea-" + t.id, tag: "vence" };
      } else {
        const hoy = L.filter(t => t.due === today).length;
        const lines = L.slice(0, 4).map(t => { const n = diffDays(t.due, today); return `${n === 0 ? "Hoy" : n === 1 ? "Mañana" : whenTxt(n, t.due).replace(/^en/, "En")}: ${t.title}`; });
        payload = { title: `Tenés ${L.length} tareas por vencer` + (hoy ? ` (${hoy} hoy)` : ""), body: lines.join("\n") + (L.length > 4 ? `\n+${L.length - 4} más` : ""),
          url: APP + (hoy === L.length ? "#ver-today" : "#ver-week"), tag: "vence" };
      }
      const n = await deliver(mine, payload); sent += n; if (n) people++;
    }
    if (!force) await rest("push_avisos?on_conflict=dia,member_id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ dia: today, member_id: id }) });
  }
  return { today, tasks: tasks.length, people, sent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return J({ ok: false, error: "Usá POST" }, 405);
  try {
    if (!SUPA || !SRK) return J({ ok: false, error: "La función no tiene acceso a la base." }, 500);
    const b = await req.json().catch(() => ({}));
    if (b.action === "due_daily" && b.secret) {
      const row = (await rest("push_cron?id=eq.1&select=secret"))[0];
      if (!row || String(b.secret) !== row.secret) return J({ ok: false, error: "Clave inválida" }, 401);
      return J({ ok: true, ...(await dueDaily(false)) });
    }
    const me = await caller(req); if (!me) return J({ ok: false, error: "Sesión no válida o usuario no habilitado." }, 401);
    if (b.action === "key") return J({ ok: true, publicKey: (await vapid()).publicKey });
    if (b.action === "subscribe") {
      const s = b.sub || {}, k = s.keys || {};
      if (!/^https:\/\//.test(s.endpoint || "") || !k.p256dh || !k.auth) return J({ ok: false, error: "Suscripción inválida" }, 400);
      await rest("push_subs?on_conflict=endpoint", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ member_id: me.id, endpoint: s.endpoint, p256dh: k.p256dh, auth: k.auth, ua: String(b.ua || "").slice(0, 200) }) });
      return J({ ok: true });
    }
    if (b.action === "unsubscribe") {
      if (b.endpoint) await rest(`push_subs?endpoint=eq.${encodeURIComponent(b.endpoint)}&member_id=eq.${me.id}`, { method: "DELETE" });
      return J({ ok: true });
    }
    if (b.action === "test") {
      const subs = await rest(`push_subs?member_id=eq.${me.id}&select=*`);
      const n = await deliver(subs, { title: "Gabinete", body: "Las notificaciones funcionan en este dispositivo.", url: APP, tag: "prueba" });
      return J({ ok: true, devices: subs.length, sent: n });
    }
    if (b.action === "update_all") {
      const adm = (await rest(`members?id=eq.${me.id}&select=is_admin`))[0];
      if (!adm || !adm.is_admin) return J({ ok: false, error: "Solo un administrador puede avisar a todos." }, 403);
      const subs = await rest("push_subs?select=*");
      const n = await deliver(subs, { title: "Gabinete se actualizó", body: "Tocá para abrir la versión nueva.", url: APP + "?actualizar=" + Date.now(), tag: "actualizacion" });
      return J({ ok: true, devices: subs.length, sent: n });
    }
    if (b.action === "due_daily") {
      const adm = (await rest(`members?id=eq.${me.id}&select=is_admin`))[0];
      if (!adm || !adm.is_admin) return J({ ok: false, error: "Solo un administrador puede mandar los avisos de vencimiento." }, 403);
      return J({ ok: true, ...(await dueDaily(true)) });
    }
    if (b.action === "notify") {
      if (!UUID.test(b.taskId || "")) return J({ ok: false, error: "Tarea inválida" }, 400);
      const t = (await rest(`tasks?id=eq.${b.taskId}&select=id,title,project_id,assignee_id,co_assignees,due`))[0];
      if (!t) return J({ ok: false, error: "No se encontró la tarea" }, 404);
      const assigned = new Set([t.assignee_id, ...(t.co_assignees || [])].filter(Boolean));
      const to = [...new Set((b.to || []).filter(x => UUID.test(x) && assigned.has(x) && x !== me.id))];
      if (!to.length) return J({ ok: true, sent: 0 });
      const p = t.project_id ? (await rest(`projects?id=eq.${t.project_id}&select=name,code`))[0] : null;
      const subs = await rest(`push_subs?member_id=in.(${to.join(",")})&select=*`);
      const first = String(me.name || "Alguien").trim().split(/\s+/)[0];
      const n = await deliver(subs, { title: `${first} te asignó una tarea`, body: t.title + (p ? ` · ${p.name}` : ""), url: APP + "#tarea-" + t.id, tag: "tarea-" + t.id });
      return J({ ok: true, devices: subs.length, sent: n });
    }
    return J({ ok: false, error: "Acción desconocida" }, 400);
  } catch (e) { console.error(e); return J({ ok: false, error: String(e && e.message || e) }, 500); }
});
