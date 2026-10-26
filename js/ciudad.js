// Ciudad-palacio de Puno: lista del paseo + paseo de memoria (recuerdo activo por estaciones).
// Skill estudio-palacio-memoria: adelante y al revés (#195, #190), ir directo a cualquier estación (#148),
// repaso activo con semáforo (#134, #073), palacio vacío (#195), 5 estaciones por tramo y numeración continua (#073, #139),
// espaciado al día, a la semana y al mes (#190, #148): cada lugar es la tarjeta srs `pal:${sid}`.
// Eventos: window.dispatchEvent(new CustomEvent('memo:palacio', { detail: { sid, modo } })) abre un lugar
// (modo opcional: 'adelante' | 'reves' | 'azar' | 'vacio' arranca el paseo).
import { esc } from './util.js';
import * as mias from './mias.js';

const CLAVE = 'memo-semio-ciudad';
const TRAMO = 5;
const DIA = 86400000;
const MODOS = {
  adelante: { ic: '🚶', t: 'Adelante' },
  reves: { ic: '🔙', t: 'Al revés' },
  azar: { ic: '🎲', t: 'Al azar' },
  vacio: { ic: '🧭', t: 'Solo el recorrido' },
};
const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; } };
const guardar = (e) => { try { localStorage.setItem(CLAVE, JSON.stringify(e)); } catch { /* modo privado */ } };
const hoyStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fechaCorta = (f) => (f ? f.split('-').reverse().slice(0, 2).join('/') : '');
const barajar = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const mia = (id) => { try { return mias.get(id) || null; } catch { return null; } };

