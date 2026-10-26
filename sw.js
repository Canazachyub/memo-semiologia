// Service worker de Memo Semiología (PWA offline). Dueño: paquete C.
// Estrategias:
//  - Navegación, js, css, json y manifest: RED PRIMERO (con tiempo límite) y copia en caché.
//    Así en desarrollo y tras publicar se ve siempre lo último; sin red se sirve la copia.
//  - img/**: caché primero (caché en ejecución con tope de entradas).
//  - Teselas CARTO, Leaflet (unpkg/jsdelivr, URL con versión) y Google Fonts: caché primero con tope.
// La lista y la versión las regenera `py tools/precache.py`.

// <precache> (generado por tools/precache.py; no editar a mano)
const VERSION = '634b764a91';
const PRECACHE = ["./", "index.html", "manifest.webmanifest", "js/ajustes.js", "js/app.js", "js/ciudad.js", "js/entrenar.js", "js/hoy.js", "js/juego-caza.js", "js/juego-estado.js", "js/juego-util.js", "js/juego.js", "js/metodos.js", "js/mias.js", "js/plan.js", "js/progreso.js", "js/repaso.js", "js/respaldo.js", "js/srs.js", "js/util.js", "js/vistas.js", "css/ajustes.css", "css/app.css", "css/ciudad.css", "css/entrenar.css", "css/juego.css", "css/metodos.css", "css/repaso.css", "css/vistas.css", "data/atlas.json", "data/casos.json", "data/mapa.json", "data/memoria.json", "data/memoria_facies.json", "data/memoria_siglas.json", "data/metodos.json", "data/palacios.json", "data/ruta_diaria.json", "data/tabla00_99.json", "img/icon-192.png", "img/icon-512.png", "img/icon-maskable-512.png", "img/avatar.webp", "img/avatar_cara.webp"];
const IMAGENES = ["img/facies/acromegalica.webp", "img/facies/adenoidea.webp", "img/facies/aortica.webp", "img/facies/basedowiana-hipertiroidea.webp", "img/facies/caquectica.webp", "img/facies/cianotica.webp", "img/facies/cushing-luna-llena.webp", "img/facies/de-ayerza.webp", "img/facies/de-claude-bernard-horner.webp", "img/facies/de-depresion.webp", "img/facies/esclerodermica-o-de-momia.webp", "img/facies/etilica.webp", "img/facies/febril.webp", "img/facies/hipocratica-o-peritoneal.webp", "img/facies/icterica.webp", "img/facies/leonina.webp", "img/facies/lupica.webp", "img/facies/miastenica.webp", "img/facies/mitral.webp", "img/facies/mixedematosa.webp", "img/facies/nefritica-o-renal.webp", "img/facies/neumonica.webp", "img/facies/palida.webp", "img/facies/paralisis-facial-periferica.webp", "img/facies/parkinsoniana.webp", "img/lugares/escalas.webp", "img/lugares/s1.webp", "img/lugares/s10.webp", "img/lugares/s11.webp", "img/lugares/s12.webp", "img/lugares/s2.webp", "img/lugares/s3.webp", "img/lugares/s4.webp", "img/lugares/s5.webp", "img/lugares/s6.webp", "img/lugares/s7.webp", "img/lugares/s8.webp", "img/lugares/s9.webp", "img/memo/amilasa-serica.webp", "img/memo/ascitis-gasa.webp", "img/memo/ascitis-pmn-pbe.webp", "img/memo/aspecto-y-color-de-orina.webp", "img/memo/bilirrubina-directa-conjugada.webp", "img/memo/calcio-serico.webp", "img/memo/cilindros-urinarios.webp", "img/memo/clase-funcional-nyha.webp", "img/memo/cloro-serico.webp", "img/memo/coledoco-ecografia.webp", "img/memo/criterios-de-centor.webp", "img/memo/ecg-complejo-qrs.webp", "img/memo/ecg-frecuencia-cardiaca.webp", "img/memo/ecg-intervalo-pr.webp", "img/memo/ecg-segmento-st.webp", "img/memo/edema-signo-de-godet-fovea.webp", "img/memo/eritrocitosis-de-altura-hb.webp", "img/memo/escala-de-coma-de-glasgow.webp", "img/memo/fosfatasa-alcalina-fa.webp", "img/memo/frecuencia-cardiaca-pulso.webp", "img/memo/frecuencia-de-deposiciones.webp", "img/memo/frecuencia-respiratoria.webp", "img/memo/fuerza-muscular-mrc-daniels.webp", "img/memo/gases-hco3.webp", "img/memo/gases-paco2.webp", "img/memo/gases-ph-arterial.webp", "img/memo/gases-sato2-arterial.webp", "img/memo/ggt-gt.webp", "img/memo/glucosa-en-ayunas.webp", "img/memo/hematocrito.webp", "img/memo/hemoglobina.webp", "img/memo/ictericia.webp", "img/memo/lcr-glucosa.webp", "img/memo/lcr-patron-bacteriano-piogeno.webp", "img/memo/leucocitos-totales.webp", "img/memo/neutrofilos-segmentados.webp", "img/memo/peso-talla-imc.webp", "img/memo/plaquetas.webp", "img/memo/pleural-celulas.webp", "img/memo/pleural-criterios-de-light.webp", "img/memo/pleural-glucosa-ph-y-ldh.webp", "img/memo/potasio-serico.webp", "img/memo/presion-arterial.webp", "img/memo/qsofa.webp", "img/memo/rx-torax-condensacion.webp", "img/memo/rx-torax-derrame-pleural.webp", "img/memo/rx-torax-indice-cardiotoracico.webp", "img/memo/rx-torax-neumotorax.webp", "img/memo/saturacion-de-oxigeno.webp", "img/memo/score-de-wells-para-tvp.webp", "img/memo/sodio-serico.webp", "img/memo/soplos-freeman-levine.webp", "img/memo/temperatura.webp", "img/memo/tgo-ast.webp", "img/memo/tgp-alt.webp", "img/memo/tp-inr.webp", "img/memo/vcm.webp", "img/memo/vesicula-pared-calculos.webp", "img/memo/volumen-urinario.webp"];
const PESO_IMAGENES = 12938542;
// </precache>

