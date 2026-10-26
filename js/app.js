import * as srs from './srs.js';
import { crearCiudad } from './ciudad.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const [ATLAS, MEMO, METODOS, PALACIOS, SIGLAS, FACIES] = await Promise.all(
  ['data/atlas.json', 'data/memoria.json', 'data/metodos.json', 'data/palacios.json', 'data/memoria_siglas.json', 'data/memoria_facies.json'].map((u) => fetch(u, { cache: 'no-cache' }).then((r) => r.json()).catch(() => ({}))),
);
const FILAS = ATLAS.secciones.flatMap((s) => s.filas.map((f) => ({ ...f, sec: s })));
const nombreMetodo = (k) => METODOS[k]?.nombre || k;

// ---------- utilidades de presentación ----------
function resaltar(t) {
  // cifras y umbrales en negrita
  return esc(t).replace(/([<>≥≤]=?\s?)?\d+(?:[.,]\d+)?(?:\s?[-–]\s?\d+(?:[.,]\d+)?)?/g, '<b>$&</b>');
}
function celda(c) {
  if (!c || !c.t) return '<span class="vacio">—</span>';
  return c.lit ? `<span class="lit">${resaltar(c.t)}<sup>lit.</sup></span>` : resaltar(c.t);
}

function panelMemoria(m) {
  if (!m) return '';
  const tec = (m.tecnicas || []).map((k) => `<span>${esc(METODOS[k]?.icono || '🧩')} ${esc(nombreMetodo(k))}</span>`).join('');
  const cod = (m.codigo || []).map((c) =>
    `<div class="cod"><div class="num">${esc(c.numero)}</div><div class="let">${esc(c.letras || '')}</div><div class="pal">${esc(c.palabra)}</div></div>`).join('');
  // ruta_palacio: lista de {lugar, imagen} o texto "Palacio > Habitación > 01 Ubicación | …"
  const pasos = typeof m.ruta_palacio === 'string'
    ? m.ruta_palacio.split('|').map((s) => ({ lugar: s.trim(), imagen: '' }))
    : (m.ruta_palacio || []);
  const ruta = pasos.length
    ? `<p class="h">🏰 Ruta del palacio</p><ol class="ruta">${pasos.map((r) =>
      `<li><b>${esc(r.lugar)}</b>${r.imagen ? ` → ${esc(r.imagen)}` : ''}</li>`).join('')}</ol>` : '';
  const img = m.imagen ? `<img src="${esc(m.imagen)}" alt="${esc(m.ancla || '')}" loading="lazy" data-zoom>` : '';
  return `<div class="memo ${img ? '' : 'sin-img'}">
    ${img ? `<div>${img}</div>` : ''}
    <div>
      <div class="tec">${tec}</div>
      ${m.estacion && PALACIOS.lugares?.[m.estacion.seccion] ? `<p class="donde">📍 ${PALACIOS.ciudad} · ${esc(PALACIOS.lugares[m.estacion.seccion].icono)} ${esc(PALACIOS.lugares[m.estacion.seccion].lugar)} › <b>${esc(m.estacion.ubicacion)}</b></p>` : ''}
      ${m.por_que ? `<p class="porque">${esc(m.por_que)}</p>` : ''}
      ${cod ? `<div class="codigo">${cod}</div>` : ''}
      ${m.ancla ? `<p class="ancla">⚓ ${esc(m.ancla)}</p>` : ''}
      ${m.acronimo ? `<p class="acr">🔤 <b>${esc(m.acronimo.sigla)}</b> — ${esc(m.acronimo.desarrollo)}</p>` : ''}
      ${m.escena ? `<p class="escena">🎬 ${esc(m.escena)}</p>` : ''}
      ${ruta}
      ${m.revisar ? '<p class="revisar">⚠️ Pendiente de revisión</p>' : ''}
    </div>
  </div>`;
}

