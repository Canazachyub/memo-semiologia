// Estado del modo juego (XP, niveles, capturas, racha diaria, logros y gimnasios conquistados).
// Compartido: otros módulos pueden importarlo. Se guarda en localStorage 'memo-semio-juego';
// todo acceso va en try/catch (en modo privado el juego funciona solo en memoria).

const CLAVE = 'memo-semio-juego';
const DIA = 86400000;

const vacio = () => ({ v: 1, xp: 0, capturas: {}, logros: {}, conquistas: {}, racha: { n: 0, ult: null, mejor: 0 }, stats: { aciertos: 0, fallos: 0, enLugar: 0, desafios: 0, perfectos: 0 }, historial: [] });

let estado = cargar();
const oyentes = new Set();

function cargar() {
  try {
    const e = JSON.parse(localStorage.getItem(CLAVE));
    if (e && typeof e === 'object') {
      const b = vacio();
      return { ...b, ...e, racha: { ...b.racha, ...e.racha }, stats: { ...b.stats, ...e.stats } };
    }
  } catch { /* sin acceso a localStorage */ }
  return vacio();
}
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch { /* modo privado: solo en memoria */ }
}
function emitir(tipo, datos) {
  oyentes.forEach((fn) => { try { fn(tipo, datos); } catch (e) { console.error(e); } });
}

/** Suscribirse a eventos: 'xp', 'nivel' (subió de nivel), 'captura', 'logro', 'conquista', 'racha'. Devuelve la función para cancelar. */
export function suscribir(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }

// ---------- niveles ----------
// Para pasar del nivel n al n+1 hacen falta 100 + 60·(n−1) XP (curva suave, lineal por nivel).
const costo = (n) => 100 + 60 * (n - 1);
function calcNivel(xp) {
  let n = 1, base = 0;
  while (xp >= base + costo(n)) { base += costo(n); n += 1; }
  return { n, xp, base, siguiente: base + costo(n), progreso: (xp - base) / costo(n) };
}
/** → { n, xp, siguiente, base, progreso (0-1) } */
export function nivel() { return calcNivel(estado.xp); }

/** Suma XP. → { ganado, nivel, subio } */
export function sumarXP(cantidad, motivo = '') {
  const c = Math.max(0, Math.round(+cantidad || 0));
  const antes = calcNivel(estado.xp).n;
  estado.xp += c;
  estado.historial.push({ t: Date.now(), xp: c, motivo });
  if (estado.historial.length > 60) estado.historial.splice(0, estado.historial.length - 60);
  guardar();
  const niv = calcNivel(estado.xp);
  emitir('xp', { ganado: c, motivo, nivel: niv });
  if (niv.n > antes) emitir('nivel', niv);
  return { ganado: c, nivel: niv, subio: niv.n > antes };
}

// ---------- capturas ----------
/** Marca un dato (id de fila o escala) como capturado. → true si es nueva. */
export function capturar(id) {
  if (estado.capturas[id]) return false;
  estado.capturas[id] = Date.now();
  guardar();
  emitir('captura', { id });
  return true;
}
export function capturado(id) { return !!estado.capturas[id]; }
export function capturas() { return Object.keys(estado.capturas); }
export function totalCapturas() { return Object.keys(estado.capturas).length; }

// ---------- racha diaria ----------
const hoyStr = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / DIA);

/** Registra que hoy se jugó. Actualiza la racha. → días de racha. */
export function registrarActividad() {
  const hoy = hoyStr();
  const r = estado.racha;
  if (r.ult === hoy) return r.n;
  r.n = r.ult && diasEntre(r.ult, hoy) === 1 ? r.n + 1 : 1;
  r.ult = hoy;
  r.mejor = Math.max(r.mejor || 0, r.n);
  guardar();
  emitir('racha', { n: r.n });
  return r.n;
}
/** Días de racha vigente (0 si se cortó: el último día jugado no fue hoy ni ayer). */
export function racha() {
  const r = estado.racha;
  if (!r.ult) return 0;
  return diasEntre(r.ult, hoyStr()) <= 1 ? r.n : 0;
}
export function mejorRacha() { return estado.racha.mejor || 0; }

// ---------- logros ----------
/** → [{ id, t }] de los logros desbloqueados, del más antiguo al más nuevo. */
export function logros() { return Object.entries(estado.logros).map(([id, t]) => ({ id, t })).sort((a, b) => a.t - b.t); }
export function tieneLogro(id) { return !!estado.logros[id]; }
/** Desbloquea un logro. → true si es nuevo (y emite 'logro'). */
export function desbloquear(id, datos = {}) {
  if (estado.logros[id]) return false;
  estado.logros[id] = Date.now();
  guardar();
  emitir('logro', { id, ...datos });
  return true;
}

// ---------- gimnasios ----------
export function conquistar(sid) {
  const nuevo = !estado.conquistas[sid];
  estado.conquistas[sid] = Date.now();
  guardar();
  if (nuevo) emitir('conquista', { sid });
  return nuevo;
}
export function conquistado(sid) { return !!estado.conquistas[sid]; }

// ---------- estadísticas ----------
export function stats() { return { ...estado.stats }; }
export function contar(campo, n = 1) { estado.stats[campo] = (estado.stats[campo] || 0) + n; guardar(); return estado.stats[campo]; }

// ---------- copia de seguridad ----------
export function exportar() { return JSON.stringify(estado, null, 1); }
export function importar(texto) {
  const e = JSON.parse(texto);
  if (!e || typeof e.capturas !== 'object') throw new Error('archivo inválido');
  estado = { ...vacio(), ...e }; guardar();
  emitir('xp', { ganado: 0, nivel: nivel() });
}
export function reiniciar() { estado = vacio(); guardar(); emitir('xp', { ganado: 0, nivel: nivel() }); }

// ---------- última memoparada visitada (para reubicar el avatar) ----------
export function marcarParada(id) { estado.ultima = id; guardar(); }
export function ultimaParada() { return estado.ultima || null; }
