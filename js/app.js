// Arranque: carga de datos, montaje de módulos, navegación y eventos globales.
// Cada vista vive en su módulo (ver tools/CONTRATOS.md y tools/PLAN_MEJORAS.md).
import * as srs from './srs.js';
import * as respaldo from './respaldo.js';
import * as ajustes from './ajustes.js';
import { $, $$, esc } from './util.js';
import { crearVistas } from './vistas.js';
import { crearRepaso } from './repaso.js';
import { crearProgreso } from './progreso.js';
import { crearHoy } from './hoy.js';
import { crearCiudad } from './ciudad.js';
import { crearEntrenar } from './entrenar.js';
import { crearJuego } from './juego.js';
import * as notificaciones from './notificaciones.js';

// ---------- paquete C: ajustes y PWA (antes de cargar datos, para que valgan desde el primer pintado) ----------
ajustes.aplicar();
registrarSW();

const json = (u, vacio) => fetch(u, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : vacio)).catch(() => vacio);
const [ATLAS, MEMO, METODOS, PALACIOS, SIGLAS, FACIES, MAPA, RUTA, CASOS, EXPLICA] = await Promise.all([
  json('data/atlas.json', {}), json('data/memoria.json', {}), json('data/metodos.json', {}), json('data/palacios.json', {}),
  json('data/memoria_siglas.json', {}), json('data/memoria_facies.json', {}),
  json('data/mapa.json', null), json('data/ruta_diaria.json', null), json('data/casos.json', {}),
  json('data/explica.json', {}),
]);
const CTX = { ATLAS, MEMO, METODOS, PALACIOS, SIGLAS, FACIES, MAPA, RUTA, CASOS: CASOS || {}, EXPLICA: EXPLICA || {}, srs };

// ---------- módulos ----------
const VISTAS = crearVistas(CTX);
const REPASO = crearRepaso({ ...CTX, raiz: $('#repaso'), alPendientes: (n) => { $('#pend').textContent = n || ''; } });
notificaciones.iniciar({ ...CTX, tarjetas: REPASO.tarjetas }); // recordatorios de repaso + insignia del ícono
const PROGRESO = crearProgreso({ ...CTX, tarjetas: REPASO.tarjetas, raiz: $('#progreso') });
const HOY = crearHoy({ ...CTX, tarjetas: REPASO.tarjetas, raiz: $('#hoy') });
const CIUDAD = crearCiudad({ ...CTX, raiz: $('#ciudad') });
const ENTRENAR = crearEntrenar({ ...CTX, raiz: $('#entrenar') });
const JUEGO = crearJuego({ ...CTX, raiz: $('#juego') });
let METODOS_V = { pintar: VISTAS.metodos };
import('./metodos.js').then(({ crearMetodos }) => { METODOS_V = crearMetodos({ ...CTX, raiz: $('#metodos') }); if (vista === 'metodos') METODOS_V.pintar(); }).catch(() => {});

const PINTAR = {
  hoy: () => HOY.pintar(), juego: () => JUEGO.pintar(), tabla: VISTAS.tabla, ciudad: () => CIUDAD.pintar(), entrenar: () => ENTRENAR.pintar(),
  escalas: VISTAS.escalas, facies: VISTAS.facies, repaso: () => REPASO.pintar(), progreso: () => PROGRESO.pintar(),
  metodos: () => METODOS_V.pintar(), siglas: VISTAS.siglas,
};

// ---------- navegación ----------
let vista = null, vistaPrevia = 'hoy';
function ir(v) {
  if (!PINTAR[v]) v = 'tabla';
  if (vista && v !== vista && vista !== 'juego') vistaPrevia = vista;
  vista = v;
  // modo inmersivo: en el celular (≤760 px, ver css/juego.css) el Juego ocupa toda la pantalla sin cabecera ni barra inferior
  document.body.classList.toggle('inmersivo', v === 'juego');
  document.body.classList.remove('top-oculta');
  $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.vista === v));
  $$('.vista').forEach((s) => s.classList.toggle('on', s.id === `v-${v}`));
  marcarNav(v);
  PINTAR[v]();
  try { localStorage.setItem('memo-semio-vista', v); } catch {}
}
// ir a la ficha de un dato desde cualquier módulo: dispatchEvent(new CustomEvent('memo:ir', { detail: { id } }))
function irAFicha(id) {
  const enEscalas = ATLAS.escalas.some((x) => x.id === id);
  $('#buscar').value = ''; VISTAS.filtrarSeccion(null); ir(enEscalas ? 'escalas' : 'tabla');
  const el = document.getElementById(`p-${id}`); el?.scrollIntoView({ block: 'center' }); el?.querySelector('.memo')?.classList.add('on');
}
window.addEventListener('memo:ir', (e) => irAFicha(e.detail?.id));
// desde el Juego inmersivo: "←" vuelve a la pestaña anterior y "☰" abre la hoja "Más"
window.addEventListener('memo:atras', () => cambiarVista(vistaPrevia && vistaPrevia !== 'juego' ? vistaPrevia : 'hoy'));
window.addEventListener('memo:menu', () => { const h = $('#hoja-mas'); if (h && !h.open) { h.showModal(); $('#mas')?.setAttribute('aria-expanded', 'true'); } });
window.addEventListener('memo:vista', (e) => {
  ir(e.detail?.vista);
  if (e.detail?.tec && VISTAS.filtrarTecnica) VISTAS.filtrarTecnica(e.detail.tec); // desde Métodos: "ver los datos que usan esta técnica"
});

