// Arma una copia de Gabinete con otra marca (carpeta marcas/<marca>/): mismas funciones, otro nombre, logo y base de datos.
// Uso: node scripts/build-marca.mjs esm [--sin-proteger]
// Salida: _marcas/<marca>/sitio (lo que se publica) y _marcas/<marca>/supabase (SQL de instalación y funciones).
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MARCA = process.argv[2];
if (!MARCA || !fs.existsSync(path.join(ROOT, "marcas", MARCA, "marca.mjs"))) throw new Error("Uso: node scripts/build-marca.mjs <marca>");
const DIR = path.join(ROOT, "marcas", MARCA);
const M = await import(path.join(DIR, "marca.mjs"));
const OUT = path.join(ROOT, "_marcas", MARCA);
const SITIO = path.join(OUT, "sitio"), BASE = path.join(OUT, "supabase");
const leer = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const escribir = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const contar = (s, t) => s.split(t).length - 1;

// Reemplaza cada texto exactamente las veces esperadas; si no coincide, frena (Gabinete cambió ese texto).
function aplicar(s, lista, donde) {
  for (const [de, a, n = 1] of lista) {
    const c = contar(s, de);
    if (c !== n) throw new Error(`${donde}: «${de}» aparece ${c} veces (se esperaban ${n})`);
    s = s.split(de).join(a);
  }
  return s;
}
function reemplazarLinea(s, re, a, donde) {
  if (!re.test(s)) throw new Error(`${donde}: no se encontró ${re}`);
  return s.replace(re, a);
}

fs.rmSync(OUT, { recursive: true, force: true });

/* ---------- app ---------- */
let html = leer("index.html");
const SUPA_URL = `https://${M.supabase.ref}.supabase.co`;
html = aplicar(html, M.textos, "index.html");
html = reemplazarLinea(html, /const SUPA_URL="[^"]*";/, `const SUPA_URL="${SUPA_URL}";`, "index.html");
html = reemplazarLinea(html, /const SUPA_KEY="[^"]*";/, `const SUPA_KEY="${M.supabase.key}";`, "index.html");
html = reemplazarLinea(html, /const NOTIFY_URL="[^"]*";[^\n]*/, `const NOTIFY_URL="${M.notifyUrl}";`, "index.html");
html = reemplazarLinea(html, /const ETAPAS=\[[^\]]*\];/, `const ETAPAS=${JSON.stringify(M.etapas)};`, "index.html");
// Las novedades de Gabinete no aplican: se muestra una sola vez la bienvenida con lo que tiene la app
html = reemplazarLinea(html, /const CHANGELOG=\[[\s\S]*?\n\];/,
  `const CHANGELOG=[{v:APP_VERSION,d:${JSON.stringify(M.fechaBienvenida)},items:${JSON.stringify(M.bienvenida)}}];`, "index.html");
html = aplicar(html, [
  ['"Novedades de Gabinete"', `"Bienvenido a ${M.nombre}"`],
  ['function maybeNews(){ const seen=ls.get("gab.seenV"); if(seen===APP_VERSION) return;', 'function maybeNews(){ const seen=ls.get("gab.seenV"); if(seen) return;'],
  // en la pantalla de ingreso, el video de cómo instalar la app
  ['<div id="loginBody"><p>Cargando…</p></div>', '<div id="loginBody"><p>Cargando…</p></div><p style="margin:18px 0 0;font-size:13px"><a href="tutorial/" style="color:inherit;opacity:.85">▶ Video: cómo instalar la app en el celular</a></p>']
], "index.html");
html = html.split("Gabinete").join(M.nombre);
// No puede quedar nada del estudio
const resto = html.match(/Pérez|Ramírez|perezramirez|Arquitectura|estudio|ObraSys|github\.io|upvcwajccsmnqqvltgxp/g);
if (resto) {
  const sinComentarios = html.replace(/\/\*[\s\S]*?\*\//g, "");
  const r2 = sinComentarios.match(/Pérez|Ramírez|perezramirez|Arquitectura|estudio|ObraSys|github\.io|upvcwajccsmnqqvltgxp/g);
  if (r2) throw new Error("index.html: quedaron textos de Gabinete: " + [...new Set(r2)].join(", "));
}
escribir(path.join(SITIO, "index.html"), html);

escribir(path.join(SITIO, "sw.js"), leer("sw.js").split("Gabinete").join(M.nombre));
const man = JSON.parse(leer("manifest.webmanifest"));
man.name = M.titulo; man.short_name = M.nombre;
escribir(path.join(SITIO, "manifest.webmanifest"), JSON.stringify(man, null, 1));
for (const f of ["logo.png", "icon-192.png", "icon-512.png", "apple-touch-icon.png"]) fs.copyFileSync(path.join(DIR, f), path.join(SITIO, f));
// tutorial (página y videos)
if (fs.existsSync(path.join(DIR, "tutorial"))) fs.cpSync(path.join(DIR, "tutorial"), path.join(SITIO, "tutorial"), { recursive: true });

/* ---------- base de datos: un solo SQL para el proyecto nuevo ---------- */
const sqls = fs.readdirSync(path.join(ROOT, "supabase")).filter(f => /^\d\d_.*\.sql$/.test(f) && !f.startsWith("02_")).sort();
const a = M.supabase.admin;
let sql = `-- ${M.titulo} · instalación completa de la base (proyecto nuevo y vacío)\n-- Armado desde Gabinete: ${sqls.join(", ")}\n\n`;
for (const f of sqls) sql += `-- ======== ${f} ========\n` + leer("supabase/" + f) + "\n\n";
sql = sql.split("upvcwajccsmnqqvltgxp").join(M.supabase.ref)
  .split("'gabinete-vencimientos'").join(`'${MARCA}-vencimientos'`)
  .split("'gabinete-gcal'").join(`'${MARCA}-gcal'`);
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
sql = aplicar(sql, [["values ('estudio@perezramirezarquitectura.com', 'Estudio Pérez Ramírez', 'Administración', 0, true)",
  `values (${q(a.email)}, ${q(a.nombre)}, ${q(a.rol)}, 0, true)`]], "SQL");
sql += `select '${M.nombre}: base lista' as resultado;\n`;
escribir(path.join(BASE, "instalar.sql"), sql);

for (const fn of ["push", "gcal"]) {
  for (const f of fs.readdirSync(path.join(ROOT, "supabase/functions", fn))) {
    let s = leer(`supabase/functions/${fn}/${f}`);
    for (const [de, aa] of M.textosFunciones) s = s.split(de).join(aa);
    s = s.split("Gabinete").join(M.nombre);
    escribir(path.join(BASE, "functions", fn, f), s);
  }
}

if (!process.argv.includes("--sin-proteger")) {
  const { proteger } = await import("./proteger.mjs");
  await proteger(SITIO, ["index.html"], ["sw.js"]);
}
console.log("Listo:", path.relative(ROOT, OUT));
