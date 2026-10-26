// Service worker de Memo Semiología (PWA offline). Dueño: paquete C.
// Estrategias:
//  - Navegación, js, css, json y manifest: RED PRIMERO (con tiempo límite) y copia en caché.
//    Así en desarrollo y tras publicar se ve siempre lo último; sin red se sirve la copia.
//  - img/**: caché primero (caché en ejecución con tope de entradas).
//  - Teselas CARTO, Leaflet (unpkg/jsdelivr, URL con versión) y Google Fonts: caché primero con tope.
// La lista y la versión las regenera `py tools/precache.py`.

// <precache> (generado por tools/precache.py; no editar a mano)
const VERSION = 'd03c62a9ad';
const PRECACHE = ["./", "index.html", "manifest.webmanifest", "js/ajustes.js", "js/app.js", "js/ciudad.js", "js/entrenar.js", "js/hoy.js", "js/juego-caza.js", "js/juego-estado.js", "js/juego-paseo.js", "js/juego-util.js", "js/juego.js", "js/metodos.js", "js/mias.js", "js/notificaciones.js", "js/plan.js", "js/progreso.js", "js/repaso.js", "js/respaldo.js", "js/srs.js", "js/util.js", "js/vistas.js", "css/ajustes.css", "css/app.css", "css/ciudad.css", "css/entrenar.css", "css/juego.css", "css/metodos.css", "css/repaso.css", "css/vistas.css", "data/atlas.json", "data/casos.json", "data/explica.json", "data/mapa.json", "data/memoria.json", "data/memoria_facies.json", "data/memoria_siglas.json", "data/metodos.json", "data/palacios.json", "data/ruta_diaria.json", "data/tabla00_99.json", "img/icon-192.png", "img/icon-512.png", "img/icon-maskable-512.png", "img/avatar.webp", "img/avatar_cara.webp"];
const IMAGENES = ["img/facies/acromegalica.webp", "img/facies/adenoidea.webp", "img/facies/aortica.webp", "img/facies/basedowiana-hipertiroidea.webp", "img/facies/caquectica.webp", "img/facies/cianotica.webp", "img/facies/cushing-luna-llena.webp", "img/facies/de-ayerza.webp", "img/facies/de-claude-bernard-horner.webp", "img/facies/de-depresion.webp", "img/facies/esclerodermica-o-de-momia.webp", "img/facies/etilica.webp", "img/facies/febril.webp", "img/facies/hipocratica-o-peritoneal.webp", "img/facies/icterica.webp", "img/facies/leonina.webp", "img/facies/lupica.webp", "img/facies/miastenica.webp", "img/facies/mitral.webp", "img/facies/mixedematosa.webp", "img/facies/nefritica-o-renal.webp", "img/facies/neumonica.webp", "img/facies/palida.webp", "img/facies/paralisis-facial-periferica.webp", "img/facies/parkinsoniana.webp", "img/lugares/escalas.webp", "img/lugares/s1.webp", "img/lugares/s10.webp", "img/lugares/s11.webp", "img/lugares/s12.webp", "img/lugares/s2.webp", "img/lugares/s3.webp", "img/lugares/s4.webp", "img/lugares/s5.webp", "img/lugares/s6.webp", "img/lugares/s7.webp", "img/lugares/s8.webp", "img/lugares/s9.webp", "img/memo/abastonados-cayados.webp", "img/memo/ade-rdw.webp", "img/memo/albumina.webp", "img/memo/amilasa-serica.webp", "img/memo/ascitis-aspecto-y-estudio.webp", "img/memo/ascitis-deteccion-y-puncion.webp", "img/memo/ascitis-gasa.webp", "img/memo/ascitis-pmn-pbe.webp", "img/memo/ascitis-por-volumen-percusion.webp", "img/memo/aspecto-y-color-de-orina.webp", "img/memo/basofilos.webp", "img/memo/bilirrubina-directa-conjugada.webp", "img/memo/bilirrubina-indirecta-no-conjugada.webp", "img/memo/bilirrubina-total.webp", "img/memo/bun.webp", "img/memo/calcio-serico.webp", "img/memo/chcm.webp", "img/memo/cianosis.webp", "img/memo/cilindros-urinarios.webp", "img/memo/clase-funcional-nyha.webp", "img/memo/clearance-de-creatinina-tfg.webp", "img/memo/cloro-serico.webp", "img/memo/coledoco-ecografia.webp", "img/memo/colesterol-total.webp", "img/memo/creatinina-serica.webp", "img/memo/criterios-de-centor.webp", "img/memo/deshidratacion.webp", "img/memo/desnutricion-criterios-de-gomez.webp", "img/memo/ecg-complejo-qrs.webp", "img/memo/ecg-eje-electrico.webp", "img/memo/ecg-frecuencia-cardiaca.webp", "img/memo/ecg-intervalo-pr.webp", "img/memo/ecg-intervalo-qt.webp", "img/memo/ecg-onda-p.webp", "img/memo/ecg-onda-q-patologica.webp", "img/memo/ecg-onda-t.webp", "img/memo/ecg-papel-y-cuadritos.webp", "img/memo/ecg-ritmo-sinusal.webp", "img/memo/ecg-segmento-st.webp", "img/memo/edema-signo-de-godet-fovea.webp", "img/memo/edema.webp", "img/memo/encefalopatia-hepatica-west-haven.webp", "img/memo/eosinofilos.webp", "img/memo/eritrocitosis-de-altura-hb.webp", "img/memo/escala-de-coma-de-glasgow.webp", "img/memo/escala-de-glasgow.webp", "img/memo/escala-visual-analogica-del-dolor-eva.webp", "img/memo/estado-de-hidratacion.webp", "img/memo/estado-de-nutricion.webp", "img/memo/estado-general.webp", "img/memo/factor-reumatoide.webp", "img/memo/fibrinogeno.webp", "img/memo/fosfatasa-alcalina-fa.webp", "img/memo/frecuencia-cardiaca-pulso.webp", "img/memo/frecuencia-de-deposiciones.webp", "img/memo/frecuencia-respiratoria.webp", "img/memo/fuerza-muscular-mrc-daniels.webp", "img/memo/funcion-renal-por-tfg.webp", "img/memo/gases-acidosis-metabolica.webp", "img/memo/gases-acidosis-respiratoria.webp", "img/memo/gases-alcalosis-metabolica.webp", "img/memo/gases-alcalosis-respiratoria.webp", "img/memo/gases-anion-gap.webp", "img/memo/gases-compensacion-esperada.webp", "img/memo/gases-exceso-de-base.webp", "img/memo/gases-hco3.webp", "img/memo/gases-paco2.webp", "img/memo/gases-pao2.webp", "img/memo/gases-ph-arterial.webp", "img/memo/gases-sato2-arterial.webp", "img/memo/ggt-gt.webp", "img/memo/globulinas.webp", "img/memo/globulos-rojos-hematies.webp", "img/memo/glucosa-2-h-ptog-75-g-y-hba1c.webp", "img/memo/glucosa-en-ayunas.webp", "img/memo/grados-de-coma.webp", "img/memo/hcm.webp", "img/memo/hdl.webp", "img/memo/hematocrito.webp", "img/memo/hemoglobina.webp", "img/memo/hemoptisis-por-volumen.webp", "img/memo/ictericia.webp", "img/memo/lcr-aspecto.webp", "img/memo/lcr-celulas.webp", "img/memo/lcr-glucosa.webp", "img/memo/lcr-patron-bacteriano-piogeno.webp", "img/memo/lcr-patron-tuberculoso.webp", "img/memo/lcr-patron-viral-aseptico.webp", "img/memo/lcr-presion.webp", "img/memo/lcr-proteinas.webp", "img/memo/ldl.webp", "img/memo/leucocitos-totales.webp", "img/memo/linfocitos.webp", "img/memo/lipasa-serica.webp", "img/memo/llenado-capilar.webp", "img/memo/magnesio-serico.webp", "img/memo/mini-mental-mmse-folstein.webp", "img/memo/monocitos.webp", "img/memo/neutrofilos-segmentados.webp", "img/memo/palidez.webp", "img/memo/patron-hepatocelular-vs-colestasico.webp", "img/memo/pcr-proteina-c-reactiva.webp", "img/memo/perimetro-abdominal-cintura.webp", "img/memo/peso-talla-imc.webp", "img/memo/plaquetas.webp", "img/memo/plaquetocrito.webp", "img/memo/pleural-aspecto.webp", "img/memo/pleural-celulas.webp", "img/memo/pleural-criterios-de-light.webp", "img/memo/pleural-exudado.webp", "img/memo/pleural-glucosa-ph-y-ldh.webp", "img/memo/pleural-trasudado.webp", "img/memo/pleural-volumen-normal.webp", "img/memo/potasio-serico.webp", "img/memo/presion-arterial.webp", "img/memo/proteinas-totales.webp", "img/memo/proteinuria-en-cruces-tira-reactiva.webp", "img/memo/qsofa.webp", "img/memo/reflejos-osteotendinosos.webp", "img/memo/relacion-albumina-globulina-a-g.webp", "img/memo/relacion-urea-creatinina.webp", "img/memo/reticulocitos.webp", "img/memo/rx-torax-condensacion.webp", "img/memo/rx-torax-derrame-pleural.webp", "img/memo/rx-torax-indice-cardiotoracico.webp", "img/memo/rx-torax-neumotorax.webp", "img/memo/saturacion-de-oxigeno.webp", "img/memo/score-de-wells-para-tep.webp", "img/memo/score-de-wells-para-tvp.webp", "img/memo/sodio-serico.webp", "img/memo/soplos-freeman-levine.webp", "img/memo/talla.webp", "img/memo/temperatura.webp", "img/memo/tgo-ast.webp", "img/memo/tgp-alt.webp", "img/memo/tiempo-de-sangria-coagulacion.png", "img/memo/tp-inr.webp", "img/memo/trigliceridos.webp", "img/memo/ttpa.webp", "img/memo/urea-sanguinea.webp", "img/memo/vcm.webp", "img/memo/vesicula-pared-calculos.webp", "img/memo/volumen-urinario.webp", "img/memo/vpm-volumen-plaquetario-medio.webp", "img/memo/vsg.webp"];
const PESO_IMAGENES = 29779127;
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

