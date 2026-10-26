// Progreso por sección (P1) y carga de los próximos días (P2). Dueño: paquete A (ver tools/PLAN_MEJORAS.md).
// "Medir la retención: porcentaje de aciertos por tema" (#058, #067). "Bitácora por tema: estudiado → guía →
// repasos 1, 2, 3 → examen de prueba" (#031, #015, #067). "Fecha del último repaso y del próximo" (#024).
// Diseño v2: KPIs con mini-gráficos, mapa de actividad (sale de srs hist: primera respuesta de cada día por
// tarjeta, máx. 20 días por tarjeta), próximos 7 días tocables con desglose por sección, anillos de dominio
// y bitácora que en el celular pasa a tarjetas.
import { esc, haptico } from './util.js';
import * as plan from './plan.js';

const SIM_HIST = 'memo-semio-simulacros';
const DIA = 86400000;
const SEMANAS = 20;
const leer = (k, v) => { try { return JSON.parse(localStorage.getItem(k)) ?? v; } catch { return v; } };
const sem = (p) => (p == null ? '⚪' : p >= 90 ? '🟢' : p >= 60 ? '🟡' : '🔴');
const fCorta = (ms, op = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(ms).toLocaleDateString(undefined, op);

/** Anillo SVG apilado: partes = [{ v: 0-100, cls }] */
function anillo(partes, centro = '', cls = '') {
  let acum = 0;
  const arcos = partes.filter((p) => p.v > 0).map((p) => {
    const s = `<circle class="pg-arco ${p.cls}" cx="18" cy="18" r="15.9155" stroke-dasharray="${p.v.toFixed(2)} ${(100 - p.v).toFixed(2)}" stroke-dashoffset="${(-acum).toFixed(2)}"/>`;
    acum += p.v; return s;
  }).join('');
  return `<span class="pg-anillo ${cls}" aria-hidden="true"><svg viewBox="0 0 36 36"><g transform="rotate(-90 18 18)"><circle class="pg-pista" cx="18" cy="18" r="15.9155"/>${arcos}</g></svg>${centro ? `<b>${centro}</b>` : ''}</span>`;
}

export function crearProgreso({ ATLAS, MEMO, srs, tarjetas, raiz }) {
  const grupos = [...ATLAS.secciones.map((s) => ({ id: s.id, t: `${s.icono} ${s.titulo.replace(/^\d+ · /, '')}` })),
    { id: 'escalas', t: '📏 Escalas' }, { id: 'siglas', t: '🔤 Siglas' }, { id: 'facies', t: '🙂 Facies' }, { id: 'casos', t: '🩺 Casos clínicos' }];
  const nombreSec = (sid) => grupos.find((g) => g.id === sid)?.t || sid;
  let selDia = 0;
  let semana = null; // datos de los próximos 7 días para el detalle tocable

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
  /** { 'AAAA-MM-DD': tarjetas calificadas ese día } desde la bitácora de srs (todas las tarjetas, también palacios). */
  function actividad() {
    const m = {};
    let todas = {}; try { todas = srs.todas() || {}; } catch { /* sin srs */ }
    for (const t of Object.values(todas)) for (const e of (t && Array.isArray(t.hist) ? t.hist : [])) if (Array.isArray(e) && e[0]) m[e[0]] = (m[e[0]] || 0) + 1;
    return m;
  }

  function detalleDia(i) {
    if (!semana) return '';
    const n = semana.carga[i];
    const top = Object.entries(semana.porSec[i]).sort((a, b) => b[1] - a[1]);
    const nom = semana.nombreLargo(i);
    return `<p><b>${nom}</b> · ${n ? `${n} tarjeta${n === 1 ? '' : 's'}` : 'nada vence'}${i === 0 && semana.atrasadas ? ` <span class="pg-atr-t">(incluye ${semana.atrasadas} atrasadas)</span>` : ''}</p>
      ${top.length ? `<ul class="pg-secs">${top.slice(0, 5).map(([sid, k]) => `<li><span>${esc(nombreSec(sid))}</span><b>${k}</b></li>`).join('')}${top.length > 5 ? `<li class="vacio">+${top.length - 5} secciones más</li>` : ''}</ul>` : `<p class="vacio">${i === 0 ? '🌴 Día libre de repasos.' : 'Buen día para adelantar un tema nuevo.'}</p>`}`;
  }

  function pintar() {
    const cuenta = (lista) => lista.reduce((a, t) => (a[srs.nivel(t.id)]++, a), { nueva: 0, aprendiendo: 0, dominada: 0 });
    const total = cuenta(tarjetas);
    const N = tarjetas.length || 1;
    const desde = srs.fecha(srs.inicioDia(-29));
    const glob = stats(tarjetas, desde);
    const sims = ultimoSimulacro();
    const editar = tarjetas.filter((t) => srs.info(t.id)?.editar);
    const hoy0 = srs.inicioDia(0);
    const diasAtras = (d) => Math.round((hoy0 - new Date(d + 'T00:00').getTime()) / DIA);

    // retención semanal (6 semanas) para el mini-gráfico
    const semRet = Array.from({ length: 6 }, () => ({ ok: 0, n: 0 }));
    for (const t of tarjetas) for (const [d, nota, f] of srs.info(t.id)?.hist || []) {
      if (f === 'previo') continue;
      const da = diasAtras(d); if (da < 0 || da >= 42) continue;
      const w = semRet[5 - Math.floor(da / 7)]; w.n++; if (nota >= 3) w.ok++;
    }
    const ptsRet = semRet.map((s, i) => (s.n ? { i, v: s.ok / s.n } : null)).filter(Boolean);
    const spark = ptsRet.length >= 2
      ? `<svg class="pg-spark" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true"><polyline points="${ptsRet.map((p) => `${(p.i * 20).toFixed(1)},${(30 - p.v * 26).toFixed(1)}`).join(' ')}"/>${ptsRet.map((p) => `<circle cx="${(p.i * 20).toFixed(1)}" cy="${(30 - p.v * 26).toFixed(1)}" r="2.6"/>`).join('')}</svg>` : '';

    // actividad (mapa de calor + días activos)
    const act = actividad();
    const dias30 = Array.from({ length: 30 }, (_, k) => act[srs.fecha(srs.inicioDia(k - 29))] || 0);
    const activos30 = dias30.filter(Boolean).length, max30 = Math.max(1, ...dias30);

    // P2: carga de los próximos 7 días (+ atrasadas)
    const lim = [...Array(8)].map((_, i) => srs.inicioDia(i + 1));
    let atrasadas = 0; const carga = Array(7).fill(0); const porSec = Array.from({ length: 7 }, () => ({}));
    for (const t of tarjetas) {
      const i = srs.info(t.id); if (!i) continue;
      let k;
      if (i.due < hoy0) { atrasadas++; k = 0; } else { k = lim.findIndex((x) => i.due < x); if (k < 0 || k >= 7) continue; }
      carga[k]++; porSec[k][t.sec] = (porSec[k][t.sec] || 0) + 1;
    }
    const max = Math.max(1, ...carga);
    const totalSem = carga.reduce((a, b) => a + b, 0);
    const pico = carga.indexOf(Math.max(...carga));
    const dname = (i) => (i === 0 ? 'hoy' : i === 1 ? 'mañana' : fCorta(srs.inicioDia(i), { weekday: 'short' }));
    semana = { carga, porSec, atrasadas, nombreLargo: (i) => (i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : fCorta(srs.inicioDia(i), { weekday: 'long', day: 'numeric', month: 'short' })) };
    if (selDia > 6) selDia = 0;

    // ---- KPIs ----
    const pDom = (100 * total.dominada) / N, pApr = (100 * total.aprendiendo) / N;
    const kpi = (i, ic, val, lab, der = '', pie = '', cls = '') => `<div class="pg-kpi ds-entra ${cls}" style="--i:${i}">
      <div class="pg-kpi-top"><span class="pg-kpi-ic" aria-hidden="true">${ic}</span>${der}</div>
      <b class="pg-kpi-v">${val}</b><span class="pg-kpi-l">${lab}</span>${pie}</div>`;
    const kpis = [
      kpi(0, '🃏', tarjetas.length, 'tarjetas en total', '',
        `<span class="pg-pila" role="img" aria-label="${total.dominada} dominadas, ${total.aprendiendo} aprendiendo, ${total.nueva} nuevas"><i class="dom" style="width:${pDom.toFixed(1)}%"></i><i class="apr" style="width:${pApr.toFixed(1)}%"></i></span>`),
      kpi(1, '🏆', total.dominada, 'dominadas (repaso ≥ 15 días)', anillo([{ v: pDom, cls: 'dom' }], `${Math.round(pDom)}%`, 'mini'), '', 'k-dom'),
      kpi(2, '🌱', total.aprendiendo, 'aprendiendo', anillo([{ v: pApr, cls: 'apr' }], `${Math.round(pApr)}%`, 'mini'), '', 'k-apr'),
      kpi(3, '🎯', `${glob.ret == null ? '—' : `${glob.ret}<small>%</small>`}`, `retención 30 días · ${sem(glob.ret)} ${glob.n} respuestas`, '',
        spark ? `<span class="pg-kpi-g" title="Retención por semana (últimas 6)">${spark}</span>` : ''),
      kpi(4, '📅', activos30, `días activos de 30`, '',
        `<span class="pg-mini30" aria-hidden="true">${dias30.map((n) => `<i style="height:${n ? Math.max(14, (100 * n) / max30) : 6}%" class="${n ? 'on' : ''}"></i>`).join('')}</span>`),
      kpi(5, '🧠', Object.keys(MEMO).length, 'datos con técnica de memoria', '', '', 'k-memo'),
    ].join('');

    // ---- mapa de calor de actividad ----
    const dow = (new Date(hoy0).getDay() + 6) % 7; // 0 = lunes
    const inicio = srs.inicioDia(-(dow + 7 * (SEMANAS - 1)));
    const celdas = [], meses = [];
    let maxA = 1, activos = 0, totalA = 0;
    for (let k = 0; k < SEMANAS * 7; k++) { const n = act[srs.fecha(srs.inicioDia(k, inicio))] || 0; if (n) { activos++; totalA += n; maxA = Math.max(maxA, n); } }
    let mesPrev = -1;
    for (let w = 0; w < SEMANAS; w++) {
      const lunes = srs.inicioDia(w * 7, inicio), m = new Date(lunes).getMonth();
      meses.push(m !== mesPrev && w < SEMANAS - 1 ? `<span style="grid-column:${w + 1}">${fCorta(lunes, { month: 'short' }).replace('.', '')}</span>` : '');
      mesPrev = m;
      for (let d = 0; d < 7; d++) {
        const ms = srs.inicioDia(w * 7 + d, inicio), f = srs.fecha(ms);
        if (ms > hoy0) { celdas.push('<i class="fut"></i>'); continue; }
        const n = act[f] || 0, l = n ? Math.min(4, Math.ceil((4 * n) / maxA)) : 0;
        celdas.push(`<i class="l${l}${ms === hoy0 ? ' hoy' : ''}" data-d="${f}" data-n="${n}" title="${esc(fCorta(ms))}: ${n} tarjeta${n === 1 ? '' : 's'}"></i>`);
      }
    }
    // rachas de días activos (dentro de la ventana)
    let rachaAct = 0, mejor = 0, run = 0;
    for (let k = 0; k < SEMANAS * 7; k++) { const ms = srs.inicioDia(k, inicio); if (ms > hoy0) break; if (act[srs.fecha(ms)]) { run++; mejor = Math.max(mejor, run); } else run = 0; }
    for (let k = act[srs.fecha(hoy0)] ? 0 : 1; ; k++) { if (act[srs.fecha(srs.inicioDia(-k))]) rachaAct++; else break; if (k > 400) break; }
    const mapa = activos ? `<div class="pg-mapa ds-card">
        <div class="pg-mapa-in">
          <div class="pg-meses" aria-hidden="true">${meses.join('')}</div>
          <div class="pg-dsem" aria-hidden="true"><span>L</span><span></span><span>X</span><span></span><span>V</span><span></span><span>D</span></div>
          <div class="pg-celdas" role="img" aria-label="Actividad de las últimas ${SEMANAS} semanas: ${activos} días activos y ${totalA} tarjetas calificadas">${celdas.join('')}</div>
        </div>
        <div class="pg-mapa-pie">
          <p class="pg-mapa-det" aria-live="polite">Toca un día para ver cuánto estudiaste.</p>
          <span class="pg-ley-calor" aria-hidden="true">menos <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> más</span>
        </div>
        <div class="pg-mapa-st"><span><b>${activos}</b> días activos</span><span><b>${totalA}</b> calificaciones</span><span>🔥 <b>${rachaAct}</b> seguidos</span><span>🏅 mejor: <b>${mejor}</b></span></div>
      </div>`
      : `<div class="pg-vacio ds-card"><span class="pg-vacio-ic" aria-hidden="true">🌱</span><div><b>Aquí crecerá tu mapa de actividad</b>
        <p class="vacio">Cada día que califiques tarjetas se pinta un cuadrito. Empieza hoy y mira cómo se llena.</p>
        <button class="btn pri" data-pg-ir="repaso">🔁 Empezar a repasar</button></div></div>`;

    // ---- próximos 7 días ----
    const barras = carga.map((n, i) => `<button type="button" class="pg-bar${i === selDia ? ' on' : ''}${i === pico && n ? ' pico' : ''}" data-dia="${i}" aria-pressed="${i === selDia}" aria-label="${dname(i)}: ${n} tarjetas${i === 0 && atrasadas ? `, ${atrasadas} atrasadas` : ''}">
        <span class="pg-n">${n}</span><span class="pg-col"><i style="--k:${i};--h:${n ? Math.max(4, (100 * n) / max) : 0}%" class="${i === 0 && atrasadas ? 'atr' : ''}"></i></span><span class="pg-dn">${dname(i)}</span></button>`).join('');

    // ---- dominio por sección (anillos) y bitácora ----
    const secs = grupos.map((g) => ({ g, l: tarjetas.filter((t) => t.sec === g.id) })).filter((x) => x.l.length);
    const anillos = secs.map(({ g, l }, k) => {
      const c = cuenta(l), d = (100 * c.dominada) / l.length, a = (100 * c.aprendiendo) / l.length;
      return `<div class="pg-sec ds-entra" style="--i:${Math.min(k, 12)}" title="${esc(g.t)}: ${c.dominada} dominadas, ${c.aprendiendo} aprendiendo, ${c.nueva} nuevas">
        ${anillo([{ v: d, cls: 'dom' }, { v: a, cls: 'apr' }], `${Math.round(d)}%`)}
        <div><b class="pg-sec-t">${esc(g.t)}</b><span class="pg-sec-s">${c.dominada}/${l.length} dominadas${c.aprendiendo ? ` · ${c.aprendiendo} aprendiendo` : ''}</span></div></div>`;
    }).join('');
    const filas = secs.map(({ g, l }) => {
      const c = cuenta(l), s = stats(l, desde), est = plan.fechaEstudiada(g.id), sim = sims[g.id];
      return `<tr><th scope="row">${esc(g.t)}</th>
        <td data-l="📖 Estudiada">${est ? `✅ ${fCorta(est, { day: 'numeric', month: 'short' })}` : g.id === 'casos' ? '—' : '<span class="vacio">no</span>'}</td>
        <td data-l="🔁 Repasos">${s.repasos || '<span class="vacio">0</span>'}</td>
        <td data-l="🎯 Retención 30 d">${sem(s.ret)} ${s.ret == null ? '<span class="vacio">—</span>' : `${s.ret} %`}</td>
        <td data-l="🧪 Último simulacro">${sim ? `${sem(sim.pct)} ${sim.pct} %` : '<span class="vacio">—</span>'}</td>
        <td data-l="🏆 Dominadas">${c.dominada}/${l.length}</td></tr>`;
    }).join('');

    raiz.innerHTML = `<div class="pg">
      <h2 class="ds-titulo">📊 Tu progreso</h2>
      <p class="ds-sub">${total.dominada} de ${tarjetas.length} tarjetas dominadas · ${glob.ret == null ? 'aún sin respuestas en 30 días' : `${glob.ret} % de retención en 30 días`}</p>
      <div class="pg-kpis">${kpis}</div>

      ${editar.length ? `<div class="pg-editar ds-entra" style="--i:6"><span class="pg-editar-ic" aria-hidden="true">✏️</span><div><b>Para editar (${editar.length})</b><span>Fallaron 3 días seguidos: reescríbelas o recodifícalas.</span></div>
        <button class="btn pri" data-pg-editar>Abrir bandeja</button></div>` : ''}

      <div class="pg-dos">
        <section class="pg-bloque" aria-labelledby="pg-h-sem">
          <h3 class="pg-h" id="pg-h-sem">📆 Próximos 7 días <span class="vacio">${totalSem} tarjetas</span></h3>
          <div class="pg-semana ds-card">
            <div class="pg-carga" role="group" aria-label="Tarjetas que vencen cada día. Toca un día para ver el detalle">${barras}</div>
            <div class="pg-det" aria-live="polite">${detalleDia(selDia)}</div>
          </div>
        </section>
        <section class="pg-bloque" aria-labelledby="pg-h-act">
          <h3 class="pg-h" id="pg-h-act">🗓️ Actividad <span class="vacio">últimas ${SEMANAS} semanas</span></h3>
          ${mapa}
        </section>
      </div>

      <h3 class="pg-h">🎯 Dominio por sección</h3>
      <div class="pg-anillos">${anillos}</div>
      <p class="pg-ley-dom vacio"><i class="dom"></i> dominadas <i class="apr"></i> aprendiendo <i class="nue"></i> nuevas</p>

      <h3 class="pg-h">📒 Bitácora por sección</h3>
      <div class="pg-scroll"><table class="pg-tabla"><thead><tr><th scope="col">Sección</th><th scope="col">📖 estudiada</th><th scope="col">repasos</th><th scope="col">% retención 30 d</th><th scope="col">último simulacro</th><th scope="col">dominadas</th></tr></thead>
        <tbody>${filas}</tbody></table></div>
      <p class="vacio pg-ley">Retención = primeras respuestas del día con 🟢/🔵 sobre el total · 🟢 ≥ 90 % · 🟡 60-89 % · 🔴 &lt; 60 %. Repasos = días distintos con calificaciones.</p>
    </div>`;
  }

  raiz.addEventListener('click', (e) => {
    if (e.target.closest('[data-pg-editar]')) {
      window.dispatchEvent(new CustomEvent('memo:repaso', { detail: { modo: 'editar' } }));
      window.dispatchEvent(new CustomEvent('memo:vista', { detail: { vista: 'repaso' } }));
      return;
    }
    const ir = e.target.closest('[data-pg-ir]');
    if (ir) { window.dispatchEvent(new CustomEvent('memo:vista', { detail: { vista: ir.dataset.pgIr } })); return; }
    const bar = e.target.closest('.pg-bar');
    if (bar) {
      selDia = +bar.dataset.dia; haptico('toque');
      raiz.querySelectorAll('.pg-bar').forEach((x) => { const on = x === bar; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
      const det = raiz.querySelector('.pg-det'); if (det) det.innerHTML = detalleDia(selDia);
      return;
    }
    const cel = e.target.closest('.pg-celdas [data-d]');
    if (cel) {
      raiz.querySelectorAll('.pg-celdas .sel').forEach((x) => x.classList.remove('sel'));
      cel.classList.add('sel');
      const n = +cel.dataset.n, f = new Date(cel.dataset.d + 'T12:00');
      const det = raiz.querySelector('.pg-mapa-det');
      if (det) det.innerHTML = `<b>${esc(fCorta(f, { weekday: 'long', day: 'numeric', month: 'long' }))}</b> · ${n ? `${n} tarjeta${n === 1 ? '' : 's'} calificada${n === 1 ? '' : 's'}` : 'sin actividad'}`;
    }
  });
  return { pintar };
}
