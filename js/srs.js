// Repetición espaciada con la regla del skill estudio-repeticion-espaciada (regla-intervalos.md):
// escalera de días [1, 3, 7, 15, 30, 60, 120] (#031, #035, #038). Otra vez → escalón 0;
// Difícil → baja 1; Bien → sube 1; Fácil → sube 2. Otra vez y Difícil se repiten en la sesión.
// Dominada desde el escalón 3 (≥15 días). 3 fallos seguidos (contados por día) → marcada para editar.
//
// R1 · Solo la PRIMERA respuesta del día mueve el calendario (#039, #031, #038). Las rondas de errores,
// el juego, la caza y entrenar pueden volver a calificar la misma tarjeta ese día sin moverla.
// R9 · fuente 'semanal' | 'autoexamen': si la tarjeta no está vencida, solo "Otra vez" mueve el calendario.
// E2 · fuente 'simulacro' con nota 1: vuelve a 0 aunque ya se haya calificado hoy.
// E1 · Con fecha de examen, ningún repaso queda después de la víspera (plan.topeDue) y con plazo ≤ 14 días
//      se usa la escalera corta [1, 2, 4, 7].
// R6 · alias(mapa) traduce ids por posición (`ref#2`) a ids estables (`ref#qab12cd3`) y migra el historial.
//
// Formato en localStorage 'memo-semio-v1' (v2, compatible): { v: 2, tarjetas: { id: {
//   esc, reps, due, ult, dia:'AAAA-MM-DD', ultimo:nota, fallos, lapsos, editar, diaFallo, hist:[[dia, nota, fuente]] } } }
import { topeDue, escalera as escaleraPlan } from './plan.js';

const CLAVE = 'memo-semio-v1';
const DIA = 86400000;
export const ESCALERA = [1, 3, 7, 15, 30, 60, 120];
export const ESCALERA_CORTA = [1, 2, 4, 7];
export const DOMINADA = 3; // escalón
const MAX_HIST = 20;
const MAX_FALLOS = 3;

export const REGLA = {
  1: { nombre: 'Otra vez', color: '🔴', repetir: true, fn: () => 0 },
  2: { nombre: 'Difícil', color: '🟡', repetir: true, fn: (e) => Math.max(0, e - 1) },
  3: { nombre: 'Bien', color: '🟢', repetir: false, fn: (e) => e + 1 },
  4: { nombre: 'Fácil', color: '🔵', repetir: false, fn: (e) => e + 2 },
};

// ---------- fechas locales ----------
const pad = (n) => String(n).padStart(2, '0');
export function fecha(ms = Date.now()) { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export const hoy = () => fecha();
/** medianoche local de hoy + n días (ms) */
export function inicioDia(n = 0, desde = Date.now()) { const d = new Date(desde); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d.getTime(); }

// ---------- estado ----------
let estado = cargar();
let ALIAS = {};

function migrar(e) {
  if (!e || typeof e.tarjetas !== 'object') return { v: 2, tarjetas: {} };
  for (const t of Object.values(e.tarjetas)) {
    if (!t || typeof t !== 'object') continue;
    if ('racha' in t) { if (t.fallos == null) t.fallos = t.racha || 0; delete t.racha; }
    if (t.fallos == null) t.fallos = 0;
    if (t.lapsos == null) t.lapsos = 0;
    if (!t.dia && t.ult) t.dia = fecha(t.ult); // lo calificado hoy antes de la v2 cuenta como "ya calificado hoy"
    if (!Array.isArray(t.hist)) t.hist = t.ult ? [[fecha(t.ult), t.ultimo || 0, 'previo']] : [];
  }
  e.v = Math.max(2, e.v || 0);
  return e;
}
function cargar() {
  try { return migrar(JSON.parse(localStorage.getItem(CLAVE)) || { tarjetas: {} }); }
  catch { return { v: 2, tarjetas: {} }; }
}
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch { /* modo privado: solo en memoria */ }
}
const res = (id) => ALIAS[id] || id;
// otra pestaña guardó: recargar para no pisar su progreso con un estado viejo
try { window.addEventListener('storage', (e) => { if (e.key === CLAVE) { estado = cargar(); if (Object.keys(ALIAS).length) alias(ALIAS); } }); } catch { /* sin window */ }

/** R6: registra { idPorPosicion: idEstable } y mueve el historial viejo al id estable (idempotente). */
export function alias(mapa = {}) {
  ALIAS = { ...ALIAS, ...mapa };
  let cambio = false;
  for (const [viejo, nuevo] of Object.entries(mapa)) {
    if (viejo === nuevo) continue;
    const a = estado.tarjetas[viejo], b = estado.tarjetas[nuevo];
    if (!a) continue;
    if (!b || (a.ult || 0) > (b.ult || 0)) estado.tarjetas[nuevo] = a;
    delete estado.tarjetas[viejo];
    cambio = true;
  }
  if (cambio) guardar();
}
export const resolver = res;

export function escalera() { const e = escaleraPlan(); return Array.isArray(e) && e.length ? e : ESCALERA; }
const dias = (esc) => { const E = escalera(); return E[Math.max(0, Math.min(E.length - 1, esc))]; };

export function info(id) { return estado.tarjetas[res(id)] || null; }
export function vence(id, ahora = Date.now()) { const t = estado.tarjetas[res(id)]; return !t || t.due <= ahora; }
export function todas() { return estado.tarjetas; }

// escalón actual; una tarjeta nueva está "antes" del escalón 0
const escalon = (t) => (t ? t.esc : -1);
const tope = () => escalera().length - 1;

