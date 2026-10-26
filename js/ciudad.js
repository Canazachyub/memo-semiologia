// Ciudad-palacio de Puno: lista del paseo + paseo de memoria (recuerdo activo por estaciones).
// Skill estudio-palacio-memoria: adelante y al revés (#195, #190), ir directo a cualquier estación (#148),
// repaso activo con semáforo (#134, #073), palacio vacío (#195), 5 estaciones por tramo y numeración continua (#073, #139),
// espaciado al día, a la semana y al mes (#190, #148): cada lugar es la tarjeta srs `pal:${sid}`.
// Eventos: window.dispatchEvent(new CustomEvent('memo:palacio', { detail: { sid, modo } })) abre un lugar
// (modo opcional: 'adelante' | 'reves' | 'azar' | 'vacio' arranca el paseo).
import { esc, haptico } from './util.js';
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

  // foto del lugar (img/lugares/<sid>.webp); si no existe, queda el emoji de debajo
  const foto = (sid, cls = 'cd-foto', carga = 'lazy') => `<span class="${cls}" aria-hidden="true"><span class="cd-foto-ic">${PALACIOS.lugares[sid]?.icono || '📍'}</span>
    <img src="img/lugares/${esc(sid)}.webp" alt="" loading="${carga}" decoding="async" onerror="this.remove()"></span>`;
  // estado de cada parada: 'toca' (vence hoy) · 'ok' (al día) · 'nuevo' (sin pasear)
  const estadoPal = (sid) => (!infoPal(sid) ? 'nuevo' : vencePal(sid) ? 'toca' : 'ok');

  function mapa() {
    const orden = PALACIOS.orden_paseo;
    const st = leer();
    const tocan = orden.filter(vencePal);
    const paseados = orden.filter((sid) => infoPal(sid) || st.ultimo?.[sid]).length;
    const pcts = orden.map((sid) => st.ultimo?.[sid]?.pct).filter((x) => x != null);
    const media = pcts.length ? Math.round(pcts.reduce((x, y) => x + y, 0) / pcts.length) : null;
    const sig = tocan[0] || orden.find((sid) => estadoPal(sid) === 'nuevo' && !st.ultimo?.[sid]) || null;
    const porque = !sig ? '' : tocan.includes(sig) ? 'Toca repasarlo hoy' : st.vacio?.[sig] ? 'Ya recorriste el lugar vacío: carga los datos' : 'Aún no lo paseas: empieza por el recorrido vacío';
    const pctRuta = Math.round(100 * paseados / Math.max(1, orden.length));
    raiz.innerHTML = `<header class="cd-cab ds-entra"><h2 class="ds-titulo">Ciudad-palacio</h2>
        <p class="ds-sub">Tu atlas es un paseo por <b>${esc(PALACIOS.ciudad)}</b>: ${orden.length} lugares y ${TOTAL} estaciones numeradas de corrido. En cada parada, ¿qué dato está y cuál es su valor?</p></header>
      <div class="cd-resumen ds-entra" style="--i:1">
        <div class="cd-anillo" style="--p:${pctRuta}" role="img" aria-label="${paseados} de ${orden.length} lugares paseados"><b>${paseados}<small>/${orden.length}</small></b></div>
        <div class="cd-res-tx"><b>${paseados ? `${paseados} lugar${paseados === 1 ? '' : 'es'} paseado${paseados === 1 ? '' : 's'}` : 'Empieza tu primer paseo'}</b>
          <span>${tocan.length ? `🏛️ ${tocan.length} para repasar hoy` : paseados ? '✅ Nada vence hoy' : 'Cada lugar se programa al terminarlo'}${media != null ? ` · ${media}% 🟢 de media` : ''}</span></div>
      </div>
      ${sig ? `<button class="cd-siguiente ds-entra" style="--i:2" data-lugar="${sig}">${foto(sig, 'cd-sig-foto', 'eager')}
        <span class="cd-sig-tx"><small>${tocan.includes(sig) ? 'Hoy toca' : 'Siguiente parada'} · ${orden.indexOf(sig) + 1} de ${orden.length}</small>
          <b>${PALACIOS.lugares[sig].icono} ${esc(PALACIOS.lugares[sig].lugar)}</b><span>${esc(porque)}</span></span><span class="cd-sig-play" aria-hidden="true">▶</span></button>` : ''}
      ${tocan.length > 1 ? `<div class="cd-hoy"><b>🏛️ Hoy toca pasear (${tocan.length}):</b> ${tocan.map((sid) => `<button class="chip" data-lugar="${sid}">${PALACIOS.lugares[sid].icono} ${esc(PALACIOS.lugares[sid].lugar)}</button>`).join(' ')}</div>` : ''}
      <h3 class="cd-h">La ruta</h3>
      <ol class="cd-ruta" aria-label="Paradas del paseo, en orden">${orden.map((sid, i) => {
        const L = PALACIOS.lugares[sid]; const est = estaciones(sid); const con = est.filter((e) => e.m).length;
        const e = estadoPal(sid); const ult = st.ultimo?.[sid]; const hecho = e !== 'nuevo' || !!ult;
        return `<li class="cd-stop ${hecho ? 'hecho' : ''} ${e} ds-entra" style="--i:${Math.min(i + 3, 14)}">
          <span class="cd-nodo" aria-hidden="true">${hecho && e !== 'toca' ? '✓' : i + 1}</span>
          <button class="cd-parada" data-lugar="${sid}" aria-label="Parada ${i + 1}: ${esc(L.lugar)}">${foto(sid)}
            <span class="cd-pt"><b>${esc(L.lugar)}</b><small>${esc(titulo(sid))} · #${glob(sid, 0)}–#${glob(sid, est.length - 1)} · 🧠 ${con}</small>
              <span class="cd-prog" aria-hidden="true"><i style="width:${ult ? ult.pct : 0}%"></i></span>
              <span class="cd-pie">${chipPal(sid)}${ult ? `<span class="cd-pct">${ult.pct}% 🟢</span>` : ''}</span></span></button></li>`;
      }).join('')}</ol>
      ${PALACIOS._nota ? `<p class="porque cd-nota"><i>${esc(PALACIOS._nota)}</i></p>` : ''}`;
  }

  function lugar(sid) {
    const L = PALACIOS.lugares[sid]; const est = estaciones(sid); const st = leer();
    const vacio = st.vacio?.[sid]; const ult = st.ultimo?.[sid];
    const tramos = [];
    for (let t = 0; t * TRAMO < est.length; t++) tramos.push(est.slice(t * TRAMO, t * TRAMO + TRAMO));
    const orden = PALACIOS.orden_paseo; const iL = orden.indexOf(sid);
    const ant = orden[iL - 1], sigL = orden[iL + 1];
    raiz.innerHTML = `<div class="rep-top cd-top"><button class="btn" data-volver>← La ruta</button>
        <span class="cd-flechas">${ant ? `<button class="btn" data-lugar="${ant}" aria-label="Parada anterior: ${esc(PALACIOS.lugares[ant].lugar)}">‹</button>` : ''}${sigL ? `<button class="btn" data-lugar="${sigL}" aria-label="Parada siguiente: ${esc(PALACIOS.lugares[sigL].lugar)}">›</button>` : ''}</span></div>
      <header class="cd-hero ds-entra">${foto(sid, 'cd-hero-foto', 'eager')}
        <div class="cd-hero-tx"><span class="cd-hero-n">Parada ${iL + 1} de ${orden.length} · ${est.length} estaciones</span>
          <h2 class="lugar-t">${L.icono} ${esc(L.lugar)}</h2><p>${esc(titulo(sid))}</p></div></header>
      <p class="porque">${esc(L.porque)}</p>
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
    raiz.innerHTML = `<div class="cd-barra" role="progressbar" aria-label="Avance del paseo" aria-valuemin="0" aria-valuemax="${paseo.orden.length}" aria-valuenow="${paseo.i}"><i style="width:${pct}%"></i></div>
      <div class="tarjeta cd-tarjeta ${paseo.revelado ? 'revelada' : 'ds-entra'}">
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
    haptico(nota === 'v' ? 'bien' : nota === 'r' ? 'mal' : 'toque');
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
    haptico(pct >= 90 ? 'logro' : 'bien');
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
    paseo.resumen = `<div class="fin cd-fin ds-entra">${foto(sid, 'cd-fin-foto', 'eager')}<b>${pct >= 90 ? '🏆' : pct >= 60 ? '🙂' : '💪'}</b>
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
        <button class="btn" data-lugar="${sid}">Ver el lugar</button><button class="btn" data-volver>La ruta</button>
        ${sig ? `<button class="btn" data-lugar="${sig}">Seguir a ${PALACIOS.lugares[sig].icono} ${esc(PALACIOS.lugares[sig].lugar)} →</button>` : ''}</div></div>`;
    paseo.fallidas = fallidas;
    raiz.innerHTML = paseo.resumen;
  }

  raiz.addEventListener('click', (ev) => {
    const t = ev.target.closest('button, a'); if (!t || !raiz.contains(t)) return;
    if (t.dataset.lugar) { abierto = t.dataset.lugar; paseo = null; lugar(abierto); raiz.scrollIntoView?.({ block: 'start' }); }
    else if (t.hasAttribute('data-volver')) { abierto = null; paseo = null; mapa(); }
    else if (t.dataset.paseo) { abierto = t.dataset.paseo; empezar(t.dataset.paseo, t.dataset.modo || 'adelante'); }
    else if (t.hasAttribute('data-revelar')) { haptico('toque'); paseo.revelado = true; pasoPaseo(); }
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
