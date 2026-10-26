// Plan de estudio hacia un examen (E1, E2, E3 · skill estudio-repeticion-espaciada). Dueño: paquete A.
// - Paso 1 (#035): fecha límite y reparto del temario entre los días.
// - 80/20 (#035, #031, #019, #063): temario en el primer 80 % del plazo; el último 20 % es de simulacros.
// - Regla 4 (#038, #042): ningún repaso después de la víspera del examen → topeDue(ms).
// - Plazo corto (≤ 14 días al crear el plan): escalera [1, 2, 4, 7] → escalera().
// - Examen mañana (#035, #056, #057): plan de emergencia → emergencia().
//
// localStorage 'memo-semio-plan' = { examen:'AAAA-MM-DD'?, inicio:'AAAA-MM-DD'?, temario:[sid…]?,
//   estudiadas:{ sid: ms }, escalera?:[1,2,4,7], diaSemanal?:0-6 }
// Sin fecha de examen el plan sigue sirviendo para 'estudiadas' (V1).
const CLAVE = 'memo-semio-plan';
const DIA = 86400000;
export const TEMARIO = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12', 'escalas', 'siglas', 'facies'];
export const ESCALERA_CORTA = [1, 2, 4, 7];

const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; } };
const pad = (n) => String(n).padStart(2, '0');
const fecha = (ms = Date.now()) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
/** 'AAAA-MM-DD' → ms de la medianoche local */
const ms = (f) => { if (!f) return NaN; const [y, m, d] = String(f).split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
const hoy0 = () => ms(fecha());
const aMs = (v) => (typeof v === 'string' ? ms(v) : v);
const difDias = (a, b) => Math.round((ms(b) - ms(a)) / DIA);

export function cargar() { return leer(); }
export function guardar(p) { try { localStorage.setItem(CLAVE, JSON.stringify(p)); } catch { /* sin almacenamiento */ } }

/** Crea o actualiza el plan con fecha de examen. Con ≤ 14 días usa la escalera corta. examen = null borra la fecha. */
export function fijarExamen(examen, { inicio, temario } = {}) {
  const p = leer();
  if (!examen) { delete p.examen; delete p.inicio; delete p.escalera; guardar(p); return p; }
  p.examen = examen;
  p.inicio = inicio || (p.examen === examen && p.inicio) || fecha();
  if (temario) p.temario = temario;
  const faltan = difDias(fecha(), examen);
  if (faltan <= 14) p.escalera = ESCALERA_CORTA; else delete p.escalera;
  guardar(p);
  return p;
}

export function marcarEstudiada(sid, si = true) {
  const p = leer();
  p.estudiadas = { ...(p.estudiadas || {}) };
  if (si) p.estudiadas[sid] = p.estudiadas[sid] || Date.now(); else delete p.estudiadas[sid];
  guardar(p);
  try { window.dispatchEvent(new CustomEvent('memo:plan', { detail: { sid, estudiada: si } })); } catch { /* sin window */ }
}
export function estudiada(sid) { return !!leer().estudiadas?.[sid]; }
/** ms de la fecha en que se marcó (acepta ms o 'AAAA-MM-DD', como lo guarda vistas.js) */
export function fechaEstudiada(sid) { return aMs(leer().estudiadas?.[sid]) || null; }

/** escalera que usa srs (null = la normal) */
export function escalera() { const e = leer().escalera; return Array.isArray(e) && e.length ? e : null; }

/** Recorta un vencimiento (ms) a la víspera del examen; si la víspera ya pasó, mañana. */
export function topeDue(t) {
  const p = leer();
  if (!p.examen) return t;
  const examen = ms(p.examen);
  if (!Number.isFinite(examen) || examen < hoy0()) return t; // examen pasado: sin tope
  const limite = examen - DIA;
  if (t <= limite) return t;
  const manana = hoy0() + DIA;
  return limite > hoy0() ? limite : manana;
}

/** Último 20 % del periodo inicio → examen (enFaseSimulacro de regla-intervalos.md). */
export function faseSimulacro() {
  const p = leer();
  if (!p.examen || !p.inicio) return false;
  const total = ms(p.examen) - ms(p.inicio), resta = ms(p.examen) - hoy0();
  return total > 0 && resta >= 0 && resta <= 0.2 * total;
}
/** E3: el examen es hoy o mañana */
export function emergencia() {
  const p = leer();
  if (!p.examen) return false;
  const f = difDias(fecha(), p.examen);
  return f >= 0 && f <= 1;
}

/**
 * Calendario del primer 80 %: reparte las secciones no estudiadas (en el orden del temario) entre los días
 * que quedan hasta el fin de la fase de temario. Lo estudiado HOY sigue contando en el cupo de hoy,
 * para que marcar una sección no adelante la de mañana.
 * @returns {{fecha:string, secciones:string[]}[]}
 */
export function calendario() {
  const p = leer();
  if (!p.examen || !p.inicio) return [];
  const temario = p.temario?.length ? p.temario : TEMARIO;
  const est = p.estudiadas || {};
  const h = fecha();
  const pend = temario.filter((s) => !est[s] || fecha(aMs(est[s])) === h);
  const fin80 = ms(p.inicio) + Math.floor(0.8 * (ms(p.examen) - ms(p.inicio)) / DIA) * DIA;
  const nDias = Math.max(1, Math.round((Math.max(fin80, hoy0()) - hoy0()) / DIA) + (fin80 >= hoy0() ? 1 : 0));
  const out = [];
  for (let i = 0; i < nDias; i++) {
    const a = Math.floor((i * pend.length) / nDias), b = Math.floor(((i + 1) * pend.length) / nDias);
    out.push({ fecha: fecha(hoy0() + i * DIA), secciones: pend.slice(a, b) });
  }
  return out;
}

/**
 * Qué me toca hoy (#019, #020).
 * @returns {{ fase:'sin-plan'|'temario'|'simulacro'|'emergencia'|'pasado', dia:number, total:number, faltan:number,
 *   secciones:string[], pendientes:string[], simulacro:boolean, emergencia:boolean, siguiente:string|null,
 *   items:{tipo:string, sid?:string, texto:string}[] }}
 *   secciones = las del cupo de hoy; pendientes = las de hoy aún sin estudiar; siguiente = próxima no estudiada (sin plan).
 */
export function hoyToca() {
  const p = leer();
  const temario = p.temario?.length ? p.temario : TEMARIO;
  const est = p.estudiadas || {};
  const siguiente = temario.find((s) => !est[s]) || null;
  const base = { fase: 'sin-plan', dia: 0, total: 0, faltan: NaN, secciones: [], pendientes: [], simulacro: false, emergencia: false, siguiente, items: [] };
  if (!p.examen || !p.inicio) {
    if (siguiente) base.items.push({ tipo: 'nueva', sid: siguiente, texto: 'Siguiente tema sin estudiar' });
    return base;
  }
  const h = fecha();
  const faltan = difDias(h, p.examen);
  const total = Math.max(1, difDias(p.inicio, p.examen));
  const dia = Math.min(total, Math.max(1, difDias(p.inicio, h) + 1));
  if (faltan < 0) return { ...base, fase: 'pasado', dia: total, total, faltan };
  const sim = faseSimulacro(), em = emergencia();
  const hoyCal = sim ? null : calendario()[0];
  const secciones = hoyCal?.secciones || [];
  const pendientes = secciones.filter((s) => !est[s]);
  const items = [
    ...pendientes.map((sid) => ({ tipo: 'nueva', sid, texto: 'Tema nuevo de hoy' })),
    ...(sim ? [{ tipo: 'simulacro', texto: 'Fase de simulacro (último 20 %)' }] : []),
    ...(em ? [{ tipo: 'emergencia', texto: 'Examen inminente: plan de emergencia' }] : []),
  ];
  return { fase: em ? 'emergencia' : sim ? 'simulacro' : 'temario', dia, total, faltan, secciones, pendientes, simulacro: sim, emergencia: em, siguiente, items };
}

/** R9: ¿hoy es el día de repaso semanal? (ajuste 'diaSemanal' 0=domingo … 6=sábado; por defecto domingo) */
export function esDiaSemanal(diaAjuste) {
  const d = diaAjuste ?? leer().diaSemanal ?? 0;
  return new Date().getDay() === +d;
}
