// Utilidades compartidas por el modo juego (juego.js y juego-caza.js): texto, azar, geometría y confetti.

export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
export const resaltar = (t) => esc(t).replace(/([<>≥≤]=?\s?)?\d+(?:[.,]\d+)?(?:\s?[-–]\s?\d+(?:[.,]\d+)?)?/g, '<b>$&</b>');
export const barajar = (a, rnd = Math.random) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
export const azar = (a, rnd = Math.random) => a[Math.floor(rnd() * a.length)];
export const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
export const sinMov = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const numeros = (t) => (String(t).match(/\d+(?:[.,]\d+)?/g) || []).map((x) => x.replace(',', '.'));

/** Generador pseudoaleatorio con semilla de texto (cyrb128 + mulberry32): misma semilla → misma secuencia. */
export function azarSemilla(texto) {
  let h = 1779033703 ^ String(texto).length;
  for (let i = 0; i < String(texto).length; i++) { h = Math.imul(h ^ String(texto).charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Elige un elemento con probabilidad proporcional a peso(x). */
export function ponderado(lista, peso, rnd = Math.random) {
  const w = lista.map((x) => Math.max(0, +peso(x) || 0));
  const tot = w.reduce((a, b) => a + b, 0);
  if (!tot) return lista.length ? azar(lista, rnd) : null;
  let r = rnd() * tot;
  for (let i = 0; i < lista.length; i++) { r -= w[i]; if (r <= 0) return lista[i]; }
  return lista[lista.length - 1];
}

// ---------- geometría (metros en plano local; suficiente a escala de ciudad) ----------
const M = 111320;
export const aLL = (p) => {
  if (Array.isArray(p) && Number.isFinite(+p[0]) && Number.isFinite(+p[1])) return [+p[0], +p[1]];
  if (p && Number.isFinite(+p.lat) && Number.isFinite(+(p.lng ?? p.lon))) return [+p.lat, +(p.lng ?? p.lon)];
  return null;
};
export function metros(a, b) {
  const k = Math.cos(((a[0] + b[0]) / 2) * Math.PI / 180);
  return Math.hypot((b[1] - a[1]) * k * M, (b[0] - a[0]) * M);
}
export const mezclar = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export function desplazar(ll, dist, ang) {
  return [ll[0] + (dist * Math.cos(ang)) / M, ll[1] + (dist * Math.sin(ang)) / (M * Math.cos(ll[0] * Math.PI / 180))];
}
export function crearRuta(pts) {
  const acum = [0];
  for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1] + metros(pts[i - 1], pts[i]));
  const largo = acum[acum.length - 1] || 0;
  function proyectar(p) {
    let mejor = { d: Infinity, s: 0 };
    const k = Math.cos(p[0] * Math.PI / 180);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const ax = a[1] * k, ay = a[0], bx = b[1] * k, by = b[0], px = p[1] * k, py = p[0];
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
      const q = mezclar(a, b, t), d = metros(p, q);
      if (d < mejor.d) mejor = { d, s: acum[i] + t * (acum[i + 1] - acum[i]) };
    }
    return mejor;
  }
  function punto(s) {
    s = Math.max(0, Math.min(largo, s));
    let i = 0;
    while (i < pts.length - 2 && acum[i + 1] < s) i++;
    const seg = acum[i + 1] - acum[i];
    return mezclar(pts[i], pts[i + 1] || pts[i], seg ? (s - acum[i]) / seg : 0);
  }
  function tramo(s0, s1) {
    const out = [punto(s0)];
    if (s1 >= s0) { for (let i = 0; i < pts.length; i++) if (acum[i] > s0 && acum[i] < s1) out.push(pts[i]); }
    else { for (let i = pts.length - 1; i >= 0; i--) if (acum[i] < s0 && acum[i] > s1) out.push(pts[i]); }
    out.push(punto(s1));
    return out;
  }
  return { pts, largo, proyectar, punto, tramo };
}

// ---------- confetti propio (canvas, ~2,5 s) ----------
export function confetti(colores, cantidad = 160) {
  if (sinMov()) return;
  const c = document.createElement('canvas');
  c.className = 'jg-confetti';
  c.setAttribute('aria-hidden', 'true');
  document.body.appendChild(c);
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = (c.width = innerWidth * dpr), H = (c.height = innerHeight * dpr);
  const ctx = c.getContext('2d');
  const piezas = Array.from({ length: cantidad }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35, vx: (Math.random() - 0.5) * 26 * dpr, vy: (-Math.random() * 22 - 8) * dpr,
    w: (6 + Math.random() * 7) * dpr, h: (4 + Math.random() * 6) * dpr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    c: azar(colores), forma: Math.random() < 0.3 ? 'o' : 'r',
  }));
  const t0 = performance.now();
  (function paso(t) {
    const dt = Math.min(2, (t - (paso.u || t)) / 16.7); paso.u = t;
    ctx.clearRect(0, 0, W, H);
    const vida = (t - t0) / 2600;
    piezas.forEach((p) => {
      p.vy += 0.55 * dpr * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - vida * vida); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      if (p.forma === 'o') { ctx.beginPath(); ctx.arc(0, 0, p.h / 2, 0, 7); ctx.fill(); } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 1);
      ctx.restore();
    });
    if (vida < 1) requestAnimationFrame(paso); else c.remove();
  })(t0);
}
