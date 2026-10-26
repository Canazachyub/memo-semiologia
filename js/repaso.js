// Repaso con recuerdo activo + repetición espaciada. Dueño: paquete A (ver tools/PLAN_MEJORAS.md).
// R1 calendario 1×día (srs) · R2 rondas con semáforo y resumen · R3 ancla como pista desde la ronda 2 ·
// R4 comparar lo escrito · R5 bandeja "Para editar" · R6 ids estables (pid) · R7 mezclar y no encadenar hermanas ·
// R8 cloze · R9 repaso semanal · E2 simulacro · E3 emergencia · V1 (cola) nuevas solo de temas estudiados.
//
// Otros módulos pueden abrir un modo concreto:
//   window.dispatchEvent(new CustomEvent('memo:repaso', { detail: { modo, sec, refs, ids } }));
//   window.dispatchEvent(new CustomEvent('memo:vista', { detail: { vista: 'repaso' } }));
//   modo: 'normal' | 'semanal' | 'autoexamen' | 'emergencia' | 'bloque' | 'seccion' | 'simulacro' | 'editar'
import { $, $$, esc, resaltar, norm } from './util.js';
import { numeros, barajar } from './juego-util.js';
import { tarjetasExtra } from './vistas.js';
import * as plan from './plan.js';
import * as ajustes from './ajustes.js';
import * as mias from './mias.js';
import { registrarVista } from './hoy.js';

const ORDEN_TIPO = { directa: 0, cloze: 1, umbral: 2, inversa: 3, explica: 4, lista: 5, componente: 5, caso: 6, trampa: 7 };
const ETIQUETA_TIPO = { directa: 'directa', umbral: 'umbral', inversa: 'inversa', lista: 'lista', caso: '🩺 caso', trampa: '⚠️ trampa', cloze: 'hueco', explica: 'explica', componente: 'componente' };
const RX_CLOZE = /\{\{(?:c\d+::)?(.+?)(?:::[^}]*)?\}\}/g;
const RX_CIFRA = /([<>≥≤]=?\s?)?\d+(?:[.,]\d+)?(?:\s?[-–]\s?\d+(?:[.,]\d+)?)?/g;
const VACIAS = new Set('para sobre entre desde hasta como cuando donde porque pero menos mayor menor tiene puede debe valor normal adulto'.split(' '));
const SIM_HIST = 'memo-semio-simulacros';
const MAX_RONDAS = 3;
const SUGERENCIA = {
  'memorizar-numeros': 'Revisa el código del sistema mayor (🏋️ Entrenar › Gimnasio) y ata cada cifra a su palabra-imagen dentro de la escena.',
  'memorizar-listas': 'Divídela: una tarjeta "¿cuántos son?" + una por pieza; une las piezas en una historia o un acrónimo.',
  'palacio-memoria': 'Recorre el palacio adelante y atrás; si una estación falla, cambia su imagen por una más exagerada.',
  mnemotecnia: 'Haz un acrónimo o acróstico con las iniciales, o una rima; que sea absurdo y tuyo.',
  'memorizar-conceptos': 'Explícalo con tus palabras: qué es, cómo, por qué y para qué; agrega un ejemplo clínico.',
  'memorizar-nombres': 'Busca la palabra sustituta ("¿a qué me suena?") y pégala al rasgo del signo.',
  'memorizar-textos-literal': 'Divide en frases y usa pistas de primera letra; repasa en voz alta.',
  'visualizacion-imagenes': 'Haz la escena más exagerada: movimiento, sentidos, emoción, y que lleve de vuelta al significado.',
};
const SUG_GENERAL = 'Sintetízala si es larga, explícala mejor si es rebuscada o agrégale un ejemplo, una mnemotecnia o algo visual (#040).';

const leerJSON = (k, v) => { try { return JSON.parse(localStorage.getItem(k)) ?? v; } catch { return v; } };
const guardarJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** R8: frente con [ … ] o reverso con <mark> */
export function clozeHTML(q, revelar) {
  let out = '', i = 0;
  for (const m of String(q).matchAll(RX_CLOZE)) {
    out += esc(q.slice(i, m.index));
    out += revelar ? `<mark>${esc(m[1])}</mark>` : '<span class="rp-hueco">[ … ]</span>';
    i = m.index + m[0].length;
  }
  return out + esc(String(q).slice(i));
}
const esCloze = (q) => /\{\{.+?\}\}/.test(q || '');