// ---------- vista: tabla de valores ----------
let secFiltro = null;
function pintarFiltros() {
  $('#filtro-sec').innerHTML = [`<button class="chip ${secFiltro ? '' : 'on'}" data-s="">Todas</button>`]
    .concat(ATLAS.secciones.map((s) => `<button class="chip ${secFiltro === s.id ? 'on' : ''}" data-s="${s.id}">${s.icono} ${esc(s.titulo.replace(/^\d+ · /, ''))}</button>`))
    .join('');
}
function pintarTabla() {
  const q = norm($('#buscar').value);
  const soloMemo = $('#solo-memo').checked;
  const html = ATLAS.secciones.filter((s) => !secFiltro || s.id === secFiltro).map((s) => {
    const filas = s.filas.filter((f) => {
      if (soloMemo && !MEMO[f.id]) return false;
      if (!q) return true;
      return norm([f.parametro, f.normal?.t, f.sube?.t, f.baja?.t, f.clave?.texto, f.perla].join(' ')).includes(q);
    });
    if (!filas.length) return '';
    return `<div class="sec"><h2 style="background:${s.color}">${s.icono} ${esc(s.titulo)}<span class="n">${filas.length} parámetros · 🧠 ${filas.filter((f) => MEMO[f.id]).length}</span></h2>
      ${filas.map(filaHTML).join('')}</div>`;
  }).join('');
  $('#tabla').innerHTML = html || '<p class="fin">Sin resultados.</p>';
}
function filaHTML(f) {
  const m = MEMO[f.id];
  const alt = f.altura ? `<span class="alt">🏔 ${f.altura.lit ? `<span class="lit">${esc(f.altura.t)}<sup>lit.</sup></span>` : esc(f.altura.t)}</span>` : '';
  const clave = f.clave ? `<div class="clave"><span class="ic">${f.clave.icono}</span>${f.clave.lit ? `<span class="lit">${resaltar(f.clave.texto)}<sup>lit.</sup></span>` : resaltar(f.clave.texto)}${f.perla ? ` · ${resaltar(f.perla)}` : ''}</div>`
    : f.perla ? `<div class="clave">💡 ${resaltar(f.perla)}</div>` : '';
  return `<article class="fila" id="p-${f.id}">
    <div class="fila-cab">
      <div class="p-nom"><span class="nm">${f.icono} ${esc(f.nombre)}</span>
        <button class="memo-btn" data-memo="${f.id}" ${m ? '' : 'disabled title="Aún sin técnica"'}>🧠 ${m ? 'Cómo recordarlo' : 'pronto'}</button></div>
      <div class="c-n"><b class="h">✅ Normal</b><span class="val">${celda(f.normal)}${alt}</span></div>
      <div class="c-u"><b class="h">🔺 Si sube</b><span class="val">${celda(f.sube)}</span></div>
      <div class="c-d"><b class="h">🔻 Si baja</b><span class="val">${celda(f.baja)}</span></div>
    </div>
    ${clave}
    ${panelMemoria(m)}
  </article>`;
}

// ---------- vista: escalas ----------
const COLOR = { N: '#2e7d32', L: '#f9a825', M: '#ef6c00', G: '#c62828' };
function pintarEscalas() {
  const q = norm($('#buscar').value);
  $('#escalas').innerHTML = ATLAS.escalas.filter((e) => !q || norm(JSON.stringify(e)).includes(q)).map((e) => {
    const m = MEMO[e.id];
    return `<article class="esc fila" id="p-${e.id}"><h3>${e.icono || '📏'} ${esc(e.nombre)}</h3><p class="mide">${esc(e.mide || '')}</p>
      <table>${(e.items || []).map(([a, b]) => `<tr><td>${esc(a)}</td><td>${resaltar(b)}</td></tr>`).join('')}</table>
      <div class="sem">${(e.interpretacion || []).map(([p, t, g]) => `<span style="border-color:${COLOR[g] || '#607d8b'}"><b style="background:${COLOR[g] || '#607d8b'}">${esc(p)}</b><i>${esc(t)}</i></span>`).join('')}</div>
      ${e.perla ? `<p class="perla">💡 ${esc(e.perla)}</p>` : ''}
      <button class="memo-btn" data-memo="${e.id}" ${m ? '' : 'disabled'}>🧠 ${m ? 'Cómo recordarla' : 'pronto'}</button>
      ${panelMemoria(m)}</article>`;
  }).join('');
}

