// Repetición espaciada con la regla del skill estudio-repeticion-espaciada (regla-intervalos.md):
// escalera de días [1, 3, 7, 15, 30, 60, 120] (#031, #035, #038). Otra vez → escalón 0;
// Difícil → baja 1; Bien → sube 1; Fácil → sube 2. Otra vez y Difícil se repiten en la sesión.
// Dominada desde el escalón 3 (≥15 días). 3 fallos seguidos → marcada para editar la pregunta.

const CLAVE = 'memo-semio-v1';
const DIA = 86400000;
export const ESCALERA = [1, 3, 7, 15, 30, 60, 120];
export const DOMINADA = 3; // escalón

export const REGLA = {
  1: { nombre: 'Otra vez', repetir: true, fn: () => 0 },
  2: { nombre: 'Difícil', repetir: true, fn: (e) => Math.max(0, e - 1) },
  3: { nombre: 'Bien', repetir: false, fn: (e) => Math.min(ESCALERA.length - 1, e + 1) },
  4: { nombre: 'Fácil', repetir: false, fn: (e) => Math.min(ESCALERA.length - 1, e + 2) },
};

let estado = cargar();

function cargar() {
  try { return JSON.parse(localStorage.getItem(CLAVE)) || { tarjetas: {} }; }
  catch { return { tarjetas: {} }; }
}
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch { /* modo privado: solo en memoria */ }
}

export function info(id) { return estado.tarjetas[id] || null; }
export function vence(id, ahora = Date.now()) { const t = estado.tarjetas[id]; return !t || t.due <= ahora; }

// escalón actual; una tarjeta nueva está "antes" del escalón 0
const escalon = (t) => (t ? t.esc : -1);

export function previsualizar(id, nota) {
  return ESCALERA[REGLA[nota].fn(escalon(estado.tarjetas[id]))];
}

export function calificar(id, nota) {
  const t = estado.tarjetas[id] || { esc: -1, reps: 0, racha: 0 };
  t.esc = REGLA[nota].fn(escalon(t));
  t.reps += 1;
  t.racha = REGLA[nota].repetir ? (t.racha || 0) + 1 : 0;
  t.editar = t.racha >= 3;
  t.due = Date.now() + ESCALERA[t.esc] * DIA;
  t.ult = Date.now();
  estado.tarjetas[id] = t;
  guardar();
  return { ...t, repetirHoy: REGLA[nota].repetir };
}

export function nivel(id) {
  const t = estado.tarjetas[id];
  if (!t) return 'nueva';
  return t.esc >= DOMINADA ? 'dominada' : 'aprendiendo';
}

export function exportar() { return JSON.stringify(estado, null, 1); }
export function importar(texto) {
  const e = JSON.parse(texto);
  if (!e || typeof e.tarjetas !== 'object') throw new Error('archivo inválido');
  estado = e; guardar();
}
export function textoIntervalo(d) {
  if (d === 1) return 'mañana';
  if (d < 30) return `${d} días`;
  return `${Math.round(d / 30)} mes${d >= 60 ? 'es' : ''}`;
}
