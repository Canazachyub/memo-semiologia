// Paseo real: lo que caminas con el GPS activo mueve el juego (como Pokémon GO, adaptado al navegador).
//   · rastro del día y de la semana (se dibuja en el mapa)
//   · km caminados → premios (cada 200 m una criatura en tu camino, 500 m una rara, 1 km un caso clínico épico)
//   · pasar a menos de RADIO_PASO m de una memoparada la desbloquea en el mapa por etapas
// Privacidad: todo vive SOLO en este dispositivo, en localStorage 'memo-rastro' (fuera del prefijo memo-semio-,
// así que no viaja en los archivos de respaldo). Se guardan como máximo DIAS días.
// El navegador solo da ubicación con la app abierta y la pantalla encendida: no hay seguimiento en segundo plano.
import { metros } from './juego-util.js';

const CLAVE = 'memo-rastro';
const DIAS = 7;
const PRECISION_MAX = 35;      // m: lecturas peores se ignoran (interiores, GPS frío)
const VEL_MAX = 3;             // m/s (~11 km/h): más rápido = combi/auto → no cuenta ni se dibuja
export const RADIO_PASO = 60;  // m para "pasar por" una memoparada
export const PREMIOS = [
  { cada: 1000, rareza: 'epico', nombre: 'caso clínico' },
  { cada: 500, rareza: 'raro', nombre: 'criatura rara' },
  { cada: 200, rareza: 'comun', nombre: 'criatura' },
];

const hoyISO = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const vacio = () => ({ v: 1, activo: false, dias: {}, total: 0, pasadas: {}, premios: [] });

let st = cargar();
function cargar() {
  try { const e = JSON.parse(localStorage.getItem(CLAVE)); if (e && typeof e === 'object') return { ...vacio(), ...e }; } catch { /* sin almacenamiento */ }
  return vacio();
}
function guardar() {
  const lim = hoyISO(Date.now() - (DIAS - 1) * 86400000);
  for (const k of Object.keys(st.dias)) if (k < lim) delete st.dias[k];
  try { localStorage.setItem(CLAVE, JSON.stringify(st)); } catch { /* modo privado */ }
}
const dia = (k = hoyISO()) => (st.dias[k] ||= { m: 0, tramos: [] });

let ultimo = null;   // última lectura aceptada { ll, t } (en memoria: tras una pausa empieza tramo nuevo)

/** Registra una lectura del GPS. → { ok, metros, premios: [{rareza,nombre}], pasadas: [id] } */
export function registrar(coords, t = Date.now(), paradas = []) {
  const r = { ok: false, metros: 0, premios: [], pasadas: [] };
  if (!coords || (coords.accuracy || 0) > PRECISION_MAX) return r;
  const ll = [+coords.latitude.toFixed(6), +coords.longitude.toFixed(6)];
  const d = dia(hoyISO(t));
  if (!ultimo || t - ultimo.t > 120000) {          // primera lectura o tras 2 min sin datos: tramo nuevo
    ultimo = { ll, t }; d.tramos.push([ll]); guardar(); r.ok = true;
  } else {
    const paso = metros(ultimo.ll, ll), dt = (t - ultimo.t) / 1000;
    if (paso < Math.max(10, (coords.accuracy || 10) * 0.6)) return r;   // ruido: no se movió
    if (dt > 0 && paso / dt > VEL_MAX) { ultimo = { ll, t }; d.tramos.push([ll]); guardar(); return r; }   // vehículo
    if (!d.tramos.length) d.tramos.push([]);
    d.tramos.at(-1).push(ll);
    d.m += paso; st.total += paso; r.metros = paso; r.ok = true;
    ultimo = { ll, t };
    const gano = PREMIOS.find((p) => Math.floor(st.total / p.cada) > Math.floor((st.total - paso) / p.cada));   // el de mayor rango
    if (gano) r.premios.push(gano);
  }
  for (const x of paradas) if (x.ll && !st.pasadas[x.id] && metros(ll, x.ll) < RADIO_PASO) { st.pasadas[x.id] = t; r.pasadas.push(x.id); }
  guardar();
  return r;
}
export const pasadas = () => new Set(Object.keys(st.pasadas));
export const metrosHoy = () => st.dias[hoyISO()]?.m || 0;
export const metrosTotal = () => st.total;
/** Cuánto falta para el próximo premio de cada tipo. */
export const faltan = () => PREMIOS.map((p) => ({ ...p, falta: p.cada - (st.total % p.cada) }));
/** Tramos para dibujar: { hoy: [[ll…]…], semana: [[ll…]…] } (solo tramos con 2+ puntos). */
export function tramos() {
  const k = hoyISO(), ok = (t) => t.length > 1;
  return {
    hoy: (st.dias[k]?.tramos || []).filter(ok),
    semana: Object.entries(st.dias).filter(([d]) => d !== k).flatMap(([, x]) => x.tramos.filter(ok)),
  };
}
export const activo = () => !!st.activo;
export function activar(si) { st.activo = !!si; if (!si) ultimo = null; guardar(); }

// ---------- criaturas-premio (aparecen en tu camino y duran VIDA_PREMIO) ----------
const VIDA_PREMIO = 30 * 60000;
export function premiosVivos(t = Date.now()) { return st.premios.filter((p) => p.hasta > t); }
export function agregarPremio(p) { st.premios = [...premiosVivos(), p]; guardar(); }
export function consumirPremio(k) { st.premios = st.premios.filter((p) => p.k !== k); guardar(); }
export const vidaPremio = () => VIDA_PREMIO;

/** Borra el recorrido guardado (rastro, km, paradas por las que pasaste y premios pendientes). */
export function borrar() { const a = st.activo; st = vacio(); st.activo = a; ultimo = null; guardar(); }