export function crearCiudad({ ATLAS, MEMO, PALACIOS, srs, raiz }) {
  // CSS propio, sin tocar index.html
  try {
    const href = new URL('../css/ciudad.css', import.meta.url).href;
    if (![...document.querySelectorAll('link[rel="stylesheet"]')].some((l) => l.href === href)) {
      document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', href }));
    }
  } catch { /* sin CSS extra */ }

  // estaciones por lugar, en el orden del atlas
  const datosDe = (sid) => (sid === 'escalas'
    ? ATLAS.escalas.map((e) => ({ id: e.id, nombre: e.nombre, icono: e.icono || '📏', valor: (e.interpretacion || []).map((x) => `${x[0]} ${x[1]}`).join(' · ') }))
    : (ATLAS.secciones.find((s) => s.id === sid)?.filas || []).map((f) => ({ id: f.id, nombre: f.nombre, icono: f.icono, valor: f.normal?.t || '' })));
  const estaciones = (sid) => {
    const L = PALACIOS.lugares[sid];
    return datosDe(sid).map((d, n) => ({ ...d, n, ubicacion: MEMO[d.id]?.estacion?.ubicacion || L.ruta[n] || `Estación ${n + 1}`, m: MEMO[d.id] }));
  };
  const titulo = (sid) => (sid === 'escalas' ? '📏 Escalas clínicas' : ATLAS.secciones.find((s) => s.id === sid)?.titulo || sid);
  // C4: numeración continua en todo el paseo (s1 = 1-10, s2 = 11-17…)
  const OFFSET = {}; let TOTAL = 0;
  for (const sid of PALACIOS.orden_paseo || []) { OFFSET[sid] = TOTAL; TOTAL += datosDe(sid).length; }
  const glob = (sid, n) => (OFFSET[sid] || 0) + n + 1;

  // ---------- C2: el lugar como tarjeta srs `pal:${sid}` ----------
  const palId = (sid) => `pal:${sid}`;
  const infoPal = (sid) => { try { return srs?.info?.(palId(sid)) || null; } catch { return null; } };
  const vencePal = (sid) => { try { return !!infoPal(sid) && srs.vence(palId(sid)); } catch { return false; } };
  const enDias = (due) => { const d = Math.max(0, Math.ceil((due - Date.now()) / DIA)); return d <= 0 ? 'hoy' : d === 1 ? 'mañana' : `en ${d} días`; };
  function chipPal(sid) {
    const t = infoPal(sid);
    if (!t) return '<span class="cd-chip nuevo">🏛️ sin pasear</span>';
    if (vencePal(sid)) return '<span class="cd-chip toca">🏛️ toca repasar</span>';
    return `<span class="cd-chip ok">🏛️ próximo: ${enDias(t.due)}</span>`;
  }

  let abierto = null; // lugar abierto
  let paseo = null;   // { sid, modo, orden, i, revelado, ronda, notas, t0, pista, resumen }

  function mapa() {
    const orden = PALACIOS.orden_paseo;
    const tocan = orden.filter(vencePal);
    raiz.innerHTML = `<p class="porque">🗺️ Tu atlas es un paseo por <b>${esc(PALACIOS.ciudad)}</b>. Cada sección vive en un lugar real y cada dato en una estación del recorrido
      (${TOTAL} estaciones numeradas de corrido). Recorre el paseo con los ojos cerrados: en cada parada, ¿qué dato está y cuál es su valor? <i>${esc(PALACIOS._nota || '')}</i></p>
      ${tocan.length ? `<div class="cd-hoy"><b>🏛️ Hoy toca pasear (${tocan.length}):</b> ${tocan.map((sid) => `<button class="chip" data-lugar="${sid}">${PALACIOS.lugares[sid].icono} ${esc(PALACIOS.lugares[sid].lugar)}</button>`).join(' ')}</div>` : ''}
      <div class="paseo">${orden.map((sid, i) => {
        const L = PALACIOS.lugares[sid]; const est = estaciones(sid); const con = est.filter((e) => e.m).length;
        return `<button class="parada" data-lugar="${sid}"><span class="pn">${i + 1}</span><span class="pi">${L.icono}</span>
          <span class="pt"><b>${esc(L.lugar)}</b><small>${esc(titulo(sid))} · estaciones #${glob(sid, 0)}–#${glob(sid, est.length - 1)} · 🧠 ${con}</small>${chipPal(sid)}</span></button>`;
      }).join('<div class="tramo"></div>')}</div>`;
  }

  function lugar(sid) {
    const L = PALACIOS.lugares[sid]; const est = estaciones(sid); const st = leer();
    const vacio = st.vacio?.[sid]; const ult = st.ultimo?.[sid];
    const tramos = [];
    for (let t = 0; t * TRAMO < est.length; t++) tramos.push(est.slice(t * TRAMO, t * TRAMO + TRAMO));
    raiz.innerHTML = `<div class="rep-top"><button class="btn" data-volver>← Mapa del paseo</button></div>
      <h2 class="lugar-t">${L.icono} ${esc(L.lugar)}</h2><p class="porque">${esc(titulo(sid))} — ${esc(L.porque)}</p>
      <div class="cd-estado">${chipPal(sid)}
        ${ult ? `<span class="cd-chip">último paseo ${fechaCorta(ult.fecha)} · ${ult.pct}% 🟢</span>` : ''}
        ${vacio ? `<span class="cd-chip">🧭 recorrido vacío ${fechaCorta(vacio)}</span>` : ''}
        <span class="cd-chip">#${glob(sid, 0)}–#${glob(sid, est.length - 1)} del paseo</span></div>
      ${vacio ? '' : `<div class="cd-reco">🧭 <b>Primera vez en este lugar:</b> recorre antes el palacio <b>vacío</b>, ubicación por ubicación, hasta que salga solo.
        Si tienes que memorizar las ubicaciones, todavía no es un palacio. <button class="btn pri" data-paseo="${sid}" data-modo="vacio">🧭 Solo el recorrido</button></div>`}
      <div class="cd-modos" role="group" aria-label="Paseo de memoria">${Object.entries(MODOS).map(([k, m]) =>
        `<button class="btn ${k === 'adelante' ? 'pri' : ''}" data-paseo="${sid}" data-modo="${k}">${m.ic} ${m.t}</button>`).join('')}</div>
      <p class="cd-ayuda">Aparta la vista, llega a cada estación, di el dato y su valor, y solo entonces revela. Califícate con honestidad 🔴 🟡 🟢:
        al terminar, el lugar se programa para su próximo repaso (1, 3, 7, 15 días…). Después de ir adelante, ve <b>al revés</b>: refuerza más.</p>
      ${tramos.map((tr, t) => `<h3 class="cd-tramo">Tramo ${t + 1} · estaciones ${t * TRAMO + 1}–${t * TRAMO + tr.length}
          <small>· #${glob(sid, t * TRAMO)}–#${glob(sid, t * TRAMO + tr.length - 1)} del paseo</small></h3>
        <ol class="estaciones" style="counter-reset: e ${t * TRAMO}">${tr.map((e) => {
          const an = mia(e.id)?.ancla || e.m?.ancla;
          return `<li>
          ${e.m?.imagen ? `<img src="${esc(e.m.imagen)}" alt="${esc(an || e.nombre)}" loading="lazy" decoding="async" data-zoom>` : `<span class="ph">${e.icono}</span>`}
          <div><span class="ub">📍 ${esc(e.ubicacion)} <span class="cd-glob">#${glob(sid, e.n)}</span></span><b>${e.icono} ${esc(e.nombre)}</b>
          ${an ? `<span class="an">⚓ ${esc(an)}</span>` : ''}
          <a href="#p-${e.id}" data-ir="${e.id}" class="link">ver ficha</a></div></li>`;
        }).join('')}</ol>`).join('')}`;
  }

  // ---------- paseo ----------
  function empezar(sid, modo, indices = null, ronda = 1) {
    const n = estaciones(sid).length;
    const base = indices ? [...indices] : Array.from({ length: n }, (_, k) => k);
    const orden = modo === 'reves' ? base.sort((a, b) => b - a) : modo === 'azar' ? barajar(base) : base.sort((a, b) => a - b);
    paseo = { sid, modo, orden, i: 0, revelado: false, ronda, notas: {}, t0: Date.now(), pista: false, resumen: null, completo: !indices };
    pasoPaseo();
    raiz.scrollIntoView?.({ block: 'start' });
  }

  function pasoPaseo() {
    if (paseo.i >= paseo.orden.length) { finPaseo(); return; }
    const est = estaciones(paseo.sid); const L = PALACIOS.lugares[paseo.sid];
    const e = est[paseo.orden[paseo.i]];
    const vacio = paseo.modo === 'vacio';
    const local = e.n + 1, tramo = Math.floor(e.n / TRAMO) + 1;
    const mv = mia(e.id);
    const ancla = mv?.ancla || e.m?.ancla;
    const previa = vacio && paseo.i > 0 && paseo.orden[paseo.i - 1] === e.n - 1 ? est[e.n - 1] : null;
    let q, ayuda;
    if (vacio) { q = `🧭 Estación ${local} → ?`; ayuda = previa ? `Vienes de: <b>${esc(previa.ubicacion)}</b>. ¿Qué ubicación sigue? Dila antes de revelar.` : '¿Qué ubicación es? Dila antes de revelar: solo el lugar, sin el dato.'; }
    else if (paseo.modo === 'azar') { q = `📍 Estación ${local} (${esc(e.ubicacion)}): ¿qué hay?`; ayuda = 'Ve directo a esta estación sin pasar por las anteriores: ¿qué imagen ves, qué dato es y cuál es su valor?'; }
    else { q = `📍 ${esc(e.ubicacion)}`; ayuda = 'Cierra los ojos y llega a este punto: ¿qué ves aquí, qué dato representa y cuál es su valor?'; }
    const sem = vacio
      ? `<div class="cd-sem" role="group" aria-label="¿Te salió?"><button class="btn cd-r" data-nota="r">🔴 No salió <kbd>1</kbd></button><button class="btn cd-v" data-nota="v">🟢 La tenía <kbd>3</kbd></button></div>`
      : `<div class="cd-sem" role="group" aria-label="Califícate"><button class="btn cd-r" data-nota="r">🔴 No la recordé <kbd>1</kbd></button>
          <button class="btn cd-a" data-nota="a">🟡 Con dudas <kbd>2</kbd></button><button class="btn cd-v" data-nota="v">🟢 La tenía <kbd>3</kbd></button></div>`;
    const pct = (100 * paseo.i / paseo.orden.length).toFixed(1);
    raiz.innerHTML = `<div class="cd-barra" aria-hidden="true"><i style="width:${pct}%"></i></div>
      <div class="tarjeta ${paseo.revelado ? 'revelada' : ''}">
      <div class="meta"><span>${L.icono} ${esc(L.lugar)} · ${MODOS[paseo.modo].ic} ${MODOS[paseo.modo].t}${paseo.ronda > 1 ? ` · 🔁 ronda ${paseo.ronda}` : ''}</span><span>${paseo.i + 1} / ${paseo.orden.length}</span></div>
      <p class="cd-num">Tramo ${tramo} · estación ${local} · <b>#${glob(paseo.sid, e.n)} del paseo</b></p>
      <div class="q">${q}</div>
      <p class="porque">${ayuda}</p>
      ${paseo.revelado ? '' : `<div class="btns"><button class="btn pri" data-revelar>Revelar (espacio)</button>
        ${!vacio && paseo.ronda > 1 && ancla && !paseo.pista ? '<button class="btn" data-pista>💡 Pista: el ancla (P)</button>' : ''}</div>
        ${paseo.pista && ancla ? `<div class="pista">⚓ ${mv?.ancla ? '<small>(tu ancla)</small> ' : ''}${esc(ancla)}</div>` : ''}`}
      ${paseo.revelado ? `<div class="a">${vacio
        ? `<div class="resp">📍 ${esc(e.ubicacion)}</div><p class="cd-mute">Aquí guardas: ${e.icono} ${esc(e.nombre)}</p>`
        : `${e.m?.imagen ? `<img decoding="async" src="${esc(e.m.imagen)}" alt="${esc(ancla || e.nombre)}" class="cd-img" data-zoom>` : ''}
          <div class="resp">${e.icono} ${esc(e.nombre)}</div><p>${esc(e.valor)}</p>
          ${ancla ? `<div class="pista">⚓ ${esc(ancla)}</div>` : ''}
          ${mv?.escena ? `<div class="pista">🎬 <small>Tu escena:</small> ${esc(mv.escena)}</div>` : e.m?.escena ? `<div class="pista">🎬 ${esc(e.m.escena)}</div>` : ''}`}
        <p class="cd-mute">Sé honesto: ¿lo tenías antes de revelar?</p>${sem}</div>` : ''}</div>`;
  }

  function calificarEstacion(nota) {
    if (!paseo || !paseo.revelado || paseo.resumen) return;
    paseo.notas[paseo.orden[paseo.i]] = nota;
    paseo.i += 1; paseo.revelado = false; paseo.pista = false;
    pasoPaseo();
  }

  function finPaseo() {
    if (paseo.resumen) { raiz.innerHTML = paseo.resumen; return; }
    const { sid, modo, ronda } = paseo;
    const L = PALACIOS.lugares[sid]; const est = estaciones(sid);
    const vals = paseo.orden.map((k) => paseo.notas[k]);
    const n = vals.length, v = vals.filter((x) => x === 'v').length, a = vals.filter((x) => x === 'a').length, r = vals.filter((x) => x === 'r').length;
    const pct = n ? Math.round(100 * v / n) : 0;
    const fallidas = paseo.orden.filter((k) => paseo.notas[k] !== 'v').sort((x, y) => x - y);
    const vacio = modo === 'vacio';
    const st = leer();
    let srsTxt = '';
    if (vacio) {
      st.vacio = { ...(st.vacio || {}), [sid]: hoyStr() }; guardar(st);
      srsTxt = '<p class="cd-mute">🧭 Recorrido vacío registrado. Cuando salga solo, carga los datos: <b>🚶 Adelante</b>.</p>';
    } else if (ronda === 1 && paseo.completo) {
      // C2: la primera vuelta completa califica el lugar como una tarjeta de palacio
      const nota = pct >= 90 ? 3 : pct >= 60 ? 2 : 1;
      let res = null;
      try { res = srs?.calificar?.(palId(sid), nota, { fuente: 'palacio' }); } catch { res = null; }
      st.ultimo = { ...(st.ultimo || {}), [sid]: { fecha: hoyStr(), pct, modo } }; guardar(st);
      const t = infoPal(sid);
      srsTxt = `<p class="cd-srs">🏛️ Palacio calificado <b>${nota === 3 ? '🟢 Bien' : nota === 2 ? '🟡 Difícil' : '🔴 Otra vez'}</b>
        ${res && res.movido === false ? '· ya lo habías pasado hoy: el calendario no se movió.' : t?.due ? `· próximo repaso: <b>${enDias(t.due)}</b>.` : ''}</p>`;
    }
    const sig = PALACIOS.orden_paseo[PALACIOS.orden_paseo.indexOf(sid) + 1];
    const lista = fallidas.map((k) => est[k]);
    paseo.resumen = `<div class="fin cd-fin"><b>${pct >= 90 ? '🏆' : pct >= 60 ? '🙂' : '💪'}</b>
      <h3>${vacio ? 'Recorriste' : 'Terminaste'} ${L.icono} ${esc(L.lugar)} · ${MODOS[modo].ic} ${MODOS[modo].t}${ronda > 1 ? ` · ronda ${ronda}` : ''}</h3>
      <div class="cd-kpis"><span>🟢 <b>${v}</b></span>${vacio ? '' : `<span>🟡 <b>${a}</b></span>`}<span>🔴 <b>${r}</b></span>
        <span><b>${pct}%</b> ${ronda > 1 ? 'en esta ronda' : 'retención'}</span><span>⏱ ${mmss(Date.now() - paseo.t0)}</span></div>
      ${srsTxt}
      ${lista.length ? `<details class="cd-fallidas" open><summary>${vacio ? 'Ubicaciones que no salieron' : 'Estaciones para reforzar'} (${lista.length})</summary><ul>${lista.map((e) =>
        `<li><span>#${glob(sid, e.n)} 📍 ${esc(e.ubicacion)}${vacio ? '' : ` → ${e.icono} ${esc(e.nombre)}`}</span>
          ${vacio ? '' : `<a href="#p-${e.id}" data-ir="${e.id}" class="link">✏️ Mejorar escena</a>`}</li>`).join('')}</ul>
        ${vacio ? '' : '<p class="cd-mute">Si una imagen falla, arréglala: hazla más exagerada, con movimiento y sentidos, o crea la tuya (✏️ Mi versión en la ficha).</p>'}</details>` : ''}
      <div class="btns" style="justify-content:center">
        ${lista.length ? `<button class="btn pri" data-repetir>🔁 Repetir solo las fallidas (${lista.length})</button>` : ''}
        ${!lista.length && modo === 'adelante' ? `<button class="btn pri" data-paseo="${sid}" data-modo="reves">🔙 Ahora al revés</button>` : ''}
        ${!lista.length && vacio ? `<button class="btn pri" data-paseo="${sid}" data-modo="adelante">🚶 Cargar los datos: adelante</button>` : ''}
        <button class="btn" data-lugar="${sid}">Ver el lugar</button><button class="btn" data-volver>Mapa</button>
        ${sig ? `<button class="btn" data-lugar="${sig}">Seguir a ${PALACIOS.lugares[sig].icono} ${esc(PALACIOS.lugares[sig].lugar)} →</button>` : ''}</div></div>`;
    paseo.fallidas = fallidas;
    raiz.innerHTML = paseo.resumen;
  }

  raiz.addEventListener('click', (ev) => {
    const t = ev.target.closest('button, a'); if (!t || !raiz.contains(t)) return;
    if (t.dataset.lugar) { abierto = t.dataset.lugar; paseo = null; lugar(abierto); }
    else if (t.hasAttribute('data-volver')) { abierto = null; paseo = null; mapa(); }
    else if (t.dataset.paseo) { abierto = t.dataset.paseo; empezar(t.dataset.paseo, t.dataset.modo || 'adelante'); }
    else if (t.hasAttribute('data-revelar')) { paseo.revelado = true; pasoPaseo(); }
    else if (t.hasAttribute('data-pista')) { paseo.pista = true; pasoPaseo(); }
    else if (t.dataset.nota) calificarEstacion(t.dataset.nota);
    else if (t.hasAttribute('data-repetir') && paseo?.fallidas?.length) empezar(paseo.sid, paseo.modo, paseo.fallidas, paseo.ronda + 1);
  });
  document.addEventListener('keydown', (ev) => {
    if (!paseo || paseo.resumen || !raiz.closest('.vista.on')) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.target.matches?.('input, textarea, select')) return;
    if (ev.key === ' ' && !paseo.revelado) { ev.preventDefault(); paseo.revelado = true; pasoPaseo(); }
    else if ((ev.key === 'p' || ev.key === 'P') && !paseo.revelado && raiz.querySelector('[data-pista]')) { paseo.pista = true; pasoPaseo(); }
    else if (paseo.revelado && ['1', '2', '3'].includes(ev.key)) {
      const nota = { 1: 'r', 2: 'a', 3: 'v' }[ev.key];
      if (raiz.querySelector(`[data-nota="${nota}"]`)) { ev.preventDefault(); calificarEstacion(nota); }
    }
  });
  // abrir un lugar (o arrancar su paseo) desde otras vistas: Hoy, Juego…
  window.addEventListener('memo:palacio', (e) => {
    const { sid, modo } = e.detail || {};
    if (!PALACIOS.lugares?.[sid]) return;
    abierto = sid; paseo = null;
    if (modo && MODOS[modo]) empezar(sid, modo); else lugar(sid);
  });

  return { pintar: () => (paseo ? pasoPaseo() : abierto ? lugar(abierto) : mapa()) };
}