/** R4: compara lo escrito con la respuesta (cifras y palabras clave). */
export function comparar(escrito, respuesta) {
  const nr = [...new Set(numeros(respuesta))], ne = new Set(numeros(escrito));
  const cifras = nr.map((n) => ({ n, ok: ne.has(n) }));
  const ve = norm(escrito);
  const claves = [...new Set(norm(respuesta).replace(/[^a-z0-9ñ\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 5 && !VACIAS.has(w)))];
  const ok = claves.filter((w) => ve.includes(w.slice(0, Math.max(5, w.length - 2))));
  const sugerida = (cifras.length > 0 && cifras.every((c) => c.ok)) || (!cifras.length && claves.length >= 2 && ok.length / claves.length >= 0.8);
  return { cifras, claves: claves.length, clavesOk: ok.length, sugerida };
}

export function crearRepaso({ ATLAS, MEMO, METODOS = {}, SIGLAS = {}, FACIES = {}, CASOS, srs, raiz, alPendientes = () => {} }) {
  const FILAS = ATLAS.secciones.flatMap((s) => s.filas.map((f) => ({ ...f, sec: s })));
  const SEC_DE = Object.fromEntries(FILAS.map((f) => [f.id, f.sec.id]));
  const GRUPOS = [...ATLAS.secciones.map((s) => ({ id: s.id, t: `${s.icono} ${s.titulo.replace(/^\d+ · /, '')}` })),
    { id: 'escalas', t: '📏 Escalas' }, { id: 'siglas', t: '🔤 Siglas' }, { id: 'facies', t: '🙂 Facies' }, { id: 'casos', t: '🩺 Casos clínicos' }];
  const nombreGrupo = (id) => GRUPOS.find((g) => g.id === id)?.t || id;

  // ---------- tarjetas (R6: id estable con pid, respaldo al índice) ----------
  const ALIAS = {};
  function idPregunta(base, p, i) {
    if (!p?.pid) return `${base}#${i}`;
    const pid = /^\d+$/.test(String(p.pid)) ? `p${p.pid}` : String(p.pid);
    const id = `${base}#${pid}`;
    ALIAS[`${base}#${i}`] = id;
    return id;
  }
  function construirTarjetas() {
    const t = [];
    const add = (o) => t.push({ tipo: o.tipo || (esCloze(o.q) ? 'cloze' : ''), ...o });
    for (const f of FILAS) {
      const m = MEMO[f.id];
      if (m?.preguntas?.length) m.preguntas.forEach((p, i) => add({ id: idPregunta(f.id, p, i), ref: f.id, sec: f.sec.id, q: p.q, a: p.a, tipo: p.tipo, m, nombre: f.nombre }));
      else if (f.normal?.t) {
        add({ id: `${f.id}#n`, ref: f.id, sec: f.sec.id, q: `${f.nombre}: ¿valor normal?`, a: f.normal.t, m: null, nombre: f.nombre, tipo: 'directa' });
        // R8: cloze automática con las cifras del valor normal ocultas
        if (/\d/.test(f.normal.t)) add({ id: `${f.id}#cz`, ref: f.id, sec: f.sec.id, q: `${f.nombre}: ${f.normal.t.replace(RX_CIFRA, (x) => `{{${x}}}`)}`, a: f.normal.t, m: null, nombre: f.nombre, tipo: 'cloze' });
      }
    }
    for (const e of ATLAS.escalas || []) {
      const m = MEMO[e.id];
      if (m?.preguntas?.length) m.preguntas.forEach((p, i) => add({ id: idPregunta(e.id, p, i), ref: e.id, sec: 'escalas', q: p.q, a: p.a, tipo: p.tipo, m, nombre: e.nombre }));
    }
    for (const [id, s] of Object.entries(SIGLAS || {})) (s.preguntas || []).forEach((p, i) => add({ id: idPregunta(`sig:${id}`, p, i), ref: id, sec: 'siglas', q: p.q, a: p.a, tipo: p.tipo, m: { ancla: s.ancla, escena: s.escena, tecnicas: s.tecnica ? [s.tecnica] : [] }, nombre: s.sigla }));
    for (const f of ATLAS.facies || []) { const fm = FACIES?.[f.id]; (fm?.preguntas || []).forEach((p, i) => add({ id: idPregunta(`fac:${f.id}`, p, i), ref: f.id, sec: 'facies', q: p.q, a: p.a, tipo: p.tipo, m: { ...fm, imagen: f.imagen }, nombre: f.nombre })); }
    for (const [id, c] of Object.entries(CASOS || {})) {
      if (id.startsWith('_') || !c?.opciones) continue;
      add({ id: `caso:${id}`, ref: id, sec: 'casos', q: `${c.viñeta}\n\n${c.pregunta}`, a: `${c.opciones[c.correcta]} — ${c.explicacion}`, m: { ancla: c.pista }, nombre: `🩺 ${c.titulo}`, tipo: 'caso', secsDatos: [...new Set((c.datos_ids || []).map((d) => SEC_DE[d] || (ATLAS.escalas || []).some((e) => e.id === d) && 'escalas').filter(Boolean))] });
    }
    let extra = [];
    try { extra = tarjetasExtra(ATLAS, MEMO, { SIGLAS, FACIES }) || []; } catch { extra = []; }
    const vistos = new Set(t.map((x) => x.id));
    for (const x of extra) if (x?.id && !vistos.has(x.id)) { vistos.add(x.id); add({ ref: x.ref || x.id.split(/[#:]/)[0], ...x }); }
    return t;
  }
  const TARJETAS = construirTarjetas();
  const POR_ID = new Map(TARJETAS.map((t) => [t.id, t]));
  srs.alias?.(ALIAS);

  // ---------- reglas de la cola ----------
  const nuevasDia = () => { const n = +ajustes.get('nuevasDia'); return Number.isFinite(n) && n > 0 ? n : 15; };
  const permitirSinEstudiar = () => ajustes.get('nuevasNoEstudiadas') === true;
  const hoyStr = () => srs.hoy?.() || new Date().toISOString().slice(0, 10);
  function nuevasHoy() {
    const h = hoyStr();
    return Object.values(srs.todas?.() || {}).filter((t) => t.hist?.[0]?.[0] === h && ['repaso', 'bloque', 'seccion', 'semanal'].includes(t.hist[0][2])).length;
  }
  function secLista(t) {
    if (permitirSinEstudiar()) return true;
    if (t.sec === 'casos') return (t.secsDatos || []).length > 0 && t.secsDatos.every((s) => plan.estudiada(s));
    return plan.estudiada(t.sec);
  }
  /** R7: mezcla sin que dos tarjetas de la misma ficha queden a menos de 3 posiciones (estable por ficha). */
  function separarHermanas(lista, dist = 3) {
    const resto = [...lista], out = [];
    while (resto.length) {
      const recientes = out.slice(-(dist - 1)).map((x) => x.ref);
      let i = resto.findIndex((x) => !recientes.includes(x.ref));
      if (i < 0) i = 0;
      out.push(resto.splice(i, 1)[0]);
    }
    return out;
  }
  const porTipo = (a, b) => (ORDEN_TIPO[a.tipo] ?? 4) - (ORDEN_TIPO[b.tipo] ?? 4);
  function ordenarNuevas(lista) {
    // por ficha (en el orden del atlas) y, dentro de cada ficha, de fácil a difícil
    const orden = new Map(); lista.forEach((t) => { if (!orden.has(t.ref)) orden.set(t.ref, orden.size); });
    return [...lista].sort((a, b) => orden.get(a.ref) - orden.get(b.ref) || porTipo(a, b));
  }
  const due = (t) => srs.info(t.id)?.due ?? 0;
  /** clave de mias.js: la parte del id antes de '#' (sig:<slug>, fac:<id>, <id>); las de escala por componente usan la escala */
  const miaKey = (t) => (t.id.startsWith('esc:') ? t.ref : t.id.split('#')[0]);
  const mia = (t) => mias.get(miaKey(t)) || {};

  let repSec = '', soloConMemo = true;
  const baseFiltro = (sec = repSec) => TARJETAS.filter((t) => (!sec || t.sec === sec) && (!soloConMemo || t.m));

  function colaNormal(sec = repSec, cupoMin = 0) {
    const ahora = Date.now();
    const base = baseFiltro(sec);
    const venc = base.filter((t) => srs.info(t.id) && srs.vence(t.id, ahora)).sort((a, b) => due(a) - due(b));
    const cupo = plan.faseSimulacro() ? 0 : Math.max(cupoMin, nuevasDia() - nuevasHoy());
    const nuevas = ordenarNuevas(base.filter((t) => !srs.info(t.id) && secLista(t))).slice(0, cupo);
    return separarHermanas([...venc, ...nuevas]);
  }
  function esperando(sec = repSec) {
    // nuevas bloqueadas por temas sin estudiar (V1)
    if (permitirSinEstudiar()) return [];
    const m = new Map();
    for (const t of baseFiltro(sec)) if (!srs.info(t.id) && !secLista(t) && t.sec !== 'casos') m.set(t.sec, (m.get(t.sec) || 0) + 1);
    return [...m.entries()];
  }
  function colaSemanal() {
    const h0 = srs.inicioDia ? srs.inicioDia(-6) : Date.now() - 6 * 864e5;
    const desde = srs.fecha ? srs.fecha(h0) : '';
    return separarHermanas(barajar(baseFiltro().filter((t) => (srs.info(t.id)?.hist || []).some(([d]) => d >= desde))));
  }
  const colaAutoexamen = () => separarHermanas(barajar(TARJETAS.filter((t) => srs.info(t.id)?.dia === hoyStr() || srs.info(t.id)?.hist?.slice(-1)[0]?.[0] === hoyStr())));
  function colaEmergencia() {
    const porFicha = new Map();
    for (const t of TARJETAS) if (t.m?.imagen_clave && t.sec !== 'casos') { const p = porFicha.get(t.ref); if (!p || porTipo(t, p) < 0) porFicha.set(t.ref, t); }
    const edit = TARJETAS.filter((t) => srs.info(t.id)?.editar);
    const ids = new Set();
    return separarHermanas(barajar([...edit, ...porFicha.values()].filter((t) => !ids.has(t.id) && ids.add(t.id))));
  }
  function colaBloque(refs = []) {
    const set = new Set(refs);
    const porRef = new Map();
    for (const t of [...TARJETAS].sort(porTipo)) if (set.has(t.ref) && t.sec !== 'casos') { const l = porRef.get(t.ref) || []; if (l.length < 2) { l.push(t); porRef.set(t.ref, l); } }
    return separarHermanas(barajar([...porRef.values()].flat()).slice(0, 20));
  }

  // ---------- sesión (R2) ----------
  let pestana = 'repasar'; // 'repasar' | 'editar' | 'simulacro'
  let ses = null;
  const MODOS = {
    normal: { titulo: '🔁 Repaso', fuente: 'repaso', rondas: MAX_RONDAS },
    semanal: { titulo: '📅 Repaso semanal', fuente: 'semanal', rondas: MAX_RONDAS, nota: 'Todo lo que repasaste en los últimos 7 días, aunque no esté vencido. Solo 🔴 Otra vez mueve el calendario de lo no vencido.' },
    autoexamen: { titulo: '🧪 Autoexamen del día', fuente: 'autoexamen', rondas: 1, nota: 'Una sola ronda con lo que calificaste hoy. No mueve el calendario: sirve para medirte.' },
    emergencia: { titulo: '🚨 Plan de emergencia', fuente: 'repaso', rondas: MAX_RONDAS, meta: 80, nota: 'Lo más preguntado + tus tarjetas para editar. Meta: 80 % de aciertos, no el 100 %.' },
    bloque: { titulo: '⏱ Mini-repaso del bloque', fuente: 'bloque', rondas: 2, nota: 'Las fichas que abriste en este bloque.' },
    seccion: { titulo: '📖 Primer repaso del tema', fuente: 'seccion', rondas: MAX_RONDAS, nota: 'Primera pasada del mismo día con el tema que acabas de estudiar.' },
  };
  function nuevaSesion(modo = 'normal', op = {}) {
    const cfg = MODOS[modo] || MODOS.normal;
    let cola;
    if (modo === 'semanal') cola = colaSemanal();
    else if (modo === 'autoexamen') cola = colaAutoexamen();
    else if (modo === 'emergencia') cola = colaEmergencia();
    else if (modo === 'bloque') cola = colaBloque(op.refs);
    else if (modo === 'seccion') cola = colaNormal(op.sec, 10);
    else if (op.ids?.length) cola = op.ids.map((id) => POR_ID.get(id)).filter(Boolean);
    else cola = colaNormal();
    ses = { modo, ...cfg, ronda: 1, cola, total: cola.length, hechas: 0, falladas: [], actual: null, r1: { 1: 0, 2: 0, 3: 0, 4: 0 },
      inicio: Date.now(), pistas: new Set(), editadas: new Set(), sinSalir: [], fase: 'tarjeta', sec: op.sec || '' };
    siguiente();
  }
  function siguiente() {
    ses.actual = ses.cola.shift() || null;
    if (ses.actual) { ses.fase = 'tarjeta'; registrarVista(ses.actual.ref); return; }
    if (ses.falladas.length && ses.ronda < ses.rondas) ses.fase = 'entre';
    else { ses.sinSalir = [...ses.falladas]; ses.fase = ses.total ? 'resumen' : 'vacio'; ses.fin = Date.now(); }
  }
  function empezarRonda() {
    ses.ronda += 1;
    ses.cola = separarHermanas(barajar(ses.falladas));
    ses.total = ses.cola.length; ses.hechas = 0; ses.falladas = [];
    siguiente();
  }

  function pendientes() {
    const ahora = Date.now();
    const n = TARJETAS.filter((t) => t.m && srs.info(t.id) && srs.vence(t.id, ahora)).length;
    alPendientes(n);
    return n;
  }
  const paraEditar = () => TARJETAS.filter((t) => srs.info(t.id)?.editar);

  // ---------- pintar ----------
  function pestanas() {
    const ne = paraEditar().length;
    const b = (id, t) => `<button class="rp-tab ${pestana === id ? 'on' : ''}" data-pest="${id}" role="tab" aria-selected="${pestana === id}">${t}</button>`;
    return `<div class="rp-tabs" role="tablist">${b('repasar', '🔁 Repasar')}${b('editar', `✏️ Para editar${ne ? ` <span class="badge">${ne}</span>` : ''}`)}${b('simulacro', '🎯 Simulacro')}</div>`;
  }
  function barraModo() {
    const opciones = [`<option value="">Todo</option>`, ...GRUPOS.map((g) => `<option value="${g.id}" ${repSec === g.id ? 'selected' : ''}>${esc(g.t)}</option>`)].join('');
    const esp = ses && ses.modo !== 'normal';
    return `<div class="rep-top">
      ${esp ? `<span class="rp-modo">${esc(ses.titulo)}</span><button class="btn rp-chico" data-salir>✕ Volver al repaso normal</button>`
        : `<label>Repasar: <select id="rep-sec">${opciones}</select></label>
      <label class="toggle"><input type="checkbox" id="rep-memo" ${soloConMemo ? 'checked' : ''}> <span>Solo con técnica</span></label>
      <button class="btn rp-chico" data-modo="semanal" title="Repaso semanal (R9)">📅 Semanal</button>`}
    </div>${esp && ses.nota ? `<p class="rp-nota">${esc(ses.nota)}</p>` : ''}`;
  }
  function cabecera() {
    const i = Math.min(ses.total, ses.hechas + 1);
    const pct = ses.total ? (100 * ses.hechas) / ses.total : 0;
    return `<div class="rp-cab" aria-live="polite"><span>Ronda <b>${ses.ronda}</b>${ses.rondas > 1 ? `/${ses.rondas}` : ''} · ${i}/${ses.total}</span>
      <div class="rp-barra"><i style="width:${pct}%"></i></div></div>`;
  }
  function pintar() {
    if (pestana === 'editar') return pintarEditar();
    if (pestana === 'simulacro') return pintarSimulacro();
    if (!ses) nuevaSesion('normal');
    const top = pestanas() + barraModo();
    if (ses.fase === 'vacio') return pintarVacio(top);
    if (ses.fase === 'entre') {
      raiz.innerHTML = top + `<div class="tarjeta rp-entre"><p class="rp-big">🔁 Ronda ${ses.ronda + 1}: solo tus errores (${ses.falladas.length})</p>
        <p class="vacio">Lo correcto no se repite en esta sesión. Desde esta ronda puedes pedir la pista ⚓ antes de rendirte. El calendario ya se movió con tu primera respuesta.</p>
        <div class="btns"><button class="btn pri" data-ronda>Empezar ronda ${ses.ronda + 1} (espacio)</button><button class="btn" data-terminar>Terminar y ver resumen</button></div></div>`;
      return enlazar();
    }
    if (ses.fase === 'resumen') return pintarResumen(top);
    pintarTarjeta(top);
  }
  function pintarVacio(top) {
    const esp = esperando();
    const usadas = nuevasHoy(), cupo = nuevasDia();
    const sim = plan.faseSimulacro();
    const msgs = [];
    if (ses.modo === 'semanal') msgs.push('No repasaste nada en los últimos 7 días.');
    else if (ses.modo === 'autoexamen') msgs.push('Hoy aún no calificaste ninguna tarjeta: haz primero tu repaso.');
    else if (ses.modo === 'bloque') msgs.push('No abriste fichas con preguntas en este bloque.');
    else {
      msgs.push('No hay tarjetas pendientes ahora.');
      if (sim) msgs.push('Estás en la fase de simulacro: ya no entran tarjetas nuevas.');
      else if (usadas >= cupo) msgs.push(`Ya metiste tus ${cupo} nuevas de hoy.`);
    }
    const lista = esp.length && ses.modo === 'normal' && !sim ? `<div class="rp-esperan"><p><b>📖 Primero estudia:</b></p>${esp.map(([sid, n]) =>
      `<button class="btn rp-chico" data-estudiar="${sid}">${esc(nombreGrupo(sid))} · ${n} tarjetas esperando</button>`).join('')}
      <p class="vacio">Comprende el tema en 📋 Valores y márcalo como estudiado (también desde 🏠 Hoy). "No puedes hacer preguntas sin antes haber entendido el tema."</p></div>` : '';
    raiz.innerHTML = top + `<div class="fin"><b>🎉</b>${msgs.map(esc).join('<br>')}</div>${lista}
      <div class="btns rp-centro"><button class="btn" data-ir-vista="hoy">🏠 Hoy</button>${ses.modo !== 'normal' ? '<button class="btn" data-salir>🔁 Repaso normal</button>' : ''}</div>`;
    enlazar();
  }
  function bloqueTecnica(t) {
    const m = t.m; const mia = mias.get(miaKey(t)) || {}; if (!m && !mia.escena && !mia.ancla) return '';
    const of = m ? `${m.ancla ? `⚓ <b>${esc(m.ancla)}</b>` : ''}${m.codigo?.length ? `<br>🔢 ${m.codigo.map((c) => `${esc(c.palabra)} = ${esc(c.numero)}`).join(' · ')}` : ''}${m.acronimo?.sigla ? `<br>🔤 <b>${esc(m.acronimo.sigla)}</b> — ${esc(m.acronimo.desarrollo || '')}` : ''}${m.escena ? `<br>🎬 ${esc(m.escena)}` : ''}` : '';
    const propia = mia.escena || mia.ancla ? `<div class="rp-mia"><span class="rp-etq">Tu versión</span>${mia.ancla ? `⚓ <b>${esc(mia.ancla)}</b>` : ''}${mia.escena ? `<br>🎬 ${esc(mia.escena)}` : ''}</div>` : '';
    if (propia) return `${propia}${of ? `<details class="pista"><summary>Versión oficial</summary>${of}</details>` : ''}`;
    return of ? `<div class="pista">${of}</div>` : '';
  }
  function anclaDe(t) { return mia(t).ancla || t.m?.ancla || ''; }
  function pintarTarjeta(top) {
    const t = ses.actual;
    const fuente = ses.fuente;
    const mueve = srs.movera ? srs.movera(t.id, fuente) : true;
    const prev = (n) => {
      if (mueve === false || (mueve === null && n > 1)) return 'sin cambio hoy';
      return srs.textoIntervalo(srs.previsualizar(t.id, n));
    };
    const nota = mia(t).notaPregunta;
    const ancla = ses.ronda >= 2 ? anclaDe(t) : '';
    const tipo = ETIQUETA_TIPO[t.tipo];
    const qHTML = esCloze(t.q) ? clozeHTML(t.q, false) : esc(t.q);
    raiz.innerHTML = top + cabecera() + `<div class="tarjeta" id="tarjeta">
      <div class="meta"><span>${esc(t.nombre)}${tipo ? ` <span class="rp-tipo">${esc(tipo)}</span>` : ''}</span><span>${srs.semaforo ? srs.semaforo(t.id) : ''} ${srs.nivel(t.id)}</span></div>
      <div class="q" id="rp-q">${qHTML}</div>
      ${nota ? `<p class="rp-notaq">📝 ${esc(nota)}</p>` : ''}
      <label class="rp-sr" for="resp">Tu respuesta</label>
      <textarea id="resp" placeholder="Escribe tu respuesta de memoria (recuerdo activo)… Ctrl+Enter revela"></textarea>
      <div class="btns" id="b-ver"><button class="btn pri" id="ver">Mostrar respuesta (espacio)</button>
        ${ancla ? `<button class="btn" id="rp-pista" aria-label="Ver pista: el ancla">💡 Pista (P)</button>` : ''}</div>
      <p class="rp-ancla" id="rp-ancla" hidden>⚓ ${esc(ancla)}</p>
      <div class="a"><div id="rp-compara"></div>${esCloze(t.q) ? `<div class="rp-clz">${clozeHTML(t.q, true)}</div>` : ''}<div class="resp">${resaltar(t.a)}</div>${bloqueTecnica(t)}
        ${t.m?.imagen ? `<img class="rp-img" src="${esc(t.m.imagen)}" alt="${esc(t.m.ancla || t.nombre)}" loading="lazy" data-zoom>` : ''}
        <div class="btns rp-notas" role="group" aria-label="Califícate con el semáforo">
          ${[1, 2, 3, 4].map((n) => `<button class="btn r${n}" data-nota="${n}">${srs.REGLA[n].color || ''} ${srs.REGLA[n].nombre}<small>${prev(n)}</small></button>`).join('')}
        </div>
        ${mueve === false ? '<p class="rp-nota">Ya la calificaste hoy: esta respuesta no mueve el calendario (R1), solo sirve para llegar a cero errores.</p>' : ''}
        <p class="rp-atajos">Teclas: 1 🔴 · 2 🟡 · 3 🟢 · 4 🔵 · E mi versión</p></div></div>`;
    enlazar();
    $('#resp', raiz)?.focus({ preventScroll: true });
  }
  function revelar() {
    const tj = $('#tarjeta', raiz); if (!tj || tj.classList.contains('revelada')) return;
    const t = ses.actual;
    const escrito = $('#resp', raiz)?.value.trim() || '';
    if (escrito) {
      const c = comparar(escrito, t.a);
      const cif = c.cifras.length ? `<p class="rp-cifras">Cifras: ${c.cifras.map((x) => `<span class="${x.ok ? 'ok' : 'no'}">${esc(x.n)} ${x.ok ? '✓' : '✗'}</span>`).join(' ')}</p>` : '';
      const kw = c.claves ? `<p class="rp-cifras">Palabras clave: ${c.clavesOk}/${c.claves}</p>` : '';
      $('#rp-compara', raiz).innerHTML = `<div class="rp-compara"><div><span class="h">Tú escribiste</span><p>${esc(escrito)}</p></div>
        <div><span class="h">Respuesta</span><p>${resaltar(t.a)}</p></div></div>${cif}${kw}
        ${c.sugerida ? '<p class="rp-sug">Coincide: 🟢 sugerido, pero calificas tú (sé honesto).</p>' : ''}`;
      if (c.sugerida) $('.btn.r3', raiz)?.classList.add('sugerida');
      $('.resp', raiz)?.classList.add('rp-oculta-dup');
    }
    tj.classList.add('revelada'); $('#b-ver', raiz)?.remove();
    $('.rp-notas .btn.sugerida, .rp-notas .btn', raiz)?.focus({ preventScroll: true });
  }
  function pista() {
    const a = $('#rp-ancla', raiz); if (!a) return;
    a.hidden = false; ses.pistas.add(ses.actual.id); $('#rp-pista', raiz)?.setAttribute('disabled', '');
  }
  function calificar(n) {
    const t = ses.actual; if (!t) return;
    const r = srs.calificar(t.id, n, { fuente: ses.fuente });
    if (ses.ronda === 1) ses.r1[n]++;
    if (n <= 2) ses.falladas.push(t);
    if (r?.editar) ses.editadas.add(t.id);
    ses.hechas++;
    siguiente(); pendientes(); pintar();
  }
  function pintarResumen(top) {
    const r = ses.r1, tot = r[1] + r[2] + r[3] + r[4];
    const ret = tot ? Math.round((100 * (r[3] + r[4])) / tot) : 0;
    const seg = Math.round(((ses.fin || Date.now()) - ses.inicio) / 1000);
    const editSes = [...ses.editadas].map((id) => POR_ID.get(id)).filter(Boolean);
    const sem = ret >= 90 ? '🟢' : ret >= 60 ? '🟡' : '🔴';
    const meta = ses.meta ? `<p class="rp-meta ${ret >= ses.meta ? 'ok' : ''}">Meta ${ses.meta} %: ${ret >= ses.meta ? '✔ lograda' : '✘ aún no — repite el bloque tras un descanso'}</p>` : '';
    const item = (t) => `<li><a href="#p-${esc(t.ref)}" data-ir="${esc(t.ref)}">${esc(t.nombre)}</a> — ${esCloze(t.q) ? clozeHTML(t.q, false) : esc(t.q)}</li>`;
    raiz.innerHTML = top + `<div class="tarjeta rp-resumen" aria-live="polite">
      <p class="rp-big">${sem} ${ret} % de retención</p>
      <div class="rp-kpis"><span>🟢🔵 <b>${r[3] + r[4]}</b></span><span>🟡 <b>${r[2]}</b></span><span>🔴 <b>${r[1]}</b></span></div>
      <p class="vacio">Ronda 1 · ${tot} tarjetas · ${ses.ronda} ronda${ses.ronda > 1 ? 's' : ''} · ${mmss(seg)} min${ses.pistas.size ? ` · ${ses.pistas.size} pista${ses.pistas.size > 1 ? 's' : ''}` : ''}</p>
      ${meta}
      ${ses.sinSalir.length ? `<h3>⏭ Vuelven mañana (${ses.sinSalir.length})</h3><ul class="rp-lista">${ses.sinSalir.map(item).join('')}</ul>` : (tot ? '<p>✅ Llegaste a cero errores.</p>' : '')}
      ${editSes.length ? `<h3>✏️ Para editar (${editSes.length})</h3><p class="vacio">Fallaron 3 días seguidos: espaciarlas no las arregla, hay que reescribirlas o recodificarlas.</p><ul class="rp-lista">${editSes.map(item).join('')}</ul>
        <button class="btn" data-pest="editar">Abrir bandeja "Para editar"</button>` : ''}
      <div class="btns"><button class="btn pri" data-otra>🔁 Otra sesión</button><button class="btn" data-ir-vista="hoy">🏠 Volver a Hoy</button><button class="btn" data-ir-vista="progreso">📊 Progreso</button></div></div>`;
    enlazar();
  }

  // ---------- R5 · bandeja "Para editar" ----------
  let editando = null;
  function sugerencia(t) {
    const tec = t.m?.tecnicas || [];
    const k = (t.tipo === 'lista' || t.m?.tipo_info === 'lista-causas' || t.m?.tipo_info === 'clasificacion') ? 'memorizar-listas' : tec.find((x) => SUGERENCIA[x] && x !== 'visualizacion-imagenes') || tec[0];
    return SUGERENCIA[k] || SUG_GENERAL;
  }
  function pintarEditar() {
    const lista = paraEditar();
    const tarjetaEd = (t) => {
      const i = srs.info(t.id) || {};
      const mia = mias.get(miaKey(t)) || {};
      const tec = (t.m?.tecnicas || []).map((k) => `<span class="chip">${esc(METODOS[k]?.icono || '🧩')} ${esc(METODOS[k]?.nombre || k)}</span>`).join(' ');
      const ed = editando === t.id ? `<div class="rp-editor">
          <label>📝 Nota de pregunta (tu reformulación, se ve debajo de la oficial)<textarea data-campo="notaPregunta">${esc(mia.notaPregunta || '')}</textarea></label>
          <label>⚓ Mi ancla<textarea data-campo="ancla">${esc(mia.ancla || '')}</textarea></label>
          <label>🎬 Mi escena<textarea data-campo="escena" rows="3">${esc(mia.escena || '')}</textarea></label>
          <p class="vacio">Checklist: ☐ ligada al significado · ☐ un protagonista · ☐ una acción exagerada · ☐ sentidos/emoción</p>
          <div class="btns"><button class="btn pri" data-guardar-mia="${esc(t.id)}">Guardar mi versión</button><button class="btn" data-cerrar-ed>Cerrar</button></div></div>` : '';
      return `<li class="rp-ed">
        <div class="meta"><span>${esc(nombreGrupo(t.sec))} · <a href="#p-${esc(t.ref)}" data-ir="${esc(t.ref)}">${esc(t.nombre)}</a></span><span>🔴 ${i.fallos || 0} días fallada · ${i.lapsos || 0} lapsos</span></div>
        <p class="rp-edq">${esCloze(t.q) ? clozeHTML(t.q, false) : esc(t.q)}</p>
        <p class="rp-eda">${resaltar(t.a)}</p>
        ${tec ? `<div class="rp-tec">${tec}</div>` : ''}
        <p class="rp-sugt" hidden data-sug="${esc(t.id)}">🧩 ${esc(sugerencia(t))}</p>
        <div class="btns"><button class="btn" data-editar-mia="${esc(t.id)}">✏️ Mi versión</button><button class="btn" data-rapido="${esc(t.id)}">📝 Editar aquí</button><button class="btn" data-ver-sug="${esc(t.id)}">🧩 Sugerencia</button>
          <button class="btn r3" data-arreglada="${esc(t.id)}">✅ Ya la arreglé</button></div>${ed}</li>`;
    };
    raiz.innerHTML = pestanas() + `<p class="rp-nota">Si una pregunta falla 3 días seguidos, la pregunta está mal diseñada o el dato necesita otra técnica: espaciarla no la arregla (#040, #038). Arréglala y márcala: vuelve al escalón 0.</p>
      ${lista.length ? `<ul class="rp-edlista">${lista.map(tarjetaEd).join('')}</ul>` : '<div class="fin"><b>✨</b>No tienes tarjetas para editar.</div>'}`;
    enlazar();
  }

  // ---------- E2 · simulacro ----------
  let sim = null; // {fase:'config'|'run'|'rev'|'res', n, secs:Set, items:[{t, resp, ok}], i, fin, reloj}
  const TEMARIO = GRUPOS.filter((g) => g.id !== 'casos');
  function dominio(sec) {
    const l = TARJETAS.filter((t) => t.sec === sec && t.m);
    if (!l.length) return 0;
    return l.filter((t) => srs.nivel(t.id) === 'dominada').length / l.length;
  }
  function pintarSimulacro() {
    if (!sim) sim = { fase: 'config', n: 20, secs: new Set() };
    if (sim.fase === 'config') return simConfig();
    if (sim.fase === 'run') return simRun();
    if (sim.fase === 'rev') return simRev();
    return simRes();
  }
  function simConfig() {
    const fase = plan.faseSimulacro();
    const secs = [...sim.secs];
    const listas = secs.filter((s) => dominio(s) >= 0.8);
    const ok = secs.length > 0 && (fase || listas.length === secs.length);
    const hist = leerJSON(SIM_HIST, []);
    raiz.innerHTML = pestanas() + `<div class="tarjeta rp-sim">
      <p class="rp-big">🎯 Simulacro</p>
      <p class="vacio">Condiciones de examen: preguntas abiertas mezcladas, cronómetro de 1 min por pregunta, sin pistas ni respuestas hasta el final. Lo que falles vuelve al escalón 0. Se hace cuando el tema ya se domina (≥ 80 %), no al principio: "sin base te acostumbras a fallar" (#148).</p>
      ${fase ? '<p class="rp-meta ok">Estás en la fase de simulacro de tu plan (último 20 %): todas las secciones habilitadas.</p>' : ''}
      <fieldset class="rp-fs"><legend>Preguntas</legend>${[20, 40, 80].map((n) => `<label class="chip ${sim.n === n ? 'on' : ''}"><input type="radio" name="simn" value="${n}" ${sim.n === n ? 'checked' : ''} hidden>${n}</label>`).join('')}</fieldset>
      <fieldset class="rp-fs"><legend>Secciones <button class="link" data-sim-todas type="button">todas</button></legend>
        <div class="rp-secs">${TEMARIO.map((g) => { const d = Math.round(100 * dominio(g.id)); return `<label class="rp-sec ${sim.secs.has(g.id) ? 'on' : ''}"><input type="checkbox" value="${g.id}" ${sim.secs.has(g.id) ? 'checked' : ''}> ${esc(g.t)} <small class="${d >= 80 ? 'ok' : ''}">${d} % dominadas</small></label>`; }).join('')}</div></fieldset>
      ${!ok && secs.length ? `<p class="rp-meta">Bloqueado: ${esc(secs.filter((s) => dominio(s) < 0.8).map(nombreGrupo).join(', '))} aún no llega${secs.length > 1 ? 'n' : ''} al 80 % de dominadas. Repasa primero o espera la fase de simulacro.</p>` : ''}
      <div class="btns"><button class="btn pri" data-sim-go ${ok ? '' : 'disabled'}>Empezar · ${sim.n} min</button></div>
      ${hist.length ? `<h3>Historial</h3><ul class="rp-lista">${hist.slice(-5).reverse().map((h) => `<li>${new Date(h.fecha).toLocaleDateString()} · ${h.n} preguntas · <b>${h.pct} %</b></li>`).join('')}</ul>` : ''}
    </div>`;
    enlazar();
  }
  function simEmpezar() {
    const pool = TARJETAS.filter((t) => sim.secs.has(t.sec) && t.m);
    const items = barajar(pool).slice(0, sim.n).map((t) => ({ t, resp: '', ok: null }));
    if (!items.length) return;
    sim = { ...sim, fase: 'run', items, i: 0, inicio: Date.now(), fin: Date.now() + items.length * 60000 };
    clearInterval(sim.reloj);
    sim.reloj = setInterval(() => {
      const r = Math.max(0, Math.round((sim.fin - Date.now()) / 1000));
      const el = $('#sim-reloj', raiz); if (el) el.textContent = `⏱ ${mmss(r)}`;
      if (r <= 0 && sim.fase === 'run') { guardarResp(); simTerminar(); }
    }, 500);
    pintar();
  }
  function guardarResp() { const ta = $('#sim-resp', raiz); if (ta && sim.items[sim.i]) sim.items[sim.i].resp = ta.value; }
  function simTerminar() { clearInterval(sim.reloj); sim.fase = 'rev'; sim.i = 0; sim.seg = Math.round((Date.now() - sim.inicio) / 1000); if (raiz.closest('.vista.on')) pintar(); }
  function simRun() {
    const it = sim.items[sim.i];
    const r = Math.max(0, Math.round((sim.fin - Date.now()) / 1000));
    raiz.innerHTML = pestanas() + `<div class="rp-cab"><span>🎯 Pregunta ${sim.i + 1}/${sim.items.length}</span><b id="sim-reloj" class="rp-reloj">⏱ ${mmss(r)}</b>
      <div class="rp-barra"><i style="width:${(100 * sim.i) / sim.items.length}%"></i></div></div>
      <div class="tarjeta"><div class="meta"><span>${esc(nombreGrupo(it.t.sec))}</span><span>sin pistas</span></div>
      <div class="q">${esCloze(it.t.q) ? clozeHTML(it.t.q, false) : esc(it.t.q)}</div>
      <label class="rp-sr" for="sim-resp">Tu respuesta</label><textarea id="sim-resp" placeholder="Responde como en el examen… (Ctrl+Enter: siguiente)">${esc(it.resp)}</textarea>
      <div class="btns">${sim.i > 0 ? '<button class="btn" data-sim-prev>← Anterior</button>' : ''}
        <button class="btn pri" data-sim-next>${sim.i + 1 < sim.items.length ? 'Siguiente →' : 'Terminar y corregir'}</button>
        ${sim.i + 1 < sim.items.length ? '<button class="btn" data-sim-fin>Terminar ya</button>' : ''}</div></div>`;
    enlazar(); $('#sim-resp', raiz)?.focus({ preventScroll: true });
  }
  function simRev() {
    const it = sim.items[sim.i];
    if (!it) { simGuardar(); sim.fase = 'res'; return pintar(); }
    const c = it.resp.trim() ? comparar(it.resp, it.t.a) : null;
    raiz.innerHTML = pestanas() + `<div class="rp-cab"><span>✍️ Corrección ${sim.i + 1}/${sim.items.length}</span><div class="rp-barra"><i style="width:${(100 * sim.i) / sim.items.length}%"></i></div></div>
      <div class="tarjeta revelada"><div class="meta"><span>${esc(nombreGrupo(it.t.sec))} · ${esc(it.t.nombre)}</span></div>
      <div class="q">${esCloze(it.t.q) ? clozeHTML(it.t.q, true) : esc(it.t.q)}</div>
      <div class="rp-compara"><div><span class="h">Tú escribiste</span><p>${it.resp.trim() ? esc(it.resp) : '<i class="vacio">(en blanco)</i>'}</p></div><div><span class="h">Respuesta</span><p>${resaltar(it.t.a)}</p></div></div>
      ${c?.cifras.length ? `<p class="rp-cifras">Cifras: ${c.cifras.map((x) => `<span class="${x.ok ? 'ok' : 'no'}">${esc(x.n)} ${x.ok ? '✓' : '✗'}</span>`).join(' ')}</p>` : ''}
      <div class="btns"><button class="btn r1" data-sim-ok="0">✗ Incorrecta (1)</button><button class="btn r3 ${c?.sugerida ? 'sugerida' : ''}" data-sim-ok="1">✓ Correcta (3)</button></div></div>`;
    enlazar();
  }
  function simCalificar(ok) {
    const it = sim.items[sim.i]; it.ok = ok;
    if (!ok) srs.calificar(it.t.id, 1, { fuente: 'simulacro' });
    sim.i++; pendientes(); pintar();
  }
  function simGuardar() {
    const secs = {};
    for (const it of sim.items) { const s = (secs[it.t.sec] ||= [0, 0]); s[1]++; if (it.ok) s[0]++; }
    const ok = sim.items.filter((x) => x.ok).length;
    sim.res = { fecha: Date.now(), n: sim.items.length, ok, pct: Math.round((100 * ok) / sim.items.length), seg: sim.seg, secs };
    const h = leerJSON(SIM_HIST, []); h.push(sim.res); guardarJSON(SIM_HIST, h.slice(-50));
  }
  function simRes() {
    const r = sim.res;
    const sem = (p) => (p >= 90 ? '🟢' : p >= 60 ? '🟡' : '🔴');
    raiz.innerHTML = pestanas() + `<div class="tarjeta rp-resumen"><p class="rp-big">${sem(r.pct)} ${r.pct} % en el simulacro</p>
      <p class="vacio">${r.ok}/${r.n} correctas · ${mmss(r.seg)} min. Las incorrectas volvieron al escalón 0: corrígelas y vuelve al tema.</p>
      <table class="rp-tabla"><thead><tr><th>Sección</th><th>%</th><th></th></tr></thead><tbody>
      ${Object.entries(r.secs).map(([s, [o, n]]) => { const p = Math.round((100 * o) / n); return `<tr><td>${esc(nombreGrupo(s))}</td><td>${sem(p)} ${p} % <small>(${o}/${n})</small></td><td><button class="btn rp-chico" data-volver-tema="${s}">Volver al tema</button></td></tr>`; }).join('')}
      </tbody></table>
      <div class="btns"><button class="btn pri" data-sim-nuevo>Otro simulacro</button><button class="btn" data-ir-vista="progreso">📊 Progreso</button></div></div>`;
    enlazar();
  }
  function volverATema(sid) {
    if (['siglas', 'facies', 'escalas'].includes(sid)) return irVista(sid);
    irVista('tabla');
    setTimeout(() => document.querySelector(`#filtro-sec [data-s="${sid}"]`)?.click(), 30);
  }

  // ---------- eventos ----------
  const irVista = (v) => window.dispatchEvent(new CustomEvent('memo:vista', { detail: { vista: v } }));
  function enlazar() {
    $('#rep-sec', raiz)?.addEventListener('change', (e) => { repSec = e.target.value; nuevaSesion('normal'); pintar(); });
    $('#rep-memo', raiz)?.addEventListener('change', (e) => { soloConMemo = e.target.checked; nuevaSesion('normal'); pintar(); });
    $('#ver', raiz)?.addEventListener('click', revelar);
    $('#rp-pista', raiz)?.addEventListener('click', pista);
    $$('[data-nota]', raiz).forEach((b) => b.addEventListener('click', () => calificar(+b.dataset.nota)));
    $$('[name="simn"]', raiz).forEach((b) => b.addEventListener('change', () => { sim.n = +b.value; pintar(); }));
    $$('.rp-secs input', raiz).forEach((b) => b.addEventListener('change', () => { b.checked ? sim.secs.add(b.value) : sim.secs.delete(b.value); pintar(); }));
  }
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('button, [data-ir-vista]'); if (!b || !raiz.contains(b)) return;
    const d = b.dataset;
    if (d.pest) { pestana = d.pest; editando = null; return pintar(); }
    if (d.modo) { nuevaSesion(d.modo); return pintar(); }
    if ('salir' in d || 'otra' in d) { nuevaSesion('normal'); return pintar(); }
    if ('ronda' in d) { empezarRonda(); return pintar(); }
    if ('terminar' in d) { ses.sinSalir = [...ses.falladas]; ses.fase = 'resumen'; ses.fin = Date.now(); return pintar(); }
    if (d.irVista) return irVista(d.irVista);
    if (d.estudiar) return volverATema(d.estudiar);
    if (d.editarMia) { const t = POR_ID.get(d.editarMia); if (t) window.dispatchEvent(new CustomEvent('memo:mia', { detail: { id: miaKey(t) } })); return; }
    if (d.rapido) { editando = editando === d.rapido ? null : d.rapido; return pintar(); }
    if ('cerrarEd' in d) { editando = null; return pintar(); }
    if (d.guardarMia) {
      const t = POR_ID.get(d.guardarMia); if (!t) return;
      const prev = mias.get(miaKey(t)) || {}; const nuevo = { ...prev };
      $$('.rp-editor [data-campo]', raiz).forEach((ta) => { const v = ta.value.trim(); if (v) nuevo[ta.dataset.campo] = v; else delete nuevo[ta.dataset.campo]; });
      delete nuevo.ts;
      mias.set(miaKey(t), Object.keys(nuevo).length ? nuevo : null);
      editando = null; return pintar();
    }
    if (d.verSug) { const p = raiz.querySelector(`[data-sug="${CSS.escape(d.verSug)}"]`); if (p) p.hidden = !p.hidden; return; }
    if (d.arreglada) { srs.marcarEditada?.(d.arreglada); pendientes(); return pintar(); }
    if ('simTodas' in d) { const todas = sim.secs.size === TEMARIO.length; sim.secs = new Set(todas ? [] : TEMARIO.map((g) => g.id)); return pintar(); }
    if ('simGo' in d) return simEmpezar();
    if ('simNext' in d) { guardarResp(); if (sim.i + 1 < sim.items.length) { sim.i++; pintar(); } else simTerminar(); return; }
    if ('simPrev' in d) { guardarResp(); sim.i = Math.max(0, sim.i - 1); return pintar(); }
    if ('simFin' in d) { guardarResp(); return simTerminar(); }
    if (d.simOk != null) return simCalificar(d.simOk === '1');
    if ('simNuevo' in d) { sim = { fase: 'config', n: sim.n, secs: sim.secs }; return pintar(); }
    if (d.volverTema) return volverATema(d.volverTema);
  });
  document.addEventListener('keydown', (e) => {
    if (!raiz.closest('.vista.on') || e.altKey || e.metaKey) return;
    const enTexto = ['TEXTAREA', 'INPUT', 'SELECT'].includes(e.target.tagName);
    if (pestana === 'simulacro') {
      if (sim?.fase === 'run' && e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); $('[data-sim-next]', raiz)?.click(); }
      else if (sim?.fase === 'rev' && !enTexto && (e.key === '1' || e.key === '3')) simCalificar(e.key === '3');
      return;
    }
    if (pestana !== 'repasar' || !ses) return;
    if (ses.fase === 'entre' && !enTexto && e.key === ' ') { e.preventDefault(); empezarRonda(); return pintar(); }
    if (ses.fase !== 'tarjeta') return;
    const rev = $('#tarjeta', raiz)?.classList.contains('revelada');
    if (!rev && e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); return revelar(); }
    if (enTexto || e.ctrlKey) return;
    if (!rev && e.key === ' ') { e.preventDefault(); revelar(); }
    else if (!rev && (e.key === 'p' || e.key === 'P')) pista();
    else if (rev && ['1', '2', '3', '4'].includes(e.key)) calificar(+e.key);
    else if (e.key === 'e' || e.key === 'E') { const t = ses.actual; window.dispatchEvent(new CustomEvent('memo:mia', { detail: { id: miaKey(t) } })); }
  });
  // pedidos desde Hoy u otros módulos
  window.addEventListener('memo:repaso', (e) => {
    const d = e.detail || {};
    if (d.modo === 'simulacro') { pestana = 'simulacro'; sim = { fase: 'config', n: sim?.n || 20, secs: new Set(d.secs || (plan.faseSimulacro() ? TEMARIO.map((g) => g.id) : [])) }; return; }
    if (d.modo === 'editar') { pestana = 'editar'; return; }
    pestana = 'repasar';
    if (d.sec != null && d.modo === 'normal') repSec = d.sec;
    nuevaSesion(d.modo || 'normal', d);
  });
  const reabrir = () => { if (ses?.fase === 'vacio' && ses.modo === 'normal') ses = null; };
  window.addEventListener('memo:plan', reabrir);
  window.addEventListener('memo:estudiada', reabrir);
  // B (Siglas «Repasar las de hoy»): abre Repaso filtrado por sección
  window.addEventListener('memo:repasar', (e) => { pestana = 'repasar'; repSec = e.detail?.sec || ''; nuevaSesion('normal'); });
  try { if (new URLSearchParams(location.search).get('editar') === '1') pestana = 'editar'; } catch { /* sin URL */ }

  /** abre un modo desde código (equivale al evento memo:repaso) */
  function iniciar(op = {}) { window.dispatchEvent(new CustomEvent('memo:repaso', { detail: op })); }
  return { pintar, tarjetas: TARJETAS, pendientes, iniciar, colaNormal: () => colaNormal(''), paraEditar };
}
