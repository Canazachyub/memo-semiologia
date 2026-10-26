// Escenas, anclas y notas propias del usuario por dato. Dueño: paquete B.
const CLAVE = 'memo-semio-mias';
const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; } };
export function get(ref) { return leer()[ref] || null; }
export function set(ref, obj) { const t = leer(); if (obj) t[ref] = { ...obj, ts: Date.now() }; else delete t[ref]; try { localStorage.setItem(CLAVE, JSON.stringify(t)); } catch { /* sin almacenamiento */ } }
export function todas() { return leer(); }