// ---------- vista: facies ----------
function pintarFacies() {
  const q = norm($('#buscar').value);
  $('#facies').innerHTML = ATLAS.facies.filter((f) => !q || norm(JSON.stringify(f)).includes(q)).map((f) =>
    `<article class="fac">${f.imagen ? `<img src="${esc(f.imagen)}" alt="Facies ${esc(f.nombre)}" loading="lazy" data-zoom>` : ''}
     <div><b>${esc(f.nombre)}</b>${esc(f.rasgo)}<p class="o">→ ${esc(f.orienta)}</p>
     ${FACIES[f.id] ? `<details class="fmemo"><summary>🧠 Cómo recordarla</summary><p class="ancla">⚓ ${esc(FACIES[f.id].ancla)}</p><p class="escena">🎬 ${esc(FACIES[f.id].escena)}</p></details>` : ''}</div></article>`).join('');
}

// ---------- tarjetas de repaso ----------
function construirTarjetas() {
  const t = [];
  for (const f of FILAS) {
    const m = MEMO[f.id];
    if (m?.preguntas?.length) m.preguntas.forEach((p, i) => t.push({ id: `${f.id}#${i}`, ref: f.id, sec: f.sec.id, q: p.q, a: p.a, m, nombre: f.nombre }));
    else if (f.normal?.t) t.push({ id: `${f.id}#n`, ref: f.id, sec: f.sec.id, q: `${f.nombre}: ¿valor normal?`, a: f.normal.t, m: null, nombre: f.nombre });
  }
  for (const e of ATLAS.escalas) {
    const m = MEMO[e.id];
    if (m?.preguntas?.length) m.preguntas.forEach((p, i) => t.push({ id: `${e.id}#${i}`, ref: e.id, sec: 'escalas', q: p.q, a: p.a, m, nombre: e.nombre }));
  }
  for (const [id, s] of Object.entries(SIGLAS)) (s.preguntas || []).forEach((p, i) => t.push({ id: `sig:${id}#${i}`, ref: id, sec: 'siglas', q: p.q, a: p.a, m: { ancla: s.ancla, escena: s.escena }, nombre: s.sigla }));
  for (const f of ATLAS.facies) { const fm = FACIES[f.id]; (fm?.preguntas || []).forEach((p, i) => t.push({ id: `fac:${f.id}#${i}`, ref: f.id, sec: 'facies', q: p.q, a: p.a, m: { ...fm, imagen: f.imagen }, nombre: f.nombre })); }
  return t;
}
const TARJETAS = construirTarjetas();