$$('.tabs button').forEach((b) => b.addEventListener('click', () => ir(b.dataset.vista)));
$('#buscar').addEventListener('input', () => { if (!['tabla', 'escalas', 'facies', 'siglas'].includes(vista)) ir('tabla'); else PINTAR[vista](); });
$('#filtro-sec').addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) VISTAS.filtrarSeccion(b.dataset.s); });
$('#solo-memo').addEventListener('change', VISTAS.tabla);
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-memo]');
  if (b && !b.disabled) { const on = b.closest('.fila').querySelector('.memo')?.classList.toggle('on'); b.setAttribute('aria-expanded', String(!!on)); }
  const v = e.target.closest('.ocultar .val'); if (v) v.classList.toggle('ver');
  const irA = e.target.closest('[data-ir]');
  if (irA) { e.preventDefault(); irAFicha(irA.dataset.ir); return; }
  const z = e.target.closest('[data-zoom]');
  if (z) abrirVisor(z);
});
$('#visor').addEventListener('click', cerrarVisor);
$('#tema').addEventListener('click', () => {
  const r = document.documentElement;
  const oscuro = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.dataset.theme = oscuro ? 'light' : 'dark';
  try { localStorage.setItem('memo-semio-tema', r.dataset.theme); } catch {}
});
$('#exportar').addEventListener('click', () => { respaldo.descargar(); aviso({ texto: '💾 Respaldo descargado' }); });
$('#importar').addEventListener('change', async (e) => {
  try {
    const txt = await e.target.files[0].text();
    const r = respaldo.resumen(txt);
    if (!confirm(`Importar ${r.claves.length} conjuntos de datos${r.tarjetas ? ` (${r.tarjetas} tarjetas)` : ''}? Reemplaza tu progreso actual en este navegador; se guarda una copia para deshacer desde ⚙️ Ajustes.`)) { e.target.value = ''; return; }
    respaldo.importar(txt, { reemplazar: r.formato === 'v2' }); location.reload();
  } catch (err) { e.target.value = ''; aviso({ texto: `No se pudo importar: ${err.message}`, ms: 8000 }); }
});

// ---------- inicio ----------
try { const t = localStorage.getItem('memo-semio-tema'); if (t) document.documentElement.dataset.theme = t; } catch {}
VISTAS.filtros(); REPASO.pendientes();
let inicial = 'hoy'; try { inicial = localStorage.getItem('memo-semio-vista') || 'hoy'; } catch {} // primera visita: sesión guiada
const vistaURL = new URLSearchParams(location.search).get('vista'); if (vistaURL) inicial = vistaURL; // accesos directos del manifest
iniciarC();
ir(inicial);
if (location.hash.startsWith('#p-')) irAFicha(location.hash.slice(3));

// =====================================================================================
// Paquete C (transversal): PWA, ⚙️ ajustes, atajos, barra móvil, accesibilidad, avisos.
// Todo lo de abajo son declaraciones de función (se elevan), así que se pueden usar arriba.
// =====================================================================================

