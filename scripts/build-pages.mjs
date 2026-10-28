// Arma la carpeta _site que publica GitHub Pages: comprime el HTML y vuelve ilegible el código de las apps.
// No publica los SQL, los README ni el script de Google. Uso: node scripts/build-pages.mjs
import fs from "node:fs";
import path from "node:path";
import { proteger } from "./proteger.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "_site");
const SKIP_DIRS = new Set([".git", ".github", "node_modules", "_site", "scripts", "supabase", "google-apps-script", "marcas", "_marcas"]);
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

await proteger(OUT, ["index.html", "casa/index.html"], ["sw.js", "casa/sw.js"]);