let cola = [], actual = null, repSec = '', soloConMemo = true;
function armarCola() {
  const ahora = Date.now();
  const base = TARJETAS.filter((t) => (!repSec || t.sec === repSec) && (!soloConMemo || t.m));
  const vencidas = base.filter((t) => srs.info(t.id) && srs.vence(t.id, ahora));
  const nuevas = base.filter((t) => !srs.info(t.id)).slice(0, 15);
  cola = [...vencidas.sort(() => Math.random() - 0.5), ...nuevas];
}
function pendientes() {
  const n = TARJETAS.filter((t) => t.m && srs.info(t.id) && srs.vence(t.id)).length;
  $('#pend').textContent = n || '';
}
function pintarRepaso() {
  const opciones = [`<option value="">Todo</option>`, ...ATLAS.secciones.map((s) => `<option value="${s.id}" ${repSec === s.id ? 'selected' : ''}>${s.icono} ${esc(s.titulo)}</option>`),
    `<option value="escalas" ${repSec === 'escalas' ? 'selected' : ''}>📏 Escalas</option>`,
    `<option value="siglas" ${repSec === 'siglas' ? 'selected' : ''}>🔤 Siglas</option>`,
    `<option value="facies" ${repSec === 'facies' ? 'selected' : ''}>🙂 Facies</option>`].join('');
  if (!actual) { armarCola(); actual = cola.shift() || null; }
  const top = `<div class="rep-top"><label>Repasar: <select id="rep-sec">${opciones}</select></label>
    <label class="toggle"><input type="checkbox" id="rep-memo" ${soloConMemo ? 'checked' : ''}> <span>Solo con técnica</span></label>
    <span class="vacio">${cola.length + (actual ? 1 : 0)} en cola</span></div>`;
  if (!actual) {
    $('#repaso').innerHTML = top + `<div class="fin"><b>🎉</b>No hay tarjetas pendientes ahora.<br>Vuelve más tarde o elige otro grupo.</div>`;
    return bindRepaso();
  }
  const prev = (n) => srs.textoIntervalo(srs.previsualizar(actual.id, n));
  const m = actual.m;
  const pista = m ? `<div class="pista">${m.ancla ? `⚓ <b>${esc(m.ancla)}</b>` : ''}${m.codigo?.length ? `<br>🔢 ${m.codigo.map((c) => `${esc(c.palabra)} = ${esc(c.numero)}`).join(' · ')}` : ''}${m.escena ? `<br>🎬 ${esc(m.escena)}` : ''}</div>` : '';
  $('#repaso').innerHTML = top + `<div class="tarjeta" id="tarjeta">
    <div class="meta"><span>${esc(actual.nombre)}</span><span>${srs.nivel(actual.id)}</span></div>
    <div class="q">${esc(actual.q)}</div>
    <textarea id="resp" placeholder="Escribe tu respuesta de memoria (recuerdo activo)…"></textarea>
    <div class="btns" id="b-ver"><button class="btn pri" id="ver">Mostrar respuesta (espacio)</button></div>
    <div class="a"><div class="resp">${resaltar(actual.a)}</div>${pista}
      ${m?.imagen ? `<img src="${esc(m.imagen)}" alt="" style="max-width:240px;border-radius:10px;margin-top:10px">` : ''}
      <div class="btns">
        ${[1, 2, 3, 4].map((n) => `<button class="btn r${n}" data-nota="${n}">${srs.REGLA[n].nombre}<small>${prev(n)}</small></button>`).join('')}
      </div></div></div>`;
  bindRepaso();
}
function bindRepaso() {
  $('#rep-sec')?.addEventListener('change', (e) => { repSec = e.target.value; actual = null; pintarRepaso(); });
  $('#rep-memo')?.addEventListener('change', (e) => { soloConMemo = e.target.checked; actual = null; pintarRepaso(); });
  $('#ver')?.addEventListener('click', revelar);
  $$('[data-nota]').forEach((b) => b.addEventListener('click', () => calificar(+b.dataset.nota)));
}
function revelar() { $('#tarjeta')?.classList.add('revelada'); $('#b-ver')?.remove(); }
function calificar(n) {
  const r = srs.calificar(actual.id, n);
  if (r.repetirHoy) cola.push(actual); // Otra vez / Difícil: se repite al final de la sesión
  if (r.editar) $('#repaso').insertAdjacentHTML('afterbegin', `<p class="revisar">✏️ "${esc(actual.q)}" falló 3 veces seguidas: conviene reescribir la pregunta o la escena.</p>`);
  actual = cola.shift() || null;
  pendientes(); pintarRepaso();
}
document.addEventListener('keydown', (e) => {
  if (!$('#v-repaso').classList.contains('on') || !actual || e.target.tagName === 'TEXTAREA' && e.key !== 'Enter') return;
  const rev = $('#tarjeta')?.classList.contains('revelada');
  if (!rev && (e.key === ' ' || (e.key === 'Enter' && e.ctrlKey))) { e.preventDefault(); revelar(); }
  else if (rev && ['1', '2', '3', '4'].includes(e.key)) calificar(+e.key);
});

