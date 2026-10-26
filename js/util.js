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

/** Respuesta háptica breve en el celular (si el navegador la permite y no está "reducir movimiento").
 *  tipo: 'toque' | 'bien' | 'mal' | 'logro'. */
export function haptico(tipo = 'toque') {
  try {
    if (!navigator.vibrate || document.documentElement.classList.contains('sin-mov')) return;
    navigator.vibrate({ toque: 8, bien: [12, 40, 18], mal: [40, 30, 40], logro: [15, 50, 15, 50, 30] }[tipo] || 8);
  } catch { /* sin vibración */ }
}