const SHELL = `memo-shell-${VERSION}`;
const IMG = 'memo-img-v1';
const EXT = 'memo-ext-v1';
const TESELAS = 'memo-teselas-v1';
const TOPE = { [IMG]: 600, [TESELAS]: 400, [EXT]: 60 };
const ESPERA_RED = 4000; // ms antes de servir la copia si la red no responde

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) =>
    // allSettled: un archivo que falte no debe impedir la instalación
    Promise.allSettled(PRECACHE.map((u) => c.add(new Request(u, { cache: 'reload' })))),
  ));
  // primera instalación: activarse ya; en actualizaciones se espera a que el usuario pulse "Recargar"
  if (!self.registration.active) self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const vivas = new Set([SHELL, IMG, EXT, TESELAS]);
    for (const k of await caches.keys()) if (k.startsWith('memo-') && !vivas.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  const d = e.data || {};
  const responder = (m) => e.source?.postMessage(m);
  if (d.tipo === 'SALTAR') self.skipWaiting();
  else if (d.tipo === 'VERSION') responder({ tipo: 'VERSION', version: VERSION, imagenes: IMAGENES.length, peso: PESO_IMAGENES });
  else if (d.tipo === 'ESTADO') e.waitUntil(estado().then((s) => responder({ tipo: 'ESTADO', ...s })));
  else if (d.tipo === 'DESCARGAR_IMG') e.waitUntil(descargarImagenes(responder));
  else if (d.tipo === 'LIMPIAR') e.waitUntil(Promise.all([IMG, TESELAS, EXT].map((k) => caches.delete(k))).then(() => responder({ tipo: 'LIMPIO' })));
});

async function estado() {
  const c = await caches.open(IMG);
  const ya = new Set((await c.keys()).map((r) => new URL(r.url).pathname));
  const base = new URL(self.registration.scope).pathname;
  const enCache = IMAGENES.filter((p) => ya.has(base + p)).length;
  return { version: VERSION, imagenes: IMAGENES.length, enCache, peso: PESO_IMAGENES };
}

