// ---- Función "push" de Gabinete (Supabase Edge Function) ----
// Acciones (POST JSON, con la sesión del usuario en Authorization):
//   key          -> devuelve la clave pública VAPID (la crea la primera vez y la guarda en la base)
//   subscribe    -> guarda la suscripción de este dispositivo
//   unsubscribe  -> la borra
//   notify       -> avisa a responsables de una tarea (solo a quienes están asignados)
//   test         -> manda una notificación de prueba a mis dispositivos
//   update_all   -> (solo admin) avisa a todos los dispositivos que hay una versión nueva
// No necesita claves cargadas a mano: usa las variables que Supabase da a cada función.
const SUPA = Deno.env.get("SUPABASE_URL");
let SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
if (!SRK) { try { const k = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); SRK = k.default || Object.values(k)[0] || ""; } catch (_) {} }
const APP = "https://estudio-maker.github.io/gabinete/";
const SUBJECT = "mailto:estudio@perezramirezarquitectura.com";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return J({ ok: false, error: "Usá POST" }, 405);
  try {
    if (!SUPA || !SRK) return J({ ok: false, error: "La función no tiene acceso a la base." }, 500);
    const me = await caller(req); if (!me) return J({ ok: false, error: "Sesión no válida o usuario no habilitado." }, 401);
    const b = await req.json().catch(() => ({}));
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
