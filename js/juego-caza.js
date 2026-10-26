// Zona de caza del modo juego: la ruta diaria (casa → UNA) con criaturas-de-conocimiento salvajes.
// · Apariciones que rotan cada 5 min (semilla por ventana de tiempo, se guardan para que recargar no las cambie).
// · Selección ponderada por repetición espaciada: vencidas > nuevas > aprendiendo > dominadas.
// · Rareza: ⚪ común = dato del atlas · 🔵 raro = sigla, escala o facies · 🟣 épico = caso clínico.
// · Encuentro a pantalla completa con carta holográfica, captura con el 🧠 y pista si falla.
// · Cada respuesta llama srs.calificar con el mismo id que usa el repaso de la app:
//   datos `${id}#i` / `${id}#n`, siglas `sig:${slug}#i`, facies `fac:${id}#i`, casos `caso:${id}`.
// · Misiones diarias (3, se renuevan a medianoche) y 🧲 cebo de estudio (15 min).
import * as E from './juego-estado.js';
import { esc, norm, resaltar, barajar, azar, pausa, sinMov, numeros, aLL, metros, desplazar, crearRuta, confetti, azarSemilla, ponderado } from './juego-util.js';

const VENTANA_MS = 5 * 60000;     // rotación de apariciones
const RADIO_AQUI = 40;            // m para "¡Está aquí!" (x2 XP)
const CEBO_MIN = 15;
const FRESCO_GPS = 3 * 60000;     // una posición real vale 3 min
export const RAREZA = {
  comun: { nombre: 'Común', ic: '⚪', xp: 30, color: '#94a3b8', prob: 0.62, probCebo: 0.5 },
  raro: { nombre: 'Raro', ic: '🔵', xp: 60, color: '#3b82f6', prob: 0.30, probCebo: 0.34 },
  epico: { nombre: 'Épico', ic: '🟣', xp: 120, color: '#a855f7', prob: 0.08, probCebo: 0.16 },
};
const CLASE = { dato: 'Dato', escala: 'Escala', sigla: 'Sigla', facies: 'Facies', caso: 'Caso clínico' };
const PESO = { vencida: 8, nueva: 3, aprendiendo: 1.2, dominada: 0.5 };
const PESO_CEBO = { vencida: 30, nueva: 3, aprendiendo: 1, dominada: 0.3 };
const ICONO_HITO = { parque: '🌳', plaza: '⛲', iglesia: '⛪', mercado: '🛒', colegio: '🏫', escuela: '🏫', universidad: '🎓', hospital: '🏥', salud: '🏥', tienda: '🏪', ovalo: '🔄', óvalo: '🔄', mirador: '🔭', estadio: '🏟️', puente: '🌉', paradero: '🚏', grifo: '⛽' };
const ETQ_SRS = { vencida: '⏰ Vencida', nueva: '✨ Nueva', aprendiendo: '📈 Aprendiendo', dominada: '💎 Dominada' };
const corto = (n) => { const p = String(n).split(/\s*→\s*/); return p.length > 2 ? `por ${p[1]}` : String(n).replace(/^Ruta\s*\w+\s*[·:-]?\s*/i, ''); };
const mmss =(ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

/**
 * @param ctx { RUTA, CASOS, SIGLAS, FACIES, ATLAS, DATOS, POR_ID, LUGARES, S, h }
 *   h = ayudas de juego.js: mapa(), L(), toast(), caminar(dest), elegirPregunta(d), htmlPista(d), htmlFicha(d, img),
 *       revisarLogros(), pintarHUD(), refrescarMarca(d), abrirDex(tab, ficha), pintarDex(), dexAbierto(),
 *       moverAvatar(ll), abrirHoja(estado), hoja(), pintarHoja(), oscuro(), esperarAnim(ms)
 */
export function crearCaza({ RUTA = null, CASOS = null, SIGLAS = null, FACIES = null, ATLAS = {}, DATOS = [], POR_ID = {}, LUGARES = [], S, h }) {
  // ---------- ruta diaria ----------
  const RUTAS = (RUTA?.rutas || []).map((r, i) => {
    const pts = (r.pts || []).map(aLL).filter(Boolean);
    return pts.length >= 2 ? { id: String(r.id ?? String.fromCharCode(65 + i)), nombre: r.nombre || `Ruta ${String.fromCharCode(65 + i)}`, calles: r.calles || [], km: r.km, pts, geo: crearRuta(pts) } : null;
  }).filter(Boolean);
  const INICIO = aLL(RUTA?.inicio) ? { ll: aLL(RUTA.inicio), nombre: RUTA.inicio.nombre || 'Casa' } : (RUTAS[0] ? { ll: RUTAS[0].pts[0], nombre: 'Casa' } : null);
  const FIN = aLL(RUTA?.fin) ? { ll: aLL(RUTA.fin), nombre: RUTA.fin.nombre || 'UNA' } : (RUTAS[0] ? { ll: RUTAS[0].pts.at(-1), nombre: 'UNA' } : null);
  const HITOS = (RUTA?.hitos || []).map((x) => ({ ...x, ll: aLL(x) })).filter((x) => x.ll);
  const SPAWNS = (RUTA?.spawns || []).map(aLL).filter(Boolean);
  const activo = RUTAS.length > 0 || SPAWNS.length > 0;

  // ---------- catálogo de criaturas ----------
  const CRI = {};
  const POR_CLASE = { dato: [], sigla: [], facies: [], caso: [] };
  const agregar = (c) => { CRI[c.k] = c; POR_CLASE[c.clase === 'escala' ? 'dato' : c.clase].push(c); };
  DATOS.forEach((d) => agregar({
    k: `d:${d.id}`, clase: d.tipo === 'escala' ? 'escala' : 'dato', rareza: d.tipo === 'escala' ? 'raro' : 'comun', id: d.id, capId: d.id,
    nombre: d.nombre, corto: d.nombre, icono: d.icono, color: d.color, imagen: d.m?.imagen || '', d, sid: d.sid, grupo: d.lug?.titulo || '',
    cards: [...new Set(d.preguntas.map((p) => p.card))],
  }));
  Object.entries(SIGLAS || {}).forEach(([slug, s]) => {
    const ps = (s?.preguntas || []).filter((p) => p?.q && p?.a);
    if (!s?.sigla || !ps.length) return;
    agregar({ k: `s:${slug}`, clase: 'sigla', rareza: 'raro', id: slug, capId: `sig:${slug}`, nombre: s.sigla, corto: s.sigla, icono: '🔤', color: '#2563eb', s, grupo: s.grupo || '',
      preguntas: ps.map((p, i) => ({ q: p.q, a: p.a, tipo: p.tipo || '', card: `sig:${slug}#${(s.preguntas || []).indexOf(p) >= 0 ? s.preguntas.indexOf(p) : i}` })) });
  });
  const facAtlas = Object.fromEntries((ATLAS.facies || []).map((f) => [f.id, f]));
  Object.entries(FACIES || {}).forEach(([id, fm]) => {
    const ps = (fm?.preguntas || []).filter((p) => p?.q && p?.a);
    if (!ps.length) return;
    const fa = facAtlas[id] || {};
    agregar({ k: `f:${id}`, clase: 'facies', rareza: 'raro', id, capId: `fac:${id}`, nombre: `Facies ${fa.nombre || id}`, corto: fa.nombre || id, icono: '🙂', color: '#0891b2', fm, fa, imagen: fa.imagen || '', grupo: 'Facies',
      preguntas: ps.map((p) => ({ q: p.q, a: p.a, tipo: p.tipo || '', card: `fac:${id}#${fm.preguntas.indexOf(p)}` })) });
  });
  Object.entries(CASOS || {}).forEach(([id, c]) => {
    if (id.startsWith('_') || !c || !Array.isArray(c.opciones) || c.opciones.length < 2) return;
    const correcta = typeof c.correcta === 'number' ? c.opciones[c.correcta]
      : /^[A-Da-d]$/.test(String(c.correcta)) ? c.opciones['ABCD'.indexOf(String(c.correcta).toUpperCase())] : c.correcta;
    if (!correcta) return;
    agregar({ k: `c:${id}`, clase: 'caso', rareza: RAREZA[c.rareza] ? c.rareza : 'epico', id, capId: `caso:${id}`, nombre: c.titulo || 'Caso clínico', corto: '', icono: '🩺', color: '#9333ea', caso: c, correcta, grupo: c.nivel == null || c.nivel === '' ? '' : typeof c.nivel === 'number' ? `Nivel ${c.nivel}` : String(c.nivel),
      cards: [`caso:${id}`] });
  });
  Object.values(CRI).forEach((c) => { if (!c.cards) c.cards = c.preguntas.map((p) => p.card); });
  const nCasos = POR_CLASE.caso.length;

  // ---------- repetición espaciada ----------
  const srsNivel = (card) => (S.nivel ? S.nivel(card) : S.info(card) ? 'aprendiendo' : 'nueva');
  function estadoSRS(c) {
    if (c.cards.some((x) => S.info(x) && S.vence(x))) return 'vencida';
    if (c.cards.every((x) => !S.info(x))) return 'nueva';
    if (c.cards.every((x) => srsNivel(x) === 'dominada')) return 'dominada';
    return 'aprendiendo';
  }
  /** Califica en el srs y avisa a las misiones si la tarjeta estaba vencida. Úsala para TODA respuesta del juego. */
  function calificar(card, nota) {
    const vencida = !!(S.info(card) && S.vence(card));
    const r = S.calificar(card, nota);
    if (vencida) E.avanzarMisiones((m) => m.tipo === 'repaso');
    return r;
  }

  // ---------- apariciones ----------
  let rutaSel = RUTAS.find((r) => r.id === E.rutaElegida()) || RUTAS[0] || null;
  const ventana = (t = Date.now()) => Math.floor(t / VENTANA_MS);
  const claveDe = (v = ventana()) => `${v}|${rutaSel?.id || '-'}`;
  function puntosBase() {
    let pts = SPAWNS;
    if (rutaSel && pts.length) { const cerca = pts.filter((p) => rutaSel.geo.proyectar(p).d < 150); if (cerca.length >= 8) pts = cerca; }
    if (!pts.length && rutaSel) { const g = rutaSel.geo; const n = Math.max(8, Math.floor(g.largo / 120)); pts = Array.from({ length: n }, (_, i) => g.punto(((i + 0.5) * g.largo) / n)); }
    return pts;
  }
  function generar(v, { cebo = false, extra = false, excluir = new Set(), n = null } = {}) {
    const rnd = azarSemilla(`${v}|${rutaSel?.id || '-'}|${extra ? 'cebo' : 'base'}`);
    const pts = barajar(puntosBase(), rnd);
    if (!pts.length) return [];
    const cuantos = n ?? 12 + Math.floor(rnd() * 9);           // 12-20
    const peso = cebo ? PESO_CEBO : PESO;
    const usados = new Set(excluir);
    const pools = {
      comun: Object.values(CRI).filter((c) => c.rareza === 'comun'),
      raro: Object.values(CRI).filter((c) => c.rareza === 'raro'),
      epico: Object.values(CRI).filter((c) => c.rareza === 'epico'),
    };
    const est = new Map(Object.values(CRI).map((c) => [c.k, estadoSRS(c)]));
    const lista = [];
    for (let i = 0; i < cuantos; i++) {
      let r = rnd(); const pr = (x) => (cebo ? RAREZA[x].probCebo : RAREZA[x].prob);
      let rar = r < pr('epico') ? 'epico' : r < pr('epico') + pr('raro') ? 'raro' : 'comun';
      if (i === cuantos - 1 && !extra && pools.epico.length && !lista.some((x) => x.r === 'epico')) rar = 'epico';   // 1 épico garantizado por rotación
      const orden = [rar, 'raro', 'comun', 'epico'];
      let c = null;
      for (const rr of orden) { const pool = pools[rr].filter((x) => !usados.has(x.k)); if (pool.length) { c = ponderado(pool, (x) => peso[est.get(x.k)], rnd); break; } }
      if (!c) break;
      usados.add(c.k);
      let ll = pts[i % pts.length];
      if (extra || i >= pts.length) ll = desplazar(ll, 18 + rnd() * 30, rnd() * Math.PI * 2);
      lista.push({ k: c.k, ll: [+ll[0].toFixed(6), +ll[1].toFixed(6)], r: c.rareza });
    }
    return lista;
  }
  function asegurar() {
    const v = ventana(), clave = claveDe(v), cebo = E.ceboRestante() > 0;
    let a = E.apariciones(clave);
    if (!a) { E.guardarApariciones(clave, generar(v, { cebo }), false); a = E.apariciones(clave); }
    if (cebo && !a.extra) {
      const extra = generar(v, { cebo: true, extra: true, excluir: new Set(a.lista.map((x) => x.k)), n: Math.max(12, a.lista.length) });
      E.guardarApariciones(clave, [...a.lista, ...extra], true); a = E.apariciones(clave);
    }
    return { clave, lista: a.lista.filter((x) => CRI[x.k]), cazadas: a.cazadas };
  }

  // ---------- ubicación real ----------
  let posReal = null, vigia = null;
  const avisadas = new Set();
  const aqui = (ll) => !!(posReal && ll && Date.now() - posReal.t < FRESCO_GPS && metros(posReal.ll, ll) < RADIO_AQUI);
  function alUbicar(ll) {
    posReal = { ll, t: Date.now() };
    pintarApariciones();
    revisarCercanas();
    if (vigia == null && 'geolocation' in navigator) {
      vigia = navigator.geolocation.watchPosition((pos) => {
        posReal = { ll: [pos.coords.latitude, pos.coords.longitude], t: Date.now() };
        h.moverAvatar(posReal.ll);
        pintarApariciones(); revisarCercanas();
      }, () => {}, { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 });
    }
  }
  function revisarCercanas() {
    const { lista, cazadas } = asegurar();
    const cerca = lista.find((x) => !cazadas.has(x.k) && aqui(x.ll));
    if (cerca && !avisadas.has(cerca.k + claveDe())) {
      avisadas.add(cerca.k + claveDe());
      const c = CRI[cerca.k];
      h.toast(`📍 <b>¡Está aquí!</b> ${RAREZA[c.rareza].ic} ${esc(nombreVisible(c))} a menos de ${RADIO_AQUI} m · x2 XP`, 'oro');
    }
  }

  // ---------- mapa: rutas, hitos, inicio/fin, apariciones ----------
  const capas = { rutas: {}, marcas: {}, fijas: [] };
  let dibujado = false;
  function dibujar() {
    const mapa = h.mapa(), L = h.L();
    if (!mapa || !L || !activo || dibujado) return;
    dibujado = true;
    mapa.createPane('jgRutaDiaria'); mapa.getPane('jgRutaDiaria').style.zIndex = 390;
    for (const r of RUTAS) {
      const glow = L.polyline(r.pts, { pane: 'jgRutaDiaria', className: 'jg-dr-glow', weight: 16, opacity: 1, lineCap: 'round', lineJoin: 'round' });
      const linea = L.polyline(r.pts, { pane: 'jgRutaDiaria', className: 'jg-dr', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false });
      const brillo = L.polyline(r.pts, { pane: 'jgRutaDiaria', className: 'jg-dr-brillo', weight: 3, opacity: 1, dashArray: '2 22', lineCap: 'round', interactive: false });
      glow.on('click', () => elegirRuta(r.id));
      glow.bindTooltip(`${esc(r.nombre)}${r.km ? ` · ${(+r.km).toFixed(1)} km` : ''}${r.calles.length ? `<br><small>${esc(r.calles.join(' → '))}</small>` : ''}`, { sticky: true, className: 'jg-tip' });
      [glow, linea, brillo].forEach((x) => x.addTo(mapa));
      capas.rutas[r.id] = [glow, linea, brillo];
    }
    estilarRutas();
    const pin = (ll, ic, nombre, cls) => L.marker(ll, { icon: L.divIcon({ className: 'jg-pin-w', iconSize: [44, 44], iconAnchor: [22, 40], html: `<div class="jg-pin ${cls}"><span>${ic}</span><b>${esc(nombre.replace(/\s*\(.*\)\s*/, '').split(',')[0])}</b></div>` }), title: nombre, alt: nombre, keyboard: false, zIndexOffset: 900 }).addTo(mapa);
    if (INICIO) capas.fijas.push(pin(INICIO.ll, '🏠', INICIO.nombre, 'casa'));
    if (FIN) capas.fijas.push(pin(FIN.ll, '🎓', FIN.nombre, 'una'));
    for (const x of HITOS) {
      const ic = ICONO_HITO[norm(x.tipo)] || '📌';
      capas.fijas.push(L.marker(x.ll, { icon: L.divIcon({ className: 'jg-hito-w', iconSize: [18, 18], iconAnchor: [9, 9], html: `<div class="jg-hito"><span>${ic}</span><b>${esc(x.nombre)}</b></div>` }), interactive: false, keyboard: false, zIndexOffset: -200 }).addTo(mapa));
    }
    pintarApariciones();
    arrancarReloj();
  }
  function estilarRutas() {
    for (const [id, capasR] of Object.entries(capas.rutas)) {
      const on = rutaSel?.id === id;
      capasR.forEach((x) => { const p = x.getElement?.(); p?.classList.toggle('on', on); p?.classList.toggle('off', !on); });
      if (on) capasR.forEach((x) => x.bringToFront());
    }
  }
  function elegirRuta(id) {
    const r = RUTAS.find((x) => x.id === id); if (!r || r === rutaSel) return;
    rutaSel = r; E.elegirRuta(id);
    estilarRutas(); pintarApariciones(); pintarBarra();
    const mapa = h.mapa();
    if (mapa) mapa.flyToBounds(h.L().latLngBounds(r.pts), { padding: [60, 60], maxZoom: 16.5, duration: sinMov() ? 0 : 0.7 });
    h.toast(`🛣️ <b>${esc(r.nombre)}</b>: nuevas criaturas en este camino.`);
  }
  function arte(c, conImg = true) {
    if (conImg && c.imagen) return `<img src="${esc(c.imagen)}" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode('${esc(c.icono)}'))">`;
    if (c.clase === 'sigla') return `<b class="jg-sig" style="--n:${Math.max(2, c.nombre.length)}">${esc(c.nombre)}</b>`;
    return `<span>${esc(c.icono)}</span>`;
  }
  function iconoSpawn(it, i) {
    const c = CRI[it.k]; const est = estadoSRS(c); const ok = aqui(it.ll);
    return h.L().divIcon({
      className: 'jg-sp-w', iconSize: [46, 46], iconAnchor: [23, 23],
      html: `<div class="jg-sp r-${c.rareza} ${est} ${ok ? 'aqui' : ''}" style="--d:${((i * 0.37) % 2).toFixed(2)}s;--c:${esc(c.color)}">
        <div class="jg-sp-aura"></div><div class="jg-sp-cuerpo">${c.clase === 'sigla' ? '<span>🔤</span>' : arte(c, c.clase === 'facies')}</div>
        ${est === 'vencida' ? '<b class="jg-sp-rel" aria-hidden="true">⏰</b>' : ''}${ok ? '<span class="jg-sp-aqui">¡Está aquí!</span>' : ''}</div>`,
    });
  }
  function pintarApariciones() {
    const mapa = h.mapa(), L = h.L();
    if (!mapa || !L || !activo) return;
    const { lista, cazadas } = asegurar();
    const vivas = new Set();
    lista.forEach((it, i) => {
      if (cazadas.has(it.k)) return;
      vivas.add(it.k);
      const c = CRI[it.k];
      const etq = `${RAREZA[c.rareza].nombre}: ${nombreVisible(c)}`;
      if (capas.marcas[it.k]) { capas.marcas[it.k].setLatLng(it.ll).setIcon(iconoSpawn(it, i)); return; }
      capas.marcas[it.k] = L.marker(it.ll, { icon: iconoSpawn(it, i), keyboard: true, title: etq, alt: `Criatura salvaje ${etq}`, zIndexOffset: c.rareza === 'epico' ? 1200 : c.rareza === 'raro' ? 1000 : 800, riseOnHover: true })
        .on('click', () => irASpawn(it.k)).addTo(mapa);
    });
    for (const k of Object.keys(capas.marcas)) if (!vivas.has(k)) { capas.marcas[k].remove(); delete capas.marcas[k]; }
  }
  function quitarMarca(k) {
    const m = capas.marcas[k]; if (!m) return;
    delete capas.marcas[k];
    m.getElement()?.querySelector('.jg-sp')?.classList.add('atrapada');
    setTimeout(() => m.remove(), sinMov() ? 0 : 650);
  }

  // ---------- reloj: rotación, cebo, día y franja horaria ----------
  let reloj = null, vVista = ventana(), diaVisto = E.hoy(), ceboVisto = E.ceboRestante() > 0;
  function arrancarReloj() {
    if (reloj) return;
    reloj = setInterval(tick, 1000);
  }
  function tick() {
    const v = ventana();
    if (v !== vVista) {
      vVista = v; avisadas.clear();
      pintarApariciones();
      if (h.mapa() && !document.hidden) h.toast('🌀 <b>Nuevas criaturas</b> aparecieron en tu ruta.');
    }
    const cebo = E.ceboRestante() > 0;
    if (cebo !== ceboVisto) { ceboVisto = cebo; if (!cebo) h.toast('🧲 El cebo se terminó. Las criaturas extra se quedan hasta la próxima rotación.'); }
    if (E.hoy() !== diaVisto) { diaVisto = E.hoy(); misiones(); h.toast('📜 <b>Nuevas misiones diarias</b> disponibles.', 'oro'); if (h.hoja()?.tipo === 'misiones') h.pintarHoja(); }
    pintarBarra(true);
  }

  // ---------- HUD de caza ----------
  let barra = null;
  function montarBarra(nodo) { barra = nodo; pintarBarra(); }
  function pintarBarra(soloTiempo = false) {
    if (!barra) return;
    if (!activo) { barra.hidden = true; return; }
    barra.hidden = false;
    const resta = (ventana() + 1) * VENTANA_MS - Date.now();
    const cebo = E.ceboRestante();
    const ms = misiones(); const hechas = ms.filter((m) => m.hecha).length;
    if (soloTiempo && barra.firstElementChild) {
      const t = barra.querySelector('.jg-rot b'); if (t) t.textContent = mmss(resta);
      const cb = barra.querySelector('.jg-cebo');
      if (cb) { cb.classList.toggle('on', cebo > 0); cb.querySelector('span').textContent = cebo > 0 ? mmss(cebo) : 'Cebo'; cb.setAttribute('aria-label', cebo > 0 ? `Cebo activo, quedan ${mmss(cebo)}` : 'Activar cebo de estudio 15 minutos'); }
      const mb = barra.querySelector('.jg-mis b'); if (mb) mb.textContent = `${hechas}/${ms.length}`;
      return;
    }
    barra.innerHTML = `${RUTAS.length > 1 ? `<div class="jg-rutas" role="radiogroup" aria-label="Ruta diaria">${RUTAS.map((r) =>
      `<button role="radio" aria-checked="${rutaSel === r}" class="${rutaSel === r ? 'on' : ''}" data-acc="ruta" data-ruta="${esc(r.id)}" title="${esc(r.nombre)}">${esc(r.id)}<span> ${esc(corto(r.nombre))}</span></button>`).join('')}</div>` : ''}
      <span class="jg-rot" role="timer" aria-label="Próxima rotación de criaturas" title="Próxima rotación de criaturas">🌀 <b>${mmss(resta)}</b></span>
      <button class="jg-cebo ${cebo > 0 ? 'on' : ''}" data-acc="cebo" aria-label="${cebo > 0 ? `Cebo activo, quedan ${mmss(cebo)}` : 'Activar cebo de estudio 15 minutos'}">🧲 <span>${cebo > 0 ? mmss(cebo) : 'Cebo'}</span></button>
      <button class="jg-mis" data-acc="misiones" aria-label="Misiones diarias">📜 <b>${hechas}/${ms.length}</b></button>`;
  }
  function activarCebo() {
    if (E.ceboRestante() > 0) { h.toast(`🧲 El cebo ya está activo: quedan ${mmss(E.ceboRestante())}.`); return; }
    E.activarCebo(CEBO_MIN);
    ceboVisto = true;
    pintarApariciones(); pintarBarra();
    h.toast(`🧲 <b>¡Cebo de estudio activo ${CEBO_MIN} min!</b> El doble de criaturas y las vencidas salen primero.`, 'oro');
  }

  // ---------- misiones diarias ----------
  function crearMisiones(dia) {
    const rnd = azarSemilla(`misiones|${dia}`);
    const out = [];
    const secs = LUGARES.filter((l) => l.datos.length >= 3);
    if (secs.length) {
      const l = azar(secs, rnd); const n = Math.min(5, l.datos.length);
      out.push({ id: `sec-${l.sid}`, tipo: 'captura', filtro: { sid: l.sid }, meta: n, xp: 120, ic: l.icono, txt: `Captura ${n} de ${l.titulo}` });
    }
    const segunda = [];
    if (nCasos) segunda.push({ id: 'casos', tipo: 'captura', filtro: { clase: 'caso' }, meta: Math.min(2, nCasos), xp: 200, ic: '🩺', txt: `Resuelve ${Math.min(2, nCasos)} casos clínicos` });
    if (POR_CLASE.sigla.length) segunda.push({ id: 'siglas', tipo: 'captura', filtro: { clase: 'sigla' }, meta: 4, xp: 100, ic: '🔤', txt: 'Captura 4 siglas' });
    if (POR_CLASE.facies.length) segunda.push({ id: 'facies', tipo: 'captura', filtro: { clase: 'facies' }, meta: 3, xp: 110, ic: '🙂', txt: 'Identifica 3 facies' });
    segunda.push({ id: 'raros', tipo: 'captura', filtro: { rareza: 'raro' }, meta: 3, xp: 120, ic: '🔵', txt: 'Atrapa 3 criaturas raras' });
    out.push(nCasos && rnd() < 0.6 ? segunda[0] : azar(segunda, rnd));
    const venc = Object.values(CRI).reduce((a, c) => a + c.cards.filter((x) => S.info(x) && S.vence(x)).length, 0);
    const tercera = [
      { id: 'perfecto', tipo: 'captura', filtro: { sinFallo: true }, meta: 5, xp: 120, ic: '🎯', txt: 'Captura 5 al primer intento' },
      { id: 'xp', tipo: 'xp', meta: 300, xp: 100, ic: '⭐', txt: 'Gana 300 XP' },
      { id: 'gym', tipo: 'gimnasio', meta: 1, xp: 150, ic: '⚔️', txt: 'Gana un desafío de gimnasio' },
    ];
    if (venc >= 3) { const n = Math.min(10, venc); out.push({ id: 'vencidas', tipo: 'repaso', meta: n, xp: 150, ic: '⏰', txt: `Repasa ${n} vencidas` }); }
    else out.push(azar(tercera, rnd));
    return out.filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i);
  }
  const misiones = () => E.misionesHoy(crearMisiones);
  function htmlMisiones() {
    const ms = misiones();
    const fin = new Date(); fin.setHours(24, 0, 0, 0);
    const resta = fin - Date.now();
    const hh = Math.floor(resta / 3600000), mm = Math.floor((resta % 3600000) / 60000);
    const cebo = E.ceboRestante();
    return `<div class="jg-h-cab"><span class="jg-chip-lugar" style="--c:#d97706">📜 Misiones de hoy</span><span class="jg-badge">${ms.filter((m) => m.hecha).length}/${ms.length}</span></div>
      <p class="jg-mute">Se renuevan a medianoche · faltan ${hh} h ${mm} min</p>
      <div class="jg-misiones">${ms.map((m, i) => `<div class="jg-mision ${m.hecha ? 'hecha' : ''}" style="--i:${i * 70}ms">
        <span class="ic" aria-hidden="true">${esc(m.ic)}</span>
        <div class="tx"><b>${esc(m.txt)}</b><div class="jg-mb" role="progressbar" aria-valuemin="0" aria-valuemax="${m.meta}" aria-valuenow="${m.prog}" aria-label="${esc(m.txt)}"><i style="width:${(100 * m.prog / m.meta).toFixed(1)}%"></i></div>
        <small>${m.prog}/${m.meta} · recompensa +${m.xp} XP</small></div><span class="ok" aria-label="${m.hecha ? 'completada' : 'pendiente'}">${m.hecha ? '✅' : '⬜'}</span></div>`).join('')}</div>
      <div class="jg-cebo-box ${cebo > 0 ? 'on' : ''}"><div><b>🧲 Cebo de estudio</b><small>${cebo > 0 ? `Activo: quedan ${mmss(cebo)}.` : `Durante ${CEBO_MIN} min duplica las apariciones y prioriza tus tarjetas vencidas.`}</small></div>
        ${cebo > 0 ? '' : '<button class="btn pri" data-acc="cebo">Activar</button>'}</div>
      ${activo ? '' : '<p class="jg-mute">Sin ruta diaria cargada: las misiones avanzan con las memoparadas, gimnasios y retos del Memodex.</p>'}`;
  }
  /** Eventos del juego que avanzan misiones: ('captura', {clase, sid, rareza, sinFallo}) · ('gimnasio') */
  function evento(tipo, info = {}) {
    if (tipo === 'captura') {
      E.avanzarMisiones((m) => m.tipo === 'captura' && Object.entries(m.filtro || {}).every(([k, v]) => (k === 'clase' && v === 'dato' ? ['dato', 'escala'].includes(info.clase) : info[k] === v)));
    } else if (tipo === 'gimnasio') E.avanzarMisiones((m) => m.tipo === 'gimnasio');
    pintarBarra();
  }
  E.suscribir((tipo, datos) => {
    if (tipo === 'xp' && datos.ganado && !String(datos.motivo || '').startsWith('misión')) {
      misiones(); E.avanzarMisiones((m) => m.tipo === 'xp', datos.ganado);
    } else if (tipo === 'mision') {
      E.contar('misiones');
      h.toast(`<span class="jg-t-ic">${esc(datos.ic)}</span><span><small>Misión cumplida</small><b>${esc(datos.txt)}</b> +${datos.xp} XP</span>`, 'logro');
      setTimeout(() => { E.sumarXP(datos.xp, `misión: ${datos.txt}`); h.revisarLogros(); }, 0);
      pintarBarra();
      if (h.hoja()?.tipo === 'misiones') h.pintarHoja();
    }
  });

  // ---------- encuentro ----------
  let enc = null, ocupado = false;
  function nombreVisible(c, p = null) {
    if (c.clase === 'caso') return c.nombre;
    if (p && c.corto && norm(p.a).includes(norm(c.corto))) return c.clase === 'sigla' ? 'Sigla misteriosa' : c.clase === 'facies' ? 'Facies misteriosa' : 'Dato misterioso';
    return c.nombre;
  }
  function opcionesDe(c, p) {
    const vistos = new Set([norm(p.a)]); const otras = [];
    const tomar = (lista) => { for (const t of barajar(lista)) { if (otras.length >= 3) return; const k = norm(t); if (!t || vistos.has(k)) continue; vistos.add(k); otras.push(t); } };
    const herm = POR_CLASE[c.clase].filter((x) => x !== c);
    const resp = (lista, f = () => true) => lista.flatMap((x) => x.preguntas.filter(f).map((q) => q.a));
    tomar(resp(herm.filter((x) => x.grupo === c.grupo), (q) => q.tipo === p.tipo));
    tomar(resp(herm, (q) => q.tipo === p.tipo));
    tomar(resp(herm));
    return barajar([p.a, ...otras]);
  }
  function preguntaPara(c) {
    if (c.d) return h.elegirPregunta(c.d);
    if (c.clase === 'caso') return { q: c.caso.pregunta || '¿Cuál es el diagnóstico más probable?', a: c.correcta, card: c.cards[0], tipo: 'caso', opciones: barajar(c.caso.opciones) };
    const ps = c.preguntas;
    const venc = ps.filter((p) => S.info(p.card) && S.vence(p.card));
    const nuevas = ps.filter((p) => !S.info(p.card));
    const p = azar(venc.length ? venc : nuevas.length ? nuevas : ps);
    return { ...p, opciones: opcionesDe(c, p) };
  }
  async function irASpawn(k) {
    if (ocupado || enc) return;
    const { lista } = asegurar(); const it = lista.find((x) => x.k === k); if (!it) return;
    ocupado = true;
    try { await h.caminar({ ll: it.ll, ruta: rutaSel?.geo || null }); } finally { ocupado = false; }
    encontrar(k, { spawn: it });
  }
  /** Abre el encuentro con la criatura `k` (d:…, s:…, f:…, c:…). opts.spawn = aparición del mapa (si no, es práctica desde el Memodex). */
  function encontrar(k, { spawn = null } = {}) {
    const c = CRI[k]; if (!c || enc) return;
    const p = preguntaPara(c); if (!p) { h.toast('Esta carta aún no tiene preguntas.', 'aviso'); return; }
    enc = { c, p, spawn, clave: claveDe(), modo: c.clase === 'caso' || !p.opciones || p.opciones.length < 2 ? 'elegir' : 'elegir', fallos: 0, malas: new Set(), fase: 'preg', escrito: '',
      eraVencida: !!(S.info(p.card) && S.vence(p.card)), eraCapturada: E.capturado(c.capId), estado: estadoSRS(c), x2: !!(spawn && aqui(spawn.ll)), foco: document.activeElement };
    montarEncuentro();
  }
  let capa = null, quitarTilt = null;
  function montarEncuentro() {
    const { c, p } = enc; const R = RAREZA[c.rareza];
    capa = document.createElement('div');
    capa.className = `jg-enc r-${c.rareza} ${h.oscuro() ? 'oscuro' : ''}`;
    capa.setAttribute('role', 'dialog'); capa.setAttribute('aria-modal', 'true');
    capa.setAttribute('aria-label', `Encuentro con ${R.nombre.toLowerCase()}: ${nombreVisible(c, p)}`);
    capa.style.setProperty('--c', c.color); capa.style.setProperty('--rc', R.color);
    capa.innerHTML = `<div class="jg-enc-fondo" aria-hidden="true">${'<i></i>'.repeat(14)}</div>
      <div class="jg-enc-in">
        <div class="jg-enc-top">
          <span class="jg-rar r-${c.rareza}">${R.ic} ${R.nombre} · ${CLASE[c.clase]}</span>
          <span class="jg-badge ${enc.estado}">${ETQ_SRS[enc.estado]}</span>
          ${enc.x2 ? '<span class="jg-badge x2">📍 ¡Está aquí! x2</span>' : ''}
          <button class="jg-enc-huir" data-e="huir" aria-label="Huir del encuentro">🏃 Huir</button>
        </div>
        <div class="jg-holo-w"><div class="jg-holo r-${c.rareza} ${c.imagen ? 'con-img' : ''}" tabindex="-1">
          <div class="jg-holo-arte">${nombreVisible(c, p) !== c.nombre && c.clase !== 'facies' ? '<span>❓</span>' : arte(c)}</div>
          <div class="jg-holo-nom"><b>${esc(nombreVisible(c, p))}</b><small>${esc(c.grupo || CLASE[c.clase])}${c.d ? ` · #${String(c.d.num).padStart(3, '0')}` : ''}</small></div>
          <i class="jg-holo-brillo" aria-hidden="true"></i><i class="jg-holo-reflejo" aria-hidden="true"></i><span class="jg-holo-rar" aria-hidden="true">${R.ic}</span>
        </div></div>
        <div class="jg-enc-panel" aria-live="polite"></div>
      </div>`;
    document.body.appendChild(capa);
    document.documentElement.classList.add('jg-enc-abierto');
    capa.addEventListener('click', alClicEnc);
    capa.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cerrarEncuentro(); }
      if (e.key === 'Enter' && e.target.matches('textarea') && !e.shiftKey) { e.preventDefault(); comprobarEscrito(); }
      if (e.key === 'Tab') atraparFoco(e);
    });
    quitarTilt = activarTilt(capa.querySelector('.jg-holo'));
    requestAnimationFrame(() => capa?.classList.add('on'));
    pintarPanel();
  }
  function atraparFoco(e) {
    const f = [...capa.querySelectorAll('button:not(:disabled), textarea, [tabindex="0"]')];
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
  }
  function activarTilt(carta) {
    if (!carta || sinMov()) return () => {};
    const poner = (x, y) => {   // x, y en 0..1
      carta.style.setProperty('--rx', `${((0.5 - y) * 18).toFixed(2)}deg`);
      carta.style.setProperty('--ry', `${((x - 0.5) * 22).toFixed(2)}deg`);
      carta.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      carta.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      carta.style.setProperty('--ang', `${(x * 180 + y * 90).toFixed(0)}deg`);
    };
    const mover = (e) => {
      const r = carta.getBoundingClientRect();
      poner(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)));
    };
    const reposo = () => poner(0.5, 0.5);
    const orientar = (e) => { if (e.gamma == null) return; poner(Math.max(0, Math.min(1, 0.5 + e.gamma / 60)), Math.max(0, Math.min(1, 0.5 + (e.beta - 40) / 60))); };
    capa.addEventListener('pointermove', mover);
    carta.addEventListener('pointerleave', reposo);
    addEventListener('deviceorientation', orientar);
    reposo();
    return () => { removeEventListener('deviceorientation', orientar); };
  }
  function cerrarEncuentro() {
    if (!capa) return;
    const vieja = capa, foco = enc?.foco;
    quitarTilt?.(); quitarTilt = null;
    capa = null; enc = null;
    vieja.classList.remove('on'); vieja.classList.add('fuera');
    document.documentElement.classList.remove('jg-enc-abierto');
    setTimeout(() => vieja.remove(), sinMov() ? 0 : 320);
    if (h.dexAbierto()) h.pintarDex();
    try { foco?.focus?.(); } catch { /* el elemento ya no existe */ }
  }
  const multXP = (f) => (f === 0 ? 1 : f === 1 ? 0.5 : 0.3);
  function pistaHTML() {
    const { c } = enc;
    if (c.d) return h.htmlPista(c.d);
    if (c.clase === 'caso') {
      const k = c.caso;
      return `<div class="jg-pista"><p class="jg-pt">💡 Pista del caso</p>${k.pista ? `<p>${resaltar(k.pista)}</p>` : ''}
        ${enc.fallos >= 2 && k.explicacion ? `<p class="ancla">📖 ${resaltar(k.explicacion)}</p>` : enc.fallos < 2 && k.explicacion ? '<p class="jg-mute">Si fallas otra vez verás la explicación completa.</p>' : ''}</div>`;
    }
    const m = c.s || c.fm || {};
    return `<div class="jg-pista"><p class="jg-pt">💡 Pista de tu palacio</p>
      ${m.ancla ? `<p class="ancla">⚓ ${esc(m.ancla)}</p>` : ''}
      ${c.s?.sustituta ? `<p>🔁 Palabra sustituta: <b>${esc(c.s.sustituta)}</b></p>` : ''}
      ${c.fm?.rasgo_clave || c.fa?.rasgo ? `<p>👁️ Rasgo clave: ${esc(c.fm?.rasgo_clave || c.fa.rasgo)}</p>` : ''}
      ${m.escena ? `<p class="jg-esc-txt">🎬 ${esc(m.escena)}</p>` : ''}</div>`;
  }
  function detalleHTML(c) {
    if (c.d) return h.htmlFicha(c.d, false);
    if (c.clase === 'sigla') {
      const s = c.s;
      return `<div class="jg-ficha"><p class="jg-valor"><span>🔤 ${esc(s.sigla)} significa</span>${esc(s.significado || '')}</p>
        ${s.ancla ? `<p class="ancla">⚓ ${esc(s.ancla)}</p>` : ''}${s.escena ? `<p class="jg-esc-txt">🎬 ${esc(s.escena)}</p>` : ''}
        ${(s.confusiones || []).length ? `<p class="jg-pt">⚠️ No confundir</p><ul class="jg-conf">${s.confusiones.slice(0, 4).map((x) => `<li>${esc(typeof x === 'string' ? x : `${x.sigla || ''} ${x.clave || x.diferencia || ''}`)}</li>`).join('')}</ul>` : ''}</div>`;
    }
    if (c.clase === 'facies') {
      const fa = c.fa || {}, fm = c.fm || {};
      return `<div class="jg-ficha">${c.imagen ? `<img class="jg-escena grande" src="${esc(c.imagen)}" alt="${esc(c.nombre)}" loading="lazy" onerror="this.remove()">` : ''}
        ${fa.rasgo ? `<p class="jg-valor"><span>👁️ Rasgo</span>${esc(fa.rasgo)}</p>` : ''}${fa.orienta ? `<p><b>→ Orienta a:</b> ${esc(fa.orienta)}</p>` : ''}
        ${fm.ancla ? `<p class="ancla">⚓ ${esc(fm.ancla)}</p>` : ''}${fm.escena ? `<p class="jg-esc-txt">🎬 ${esc(fm.escena)}</p>` : ''}</div>`;
    }
    const k = c.caso;
    const datos = (k.datos_ids || []).map((id) => POR_ID[id]).filter(Boolean);
    return `<div class="jg-ficha">${k.viñeta ? `<div class="jg-vineta">📋 ${resaltar(k.viñeta)}</div>` : ''}
      <p class="jg-valor"><span>✅ Respuesta</span>${esc(c.correcta)}</p>${k.explicacion ? `<p class="jg-esc-txt">📖 ${resaltar(k.explicacion)}</p>` : ''}
      ${datos.length ? `<p class="jg-pt">🔗 Datos del atlas que usa</p><div class="jg-chips">${datos.map((d) => `<span class="chip">${esc(d.icono)} ${esc(d.nombre)}</span>`).join('')}</div>` : ''}</div>`;
  }
  function pintarPanel() {
    if (!capa || !enc) return;
    const { c, p } = enc; const panel = capa.querySelector('.jg-enc-panel');
    let html = '';
    if (enc.fase === 'ok') {
      const g = enc.ganado;
      html = `<div class="jg-exito r-${c.rareza}"><div class="jg-exito-t">${g.nueva ? '🧠 ¡Capturado!' : g.repaso ? '🔁 ¡Recapturado!' : '✔ ¡Bien!'}</div>
          <div class="jg-exito-xp">+${g.xp} XP${g.x2 ? ' <span class="x2">x2 ¡estaba aquí!</span>' : ''}${enc.fallos ? ` <span class="x2">tras ${enc.fallos} fallo${enc.fallos > 1 ? 's' : ''}</span>` : ''}</div></div>
        <p class="jg-q chica">${esc(p.q)}</p><p class="jg-resp">${resaltar(p.a)}</p>
        ${detalleHTML(c)}
        <p class="jg-mute">🔁 Entró a tu repaso: ${proximo(p.card)}.</p>
        <div class="jg-btns"><button class="btn pri" data-e="cerrar">${enc.spawn ? '🌿 Seguir cazando' : 'Listo'}</button><button class="btn" data-e="dex">📖 Ver en Memodex</button></div>`;
    } else if (enc.fase === 'escrito') {
      html = `<p class="jg-q">${esc(p.q)}</p>
        <div class="jg-compara"><div><small>Tú escribiste</small><p>${esc(enc.escrito) || '<i>(vacío)</i>'}</p></div><div class="ok"><small>Respuesta</small><p>${resaltar(p.a)}</p></div></div>
        <p class="jg-mute">Sé honesto contigo: ¿lo tenías?</p>
        <div class="jg-btns"><button class="btn pri" data-e="autoeval" data-ok="1">✅ Sí, lo sabía</button><button class="btn" data-e="autoeval" data-ok="0">❌ No del todo</button></div>`;
    } else {
      const fallo = enc.fase === 'fallo';
      const puedeEscribir = c.clase !== 'caso';
      const ops = enc.modo === 'elegir'
        ? `<div class="jg-ops" role="group" aria-label="Opciones">${p.opciones.map((o, i) => `<button class="jg-op ${enc.malas.has(i) ? 'mala' : ''}" data-e="op" data-i="${i}" ${enc.malas.has(i) ? 'disabled' : ''}>
            <span class="l">${'ABCDEF'[i]}</span><span class="t">${resaltar(o)}</span></button>`).join('')}</div>
           ${puedeEscribir ? '<button class="jg-link" data-e="modo" data-modo="escribir">✍️ Prefiero escribirla de memoria</button>' : ''}`
        : `<div class="jg-escribir"><textarea rows="2" placeholder="Escribe tu respuesta de memoria…" aria-label="Tu respuesta">${esc(enc.escrito)}</textarea>
            <div class="jg-btns"><button class="btn pri" data-e="comprobar">Comprobar</button><button class="jg-link" data-e="modo" data-modo="elegir">🔘 Ver opciones</button></div></div>`;
      html = `${c.clase === 'caso' && c.caso.viñeta ? `<div class="jg-vineta">📋 ${resaltar(c.caso.viñeta)}</div>` : ''}
        <p class="jg-q">${esc(p.q)}</p>
        ${fallo ? `<div class="jg-fallo">❌ ¡Se escapó del 🧠! Usa la pista y reintenta (XP ×${multXP(enc.fallos)}).</div>${pistaHTML()}` : ''}
        ${ops}
        ${enc.fallos >= 2 && c.clase !== 'caso' ? '<button class="jg-link" data-e="ver-resp">👀 Ver la respuesta</button>' : ''}
        ${enc.verResp ? `<p class="jg-resp">${resaltar(p.a)}</p>` : ''}`;
    }
    panel.innerHTML = html;
    const foco = panel.querySelector('textarea') || panel.querySelector('.jg-op:not(:disabled)') || panel.querySelector('.btn');
    if (foco && !('ontouchstart' in window)) foco.focus({ preventScroll: true });
  }
  function proximo(card) {
    const t = S.info(card); if (!t?.due) return 'pronto';
    const d = Math.max(0, Math.round((t.due - Date.now()) / 86400000));
    return d === 0 ? 'hoy mismo' : d === 1 ? 'mañana' : `en ${d} días`;
  }
  function alClicEnc(ev) {
    const b = ev.target.closest('[data-e]'); if (!b || !enc) return;
    switch (b.dataset.e) {
      case 'huir': case 'cerrar': cerrarEncuentro(); break;
      case 'op': elegir(+b.dataset.i, b); break;
      case 'modo': enc.modo = b.dataset.modo; pintarPanel(); break;
      case 'comprobar': comprobarEscrito(); break;
      case 'autoeval': if (b.dataset.ok === '1') acierto(null); else fallo(null); break;
      case 'ver-resp': enc.verResp = true; pintarPanel(); break;
      case 'dex': { const c = enc.c; cerrarEncuentro(); h.abrirDex(c.d ? 'datos' : c.clase === 'sigla' ? 'siglas' : c.clase === 'facies' ? 'facies' : 'casos', c.d ? c.d.id : c.k); break; }
      default: break;
    }
  }
  function elegir(i, boton) {
    if (!enc || enc.fase === 'ok' || enc.bloq) return;
    if (norm(enc.p.opciones[i]) === norm(enc.p.a)) acierto(boton);
    else { enc.malas.add(i); fallo(boton); }
  }
  function comprobarEscrito() {
    if (!enc || !capa) return;
    enc.escrito = capa.querySelector('.jg-enc-panel textarea')?.value.trim() || '';
    const nr = numeros(enc.p.a), ne = numeros(enc.escrito);
    const exacto = enc.escrito && norm(enc.escrito) === norm(enc.p.a);
    const cifras = nr.length >= 1 && nr.slice(0, 3).every((x) => ne.includes(x));
    if (exacto || cifras) { acierto(capa.querySelector('[data-e="comprobar"]')); return; }
    enc.fase = 'escrito'; pintarPanel();
  }
  function fallo(boton) {
    const e = enc;
    if (!e.fallos) calificar(e.p.card, 1);
    e.fallos += 1; e.fase = 'fallo'; e.modo = 'elegir';
    E.contar('fallos');
    if (boton) { boton.classList.add('mala', 'tiembla'); boton.disabled = true; }
    capa?.querySelector('.jg-holo')?.classList.add('escapa');
    setTimeout(() => { capa?.querySelector('.jg-holo')?.classList.remove('escapa'); if (enc === e) pintarPanel(); if (e.c.d) h.refrescarMarca(e.c.d); }, boton ? 420 : 0);
  }
  async function acierto(boton) {
    const e = enc; if (!e || e.bloq) return;
    e.bloq = true;
    const { c } = e; const R = RAREZA[c.rareza];
    if (!e.fallos) calificar(e.p.card, 3);
    const nueva = E.capturar(c.capId);
    const repaso = !nueva && e.eraVencida;
    let base = R.xp;
    if (!nueva && !repaso) base = Math.round(R.xp * 0.4);       // ya la tenías y estaba al día
    if (!e.spawn) base = Math.round(base * 0.6);                 // práctica desde el Memodex
    const x2 = e.x2 && !!e.spawn;
    const xp = Math.max(5, Math.round(base * multXP(e.fallos) * (x2 ? 2 : 1)));
    E.contar('aciertos');
    if (e.spawn) { E.contar('salvajes'); E.cazar(e.clave, c.k); quitarMarca(c.k); }
    if (c.rareza === 'raro') E.contar('raros');
    if (c.rareza === 'epico') E.contar('epicos');
    if (x2) E.contar('enLugar');
    if (repaso) E.contar('repasos');
    e.ganado = { xp, x2, nueva, repaso };
    if (boton) boton.classList.add('buena');
    if (!sinMov()) { h.esperarAnim(2600); await pausa(220); await animarCaptura(c); }
    E.registrarActividad();
    E.sumarXP(xp, `caza: ${c.nombre}`);
    evento('captura', { clase: c.clase, sid: c.sid, rareza: c.rareza, sinFallo: !e.fallos });
    h.revisarLogros(); h.pintarHUD();
    if (c.d) h.refrescarMarca(c.d);
    if (enc === e) { e.fase = 'ok'; e.bloq = false; pintarPanel(); }
  }
  function animarCaptura(c) {
    if (!capa) return Promise.resolve();
    const cap = document.createElement('div');
    cap.className = `jg-captura jg-cap-enc r-${c.rareza}`;
    cap.setAttribute('aria-hidden', 'true');
    cap.innerHTML = `<div class="jg-cap-item" style="--c:${esc(RAREZA[c.rareza].color)}">${c.imagen ? `<img src="${esc(c.imagen)}" alt="">` : c.clase === 'sigla' ? `<b class="jg-sig">${esc(c.nombre)}</b>` : esc(c.icono)}</div>
      <div class="jg-bola"><div class="jg-bola-base"></div><div class="jg-bola-tapa"><span>🧠</span></div><div class="jg-bola-boton"></div></div>
      <div class="jg-chispas">${'<i></i>'.repeat(10)}</div><div class="jg-cap-txt">¡Capturado!</div>`;
    capa.appendChild(cap);
    setTimeout(() => {
      if (c.rareza === 'epico') confetti(['#a855f7', '#f0abfc', '#fde047', '#22d3ee', '#ffffff'], 200);
      else if (c.rareza === 'raro') confetti(['#3b82f6', '#93c5fd', '#fde047', '#ffffff'], 90);
    }, 2050);
    return pausa(2300).then(() => { cap.classList.add('fuera'); setTimeout(() => cap.remove(), 300); });
  }

  // ---------- Memodex: pestañas Siglas / Facies / Casos ----------
  const TABS = [
    { tab: 'siglas', clase: 'sigla', ic: '🔤', nombre: 'Siglas' },
    { tab: 'facies', clase: 'facies', ic: '🙂', nombre: 'Facies' },
    { tab: 'casos', clase: 'caso', ic: '🩺', nombre: 'Casos' },
  ];
  const capturadas = (lista) => lista.filter((c) => E.capturado(c.capId)).length;
  function dexTabs() { return TABS.map((t) => ({ ...t, tot: POR_CLASE[t.clase].length, cap: capturadas(POR_CLASE[t.clase]) })); }
  function htmlDexTab(tab) {
    const t = TABS.find((x) => x.tab === tab); if (!t) return '';
    const lista = POR_CLASE[t.clase];
    if (!lista.length) return `<div class="jg-dex-vacio"><b>${t.ic}</b><p>${t.clase === 'caso' ? 'Aún no hay casos clínicos cargados (data/casos.json). Cuando existan, aparecerán como criaturas 🟣 épicas en tu ruta.' : 'Aún no hay datos de memoria para esta categoría.'}</p></div>`;
    return `<div class="jg-cartas">${lista.map((c, i) => {
      const cap = E.capturado(c.capId); const est = estadoSRS(c);
      return `<button class="jg-carta r-${c.rareza} ${cap ? 'cap' : ''} ${est === 'vencida' && cap ? 'repaso' : ''}" style="--c:${esc(c.color)};--i:${(i % 12) * 30}ms" data-acc="dex-carta" data-id="${esc(c.k)}" aria-label="${cap ? esc(c.nombre) : 'Carta sin capturar'}">
        <span class="num">#${String(i + 1).padStart(3, '0')}</span><span class="ic">${cap || c.clase !== 'facies' ? arte(c, cap) : '<span>🙂</span>'}</span>
        <span class="nm">${cap ? esc(c.clase === 'caso' ? c.nombre : c.corto || c.nombre) : '???'}</span><span class="lg">${RAREZA[c.rareza].ic}${est === 'vencida' && cap ? ' ⏰' : ''}</span></button>`;
    }).join('')}</div>`;
  }
  function htmlDexFicha(k) {
    const c = CRI[k]; if (!c) return '';
    const cap = E.capturado(c.capId); const R = RAREZA[c.rareza];
    return `<div class="jg-modal" data-acc="ficha-fondo"><div class="jg-ficha-carta r-${c.rareza} ${cap ? 'cap' : ''}" style="--c:${esc(c.color)}" role="dialog" aria-label="${esc(cap ? c.nombre : 'Carta sin capturar')}">
      <button class="jg-x" data-acc="ficha-cerrar" aria-label="Cerrar ficha">✕</button>
      <div class="jg-fc-cab"><span class="ic">${arte(c, false)}</span><div><small>${R.ic} ${R.nombre} · ${CLASE[c.clase]}${c.grupo ? ` · ${esc(c.grupo)}` : ''}</small><h3>${cap ? esc(c.nombre) : '???'}</h3></div></div>
      <p class="jg-mute">${ETQ_SRS[estadoSRS(c)]} · ${c.cards.length} tarjeta${c.cards.length > 1 ? 's' : ''} de repaso</p>
      ${cap ? detalleHTML(c) : `<div class="jg-silueta">${c.clase === 'sigla' ? '🔤' : esc(c.icono)}</div><p class="jg-mute" style="text-align:center">Aún no la capturas. Búscala en tu ruta diaria o rétala aquí.</p>`}
      <div class="jg-btns"><button class="btn pri" data-acc="cazar-retar" data-k="${esc(c.k)}">🎯 ${cap ? 'Practicar aquí' : 'Retar aquí'}</button></div></div></div>`;
  }

  // ---------- logros de la caza ----------
  const caps = (pref) => E.capturas().filter((id) => id.startsWith(pref)).length;
  const LOGROS = [
    { id: 'primer-salvaje', ic: '🌿', nombre: 'Primera criatura salvaje', desc: 'Atrapa tu primera aparición en la ruta diaria', ok: () => (E.stats().salvajes || 0) >= 1 },
    { id: 'cazador-25', ic: '🧲', nombre: 'Cazador de la ruta', desc: 'Atrapa 25 apariciones salvajes', ok: () => (E.stats().salvajes || 0) >= 25 },
    { id: 'cazador-100', ic: '🦅', nombre: 'Cien en el camino', desc: 'Atrapa 100 apariciones salvajes', ok: () => (E.stats().salvajes || 0) >= 100 },
    { id: 'primer-raro', ic: '🔵', nombre: '¡Un raro!', desc: 'Atrapa una criatura rara (sigla, escala o facies)', ok: () => (E.stats().raros || 0) >= 1 },
    { id: 'primer-epico', ic: '🟣', nombre: 'Épico', desc: 'Resuelve un caso clínico épico', ok: () => (E.stats().epicos || 0) >= 1 },
    { id: 'misiones-1', ic: '📜', nombre: 'Misión cumplida', desc: 'Completa una misión diaria', ok: () => (E.stats().misiones || 0) >= 1 },
    { id: 'misiones-15', ic: '🗺️', nombre: 'Explorador constante', desc: 'Completa 15 misiones diarias', ok: () => (E.stats().misiones || 0) >= 15 },
    ...(POR_CLASE.sigla.length >= 25 ? [{ id: 'siglas-25', ic: '🔤', nombre: 'Diccionario andante', desc: 'Captura 25 siglas', ok: () => caps('sig:') >= 25 }] : []),
    ...(POR_CLASE.facies.length ? [{ id: 'facies-todas', ic: '🙂', nombre: 'Fisonomista', desc: `Captura las ${POR_CLASE.facies.length} facies`, ok: () => POR_CLASE.facies.every((c) => E.capturado(c.capId)) }] : []),
  ];

  // ---------- clics que llegan desde juego.js ----------
  function alClic(a, b) {
    switch (a) {
      case 'ruta': elegirRuta(b.dataset.ruta); return true;
      case 'cebo': activarCebo(); if (h.hoja()?.tipo === 'misiones') h.pintarHoja(); return true;
      case 'misiones': h.abrirHoja({ tipo: 'misiones' }); return true;
      case 'cazar-retar': encontrar(b.dataset.k); return true;
      default: return false;
    }
  }

  return {
    activo, RUTAS, LOGROS, CRI,
    inicio: () => INICIO?.ll || null,
    limites: () => (rutaSel ? rutaSel.pts : RUTAS.flatMap((r) => r.pts)).concat(INICIO ? [INICIO.ll] : [], FIN ? [FIN.ll] : []),
    dibujar, montarBarra, pintarBarra, pintarApariciones, alUbicar, calificar, evento, encontrar, cerrarEncuentro,
    htmlMisiones, dexTabs, htmlDexTab, htmlDexFicha, esClave: (k) => !!CRI[k] && !String(k).startsWith('d:'), alClic,
    abierto: () => !!enc,
  };
}