// ---------- avisos discretos (aria-live). Otros módulos: dispatchEvent(new CustomEvent('memo:aviso', {detail:{texto, acciones:[{texto, fn}], ms}})) ----------
function aviso({ texto, acciones = [], ms } = {}) {
  const caja = document.getElementById('avisos');
  if (!caja || !texto) return;
  const el = document.createElement('div');
  el.className = 'aviso';
  el.innerHTML = `<span>${esc(texto)}</span>${acciones.map((a, i) => `<button class="btn ${i === 0 ? 'pri' : ''}" data-i="${i}">${esc(a.texto)}</button>`).join('')}<button class="aviso-x" aria-label="Cerrar aviso">✕</button>`;
  const quitar = () => { el.classList.add('fuera'); setTimeout(() => el.remove(), 250); };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.i != null) acciones[+b.dataset.i]?.fn?.();
    quitar();
  });
  caja.append(el);
  const dura = ms ?? (acciones.length ? 0 : 4500);
  if (dura) setTimeout(quitar, dura);
}

// ---------- service worker (offline) ----------
function registrarSW() {
  if (!('serviceWorker' in navigator)) return;
  const q = new URLSearchParams(location.search);
  if (q.get('sw') === '0') { // escape para desarrollo: ?sw=0 desinstala el SW y borra sus cachés
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
    window.caches?.keys().then((ks) => ks.filter((k) => k.startsWith('memo-')).forEach((k) => caches.delete(k)));
    return;
  }
  let recargando = false, ofrecido = false;
  const ofrecer = (sw) => !ofrecido && (ofrecido = true) && aviso({
    texto: '✨ Hay una versión nueva de la app',
    acciones: [{ texto: 'Recargar', fn: () => { recargando = true; sw.postMessage({ tipo: 'SALTAR' }); setTimeout(() => location.reload(), 1500); } }, { texto: 'Luego' }],
  });
  const registrar = async () => {
    let reg;
    try { reg = await navigator.serviceWorker.register('sw.js', { scope: './' }); } catch (e) { console.warn('SW no registrado:', e); return; }
    if (reg.waiting && navigator.serviceWorker.controller) ofrecer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      nuevo?.addEventListener('statechange', () => { if (nuevo.state === 'installed' && navigator.serviceWorker.controller) ofrecer(nuevo); });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (recargando) location.reload(); });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    // que el navegador no borre el progreso (localStorage) por falta de espacio
    try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch { /* opcional */ }
  };
  if (document.readyState === 'complete') registrar(); else addEventListener('load', registrar, { once: true });
}

// ---------- navegación: pestañas accesibles + barra móvil ----------
function marcarNav(v) {
  $$('.tabs [role="tab"]').forEach((b) => { const on = b.dataset.vista === v; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
  $$('[data-ir-vista]').forEach((b) => { if (b.dataset.irVista === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  $('#mas')?.classList.toggle('on', !['hoy', 'tabla', 'repaso', 'juego'].includes(v));
  document.body.dataset.vista = v;
}
function cambiarVista(v, { foco = false } = {}) {
  ir(v);
  if (foco) $(`#v-${v}`)?.focus({ preventScroll: true });
  if (innerWidth <= 760) scrollTo({ top: 0 });
}
function iniciarC() {
  // pestañas → role tab / tabpanel, flechas, Inicio/Fin
  const tabs = $$('.tabs button');
  tabs.forEach((b) => {
    const v = b.dataset.vista;
    b.id = `tab-${v}`; b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', `v-${v}`);
    const s = document.getElementById(`v-${v}`);
    if (s) { s.setAttribute('role', 'tabpanel'); s.setAttribute('aria-labelledby', `tab-${v}`); s.tabIndex = -1; }
  });
  $('.tabs').addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement); if (i < 0) return;
    const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (j == null) return;
    e.preventDefault();
    const b = tabs[(j + tabs.length) % tabs.length]; b.focus(); ir(b.dataset.vista);
  });

  // barra inferior y hoja "Más"
  const hoja = $('#hoja-mas');
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ir-vista]');
    if (b) { if (hoja.open) hoja.close(); cambiarVista(b.dataset.irVista); return; }
    const h = e.target.closest('[data-hm]');
    if (h) { if (hoja.open) hoja.close(); if (h.dataset.hm === 'ajustes') ajustes.abrir(); else ajustes.mostrarAtajos(); }
  });
  $('#mas').addEventListener('click', () => { hoja.showModal(); $('#mas').setAttribute('aria-expanded', 'true'); });
  hoja.addEventListener('close', () => $('#mas').setAttribute('aria-expanded', 'false'));
  hoja.addEventListener('click', (e) => { if (e.target === hoja) hoja.close(); }); // toque en el fondo
  // el badge de pendientes de Repaso se copia a la barra móvil
  const pend = $('#pend'), pendM = $('#pend-m');
  const copiar = () => { pendM.textContent = pend.textContent; };
  new MutationObserver(copiar).observe(pend, { childList: true, characterData: true, subtree: true }); copiar();

  // cabecera compacta en el celular: se esconde al bajar y reaparece al subir
  let yPrev = scrollY, pendiente = false;
  addEventListener('scroll', () => {
    if (pendiente) return; pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      const y = scrollY, dy = y - yPrev;
      if (innerWidth > 760 || vista === 'juego' || document.activeElement === $('#buscar')) { document.body.classList.remove('top-oculta'); yPrev = y; return; }
      if (y < 80 || dy < -6) document.body.classList.remove('top-oculta');
      else if (dy > 6) document.body.classList.add('top-oculta');
      if (Math.abs(dy) > 6) yPrev = y;
    });
  }, { passive: true });
  $('#buscar').addEventListener('focus', () => document.body.classList.remove('top-oculta'));

  // ⚙️
  $('#ajustes').addEventListener('click', () => ajustes.abrir());
  // el foco no sale del visor mientras está abierto (tiene un solo control)
  $('#visor').addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); $('#visor .visor-x').focus(); } });

  // botones 🧠 de las fichas: estado inicial de aria-expanded (las fichas se repintan: se marca al vuelo)
  new MutationObserver(() => { for (const b of document.querySelectorAll('[data-memo]:not([aria-expanded])')) b.setAttribute('aria-expanded', 'false'); })
    .observe($('#app'), { childList: true, subtree: true });

  // atajos globales (fase de captura: van antes que los de cada vista y no los pisan)
  addEventListener('keydown', atajo, true);

  // recordatorio de respaldo (una vez por carga, a los pocos segundos)
  setTimeout(() => {
    if (ajustes.get('recordarRespaldo') === false || !respaldo.necesitaRecordatorio()) return;
    const d = respaldo.diasSinRespaldo();
    aviso({
      texto: d == null ? '💾 Aún no respaldas tu progreso. Guárdalo en un archivo por si cambias de celular.' : `💾 Hace ${d} días de tu último respaldo.`,
      acciones: [{ texto: 'Respaldar', fn: () => { respaldo.descargar(); aviso({ texto: '💾 Respaldo descargado' }); } }, { texto: 'Más tarde', fn: () => respaldo.posponer(2) }],
    });
  }, 4000);
}
window.addEventListener('memo:aviso', (e) => aviso(e.detail || {}));