// ---------------------------------------------------------------- recordatorios de repaso (js/notificaciones.js)
// El SW no puede leer localStorage: la app deja en IndexedDB 'memo-semio-notif'/'kv' el 'resumen'
// { activo, hora, palacio, diaSemanal, vencidasPorDia:{fecha:n}, palaciosPorDia:{fecha:[nombres]}, temasPorDia, ultimaActividad },
// y ambos comparten 'ultimaNotif' ('AAAA-MM-DD') y 'posponer' (ms) para no avisar dos veces.
// Periodic Background Sync ('memo-repasos', ≥ 12 h) solo existe en Chromium con la PWA instalada; la app lo registra.
const NOTIF_DB = 'memo-semio-notif';
function notifKV(modo, k, v) {
  return new Promise((ok, no) => {
    const r = indexedDB.open(NOTIF_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onerror = () => no(r.error);
    r.onsuccess = () => {
      const db = r.result, tx = db.transaction('kv', modo === 'get' ? 'readonly' : 'readwrite'), s = tx.objectStore('kv');
      const q = modo === 'get' ? s.get(k) : v == null ? s.delete(k) : s.put(v, k);
      tx.oncomplete = () => { db.close(); ok(q.result); };
      tx.onerror = () => { db.close(); no(tx.error); };
    };
  }).catch(() => undefined);
}
const fechaLocal = (ms = Date.now()) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const plural = (n, s, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;
// MANTENER IGUAL que texto() en js/notificaciones.js
function textoRepasos(n, pal, semanal, temas, conPalacio) {
  const extra = [];
  if (n) extra.push(`${plural(n, 'tarjeta vencida', 'tarjetas vencidas')} (≈ ${Math.max(1, Math.ceil(n / 4))} min)`);
  if (temas) extra.push(plural(temas, 'tema nuevo', 'temas nuevos'));
  if (conPalacio && pal?.length) extra.push(`🏛️ palacio: ${pal.slice(0, 3).join(', ')}${pal.length > 3 ? '…' : ''}`);
  if (conPalacio && semanal) extra.push('📅 hoy toca repaso semanal');
  const titulo = n ? `🧠 Tienes ${plural(n, 'repaso')}` : conPalacio && pal?.length ? '🏛️ Hoy toca pasear tu palacio' : '📅 Hoy es tu repaso semanal';
  return { titulo, cuerpo: `Tu sesión de hoy: ${extra.join(' · ') || 'nada pendiente'}` };
}
/** Valor del día; si el resumen es viejo (la app no se abrió en 2 semanas) usa el último día conocido (cota inferior). */
function delDia(mapa, f, vacio) {
  if (!mapa) return vacio;
  if (f in mapa) return mapa[f];
  const ks = Object.keys(mapa).sort();
  return ks.length && f > ks[ks.length - 1] ? mapa[ks[ks.length - 1]] : vacio;
}

async function revisarRepasos() {
  const r = await notifKV('get', 'resumen');
  if (!r) return;
  const ahora = Date.now(), d = new Date(ahora), hoy = fechaLocal(ahora);
  const n = delDia(r.vencidasPorDia, hoy, 0) || 0;
  try { if (self.navigator.setAppBadge) { if (n) await self.navigator.setAppBadge(n); else await self.navigator.clearAppBadge(); } } catch { /* */ }
  if (!r.activo || self.Notification?.permission !== 'granted') return;
  const [h, m] = String(r.hora || '19:00').split(':').map(Number);
  if (d.getHours() * 60 + d.getMinutes() < (h || 0) * 60 + (m || 0)) return;
  const [ultima, posponer] = await Promise.all([notifKV('get', 'ultimaNotif'), notifKV('get', 'posponer')]);
  if (posponer && ahora < posponer) return;
  if (ultima === hoy && !(posponer && ahora >= posponer)) return;
  if (ahora - (r.ultimaActividad || 0) < 45 * 60000) return; // está repasando
  const pal = delDia(r.palaciosPorDia, hoy, []) || [], semanal = d.getDay() === +r.diaSemanal;
  if (!n && !(r.palacio && (pal.length || semanal))) return;
  // con la app a la vista, ella muestra su aviso interno
  const vent = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (vent.some((c) => c.visibilityState === 'visible')) return;
  const { titulo, cuerpo } = textoRepasos(n, pal, semanal, r.temasPorDia?.[hoy] || 0, r.palacio);
  await self.registration.showNotification(titulo, {
    body: cuerpo, icon: 'img/icon-192.png', badge: 'img/icon-192.png', tag: 'repasos', renotify: true, lang: 'es',
    data: { url: './?vista=hoy' }, actions: [{ action: 'repasar', title: 'Repasar ahora' }, { action: 'luego', title: 'En 1 h' }],
  });
  await Promise.all([notifKV('put', 'ultimaNotif', hoy), notifKV('put', 'posponer', null)]);
}

self.addEventListener('periodicsync', (e) => { if (e.tag === 'memo-repasos') e.waitUntil(revisarRepasos()); });

self.addEventListener('notificationclick', (e) => {
  const n = e.notification;
  n.close();
  if (e.action === 'luego') {
    // sin servidor no hay alarma exacta: se reintenta en el próximo periodicsync o mientras la app siga abierta
    e.waitUntil(notifKV('put', 'posponer', Date.now() + 3600e3));
    return;
  }
  const vista = e.action === 'repasar' ? 'repaso' : (new URL(n.data?.url || './?vista=hoy', self.registration.scope).searchParams.get('vista') || 'hoy');
  const url = new URL(`./?vista=${vista}`, self.registration.scope).href;
  e.waitUntil((async () => {
    const vent = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const c = vent.find((x) => x.url.startsWith(self.registration.scope)) || vent[0];
    if (c) { await c.focus().catch(() => {}); c.postMessage({ tipo: 'NOTIF_IR', vista }); return; }
    await self.clients.openWindow(url);
  })());
});
