// Arma la carpeta _site que publica GitHub Pages: comprime el HTML y vuelve ilegible el código de las apps.
// No publica los SQL, los README ni el script de Google. Uso: node scripts/build-pages.mjs
import fs from "node:fs";
import path from "node:path";
import { minify } from "html-minifier-terser";
import JavaScriptObfuscator from "javascript-obfuscator";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "_site");
const SKIP_DIRS = new Set([".git", ".github", "node_modules", "_site", "scripts", "supabase", "google-apps-script"]);
const SKIP_EXT = new Set([".sql", ".md", ".gs"]);

fs.rmSync(OUT, { recursive: true, force: true });
function copy(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const src = path.join(dir, e.name), rel = path.relative(ROOT, src), dst = path.join(OUT, rel);
    if (SKIP_DIRS.has(e.name)) continue;
    if (e.isDirectory()) { copy(src); continue; }
    if (SKIP_EXT.has(path.extname(e.name)) || e.name.startsWith(".")) continue;
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}
copy(ROOT);

const obf = code => JavaScriptObfuscator.obfuscate(code, {
  compact: true, simplify: true, stringArray: true, stringArrayEncoding: ["base64"], stringArrayThreshold: 0.75,
  identifierNamesGenerator: "hexadecimal", renameGlobals: false, selfDefending: false, controlFlowFlattening: false,
  deadCodeInjection: false, unicodeEscapeSequence: false
}).getObfuscatedCode();

for (const rel of ["index.html", "casa/index.html"]) {
  const f = path.join(OUT, rel);
  if (!fs.existsSync(f)) continue;
  let html = fs.readFileSync(f, "utf8");
  html = html.replace(/<script>([\s\S]*?)<\/script>/g, (m, code) => code.length > 2000 ? `<script>${obf(code)}</script>` : m);
  html = await minify(html, { collapseWhitespace: true, removeComments: true, minifyCSS: true, minifyJS: true });
  fs.writeFileSync(f, html);
  console.log(rel, (html.length / 1024).toFixed(0) + " KB");
}
for (const rel of ["sw.js", "casa/sw.js"]) {
  const f = path.join(OUT, rel);
  if (fs.existsSync(f)) fs.writeFileSync(f, obf(fs.readFileSync(f, "utf8")));
}
