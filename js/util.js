// Utilidades compartidas por todas las vistas.
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// cifras y umbrales en negrita
export function resaltar(t) {
  return esc(t).replace(/([<>≥≤]=?\s?)?\d+(?:[.,]\d+)?(?:\s?[-–]\s?\d+(?:[.,]\d+)?)?/g, '<b>$&</b>');
}
export function celda(c) {
  if (!c || !c.t) return '<span class="vacio">—</span>';
  return c.lit ? `<span class="lit">${resaltar(c.t)}<sup>lit.</sup></span>` : resaltar(c.t);
}