// ---------- progreso ----------
function pintarProgreso() {
  const grupos = [...ATLAS.secciones.map((s) => ({ id: s.id, t: `${s.icono} ${s.titulo}`, c: s.color })), { id: 'escalas', t: '📏 Escalas', c: '#455a64' }, { id: 'siglas', t: '🔤 Siglas', c: '#455a64' }, { id: 'facies', t: '🙂 Facies', c: '#455a64' }];
  const cuenta = (lista) => lista.reduce((a, t) => (a[srs.nivel(t.id)]++, a), { nueva: 0, aprendiendo: 0, dominada: 0 });
  const total = cuenta(TARJETAS);
  const conMemo = Object.keys(MEMO).length;
  $('#progreso').innerHTML = `<div class="kpis">
      <div class="kpi"><b>${TARJETAS.length}</b><span>tarjetas</span></div>
      <div class="kpi"><b style="color:var(--ok)">${total.dominada}</b><span>dominadas (repaso ≥15 días)</span></div>
      <div class="kpi"><b style="color:#d97706">${total.aprendiendo}</b><span>aprendiendo</span></div>
      <div class="kpi"><b style="color:var(--memo)">${conMemo}</b><span>datos con técnica de memoria</span></div></div>
    <div class="prog">${grupos.map((g) => {
      const l = TARJETAS.filter((t) => t.sec === g.id); if (!l.length) return '';
      const c = cuenta(l); const p = (x) => (100 * x / l.length).toFixed(1);
      return `<div class="pbar"><div class="t"><span>${esc(g.t)}</span><span>${c.dominada}/${l.length} dominadas</span></div>
        <div class="b"><i style="width:${p(c.dominada)}%;background:var(--ok)"></i><i style="width:${p(c.aprendiendo)}%;background:#f59e0b"></i></div></div>`;
    }).join('')}</div>`;
}

// ---------- métodos y siglas ----------
function pintarMetodos() {
  const uso = {};
  Object.values(MEMO).forEach((m) => (m.tecnicas || []).forEach((k) => { uso[k] = (uso[k] || 0) + 1; }));
  $('#metodos').innerHTML = `<p class="porque">Cada dato usa la técnica que mejor encaja con su tipo de información. Las técnicas salen de los videos de Pablo Lomelí y se van puliendo con cada video nuevo.</p>` +
    Object.entries(METODOS).map(([k, m]) => `<div class="met"><h3>${m.icono} ${esc(m.nombre)} <small class="vacio">· usada en ${uso[k] || 0} datos</small></h3>
      <p>${esc(m.que)}</p><p><b>Cuándo:</b> ${esc(m.cuando)}</p>${m.pasos ? `<p><b>Cómo:</b> ${esc(m.pasos)}</p>` : ''}
      <p class="vacio">Fuentes: ${esc(m.fuentes || '')}</p></div>`).join('');
}
function pintarSiglas() {
  const q = norm($('#buscar').value);
  $('#siglas').innerHTML = `<div class="sig">${ATLAS.glosario.map((g) => {
    const it = g.items.filter((i) => !q || norm(i.sigla + ' ' + i.significado).includes(q));
    return it.length ? `<h3>${esc(g.titulo)}</h3>${it.map((i) => { const s = siglaMemo(i.sigla, g.titulo);
      return `<details class="sigm"><summary><b>${esc(i.sigla)}</b> ${esc(i.significado)}</summary>${s ? `<p class="ancla">⚓ ${esc(s.ancla)}</p><p>🎬 ${esc(s.escena)}</p>${(s.confusiones || []).length ? `<p class="vacio">⚠️ ${s.confusiones.map((c) => esc(typeof c === 'string' ? c : `${c.sigla || ''} ${c.clave || c.diferencia || ''}`)).join(' · ')}</p>` : ''}` : ''}</details>`; }).join('')}` : '';
  }).join('')}</div>`;
}