async function descargarImagenes(responder) {
  const c = await caches.open(IMG);
  let hechas = 0, fallidas = 0;
  const cola = [...IMAGENES];
  const trabajador = async () => {
    while (cola.length) {
      const u = cola.shift();
      try {
        if (!(await c.match(u))) { const r = await fetch(u); if (r.ok) await c.put(u, r); else fallidas++; }
      } catch { fallidas++; }
      hechas++;
      if (hechas % 5 === 0 || hechas === IMAGENES.length) responder({ tipo: 'PROGRESO_IMG', hechas, total: IMAGENES.length, fallidas });
    }
  };
  await Promise.all([1, 2, 3, 4].map(trabajador));
  responder({ tipo: 'IMG_LISTO', total: IMAGENES.length, fallidas });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.searchParams.has('sw-omitir')) return;
    if (req.mode === 'navigate') return e.respondWith(redPrimero(req, true));
    if (url.pathname.includes('/img/')) return e.respondWith(cachePrimero(req, IMG));
    if (/\.(js|mjs|css|json|webmanifest|html)$/.test(url.pathname)) return e.respondWith(redPrimero(req, false));
    return; // lo demás, directo a la red
  }
  if (/(^|\.)basemaps\.cartocdn\.com$/.test(url.hostname)) return e.respondWith(cachePrimero(req, TESELAS));
  // librerías con versión fija (leaflet@1.9.4) y fuentes: no cambian → caché primero
  if (/^(unpkg\.com|cdn\.jsdelivr\.net|fonts\.gstatic\.com|fonts\.googleapis\.com)$/.test(url.hostname)) return e.respondWith(cachePrimero(req, EXT));
});

const claveSinQuery = (req) => { const u = new URL(req.url); u.search = ''; u.hash = ''; return u.href; };

async function redPrimero(req, navegacion) {
  const cache = await caches.open(SHELL);
  let clave = claveSinQuery(req);
  if (clave.endsWith('/')) clave += 'index.html';
  // no-cache: revalida con el servidor (304 si no cambió), así nunca se sirve un módulo viejo de la caché HTTP
  const red = (navegacion ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' })).then((r) => {
    if (r.ok && r.type === 'basic') cache.put(clave, r.clone()).catch(() => {});
    return r;
  });
  const inicio = new URL('index.html', self.registration.scope).href;
  const copia = () => cache.match(clave).then((r) => r || (navegacion ? cache.match(inicio).then((x) => x || cache.match('./')) : undefined));
  try {
    return await Promise.race([red, new Promise((_, no) => setTimeout(() => no(new Error('lenta')), ESPERA_RED))]);
  } catch {
    const r = await copia();
    if (r) { red.catch(() => {}); return r; }
    return red.catch(() => new Response('Sin conexión y sin copia guardada de este archivo.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
  }
}

async function cachePrimero(req, nombre) {
  const cache = await caches.open(nombre);
  const clave = nombre === IMG ? claveSinQuery(req) : req;
  const hit = await cache.match(clave);
  if (hit) return hit;
  try {
    const r = await fetch(req);
    // opaque: teselas sin CORS (se aceptan, pero el navegador las cuenta con más peso)
    if (r.ok || r.type === 'opaque') { await cache.put(clave, r.clone()).catch(() => {}); recortar(nombre); }
    return r;
  } catch {
    return nombre === IMG ? new Response('', { status: 504 }) : Response.error();
  }
}


const recortando = {};
function recortar(nombre) {
  if (recortando[nombre]) return;
  recortando[nombre] = setTimeout(async () => {
    try {
      const cache = await caches.open(nombre);
      const claves = await cache.keys();
      const sobra = claves.length - (TOPE[nombre] || 500);
      // las imágenes del pack "sin conexión" no se recortan si el usuario las bajó: el tope las cubre
      for (let i = 0; i < sobra; i++) await cache.delete(claves[i]);
    } finally { recortando[nombre] = 0; }
  }, 3000);
}
