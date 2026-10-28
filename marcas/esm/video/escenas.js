// Arma las escenas de los videos de instalación de ESM (PNG 1080x1920, cada una con y sin el anillo del toque).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const HOST = process.env.HOST || 'esm-equipo.onrender.com';
const D = __dirname;
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(path.join(D, f)).toString('base64');
const ICON = b64('icon-512.png'), LOGO = b64('logo.png'), LIOS = b64('login-ios.png'), LAND = b64('login-and.png');
const svg = (d, sw = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const SHARE = svg('<path d="M12 3v12M8 7l4-4 4 4M7 10H5v11h14V10h-2"/>');
const PLUSQ = svg('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>');
const DOTS_V = svg('<circle cx="12" cy="5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="19" r="1.3" fill="currentColor"/>', 1.5);
const STAR = svg('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>');
const BOOK = svg('<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>');
const SRCH = svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>');
const COPY = svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>');
const INST = svg('<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 7v7M9 11l3 3 3-3M10 18h4"/>');
const HOME = svg('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>');
const LOCK = '<span class="lk">🔒</span>';

const sbar = (dk) => `<div class="island"></div><div class="sb${dk ? ' dk' : ''}"><span>9:41</span><span>▂▄▆ ▮</span></div>`;
const colores = ['#34c759', '#ff9500', '#5ac8fa', '#ff2d55', '#af52de', '#ffcc00', '#007aff', '#8e8e93', '#30b0c7', '#ff3b30', '#64d2ff', '#a2845e'];
const nombres = ['Mensajes', 'Fotos', 'Cámara', 'Música', 'Mapas', 'Notas', 'Clima', 'Ajustes', 'Reloj', 'Calendario', 'Correo', 'Libros'];

// ---------- pantallas ----------
const S = {};
S.safari = () => `${sbar()}<div class="content" style="top:0;bottom:0;background-image:url(${LIOS});background-size:100% auto;background-position:center 64px"></div>
  <div class="sfbar"><div class="circ">‹</div><div class="pill">${LOCK}${HOST}</div><div class="circ" id="dots">⋯</div></div>`;
S.safariMenu = () => S.safari() + `<div class="dim"></div><div class="menu" style="right:24px;bottom:150px;width:520px">
  <div class="it hl" id="t">Compartir ${SHARE}</div><div class="it">Agregar a favoritos ${STAR}</div><div class="it">Agregar a la lista de lectura ${BOOK}</div><div class="it">Buscar en la página ${SRCH}</div></div>`;
S.shareIOS = (txt) => (txt === 'chrome' ? S.chrome() : S.safari()) + `<div class="dim"></div><div class="sheet"><div class="grab"></div>
  <div class="shead"><img src="${ICON}"><div><b>ESM</b><span>${HOST}</span></div></div>
  <div class="apps">${['AirDrop', 'Mensajes', 'Mail', 'WhatsApp', 'Notas'].map((n, i) => `<div><i style="background:${colores[(i * 3) % 12]}"></i>${n}</div>`).join('')}</div>
  <div class="list"><div class="it">Copiar ${COPY}</div><div class="it">Agregar a la lista de lectura ${BOOK}</div><div class="it">Agregar a favoritos ${STAR}</div>
  <div class="it hl" id="t">${txt === 'chrome' ? 'Agregar a pantalla de inicio' : 'Agregar a inicio'} ${PLUSQ}</div><div class="it">Buscar en la página ${SRCH}</div></div></div>`;
S.addIOS = (txt) => `${sbar(1)}<div class="add"><div class="nav"><span class="a">Cancelar</span><span class="t">${txt === 'chrome' ? 'Agregar a pantalla de inicio' : 'Agregar a inicio'}</span><span class="a b" id="t">Agregar</span></div>
  <div class="card"><img src="${ICON}"><div style="flex:1"><div class="f">ESM</div><div class="u">https://${HOST}/</div></div></div>
  ${txt === 'chrome' ? '' : `<div class="tog"><span>Abrir como app web</span><div class="sw"></div></div>`}
  <p class="note">Se agregará un ícono a tu pantalla de inicio para que puedas acceder rápidamente a este sitio web.</p></div>`;
const homeGrid = (and) => `<div class="home"></div><div class="grid">${nombres.map((n, i) => `<div class="ap"><i style="background:${colores[i]}"></i>${n}</div>`).join('')}
  <div class="ap" id="t"><img src="${ICON}">ESM</div></div>${and ? '' : `<div class="dock">${[0, 1, 2, 3].map(i => `<i style="background:${colores[i + 6]}"></i>`).join('')}</div>`}`;
S.homeIOS = () => sbar() + homeGrid(false);
S.appIOS = () => `${sbar()}<div class="content" style="top:64px;bottom:0;background-image:url(${LIOS});background-size:100% auto"></div>`;
S.chrome = () => `${sbar(1)}<div class="cbar"><div class="cpill">${LOCK}${HOST}</div><div class="cic" id="share">${SHARE}</div></div>
  <div class="content" style="top:174px;bottom:130px;background-image:url(${LIOS});background-size:100% auto"></div>
  <div class="ctool"><span>${svg('<path d="M15 18l-6-6 6-6"/>')}</span><span>${svg('<path d="M9 18l6-6-6-6"/>')}</span><span>${svg('<path d="M12 5v14M5 12h14"/>')}</span><span>${svg('<rect x="5" y="5" width="14" height="14" rx="3"/>')}</span><span>${svg('<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>', 1.5)}</span></div>`;
S.android = () => `${sbar(1)}<div class="abar"><span class="cic">${HOME}</span><div class="cpill" style="background:#f1f3f4;font-size:25px;padding:0 20px">${LOCK}${HOST}</div><div class="tabs">1</div><span class="cic" id="dots">${DOTS_V}</span></div>
  <div class="content" style="top:184px;bottom:0;background-image:url(${LAND});background-size:100% auto"></div>`;
S.androidMenu = () => S.android() + `<div class="dim" style="background:rgba(0,0,0,.18)"></div><div class="amenu">
  <div class="ic">${svg('<path d="M5 12h14M13 6l6 6-6 6"/>')}${STAR}${svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>')}${svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>')}${svg('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>')}</div>
  ${['Nueva pestaña', 'Historial', 'Descargas', 'Favoritos', 'Compartir…', 'Buscar en la página'].map(t => `<div class="it">${t}</div>`).join('')}
  <div class="it hl" id="t">${INST} Instalar app</div><div class="it">Sitio de escritorio</div><div class="it">Configuración</div></div>`;
S.androidDlg = () => S.android() + `<div class="dim"></div><div class="dlg"><h3>¿Instalar app?</h3><div class="r"><img src="${ICON}"><div><b style="font-weight:500">ESM</b><span>${HOST}</span></div></div>
  <div class="bt"><div>Cancelar</div><div class="p" id="t">Instalar</div></div></div>`;
S.homeAnd = () => sbar() + homeGrid(true);
S.appAnd = () => `${sbar()}<div class="content" style="top:64px;bottom:0;background-image:url(${LAND});background-size:100% auto"></div>`;

// ---------- armado de una escena ----------
function escena(e) {
  if (e.tipo === 'titulo') return `<div class="title"><img class="logo" src="${LOGO}"><h1>${e.h1}</h1>${e.p ? `<p>${e.p}</p>` : ''}${e.url ? `<div class="url">${HOST}</div>` : ''}</div><div class="foot">ESM · TAREAS DEL EQUIPO</div>`;
  return `<div class="top"><div class="chip">${e.paso ? `<span class="n">${e.paso}</span>` : ''}<span>${e.chip}</span></div><h1>${e.h1}</h1>${e.p ? `<p>${e.p}</p>` : ''}</div>
    <div class="phone${e.and ? ' and' : ''}"><div class="scr" id="scr">${S[e.pant](e.arg)}</div></div>`;
}

module.exports = { escena };

if (require.main === module) {
  const guion = JSON.parse(fs.readFileSync(path.join(D, 'guion.json'), 'utf8'));
  (async () => {
    const b = await chromium.launch();
    const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
    await p.goto('file://' + path.join(D, 'escena.html'));
    await p.waitForTimeout(1500);
    for (const [k, v] of Object.entries(guion)) {
      const dir = path.join(D, 'escenas', k); fs.mkdirSync(dir, { recursive: true });
      for (let i = 0; i < v.escenas.length; i++) {
        const e = v.escenas[i];
        await p.evaluate(h => { document.body.classList.remove('on'); document.getElementById('root').innerHTML = h; }, escena(e));
        await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(im => im.decode().catch(() => 0))); });
        // anillo alrededor del botón a tocar
        await p.evaluate((sel) => {
          document.querySelectorAll('.ring,.finger').forEach(x => x.remove());
          const t = sel && document.querySelector(sel); if (!t) return;
          const r = t.getBoundingClientRect(), pad = 18;
          const ring = document.createElement('div'); ring.className = 'ring';
          Object.assign(ring.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px', borderRadius: Math.min(60, (r.height + pad * 2) / 2) + 'px' });
          const f = document.createElement('div'); f.className = 'finger';
          Object.assign(f.style, { left: (r.left + r.width / 2 - 45) + 'px', top: (r.top + r.height / 2 - 45) + 'px' });
          document.body.append(ring);
        }, e.toque || null);
        const n = String(i + 1).padStart(2, '0');
        await p.screenshot({ path: path.join(dir, n + '.png') });
        if (e.toque) { await p.evaluate(() => document.body.classList.add('on')); await p.screenshot({ path: path.join(dir, n + 'b.png') }); }
      }
      console.log(k, v.escenas.length, 'escenas');
    }
    await b.close();
  })();
}
