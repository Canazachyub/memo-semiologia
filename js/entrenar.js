// Pestaña ENTRENAR: minijuegos de recuerdo activo sobre el atlas.
// Interfaz igual que ciudad.js: crearEntrenar({ ATLAS, MEMO, SIGLAS, FACIES, srs, raiz }) → { pintar() }.
// Reglas de los skills: abiertas antes que opción múltiple (#007), el ancla solo después del intento (#039),
// rondas solo con los errores hasta cero errores (#031, #040), feedback inmediato.
import { levenshtein, cobertura, sinMov, seguirSinMov, idCarta } from './juego-util.js';
import * as mias from './mias.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = (t) => String(t ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, '').trim();
const azar = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const uno = (a) => a[Math.floor(Math.random() * a.length)];
const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const corto = (t, max = 72) => {
  let s = String(t ?? '').split(';')[0].trim();
  if (s.length > max) s = s.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return s;
};
const valido = (t) => !!t && !/^(sin significado|sin dato|no aplica|none|—|-)/i.test(String(t).trim()) && !/SIN DATO/.test(t);

// Respaldo de la tabla 00-99 por si data/tabla00_99.json no carga (mismo contenido).
const TABLA_RESPALDO = ('seso,seta,sauna,sumo,zorro,sol,ceja,saco,sofá,sopa,taza,dedo,tina,dama,toro,tele,teja,taco,tofu,topo,' +
  'Nasa,nido,niño,Nemo,noria,anillo,nacho,nuca,nave,nube,mesa,moto,mono,momia,muro,miel,mecha,mago,mafia,mapa,' +
  'rosa,rata,rana,remo,aurora,rulo,rojo,roca,rifa,ropa,losa,lata,luna,lima,loro,lila,leche,lago,lava,lupa,' +
  'choza,chita,chuño,gema,jarra,jaula,chicha,jaque,jefe,jeep,casa,gato,cuna,cama,carro,gallo,caja,coco,café,copa,' +
  'vaso,foto,vino,fama,faro,vela,faja,vaca,FIFA,FBI,peso,pato,pino,puma,pera,pala,paja,pico,pavo,papa').split(',');
const LETRA = { 0: 'S·Z·C suave', 1: 'T·D', 2: 'N·Ñ', 3: 'M', 4: 'R', 5: 'L', 6: 'J·CH·G suave', 7: 'G·C dura·K·Q', 8: 'F·V', 9: 'P·B' };

// Decodifica una palabra con el sistema mayor (todas las consonantes cuentan; LL, RR y CH valen uno).
export function decodificar(p) {
  const s = String(p ?? '').toLowerCase().replace(/ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'ñ').replace(/[^a-zñ]/g, '');
  const M = { s: '0', z: '0', t: '1', d: '1', n: '2', ñ: '2', m: '3', r: '4', l: '5', j: '6', k: '7', f: '8', v: '8', p: '9', b: '9' };
  let o = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i], n = s[i + 1] || '';
    if (c === 'c' && n === 'h') { o += '6'; i++; continue; }
    if (c === 'l' && n === 'l') { o += '5'; i++; continue; }
    if (c === 'r' && n === 'r') { o += '4'; i++; continue; }
    if (c === 'q') { o += '7'; if (n === 'u') i++; continue; }
    if (c === 'g') { if (n === 'u' && /[ei]/.test(s[i + 2] || '')) { o += '7'; i++; continue; } o += /[ei]/.test(n) ? '6' : '7'; continue; }
    if (c === 'c') { o += /[ei]/.test(n) ? '0' : '7'; continue; }
    if (c === 'x') { o += '70'; continue; }
    if (M[c]) o += M[c];
  }
  return o;
}

// ---------- rangos numéricos del atlas (para el caso clínico) ----------
function leerNum(s) {
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return { v: +s.replace(/\./g, ''), dec: 0, sep: '.', miles: true };
  const m = s.match(/[.,](\d+)$/);
  return { v: parseFloat(s.replace(',', '.')), dec: m ? m[1].length : 0, sep: s.includes(',') ? ',' : '.', miles: false };
}
function unidad(resto) {
  const r = String(resto || '').replace(/^\s+/, '');
  const m = r.match(/^([^\s(;,·)]+)/);
  if (!m) return '';
  if (m[1] === 'por') return (r.match(/^por\s+[^\s(;,·)]+/) || [m[1]])[0];
  if (m[1] === '%' && /^%\s+de\s/.test(r)) return (r.match(/^%\s+de\s+(?:la\s+|los\s+|las\s+)?[^\s(;,·)]+/) || ['%'])[0];
  return m[1];
}
export function parseRango(t) {
  if (!t) return null;
  const seg = String(t).split(';')[0];
  if (/\d\s*\/\s*\d/.test(seg) || /[+−×=]/.test(seg)) return null;
  const fuera = seg.replace(/\([^)]*\)/g, ' ');
  const dentro = (seg.match(/\(([^)]*)\)/g) || []).join(' ').replace(/[()]/g, ' ');
  const nums = (s) => s.match(/\d+(?:[.,]\d+)*/g) || [];
  const R = /(\d+(?:[.,]\d+)*)\s*[-–]\s*(\d+(?:[.,]\d+)*)(.*)$/;
  const cmp = /[<>≤≥]|hasta/i;
  const mk = (tipo, a, b, resto) => {
    const A = leerNum(a), B = b ? leerNum(b) : null;
    const fmt = { dec: Math.max(A.dec, B?.dec || 0), sep: A.dec ? A.sep : (B?.sep || '.'), miles: A.miles || !!B?.miles };
    if (B && !(B.v > A.v)) return null;
    return { tipo, lo: A.v, hi: B ? B.v : null, u: unidad(resto), fmt };
  };
  const nf = nums(fuera);
  if (nf.length === 2 && !cmp.test(fuera)) { const m = fuera.match(R); if (m) return mk('rango', m[1], m[2], m[3]); }
  if (nf.length === 1 && cmp.test(fuera)) {
    if (dentro && !cmp.test(dentro) && nums(dentro).length === 2) { const md = dentro.match(R); if (md) return mk('rango', md[1], md[2], md[3]); }
    const m = fuera.match(/(<|>|≤|≥|hasta)\s*(\d+(?:[.,]\d+)*)(.*)$/i);
    if (m) {
      const r = mk(/[<≤]|hasta/i.test(m[1]) ? 'max' : 'min', m[2], null, m[3]);
      if (r) { r.incl = /[≤≥]|hasta/i.test(m[1]); r.hi = r.tipo === 'max' ? r.lo : null; if (r.tipo === 'max') r.lo = null; }
      return r;
    }
  }
  return null;
}
function formatear(v, f) {
  if (f.miles) return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const s = v.toFixed(f.dec);
  return f.sep === ',' ? s.replace('.', ',') : s;
}
function clasificar(v, r) {
  if (r.tipo === 'rango') return v > r.hi ? 'alto' : v < r.lo ? 'bajo' : 'normal';
  if (r.tipo === 'max') return (r.incl ? v > r.hi : v >= r.hi) ? 'alto' : 'normal';
  return (r.incl ? v < r.lo : v <= r.lo) ? 'bajo' : 'normal';
}
function generarValor(r, estado) {
  const f = { ...r.fmt };
  const ref = r.hi ?? r.lo;
  if (!f.miles && f.dec === 0 && ref < 10) f.dec = 1;
  for (let k = 0; k < 25; k++) {
    const q = Math.random();
    let v;
    if (r.tipo === 'rango') {
      const w = r.hi - r.lo;
      if (estado === 'normal') v = r.lo + w * (0.15 + 0.7 * q);
      else if (estado === 'alto') v = r.hi + w * (0.15 + 0.9 * q);
      else { v = r.lo - w * (0.15 + 0.6 * q); if (v <= 0) v = r.lo * (0.5 + 0.35 * q); }
    } else if (r.tipo === 'max') v = estado === 'alto' ? r.hi * (1.2 + 0.8 * q) : r.hi * (0.45 + 0.4 * q);
    else v = estado === 'bajo' ? r.lo * (0.5 + 0.35 * q) : r.lo * (1.15 + 0.5 * q);
    const txt = formatear(v, f);
    const num = f.miles ? +txt.replace(/\./g, '') : +txt.replace(',', '.');
    if (clasificar(num, r) === estado) return { txt, estado };
  }
  return null;
}

// ---------- módulo ----------
const CLAVE = 'memo-semio-entrenar';
const JUEGOS = [
  { id: 'mayor', ic: '🔢', t: 'Gimnasio del sistema mayor', d: 'Dígitos ↔ palabras-imagen y decodifica valores reales.', c: 'g1' },
  { id: 'siglas', ic: '🔤', t: 'Siglas', d: '¿Qué significa? ¿Cuál es la sigla? Con pistas de tus escenas.', c: 'g2' },
  { id: 'reloj', ic: '⚡', t: 'Contrarreloj', d: '60 segundos: valor normal, si sube, si baja.', c: 'g3' },
  { id: 'match', ic: '🧩', t: 'Emparejar', d: 'Memoria de 6 parejas: voltea y encuentra.', c: 'g4' },
  { id: 'caso', ic: '🩺', t: 'Caso clínico', d: 'Lee los resultados: ¿normal, alto o bajo?', c: 'g5' },
  { id: 'facies', ic: '🙂', t: 'Facies', d: 'Reconoce la cara y lo que orienta.', c: 'g6' },
  { id: 'orden', ic: '🪜', t: 'Ordena la clasificación', d: '¿Cuántos son? Ordénalos… y ahora al revés.', c: 'g7' },
];
// Contrarreloj y Emparejar son de formato test: practican el formato, no mueven el calendario (EN1)
const FORMATO = new Set(['reloj', 'match']);