// ---------- atajos de teclado ----------
const TECLA_G = { h: 'hoy', v: 'tabla', r: 'repaso', e: 'escalas', p: 'progreso', j: 'juego', c: 'ciudad', f: 'facies', n: 'entrenar', m: 'metodos', s: 'siglas' };
let gDesde = 0;
function atajo(e) {
  const buscar = $('#buscar');
  if (e.key === 'Escape') {
    if (!$('#visor').hidden) { e.preventDefault(); e.stopPropagation(); cerrarVisor(); return; }
    if (e.target === buscar && !buscar.value) buscar.blur(); // con texto, Esc lo borra (nativo)
    return; // los <dialog> se cierran solos con Esc; las vistas manejan su propio Esc
  }
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
  if (document.querySelector('dialog[open]') || !$('#visor').hidden) return;
  const k = e.key;
  if (gDesde && Date.now() - gDesde < 1500) {
    gDesde = 0;
    const v = TECLA_G[k.toLowerCase()];
    if (v) { e.preventDefault(); e.stopPropagation(); cambiarVista(v, { foco: true }); }
    return;
  }
  gDesde = 0;
  if (k === '/') { e.preventDefault(); buscar.focus(); buscar.select(); }
  else if (k === 'g' || k === 'G') { gDesde = Date.now(); e.stopPropagation(); }
  else if (k === '?') { e.preventDefault(); ajustes.mostrarAtajos(); }
  else if (k === ',') { e.preventDefault(); ajustes.abrir(); }
}

// ---------- visor de imágenes accesible ----------
let visorDesde = null;
function abrirVisor(img) {
  const vis = $('#visor');
  vis.querySelector('img').src = img.currentSrc || img.src;
  vis.querySelector('img').alt = img.alt || '';
  vis.querySelector('p').textContent = img.alt || '';
  visorDesde = document.activeElement;
  vis.hidden = false;
  vis.querySelector('.visor-x').focus();
}
function cerrarVisor() {
  const vis = $('#visor');
  if (vis.hidden) return;
  vis.hidden = true;
  vis.querySelector('img').removeAttribute('src');
  visorDesde?.focus?.({ preventScroll: true });
}
