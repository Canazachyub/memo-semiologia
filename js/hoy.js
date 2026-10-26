// Vista "🏠 Hoy": sesión de estudio guiada (S1) + bloques con descanso (S2) + plan de examen (E1, E3). Dueño: paquete A.
// Ciclo del skill estudio-recuerdo-activo (#039): comprender → codificar → examinarte → semáforo → rondas → espaciar.
// - Repaso intermitente y autoexamen del día tras un descanso (#058, #063, #056); repaso al final del día (#035).
// - Bloques con repaso al cierre (#057, #190, #128). Duraciones 25/5 y 50/10 son [complemento]; 60/10 sale de #057.
// Diseño v2: héroe (saludo, anillo del día, racha, nivel y botón "Continuar") + pasos como línea de tiempo
// (hecho / ahora / pendiente / al día), deslizar a la derecha para marcar y celebración al completar el día.
import { $, $$, esc, haptico } from './util.js';
import * as plan from './plan.js';
import * as ajustes from './ajustes.js';
import { racha, nivel } from './juego-estado.js';

const CLAVE_HOY = 'memo-semio-hoy';        // { dia, hechos: { paso: true }, avisos: bool }
const CLAVE_BLOQUE = 'memo-semio-bloque';  // { fase: 'estudio'|'descanso'|null, fin, dur: '25/5' }
const REFS = 'memo-semio-bloque-refs';     // sessionStorage: fichas vistas en el bloque actual
const DURS = { '25/5': [25, 5], '50/10': [50, 10], '60/10': [60, 10] };
const DIAS_SEM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const leer = (k, v, st = localStorage) => { try { return JSON.parse(st.getItem(k)) ?? v; } catch { return v; } };
const escribir = (k, v, st = localStorage) => { try { st.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const irVista = (vista) => window.dispatchEvent(new CustomEvent('memo:vista', { detail: { vista } }));
const repasar = (detail) => { window.dispatchEvent(new CustomEvent('memo:repaso', { detail })); irVista('repaso'); };

/** S2: registra una ficha vista durante el bloque (la usan repaso.js y los clics en 🧠). */
export function registrarVista(ref) {
  if (!ref) return;
  const l = leer(REFS, [], sessionStorage);
  if (!l.includes(ref)) { l.push(ref); escribir(REFS, l.slice(-60), sessionStorage); }
}
const refsBloque = () => leer(REFS, [], sessionStorage);

// ---------- S2 · temporizador de bloques (flotante, persiste entre recargas) ----------
const bloque = {
  get() { return leer(CLAVE_BLOQUE, { fase: null, fin: 0, dur: ajustes.get('bloque') || '25/5' }); },
  set(b) { escribir(CLAVE_BLOQUE, b); pintarReloj(); },
  dur() { const b = this.get(); return DURS[b.dur] || DURS[ajustes.get('bloque')] || DURS['25/5']; },
  empezar(fase) {
    const b = this.get(); const [e, d] = this.dur();
    if (fase === 'estudio') escribir(REFS, [], sessionStorage);
    this.set({ ...b, fase, fin: Date.now() + (fase === 'estudio' ? e : d) * 60000, avisado: false });
  },
  parar() { this.set({ ...this.get(), fase: null, fin: 0 }); },
};
let chip = null, toast = null, tick = null;
function avisar(texto) {
  const h = leer(CLAVE_HOY, {});
  try { if (h.avisos && 'Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification('Memo Semiología', { body: texto }); } catch { /* sin notificaciones */ }
}
function mostrarToast(html) {
  toast?.remove();
  toast = Object.assign(document.createElement('div'), { className: 'hoy-toast', innerHTML: html });
  toast.setAttribute('role', 'status');
  document.body.appendChild(toast);
}
function pintarReloj() {
  const b = bloque.get();
  if (!b.fase) { chip?.remove(); chip = null; return; }
  if (!chip) {
    chip = Object.assign(document.createElement('button'), { className: 'hoy-reloj', type: 'button' });
    chip.addEventListener('click', () => irVista('hoy'));
    document.body.appendChild(chip);
  }
  const r = Math.max(0, Math.round((b.fin - Date.now()) / 1000));
  chip.classList.toggle('descanso', b.fase === 'descanso');
  chip.textContent = `${b.fase === 'estudio' ? '⏱' : '☕'} ${mmss(r)}`;
  chip.setAttribute('aria-label', `${b.fase === 'estudio' ? 'Bloque de estudio' : 'Descanso'}: quedan ${mmss(r)}. Abrir Hoy`);
  if (r <= 0 && !b.avisado) {
    escribir(CLAVE_BLOQUE, { ...b, avisado: true });
    if (b.fase === 'estudio') {
      const n = refsBloque().length;
      avisar('Terminó el bloque: haz el mini-repaso y descansa.');
      mostrarToast(`<b>⏱ Fin del bloque.</b> Repasa lo que viste antes de descansar.
        <div class="btns">${n ? `<button class="btn pri" data-t="mini">🔁 Mini-repaso (${n} fichas)</button>` : ''}<button class="btn" data-t="descanso">☕ Descanso de ${bloque.dur()[1]} min</button><button class="btn" data-t="cerrar" aria-label="Cerrar">✕</button></div>`);
    } else {
      avisar('Terminó el descanso.');
      mostrarToast(`<b>☕ Descanso terminado.</b><div class="btns"><button class="btn pri" data-t="estudio">▶ Nuevo bloque</button><button class="btn" data-t="parar">Terminar por hoy</button></div>`);
    }
  }
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('.hoy-toast [data-t]');
  if (t) {
    const a = t.dataset.t; toast?.remove(); toast = null;
    if (a === 'mini') { repasar({ modo: 'bloque', refs: refsBloque() }); bloque.empezar('descanso'); }
    else if (a === 'descanso') bloque.empezar('descanso');
    else if (a === 'estudio') bloque.empezar('estudio');
    else if (a === 'parar') bloque.parar();
    return;
  }
  const m = e.target.closest('[data-memo]');
  const f = m?.closest('.fila');
  if (f?.id?.startsWith('p-')) registrarVista(f.id.slice(2));
});
window.addEventListener('memo:ir', (e) => registrarVista(e.detail?.id));
function arrancarTick() { clearInterval(tick); tick = setInterval(pintarReloj, 1000); pintarReloj(); }
if (typeof document !== 'undefined') arrancarTick();

// ---------- vista ----------
export function crearHoy({ ATLAS, srs, tarjetas = [], raiz }) {
  const GRUPOS = [...ATLAS.secciones.map((s) => ({ id: s.id, t: `${s.icono} ${s.titulo.replace(/^\d+ · /, '')}` })),
    { id: 'escalas', t: '📏 Escalas' }, { id: 'siglas', t: '🔤 Siglas' }, { id: 'facies', t: '🙂 Facies' }];
  const nombre = (sid) => GRUPOS.find((g) => g.id === sid)?.t || sid;
  const conM = tarjetas.filter((t) => t.m);

  const estadoHoy = () => { const h = leer(CLAVE_HOY, {}); return h.dia === srs.hoy() ? h : { ...h, dia: srs.hoy(), hechos: {} }; };
  const marcar = (paso, v = true) => { const h = estadoHoy(); h.hechos = { ...h.hechos, [paso]: v }; escribir(CLAVE_HOY, h); };

  const safe = (fn) => { try { return fn() || 0; } catch { return 0; } };
  function cuentas() {
    const ahora = Date.now(), h = srs.hoy(), man = srs.inicioDia(2);
    let venc = 0, manana = 0, hoyCal = 0;
    for (const t of conM) {
      const i = srs.info(t.id); if (!i) continue;
      if (i.due <= ahora) venc++;
      else if (i.due < man) manana++;
      if (i.dia === h) hoyCal++;
    }
    return { venc, manana: manana + venc, hoyCal };
  }
  function nuevasEsperando(sid) { return tarjetas.filter((t) => t.sec === sid && t.m && !srs.info(t.id)).length; }
  function palaciosVencidos() {
    return ATLAS.secciones.map((s) => s.id).concat('escalas').filter((sid) => { const i = srs.info(`pal:${sid}`); return i && srs.vence(`pal:${sid}`); });
  }

  function abrirTema(sid, codificar = false) {
    if (['escalas', 'siglas', 'facies'].includes(sid)) return irVista(sid);
    irVista('tabla');
    setTimeout(() => {
      document.querySelector(`#filtro-sec [data-s="${sid}"]`)?.click();
      if (codificar) setTimeout(() => $$('#tabla .memo').forEach((m) => m.classList.add('on')), 60);
    }, 30);
  }

  // ---------- diseño v2 ----------
  let prevOff = null;             // posición previa del anillo (para animar desde ahí al repintar)
  let prevHechos = null;          // para celebrar solo al pasar de "faltan pasos" a "día completo"
  const abiertos = new Set();     // pasos hechos que el usuario desplegó
  const sinMov = () => document.documentElement.classList.contains('sin-mov') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function saludo() {
    const hr = new Date().getHours();
    return hr < 5 ? ['🌙', '¿Estudiando de madrugada?'] : hr < 12 ? ['☀️', 'Buenos días'] : hr < 19 ? ['🌤️', 'Buenas tardes'] : ['🌙', 'Buenas noches'];
  }
  function fiesta() {
    haptico('logro');
    window.dispatchEvent(new CustomEvent('memo:aviso', { detail: { texto: '🎉 ¡Completaste todos los pasos de hoy!', ms: 4000 } }));
    if (sinMov()) return;
    const cols = ['#7c3aed', '#a21caf', '#db2777', '#f59e0b', '#10b981', '#38bdf8'];
    const capa = Object.assign(document.createElement('div'), { className: 'hoy-confeti' });
    capa.setAttribute('aria-hidden', 'true');
    capa.innerHTML = Array.from({ length: 44 }, (_, i) => `<i style="--x:${(Math.random() * 100).toFixed(1)}vw;--dx:${Math.round((Math.random() - 0.5) * 180)}px;--r:${Math.round(Math.random() * 720 - 360)}deg;--d:${(Math.random() * 0.45).toFixed(2)}s;--t:${(1.7 + Math.random() * 1.1).toFixed(2)}s;background:${cols[i % cols.length]}"></i>`).join('');
    document.body.appendChild(capa);
    setTimeout(() => capa.remove(), 3600);
  }

  function pintar(animar = true) {
    const c = cuentas();
    const p = plan.cargar();
    const toca = plan.hoyToca();
    const h = estadoHoy().hechos || {};
    const temas = toca.fase === 'sin-plan' || toca.fase === 'pasado' ? (toca.siguiente ? [toca.siguiente] : []) : toca.pendientes;
    const estudiadasHoy = (toca.secciones || []).filter((s) => plan.estudiada(s));
    const diaSem = +(ajustes.get('diaSemanal') ?? p.diaSemanal ?? 0);
    const semanal = plan.esDiaSemanal(diaSem);
    const pal = palaciosVencidos();
    const b = bloque.get();
    const [dEst, dDes] = bloque.dur();
    const durSel = DURS[b.dur] ? b.dur : '25/5';

    // barra del plan (E1)
    let barra;
    if (p.examen && toca.fase !== 'pasado') {
      const fase = toca.emergencia ? '🚨 examen inminente' : toca.simulacro ? '🎯 fase de simulacro (20 %)' : 'fase de temario (80 %)';
      const te = toca.secciones.length ? ` · te ${toca.secciones.length > 1 ? 'tocan' : 'toca'}: ${toca.secciones.map((s) => esc(nombre(s))).join(' + ')}` : '';
      barra = `<div class="hoy-plan ds-entra" style="--i:1"><div class="hoy-plan-t"><b>📅 Día ${toca.dia} de ${toca.total}</b><span>${fase}${te}</span></div>
        <div class="rp-barra" role="img" aria-label="Avance del plan: día ${toca.dia} de ${toca.total}; la marca indica el 80 %"><i style="width:${(100 * toca.dia) / toca.total}%"></i><em style="left:80%" title="80 %"></em></div>
        <p class="vacio">Examen ${new Date(p.examen + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${toca.faltan === 0 ? 'hoy' : toca.faltan === 1 ? 'mañana' : `en ${toca.faltan} días`}</p></div>`;
    } else barra = `<div class="hoy-plan vacio ds-entra" style="--i:1">${p.examen ? '📅 Tu examen ya pasó. Fija una fecha nueva para planear.' : '🧭 Sin fecha de examen: avanzas tema por tema. Fija una fecha abajo para repartir el temario (80/20).'}</div>`;

    const cal = plan.calendario().filter((d) => d.secciones.length).slice(0, 10);
    const formPlan = `<details class="hoy-det"><summary>📅 Fecha de examen y calendario</summary>
      <div class="hoy-form"><label>Examen <input type="date" id="hoy-examen" value="${esc(p.examen || '')}" min="${srs.hoy()}"></label>
        <button class="btn pri" data-plan="guardar">Guardar</button>${p.examen ? '<button class="btn" data-plan="quitar">Quitar fecha</button>' : ''}
        <label>Repaso semanal <select id="hoy-dsem">${DIAS_SEM.map((d, i) => `<option value="${i}" ${i === diaSem ? 'selected' : ''}>${d}</option>`).join('')}</select></label></div>
      <p class="vacio">Regla 80/20: el temario se reparte en el primer 80 % del plazo y el último 20 % es para simulacros. Ningún repaso se programa después de la víspera. Con ≤ 14 días se usa la escalera corta 1-2-4-7.</p>
      ${cal.length ? `<ol class="hoy-cal">${cal.map((d) => `<li><b>${new Date(d.fecha + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</b> ${d.secciones.map((s) => esc(nombre(s))).join(' + ')}</li>`).join('')}</ol>` : ''}
    </details>`;

    const especiales = [];
    if (toca.emergencia) especiales.push(`<div class="hoy-esp urg"><p class="hoy-tit">🚨 Plan de emergencia</p><p>El examen es ${toca.faltan === 0 ? 'hoy' : 'mañana'}: no profundices todo. Repasa lo más preguntado y tus tarjetas para editar, en bloques con descanso y mini-repaso al cierre. Meta: <b>80 %</b>, no 100 % (#035, #057).</p>
      <div class="btns"><button class="btn pri" data-accion="emergencia">🚨 Empezar</button>${b.fase ? '' : '<button class="btn" data-bloque="60/10">⏱ Bloques 60/10</button>'}</div></div>`);
    if (toca.simulacro) especiales.push(`<div class="hoy-esp"><p class="hoy-tit">🎯 Fase de simulacro</p><p>Último 20 % del plazo: ya no entran tarjetas nuevas. Mídete en condiciones de examen.</p><button class="btn pri" data-accion="simulacro">🎯 Hacer simulacro</button></div>`);
    if (semanal) especiales.push(`<div class="hoy-esp"><p class="hoy-tit">📅 Hoy es tu día de repaso semanal</p><p>Sin contenido nuevo: repasa todo lo de los últimos 7 días (#015, #067).</p><button class="btn pri" data-accion="semanal">📅 Repaso semanal</button></div>`);

    // ---- pasos del día ----
    const temaPend = temas.find((sid) => !plan.estudiada(sid));
    const temaHTML = temas.length ? temas.map((sid) => {
      const est = plan.estudiada(sid), n = nuevasEsperando(sid);
      return `<div class="hoy-tema"><p class="hoy-tema-t"><b>${esc(nombre(sid))}</b> <span class="hoy-meta">${n} nuevas</span></p>
        <ol class="hoy-sub">
          <li><span class="hoy-sub-n" aria-hidden="true">a</span><button class="btn" data-tema="${sid}">💡 Comprender</button> <span class="vacio">valores, ¿por qué? y perlas</span></li>
          <li><span class="hoy-sub-n" aria-hidden="true">b</span><button class="btn" data-codificar="${sid}">🧠 Codificar</button> <button class="btn" data-ir="ciudad">🏙️ Paseo</button></li>
          <li><span class="hoy-sub-n" aria-hidden="true">c</span>${est ? '<span class="hoy-pill ok">✓ Estudiada</span>' : `<button class="btn pri" data-estudiada="${sid}">📖 Marcar estudiada y primer repaso</button>`}</li>
        </ol></div>`;
    }).join('') : '';

    const P = [
      {
        id: 'vencidas', icono: '🔁', ok: !!h.vencidas || c.venc === 0, libre: c.venc === 0,
        titulo: c.venc ? 'Repasos vencidos' : 'Repasos al día', meta: c.venc ? `${c.venc}` : '',
        resumen: c.venc === 0 ? `No queda nada vencido. Mañana te esperan ${c.manana}.` : `Marcado. Aún quedan ${c.venc} por repasar.`,
        cuerpo: `<p class="vacio">Primero lo que toca: rondas solo de errores hasta cero (máx. 3).</p>${c.venc ? `<button class="btn pri" data-accion="repaso">🔁 Repasar ${c.venc} ahora</button>` : ''}`,
        accion: c.venc ? { a: 'data-accion="repaso"', t: `🔁 Repasar ${c.venc} vencidas` } : null,
      },
      {
        id: 'tema', icono: '📖', ok: !!h.tema || temas.length === 0 || (temas.length > 0 && !temaPend && estudiadasHoy.length > 0), libre: temas.length === 0,
        titulo: temas.length ? `Tema nuevo: ${temas.map((s) => esc(nombre(s))).join(' + ')}` : 'Tema nuevo',
        resumen: temas.length ? (estudiadasHoy.length ? `Estudiaste hoy: ${estudiadasHoy.map((s) => esc(nombre(s))).join(' + ')}.` : 'Hecho por hoy.') : 'Sin tema nuevo hoy: temario completo o adelantado. 🎓',
        cuerpo: temaHTML,
        accion: temaPend ? { a: `data-tema="${temaPend}"`, t: `💡 Estudiar ${esc(nombre(temaPend))}` } : null,
      },
      {
        id: 'descanso', icono: '⏸', ok: !!h.descanso, titulo: 'Bloques con descanso', meta: b.fase ? (b.fase === 'estudio' ? 'en curso' : 'descanso') : '',
        resumen: b.fase ? `${b.fase === 'estudio' ? '⏱ Bloque en curso' : '☕ Descansando'} · ${refsBloque().length} fichas vistas.` : 'Hecho por hoy.',
        cuerpo: `<div class="hoy-form">${b.fase ? `<b>${b.fase === 'estudio' ? '⏱ Bloque en curso' : '☕ Descansando'}</b> <span class="vacio">${refsBloque().length} fichas vistas</span> <button class="btn" data-bloque="parar">⏹ Parar</button>`
            : `<div class="hoy-durs" role="group" aria-label="Duración del bloque">${Object.keys(DURS).map((k) => `<button class="btn ${k === durSel ? 'pri' : ''}" data-bloque="${k}">▶ ${k}</button>`).join('')}</div>`}
            <label class="toggle"><input type="checkbox" id="hoy-avisos" ${leer(CLAVE_HOY, {}).avisos ? 'checked' : ''}> <span>🔔 Avisarme</span></label></div>
           <p class="vacio">Estudio ${dEst} min → mini-repaso de lo visto → descanso ${dDes} min.</p>`,
        accion: b.fase ? null : { a: `data-bloque="${durSel}"`, t: `⏱ Empezar bloque de ${dEst} min` },
      },
      {
        id: 'autoexamen', icono: '🧪', ok: !!h.autoexamen, titulo: 'Autoexamen del día', meta: c.hoyCal ? `${c.hoyCal}` : '',
        resumen: 'Hecho por hoy.',
        cuerpo: `<p class="vacio">Tras un descanso: una sola ronda con lo de hoy, sin mover el calendario (#056).</p>${c.hoyCal
          ? `<button class="btn" data-accion="autoexamen">🧪 Autoexamen (${c.hoyCal})</button>` : '<p class="hoy-espera">🔒 Se activa cuando califiques tarjetas hoy.</p>'}`,
        accion: c.hoyCal ? { a: 'data-accion="autoexamen"', t: `🧪 Autoexamen de ${c.hoyCal} tarjetas` } : null,
      },
      {
        id: 'palacio', icono: '🏛️', ok: !!h.palacio || pal.length === 0, libre: pal.length === 0, titulo: pal.length ? 'Palacio que toca' : 'Palacios al día', meta: pal.length ? `${pal.length}` : '',
        resumen: pal.length ? 'Paseo hecho por hoy.' : 'Ningún palacio vence hoy.',
        cuerpo: pal.length ? `<p>${pal.map((s) => esc(nombre(s))).join(' · ')}</p><button class="btn" data-ir="ciudad">🏙️ Pasear (adelante y atrás)</button>` : '',
        accion: pal.length ? { a: 'data-ir="ciudad"', t: '🏛️ Pasear por el palacio' } : null,
      },
    ];
    const TOTAL = P.length;
    const hechos = P.filter((x) => x.ok).length;
    const completo = hechos === TOTAL;
    const actual = P.findIndex((x) => !x.ok);

    // botón principal: el siguiente paso con acción posible
    let cta;
    if (toca.emergencia) cta = { a: 'data-accion="emergencia"', t: '🚨 Empezar plan de emergencia' };
    else cta = P.find((x) => !x.ok && x.accion)?.accion
      || (completo ? { a: 'data-ir="progreso"', t: '📊 Ver mi progreso', fin: true } : { a: 'data-ir="repaso"', t: '🔁 Ir a Repaso' });

    const item = (x, i) => {
      const est = x.ok ? 'hecho' : i === actual ? 'actual' : 'pend';
      const plegable = x.ok && !x.libre && x.cuerpo;
      const abierto = !x.ok || abiertos.has(x.id);
      const marca = x.libre
        ? '<span class="hoy-mk" aria-hidden="true">✓</span>'
        : `<button class="hoy-mk hoy-check" data-check="${x.id}" aria-pressed="${x.ok}" aria-label="${x.ok ? 'Desmarcar' : 'Marcar'} paso: ${x.titulo}">${x.ok ? '✓' : i + 1}</button>`;
      const pill = x.libre ? '<span class="hoy-pill ok">✨ Al día</span>' : x.ok ? '<span class="hoy-pill ok">✓ Hecho</span>' : est === 'actual' ? '<span class="hoy-pill act">Ahora</span>' : '<span class="hoy-pill">Pendiente</span>';
      const tit = `<span class="hoy-ic" aria-hidden="true">${x.icono}</span><span class="hoy-tt">${x.titulo}</span>${x.meta && !x.ok ? `<span class="hoy-meta">${x.meta}</span>` : ''}`;
      return `<li class="hoy-paso ${est}${x.libre ? ' libre' : ''} ds-entra" style="--i:${i + 3}"${est === 'actual' ? ' aria-current="step"' : ''}>
        ${marca}
        <div class="hoy-card" data-paso="${x.libre ? '' : x.id}">
          <div class="hoy-cab">${plegable ? `<button class="hoy-tit" data-abrir="${x.id}" aria-expanded="${abierto}">${tit}<span class="hoy-flecha" aria-hidden="true">▾</span></button>` : `<p class="hoy-tit">${tit}</p>`}${pill}</div>
          ${x.ok ? `<p class="hoy-res">${x.resumen}</p>` : ''}
          ${abierto && x.cuerpo && !x.libre ? `<div class="hoy-cuerpo">${x.cuerpo}</div>` : ''}
        </div></li>`;
    };

    const [emo, sal] = saludo();
    const R = 42, C = 2 * Math.PI * R;
    const rch = safe(racha);
    let nv = null; try { nv = nivel(); } catch { /* sin estado de juego */ }
    const faltan = TOTAL - hechos;
    const fechaTxt = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    const hero = `<section class="hoy-hero ds-entra${completo ? ' completo' : ''}" style="--i:0" aria-labelledby="hoy-sal">
      <div class="hoy-anillo" role="img" aria-label="${hechos} de ${TOTAL} pasos hechos hoy">
        <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="pista" cx="50" cy="50" r="${R}"/>
          <circle class="valor" cx="50" cy="50" r="${R}" style="--c:${C.toFixed(1)};--desde:${(prevOff ?? C).toFixed(1)};stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${(C * (1 - hechos / TOTAL)).toFixed(1)}"/></svg>
        <span class="hoy-anillo-t" aria-hidden="true"><b>${completo ? '🎉' : `${hechos}/${TOTAL}`}</b><small>${completo ? 'día listo' : 'pasos'}</small></span>
      </div>
      <div class="hoy-saludo">
        <p class="hoy-fecha">${esc(fechaTxt)}</p>
        <h2 id="hoy-sal">${emo} ${sal}</h2>
        <p class="hoy-lema">${completo ? '¡Día completo! Ahora tu cerebro consolida lo de hoy.' : faltan === 1 ? 'Te queda 1 paso para cerrar el día.' : `Te quedan ${faltan} pasos para cerrar el día.`}</p>
        <div class="hoy-stats">
          <span class="hoy-st${rch ? ' viva' : ''}"><span aria-hidden="true">🔥</span> <b>${rch}</b> ${rch === 1 ? 'día' : 'días'}<span class="rp-sr"> de racha</span></span>
          ${nv ? `<span class="hoy-st"><span aria-hidden="true">⭐</span> Nv <b>${nv.n}</b><span class="hoy-xp" role="img" aria-label="${Math.round((nv.progreso || 0) * 100)} % hacia el nivel ${nv.n + 1}"><i style="width:${Math.round((nv.progreso || 0) * 100)}%"></i></span></span>` : ''}
          <span class="hoy-st"><span aria-hidden="true">📬</span> <b>${c.manana}</b> mañana</span>
        </div>
      </div>
      <button class="hoy-cta${cta.fin ? ' fin' : ''}" ${cta.a} aria-label="${completo ? '' : 'Continuar: '}${cta.t.replace(/^\S+\s/, '')}">
        <span class="hoy-cta-t">${completo ? 'Todo listo' : 'Continuar'}</span><span class="hoy-cta-s">${cta.t}</span><span class="hoy-cta-f" aria-hidden="true">→</span>
      </button>
    </section>`;

    // al repintar por una interacción: conservar el foco (teclado) y no repetir la animación de entrada
    const act = document.activeElement, fk = act && raiz.contains(act) ? ['check', 'abrir', 'bloque'].find((k) => act.dataset?.[k]) : null;
    const foco = fk ? `[data-${fk}="${act.dataset[fk]}"]` : null;
    raiz.innerHTML = `<div class="hoy">
      ${hero}
      ${barra}${especiales.length ? `<div class="hoy-esps ds-entra" style="--i:2">${especiales.join('')}</div>` : ''}
      <h3 class="hoy-h3">Tu sesión de hoy <span class="vacio">${hechos} de ${TOTAL}</span></h3>
      <ol class="hoy-pasos" aria-label="Pasos del día">${P.map(item).join('')}</ol>
      <p class="hoy-ayuda vacio">Toca el círculo o desliza una tarjeta a la derecha para marcar un paso.</p>
      ${formPlan}
      <p class="hoy-pie"><button class="link" data-ir="progreso">📊 Ver tu progreso</button></p>
    </div>`;

    if (!animar) {
      $$('.ds-entra', raiz).forEach((el) => el.classList.remove('ds-entra'));
      raiz.firstElementChild?.classList.add('quieto');
      if (foco) $(foco, raiz)?.focus({ preventScroll: true });
    }
    if (prevHechos != null && prevHechos < TOTAL && completo) fiesta();
    prevHechos = hechos; prevOff = C * (1 - hechos / TOTAL);
  }

  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !raiz.contains(b)) return;
    if (sw?.hecho) return; // el clic que sigue a un deslizamiento no cuenta
    const d = b.dataset;
    if (b.classList.contains('hoy-cta')) haptico('toque');
    if (d.abrir) { abiertos.has(d.abrir) ? abiertos.delete(d.abrir) : abiertos.add(d.abrir); return pintar(false); }
    if (d.check) { const h = estadoHoy(); const v = !h.hechos?.[d.check]; marcar(d.check, v); haptico(v ? 'bien' : 'toque'); return pintar(false); }
    if (d.accion === 'repaso') { marcar('vencidas'); return repasar({ modo: 'normal', sec: '' }); }
    if (d.accion === 'emergencia') return repasar({ modo: 'emergencia' });
    if (d.accion === 'semanal') return repasar({ modo: 'semanal' });
    if (d.accion === 'autoexamen') { marcar('autoexamen'); return repasar({ modo: 'autoexamen' }); }
    if (d.accion === 'simulacro') return repasar({ modo: 'simulacro' });
    if (d.tema) return abrirTema(d.tema);
    if (d.codificar) return abrirTema(d.codificar, true);
    if (d.estudiada) { plan.marcarEstudiada(d.estudiada); marcar('tema'); return repasar({ modo: 'seccion', sec: d.estudiada }); }
    if (d.ir) { if (d.ir === 'ciudad') marcar('palacio'); return irVista(d.ir); }
    if (d.bloque) {
      if (d.bloque === 'parar') bloque.parar();
      else { bloque.set({ ...bloque.get(), dur: d.bloque }); bloque.empezar('estudio'); marcar('descanso'); haptico('toque'); }
      return pintar(false);
    }
    if (d.plan === 'guardar') { const v = $('#hoy-examen', raiz)?.value; if (v) plan.fijarExamen(v); return pintar(false); }
    if (d.plan === 'quitar') { plan.fijarExamen(null); return pintar(false); }
  });
  raiz.addEventListener('change', (e) => {
    if (e.target.id === 'hoy-dsem') { const p = plan.cargar(); p.diaSemanal = +e.target.value; plan.guardar(p); try { ajustes.set('diaSemanal', +e.target.value); } catch { /* sin ajustes */ } pintar(false); }
    if (e.target.id === 'hoy-avisos') {
      const h = leer(CLAVE_HOY, {}); h.avisos = e.target.checked; escribir(CLAVE_HOY, h);
      try { if (h.avisos && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch { /* sin permiso */ }
    }
  });

  // gesto: deslizar una tarjeta de paso a la derecha la marca / desmarca (solo táctil)
  let sw = null;
  raiz.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    const card = e.target.closest('.hoy-card[data-paso]:not([data-paso=""])');
    if (!card || e.target.closest('input, select, label, textarea, .hoy-cuerpo button')) return;
    sw = { card, x: e.clientX, y: e.clientY, dx: 0, activo: false };
  });
  raiz.addEventListener('pointermove', (e) => {
    if (!sw || sw.hecho) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (!sw.activo) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { sw = null; return; }
      if (dx < 14) return;
      sw.activo = true; sw.card.classList.add('desliza');
    }
    sw.dx = Math.max(0, Math.min(120, dx));
    sw.card.style.transform = `translateX(${sw.dx}px)`;
    const listo = sw.dx > 76;
    if (listo !== sw.card.classList.contains('listo')) { sw.card.classList.toggle('listo', listo); if (listo) haptico('toque'); }
  });
  const finDesliz = () => {
    if (!sw || sw.hecho) return;
    const { card, dx, activo } = sw;
    card.style.transform = ''; card.classList.remove('desliza', 'listo');
    if (!activo) { sw = null; return; }
    sw.hecho = true; setTimeout(() => { sw = null; }, 60);
    if (dx > 76) { const id = card.dataset.paso; const h = estadoHoy(); const v = !h.hechos?.[id]; marcar(id, v); haptico(v ? 'bien' : 'toque'); pintar(false); }
  };
  raiz.addEventListener('pointerup', finDesliz);
  raiz.addEventListener('pointercancel', finDesliz);

  const repintar = () => { if (raiz.closest('.vista.on')) pintar(false); };
  window.addEventListener('memo:plan', repintar);
  window.addEventListener('memo:estudiada', repintar);

  return { pintar };
}
