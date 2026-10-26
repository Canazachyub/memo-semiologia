// Vista "🏠 Hoy": sesión de estudio guiada (S1) + bloques con descanso (S2) + plan de examen (E1, E3). Dueño: paquete A.
// Ciclo del skill estudio-recuerdo-activo (#039): comprender → codificar → examinarte → semáforo → rondas → espaciar.
// - Repaso intermitente y autoexamen del día tras un descanso (#058, #063, #056); repaso al final del día (#035).
// - Bloques con repaso al cierre (#057, #190, #128). Duraciones 25/5 y 50/10 son [complemento]; 60/10 sale de #057.
import { $, $$, esc } from './util.js';
import * as plan from './plan.js';
import * as ajustes from './ajustes.js';
import { racha } from './juego-estado.js';

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

  function pintar() {
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
    const paso = (id, ok, icono, titulo, cuerpo) => `<li class="hoy-paso ${ok ? 'hecho' : ''}">
      <button class="hoy-check" data-check="${id}" aria-pressed="${ok}" aria-label="${ok ? 'Desmarcar' : 'Marcar'} paso: ${esc(titulo)}">${ok ? '✅' : '⬜'}</button>
      <div><p class="hoy-tit">${icono} ${titulo}</p>${cuerpo}</div></li>`;

    // barra del plan (E1)
    let barra;
    if (p.examen && toca.fase !== 'pasado') {
      const fase = toca.emergencia ? '🚨 examen inminente' : toca.simulacro ? '🎯 fase de simulacro (20 %)' : 'fase de temario (80 %)';
      const te = toca.secciones.length ? ` · te ${toca.secciones.length > 1 ? 'tocan' : 'toca'}: ${toca.secciones.map((s) => esc(nombre(s))).join(' + ')}` : '';
      barra = `<div class="hoy-plan"><b>Día ${toca.dia} de ${toca.total}</b> · ${fase}${te}<span class="vacio"> · examen ${new Date(p.examen + 'T12:00').toLocaleDateString()} (${toca.faltan === 0 ? 'hoy' : toca.faltan === 1 ? 'mañana' : `en ${toca.faltan} días`})</span>
        <div class="rp-barra"><i style="width:${(100 * toca.dia) / toca.total}%"></i><em style="left:80%" title="80 %"></em></div></div>`;
    } else barra = `<div class="hoy-plan vacio">${p.examen ? 'Tu examen ya pasó. Fija una fecha nueva para planear.' : 'Sin fecha de examen: avanzas tema por tema. Fija una fecha para repartir el temario (80/20).'}</div>`;

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

    const temaHTML = temas.length ? temas.map((sid) => {
      const est = plan.estudiada(sid), n = nuevasEsperando(sid);
      return `<div class="hoy-tema"><p><b>${esc(nombre(sid))}</b> <span class="vacio">${n} tarjetas nuevas</span></p>
        <ol class="hoy-sub">
          <li><button class="btn" data-tema="${sid}">a) 💡 Comprender</button> <span class="vacio">valores, ¿por qué? y perlas</span></li>
          <li><button class="btn" data-codificar="${sid}">b) 🧠 Codificar</button> <button class="btn" data-ir="ciudad">🏙️ Paseo</button></li>
          <li>${est ? '✅ Estudiada' : `<button class="btn pri" data-estudiada="${sid}">c) 📖 Marcar estudiada y primer repaso</button>`}</li>
        </ol></div>`;
    }).join('') : (estudiadasHoy.length ? `<p>✅ Ya estudiaste hoy: ${estudiadasHoy.map((s) => esc(nombre(s))).join(' + ')}.</p>` : '<p class="vacio">No hay tema nuevo hoy: ¡temario completo o adelantado!</p>');

    raiz.innerHTML = `<div class="hoy">
      <h2 class="hoy-h">🏠 Hoy <span class="vacio">${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span></h2>
      ${barra}${especiales.join('')}
      <ol class="hoy-pasos">
        ${paso('vencidas', h.vencidas || c.venc === 0, '🔁', `Repasos vencidos (${c.venc})`,
          `<p class="vacio">Primero lo que toca: rondas solo de errores hasta cero (máx. 3).</p>${c.venc ? '<button class="btn pri" data-accion="repaso">🔁 Repasar ahora</button>' : '<p>✅ Al día.</p>'}`)}
        ${paso('tema', h.tema || (temas.length === 0 && estudiadasHoy.length > 0), '📖', temas.length ? `Tema nuevo: ${temas.map((s) => esc(nombre(s))).join(' + ')}` : 'Tema nuevo', temaHTML)}
        ${paso('descanso', h.descanso, '⏸', 'Bloques con descanso',
          `<div class="hoy-form">${b.fase ? `<b>${b.fase === 'estudio' ? '⏱ Bloque en curso' : '☕ Descansando'}</b> <span class="vacio">${refsBloque().length} fichas vistas</span> <button class="btn" data-bloque="parar">⏹ Parar</button>`
            : `${Object.keys(DURS).map((k) => `<button class="btn ${k === b.dur ? 'pri' : ''}" data-bloque="${k}">▶ ${k}</button>`).join('')}`}
            <label class="toggle"><input type="checkbox" id="hoy-avisos" ${leer(CLAVE_HOY, {}).avisos ? 'checked' : ''}> <span>🔔 Avisarme</span></label></div>
           <p class="vacio">Estudio ${dEst} min → mini-repaso de lo visto → descanso ${dDes} min.</p>`)}
        ${paso('autoexamen', h.autoexamen, '🧪', 'Autoexamen del día',
          `<p class="vacio">Tras un descanso: una sola ronda con lo de hoy, sin mover el calendario (#056).</p><button class="btn" data-accion="autoexamen" ${c.hoyCal ? '' : 'disabled'}>🧪 Autoexamen (${c.hoyCal})</button>`)}
        ${paso('palacio', h.palacio || pal.length === 0, '🏛️', 'Palacio que toca',
          pal.length ? `<p>${pal.map((s) => esc(nombre(s))).join(' · ')}</p><button class="btn" data-ir="ciudad">🏙️ Pasear (adelante y atrás)</button>` : '<p class="vacio">Ningún palacio vence hoy.</p>')}
      </ol>
      ${formPlan}
      <p class="hoy-pie">🔥 Racha: <b>${safe(racha)}</b> días · Mañana te tocan <b>${c.manana}</b> repasos · <button class="link" data-ir="progreso">📊 Progreso</button></p>
    </div>`;
  }
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.check) { const h = estadoHoy(); marcar(d.check, !h.hechos?.[d.check]); return pintar(); }
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
      else { bloque.set({ ...bloque.get(), dur: d.bloque }); bloque.empezar('estudio'); marcar('descanso'); }
      return pintar();
    }
    if (d.plan === 'guardar') { const v = $('#hoy-examen', raiz)?.value; if (v) plan.fijarExamen(v); return pintar(); }
    if (d.plan === 'quitar') { plan.fijarExamen(null); return pintar(); }
  });
  raiz.addEventListener('change', (e) => {
    if (e.target.id === 'hoy-dsem') { const p = plan.cargar(); p.diaSemanal = +e.target.value; plan.guardar(p); try { ajustes.set('diaSemanal', +e.target.value); } catch { /* sin ajustes */ } pintar(); }
    if (e.target.id === 'hoy-avisos') {
      const h = leer(CLAVE_HOY, {}); h.avisos = e.target.checked; escribir(CLAVE_HOY, h);
      try { if (h.avisos && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch { /* sin permiso */ }
    }
  });
  const repintar = () => { if (raiz.closest('.vista.on')) pintar(); };
  window.addEventListener('memo:plan', repintar);
  window.addEventListener('memo:estudiada', repintar);

  return { pintar };
}