/** ¿La próxima calificación de esta tarjeta moverá el calendario? (false si ya se calificó hoy) */
export function movera(id, fuente = 'repaso') {
  const t = estado.tarjetas[res(id)];
  if (!t) return true;
  if (t.dia === hoy()) return false;
  if ((fuente === 'semanal' || fuente === 'autoexamen') && !vence(id)) return null; // solo "Otra vez"
  return true;
}

function dueDe(esc) {
  const d = inicioDia(dias(esc));
  return topeDue(d);
}

/** días hasta el próximo repaso si se calificara hoy con `nota` (ya recortado a la víspera del examen) */
export function previsualizar(id, nota) {
  const t = estado.tarjetas[res(id)];
  const e = Math.min(tope(), REGLA[nota].fn(escalon(t)));
  return Math.max(1, Math.round((dueDe(e) - inicioDia()) / DIA));
}

/**
 * Califica una tarjeta. Compatible con calificar(id, nota) de la v1.
 * @param {string} id
 * @param {1|2|3|4} nota
 * @param {{fuente?: string}} [op] 'repaso'|'juego'|'caza'|'entrenar'|'simulacro'|'semanal'|'autoexamen'|'palacio'|'bloque'
 * @returns {object} copia de la tarjeta + { repetirHoy, movido, editar }
 */
export function calificar(id, nota, op = {}) {
  nota = Math.max(1, Math.min(4, Math.round(+nota) || 1));
  const fuente = op.fuente || 'repaso';
  const k = res(id);
  const d = hoy();
  const nueva = !estado.tarjetas[k];
  const t = estado.tarjetas[k] || { esc: -1, reps: 0, fallos: 0, lapsos: 0, hist: [] };
  const regla = REGLA[nota];
  const vencida = nueva || t.due <= Date.now();

  // bitácora: una entrada por día (la primera respuesta del día), para Progreso
  const ultH = t.hist[t.hist.length - 1];
  if (!ultH || ultH[0] !== d) { t.hist.push([d, nota, fuente]); if (t.hist.length > MAX_HIST) t.hist.splice(0, t.hist.length - MAX_HIST); }

  // fallos seguidos: se cuentan por DÍA, no por ronda
  const contarFallo = () => { if (nota <= 2 && t.diaFallo !== d) { t.fallos = (t.fallos || 0) + 1; t.diaFallo = d; } };

  let movido = false;
  if (fuente === 'simulacro' && nota === 1) {
    // E2: lo que falla en el simulacro vuelve a 0, aunque ya se haya calificado hoy
    if ((t.esc ?? -1) >= 0) t.lapsos = (t.lapsos || 0) + 1;
    t.esc = 0; t.due = dueDe(0); t.dia = d; contarFallo(); movido = true;
  } else if (t.dia === d) {
    contarFallo(); // R1: ya se calificó hoy → no se mueve el calendario
  } else if ((fuente === 'semanal' || fuente === 'autoexamen') && !vencida && nota > 1) {
    // R9: en el repaso semanal (o autoexamen) solo "Otra vez" mueve una tarjeta no vencida
    contarFallo();
  } else {
    if (nota === 1 && (t.esc ?? -1) >= 0) t.lapsos = (t.lapsos || 0) + 1;
    t.esc = Math.min(tope(), regla.fn(escalon(t)));
    t.reps = (t.reps || 0) + 1;
    if (nota <= 2) contarFallo(); else t.fallos = 0;
    t.due = dueDe(t.esc);
    t.dia = d;
    t.ultimo = nota;
    movido = true;
  }
  if (t.fallos >= MAX_FALLOS) t.editar = true; // solo vuelve a false con marcarEditada()
  t.ult = Date.now();
  estado.tarjetas[k] = t;
  guardar();
  return { ...t, racha: t.fallos, repetirHoy: regla.repetir, movido, nueva };
}

/** R5: la pregunta ya se reescribió/recodificó → sale de "Para editar" y vuelve al escalón 0, lista para hoy. */
export function marcarEditada(id) {
  const k = res(id);
  const t = estado.tarjetas[k];
  if (!t) return;
  t.editar = false; t.fallos = 0; t.esc = 0; t.due = inicioDia(); t.dia = null; t.editada = Date.now();
  guardar();
}

export function nivel(id) {
  const t = estado.tarjetas[res(id)];
  if (!t) return 'nueva';
  return t.esc >= DOMINADA ? 'dominada' : 'aprendiendo';
}

/** semáforo de la tarjeta según su última nota: 🔴 🟡 🟢 🔵 (o ✨ si es nueva) */
export function semaforo(id) {
  const t = estado.tarjetas[res(id)];
  if (!t) return '✨';
  if (t.esc >= DOMINADA && (t.ultimo || 3) >= 3) return '🔵';
  return REGLA[t.ultimo]?.color || '🟢';
}

export function exportar() { return JSON.stringify(estado, null, 1); }
export function importar(texto) {
  const e = JSON.parse(texto);
  if (!e || typeof e.tarjetas !== 'object') throw new Error('archivo inválido');
  estado = migrar(e); guardar();
  if (Object.keys(ALIAS).length) alias(ALIAS);
}
export function textoIntervalo(d) {
  if (d == null) return 'sin cambio hoy';
  if (d <= 1) return 'mañana';
  if (d < 30) return `${d} días`;
  return `${Math.round(d / 30)} mes${d >= 60 ? 'es' : ''}`;
}
