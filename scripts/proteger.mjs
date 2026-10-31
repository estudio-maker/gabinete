// Comprime el HTML y vuelve ilegible el código de una app ya copiada en la carpeta de salida.
// Lo usan build-pages.mjs (Gabinete y Casa) y build-marca.mjs (copias con otra marca).
import fs from "node:fs";
import path from "node:path";
import { minify } from "html-minifier-terser";
import JavaScriptObfuscator from "javascript-obfuscator";

export const obf = code => JavaScriptObfuscator.obfuscate(code, {
  compact: true, simplify: true, stringArray: true, stringArrayEncoding: ["base64"], stringArrayThreshold: 0.75,
  identifierNamesGenerator: "hexadecimal", renameGlobals: false, selfDefending: false, controlFlowFlattening: false,
  deadCodeInjection: false, unicodeEscapeSequence: false
}).getObfuscatedCode();

export async function proteger(out, htmls, sws) {
  for (const rel of htmls) {
    const f = path.join(out, rel);
    if (!fs.existsSync(f)) continue;
    let html = fs.readFileSync(f, "utf8");
    // ofuscado, "const APP_VERSION=..." deja de verse en el HTML publicado y el aviso de versión nueva
    // salía siempre: la versión queda a la vista en una etiqueta <meta> y el aviso la lee de ahí
    const ver = html.match(/const APP_VERSION="([^"]+)"/);
    if (ver) html = html.split('.match(/const APP_VERSION="([^"]+)"/)').join('.match(/<meta name="app-version" content="([^"]+)">/)')
      .replace("</head>", `<meta name="app-version" content="${ver[1]}"></head>`);
    html = html.replace(/<script>([\s\S]*?)<\/script>/g, (m, code) => code.length > 2000 ? `<script>${obf(code)}</script>` : m);
    html = await minify(html, { collapseWhitespace: true, removeComments: true, minifyCSS: true, minifyJS: true });
    fs.writeFileSync(f, html);
    console.log(rel, (html.length / 1024).toFixed(0) + " KB");
  }
  for (const rel of sws) {
    const f = path.join(out, rel);
    if (fs.existsSync(f)) fs.writeFileSync(f, obf(fs.readFileSync(f, "utf8")));
  }
}
