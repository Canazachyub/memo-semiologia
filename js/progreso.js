// Progreso por sección (P1) y carga de los próximos días (P2). Dueño: paquete A (ver tools/PLAN_MEJORAS.md).
// "Medir la retención: porcentaje de aciertos por tema" (#058, #067). "Bitácora por tema: estudiado → guía →
// repasos 1, 2, 3 → examen de prueba" (#031, #015, #067). "Fecha del último repaso y del próximo" (#024).
import { esc } from './util.js';
import * as plan from './plan.js';

const SIM_HIST = 'memo-semio-simulacros';
const leer = (k, v) => { try { return JSON.parse(localStorage.getItem(k)) ?? v; } catch { return v; } };
const sem = (p) => (p == null ? '⚪' : p >= 90 ? '🟢' : p >= 60 ? '🟡' : '🔴');

export function crearProgreso({ ATLAS, MEMO, srs, tarjetas, raiz }) {
  const grupos = [...ATLAS.secciones.map((s) => ({ id: s.id, t: `${s.icono} ${s.titulo.replace(/^\d+ · /, '')}` })),
    { id: 'escalas', t: '📏 Escalas' }, { id: 'siglas', t: '🔤 Siglas' }, { id: 'facies', t: '🙂 Facies' }, { id: 'casos', t: '🩺 Casos clínicos' }];

  function stats(lista, desde) {
    const dias = new Set(); let ok = 0, n = 0;
    for (const t of lista) {
      const h = srs.info(t.id)?.hist || [];
      for (const [d, nota, fuente] of h) {
        if (fuente === 'previo') continue;
        dias.add(d);
        if (d >= desde) { n++; if (nota >= 3) ok++; }
      }
    }
    return { repasos: dias.size, ret: n ? Math.round((100 * ok) / n) : null, n };
  }
  function ultimoSimulacro() {
    const out = {};
    for (const s of leer(SIM_HIST, [])) for (const [sid, [o, n]] of Object.entries(s.secs || {})) out[sid] = { pct: Math.round((100 * o) / n), fecha: s.fecha };
    return out;
  }

  function pintar() {
    const cuenta = (lista) => lista.reduce((a, t) => (a[srs.nivel(t.id)]++, a), { nueva: 0, aprendiendo: 0, dominada: 0 });
    const total = cuenta(tarjetas);
    const desde = srs.fecha(srs.inicioDia(-29));
    const glob = stats(tarjetas, desde);
    const sims = ultimoSimulacro();
    const editar = tarjetas.filter((t) => srs.info(t.id)?.editar);

    // P2: carga de los próximos 7 días (+ atrasadas)
    const lim = [...Array(8)].map((_, i) => srs.inicioDia(i + 1));
    let atrasadas = 0; const carga = Array(7).fill(0);
    for (const t of tarjetas) {
      const i = srs.info(t.id); if (!i) continue;
      if (i.due < srs.inicioDia(0)) { atrasadas++; continue; }
      const k = lim.findIndex((x) => i.due < x);
      if (k >= 0 && k < 7) carga[k]++;
    }
    carga[0] += atrasadas;
    const max = Math.max(1, ...carga);
    const dname = (i) => (i === 0 ? 'hoy' : i === 1 ? 'mañana' : new Date(srs.inicioDia(i)).toLocaleDateString(undefined, { weekday: 'short' }));

    const filas = grupos.map((g) => {
      const l = tarjetas.filter((t) => t.sec === g.id); if (!l.length) return '';
      const c = cuenta(l), s = stats(l, desde), est = plan.fechaEstudiada(g.id), sim = sims[g.id];
      return `<tr><td>${esc(g.t)}</td><td>${est ? `✅ ${new Date(est).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : g.id === 'casos' ? '—' : '<span class="vacio">no</span>'}</td>
        <td>${s.repasos || '<span class="vacio">0</span>'}</td><td>${sem(s.ret)} ${s.ret == null ? '<span class="vacio">—</span>' : `${s.ret} %`}</td>
        <td>${sim ? `${sem(sim.pct)} ${sim.pct} %` : '<span class="vacio">—</span>'}</td><td>${c.dominada}/${l.length}</td></tr>`;
    }).join('');

    raiz.innerHTML = `<div class="kpis">
        <div class="kpi"><b>${tarjetas.length}</b><span>tarjetas</span></div>
        <div class="kpi"><b style="color:var(--ok)">${total.dominada}</b><span>dominadas (repaso ≥15 días)</span></div>
        <div class="kpi"><b style="color:#d97706">${total.aprendiendo}</b><span>aprendiendo</span></div>
        <div class="kpi"><b>${sem(glob.ret)} ${glob.ret == null ? '—' : `${glob.ret} %`}</b><span>retención 30 días (${glob.n} respuestas)</span></div>
        <div class="kpi"><b style="color:var(--memo)">${Object.keys(MEMO).length}</b><span>datos con técnica de memoria</span></div></div>

      <h3 class="pg-h">📆 Próximos 7 días</h3>
      <div class="pg-carga" role="img" aria-label="Tarjetas que vencen: ${carga.map((n, i) => `${dname(i)} ${n}`).join(', ')}">
        ${carga.map((n, i) => `<div class="pg-dia"><span class="pg-n">${n}</span><div class="pg-col"><i style="height:${(100 * n) / max}%" class="${i === 0 && atrasadas ? 'atr' : ''}"></i></div><span>${dname(i)}</span></div>`).join('')}
      </div>
      ${atrasadas ? `<p class="vacio">Hoy incluye <b>${atrasadas}</b> atrasadas.</p>` : ''}

      ${editar.length ? `<div class="pg-editar"><b>✏️ Para editar (${editar.length})</b> — fallaron 3 días seguidos: reescríbelas o recodifícalas.
        <button class="btn" data-pg-editar>Abrir bandeja</button></div>` : ''}

      <h3 class="pg-h">📒 Bitácora por sección</h3>
      <div class="pg-scroll"><table class="pg-tabla"><thead><tr><th>Sección</th><th>📖 estudiada</th><th>repasos</th><th>% retención 30 d</th><th>último simulacro</th><th>dominadas</th></tr></thead>
        <tbody>${filas}</tbody></table></div>
      <p class="vacio pg-ley">Retención = primeras respuestas del día con 🟢/🔵 sobre el total · 🟢 ≥ 90 % · 🟡 60-89 % · 🔴 &lt; 60 %. Repasos = días distintos con calificaciones.</p>

      <h3 class="pg-h">📊 Dominio por sección</h3>
      <div class="prog">${grupos.map((g) => {
        const l = tarjetas.filter((t) => t.sec === g.id); if (!l.length) return '';
        const c = cuenta(l); const p = (x) => (100 * x / l.length).toFixed(1);
        return `<div class="pbar"><div class="t"><span>${esc(g.t)}</span><span>${c.dominada}/${l.length} dominadas</span></div>
          <div class="b"><i style="width:${p(c.dominada)}%;background:var(--ok)"></i><i style="width:${p(c.aprendiendo)}%;background:#f59e0b"></i></div></div>`;
      }).join('')}</div>`;
  }
  raiz.addEventListener('click', (e) => {
    if (e.target.closest('[data-pg-editar]')) {
      window.dispatchEvent(new CustomEvent('memo:repaso', { detail: { modo: 'editar' } }));
      window.dispatchEvent(new CustomEvent('memo:vista', { detail: { vista: 'repaso' } }));
    }
  });
  return { pintar };
}
