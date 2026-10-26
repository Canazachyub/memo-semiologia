// Modo juego tipo Pokémon GO sobre el mapa real de Puno.
// Ruta del paseo = camino animado · lugares = gimnasios · estaciones = memoparadas.
// Tocar una memoparada → el avatar camina hasta ella → reto de captura (recuerdo activo) → 🧠 se cierra.
// Zona de caza (js/juego-caza.js): ruta diaria casa → UNA con criaturas salvajes que rotan cada 5 min, misiones y cebo.
// Contrato: crearJuego({ ATLAS, MEMO, PALACIOS, MAPA, srs, raiz, RUTA?, CASOS?, SIGLAS?, FACIES? }) → { pintar() }.
import * as E from './juego-estado.js';
import { esc, norm, resaltar, barajar, azar, pausa, sinMov, seguirSinMov, idCarta, numeros, aLL, metros, mezclar, desplazar, crearRuta, confetti } from './juego-util.js';
import { crearCaza } from './juego-caza.js';
import * as mias from './mias.js';
import * as ajustes from './ajustes.js';
import * as P from './juego-paseo.js';

const LEAF = 'https://unpkg.com/leaflet@1.9.4/dist/';
const TESELAS = {
  claro: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  oscuro: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};
const ATRIB = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
// Respaldo: si CARTO responde con su mosaico "API KEY REQUIRED" (mismo PNG para cualquier tesela),
// se usan las teselas estándar de OSM; en modo oscuro se oscurecen con un filtro CSS.
const OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATRIB_OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
let promesaCarto = null;
function cartoDisponible(ll) {
  if (!promesaCarto) {
    const z = 15, n = 2 ** z;
    const x = Math.floor(((ll[1] + 180) / 360) * n);
    const y = Math.floor(((1 - Math.asinh(Math.tan((ll[0] * Math.PI) / 180)) / Math.PI) / 2) * n);
    const url = (dx, dy) => `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x + dx}/${y + dy}.png`;
    const bytes = (u) => fetch(u, { mode: 'cors' }).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))));
    promesaCarto = Promise.all([bytes(url(0, 0)), bytes(url(5, 3))]).then(([a, b]) => {
      if (a.byteLength !== b.byteLength) return true;
      const A = new Uint8Array(a), B = new Uint8Array(b);
      for (let i = 0; i < A.length; i += 7) if (A[i] !== B[i]) return true;
      return false;   // dos teselas distintas idénticas → marca de agua de CARTO
    }).catch(() => true); // si la prueba falla (CORS, red), se intenta CARTO igual
  }
  return promesaCarto;
}
const COLOR_ESC = '#455a64';
const BONUS_M = 60;              // radio del bonus "estás en el lugar real"
const BONUS_MIN = 15;            // minutos que dura el bonus después de ubicarte
const XP = { nueva: 50, nuevaTrasFallo: 25, repaso: 20, practica: 5, desafioOk: 10, gimnasio: 150, perfecto: 50 };
const GANA_DESAFIO = 4;          // aciertos de 5 para conquistar

const esOscuro = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };

// ---------- carga perezosa de Leaflet y de la hoja de estilos ----------
let promesaLeaflet = null;
function cargarLeaflet() {
  if (window.L?.map) return Promise.resolve(window.L);
  if (!promesaLeaflet) {
    promesaLeaflet = new Promise((ok, mal) => {
      if (!document.querySelector('link[data-leaflet]')) {
        document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `${LEAF}leaflet.css`, crossOrigin: '' })).dataset.leaflet = '';
      }
      const s = Object.assign(document.createElement('script'), { src: `${LEAF}leaflet.js`, crossOrigin: '' });
      s.onload = () => (window.L ? ok(window.L) : mal(new Error('Leaflet no quedó disponible')));
      s.onerror = () => { promesaLeaflet = null; s.remove(); mal(new Error('No se pudo descargar Leaflet (¿sin conexión?)')); };
      document.head.appendChild(s);
    });
  }
  return promesaLeaflet;
}
function cargarCSS() {
  const href = new URL('../css/juego.css', import.meta.url).href;
  if ([...document.querySelectorAll('link[rel="stylesheet"]')].some((l) => l.href === href)) return;
  document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', href }));
}


