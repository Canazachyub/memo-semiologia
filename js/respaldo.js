// Respaldo completo: todas las claves `memo-semio-*` de localStorage (repaso, juego, plan, ajustes,
// mías, entrenar, métodos…) en un solo archivo JSON. Dueño: paquete C.
// API: exportar() importar(txt, {reemplazar}) resumen(txt) descargar() compartir() ultimo()
//      diasSinRespaldo() necesitaRecordatorio() posponer() hayPrevio() deshacerImportacion()
const PREFIJO = 'memo-semio-';
const META = 'memo-semio-respaldo';            // {ultimo: ms, pospuesto: ms} — no viaja en el archivo
const PREVIO = 'memo-semio-respaldo-previo';   // copia automática antes de importar — tampoco viaja
const NO_EXPORTAR = new Set([META, PREVIO]);
const DIAS_RECORDATORIO = 7;

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignora */ } },
  claves() { try { return Object.keys(localStorage); } catch { return []; } },
};
const meta = () => { try { return JSON.parse(ls.get(META)) || {}; } catch { return {}; } };
const guardarMeta = (m) => ls.set(META, JSON.stringify({ ...meta(), ...m }));

/** Claves propias de la app que entran en el respaldo. */
export function claves() {
  return ls.claves().filter((k) => k.startsWith(PREFIJO) && !NO_EXPORTAR.has(k)).sort();
}

/** Texto JSON con todo el progreso. Formato v2: {app, version: 2, fecha, datos: {clave: valorJSON}, textos: {clave: textoPlano}}. */
export function exportar() {
  const o = { app: 'memo-semiologia', version: 2, v: 2, fecha: new Date().toISOString(), datos: {}, textos: {} };
  for (const k of claves()) {
    const v = ls.get(k);
    if (v == null) continue;
    try { o.datos[k] = JSON.parse(v); } catch { o.textos[k] = v; } // texto plano (p. ej. tema 'dark', vista 'tabla')
  }
  return JSON.stringify(o, null, 1);
}

function leerArchivo(txt) {
  let o;
  try { o = typeof txt === 'string' ? JSON.parse(txt) : txt; } catch { throw new Error('el archivo no es JSON válido'); }
  if (!o || typeof o !== 'object') throw new Error('archivo inválido');
  const propias = (obj) => Object.fromEntries(Object.entries(obj && typeof obj === 'object' ? obj : {})
    .filter(([k]) => k.startsWith(PREFIJO) && !NO_EXPORTAR.has(k)));
  if (o.app === 'memo-semiologia' && o.datos && typeof o.datos === 'object') {
    return { formato: 'v2', fecha: o.fecha || null, datos: propias(o.datos), textos: propias(o.textos) };
  }
  if (o.tarjetas) return { formato: 'v1', fecha: null, datos: { 'memo-semio-v1': o }, textos: {} }; // formato antiguo (solo repaso)
  throw new Error('no parece un respaldo de Memo Semiología');
}

/** Vista previa sin importar: {formato, fecha, claves: [], tarjetas}. */
export function resumen(txt) {
  const r = leerArchivo(txt);
  const t = r.datos['memo-semio-v1']?.tarjetas;
  return { formato: r.formato, fecha: r.fecha, claves: [...Object.keys(r.datos), ...Object.keys(r.textos)], tarjetas: t ? Object.keys(t).length : 0 };
}

/**
 * Importa un respaldo. Antes guarda una copia de lo actual (deshacerImportacion la restaura).
 * reemplazar=true borra las claves `memo-semio-*` que no vienen en el archivo.
 */
export function importar(txt, { reemplazar = false } = {}) {
  const r = leerArchivo(txt);
  ls.set(PREVIO, exportar());
  if (reemplazar) for (const k of claves()) if (!(k in r.datos) && !(k in r.textos)) ls.del(k);
  let n = 0;
  for (const [k, v] of Object.entries(r.datos)) if (ls.set(k, JSON.stringify(v))) n++;
  for (const [k, v] of Object.entries(r.textos)) if (ls.set(k, String(v))) n++;
  return { formato: r.formato, claves: n, fecha: r.fecha };
}

export const hayPrevio = () => !!ls.get(PREVIO);
export function deshacerImportacion() {
  const p = ls.get(PREVIO);
  if (!p) return false;
  importar(p, { reemplazar: true });
  ls.del(PREVIO);
  return true;
}

const nombreArchivo = () => `memo-semiologia-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
const marcar = () => guardarMeta({ ultimo: Date.now(), pospuesto: 0 });

/** Descarga el archivo y marca la fecha del último respaldo. */
export function descargar() {
  const url = URL.createObjectURL(new Blob([exportar()], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombreArchivo() });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  marcar();
}

/** En el celular: comparte el archivo (Drive, WhatsApp, correo…). Devuelve false si no se puede. */
export async function compartir() {
  try {
    const f = new File([exportar()], nombreArchivo(), { type: 'application/json' });
    if (!navigator.canShare?.({ files: [f] })) return false;
    await navigator.share({ files: [f], title: 'Respaldo Memo Semiología' });
    marcar();
    return true;
  } catch (e) {
    if (e?.name === 'AbortError') return true; // el usuario cerró la hoja de compartir
    return false;
  }
}
export const puedeCompartir = () => {
  try { return !!navigator.canShare?.({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] }); } catch { return false; }
};

export const ultimo = () => meta().ultimo || null;
export function diasSinRespaldo() {
  const u = ultimo();
  return u ? Math.floor((Date.now() - u) / 864e5) : null;
}
/** true si hay progreso de repaso guardado y pasaron más de 7 días (o nunca) desde el último respaldo. */
export function necesitaRecordatorio(dias = DIAS_RECORDATORIO) {
  const m = meta();
  if (m.pospuesto && Date.now() < m.pospuesto) return false;
  const progreso = ls.get('memo-semio-v1');
  if (!progreso || progreso.length < 40) return false; // aún no hay nada que perder
  const d = diasSinRespaldo();
  return d == null || d >= dias;
}
/** "Más tarde": no vuelve a recordar hasta dentro de `dias` días. */
export function posponer(dias = 2) { guardarMeta({ pospuesto: Date.now() + dias * 864e5 }); }