function siglaMemo(sigla, grupo) {
  const lista = Object.values(SIGLAS).filter((s) => s.sigla === sigla);
  return lista.find((s) => s.grupo === grupo) || lista[0];
}

// ---------- navegación y eventos ----------
const CIUDAD = crearCiudad({ ATLAS, MEMO, PALACIOS, raiz: $('#ciudad') });
const PINTAR = { tabla: pintarTabla, ciudad: CIUDAD.pintar, escalas: pintarEscalas, facies: pintarFacies, repaso: pintarRepaso, progreso: pintarProgreso, metodos: pintarMetodos, siglas: pintarSiglas };
let vista = 'tabla';
function ir(v) {
  vista = v;
  $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.vista === v));
  $$('.vista').forEach((s) => s.classList.toggle('on', s.id === `v-${v}`));
  PINTAR[v]();
  try { localStorage.setItem('memo-semio-vista', v); } catch {}
}
$$('.tabs button').forEach((b) => b.addEventListener('click', () => ir(b.dataset.vista)));
$('#buscar').addEventListener('input', () => { if (!['tabla', 'escalas', 'facies', 'siglas'].includes(vista)) ir('tabla'); else PINTAR[vista](); });
$('#filtro-sec').addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (!b) return; secFiltro = b.dataset.s || null; pintarFiltros(); pintarTabla(); });
$('#ocultar').addEventListener('change', (e) => document.body.classList.toggle('ocultar', e.target.checked));
$('#solo-memo').addEventListener('change', pintarTabla);
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-memo]');
  if (b && !b.disabled) b.closest('.fila').querySelector('.memo')?.classList.toggle('on');
  const v = e.target.closest('.ocultar .val'); if (v) v.classList.toggle('ver');
  const irA = e.target.closest('[data-ir]');
  if (irA) { e.preventDefault(); const id = irA.dataset.ir; const enEscalas = ATLAS.escalas.some((x) => x.id === id);
    $('#buscar').value = ''; secFiltro = null; pintarFiltros(); ir(enEscalas ? 'escalas' : 'tabla');
    const el = document.getElementById(`p-${id}`); el?.scrollIntoView({ block: 'center' }); el?.querySelector('.memo')?.classList.add('on'); return; }
  const z = e.target.closest('[data-zoom]');
  if (z) { const vis = $('#visor'); vis.querySelector('img').src = z.src; vis.querySelector('p').textContent = z.alt; vis.hidden = false; }
});
$('#visor').addEventListener('click', () => { $('#visor').hidden = true; });
$('#tema').addEventListener('click', () => {
  const r = document.documentElement;
  const oscuro = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.dataset.theme = oscuro ? 'light' : 'dark';
  try { localStorage.setItem('memo-semio-tema', r.dataset.theme); } catch {}
});
$('#exportar').addEventListener('click', () => {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([srs.exportar()], { type: 'application/json' })), download: 'memo-semiologia-progreso.json' });
  a.click();
});
$('#importar').addEventListener('change', async (e) => {
  try { srs.importar(await e.target.files[0].text()); pendientes(); ir(vista); } catch (err) { $('#progreso').insertAdjacentHTML('afterbegin', `<p class="revisar">No se pudo importar: ${esc(err.message)}</p>`); }
});

try { const t = localStorage.getItem('memo-semio-tema'); if (t) document.documentElement.dataset.theme = t; } catch {}
pintarFiltros(); pendientes();
let inicial = 'tabla'; try { inicial = localStorage.getItem('memo-semio-vista') || 'tabla'; } catch {}
ir(PINTAR[inicial] ? inicial : 'tabla');
if (location.hash.startsWith('#p-')) document.getElementById(location.hash.slice(1))?.scrollIntoView();