export function crearEntrenar({ ATLAS = {}, MEMO = {}, SIGLAS = {}, FACIES = {}, PALACIOS = {}, srs, raiz }) {
  MEMO = MEMO || {}; SIGLAS = SIGLAS || {}; FACIES = FACIES || {}; PALACIOS = PALACIOS || {};
  const SECC = ATLAS.secciones || [];
  const FILAS = SECC.flatMap((s) => (s.filas || []).map((f) => ({ ...f, sec: s })));
  const FAC = (ATLAS.facies || []).filter((f) => f.nombre);
  const GLOS = (ATLAS.glosario || []).flatMap((g) => (g.items || []).map((i) => ({ ...i, grupo: g.titulo }))).filter((i) => i.sigla && i.significado);

  // CSS propio, sin tocar index.html
  try {
    if (!document.querySelector('link[data-entrenar]')) {
      const l = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: new URL('../css/entrenar.css', import.meta.url).href });
      l.dataset.entrenar = '1'; document.head.appendChild(l);
    }
  } catch { /* el coordinador puede enlazar el CSS a mano */ }

  // estado del juego compartido (opcional: lo crea otro agente)
  let JE = null;
  import('./juego-estado.js').then((m) => { JE = m; if (!activo && raiz.querySelector('.ent-menu')) menu(); }).catch(() => { JE = null; });
  function xp(n, motivo) {
    if (n > 0) brindis(`+${n} XP`);
    try { JE?.sumarXP?.(n, motivo); JE?.registrarActividad?.(); } catch { /* opcional */ }
  }

  // tabla 00-99
  let TABLA = Object.fromEntries(TABLA_RESPALDO.map((p, i) => [String(i).padStart(2, '0'), { palabra: p, letras: '', alt: [], nota: '' }]));
  fetch(new URL('../data/tabla00_99.json', import.meta.url)).then((r) => r.json()).then((j) => { if (j?.tabla) TABLA = j.tabla; }).catch(() => {});
  const letrasDe = (n) => TABLA[n]?.letras || [...n].map((d) => LETRA[d].split('·')[0]).join('-');

  // récords
  const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; } };
  const guardar = (e) => { try { localStorage.setItem(CLAVE, JSON.stringify(e)); } catch { /* modo privado */ } };
  function record(clave, valor, mayorEsMejor = true) {
    const e = leer(); e.rec = e.rec || {};
    const prev = e.rec[clave];
    const mejor = prev == null || (mayorEsMejor ? valor > prev : valor < prev);
    if (mejor) { e.rec[clave] = valor; guardar(e); }
    return { mejor: mejor && prev != null, prev };
  }
  const rec = (clave) => leer().rec?.[clave];
  function contarJugada(id) { const e = leer(); e.jug = e.jug || {}; e.jug[id] = (e.jug[id] || 0) + 1; guardar(e); }
  // EN3: historial de retención por ronda → memo-semio-entrenar.hist = [{juego, fecha, pct, n}]
  function guardarHist(juegoId, pct, n) {
    const e = leer(); e.hist = e.hist || [];
    const d = new Date();
    e.hist.push({ juego: juegoId, fecha: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, t: Date.now(), pct, n });
    if (e.hist.length > 200) e.hist.splice(0, e.hist.length - 200);
    guardar(e);
  }
  // EN1: "Modo examen tipo test" (opciones desde el inicio) solo si el usuario lo activa
  const modoTest = () => !!leer().test;

  // srs: tarjetas propias 'ent:' y, solo ante un fallo, la tarjeta del atlas pasa a "Difícil"
  const idTarjeta = (id) => (MEMO[id]?.preguntas?.length ? idCarta(id, MEMO[id].preguntas[0], 0) : `${id}#n`);
  function srsEnt(id, nota) { try { srs?.calificar?.(`ent:${id}`, nota === true ? 3 : nota === false ? 1 : nota, { fuente: 'entrenar' }); } catch { /* sin srs */ } }
  function srsFallo(filaId) { try { srs?.calificar?.(idTarjeta(filaId), 2, { fuente: 'entrenar' }); } catch { /* sin srs */ } }
  const debida = (id) => { try { return !!srs?.info?.(`ent:${id}`) && srs.vence(`ent:${id}`); } catch { return false; } };
  const nueva = (id) => { try { return !srs?.info?.(`ent:${id}`); } catch { return true; } };
  // primero lo que toca repasar, luego lo nuevo, luego el resto
  const priorizar = (items, idf, n) => {
    const a = azar(items);
    return [...a.filter((x) => debida(idf(x))), ...a.filter((x) => nueva(idf(x))), ...a.filter((x) => !debida(idf(x)) && !nueva(idf(x)))].slice(0, n);
  };

  // ---------- infraestructura de pantalla ----------
  let activo = null;           // id del juego en curso
  let acc = {};                // acciones de los botones data-acc
  let timers = [];
  let alOcultar = null;         // pausa/reanuda del juego en curso (contrarreloj) con la pestaña oculta
  const limpiar = () => { timers.forEach((t) => { clearInterval(t); clearTimeout(t); }); timers = []; alOcultar = null; };
  {
    const seccion = raiz.closest('.vista');
    const avisar = () => { try { alOcultar?.(document.hidden || (seccion && !seccion.classList.contains('on'))); } catch { /* sin juego */ } };
    document.addEventListener('visibilitychange', avisar);
    if (seccion) new MutationObserver(avisar).observe(seccion, { attributes: true, attributeFilter: ['class'] });
  }
  const despues = (ms, fn) => timers.push(setTimeout(fn, ms));
  const cada = (ms, fn) => timers.push(setInterval(fn, ms));
  const $ = (s) => raiz.querySelector(s);

  raiz.classList.add('ent');
  seguirSinMov(raiz);
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('[data-acc]');
    if (!b || b.disabled || !raiz.contains(b)) return;
    const f = acc[b.dataset.acc];
    if (f) f(b, e);
  });
  raiz.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input[data-enter]')) { e.preventDefault(); acc[e.target.dataset.enter]?.(e.target); }
  });
  document.addEventListener('keydown', (e) => {
    if (!raiz.offsetParent || !activo || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.matches?.('input, textarea, select')) { if (e.key === 'Enter' && !e.target.dataset.enter) { const s = raiz.querySelector('[data-acc="sig"]'); if (s) { e.preventDefault(); s.click(); } } return; }
    if (['1', '2', '3', '4'].includes(e.key)) { const op = raiz.querySelectorAll('[data-op]:not([disabled])')[+e.key - 1]; if (op) { e.preventDefault(); op.click(); } }
    else if (e.key === 'Enter') { const s = raiz.querySelector('[data-acc="sig"]'); if (s) { e.preventDefault(); s.click(); } }
    else if (e.key === 'Escape') menu();
  });

  function brindis(txt, tipo = 'xp') {
    const el = document.createElement('div');
    el.className = `ent-brindis ent-${tipo}`; el.textContent = txt; el.setAttribute('aria-hidden', 'true');
    raiz.appendChild(el); setTimeout(() => el.remove(), 1300);
  }
  function confeti() {
    if (sinMov()) return;
    const c = document.createElement('div'); c.className = 'ent-confeti'; c.setAttribute('aria-hidden', 'true');
    const col = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ec4899'];
    c.innerHTML = Array.from({ length: 36 }, (_, i) => `<i style="left:${(Math.random() * 100).toFixed(1)}%;background:${col[i % col.length]};animation-delay:${(Math.random() * 0.5).toFixed(2)}s"></i>`).join('');
    raiz.appendChild(c); setTimeout(() => c.remove(), 2600);
  }
  function flash(el, ok) {
    if (!el) return;
    el.classList.remove('ent-ok', 'ent-mal'); void el.offsetWidth;
    el.classList.add(ok ? 'ent-ok' : 'ent-mal');
  }

  // marcador común: racha, aciertos, cronómetro
  const nuevoMarcador = (total) => ({ total, n: 0, ok: 0, racha: 0, mejor: 0, t0: Date.now(), errores: [] });
  function cabecera(j, M, extra = '') {
    return `<div class="ent-cab">
      <button class="ent-volver" data-acc="menu" aria-label="Volver a los juegos">←</button>
      <h2><span aria-hidden="true">${j.ic}</span> <span>${esc(j.t)}</span></h2>
      <div class="ent-stats">
        <span class="ent-st" title="Racha de aciertos">🔥 <b id="ent-racha">${M.racha}</b></span>
        ${M.total ? `<span class="ent-st" title="Aciertos">✅ <b id="ent-ac">${M.ok}</b>/${M.total}</span>` : ''}
        <span class="ent-st" title="Tiempo">⏱ <b id="ent-t">${M.cuenta ? '1:00' : '0:00'}</b></span>${extra}
      </div></div>
      ${M.total ? `<div class="ent-prog" aria-hidden="true"><i id="ent-barra" style="width:${(100 * M.n / M.total).toFixed(1)}%"></i></div>` : ''}`;
  }
  function relojSubida(M) { const t = () => { const e = $('#ent-t'); if (e) e.textContent = mmss(Date.now() - M.t0); }; t(); cada(500, t); }
  function anotar(M, ok, error) {
    M.n++;
    if (ok) { M.ok++; M.racha++; M.mejor = Math.max(M.mejor, M.racha); } else { M.racha = 0; if (error) M.errores.push(error); }
    const r = $('#ent-racha');
    if (r) { r.textContent = M.racha; r.parentElement.classList.remove('ent-bump'); void r.offsetWidth; if (ok) r.parentElement.classList.add('ent-bump'); }
    const a = $('#ent-ac'); if (a) a.textContent = M.ok;
    const b = $('#ent-barra'); if (b && M.total) b.style.width = `${(100 * M.n / M.total).toFixed(1)}%`;
    if (ok && M.racha % 5 === 0) { brindis(`🔥 ¡Racha de ${M.racha}!`, 'racha'); xp(5, `racha ${M.racha}`); }
  }
  // pantalla final con ronda de errores (recuerdo activo: solo se repite lo fallado)
  function fin(j, M, { otra, errores, resumen = '' }) {
    limpiar();
    const pct = M.total ? Math.round(100 * M.ok / M.total) : 0;
    const sem = pct >= 90 ? ['🟢', '¡Dominado!'] : pct >= 60 ? ['🟡', 'Vas bien: repasa los errores'] : ['🔴', 'Toca repetir los errores'];
    const r = record(`racha:${j.id}`, M.mejor);
    if (pct === 100 && M.total) confeti();
    xp(10 + Math.round(pct / 10), `ronda ${j.id}`);
    contarJugada(j.id);
    if (M.total) guardarHist(j.id, pct, M.total);
    acc = { menu, otra, errores: () => errores(M.errores.map((e) => e.item)) };
    raiz.innerHTML = `<div class="ent-juego"><div class="ent-fin ent-pop">
      <div class="ent-medalla">${sem[0]}</div><h3>${sem[1]}</h3>
      <div class="ent-kpis"><div><b>${M.ok}/${M.total}</b><span>aciertos</span></div><div><b>${pct}%</b><span>efectividad</span></div>
        <div><b>${mmss(Date.now() - M.t0)}</b><span>tiempo</span></div><div><b>🔥 ${M.mejor}</b><span>mejor racha${r.mejor ? ' · ¡récord!' : ''}</span></div></div>
      ${resumen}
      ${M.errores.length ? `<details class="ent-errores" open><summary>❌ Errores (${M.errores.length})</summary><ul>${M.errores.map((e) => `<li>${e.html}</li>`).join('')}</ul></details>` : ''}
      <div class="ent-btns">
        ${M.errores.length && errores ? `<button class="ent-b pri" data-acc="errores">🔁 Repetir solo los errores (${M.errores.length})</button>` : ''}
        <button class="ent-b ${M.errores.length && errores ? '' : 'pri'}" data-acc="otra">▶ Otra ronda</button>
        <button class="ent-b" data-acc="menu">🏠 Juegos</button>
      </div></div></div>`;
  }
  // botones de opción múltiple
  const opciones = (ops, attr = 'op') => `<div class="ent-ops">${ops.map((o, i) =>
    `<button class="ent-op" data-op="${i}" data-acc="${attr}" data-v="${esc(o.v)}"><kbd>${i + 1}</kbd><span>${o.html ?? esc(o.t)}</span></button>`).join('')}</div>`;
  function marcarOps(correcta, elegida) {
    raiz.querySelectorAll('[data-op]').forEach((b) => {
      b.disabled = true;
      if (b.dataset.v === correcta) b.classList.add('ent-bien');
      else if (b === elegida) b.classList.add('ent-error');
      else b.classList.add('ent-apagada');
    });
  }
  // n distractores distintos (por texto) tomados de pool
  function distractores(correcta, pool, n = 3) {
    const vistos = new Set([norm(correcta)]); const r = [];
    for (const p of azar(pool)) { const k = norm(p); if (!k || vistos.has(k)) continue; vistos.add(k); r.push(p); if (r.length === n) break; }
    return r;
  }
  const pistaMemo = (m) => !m ? '' : [m.ancla && `⚓ ${esc(m.ancla)}`, m.escena && `🎬 ${esc(m.escena)}`].filter(Boolean).join('<br>');
  const juego = (id) => JUEGOS.find((j) => j.id === id);

  // ---------- menú ----------
  function menu() {
    limpiar(); activo = null; acc = { jugar: (b) => JUEGOS_FN[b.dataset.j](), test: () => { const e = leer(); e.test = !e.test; guardar(e); menu(); } };
    let nivel = '';
    try {
      const n = JE?.nivel?.();
      if (n) nivel = `<div class="ent-nivel">⭐ Nivel <b>${esc(n.n)}</b> · ${esc(n.xp)} XP${n.siguiente ? ` <small>(siguiente: ${esc(n.siguiente)})</small>` : ''}${JE.racha ? ` · 🔥 ${esc(JE.racha())} días` : ''}</div>`;
    } catch { /* opcional */ }
    const info = {
      mayor: () => (rec('racha:mayor') ? `🔥 mejor racha ${rec('racha:mayor')}` : '100 imágenes fijas'),
      siglas: () => `${GLOS.length} siglas${rec('racha:siglas') ? ` · 🔥 ${rec('racha:siglas')}` : ''}`,
      reloj: () => (rec('reloj:todas') != null ? `🏆 récord ${rec('reloj:todas')} pts` : 'sin récord aún'),
      match: () => (rec('match:valores') != null ? `🏆 ${mmss(rec('match:valores'))}` : '3 modos'),
      caso: () => `${PARAMS_CASO.length} parámetros con rango`,
      facies: () => `${FAC.length} facies`,
      orden: () => `${LISTAS.length} listas y tramos`,
    };
    raiz.innerHTML = `<div class="ent-menu ent-in">
      <div class="ent-hero"><div><h2>🏋️ Entrenar</h2><p>Recuerdo activo en modo juego: responde de memoria, mira el feedback y repite solo lo que fallaste.</p></div>${nivel}</div>
      <div class="ent-grid">${JUEGOS.map((j, i) => `<button class="ent-card ${j.c}" data-acc="jugar" data-j="${j.id}" style="animation-delay:${i * 60}ms">
        <span class="ent-ic" aria-hidden="true">${j.ic}</span><b>${esc(j.t)}</b><span class="ent-d">${esc(j.d)}</span><span class="ent-rec">${esc(info[j.id]())}</span>
        ${FORMATO.has(j.id) ? '<span class="ent-formato">🎮 práctica de formato (no mueve tu calendario)</span>' : ''}</button>`).join('')}</div>
      <label class="ent-test"><input type="checkbox" data-acc="test" ${modoTest() ? 'checked' : ''}> <span><b>Modo examen tipo test</b><small>Siglas y Facies empiezan con 4 opciones. Apagado, primero respondes escribiendo: ver opciones te hace reconocer, no recordar.</small></span></label>
      <p class="ent-nota">Teclado: 1-4 eligen opción · Enter sigue · Esc vuelve al menú.</p>
    </div>`;
  }

  // =====================================================================
  // 1. GIMNASIO DEL SISTEMA MAYOR
  // =====================================================================
  let decena = '';     // '' = todas, '0'..'9' = esa decena
  function codigosMemo() {
    const r = [];
    for (const [id, m] of Object.entries(MEMO)) {
      for (const c of m?.codigo || []) {
        if (!/^\d+$/.test(String(c.numero ?? '')) || !c.palabra) continue;
        const f = FILAS.find((x) => x.id === id) || ATLAS.escalas?.find((x) => x.id === id);
        r.push({ key: `dec:${id}:${c.numero}`, filaId: id, nombre: f?.nombre || m.parametro || id, icono: f?.icono || '🔢',
          palabra: c.palabra, numero: String(c.numero), letras: c.letras || '', ancla: m.ancla, normal: f?.normal?.t || m.dato_a_recordar || '', real: true });
      }
    }
    return r;
  }
  // respaldo sin memoria.json: cifras del atlas codificadas con tu tabla 00-99
  function codigosAtlas() {
    const r = [];
    for (const f of FILAS) {
      const t = corto(f.normal?.t, 200);
      const vistos = new Set();
      for (const tok of t.replace(/\([^)]*\)/g, ' ').match(/\d+(?:[.,]\d+)*/g) || []) {
        const d = tok.replace(/[.,]/g, '');
        if (!(d.length === 2 || d.length === 4) || vistos.has(d)) continue;
        vistos.add(d);
        const pares = d.match(/\d\d/g);
        r.push({ key: `dec:${f.id}:${d}`, filaId: f.id, nombre: f.nombre, icono: f.icono || '🔢', palabra: pares.map((p) => TABLA[p]?.palabra).join(' + '),
          numero: d, letras: pares.map(letrasDe).join(' | '), tok, normal: f.normal?.t || '', real: false });
      }
    }
    return r;
  }

  function mayor() {
    limpiar(); activo = 'mayor';
    const j = juego('mayor');
    const reales = codigosMemo();
    acc = {
      menu,
      modo: (b) => rondaMayor(b.dataset.m),
      dec: (b) => { decena = b.dataset.d; mayor(); },
      tabla: () => { const t = $('#ent-tabla'); t.hidden = !t.hidden; },
      celda: (b) => b.classList.toggle('ver'),
      todas: () => raiz.querySelectorAll('.ent-celda').forEach((c) => c.classList.add('ver')),
    };
    raiz.innerHTML = `<div class="ent-juego ent-in">${cabecera(j, nuevoMarcador(0))}
      <div class="ent-leyenda">${Object.entries(LETRA).map(([d, l]) => `<span><b>${d}</b>${esc(l)}</span>`).join('')}</div>
      <p class="ent-sub">Rango: <span class="ent-chips">${['', ...'0123456789'].map((d) =>
        `<button class="chip ${decena === d ? 'on' : ''}" data-acc="dec" data-d="${d}">${d === '' ? 'Todo' : `${d}0–${d}9`}</button>`).join('')}</span></p>
      <div class="ent-modos">
        <button class="ent-modo" data-acc="modo" data-m="np"><b>37 → ?</b><span>Número → palabra</span><small>Escribe tu imagen fija (sin opciones primero)</small></button>
        <button class="ent-modo" data-acc="modo" data-m="pn"><b>mago → ?</b><span>Palabra → número</span><small>Decodifica con el teclado</small></button>
        <button class="ent-modo" data-acc="modo" data-m="dec"><b>🫀 → 60</b><span>Decodificar valores reales</span>
          <small>${reales.length ? `${reales.length} códigos de tus escenas` : 'Aún sin códigos en memoria.json: usa cifras del atlas con tu tabla'}</small></button>
      </div>
      <button class="ent-b" data-acc="tabla">📖 Ver / estudiar la tabla 00–99</button>
      <div id="ent-tabla" hidden><p class="ent-sub">Toca un número para revelar su palabra (intenta recordarla antes). <button class="link" data-acc="todas">Mostrar todas</button></p>
        <div class="ent-tabla">${Object.entries(TABLA).map(([n, x]) => `<button class="ent-celda" data-acc="celda" aria-label="Número ${n}"><b>${n}</b><span>${esc(x.palabra)}</span></button>`).join('')}</div></div>
    </div>`;
    relojSubida(nuevoMarcador(0));
  }

  function rondaMayor(modo, lista) {
    limpiar(); activo = 'mayor';
    const j = juego('mayor');
    let items;
    if (lista) items = lista;
    else if (modo === 'dec') { const r = codigosMemo(); items = priorizar(r.length ? r : codigosAtlas(), (x) => x.key, 10); }
    else {
      const nums = Object.keys(TABLA).filter((n) => decena === '' || n[0] === decena);
      items = priorizar(nums.map((n) => ({ key: `mayor:${n}`, n })), (x) => x.key, 10);
    }
    if (!items.length) { mayor(); return; }
    const M = nuevoMarcador(items.length);
    let i = 0, conOpciones = false, t0 = 0;

    const pintarItem = () => {
      const it = items[i]; conOpciones = false; t0 = Date.now();
      let cuerpo;
      if (modo === 'np') {
        cuerpo = `<p class="ent-pide">¿Cuál es tu palabra-imagen para…</p><div class="ent-grande">${it.n}</div>
          <p class="ent-sub">${[...it.n].map((d) => `${d} = ${esc(LETRA[d])}`).join(' · ')}</p>
          <div class="ent-resp"><input id="ent-in" data-enter="comprobar" autocomplete="off" autocapitalize="off" placeholder="Escribe la palabra…" aria-label="Tu palabra">
          <button class="ent-b pri" data-acc="comprobar">Comprobar</button></div>
          <div class="ent-btns"><button class="ent-b" data-acc="ops">💡 Ver 4 opciones</button><button class="ent-b" data-acc="nose">🤷 No sé</button></div><div id="ent-opz"></div>`;
      } else {
        const palabra = modo === 'pn' ? TABLA[it.n]?.palabra : it.palabra;
        cuerpo = `${modo === 'dec' ? `<p class="ent-pide">${esc(it.icono)} <b>${esc(it.nombre)}</b>${it.real ? ' · código de tu escena' : ' · valor normal codificado'}</p>` : '<p class="ent-pide">¿Qué número esconde…</p>'}
          <div class="ent-grande ent-palabra">${esc(palabra)}</div>
          <div class="ent-resp"><input id="ent-in" data-enter="comprobar" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="Número" aria-label="Número">
          <button class="ent-b pri" data-acc="comprobar">Comprobar</button></div>
          <div class="ent-pad">${'123456789'.split('').concat(['⌫', '0', '✓']).map((k) => `<button class="ent-tecla" data-acc="tecla" data-k="${k}" aria-label="${k === '⌫' ? 'Borrar' : k === '✓' ? 'Comprobar' : k}">${k}</button>`).join('')}</div>
          <div class="ent-btns"><button class="ent-b" data-acc="nose">🤷 No sé</button></div>`;
      }
      raiz.innerHTML = `<div class="ent-juego">${cabecera(j, M)}<div class="ent-tarjeta ent-in" id="ent-card">${cuerpo}<div id="ent-fb"></div></div></div>`;
      relojSubida(M);
      setTimeout(() => $('#ent-in')?.focus({ preventScroll: true }), 30);
    };

    const responder = (valor, rendido = false) => {
      const it = items[i];
      if ($('#ent-card').classList.contains('hecho')) return;
      let ok = false, nota = '', correcta;
      if (modo === 'np') {
        const fija = TABLA[it.n];
        correcta = fija.palabra;
        const v = norm(valor);
        if (!rendido && v) {
          if ([fija.palabra, ...(fija.alt || [])].some((p) => norm(p) === v)) ok = true;
          else if (decodificar(valor) === it.n) { ok = true; nota = `Vale por el sistema mayor, pero tu imagen fija es <b>${esc(fija.palabra)}</b>: úsala siempre igual.`; }
          else if (v) nota = `«${esc(valor)}» decodifica ${esc(decodificar(valor) || '—')}.`;
        }
      } else {
        correcta = modo === 'pn' ? it.n : it.numero;
        ok = !rendido && String(valor).replace(/\D/g, '') === correcta;
      }
      $('#ent-card').classList.add('hecho');
      raiz.querySelectorAll('#ent-card input, #ent-card .ent-tecla, #ent-card [data-acc="ops"], #ent-card [data-acc="nose"], #ent-card [data-acc="comprobar"]').forEach((e) => { e.disabled = true; });
      flash($('#ent-card'), ok);
      const rapido = Date.now() - t0 < 5000;
      anotar(M, ok, ok ? null : { item: it, html: modo === 'np' ? `<b>${it.n}</b> = ${esc(correcta)} <small>${esc(TABLA[it.n].letras)}</small>`
        : modo === 'pn' ? `<b>${esc(TABLA[it.n].palabra)}</b> = ${it.n}` : `${esc(it.nombre)}: <b>${esc(it.palabra)}</b> = ${esc(it.numero)}` });
      if (ok) xp(conOpciones ? 1 : rapido ? 4 : 2, 'sistema mayor');
      // srs
      if (modo === 'dec') { srsEnt(it.key, ok); if (!ok && it.real) srsFallo(it.filaId); }
      else srsEnt(`mayor:${it.n}`, ok ? (rapido && !conOpciones ? 4 : conOpciones ? 2 : 3) : 1);
      // feedback (el ancla solo después del intento)
      let fb;
      if (modo === 'np') { const x = TABLA[it.n]; fb = `<b>${it.n} = ${esc(x.palabra)}</b> <span class="ent-letras">${esc(x.letras)}</span>${x.alt?.length ? `<br><small>también: ${esc(x.alt.join(', '))}</small>` : ''}${x.nota ? `<br><small>${esc(x.nota)}</small>` : ''}`; }
      else if (modo === 'pn') { const x = TABLA[it.n]; fb = `<b>${esc(x.palabra)} = ${it.n}</b> <span class="ent-letras">${esc(x.letras)}</span>`; }
      else fb = `<b>${esc(it.palabra)} = ${esc(it.numero)}</b> <span class="ent-letras">${esc(it.letras)}</span><br>✅ Normal: ${esc(it.normal)}${it.ancla ? `<br>⚓ ${esc(it.ancla)}` : ''}`;
      $('#ent-fb').innerHTML = `<div class="ent-feedback ${ok ? 'si' : 'no'}">${ok ? '✅ ¡Correcto!' : '❌ No era'}${nota ? `<p>${nota}</p>` : ''}<p>${fb}</p>
        <button class="ent-b pri" data-acc="sig">${i + 1 < items.length ? 'Siguiente →' : 'Ver resultado'}</button></div>`;
      if (ok && !nota) despues(modo === 'dec' ? 1800 : 900, () => acc.sig());
      else $('[data-acc="sig"]')?.focus({ preventScroll: true });
    };

    acc = {
      menu,
      comprobar: () => responder($('#ent-in')?.value || ''),
      nose: () => responder('', true),
      tecla: (b) => {
        const inp = $('#ent-in'); const k = b.dataset.k;
        if (k === '⌫') inp.value = inp.value.slice(0, -1); else if (k === '✓') responder(inp.value); else inp.value += k;
        if (modo === 'pn' && inp.value.length === 2) responder(inp.value);
      },
      ops: () => {
        conOpciones = true;
        const it = items[i];
        const correcta = TABLA[it.n].palabra;
        const otros = distractores(correcta, Object.entries(TABLA).filter(([n]) => n !== it.n && (n[0] === it.n[0] || n[1] === it.n[1])).map(([, x]) => x.palabra));
        $('#ent-opz').innerHTML = opciones(azar([correcta, ...otros]).map((p) => ({ t: p, v: p })));
        $('[data-acc="ops"]').disabled = true;
      },
      op: (b) => { marcarOps(TABLA[items[i].n].palabra, b); responder(b.dataset.v); },
      sig: () => { limpiar(); i++; if (i < items.length) pintarItem(); else fin(j, M, { otra: () => rondaMayor(modo), errores: (l) => rondaMayor(modo, l) }); },
    };
    pintarItem();
  }

  // =====================================================================
  // EN1 · respuesta abierta primero; la pista y las 4 opciones solo tras fallar (#007, #039)
  // =====================================================================
  // 'ok' acierto automático · 'dudoso' comparar y autoevaluarse con honestidad · 'mal' fallo directo
  function validarAbierta(tipo, v, correcta) {
    const a = norm(v), b = norm(correcta);
    if (!a) return 'mal';
    if (a === b) return 'ok';
    if (tipo === 'sigla') {
      const x = a.replace(/\s/g, ''), y = b.replace(/\s/g, '');
      if (x === y) return 'ok';
      return y.length >= 3 && y.length <= 5 && levenshtein(x, y) <= 1 ? 'ok' : 'mal';
    }
    if (tipo === 'nombre') {
      if (b.length >= 5 && (a.includes(b) || (a.length >= 5 && b.includes(a)) || levenshtein(a, b) <= 2)) return 'ok';
      return 'dudoso';
    }
    return cobertura(v, correcta) >= 0.75 ? 'ok' : 'dudoso';
  }
  // cfg = { zona, tipo: 'sigla'|'nombre'|'texto', correcta, ops: [{t, v}], pista: html, fin({ok, intento, test}) }
  function abierta(cfg) {
    const z = () => $(cfg.zona);
    const conOps = (intento) => {
      z().innerHTML = `${intento === 2 ? `<div class="ent-feedback no ent-in">❌ Aún no.<p>2.º intento (menos XP): ${cfg.pista ? 'usa la pista y ' : ''}elige entre 4.</p></div>
        ${cfg.pista ? `<div class="ent-pista ent-in">${cfg.pista}</div>` : ''}` : ''}${opciones(cfg.ops)}`;
      acc.op = (b) => { marcarOps(cfg.correcta, b); cfg.fin({ ok: b.dataset.v === cfg.correcta, intento, test: intento === 1 }); };
    };
    if (modoTest()) { conOps(1); return; }
    z().innerHTML = `<div class="ent-resp"><input id="ent-in" data-enter="abComprobar" autocomplete="off" autocapitalize="off" spellcheck="false"
        placeholder="${cfg.tipo === 'sigla' ? 'Escribe la sigla…' : 'Escribe de memoria…'}" aria-label="Tu respuesta">
      <button class="ent-b pri" data-acc="abComprobar">Comprobar</button></div>
      <div class="ent-btns"><button class="ent-b" data-acc="abNose">🤷 No sé (ver pista)</button></div>`;
    let escrito = '';
    acc.abComprobar = () => {
      escrito = $('#ent-in')?.value.trim() || '';
      if (!escrito) { $('#ent-in')?.focus(); return; }
      const r = validarAbierta(cfg.tipo, escrito, cfg.correcta);
      if (r === 'ok') { z().innerHTML = ''; cfg.fin({ ok: true, intento: 1 }); return; }
      if (r === 'mal') { conOps(2); return; }
      z().innerHTML = `<div class="ent-compara ent-in"><div><small>Tú escribiste</small><p>${esc(escrito)}</p></div><div class="ok"><small>Respuesta</small><p>${esc(cfg.correcta)}</p></div></div>
        <p class="ent-sub">Sé honesto contigo: ¿lo tenías?</p>
        <div class="ent-btns"><button class="ent-b pri" data-acc="abSi">✅ Sí, lo sabía</button><button class="ent-b" data-acc="abNo">❌ No del todo</button></div>`;
    };
    acc.abSi = () => { z().innerHTML = ''; cfg.fin({ ok: true, intento: 1 }); };
    acc.abNo = () => { z().innerHTML = ''; cfg.fin({ ok: false, intento: 1 }); };   // ya viste la respuesta: no hay 2.º intento
    acc.abNose = () => conOps(2);
    setTimeout(() => $('#ent-in')?.focus({ preventScroll: true }), 30);
  }

  // =====================================================================
  // 2. SIGLAS
  // =====================================================================
  const slug = (t) => String(t ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const SIG_IDX = {};
  for (const [k, v] of Object.entries(SIGLAS)) { if (!v || typeof v !== 'object') continue; SIG_IDX[k] = v; if (v.sigla) SIG_IDX[slug(v.sigla)] = SIG_IDX[slug(v.sigla)] || v; }
  const memoSigla = (s) => SIG_IDX[slug(s)] || null;
  const miaDe = (ref) => { try { return mias.get(ref) || null; } catch { return null; } };
  const anclaDe = (m, mia) => mia?.ancla || m?.ancla || '';

  function siglas(lista) {
    limpiar(); activo = 'siglas';
    const j = juego('siglas');
    if (GLOS.length < 4) { raiz.innerHTML = `<div class="ent-juego">${cabecera(j, nuevoMarcador(0))}<p class="fin">No hay suficientes siglas en el glosario.</p></div>`; acc = { menu }; return; }
    const items = (lista || priorizar(GLOS, (x) => `sigla:${slug(x.sigla)}`, 10)).map((x) => ({ ...x, dir: Math.random() < 0.6 ? 'sig' : 'inv' }));
    const M = nuevoMarcador(items.length);
    let i = 0;
    const pintarItem = () => {
      const it = items[i];
      const mismos = GLOS.filter((g) => g.grupo === it.grupo);
      const pool = mismos.length >= 4 ? mismos : GLOS;
      const campo = it.dir === 'sig' ? 'significado' : 'sigla';
      const correcta = it[campo];
      const ops = azar([correcta, ...distractores(correcta, pool.map((g) => g[campo]))]).map((t) => ({ t, v: t }));
      const m = memoSigla(it.sigla); const an = anclaDe(m, miaDe(`sig:${slug(it.sigla)}`));
      const pista = [m?.sustituta && `🔊 Suena a: <b>${esc(m.sustituta)}</b>`, an ? `⚓ ${esc(an)}` : m?.escena && `🎬 ${esc(m.escena)}`].filter(Boolean).join('<br>');
      raiz.innerHTML = `<div class="ent-juego">${cabecera(j, M)}<div class="ent-tarjeta ent-in" id="ent-card">
        <p class="ent-pide">${it.dir === 'sig' ? '¿Qué significa la sigla…' : '¿Cuál es la sigla de…'} <span class="chip">${esc(it.grupo)}</span></p>
        <div class="ent-grande ${it.dir === 'sig' ? '' : 'ent-texto'}">${esc(it.dir === 'sig' ? it.sigla : it.significado)}</div>
        <div id="ent-ab"></div><div id="ent-fb"></div></div></div>`;
      relojSubida(M);
      abierta({ zona: '#ent-ab', tipo: it.dir === 'sig' ? 'texto' : 'sigla', correcta, ops, pista, fin: resolver });
    };
    const resolver = (r) => {
      const it = items[i]; const ok = r.ok; const primera = ok && r.intento === 1;
      flash($('#ent-card'), ok);
      anotar(M, primera, primera ? null : { item: it, html: `<b>${esc(it.sigla)}</b> = ${esc(it.significado)}` });
      if (ok) xp(primera ? (r.test ? 2 : 3) : 1, 'siglas');
      srsEnt(`sigla:${slug(it.sigla)}`, ok ? (primera && !r.test ? 3 : 2) : 1);
      const m = memoSigla(it.sigla); const an = anclaDe(m, miaDe(`sig:${slug(it.sigla)}`));
      const conf = (m?.confusiones || []).map((x) => (typeof x === 'string' ? x : x?.sigla || '')).filter(Boolean);
      $('#ent-fb').innerHTML = `<div class="ent-feedback ${ok ? 'si' : 'no'}">${ok ? (primera ? '✅ ¡Correcto!' : '✅ Bien, en el 2.º intento') : '❌ No era'}
        <p><b>${esc(it.sigla)}</b> = ${esc(it.significado)}</p>
        ${m || an ? `<p class="ent-memo">${m?.sustituta ? `🔊 ${esc(m.sustituta)}<br>` : ''}${an ? `⚓ ${esc(an)}` : ''}${m?.escena ? `${an ? '<br>' : ''}🎬 ${esc(m.escena)}` : ''}${conf.length ? `<br>⚠️ No confundir con: ${esc(conf.join(', '))}` : ''}</p>` : ''}
        <button class="ent-b pri" data-acc="sig">${i + 1 < items.length ? 'Siguiente →' : 'Ver resultado'}</button></div>`;
      if (primera && !m) despues(900, () => acc.sig());
      else $('[data-acc="sig"]')?.focus({ preventScroll: true });
    };
    acc = { menu, sig: () => { limpiar(); i++; if (i < items.length) pintarItem(); else fin(j, M, { otra: () => siglas(), errores: (l) => siglas(l) }); } };
    pintarItem();
  }

  // =====================================================================
  // 6. FACIES (nombre y luego "¿qué orienta?")
  // =====================================================================
  function facies(lista) {
    limpiar(); activo = 'facies';
    const j = juego('facies');
    if (FAC.length < 4) { raiz.innerHTML = `<div class="ent-juego">${cabecera(j, nuevoMarcador(0))}<p class="fin">Faltan facies en el atlas.</p></div>`; acc = { menu }; return; }
    const items = lista || priorizar(FAC, (x) => `facies:${x.id}`, 8);
    const M = nuevoMarcador(items.length * 2);
    let i = 0, paso = 1, r1 = null;
    const img = (f) => f.imagen
      ? `<img decoding="async" class="ent-facies-img" src="${esc(f.imagen)}" alt="Facies a reconocer" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ent-facies-img ent-sin',textContent:'🙂'}))">`
      : '<div class="ent-facies-img ent-sin">🙂</div>';
    const pistaDe = (f) => {
      const m = FACIES[f.id]; const an = anclaDe(m, miaDe(`fac:${f.id}`));
      if (paso === 1) return m?.rasgo_clave ? `👁 ${esc(m.rasgo_clave)}` : an ? `⚓ ${esc(an)}` : '';
      return an ? `⚓ ${esc(an)}` : m?.rasgo_clave ? `👁 ${esc(m.rasgo_clave)}` : '';
    };
    const pintarItem = () => {
      const f = items[i];
      const campo = paso === 1 ? 'nombre' : 'orienta';
      const ops = azar([f[campo], ...distractores(f[campo], FAC.map((x) => x[campo]))]).map((t) => ({ t, v: t }));
      raiz.innerHTML = `<div class="ent-juego">${cabecera(j, M)}<div class="ent-tarjeta ent-in" id="ent-card">
        <div class="ent-facies">${img(f)}<div>
          <p class="ent-pide">${paso === 1 ? 'Paso 1 · ¿Qué facies es?' : `Paso 2 · Facies <b>${esc(f.nombre)}</b>: ¿qué orienta?`}</p>
          ${paso === 2 ? `<p class="ent-sub">Rasgo: ${esc(f.rasgo)}</p>` : ''}
        </div></div><div id="ent-ab"></div><div id="ent-fb"></div></div></div>`;
      relojSubida(M);
      abierta({ zona: '#ent-ab', tipo: paso === 1 ? 'nombre' : 'texto', correcta: f[campo], ops, pista: pistaDe(f), fin: resolver });
    };
    const resolver = (r) => {
      const f = items[i]; const ok = r.ok; const primera = ok && r.intento === 1;
      flash($('#ent-card'), ok);
      // el error de una facies se anota una sola vez (en el primer paso que falla)
      anotar(M, primera, primera || (paso === 2 && !r1.primera) ? null : { item: f, html: `<b>${esc(f.nombre)}</b> → ${esc(f.orienta)}` });
      if (ok) xp(primera ? (r.test ? 2 : 3) : 1, 'facies');
      const m = FACIES[f.id]; const an = anclaDe(m, miaDe(`fac:${f.id}`));
      if (paso === 1) {
        r1 = { primera, test: r.test };
        $('#ent-fb').innerHTML = `<div class="ent-feedback ${ok ? 'si' : 'no'}">${ok ? (primera ? '✅ ¡Correcto!' : '✅ Bien, en el 2.º intento') : '❌ No era'} <p>Es la facies <b>${esc(f.nombre)}</b>: ${esc(f.rasgo)}</p>
          <button class="ent-b pri" data-acc="sig">Paso 2 →</button></div>`;
        if (primera) despues(1100, () => acc.sig()); else $('[data-acc="sig"]')?.focus({ preventScroll: true });
      } else {
        const nota = r1.primera && primera ? (r.test || r1.test ? 2 : 3) : (r1.primera || ok) ? 2 : 1;
        srsEnt(`facies:${f.id}`, nota);
        $('#ent-fb').innerHTML = `<div class="ent-feedback ${ok ? 'si' : 'no'}">${ok ? (primera ? '✅ ¡Correcto!' : '✅ Bien, en el 2.º intento') : '❌ No era'}
          <p><b>${esc(f.nombre)}</b> → ${esc(f.orienta)}</p>${m || an ? `<p class="ent-memo">${m?.rasgo_clave ? `👁 ${esc(m.rasgo_clave)}<br>` : ''}${an ? `⚓ ${esc(an)}` : ''}${m?.escena ? `${an ? '<br>' : ''}🎬 ${esc(m.escena)}` : ''}</p>` : ''}
          <button class="ent-b pri" data-acc="sig">${i + 1 < items.length ? 'Siguiente facies →' : 'Ver resultado'}</button></div>`;
        $('[data-acc="sig"]')?.focus({ preventScroll: true });
      }
    };
    acc = {
      menu,
      sig: () => {
        limpiar();
        if (paso === 1) paso = 2; else { paso = 1; i++; }
        if (i < items.length) pintarItem();
        else fin(j, M, { otra: () => facies(), errores: (l) => facies([...new Map(l.map((x) => [x.id, x])).values()]) });
      },
    };
    pintarItem();
  }

  // =====================================================================
  // 7. ORDENA LA CLASIFICACIÓN (EN2): ¿cuántos? → en orden → al revés (#137, #187, #195)
  // =====================================================================
  const LISTAS = (() => {
    const r = [];
    const unicos = (el) => new Set(el.map(norm)).size === el.length;
    for (const e of ATLAS.escalas || []) {
      const it = (e.interpretacion || []).filter((x) => x[0] && x[1]);
      const textos = it.map((x) => corto(x[1], 60));
      if (it.length >= 3 && unicos(textos)) r.push({ key: `orden:interp:${e.id}`, ic: e.icono || '📏', titulo: e.nombre, pide: `Interpretación, en el orden del atlas: de «${it[0][0]}» a «${it.at(-1)[0]}».`, el: textos });
      (e.items || []).forEach(([comp, txt], k) => {
        const partes = String(txt || '').split(/\s+·\s+/);
        if (partes.length < 3 || !partes.every((p) => /^\d+\s+\S/.test(p))) return;
        const nums = partes.map((p) => parseInt(p, 10));
        const desc = nums.every((n, q) => !q || n < nums[q - 1]);
        const asc = nums.every((n, q) => !q || n > nums[q - 1]);
        const el = partes.map((p) => corto(p.replace(/^\d+\s+/, ''), 60));
        if ((!desc && !asc) || !unicos(el)) return;
        r.push({ key: `orden:item:${e.id}:${k}`, ic: e.icono || '📏', titulo: `${e.nombre} · ${comp}`, pide: `Ordena de ${desc ? 'mayor a menor' : 'menor a mayor'} puntaje (${nums[0]} → ${nums.at(-1)}).`, el });
      });
    }
    // tramos de 5 estaciones de cada lugar del palacio (C4): el recorrido vacío, en orden
    for (const sid of PALACIOS.orden_paseo || []) {
      const L = PALACIOS.lugares?.[sid]; if (!L) continue;
      const filas = sid === 'escalas' ? (ATLAS.escalas || []) : (SECC.find((x) => x.id === sid)?.filas || []);
      const ubic = filas.map((f, n) => MEMO[f.id]?.estacion?.ubicacion || L.ruta?.[n] || '');
      for (let t = 0; t * 5 < ubic.length; t++) {
        const el = ubic.slice(t * 5, t * 5 + 5);
        if (el.length < 3 || el.some((x) => !x) || !unicos(el)) continue;
        r.push({ key: `orden:pal:${sid}:${t}`, ic: L.icono || '🏛️', titulo: `${L.lugar} · tramo ${t + 1}`, pide: `Palacio: recorre las estaciones ${t * 5 + 1}-${t * 5 + el.length} de este lugar en orden.`, el });
      }
    }
    return r;
  })();

  function orden(lista) {
    limpiar(); activo = 'orden';
    const j = juego('orden');
    if (!LISTAS.length) { raiz.innerHTML = `<div class="ent-juego">${cabecera(j, nuevoMarcador(0))}<p class="fin">No hay listas ordenadas en el atlas.</p></div>`; acc = { menu }; return; }
    const items = lista || priorizar(LISTAS, (x) => x.key, 5);
    const M = nuevoMarcador(items.length);
    let i = 0, fase = 'contar', error = false, pos = 0, esperado = [];
    const pintarItem = () => {
      const it = items[i]; fase = 'contar'; error = false;
      raiz.innerHTML = `<div class="ent-juego">${cabecera(j, M)}<div class="ent-tarjeta ent-in" id="ent-card">
        <p class="ent-pide">${esc(it.ic)} <b>${esc(it.titulo)}</b></p><p class="ent-sub">${esc(it.pide)}</p>
        <div id="ent-ord"><p class="ent-pide">Paso 1 · ¿Cuántos elementos tiene?</p>
          <div class="ent-resp"><input id="ent-in" data-enter="contar" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="Número" aria-label="Cuántos elementos tiene">
          <button class="ent-b pri" data-acc="contar">Comprobar</button></div></div><div id="ent-fb"></div></div></div>`;
      relojSubida(M);
      setTimeout(() => $('#ent-in')?.focus({ preventScroll: true }), 30);
    };
    const empezar = (reves) => {
      const it = items[i];
      fase = reves ? 'reves' : 'orden'; pos = 0;
      esperado = reves ? [...it.el].reverse() : [...it.el];
      $('#ent-ord').innerHTML = `<p class="ent-pide">${reves ? 'Paso 3 · 🔙 Ahora al revés: del último al primero' : 'Paso 2 · Toca los elementos en orden'}</p>
        <ol class="ent-orden-sec" id="ent-sec" aria-live="polite"></ol>
        <div class="ent-fichas">${azar(it.el).map((t) => `<button class="ent-ficha" data-acc="ficha" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
    };
    const terminar = () => {
      const it = items[i]; const ok = !error;
      anotar(M, ok, ok ? null : { item: it, html: `${esc(it.ic)} <b>${esc(it.titulo)}</b>: ${it.el.map(esc).join(' → ')}` });
      if (ok) xp(5, 'ordenar');
      srsEnt(it.key, ok ? 3 : 1);
      flash($('#ent-card'), ok);
      $('#ent-fb').innerHTML = `<div class="ent-feedback ${ok ? 'si' : 'no'}">${ok ? '✅ ¡Perfecto, adelante y al revés!' : '❌ Hubo errores: va a tu ronda de errores.'}
        <p>${it.el.map((t, k) => `${k + 1}. ${esc(t)}`).join('<br>')}</p>
        <button class="ent-b pri" data-acc="sig">${i + 1 < items.length ? 'Siguiente →' : 'Ver resultado'}</button></div>`;
      $('[data-acc="sig"]')?.focus({ preventScroll: true });
    };
    acc = {
      menu,
      contar: () => {
        if (fase !== 'contar') return;
        const it = items[i]; const v = parseInt($('#ent-in')?.value, 10);
        if (!Number.isFinite(v)) { $('#ent-in')?.focus(); return; }
        fase = 'contado';
        const ok = v === it.el.length; if (!ok) error = true;
        $('#ent-in').disabled = true; $('[data-acc="contar"]').disabled = true;
        flash($('#ent-card'), ok);
        $('#ent-fb').innerHTML = `<div class="ent-feedback ${ok ? 'si' : 'no'}">${ok ? `✅ Son ${it.el.length}.` : `❌ Son <b>${it.el.length}</b>, no ${v}.`}</div>`;
        despues(ok ? 600 : 1400, () => { $('#ent-fb').innerHTML = ''; empezar(false); });
      },
      ficha: (b) => {
        const toca = esperado[pos];
        const bien = norm(b.dataset.v) === norm(toca);
        let boton = b;
        if (!bien) {   // se marca el error y se coloca el que tocaba, para seguir el recorrido
          error = true; flash(b, false);
          boton = [...raiz.querySelectorAll('.ent-ficha:not([disabled])')].find((x) => norm(x.dataset.v) === norm(toca)) || b;
        }
        boton.disabled = true; boton.classList.add(bien ? 'ent-bien' : 'ent-apagada');
        $('#ent-sec').insertAdjacentHTML('beforeend', `<li class="${bien ? 'si' : 'no'}">${esc(toca)}${bien ? '' : ' <small>← era este</small>'}</li>`);
        pos++;
        if (pos < esperado.length) return;
        if (fase === 'orden' && !error) {
          $('#ent-fb').innerHTML = '<div class="ent-feedback si">✅ ¡En orden! Ahora al revés: el recorrido inverso refuerza más.</div>';
          despues(900, () => { $('#ent-fb').innerHTML = ''; empezar(true); });
          return;
        }
        terminar();
      },
      sig: () => { limpiar(); i++; if (i < items.length) pintarItem(); else fin(j, M, { otra: () => orden(), errores: (l) => orden(l) }); },
    };
    pintarItem();
  }

  // =====================================================================
  // 3. CONTRARRELOJ DE VALORES (60 s)
  // =====================================================================
  let relojSec = '';
  const DUR = 60000;
  function preguntasReloj(sec) {
    const base = FILAS.filter((f) => !sec || f.sec.id === sec);
    const qs = [];
    for (const f of base) {
      const hermanas = FILAS.filter((x) => x.sec.id === f.sec.id && x.id !== f.id);
      const pool = (campo) => {
        const p = hermanas.map((x) => x[campo]?.t).filter(valido).map((t) => corto(t));
        return p.length >= 3 ? p : FILAS.filter((x) => x.id !== f.id).map((x) => x[campo]?.t).filter(valido).map((t) => corto(t));
      };
      if (valido(f.normal?.t)) qs.push({ f, tipo: 'normal', q: /\d/.test(f.normal.t) ? `¿Valor normal de <b>${esc(f.nombre)}</b>?` : `<b>${esc(f.nombre)}</b>: ¿qué es lo normal / qué lo define?`, a: corto(f.normal.t), pool: () => pool('normal') });
      if (valido(f.sube?.t)) qs.push({ f, tipo: 'sube', q: `🔺 <b>${esc(f.nombre)}</b> ALTO → piensa en…`, a: corto(f.sube.t), pool: () => pool('sube') });
      if (valido(f.baja?.t)) qs.push({ f, tipo: 'baja', q: `🔻 <b>${esc(f.nombre)}</b> BAJO → piensa en…`, a: corto(f.baja.t), pool: () => pool('baja') });
    }
    return qs;
  }
  function reloj() {
    limpiar(); activo = 'reloj';
    const j = juego('reloj');
    const clave = `reloj:${relojSec || 'todas'}`;
    acc = { menu, sec: (b) => { relojSec = b.dataset.s; reloj(); }, empezar: () => partidaReloj() };
    raiz.innerHTML = `<div class="ent-juego ent-in">${cabecera(j, nuevoMarcador(0))}
      <div class="ent-tarjeta ent-centro">
        <div class="ent-grande">⚡ 60 s</div>
        <p>Responde todas las que puedas. Cada acierto suma <b>10</b> + bono por racha. Los errores no restan, pero cortan la racha.</p>
        <p class="ent-sub">Sección: <span class="ent-chips"><button class="chip ${relojSec ? '' : 'on'}" data-acc="sec" data-s="">Todas</button>${SECC.map((s) =>
          `<button class="chip ${relojSec === s.id ? 'on' : ''}" data-acc="sec" data-s="${s.id}">${s.icono} ${esc(s.titulo.replace(/^\d+ · /, ''))}</button>`).join('')}</span></p>
        <p class="ent-record">🏆 Récord: <b>${rec(clave) ?? '—'}</b></p>
        <button class="ent-b pri ent-xl" data-acc="empezar">¡Empezar!</button>
      </div></div>`;
  }
  function partidaReloj() {
    limpiar(); activo = 'reloj';
    const j = juego('reloj');
    const todas = preguntasReloj(relojSec);
    if (todas.length < 4) { reloj(); return; }
    const M = nuevoMarcador(0); M.cuenta = true;
    let pts = 0, cola = azar(todas), actual = null, bloqueo = false;
    const errores = [];
    let fin0 = Date.now() + DUR, pausaT = 0;
    // J3: con la pestaña oculta o fuera de Entrenar, el reloj se congela y la barra también
    alOcultar = (oculto) => {
      const b = $('#ent-tbar');
      if (oculto && !pausaT) {
        pausaT = Date.now();
        if (b) { b.style.transitionDuration = '0ms'; b.style.width = `${(100 * Math.max(0, fin0 - pausaT) / DUR).toFixed(2)}%`; }
      } else if (!oculto && pausaT) {
        fin0 += Date.now() - pausaT; pausaT = 0;
        const r = Math.max(0, fin0 - Date.now());
        if (b) requestAnimationFrame(() => { b.style.transitionDuration = `${r}ms`; b.style.width = '0%'; });
      }
    };
    raiz.innerHTML = `<div class="ent-juego">${cabecera(j, M, `<span class="ent-st" title="Puntos">⭐ <b id="ent-pts">0</b></span>`)}
      <div class="ent-tiempo" aria-hidden="true"><i id="ent-tbar"></i></div><div id="ent-zona"></div></div>`;
    requestAnimationFrame(() => { const b = $('#ent-tbar'); if (b) { b.style.transitionDuration = `${DUR}ms`; b.style.width = '0%'; } });
    const tic = () => {
      if (pausaT) return;
      const r = fin0 - Date.now();
      const e = $('#ent-t'); if (e) { e.textContent = mmss(r + 999); e.parentElement.classList.toggle('ent-urge', r < 10000); }
      if (r <= 0) terminar();
    };
    cada(250, tic);
    const siguiente = () => {
      if (!cola.length) cola = azar(todas);
      actual = cola.pop(); bloqueo = false;
      const ops = azar([actual.a, ...distractores(actual.a, actual.pool())]).map((t) => ({ t, v: t }));
      $('#ent-zona').innerHTML = `<div class="ent-tarjeta ent-rapida ent-in" id="ent-card"><p class="ent-pide">${esc(actual.f.sec.icono)} ${esc(actual.f.sec.titulo.replace(/^\d+ · /, ''))}</p>
        <div class="ent-q">${actual.q}</div>${opciones(ops)}</div>`;
    };
    function terminar() {
      limpiar();
      const clave = `reloj:${relojSec || 'todas'}`;
      const r = record(clave, pts);
      if (r.mejor || (r.prev == null && pts > 0)) confeti();
      xp(Math.round(pts / 10), 'contrarreloj');
      contarJugada('reloj');
      if (M.n) guardarHist('reloj', Math.round(100 * M.ok / M.n), M.n);
      record('racha:reloj', M.mejor);
      acc = { menu, otra: () => partidaReloj(), config: () => reloj() };
      raiz.innerHTML = `<div class="ent-juego"><div class="ent-fin ent-pop">
        <div class="ent-medalla">${r.mejor ? '🏆' : '⏱'}</div><h3>${r.mejor ? '¡Nuevo récord!' : '¡Tiempo!'}</h3>
        <div class="ent-kpis"><div><b>${pts}</b><span>puntos</span></div><div><b>${M.ok}/${M.n}</b><span>aciertos</span></div>
          <div><b>🔥 ${M.mejor}</b><span>mejor racha</span></div><div><b>${r.prev ?? (r.mejor ? '—' : pts)}</b><span>récord anterior</span></div></div>
        ${errores.length ? `<details class="ent-errores" open><summary>❌ Para repasar (${errores.length})</summary><ul>${errores.slice(0, 12).map((e) => `<li>${e}</li>`).join('')}</ul></details>` : ''}
        <div class="ent-btns"><button class="ent-b pri" data-acc="otra">⚡ Otra vez</button><button class="ent-b" data-acc="config">⚙️ Cambiar sección</button><button class="ent-b" data-acc="menu">🏠 Juegos</button></div>
      </div></div>`;
    }
    acc = {
      menu,
      op: (b) => {
        if (bloqueo) return; bloqueo = true;
        const ok = b.dataset.v === actual.a;
        marcarOps(actual.a, b); flash($('#ent-card'), ok);
        anotar(M, ok);
        if (ok) { const g = 10 + Math.min(M.racha - 1, 5) * 2; pts += g; brindis(`+${g}`, 'pts'); }
        else errores.push(`${actual.q.replace(/<[^>]+>/g, '')} <b>${esc(actual.a)}</b>`);
        const p = $('#ent-pts'); if (p) p.textContent = pts;
        despues(ok ? 380 : 1100, siguiente);
      },
    };
    siguiente();
  }

  // =====================================================================
  // 4. EMPAREJAR (memory de 6 parejas)
  // =====================================================================
  let matchModo = 'valores';
  const MODOS_MATCH = {
    valores: { t: '📋 Parámetro ↔ normal', pares: () => {
      const c = FILAS.filter((f) => valido(f.normal?.t) && corto(f.normal.t, 60).length <= 48);
      return elegirPares(c, (f) => corto(f.normal.t, 60)).map((f) => [`${f.icono || ''} ${f.nombre}`, corto(f.normal.t, 60)]);
    } },
    facies: { t: '🙂 Facies ↔ orienta', pares: () => elegirPares(FAC, (f) => f.orienta).map((f) => [`Facies ${f.nombre}`, f.orienta]) },
    siglas: { t: '🔤 Sigla ↔ significado', pares: () => elegirPares(GLOS, (g) => g.significado).map((g) => [g.sigla, corto(g.significado, 50)]) },
  };
  function elegirPares(lista, valorDe) {
    const r = [], vistos = new Set();
    for (const x of azar(lista)) { const k = norm(valorDe(x)); if (!k || vistos.has(k)) continue; vistos.add(k); r.push(x); if (r.length === 6) break; }
    return r;
  }
  function emparejar() {
    limpiar(); activo = 'match';
    const j = juego('match');
    const pares = MODOS_MATCH[matchModo].pares();
    const M = nuevoMarcador(pares.length);
    let abiertas = [], movs = 0, hechas = 0, bloqueo = false;
    const cartas = azar(pares.flatMap(([a, b], k) => [{ k, t: a, lado: 'a' }, { k, t: b, lado: 'b' }]));
    raiz.innerHTML = `<div class="ent-juego ent-in">${cabecera(j, M, `<span class="ent-st" title="Movimientos">👆 <b id="ent-movs">0</b></span>`)}
      <p class="ent-sub ent-chips">${Object.entries(MODOS_MATCH).map(([k, m]) => `<button class="chip ${k === matchModo ? 'on' : ''}" data-acc="modo" data-m="${k}">${m.t}</button>`).join('')}</p>
      <div class="ent-memory">${cartas.map((c, i) => `<button class="ent-carta ent-${c.lado}" data-acc="carta" data-i="${i}" aria-label="Carta ${i + 1} boca abajo">
        <span class="ent-cara ent-dorso" aria-hidden="true">🧠</span><span class="ent-cara ent-frente">${esc(c.t)}</span></button>`).join('')}</div></div>`;
    relojSubida(M);
    acc = {
      menu,
      modo: (b) => { matchModo = b.dataset.m; emparejar(); },
      carta: (b) => {
        if (bloqueo || b.classList.contains('vuelta') || b.classList.contains('hecha')) return;
        b.classList.add('vuelta'); b.setAttribute('aria-label', cartas[+b.dataset.i].t);
        abiertas.push(b);
        if (abiertas.length < 2) return;
        movs++; $('#ent-movs').textContent = movs;
        const [x, y] = abiertas.map((e) => cartas[+e.dataset.i]);
        const ok = x.k === y.k;
        if (ok) {
          abiertas.forEach((e) => { e.classList.add('hecha'); flash(e, true); });
          abiertas = []; hechas++; anotar(M, true); xp(2, 'emparejar');
          if (hechas === pares.length) despues(700, terminar);
        } else {
          bloqueo = true; M.racha = 0; const r = $('#ent-racha'); if (r) r.textContent = 0;
          abiertas.forEach((e) => flash(e, false));
          despues(950, () => { abiertas.forEach((e) => { e.classList.remove('vuelta', 'ent-mal'); e.setAttribute('aria-label', 'Carta boca abajo'); }); abiertas = []; bloqueo = false; });
        }
      },
    };
    function terminar() {
      const ms = Date.now() - M.t0;
      const r = record(`match:${matchModo}`, ms, false);
      const estrellas = movs <= 8 ? 3 : movs <= 12 ? 2 : 1;
      if (estrellas === 3 || r.mejor) confeti();
      fin(j, M, { otra: () => emparejar(), resumen: `<p class="ent-estrellas" aria-label="${estrellas} estrellas">${'⭐'.repeat(estrellas)}${'☆'.repeat(3 - estrellas)}</p>
        <p>${movs} movimientos · ${r.mejor ? '🏆 ¡nuevo mejor tiempo!' : rec(`match:${matchModo}`) != null ? `mejor tiempo ${mmss(rec(`match:${matchModo}`))}` : ''}</p>
        <ul class="ent-pares">${pares.map(([a, b]) => `<li><b>${esc(a)}</b> ↔ ${esc(b)}</li>`).join('')}</ul>` });
    }
  }

  // =====================================================================
  // 5. CASO CLÍNICO (normal / alto / bajo)
  // =====================================================================
  // fuera: rangos que no son un valor de laboratorio/medición directa o que se prestan a confusión
  const NO_CASO = new Set(['talla', 'eritrocitosis-de-altura-hb', 'ldl', 'ascitis-deteccion-y-puncion', 'glucosa-2-h-ptog-75-g-y-hba1c']);
  const PARAMS_CASO = FILAS.filter((f) => !NO_CASO.has(f.id)).map((f) => ({ f, r: parseRango(f.normal?.t) })).filter((x) => x.r);
  const NOMBRES = { a: ['Rosa', 'Carmen', 'Ana', 'Elena', 'Lucía', 'Teresa'], o: ['Juan', 'Luis', 'Pedro', 'Mario', 'Jorge', 'Raúl'] };
  const MOTIVOS = ['control de rutina', 'fatiga y malestar general de 2 semanas', 'fiebre de 3 días', 'dolor abdominal difuso',
    'disnea de esfuerzo', 'cefalea y mareos', 'pérdida de peso no intencionada', 'chequeo preoperatorio', 'edema de miembros inferiores', 'orina oscura'];
  const ESTADOS = { normal: ['✅', 'Normal'], alto: ['🔺', 'Alto'], bajo: ['🔻', 'Bajo'] };
  const posibles = (r) => (r.tipo === 'max' ? ['normal', 'alto'] : r.tipo === 'min' ? ['normal', 'bajo'] : r.lo > 0 ? ['normal', 'alto', 'bajo'] : ['normal', 'alto']);

  function caso(lista) {
    limpiar(); activo = 'caso';
    const j = juego('caso');
    if (PARAMS_CASO.length < 6) { raiz.innerHTML = `<div class="ent-juego">${cabecera(j, nuevoMarcador(0))}<p class="fin">No hay suficientes parámetros con rango numérico.</p></div>`; acc = { menu }; return; }
    // 1-2 secciones protagonistas + relleno, 6-8 valores
    const n = 6 + Math.floor(Math.random() * 3);
    let elegidos;
    if (lista?.length) elegidos = [...lista, ...azar(PARAMS_CASO.filter((p) => !lista.includes(p)))].slice(0, Math.max(n, lista.length));
    else {
      const porSec = azar(SECC.filter((s) => PARAMS_CASO.filter((p) => p.f.sec.id === s.id).length >= 3));
      const prot = porSec.slice(0, 2).map((s) => s.id);
      const a = azar(PARAMS_CASO.filter((p) => prot.includes(p.f.sec.id))).slice(0, n - 2);
      elegidos = [...a, ...azar(PARAMS_CASO.filter((p) => !a.includes(p)))].slice(0, n);
    }
    // ~40 % normales, el resto alterados
    const filas = elegidos.map((p) => {
      const pos = posibles(p.r);
      const est = Math.random() < 0.4 ? 'normal' : uno(pos.filter((e) => e !== 'normal'));
      const g = generarValor(p.r, est) || generarValor(p.r, 'normal');
      return g ? { ...p, ...g } : null;
    }).filter(Boolean);
    filas.sort((a, b) => SECC.indexOf(a.f.sec) - SECC.indexOf(b.f.sec));
    const M = nuevoMarcador(filas.length);
    const sexo = Math.random() < 0.5 ? ['Paciente mujer', 'a'] : ['Paciente varón', 'o'];
    const marcas = {};
    raiz.innerHTML = `<div class="ent-juego ent-in">${cabecera(j, M)}
      <div class="ent-tarjeta ent-hc">
        <div class="ent-hc-cab"><span class="ent-hc-ic" aria-hidden="true">📄</span><div>
          <b>${esc(uno(NOMBRES[sexo[1]]))}, ${20 + Math.floor(Math.random() * 60)} años</b>
          <p>${sexo[0]} que acude por ${esc(uno(MOTIVOS))}. Se solicitan exámenes y se registran signos vitales.</p></div></div>
        <p class="ent-sub">Marca cada resultado. Referencias del atlas (nivel del mar). Los valores se generan al azar: es práctica de lectura, no un caso real.</p>
        <div class="ent-hc-lista">${filas.map((x, k) => `<div class="ent-hc-fila" id="ent-hc-${k}">
          <div class="ent-hc-dato"><span>${esc(x.f.icono || '')} ${esc(x.f.nombre)}</span><b>${esc(x.txt)} ${esc(x.r.u)}</b></div>
          <div class="ent-hc-bot" role="group" aria-label="Interpretar ${esc(x.f.nombre)}">${Object.entries(ESTADOS).map(([e, [ic, t]]) =>
            `<button class="ent-tri ent-tri-${e}" data-acc="marca" data-k="${k}" data-e="${e}" aria-label="${t}">${ic}<small>${t}</small></button>`).join('')}</div>
          <div class="ent-hc-fb"></div></div>`).join('')}</div>
        <div class="ent-btns"><button class="ent-b pri" data-acc="corregir" disabled id="ent-corregir">Corregir (0/${filas.length})</button></div>
      </div></div>`;
    relojSubida(M);
    acc = {
      menu,
      marca: (b) => {
        const k = b.dataset.k; marcas[k] = b.dataset.e;
        raiz.querySelectorAll(`[data-acc="marca"][data-k="${k}"]`).forEach((x) => x.classList.toggle('on', x === b));
        const c = $('#ent-corregir'); const nm = Object.keys(marcas).length;
        c.textContent = `Corregir (${nm}/${filas.length})`; c.disabled = nm < filas.length;
      },
      corregir: () => {
        raiz.querySelectorAll('[data-acc="marca"]').forEach((x) => { x.disabled = true; });
        $('#ent-corregir').remove();
        filas.forEach((x, k) => {
          const ok = marcas[k] === x.estado;
          const el = $(`#ent-hc-${k}`);
          el.classList.add(ok ? 'si' : 'no'); flash(el, ok);
          anotar(M, ok, ok ? null : { item: x, html: `${esc(x.f.nombre)} ${esc(x.txt)} ${esc(x.r.u)} → <b>${ESTADOS[x.estado][1].toLowerCase()}</b> (normal: ${esc(corto(x.f.normal.t))})` });
          srsEnt(`clin:${x.f.id}`, ok);
          if (!ok) srsFallo(x.f.id);
          const extra = x.estado === 'alto' ? x.f.sube?.t : x.estado === 'bajo' ? x.f.baja?.t : '';
          el.querySelector('.ent-hc-fb').innerHTML = `${ok ? '✅' : `❌ Era <b>${ESTADOS[x.estado][1].toLowerCase()}</b>.`} Normal: ${esc(corto(x.f.normal.t, 110))}
            ${valido(extra) ? `<br>${x.estado === 'alto' ? '🔺' : '🔻'} ${esc(corto(extra, 140))}` : ''}${pistaMemo(MEMO[x.f.id]) ? `<br><span class="ent-memo">${pistaMemo(MEMO[x.f.id])}</span>` : ''}`;
        });
        if (M.ok) xp(M.ok * 2, 'caso clínico');
        const errores = filas.filter((x, k) => marcas[k] !== x.estado);
        raiz.querySelector('.ent-hc').insertAdjacentHTML('beforeend', `<div class="ent-feedback ${M.ok === M.total ? 'si' : 'no'} ent-pop">
          <b>${M.ok}/${M.total}</b> bien interpretados.
          <div class="ent-btns">${errores.length ? `<button class="ent-b pri" data-acc="errores">🔁 Nuevo caso con mis errores</button>` : ''}
          <button class="ent-b ${errores.length ? '' : 'pri'}" data-acc="sig">🩺 Otro caso</button><button class="ent-b" data-acc="menu">🏠 Juegos</button></div></div>`);
        limpiar();
        record('racha:caso', M.mejor); contarJugada('caso');
        guardarHist('caso', Math.round(100 * M.ok / M.total), M.total);
        if (M.ok === M.total) { confeti(); xp(10, 'caso perfecto'); }
        acc.errores = () => caso(errores.map((x) => PARAMS_CASO.find((p) => p.f.id === x.f.id)));
        acc.sig = () => caso();
      },
    };
  }

  const JUEGOS_FN = { mayor, siglas: () => siglas(), reloj, match: emparejar, caso: () => caso(), facies: () => facies(), orden: () => orden() };

  return {
    pintar() { if (!activo || !raiz.querySelector('.ent-juego')) menu(); },
    menu,
  };
}