// =====================================================================
export function crearJuego({ EXPLICA = {}, ATLAS = {}, MEMO = {}, PALACIOS = {}, MAPA = null, RUTA = null, CASOS = null, SIGLAS = null, FACIES = null, srs, raiz }) {
  cargarCSS();
  ATLAS = ATLAS || {};
  MEMO = MEMO || {};
  PALACIOS = PALACIOS || {};
  const S = srs || { info: () => null, vence: () => true, calificar: () => ({}) };

  // ---------- datos: lugares (gimnasios) y datos (memoparadas) en el orden del paseo ----------
  const secciones = ATLAS.secciones || [];
  const orden = PALACIOS.orden_paseo?.length ? PALACIOS.orden_paseo : [...secciones.map((s) => s.id), 'escalas'];
  const LUG = {}; const DATOS = []; const POR_ID = {};
  for (const sid of orden) {
    const P = PALACIOS.lugares?.[sid] || {};
    const sec = secciones.find((s) => s.id === sid);
    const items = sid === 'escalas'
      ? (ATLAS.escalas || []).map((e) => ({ tipo: 'escala', id: e.id, nombre: e.nombre, icono: e.icono || '📏', src: e }))
      : (sec?.filas || []).map((f) => ({ tipo: 'fila', id: f.id, nombre: f.nombre || f.parametro, icono: f.icono || '🔹', src: f }));
    if (!items.length) continue;
    const lug = {
      sid, nombre: P.lugar || sec?.titulo || sid, icono: P.icono || sec?.icono || '📍', porque: P.porque || '',
      titulo: sid === 'escalas' ? 'Escalas clínicas' : String(sec?.titulo || '').replace(/^\d+\s*·\s*/, ''), color: sec?.color || COLOR_ESC, datos: [], ll: null,
    };
    items.forEach((it, n) => {
      const m = MEMO[it.id] || null;
      const d = {
        ...it, sid, n, m, lug, color: lug.color, num: DATOS.length + 1, ll: null, s: null,
        ubicacion: m?.estacion?.ubicacion || P.ruta?.[n] || `Estación ${n + 1}`,
        valor: it.tipo === 'fila' ? it.src.normal?.t || '' : (it.src.interpretacion || []).map((x) => `${x[0]}: ${x[1]}`).join(' · '),
      };
      d.preguntas = preguntasDe(d);
      lug.datos.push(d); DATOS.push(d); POR_ID[d.id] = d;
    });
    LUG[sid] = lug;
  }
  const TOTAL = DATOS.length;
  const LUGARES = Object.values(LUG);

  function preguntasDe(d) {
    const m = d.m;
    if (m?.preguntas?.length) return m.preguntas.map((p, i) => (p?.q && p?.a ? { q: p.q, a: p.a, tipo: p.tipo || '', card: idCarta(d.id, p, i), fuente: 'memo' } : null)).filter(Boolean);
    if (d.tipo === 'escala') {
      const it = (d.src.interpretacion || []).filter((x) => x[0] && x[1]);
      return it.length ? it.map(([r, t]) => ({ q: `${d.nombre}: ¿qué significa ${r}?`, a: t, card: `${d.id}#n`, fuente: 'interp' }))
        : [{ q: `¿Qué mide la ${d.nombre}?`, a: d.src.mide || d.nombre, card: `${d.id}#n`, fuente: 'mide' }];
    }
    const f = d.src;
    if (f.normal?.t) return [{ q: `${d.nombre}: ¿valor normal?`, a: f.normal.t, card: `${d.id}#n`, fuente: 'normal' }];
    if (f.clave?.texto) return [{ q: `${d.nombre}: ¿cuál es el dato clave?`, a: f.clave.texto, card: `${d.id}#n`, fuente: 'clave' }];
    if (f.sube?.t) return [{ q: `${d.nombre}: ¿qué indica si está aumentado?`, a: f.sube.t, card: `${d.id}#n`, fuente: 'sube' }];
    return [{ q: `${d.nombre}: ¿perla clínica?`, a: f.perla || d.nombre, card: `${d.id}#n`, fuente: 'perla' }];
  }
  const cardsDe = (d) => [...new Set(d.preguntas.map((p) => p.card))];
  const pendiente = (d) => cardsDe(d).some((c) => S.info(c) && S.vence(c));
  const estadoDe = (d) => (pendiente(d) ? 'repaso' : E.capturado(d.id) ? 'capturada' : 'nueva');
  const ETQ = { nueva: '✨ Nueva', repaso: '⏰ Toca repasar', capturada: '✅ Capturada' };
  const capturadasDe = (lug) => lug.datos.filter((d) => E.capturado(d.id)).length;

  function opcionesPara(d, p) {
    const vistos = new Set([norm(p.a)]); const otras = [];
    const tomar = (lista) => { for (const t of barajar(lista)) { if (otras.length >= 3) return; const k = norm(t); if (!t || vistos.has(k)) continue; vistos.add(k); otras.push(t); } };
    const herm = d.lug.datos.filter((x) => x.id !== d.id);
    const resp = (lista, filtro) => lista.flatMap((x) => x.preguntas.filter(filtro).map((q) => q.a));
    if (p.fuente === 'memo') { if (p.tipo) tomar(resp(herm, (q) => q.fuente === 'memo' && q.tipo === p.tipo)); tomar(resp(herm, (q) => q.fuente === 'memo')); }
    if (p.fuente === 'interp') tomar((d.src.interpretacion || []).map((x) => x[1]));
    tomar(resp(herm, (q) => q.fuente === p.fuente));
    tomar(herm.map((x) => (x.tipo === 'fila' ? x.src.normal?.t : '')).filter(Boolean));
    tomar(resp(DATOS.filter((x) => x.id !== d.id), (q) => q.fuente === p.fuente));
    tomar(DATOS.filter((x) => x.id !== d.id).map((x) => x.src.normal?.t).filter(Boolean));
    return barajar([p.a, ...otras]);
  }
  function elegirPregunta(d, evitar) {
    const ps = d.preguntas; if (!ps.length) return null;
    const venc = ps.filter((p) => S.info(p.card) && S.vence(p.card));
    const nuevas = ps.filter((p) => !S.info(p.card));
    let pool = venc.length ? venc : nuevas.length ? nuevas : ps;
    if (pool.length > 1 && evitar) pool = pool.filter((p) => p.q !== evitar);
    const p = azar(pool);
    return { ...p, opciones: opcionesPara(d, p) };
  }

  // ---------- zona de caza (ruta diaria, apariciones, misiones, cebo) ----------
  const caza = crearCaza({
    RUTA, CASOS, SIGLAS, FACIES, ATLAS, DATOS, POR_ID, LUGARES, S,
    h: {
      mapa: () => mapa, L: () => L, toast, elegirPregunta, htmlPista, htmlFicha, revisarLogros, pintarHUD, refrescarMarca,
      caminar: (dest) => caminar(dest),
      abrirDex: (tab, ficha) => { dex.tab = tab; abrirDex(ficha); },
      pintarDex: () => pintarDex(), dexAbierto: () => dex.abierto,
      moverAvatar: (ll) => { if (!avatar.marca || avatar.caminando) return; avatar.ll = ll; avatar.s = ruta ? ruta.proyectar(ll).s : null; avatar.marca.setLatLng(ll); },
      abrirHoja: (estado) => abrirHoja(estado), hoja: () => hoja, pintarHoja: () => pintarHoja(),
      oscuro: () => esOscuro(), esperarAnim: (ms) => { animHasta = Date.now() + ms; },
      progresivo: () => progresivo(), avatarLL: () => avatar.ll, ubicar: () => ubicar(),
      alPasar: (ids) => {   // pasaste de verdad cerca de memoparadas: quedan desbloqueadas aunque estén más allá de la frontera
        const ds = ids.map((id) => POR_ID[id]).filter(Boolean); if (!ds.length) return;
        aplicarNiebla();
        toast(`📍 <b>Pasaste por ${esc(ds[0].ubicacion)}</b>: se desbloqueó «${esc(ds[0].nombre)}»${ds.length > 1 ? ` y ${ds.length - 1} más` : ''}.`, 'oro');
      },
    },
  });
  const calificar = (card, nota) => caza.calificar(card, nota, 'juego');   // srs.calificar + avance de la misión "repasa vencidas"

  // ---------- logros ----------
  const conCodigo = (d) => d.m && ((d.m.codigo || []).length || (d.m.tecnicas || []).includes('memorizar-numeros'));
  const LOGROS = [
    { id: 'primer-latido', ic: '💓', nombre: 'Primer latido', desc: 'Tu primera captura', ok: (c) => c.n >= 1 },
    { id: 'mochila-10', ic: '🎒', nombre: 'Mochila de residente', desc: '10 capturas', ok: (c) => c.n >= 10 },
    { id: 'coleccion-50', ic: '🏅', nombre: 'Medio atlas en la cabeza', desc: '50 capturas', ok: (c) => c.n >= 50 },
    { id: 'coleccion-100', ic: '💯', nombre: 'Centenario', desc: '100 capturas', ok: (c) => c.n >= 100 },
    { id: 'memodex-completa', ic: '🏆', nombre: 'Memodex completa', desc: `Las ${TOTAL} cartas`, ok: (c) => TOTAL > 0 && c.n >= TOTAL },
    ...LUGARES.map((l) => ({
      id: `completo-${l.sid}`, ic: l.sid === 's1' ? '🩺' : l.icono, nombre: l.sid === 's1' ? 'Signos vitales completos' : `${l.titulo} completo`,
      desc: `Captura las ${l.datos.length} memoparadas de ${l.nombre}`, ok: (c) => l.datos.every((d) => c.set.has(d.id)),
    })),
    ...LUGARES.map((l) => ({ id: `gimnasio-${l.sid}`, ic: '👑', nombre: `Gimnasio ${l.nombre} conquistado`, desc: `Gana el desafío de ${l.nombre} (${GANA_DESAFIO}/5)`, ok: () => E.conquistado(l.sid) })),
    { id: 'lider-3', ic: '🎖️', nombre: 'Líder de gimnasios', desc: 'Conquista 3 gimnasios', ok: () => LUGARES.filter((l) => E.conquistado(l.sid)).length >= 3 },
    { id: 'racha-3', ic: '🔥', nombre: 'Tres días seguidos', desc: 'Racha de 3 días', ok: () => E.racha() >= 3 },
    { id: 'racha-7', ic: '🔥', nombre: 'Racha 7 días', desc: 'Juega 7 días seguidos', ok: () => E.racha() >= 7 },
    { id: 'racha-30', ic: '☄️', nombre: 'Mes imparable', desc: 'Racha de 30 días', ok: () => E.racha() >= 30 },
    { id: 'sistema-mayor', ic: '🔢', nombre: 'Maestro del sistema mayor', desc: 'Captura 10 datos que se recuerdan con código de números', ok: (c) => DATOS.filter((d) => conCodigo(d) && c.set.has(d.id)).length >= 10 },
    { id: 'medidor', ic: '📏', nombre: 'Medidor oficial', desc: 'Captura 5 escalas clínicas', ok: (c) => DATOS.filter((d) => d.tipo === 'escala' && c.set.has(d.id)).length >= 5 },
    { id: 'en-el-lugar', ic: '📍', nombre: 'Explorador de Puno', desc: 'Captura una memoparada estando en el lugar real', ok: () => E.stats().enLugar >= 1 },
    { id: 'memoria-fresca', ic: '🔁', nombre: 'Memoria fresca', desc: 'Recaptura una memoparada pendiente de repaso', ok: () => E.stats().repasos >= 1 },
    { id: 'impecable', ic: '✨', nombre: 'Impecable', desc: 'Gana un desafío de gimnasio 5 de 5', ok: () => E.stats().perfectos >= 1 },
    { id: 'nivel-5', ic: '⭐', nombre: 'Nivel 5', desc: 'Llega al nivel 5', ok: () => E.nivel().n >= 5 },
    { id: 'nivel-10', ic: '🌟', nombre: 'Nivel 10', desc: 'Llega al nivel 10', ok: () => E.nivel().n >= 10 },
    ...caza.LOGROS,
  ];
  const LOGRO = Object.fromEntries(LOGROS.map((l) => [l.id, l]));
  function revisarLogros() {
    const set = new Set(E.capturas()); const c = { set, n: DATOS.filter((d) => set.has(d.id)).length };
    LOGROS.forEach((l) => { if (!E.tieneLogro(l.id) && l.ok(c)) E.desbloquear(l.id); });
  }

  // ---------- estado de la interfaz ----------
  let montado = false, mapa = null, L = null, capaTeselas = null, temaActual = null, ruta = null, mapaDatos = null, mapaEjemplo = false;
  const marcas = { gym: {}, stop: {} };
  let avatar = { ll: null, s: null, marca: null, src: null, caminando: false };
  let bonus = null;                 // { ll, t }
  let circuloGeo = null;
  let hoja = null;                  // { tipo:'parada', id } | { tipo:'gym', sid } | { tipo:'desafio' }
  let reto = null;                  // estado del reto de captura
  let desafio = null;               // estado del desafío del gimnasio
  let dex = { abierto: false, tab: 'datos', sid: '', ficha: null };
  let animHasta = 0;                // los toasts esperan a que termine la animación de captura
  let el = {};

  // imagen del avatar (si existe img/avatar.webp)
  const imgAv = new Image();
  imgAv.onload = () => { avatar.src = imgAv.src; pintarAvatar(); };
  imgAv.src = 'img/avatar_cara.webp';

  // ---------- esqueleto ----------
  function montar() {
    raiz.innerHTML = `<div class="jg" role="application" aria-label="Modo juego: mapa del paseo de memoria">
      <div class="jg-mapa" aria-label="Mapa de Puno"></div>
      <div class="jg-aviso" hidden></div>
      <div class="jg-hud">
        <div class="jg-hud-fila">
          <button class="jg-salir" data-acc="salir" aria-label="Salir del juego" title="Salir del juego">←</button>
          <div class="jg-nv" title="Nivel"><small>Nv</small><b>1</b></div>
          <div class="jg-xp"><div class="jg-xpbar"><i></i></div><small class="jg-xptxt"></small></div>
          <div class="jg-pill jg-racha" title="Racha diaria">🔥 <b>0</b></div>
          <div class="jg-pill jg-caps" title="Capturas">🧠 <b>0</b><span>/${TOTAL}</span></div>
          <button class="jg-dexbtn" data-acc="dex" aria-label="Abrir Memodex">📖<span> Memodex</span></button>
          <button class="jg-menu" data-acc="menu" aria-label="Menú de secciones" title="Menú de secciones" aria-haspopup="dialog">☰</button>
        </div>
        <div class="jg-caza" hidden></div>
        <div class="jg-leyenda" aria-hidden="true"><span class="jg-cielo" title="Hora del día en el mapa"></span><span class="nueva">Nueva</span><span class="repaso">Repasar</span><span class="capturada">Capturada</span><span>👑 Conquistado</span></div>
      </div>
      <div class="jg-fabs">
        <button class="jg-fab" data-acc="sig" aria-label="Caminar a la siguiente memoparada">▶<span> Siguiente</span></button>
        <button class="jg-fab" data-acc="centrar" aria-label="Centrar en el avatar">🎯</button>
        <button class="jg-fab jg-geo" data-acc="ubicar" aria-label="Usar mi ubicación real">📍<span> Usar mi ubicación real</span></button>
      </div>
      <section class="jg-dock" data-estado="peek" aria-label="Controles del juego">
        <div class="jg-dk-asa" data-acc="dock-asa" role="button" tabindex="0" aria-label="Mostrar u ocultar más controles" aria-expanded="false"><i></i></div>
        <div class="jg-dk-peek">
          <div class="jg-dk-rutaw"></div>
          <button class="jg-dk-sig" data-acc="sig" aria-label="Caminar a la siguiente memoparada">▶ Siguiente</button>
          <button class="jg-dk-ic" data-acc="centrar" aria-label="Centrar en el avatar">🎯</button>
          <button class="jg-dk-ic jg-dk-mas" data-acc="dock" aria-label="Más controles" aria-expanded="false">▴</button>
        </div>
        <div class="jg-dk-cuerpo">
          <div class="jg-dk-caza"></div>
          <p class="jg-pt">Mapa</p>
          <div class="jg-dk-tiles">
            <button class="jg-dk-t" data-acc="dex"><span aria-hidden="true">📖</span><b>Memodex</b><small class="jg-dk-caps"></small></button>
            <button class="jg-dk-t jg-geo" data-acc="ubicar"><span aria-hidden="true">📍</span><b>Mi ubicación</b><small>GPS real</small></button>
            <button class="jg-dk-t" data-acc="centrar"><span aria-hidden="true">🎯</span><b>Centrar</b><small>en tu avatar</small></button>
            <button class="jg-dk-t" data-acc="menu"><span aria-hidden="true">☰</span><b>Secciones</b><small>Hoy, Valores…</small></button>
          </div>
          <div class="jg-leyenda jg-dk-ley" aria-hidden="true"><span class="jg-cielo"></span><span class="nueva">Nueva</span><span class="repaso">Repasar</span><span class="capturada">Capturada</span><span>👑 Conquistado</span></div>
        </div>
      </section>
      <section class="jg-hoja" aria-live="polite" aria-label="Detalle" hidden><div class="jg-asa" aria-hidden="true"></div>
        <button class="jg-x" data-acc="cerrar" aria-label="Cerrar panel">✕</button><div class="jg-hoja-in"></div></section>
      <section class="jg-dex" aria-label="Memodex" hidden></section>
      <div class="jg-toasts" aria-live="polite"></div>
    </div>`;
    const q = (s) => raiz.querySelector(s);
    el = { jg: q('.jg'), mapa: q('.jg-mapa'), aviso: q('.jg-aviso'), hud: q('.jg-hud'), hoja: q('.jg-hoja'), hojaIn: q('.jg-hoja-in'), dex: q('.jg-dex'), toasts: q('.jg-toasts'), fabs: q('.jg-fabs'), cielo: q('.jg-cielo'), dock: q('.jg-dock') };
    caza.montarBarra(q('.jg-caza'));
    caza.montarBarra(q('.jg-dk-caza'), 'dock');
    caza.montarBarra(q('.jg-dk-rutaw'), 'peek');
    montarDock();
    vigilarTeclado();
    el.jg.classList.toggle('con-caza', caza.activo);
    seguirSinMov(el.jg);
    vigilarVisibilidad();
    raiz.addEventListener('click', alClic);
    raiz.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { if (dex.ficha) { dex.ficha = null; pintarDex(); } else if (dex.abierto) cerrarDex(); else cerrarHoja(); }
      if (e.key === 'Enter' && e.target.matches('.jg-escribir textarea') && !e.shiftKey) { e.preventDefault(); comprobarEscrito(); }
    });
    addEventListener('resize', ajustarAlto);
    // tema: el botón 🌓 de la app cambia data-theme; también seguimos el del sistema
    new MutationObserver(ponerTeselas).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', ponerTeselas);
    E.suscribir(alEvento);
    montado = true;
  }
  // J3: pausar temporizadores, GPS y animaciones con la pestaña oculta o la vista Juego cerrada
  let relojTeselas = null;
  function vigilarVisibilidad() {
    const seccion = raiz.closest('.vista');
    const visible = () => !document.hidden && (!seccion || seccion.classList.contains('on'));
    const aplicar = () => {
      const v = visible();
      el.jg?.classList.toggle('jg-pausa', !v);
      caza.pausar(!v);
      if (v && !relojTeselas) { relojTeselas = setInterval(ponerTeselas, 60000); ponerTeselas(); }   // franja horaria del mapa
      else if (!v && relojTeselas) { clearInterval(relojTeselas); relojTeselas = null; }
    };
    document.addEventListener('visibilitychange', aplicar);
    if (seccion) new MutationObserver(aplicar).observe(seccion, { attributes: true, attributeFilter: ['class'] });
    aplicar();
  }
  function ajustarAlto() {
    if (!el.jg) return;
    const cab = document.querySelector('header.top');
    const lateral = cab && getComputedStyle(cab).position === 'fixed';   // escritorio: la cabecera es la barra lateral
    const off = (cab && !lateral ? cab.offsetHeight : Math.max(0, raiz.getBoundingClientRect().top + scrollY)) + 28;
    el.jg.style.setProperty('--jg-off', `${off}px`);
    mapa?.invalidateSize();
  }

  // ---------- móvil: hoja de controles (peek / media / llena) y teclado virtual ----------
  function ponerDock(est) {
    if (!el.dock) return;
    el.dock.dataset.estado = est;
    el.dock.style.height = '';
    const abierto = est !== 'peek';
    el.dock.querySelectorAll('[aria-expanded]').forEach((b) => b.setAttribute('aria-expanded', String(abierto)));
    const mas = el.dock.querySelector('.jg-dk-mas');
    mas.textContent = abierto ? '▾' : '▴';
    mas.setAttribute('aria-label', abierto ? 'Menos controles' : 'Más controles');
    el.jg.classList.toggle('dock-abierto', abierto);
  }
  function montarDock() {
    const d = el.dock; if (!d) return;
    // arrastrar desde el asa o la franja visible: al soltar se queda en el estado más cercano
    let ini = null;
    const alto = () => d.getBoundingClientRect().height;
    const empezar = (e) => {
      if (e.button > 0 || (e.target.closest('button') && !e.target.closest('.jg-dk-asa'))) return;
      if (e.target.closest('.jg-dk-cuerpo') && d.dataset.estado !== 'peek' && d.querySelector('.jg-dk-cuerpo').scrollTop > 0) return; // deja hacer scroll
      ini = { y: e.clientY, h: alto(), movio: false, id: e.pointerId };
    };
    const mover = (e) => {
      if (!ini || e.pointerId !== ini.id) return;
      const dy = ini.y - e.clientY;
      if (!ini.movio && Math.abs(dy) < 8) return;
      if (!ini.movio) { ini.movio = true; d.classList.add('arrastra'); try { d.setPointerCapture(e.pointerId); } catch { /* opcional */ } }
      d.style.height = `${Math.max(56, Math.min(el.jg.clientHeight * 0.9, ini.h + dy))}px`;
    };
    const soltar = (e) => {
      if (!ini || e.pointerId !== ini.id) return;
      const fue = ini; ini = null; d.classList.remove('arrastra');
      if (!fue.movio) return;
      ultimoArrastre = Date.now();
      const h = alto(), H = el.jg.clientHeight, sube = h > fue.h;
      // umbrales con sesgo hacia la dirección del gesto
      let est = h < H * (sube ? 0.18 : 0.32) ? 'peek' : h < H * (sube ? 0.6 : 0.74) ? 'media' : 'llena';
      if (Math.abs(h - fue.h) < 30) est = d.dataset.estado;
      ponerDock(est);
    };
    d.addEventListener('pointerdown', empezar);
    d.addEventListener('pointermove', mover);
    d.addEventListener('pointerup', soltar);
    d.addEventListener('pointercancel', soltar);
    d.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.jg-dk-asa')) { e.preventDefault(); alternarDock(); } });
    // tocar el mapa recoge la hoja
    el.mapa.addEventListener('pointerdown', () => { if (d.dataset.estado !== 'peek') ponerDock('peek'); });
  }
  let ultimoArrastre = 0;
  function alternarDock() {
    if (Date.now() - ultimoArrastre < 400) return; // el clic que sigue a un arrastre no cuenta
    ponerDock(el.dock?.dataset.estado === 'peek' ? 'media' : 'peek');
  }
  function vigilarTeclado() {
    // teclado virtual: visualViewport dice cuánto tapa; la hoja sube (--kb) para que el campo no quede oculto
    const vv = window.visualViewport; if (!vv) return;
    const medir = () => {
      if (!el.jg) return;
      const k = Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop));
      const hay = k > 60;
      el.jg.style.setProperty('--kb', `${hay ? k : 0}px`);
      el.jg.classList.toggle('teclado', hay);
      const a = document.activeElement;
      if (hay && a && el.hoja?.contains(a)) requestAnimationFrame(() => a.scrollIntoView({ block: 'nearest' }));
    };
    vv.addEventListener('resize', medir);
    vv.addEventListener('scroll', medir);
  }

  // ---------- mapa ----------
  function hayMapa(m) { return !!(m && ((m.lugares && Object.keys(m.lugares).length) || (m.estaciones && Object.keys(m.estaciones).length))); }
  function prepararGeo(m) {
    mapaDatos = m;
    for (const lug of LUGARES) {
      const est = (m.estaciones?.[lug.sid] || []).map(aLL);
      lug.ll = aLL(m.lugares?.[lug.sid]);
      if (!lug.ll) {
        const v = est.filter(Boolean);
        lug.ll = v.length ? [v.reduce((a, p) => a + p[0], 0) / v.length, v.reduce((a, p) => a + p[1], 0) / v.length] : null;
      }
      lug.datos.forEach((d, n) => {
        d.ll = est[n] || (lug.ll ? desplazar(lug.ll, 35 + 25 * (n % 3), (2 * Math.PI * n) / lug.datos.length) : null);
      });
    }
    let pts = (m.ruta || []).map(aLL).filter(Boolean);
    if (pts.length < 2) pts = LUGARES.map((l) => l.ll).filter(Boolean);
    ruta = pts.length >= 2 ? crearRuta(pts) : null;
    DATOS.forEach((d) => { d.s = d.ll && ruta ? ruta.proyectar(d.ll).s : null; });
  }
  let iniciando = null;
  function iniciarMapa() {
    if (!iniciando) iniciando = crearMapa().finally(() => { iniciando = null; });
    return iniciando;
  }
  async function crearMapa() {
    if (mapa) return;
    let datos = MAPA;
    if (!hayMapa(datos)) { if (!caza.activo) { mostrarSinMapa(); return; } datos = datos || {}; }
    el.aviso.hidden = true;
    el.jg.classList.remove('sin-mapa');
    try { L = await cargarLeaflet(); } catch (err) { avisar(`<b>🗺️ No se pudo cargar el mapa.</b> ${esc(err.message)}. El Memodex sigue disponible.`, true); return; }
    prepararGeo(datos);
    const centro = aLL(datos.centro) || LUGARES.find((l) => l.ll)?.ll || caza.inicio() || [-15.8402, -70.028];
    mapa = L.map(el.mapa, { zoomControl: false, center: centro, zoom: +datos.zoom || 15, minZoom: 12, maxZoom: 19, tapTolerance: 18, zoomSnap: 0.5 });
    L.control.zoom({ position: 'bottomleft', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(mapa);
    mapa.attributionControl.setPrefix(false);
    usarCarto = await cartoDisponible(centro);
    ponerTeselas();
    if (ruta) {
      L.polyline(ruta.pts, { className: 'jg-ruta-base', weight: 12, opacity: 1, interactive: false }).addTo(mapa);
      L.polyline(ruta.pts, { className: 'jg-ruta', weight: 4, opacity: 1, dashArray: '1 13', lineCap: 'round', interactive: false }).addTo(mapa);
    }
    for (const lug of LUGARES) {
      if (lug.ll) {
        marcas.gym[lug.sid] = L.marker(lug.ll, { icon: iconoGym(lug), keyboard: true, title: lug.nombre, alt: `Gimnasio ${lug.nombre}`, riseOnHover: true })
          .on('click', () => (bloqueado(lug) ? avisoBloqueado(lug) : abrirGym(lug.sid))).addTo(mapa);
      }
      for (const d of lug.datos) {
        if (!d.ll) continue;
        marcas.stop[d.id] = L.marker(d.ll, { icon: iconoStop(d), keyboard: true, title: `${d.nombre} · ${d.ubicacion}`, alt: d.nombre, zIndexOffset: 500 })
          .on('click', () => irAParada(d.id)).addTo(mapa);
      }
    }
    aplicarNiebla(false);
    caza.dibujar();   // ruta diaria A/B, casa y UNA, hitos y apariciones salvajes
    // avatar en la última parada, o en casa (inicio de la ruta diaria), o al inicio del paseo
    const ult = POR_ID[E.ultimaParada()];
    avatar.ll = ult?.ll || caza.inicio() || ruta?.pts[0] || centro;
    avatar.s = ult?.s ?? (ruta ? 0 : null);
    avatar.marca = L.marker(avatar.ll, { icon: iconoAvatar(), zIndexOffset: 2000, interactive: false, keyboard: false }).addTo(mapa);
    if (progresivo()) caza.pintarApariciones();   // ya hay avatar: criaturas e hitos cercanos
    if (ult) mapa.setView(ult.ll, 17, { animate: false });
    else if (caza.activo) mapa.fitBounds(L.latLngBounds(caza.limites()), { padding: [70, 40], maxZoom: 16.5, animate: false });
    mapa.on('zoomend', claseZoom); claseZoom();
    if (mapaEjemplo) avisar('🧪 <b>Mapa de ejemplo</b> con coordenadas aproximadas: el mapa real del paseo aún no está listo.', false, true);
    setTimeout(() => mapa.invalidateSize(), 60);
  }
  function mostrarSinMapa() {
    el.jg.classList.add('sin-mapa');
    avisar(`<div class="jg-vacio"><b>🗺️</b><h3>El mapa del paseo aún no está listo</h3>
      <p>Cuando exista <code>data/mapa.json</code>, aquí verás Puno con tus ${TOTAL} memoparadas. Mientras tanto puedes coleccionar desde el Memodex.</p>
      <div class="jg-btns"><button class="btn pri" data-acc="ejemplo">🧪 Probar con un mapa de ejemplo</button><button class="btn" data-acc="dex">📖 Abrir Memodex</button></div></div>`, true);
  }
  function avisar(html, grande = false, cerrable = false) {
    el.aviso.className = `jg-aviso ${grande ? 'grande' : ''}`;
    el.aviso.innerHTML = html + (cerrable ? '<button class="jg-aviso-x" data-acc="aviso-x" aria-label="Cerrar aviso">✕</button>' : '');
    el.aviso.hidden = false;
  }
  let usarCarto = true;
  // franja horaria: el mapa sigue la hora si el usuario no eligió tema; si lo eligió (🌓), sigue el tema
  function franja(h = new Date().getHours()) { return h >= 19 || h < 5 ? 'noche' : h < 8 ? 'amanecer' : h >= 17 ? 'atardecer' : 'dia'; }
  const CIELO = { amanecer: ['🌅', 'Amanecer'], dia: ['☀️', 'Día'], atardecer: ['🌇', 'Atardecer'], noche: ['🌙', 'Noche'] };
  function ponerTeselas() {
    if (!el.jg) return;
    const f = franja(); const elegido = document.documentElement.dataset.theme;
    const mapaOscuro = elegido ? elegido === 'dark' : (f === 'noche' || esOscuro());
    el.jg.classList.toggle('oscuro', esOscuro());
    el.jg.classList.toggle('mapa-oscuro', mapaOscuro);
    Object.keys(CIELO).forEach((k) => el.jg.classList.toggle(`h-${k}`, k === f));
    raiz.querySelectorAll('.jg-cielo').forEach((c) => { c.textContent = `${CIELO[f][0]} ${CIELO[f][1]}`; });
    if (!mapa) return;
    const t = mapaOscuro ? 'oscuro' : 'claro';
    const clave = `${usarCarto ? 'carto' : 'osm'}-${usarCarto ? t : ''}`;
    if (clave === temaActual) return;
    temaActual = clave;
    capaTeselas?.remove();
    capaTeselas = usarCarto
      ? L.tileLayer(TESELAS[t], { subdomains: 'abcd', maxZoom: 20, attribution: ATRIB, crossOrigin: 'anonymous' })
      : L.tileLayer(OSM, { maxZoom: 19, attribution: ATRIB_OSM, className: 'jg-osm', crossOrigin: 'anonymous' });
    capaTeselas.addTo(mapa);
  }
  function claseZoom() {
    const z = mapa.getZoom();
    el.mapa.classList.toggle('z-lejos', z < 15);
    el.mapa.classList.toggle('z-medio', z >= 15 && z < 17);
    el.mapa.classList.toggle('z-cerca', z >= 17);
  }

  // ---------- iconos (divIcon) ----------
  function iconoGym(lug) {
    const cap = capturadasDe(lug), tot = lug.datos.length, conq = E.conquistado(lug.sid);
    const pend = lug.datos.some(pendiente);
    if (bloqueado(lug)) {
      return L.divIcon({
        className: 'jg-gym-w', iconSize: [64, 64], iconAnchor: [32, 32],
        html: `<div class="jg-gym bloq" style="--c:${esc(lug.color)};--p:0%"><div class="jg-gym-anillo"><div class="jg-gym-ic">🔒</div></div>
          <div class="jg-gym-nom">${esc(lug.nombre)}<small>próximo</small></div></div>`,
      });
    }
    return L.divIcon({
      className: 'jg-gym-w', iconSize: [64, 64], iconAnchor: [32, 32],
      html: `<div class="jg-gym ${conq ? 'conq' : ''} ${cap === tot ? 'lleno' : ''} ${pend ? 'pend' : ''}" style="--c:${esc(lug.color)};--p:${(100 * cap / tot).toFixed(1)}%">
        <div class="jg-gym-anillo"><div class="jg-gym-ic">${esc(lug.icono)}</div></div>
        ${conq ? '<div class="jg-corona" aria-label="conquistado">👑</div>' : ''}
        <div class="jg-gym-nom">${esc(lug.nombre)}<small>${cap}/${tot}</small></div></div>`,
    });
  }
  function iconoStop(d) {
    const est = estadoDe(d);
    return L.divIcon({
      className: 'jg-stop-w', iconSize: [30, 30], iconAnchor: [15, 15],
      html: `<div class="jg-stop ${est}" style="--c:${esc(d.color)};--r:${(d.n * 0.37) % 2}s"><span>${esc(d.icono)}</span></div>`,
    });
  }
  function iconoAvatar() {
    return L.divIcon({
      className: 'jg-av-w', iconSize: [56, 64], iconAnchor: [28, 58],
      html: `<div class="jg-av ${avatar.caminando ? 'camina' : ''} ${avatar.izq ? 'izq' : ''}"><div class="jg-av-pulso"></div><div class="jg-av-sombra"></div>
        <div class="jg-av-cuerpo">${avatar.src ? `<img decoding="async" src="${esc(avatar.src)}" alt="">` : '<span>🧑‍⚕️</span>'}</div></div>`,
    });
  }
  function pintarAvatar() { avatar.marca?.setIcon(iconoAvatar()); }
  function refrescarMarca(d) {
    marcas.stop[d.id]?.setIcon(iconoStop(d));
    if (marcas.gym[d.sid]) marcas.gym[d.sid].setIcon(iconoGym(d.lug));
    aplicarNiebla();
  }
  function refrescarTodo() {
    DATOS.forEach((d) => marcas.stop[d.id]?.setIcon(iconoStop(d)));
    LUGARES.forEach((l) => marcas.gym[l.sid]?.setIcon(iconoGym(l)));
    aplicarNiebla();
  }

  // ---------- mapa por etapas (celular): se revela conforme capturas ----------
  // Visibles: las memoparadas ya capturadas + las FRONTERA siguientes del paseo. Gimnasio abierto = tiene alguna
  // parada visible; el siguiente aparece con candado y los demás quedan ocultos. En pantalla ancha se ve todo.
  const FRONTERA = 3;
  const mqCel = matchMedia('(max-width: 899px)');
  const progresivo = () => mqCel.matches && ajustes.get('mapaProgresivo') !== false;
  let abiertos = null;   // Set de sid con alguna parada visible (null = sin niebla)
  const bloqueado = (lug) => !!abiertos && !abiertos.has(lug.sid);
  function paradasVisibles() {
    const ver = new Set([...DATOS.filter((d) => E.capturado(d.id)).map((d) => d.id), ...P.pasadas()]);
    let n = 0;
    for (const d of DATOS) { if (n >= FRONTERA) break; if (!ver.has(d.id)) { ver.add(d.id); n++; } }
    if (hoja?.id) ver.add(hoja.id);
    return ver;
  }
  function aplicarNiebla(avisarNuevos = true) {
    if (!mapa) return;
    const antes = abiertos;
    const ver = progresivo() ? paradasVisibles() : null;
    el.mapa.classList.toggle('jg-prog', !!ver);
    const ahora = ver ? new Set() : null;
    for (const d of DATOS) {
      const m = marcas.stop[d.id]; if (!m) continue;
      const si = !ver || ver.has(d.id);
      if (si && ahora) ahora.add(d.sid);
      if (si && !mapa.hasLayer(m)) { m.addTo(mapa); if (antes && ver) m.getElement()?.classList.add('jg-aparece'); }
      else if (!si && mapa.hasLayer(m)) m.remove();
    }
    abiertos = ahora;
    let candado = false;
    for (const lug of LUGARES) {
      const m = marcas.gym[lug.sid]; if (!m) continue;
      const bloq = bloqueado(lug);
      const mostrar = !bloq || !candado;   // solo el primer gimnasio cerrado, como adelanto
      if (bloq) candado = true;
      if (mostrar) {
        const cambio = !antes !== !ahora || antes?.has(lug.sid) !== ahora?.has(lug.sid);
        if (cambio || !mapa.hasLayer(m)) m.setIcon(iconoGym(lug));
        if (!mapa.hasLayer(m)) m.addTo(mapa);
      } else if (mapa.hasLayer(m)) m.remove();
    }
    if (avisarNuevos && antes && ahora) {
      for (const sid of ahora) if (!antes.has(sid)) toast(`🔓 <b>¡Nuevo gimnasio abierto!</b> ${esc(LUG[sid].icono)} ${esc(LUG[sid].nombre)}`, 'oro');
    }
  }
  function avisoBloqueado(lug) {
    const faltan = DATOS.filter((d) => !E.capturado(d.id) && LUG[d.sid] !== lug && DATOS.indexOf(d) < DATOS.indexOf(lug.datos[0])).length;
    toast(`🔒 <b>${esc(lug.nombre)}</b> se abre cuando captures ${faltan === 1 ? 'la parada que falta' : `las ${faltan} paradas que faltan`} antes en el paseo.`);
  }
  const alCambiarVista = () => { if (!mapa) return; aplicarNiebla(false); caza.pintarApariciones(); };
  mqCel.addEventListener?.('change', alCambiarVista);
  ajustes.alCambiar((k) => { if (k === 'mapaProgresivo') alCambiarVista(); });

  // ---------- caminar ----------
  function caminoHasta(d) {
    const dest = d.ll;
    if (!avatar.ll) return [dest];
    if (d.ruta) {   // destino sobre la ruta diaria: caminar por la calle si el avatar también está en ella
      const a = d.ruta.proyectar(avatar.ll), b = d.ruta.proyectar(dest);
      return a.d < 120 && b.d < 120 && Math.abs(a.s - b.s) > 40 ? [avatar.ll, ...d.ruta.tramo(a.s, b.s), dest] : [avatar.ll, dest];
    }
    if (!ruta || avatar.s == null || d.s == null || metros(avatar.ll, dest) < 250) return [avatar.ll, dest];
    return [avatar.ll, ...ruta.tramo(avatar.s, d.s), dest];
  }
  async function caminar(d) {
    if (!mapa || !d.ll) return;
    const camino = caminoHasta(d);
    const acum = [0];
    for (let i = 1; i < camino.length; i++) acum.push(acum[i - 1] + metros(camino[i - 1], camino[i]));
    const total = acum[acum.length - 1];
    if (total < 2) { avatar.ll = d.ll; avatar.s = d.s ?? (ruta ? ruta.proyectar(d.ll).s : null); avatar.marca.setLatLng(d.ll); return; }
    // encuadrar el trayecto si se sale de la vista
    const b = L.latLngBounds(camino);
    if (!mapa.getBounds().pad(-0.08).contains(b)) {
      mapa.flyToBounds(b, { padding: [70, 70], maxZoom: 17, duration: sinMov() ? 0 : 0.7 });
      await pausa(sinMov() ? 50 : 750);
    }
    const dur = sinMov() ? 1 : Math.max(700, Math.min(3200, 600 + total * 0.6));
    avatar.caminando = true;
    avatar.izq = d.ll[1] < avatar.ll[1];
    pintarAvatar();
    await new Promise((fin) => {
      const t0 = performance.now();
      const paso = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;   // ease in-out
        const s = e * total;
        let i = 1; while (i < acum.length - 1 && acum[i] < s) i++;
        const seg = acum[i] - acum[i - 1];
        const p = mezclar(camino[i - 1], camino[i], seg ? (s - acum[i - 1]) / seg : 1);
        avatar.marca.setLatLng(p);
        if (k < 1) requestAnimationFrame(paso); else fin();
      };
      requestAnimationFrame(paso);
    });
    avatar.ll = d.ll; avatar.s = d.s ?? (ruta ? ruta.proyectar(d.ll).s : null); avatar.caminando = false;
    pintarAvatar();
    if (progresivo()) caza.pintarApariciones();   // las criaturas e hitos visibles dependen de dónde estás
  }
  let ocupado = false;
  async function irAParada(id) {
    const d = POR_ID[id]; if (!d || ocupado) return;
    if (!mapa || !d.ll) { abrirParada(id); return; }
    ocupado = true;
    try {
      if (marcas.stop[id] && !mapa.hasLayer(marcas.stop[id])) marcas.stop[id].addTo(mapa);
      if (window.innerWidth < 900) cerrarHoja(true);
      await caminar(d);
      E.marcarParada(d.id);
      abrirParada(id);
      enfocar(d.ll);
    } finally { ocupado = false; }
  }
  function enfocar(ll) {
    if (!mapa || !ll) return;
    const tam = mapa.getSize();
    const ancho = innerWidth >= 900;
    const objetivo = L.point(ancho ? (tam.x - 400) / 2 : tam.x / 2, ancho ? tam.y / 2 : tam.y * 0.27);
    const p = mapa.latLngToContainerPoint(ll);
    if (mapa.getZoom() < 17) {
      const z = 17.5; const c = mapa.project(ll, z).subtract(objetivo.subtract(tam.divideBy(2)));
      mapa.flyTo(mapa.unproject(c, z), z, { duration: sinMov() ? 0 : 0.6 });
    } else mapa.panBy(p.subtract(objetivo), { duration: sinMov() ? 0 : 0.4 });
  }
  function siguiente() {
    const desde = POR_ID[E.ultimaParada()]?.num || 0;
    const rot = [...DATOS.slice(desde), ...DATOS.slice(0, desde)];
    return rot.find((d) => pendiente(d)) || rot.find((d) => !E.capturado(d.id)) || null;
  }

  // ---------- ubicación real (opt-in, solo en el dispositivo) ----------
  function ubicar() {
    if (!('geolocation' in navigator)) return toast('📍 Este navegador no permite usar la ubicación.', 'aviso');
    if (!mapa) return toast('📍 Primero hace falta el mapa.', 'aviso');
    const geos = (si) => raiz.querySelectorAll('.jg-geo').forEach((x) => x.classList.toggle('cargando', si));
    const b = { classList: { add: () => geos(true), remove: () => geos(false) } };
    b.classList.add('cargando');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      b.classList.remove('cargando');
      const ll = [pos.coords.latitude, pos.coords.longitude];
      const centro = aLL(mapaDatos.centro) || LUGARES[0]?.ll;
      if (centro && metros(ll, centro) > 30000) {
        toast(`📍 Estás a ${Math.round(metros(ll, centro) / 1000)} km de Puno. El bonus x2 solo vale caminando el paseo real.`, 'aviso');
        return;
      }
      circuloGeo?.remove();
      circuloGeo = L.circle(ll, { radius: Math.min(150, pos.coords.accuracy || 30), className: 'jg-geo-circ', interactive: false }).addTo(mapa);
      // mover el avatar a tu posición (fuera de la ruta)
      const falso = { ll, s: null };
      await caminar(falso);
      avatar.s = ruta ? ruta.proyectar(ll).s : null;
      bonus = { ll, t: Date.now() };
      caza.alUbicar(ll);   // "¡Está aquí!" en apariciones a menos de 40 m (y seguimiento mientras juegas)
      let cerca = null, dmin = Infinity;
      DATOS.forEach((d) => { if (d.ll) { const m = metros(ll, d.ll); if (m < dmin) { dmin = m; cerca = d; } } });
      if (cerca && dmin < BONUS_M) {
        toast(`🎉 <b>¡Estás en el lugar real!</b> Bonus x2 XP en «${esc(cerca.nombre)}» (${Math.round(dmin)} m).`, 'oro');
        E.marcarParada(cerca.id);
        abrirParada(cerca.id); enfocar(cerca.ll);
      } else {
        toast(`📍 Te ubiqué. La memoparada más cercana está a ${dmin < 1000 ? `${Math.round(dmin)} m` : `${(dmin / 1000).toFixed(1)} km`}: acércate a menos de ${BONUS_M} m para el bonus x2.`);
        mapa.flyTo(ll, Math.max(mapa.getZoom(), 16.5), { duration: sinMov() ? 0 : 0.6 });
      }
    }, (err) => {
      b.classList.remove('cargando');
      toast(err.code === 1 ? '📍 Permiso de ubicación denegado. Puedes jugar igual caminando en el mapa.' : '📍 No pude obtener tu ubicación ahora.', 'aviso');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 20000 });
  }
  const conBonus = (d) => !!(bonus && d.ll && Date.now() - bonus.t < BONUS_MIN * 60000 && metros(bonus.ll, d.ll) < BONUS_M);

  // ---------- hoja inferior ----------
  function abrirHoja(estado) {
    hoja = estado;
    el.hoja.hidden = false;
    el.jg.classList.add('con-hoja');
    requestAnimationFrame(() => el.hoja.classList.add('on'));
    pintarHoja();
    el.hoja.scrollTop = 0;
  }
  function cerrarHoja(rapido = false) {
    hoja = null; reto = null; desafio = null;
    el.jg?.classList.remove('con-hoja');
    if (!el.hoja) return;
    el.hoja.classList.remove('on');
    if (rapido) el.hoja.hidden = true; else setTimeout(() => { if (!hoja) el.hoja.hidden = true; }, 320);
  }
  function pintarHoja() {
    if (!hoja) return;
    el.hojaIn.innerHTML = hoja.tipo === 'parada' ? htmlParada() : hoja.tipo === 'gym' ? htmlGym() : hoja.tipo === 'misiones' ? caza.htmlMisiones() : htmlDesafio();
    const ta = el.hojaIn.querySelector('textarea'); if (ta && !('ontouchstart' in window)) ta.focus();
  }
  function abrirParada(id) {
    const d = POR_ID[id]; if (!d) return;
    const est = estadoDe(d);
    reto = est === 'capturada' ? null : nuevoReto(d);
    abrirHoja({ tipo: 'parada', id });
  }
  // J1: el reto arranca escribiendo de memoria (#007, #042); las 4 opciones y la pista llegan tras fallar
  function nuevoReto(d, modo = 'escribir', evitar) {
    const p = elegirPregunta(d, evitar);
    return p ? { id: d.id, p, modo, vioOpciones: false, fallos: 0, malas: new Set(), fase: 'preg', escrito: '', ganado: null, eraEstado: estadoDe(d) } : null;
  }

  const imgEscena = (d, cls = 'jg-escena') => (d.m?.imagen ? `<img decoding="async" class="${cls}" src="${esc(d.m.imagen)}" alt="${esc(d.m.ancla || d.nombre)}" loading="lazy" onerror="this.remove()">` : '');
  function htmlPista(d) {
    const m = d.m;
    const mia = mias.get(d.id) || null;   // V4: tu ancla / tu escena, si existen, van primero
    const ancla = mia?.ancla || m?.ancla, escena = mia?.escena || m?.escena;
    if (ancla || escena || m?.codigo?.length) {
      return `<div class="jg-pista"><p class="jg-pt">💡 Pista de tu palacio${mia?.ancla || mia?.escena ? ' <small>(tu versión)</small>' : ''}</p>
        ${imgEscena(d)}
        ${ancla ? `<p class="ancla">⚓ ${esc(ancla)}</p>` : ''}
        ${m?.codigo?.length ? `<div class="jg-cod">${m.codigo.map((c) => `<span><b>${esc(c.palabra)}</b><small>${esc(c.letras || '')}</small></span>`).join('')}</div>` : ''}
        ${escena ? `<p class="jg-esc-txt">🎬 ${esc(escena)}</p>` : ''}</div>`;
    }
    if (d.tipo === 'fila') {
      const f = d.src; const pts = [];
      if (f.sube?.t) pts.push(`🔺 <b>Si sube:</b> ${resaltar(f.sube.t)}`);
      if (f.baja?.t) pts.push(`🔻 <b>Si baja:</b> ${resaltar(f.baja.t)}`);
      if (f.perla) pts.push(`💡 ${resaltar(f.perla)}`);
      return `<div class="jg-pista"><p class="jg-pt">💡 Pista (aún sin escena de memoria)</p>${pts.map((x) => `<p>${x}</p>`).join('') || '<p>Revisa la ficha en la tabla de valores.</p>'}</div>`;
    }
    return `<div class="jg-pista"><p class="jg-pt">💡 Pista</p><p>${esc(d.src.mide || '')}</p>${(d.src.items || []).slice(0, 3).map(([a, b]) => `<p><b>${esc(a)}:</b> ${resaltar(b)}</p>`).join('')}</div>`;
  }
  function htmlFicha(d, conImg = true) {
    const m = d.m;
    return `<div class="jg-ficha">
      ${conImg ? imgEscena(d, 'jg-escena grande') : ''}
      <p class="jg-valor"><span>✅ ${d.tipo === 'fila' ? 'Normal' : 'Interpretación'}</span>${resaltar(d.valor || '—')}</p>
      ${htmlRealidad(d)}
      ${m?.codigo?.length ? `<div class="jg-cod">${m.codigo.map((c) => `<span><i>${esc(c.numero)}</i><b>${esc(c.palabra)}</b><small>${esc(c.letras || '')}</small></span>`).join('')}</div>` : ''}
      ${m?.ancla ? `<p class="ancla">⚓ ${esc(m.ancla)}</p>` : ''}
      ${m?.acronimo?.sigla ? `<p class="jg-acr">🔤 <b>${esc(m.acronimo.sigla)}</b> — ${esc(m.acronimo.desarrollo || '')}</p>` : ''}
      ${m?.escena ? `<p class="jg-esc-txt">🎬 ${esc(m.escena)}</p>` : ''}
      ${!m ? '<p class="jg-mute">🧠 Este dato aún no tiene escena de memoria.</p>' : ''}
    </div>`;
  }
  // la realidad del dato (no solo la mnemotecnia): qué indica si sube o baja, dato clave y perla clínica
  function htmlRealidad(d) {
    const t = (x) => (x?.t ? resaltar(x.t) : '');
    const f = d.tipo === 'fila' ? d.src : null;
    const filas = f ? [
      f.clave?.texto && [`${f.clave.icono || '💡'} Clave`, resaltar(f.clave.texto)],
      f.sube?.t && ['⬆️ Si sube', t(f.sube)], f.baja?.t && ['⬇️ Si baja', t(f.baja)],
      f.altura?.t && ['🏔️ En altura', t(f.altura)], f.perla && ['💎 Perla', resaltar(f.perla)],
    ] : [d.src.mide && ['📏 Mide', esc(d.src.mide)]];
    const x = EXPLICA[d.id];
    if (x?.porque) filas.unshift(['🧪 Por qué pasa', esc(x.porque)]);
    if (x?.ejemplo) filas.push(['🩺 Ejemplo', resaltar(x.ejemplo)]);
    const v = filas.filter(Boolean);
    if (x?.origen === 'literatura') v.push(['', '<small class="jg-mute">📚 Explicación de literatura estándar (no estaba en tu vault)</small>']);
    return v.length ? `<details class="jg-real" open><summary>🔬 Qué significa en la clínica</summary><dl>${v.map(([k, x]) => `<dt>${k}</dt><dd>${x}</dd>`).join('')}</dl></details>` : '';
  }
  function cabParada(d, est) {
    return `<div class="jg-h-cab" style="--c:${esc(d.color)}">
      <button class="jg-chip-lugar" data-acc="gym" data-sid="${d.sid}">${esc(d.lug.icono)} ${esc(d.lug.nombre)}</button>
      <span class="jg-badge ${est}">${ETQ[est]}</span>${conBonus(d) ? '<span class="jg-badge x2">📍 x2 XP</span>' : ''}</div>
      <h3 class="jg-h-tit"><span class="jg-h-ic" style="--c:${esc(d.color)}">${esc(d.icono)}</span><span>${esc(d.nombre)}<small>#${String(d.num).padStart(3, '0')} · memoparada ${d.n + 1}/${d.lug.datos.length}</small></span></h3>
      <p class="jg-ub">📍 ${esc(d.ubicacion)}</p>`;
  }
  function htmlParada() {
    const d = POR_ID[hoja.id]; const est = estadoDe(d);
    if (!reto) {
      return `${cabParada(d, est)}<div class="jg-ya">✅ Ya está en tu Memodex. ${S.info(cardsDe(d)[0]) ? `Próximo repaso: ${fechaRepaso(d)}.` : ''}</div>
        ${htmlFicha(d)}
        <div class="jg-btns"><button class="btn pri" data-acc="practicar">🔁 Practicar otra vez <small>+${XP.practica} XP</small></button>
        <button class="btn" data-acc="sig">Siguiente memoparada →</button></div>`;
    }
    const r = reto, p = r.p;
    let cuerpo = '';
    if (r.fase === 'ok') {
      cuerpo = `<div class="jg-exito"><div class="jg-exito-t">${r.ganado.nueva ? '🧠 ¡Capturado!' : r.ganado.repaso ? '🔁 ¡Recapturado!' : '✔ ¡Bien!'}</div>
        <div class="jg-exito-xp">+${r.ganado.xp} XP${r.ganado.x2 ? ' <span class="x2">x2 en el lugar real</span>' : ''}</div></div>
        <p class="jg-q chica">${esc(p.q)}</p><p class="jg-resp">${resaltar(p.a)}</p>
        ${htmlFicha(d, false)}
        <div class="jg-btns"><button class="btn pri" data-acc="sig">Siguiente memoparada →</button><button class="btn" data-acc="dex-carta" data-id="${d.id}">📖 Ver carta</button></div>`;
    } else if (r.fase === 'escrito') {
      cuerpo = `<p class="jg-q">${esc(p.q)}</p>
        <div class="jg-compara"><div><small>Tú escribiste</small><p>${esc(r.escrito) || '<i>(vacío)</i>'}</p></div><div class="ok"><small>Respuesta</small><p>${resaltar(p.a)}</p></div></div>
        <p class="jg-mute">Sé honesto contigo: ¿lo tenías?</p>
        <div class="jg-btns"><button class="btn pri" data-acc="autoeval" data-ok="1">✅ Sí, lo sabía</button><button class="btn" data-acc="autoeval" data-ok="0">❌ No del todo</button></div>`;
    } else {
      const fallo = r.fase === 'fallo';
      const ops = r.modo === 'elegir'
        ? `<div class="jg-ops" role="group" aria-label="Opciones">${p.opciones.map((o, i) => `<button class="jg-op ${r.malas.has(i) ? 'mala' : ''}" data-acc="op" data-i="${i}" ${r.malas.has(i) ? 'disabled' : ''}>
            <span class="l">${'ABCD'[i]}</span><span class="t">${resaltar(o)}</span></button>`).join('')}</div>
           ${fallo ? '' : '<button class="jg-link" data-acc="modo" data-modo="escribir">✍️ Prefiero escribirla de memoria</button>'}`
        : `<p class="jg-mute">✍️ Responde de memoria, sin opciones: escribir cuesta más y fija más.</p>
          <div class="jg-escribir"><textarea rows="2" placeholder="Escribe tu respuesta de memoria…" aria-label="Tu respuesta">${esc(r.escrito)}</textarea>
            <div class="jg-btns"><button class="btn pri" data-acc="comprobar">Comprobar</button><button class="btn" data-acc="nose">🤷 No sé</button><button class="jg-link" data-acc="modo" data-modo="elegir">🔘 Ver 4 opciones (½ XP)</button></div></div>`;
      cuerpo = `${est === 'repaso' && E.capturado(d.id) ? '<p class="jg-aviso-rep">⏰ Esta carta se está escapando de tu memoria: recaptúrala.</p>' : ''}
        <div class="jg-reto-t">🎯 Reto de captura${r.fallos ? ` · intento ${r.fallos + 1}` : ''}</div>
        <p class="jg-q">${esc(p.q)}</p>
        ${fallo ? `<div class="jg-fallo">❌ Se escapó… usa la pista y vuelve a intentarlo.</div>${htmlPista(d)}` : ''}
        ${ops}
        ${r.fallos >= 2 ? '<button class="jg-link" data-acc="ver-resp">👀 Ver la respuesta</button>' : ''}
        ${r.verResp ? `<p class="jg-resp">${resaltar(p.a)}</p>` : ''}`;
    }
    return `${cabParada(d, est)}${r.fase === 'ok' ? imgEscena(d) : ''}<div class="jg-reto">${cuerpo}</div>`;
  }
  function fechaRepaso(d) {
    const due = Math.min(...cardsDe(d).map((c) => S.info(c)?.due || Infinity));
    if (!Number.isFinite(due)) return '—';
    const dias = Math.max(0, Math.round((due - Date.now()) / 86400000));
    return dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`;
  }

  // ---------- respuesta del reto ----------
  function elegir(i, boton) {
    const r = reto; if (!r || r.fase === 'ok') return;
    if (norm(r.p.opciones[i]) === norm(r.p.a)) acierto(boton);
    else { r.malas.add(i); fallo(boton); }
  }
  function comprobarEscrito() {
    const r = reto; if (!r) return;
    r.escrito = el.hojaIn.querySelector('textarea')?.value.trim() || '';
    const nr = numeros(r.p.a), ne = numeros(r.escrito);
    const exacto = r.escrito && norm(r.escrito) === norm(r.p.a);
    const cifras = nr.length >= 1 && nr.slice(0, 3).every((x) => ne.includes(x));
    if (exacto || cifras) { acierto(el.hojaIn.querySelector('[data-acc="comprobar"]')); return; }
    r.fase = 'escrito'; pintarHoja();
  }
  function fallo(boton) {
    const r = reto; const d = POR_ID[r.id];
    if (!r.fallos) calificar(r.p.card, 1);
    r.fallos += 1; r.fase = 'fallo'; r.modo = r.modo === 'escribir' ? 'elegir' : r.modo;
    E.contar('fallos');
    if (boton) { boton.classList.add('mala', 'tiembla'); boton.disabled = true; }
    setTimeout(() => { pintarHoja(); refrescarMarca(d); }, boton ? 380 : 0);
  }
  async function acierto(boton) {
    const r = reto; const d = POR_ID[r.id];
    const eraRepaso = r.eraEstado === 'repaso' && E.capturado(d.id);
    // J1: escribiendo → nota 3 y XP completo; con las 4 opciones a la vista → nota máx. 2 y la mitad de XP
    if (!r.fallos) calificar(r.p.card, r.vioOpciones ? 2 : 3);
    const nueva = E.capturar(d.id);
    let xp = nueva ? (r.fallos ? XP.nuevaTrasFallo : XP.nueva) : eraRepaso ? XP.repaso : XP.practica;
    if (r.vioOpciones && !r.fallos) xp = Math.max(XP.practica, Math.round(xp / 2));
    const x2 = conBonus(d) && (nueva || eraRepaso);
    if (x2) { xp *= 2; E.contar('enLugar'); }
    if (eraRepaso) E.contar('repasos');
    E.contar('aciertos');
    r.ganado = { xp, x2, nueva, repaso: eraRepaso };
    if (boton) boton.classList.add('buena');
    const animar = (nueva || eraRepaso) && !sinMov();
    if (animar) { animHasta = Date.now() + 2500; await pausa(250); await animacionCaptura(d); }
    E.registrarActividad();
    E.sumarXP(xp, `${nueva ? 'captura' : eraRepaso ? 'repaso' : 'práctica'}: ${d.nombre}`);
    if (nueva || eraRepaso) caza.evento('captura', { clase: d.tipo === 'escala' ? 'escala' : 'dato', sid: d.sid, rareza: d.tipo === 'escala' ? 'raro' : 'comun', sinFallo: !r.fallos });
    revisarLogros();
    if (reto === r) { r.fase = 'ok'; pintarHoja(); }
    refrescarMarca(d); pintarHUD(); if (dex.abierto) pintarDex();
  }
  function animacionCaptura(d) {
    const cap = document.createElement('div');
    cap.className = 'jg-captura';
    cap.setAttribute('aria-hidden', 'true');
    cap.innerHTML = `<div class="jg-cap-item" style="--c:${esc(d.color)}">${esc(d.icono)}</div>
      <div class="jg-bola"><div class="jg-bola-base"></div><div class="jg-bola-tapa"><span>🧠</span></div><div class="jg-bola-boton"></div></div>
      <div class="jg-chispas">${'<i></i>'.repeat(10)}</div><div class="jg-cap-txt">¡Capturado!</div>`;
    el.hoja.scrollTop = 0;
    el.hoja.appendChild(cap);
    return pausa(2250).then(() => { cap.classList.add('fuera'); setTimeout(() => cap.remove(), 300); });
  }

  // ---------- gimnasio y desafío ----------
  function abrirGym(sid) {
    if (!LUG[sid]) return;
    abrirHoja({ tipo: 'gym', sid });
    if (mapa && LUG[sid].ll && innerWidth < 900) enfocar(LUG[sid].ll);
  }
  function htmlGym() {
    const lug = LUG[hoja.sid]; const cap = capturadasDe(lug), tot = lug.datos.length, conq = E.conquistado(lug.sid);
    const pend = lug.datos.filter(pendiente).length;
    return `<div class="jg-gym-cab" style="--c:${esc(lug.color)}">
        <img decoding="async" class="jg-gym-img" src="img/lugares/${esc(lug.sid)}.webp" alt="" onerror="this.remove()">
        <div class="jg-gym-emb ${conq ? 'conq' : ''}">${esc(lug.icono)}${conq ? '<i>👑</i>' : ''}</div>
        <div><p class="jg-mute">Gimnasio · ${esc(lug.titulo)}</p><h3>${esc(lug.nombre)}</h3></div></div>
      ${lug.porque ? `<p class="jg-porque">${esc(lug.porque)}</p>` : ''}
      <div class="jg-prog" style="--c:${esc(lug.color)}"><div class="jg-prog-b"><i style="width:${(100 * cap / tot).toFixed(1)}%"></i></div>
        <span>🧠 ${cap}/${tot} capturadas${pend ? ` · ⏰ ${pend} por repasar` : ''}${conq ? ' · 👑 conquistado' : ''}</span></div>
      <div class="jg-btns"><button class="btn pri jg-btn-des" data-acc="desafio" data-sid="${lug.sid}">⚔️ Desafío del gimnasio <small>5 preguntas · gana con ${GANA_DESAFIO}</small></button>
        ${mapa && lug.ll ? `<button class="btn" data-acc="acercar" data-sid="${lug.sid}">🔍 Acercar</button>` : ''}</div>
      <div class="jg-palacio"><span>${chipPalacio(lug.sid)}</span><button class="btn" data-acc="palacio" data-sid="${lug.sid}">🏛️ Pasear este palacio</button></div>
      <p class="jg-pt">Memoparadas del recorrido</p>
      <ol class="jg-lista">${lug.datos.map((d) => { const e = estadoDe(d); return `<li><button data-acc="ir" data-id="${d.id}" class="${e}">
        <span class="jg-mini ${e}" style="--c:${esc(d.color)}">${esc(d.icono)}</span><span><b>${E.capturado(d.id) ? esc(d.nombre) : '???'}</b><small>📍 ${esc(d.ubicacion)}</small></span></button></li>`; }).join('')}</ol>`;
  }
  // C2: estado del lugar como tarjeta de palacio `pal:${sid}` (se califica en la vista Ciudad)
  function chipPalacio(sid) {
    const t = S.info(`pal:${sid}`);
    if (!t) return '🏛️ Palacio sin pasear';
    if (S.vence(`pal:${sid}`)) return '🏛️ <b>Toca repasar el palacio</b>';
    const dias = Math.max(1, Math.ceil((t.due - Date.now()) / 86400000));
    return `🏛️ Próximo paseo: ${dias === 1 ? 'mañana' : `en ${dias} días`}`;
  }
  function empezarDesafio(sid) {
    const lug = LUG[sid];
    const datos = barajar(lug.datos).slice(0, 5);
    desafio = { sid, i: 0, ok: 0, marcas: [], preguntas: datos.map((d) => ({ d, p: elegirPregunta(d) })).filter((x) => x.p), bloqueado: false };
    hoja = { tipo: 'desafio' };
    pintarHoja();
  }
  function htmlDesafio() {
    const ds = desafio; const lug = LUG[ds.sid]; const n = ds.preguntas.length;
    const puntos = `<div class="jg-dots">${ds.preguntas.map((_, i) => `<i class="${ds.marcas[i] === true ? 'ok' : ds.marcas[i] === false ? 'mal' : i === ds.i ? 'act' : ''}"></i>`).join('')}</div>`;
    if (ds.i >= n) {
      const gana = ds.ok >= Math.min(GANA_DESAFIO, n);
      return `<div class="jg-h-cab" style="--c:${esc(lug.color)}"><span class="jg-chip-lugar">⚔️ ${esc(lug.nombre)}</span></div>${puntos}
        <div class="jg-fin-des ${gana ? 'gana' : ''}"><div class="big">${gana ? '👑' : '💪'}</div>
        <h3>${gana ? '¡Gimnasio conquistado!' : 'Casi…'}</h3><p>${ds.ok} de ${n} correctas${gana ? '' : ` · necesitas ${Math.min(GANA_DESAFIO, n)}`}</p>
        ${gana ? `<p class="jg-exito-xp">+${ds.xp} XP</p>` : '<p class="jg-mute">Repasa las memoparadas que fallaste y vuelve a retar al gimnasio.</p>'}</div>
        <div class="jg-btns"><button class="btn pri" data-acc="desafio" data-sid="${ds.sid}">${gana ? '⚔️ Jugar otra vez' : '🔁 Reintentar desafío'}</button><button class="btn" data-acc="gym" data-sid="${ds.sid}">← Volver al gimnasio</button></div>`;
    }
    const { d, p } = ds.preguntas[ds.i];
    return `<div class="jg-h-cab" style="--c:${esc(lug.color)}"><span class="jg-chip-lugar">⚔️ Desafío · ${esc(lug.nombre)}</span><span class="jg-badge">${ds.i + 1}/${n}</span></div>${puntos}
      <p class="jg-ub">${esc(d.icono)} ${esc(d.nombre)} · 📍 ${esc(d.ubicacion)}</p>
      <p class="jg-q">${esc(p.q)}</p>
      <div class="jg-ops">${p.opciones.map((o, i) => `<button class="jg-op" data-acc="d-op" data-i="${i}"><span class="l">${'ABCD'[i]}</span><span class="t">${resaltar(o)}</span></button>`).join('')}</div>`;
  }
  async function responderDesafio(i, boton) {
    const ds = desafio; if (!ds || ds.bloqueado) return;
    ds.bloqueado = true;
    const { d, p } = ds.preguntas[ds.i];
    const bien = norm(p.opciones[i]) === norm(p.a);
    calificar(p.card, bien ? 3 : 1);
    ds.marcas[ds.i] = bien;
    if (bien) { ds.ok += 1; E.sumarXP(XP.desafioOk, `desafío: ${d.nombre}`); E.contar('aciertos'); } else E.contar('fallos');
    el.hojaIn.querySelectorAll('.jg-op').forEach((b, k) => {
      b.disabled = true;
      if (norm(p.opciones[k]) === norm(p.a)) b.classList.add('buena');
    });
    if (!bien) boton.classList.add('mala', 'tiembla');
    await pausa(bien ? 750 : 1500);
    if (desafio !== ds) return;
    ds.i += 1; ds.bloqueado = false;
    if (ds.i >= ds.preguntas.length) terminarDesafio();
    pintarHoja();
    refrescarMarca(d);
  }
  function terminarDesafio() {
    const ds = desafio; const n = ds.preguntas.length;
    E.contar('desafios'); E.registrarActividad();
    if (ds.ok >= Math.min(GANA_DESAFIO, n)) {
      const perfecto = ds.ok === n;
      ds.xp = XP.gimnasio + (perfecto ? XP.perfecto : 0);
      if (perfecto) E.contar('perfectos');
      E.conquistar(ds.sid);
      caza.evento('gimnasio');
      E.sumarXP(ds.xp, `gimnasio ${LUG[ds.sid].nombre}`);
      confetti([LUG[ds.sid].color, '#f59e0b', '#fde047', '#a78bfa', '#ffffff']);
    }
    revisarLogros(); refrescarTodo(); pintarHUD();
  }

  // ---------- HUD ----------
  let nivelPrevio = null;
  function pintarHUD() {
    if (!el.hud) return;
    const nv = E.nivel();
    const q = (s) => el.hud.querySelector(s);
    q('.jg-nv b').textContent = nv.n;
    q('.jg-xpbar i').style.width = `${(nv.progreso * 100).toFixed(1)}%`;
    q('.jg-xptxt').textContent = `${nv.xp - nv.base} / ${nv.siguiente - nv.base} XP`;
    const r = E.racha();
    q('.jg-racha b').textContent = r;
    q('.jg-racha').classList.toggle('viva', r > 0);
    const nCaps = DATOS.filter((d) => E.capturado(d.id)).length;
    q('.jg-caps b').textContent = nCaps;
    const dc = el.dock?.querySelector('.jg-dk-caps'); if (dc) dc.textContent = `${nCaps}/${TOTAL} capturas`;
    if (nivelPrevio != null && nv.n > nivelPrevio) { q('.jg-nv').classList.remove('sube'); void q('.jg-nv').offsetWidth; q('.jg-nv').classList.add('sube'); }
    nivelPrevio = nv.n;
  }
  function flotarXP(n) {
    if (!n || !el.hud) return;
    const f = document.createElement('div');
    f.className = 'jg-xpflota'; f.textContent = `+${n} XP`;
    el.hud.querySelector('.jg-xp').appendChild(f);
    setTimeout(() => f.remove(), 1400);
  }
  function alEvento(tipo, datos) {
    if (!montado) return;
    if (tipo === 'xp') { pintarHUD(); flotarXP(datos.ganado); }
    else if (tipo === 'nivel') {
      const espera = Math.max(0, animHasta - Date.now());
      setTimeout(() => { confetti(['#6d28d9', '#a78bfa', '#f59e0b', '#ec4899', '#22c55e', '#38bdf8']); toast(`⭐ <b>¡Subiste a nivel ${datos.n}!</b>`, 'nivel', 0); }, espera);
    } else if (tipo === 'logro') {
      const l = LOGRO[datos.id];
      if (l) toast(`<span class="jg-t-ic">${esc(l.ic)}</span><span><small>Logro desbloqueado</small><b>${esc(l.nombre)}</b></span>`, 'logro');
    } else if (tipo === 'racha') pintarHUD();
  }
  function toast(html, tipo = '', espera) {
    const w = espera ?? Math.max(0, animHasta - Date.now());
    setTimeout(() => {
      if (!el.toasts) return;
      const t = document.createElement('div');
      t.className = `jg-toast ${tipo}`; t.innerHTML = html; t.setAttribute('role', 'status');
      el.toasts.appendChild(t);
      while (el.toasts.children.length > 3) el.toasts.firstElementChild.remove();
      setTimeout(() => { t.classList.add('fuera'); setTimeout(() => t.remove(), 400); }, tipo === 'aviso' || tipo === 'oro' ? 5200 : 3600);
    }, w);
  }

  // ---------- Memodex ----------
  function abrirDex(id = null) { dex.abierto = true; dex.ficha = id; el.dex.hidden = false; requestAnimationFrame(() => el.dex.classList.add('on')); pintarDex(); }
  function cerrarDex() { dex.abierto = false; dex.ficha = null; el.dex.classList.remove('on'); setTimeout(() => { if (!dex.abierto) el.dex.hidden = true; }, 280); }
  function pintarDex() {
    const caps = DATOS.filter((d) => E.capturado(d.id)).length;
    const nv = E.nivel(); const st = E.stats();
    if (dex.tab === 'cartas') dex.tab = 'datos';
    const tabs = [{ tab: 'datos', ic: '🃏', nombre: 'Datos', cap: caps, tot: TOTAL }, ...caza.dexTabs(),
      { tab: 'logros', ic: '🏆', nombre: 'Logros', cap: LOGROS.filter((l) => E.tieneLogro(l.id)).length, tot: LOGROS.length }];
    const totalCartas = tabs.filter((t) => t.tab !== 'logros').reduce((a, t) => [a[0] + t.cap, a[1] + t.tot], [0, 0]);
    const cab = `<div class="jg-dex-cab"><div><h3>📖 Memodex</h3><p class="jg-mute">${totalCartas[0]}/${totalCartas[1]} cartas · Nv ${nv.n} · ${nv.xp} XP · mejor racha ${E.mejorRacha()} 🔥 · ${st.aciertos} aciertos${st.salvajes ? ` · 🌿 ${st.salvajes} salvajes` : ''}</p></div>
      <button class="jg-x estat" data-acc="dex-cerrar" aria-label="Cerrar Memodex">✕</button></div>
      <div class="jg-dex-prog"><i style="width:${totalCartas[1] ? (100 * totalCartas[0] / totalCartas[1]).toFixed(1) : 0}%"></i></div>
      <div class="jg-tabs" role="tablist">${tabs.map((t) => `<button role="tab" aria-selected="${dex.tab === t.tab}" class="${dex.tab === t.tab ? 'on' : ''}" data-acc="dex-tab" data-tab="${t.tab}">
        <span aria-hidden="true">${t.ic}</span> ${t.nombre} <small>${t.cap}/${t.tot}</small></button>`).join('')}</div>`;
    let cuerpo;
    if (dex.tab === 'logros') {
      cuerpo = `<div class="jg-logros">${LOGROS.map((l) => { const ok = E.tieneLogro(l.id); return `<div class="jg-logro ${ok ? 'ok' : ''}"><span class="ic">${ok ? esc(l.ic) : '🔒'}</span><span><b>${esc(l.nombre)}</b><small>${esc(l.desc)}</small></span></div>`; }).join('')}</div>`;
    } else if (dex.tab !== 'datos') {
      cuerpo = caza.htmlDexTab(dex.tab);
    } else {
      const filtro = `<div class="jg-filtros"><button class="chip ${dex.sid ? '' : 'on'}" data-acc="dex-filtro" data-sid="">Todas</button>${LUGARES.map((l) =>
        `<button class="chip ${dex.sid === l.sid ? 'on' : ''}" data-acc="dex-filtro" data-sid="${l.sid}">${esc(l.icono)} ${esc(l.titulo)} <small>${capturadasDe(l)}/${l.datos.length}</small></button>`).join('')}</div>`;
      const lista = DATOS.filter((d) => !dex.sid || d.sid === dex.sid);
      cuerpo = `${filtro}<div class="jg-cartas">${lista.map((d) => { const c = E.capturado(d.id); const e = estadoDe(d); const rar = d.tipo === 'escala' ? 'raro' : 'comun'; return `<button class="jg-carta r-${rar} ${c ? 'cap' : ''} ${e}" style="--c:${esc(d.color)};--i:${(d.num % 12) * 30}ms" data-acc="dex-carta" data-id="${d.id}" aria-label="${c ? esc(d.nombre) : 'Carta sin capturar'}">
        <span class="num">#${String(d.num).padStart(3, '0')}</span><span class="ic">${esc(d.icono)}</span><span class="nm">${c ? esc(d.nombre) : '???'}</span><span class="lg">${esc(d.lug.icono)}${e === 'repaso' ? ' ⏰' : ''}</span></button>`; }).join('')}</div>`;
    }
    let ficha = '';
    if (dex.ficha && POR_ID[dex.ficha]) {
      const d = POR_ID[dex.ficha]; const c = E.capturado(d.id); const rar = d.tipo === 'escala' ? 'raro' : 'comun';
      ficha = `<div class="jg-modal" data-acc="ficha-fondo"><div class="jg-ficha-carta r-${rar} ${c ? 'cap' : ''}" style="--c:${esc(d.color)}" role="dialog" aria-label="${esc(c ? d.nombre : 'Carta sin capturar')}">
        <button class="jg-x" data-acc="ficha-cerrar" aria-label="Cerrar ficha">✕</button>
        <div class="jg-fc-cab"><span class="ic">${esc(d.icono)}</span><div><small>#${String(d.num).padStart(3, '0')} · ${esc(d.lug.icono)} ${esc(d.lug.nombre)}</small><h3>${c ? esc(d.nombre) : '???'}</h3></div></div>
        <p class="jg-ub">📍 ${esc(d.ubicacion)}</p>
        ${c ? htmlFicha(d) : `<div class="jg-silueta">${esc(d.icono)}</div><p class="jg-mute" style="text-align:center">Aún no la capturas. Ve a su memoparada y supera el reto.</p>`}
        <div class="jg-btns">${mapa && d.ll ? `<button class="btn pri" data-acc="ir" data-id="${d.id}">🚶 Ir a la memoparada</button>` : ''}
          <button class="btn ${mapa && d.ll ? '' : 'pri'}" data-acc="retar" data-id="${d.id}">🎯 ${c ? 'Practicar aquí' : 'Retar aquí'}</button></div></div></div>`;
    } else if (dex.ficha && caza.esClave(dex.ficha)) ficha = caza.htmlDexFicha(dex.ficha);
    el.dex.innerHTML = `<div class="jg-dex-in">${cab}${cuerpo}</div>${ficha}`;
    const tabOn = el.dex.querySelector('.jg-tabs .on'); if (tabOn) tabOn.parentElement.scrollLeft = Math.max(0, tabOn.offsetLeft - 24);
  }

  // ---------- clics ----------
  function alClic(ev) {
    const b = ev.target.closest('[data-acc]'); if (!b || !raiz.contains(b)) return;
    const a = b.dataset.acc;
    if (a === 'ficha-fondo' && ev.target !== b) return;
    // una acción tomada desde la hoja de controles la recoge, para ver el mapa
    if (el.dock?.contains(b) && !['dock', 'dock-asa', 'cebo', 'ruta-sig', 'paseo-borrar'].includes(a)) ponerDock('peek');
    switch (a) {
      case 'salir': dispatchEvent(new CustomEvent('memo:atras')); break;
      case 'menu': dispatchEvent(new CustomEvent('memo:menu')); break;
      case 'dock': case 'dock-asa': alternarDock(); break;
      case 'cerrar': cerrarHoja(); break;
      case 'aviso-x': el.aviso.hidden = true; break;
      case 'dex': abrirDex(); break;
      case 'dex-cerrar': cerrarDex(); break;
      case 'dex-tab': dex.tab = b.dataset.tab; pintarDex(); break;
      case 'dex-filtro': dex.sid = b.dataset.sid; pintarDex(); break;
      case 'dex-carta': if (!dex.abierto) abrirDex(b.dataset.id); else { dex.ficha = b.dataset.id; pintarDex(); } break;
      case 'ficha-cerrar': case 'ficha-fondo': dex.ficha = null; pintarDex(); break;
      case 'ir': cerrarDex(); irAParada(b.dataset.id); break;
      case 'retar': cerrarDex(); abrirParada(b.dataset.id); if (!reto) { reto = nuevoReto(POR_ID[b.dataset.id]); pintarHoja(); } break;
      case 'op': elegir(+b.dataset.i, b); break;
      case 'modo': if (reto) { if (b.dataset.modo === 'elegir' && !reto.fallos) reto.vioOpciones = true; reto.modo = b.dataset.modo; pintarHoja(); } break;
      case 'comprobar': comprobarEscrito(); break;
      case 'nose': if (reto) { reto.escrito = ''; fallo(null); } break;
      case 'autoeval': if (b.dataset.ok === '1') acierto(null); else fallo(null); break;
      case 'ver-resp': if (reto) { reto.verResp = true; pintarHoja(); } break;
      case 'practicar': { const d = POR_ID[hoja.id]; reto = nuevoReto(d); pintarHoja(); break; }
      case 'sig': { const d = siguiente(); if (d) irAParada(d.id); else toast('🏆 ¡Capturaste todas las memoparadas y no hay repasos pendientes!', 'oro'); break; }
      case 'centrar': if (mapa && avatar.ll) mapa.flyTo(avatar.ll, Math.max(16.5, mapa.getZoom()), { duration: sinMov() ? 0 : 0.5 }); break;
      case 'ubicar': ubicar(); break;
      case 'gym': abrirGym(b.dataset.sid); break;
      case 'acercar': { const l = LUG[b.dataset.sid]; if (l?.ll) mapa.flyTo(l.ll, 18, { duration: sinMov() ? 0 : 0.7 }); if (innerWidth < 900) cerrarHoja(); break; }
      case 'desafio': empezarDesafio(b.dataset.sid); break;
      case 'palacio': {
        const sid = b.dataset.sid; cerrarHoja(true);
        dispatchEvent(new CustomEvent('memo:vista', { detail: { vista: 'ciudad' } }));
        dispatchEvent(new CustomEvent('memo:palacio', { detail: { sid } }));
        break;
      }
      case 'd-op': responderDesafio(+b.dataset.i, b); break;
      case 'ejemplo': cargarEjemplo(b); break;
      default: caza.alClic(a, b); break;
    }
  }
  async function cargarEjemplo(b) {
    b.disabled = true; b.textContent = 'Cargando…';
    try {
      const r = await fetch('data/mapa.sample.json');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      MAPA = await r.json(); mapaEjemplo = true;
      el.aviso.hidden = true;
      await iniciarMapa();
    } catch (err) { avisar(`<b>No encontré el mapa de ejemplo.</b> ${esc(err.message)}`, true); }
  }

  return {
    async pintar() {
      if (!montado) montar();
      ajustarAlto();
      pintarHUD();
      if (!mapa) await iniciarMapa();
      else { mapa.invalidateSize(); refrescarTodo(); ponerTeselas(); caza.pintarApariciones(); }
      caza.pintarBarra();
      if (hoja && !reto && !desafio) pintarHoja();
      if (dex.abierto) pintarDex();
    },
  };
}
