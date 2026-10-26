// Vista "Métodos": catálogo completo de las técnicas estudio-* (data/metodos.json) con secciones
// plegables, ejemplo real del atlas y una mini demo interactiva por método.
// Interfaz: crearMetodos({ METODOS, MEMO, ATLAS, raiz }) → { pintar(clave?), abrir(clave) }.
// "Ver ficha" pone location.hash = '#p-<id>' y dispara un CustomEvent 'memo:ir' { id } que burbujea hasta window.
import { ESCALERA, DOMINADA, REGLA } from './srs.js';
import { decodificar } from './entrenar.js';
import * as mias from './mias.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const azar = (a) => a[Math.floor(Math.random() * a.length)];
const barajar = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
// texto del skill → HTML: escapa, marca [complemento] y resalta #NNN
const fmt = (t) => esc(t)
  .replace(/\[([^\]]+)\]/g, (m, d) => (/complemento|ejemplo de aplicaci/i.test(d) ? `<span class="met-comp" title="No sale de los videos: lo agrega el skill">${esc(d)}</span>` : m))
  .replace(/#\d{2,3}\b/g, (r) => `<span class="met-ref">${r}</span>`);
const hueco = (t) => esc(t).replace(/\{\{(?:c\d+::)?(.*?)\}\}/g, '<span class="met-hueco" aria-label="hueco">&nbsp;</span>');
const sinHueco = (t) => String(t ?? '').replace(/\{\{(?:c\d+::)?(.*?)\}\}/g, '$1');

function leer(clave, def) { try { const v = JSON.parse(localStorage.getItem(clave)); return v ?? def; } catch { return def; } }
function grabar(clave, v) { try { localStorage.setItem(clave, JSON.stringify(v)); } catch { /* modo privado */ } }

// Técnicas que son capa de repaso: no aparecen en `tecnicas` pero aplican a toda ficha con preguntas.
const CAPA = ['recuerdo-activo', 'repeticion-espaciada', 'flashcards'];
// Qué técnica principal pide cada tipo_info (tablas "Qué tipo_info resuelve" de cada skill).
const POR_TIPO = [
  ['cifra', 'Cifras exactas', ['memorizar-numeros']],
  ['rango', 'Rangos y umbrales', ['memorizar-numeros', 'palacio-memoria']],
  ['escala', 'Escalas', ['mnemotecnia', 'memorizar-numeros', 'palacio-memoria']],
  ['lista-causas', 'Listas de causas', ['mnemotecnia', 'palacio-memoria']],
  ['clasificacion', 'Clasificaciones', ['memorizar-listas', 'palacio-memoria']],
  ['concepto', 'Conceptos y signos', ['memorizar-conceptos', 'visualizacion-imagenes']],
  ['formula', 'Fórmulas', ['mnemotecnia', 'memorizar-numeros']],
  ['definicion-literal', 'Definiciones literales', ['memorizar-textos-literal']],
  ['eponimo', 'Epónimos', ['memorizar-nombres']],
];

export function crearMetodos({ METODOS = {}, MEMO = {}, ATLAS = {}, raiz }) {
  if (!document.querySelector('link[data-metodos]')) {
    document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'css/metodos.css' })).setAttribute('data-metodos', '');
  }
  const CLAVES = Object.keys(METODOS);
  const FICHAS = {};
  for (const s of ATLAS.secciones || []) for (const f of s.filas || []) FICHAS[f.id] = { nombre: f.nombre, icono: f.icono || s.icono };
  for (const e of ATLAS.escalas || []) FICHAS[e.id] = { nombre: e.nombre, icono: e.icono || '📏' };
  const nombreDato = (id) => FICHAS[id]?.nombre || MEMO[id]?.parametro || id;
  const iconoDato = (id) => FICHAS[id]?.icono || '🧠';

  const usan = {};
  Object.entries(MEMO).forEach(([id, m]) => (m.tecnicas || []).forEach((k) => (usan[k] ||= []).push(id)));
  const conPreguntas = Object.keys(MEMO).filter((id) => (MEMO[id].preguntas || []).length);
  const usoDe = (k) => (usan[k] || []).length ? { n: usan[k].length, ids: usan[k], capa: false } : CAPA.includes(k) ? { n: conPreguntas.length, ids: conPreguntas, capa: true } : { n: 0, ids: [], capa: false };
  const PREGUNTAS = Object.entries(MEMO).flatMap(([id, m]) => (m.preguntas || []).filter((p) => p.q && p.a).map((p, i) => ({ ...p, id, i, ancla: m.ancla })));

  let abierto = leer('memo-semio-metodo', null);
  if (abierto && !METODOS[abierto]) abierto = null;
  const hechos = leer('memo-semio-met-pasos', {});

  function irFicha(id) {
    try { location.hash = `#p-${id}`; } catch { /* sin hash */ }
    window.dispatchEvent(new CustomEvent('memo:ir', { detail: { id } }));
  }
  function abrir(k) {
    abierto = METODOS[k] ? k : null;
    grabar('memo-semio-metodo', abierto);
    pintar();
    raiz.scrollIntoView?.({ block: 'start' });
    raiz.querySelector('.met-hero h2')?.focus({ preventScroll: true });
  }
  const chip = (k) => (METODOS[k] ? `<button type="button" class="met-chip" data-met="${esc(k)}">${esc(METODOS[k].icono)} ${esc(METODOS[k].nombre)}</button>` : '');
  const lista = (arr, cls = '') => `<ul class="met-lista ${cls}">${(arr || []).map((x) => `<li>${fmt(x)}</li>`).join('')}</ul>`;
  const txtUso = (k) => { const u = usoDe(k); return u.capa ? `capa de repaso · ${u.n} fichas` : `usado en ${u.n} dato${u.n === 1 ? '' : 's'}`; };

  // ---------- índice ----------
  function pintarIndice() {
    const tipos = {};
    Object.values(MEMO).forEach((m) => { if (m.tipo_info) tipos[m.tipo_info] = (tipos[m.tipo_info] || 0) + 1; });
    raiz.innerHTML = `<div class="met-vista">
      <p class="met-intro">Cada dato del atlas usa la técnica que mejor encaja con su <b>tipo de información</b>. Todas salen de los videos de Pablo Lomelí
        (los números <span class="met-ref">#NNN</span> son los videos) y lo que agrega el skill va marcado <span class="met-comp">complemento</span>. Abre un método para ver sus pasos, un ejemplo real de tu atlas y probarlo.</p>
      ${cicloHTML()}
      <details class="met-sec" data-sec="mitabla-indice"><summary>🔢 Mi tabla 00–99 <span class="met-n">tu lista fija de palabras-imagen</span></summary><div class="met-cuerpo"><div data-mitabla></div></div></details>
      <h3 class="met-h">Los ${CLAVES.length} métodos</h3>
      <div class="met-grid">${CLAVES.map((k) => { const m = METODOS[k]; const u = usoDe(k); return `
        <div class="met-card-w"><button type="button" class="met-card" data-met="${esc(k)}" aria-label="Abrir ${esc(m.nombre)}">
          <span class="met-ic" aria-hidden="true">${esc(m.icono)}</span>
          <span><span class="met-t">${esc(m.nombre)}</span><span class="met-d">${esc(m.resumen || m.que)}</span><span class="met-uso ${u.n ? '' : 'cero'}">${esc(txtUso(k))}</span></span>
        </button>${u.n && !u.capa ? `<button type="button" class="met-ver" data-vista="tabla" data-tec="${esc(k)}">Ver los ${u.n} datos que la usan →</button>` : u.capa ? '<button type="button" class="met-ver" data-vista="repaso">Ir a Repaso →</button>' : ''}</div>`; }).join('')}</div>
      <section class="met-tipos" aria-labelledby="met-tipos-t" style="margin-top:16px">
        <h3 id="met-tipos-t">¿Qué técnica uso? · según el tipo de dato</h3>
        ${POR_TIPO.map(([t, nom, ks]) => `<div class="met-fila"><span>${esc(nom)}${tipos[t] ? ` <small>(${tipos[t]})</small>` : ''}</span>${ks.map(chip).join('')}</div>`).join('')}
        <div class="met-fila"><span>Para repasar todo</span>${CAPA.map(chip).join('')}</div>
      </section></div>`;
    const mt = raiz.querySelector('[data-mitabla]'); if (mt) miTabla(mt);
  }

  // ---------- M1 · ciclo de estudio con atajos a cada pestaña ----------
  const CICLO = [
    ['💡', 'Comprender', 'Lee la ficha y explícala con tus palabras antes de memorizar: "no memorices algo que no entiendes" (#139, #134).', [['tabla', '📋 Valores']], 'memorizar-conceptos'],
    ['🧩', 'Codificar', 'Elige una sola técnica según el tipo de dato y abre el panel 🧠 de la ficha: escena, código o acrónimo (#139, #143).', [['tabla', '🧠 Panel de la ficha'], ['entrenar', '🏋️ Entrenar']], 'visualizacion-imagenes'],
    ['🧠', 'Recuerdo activo', 'Pregunta → responde sin ver → semáforo; rondas solo con los errores hasta cero (#039, #031).', [['repaso', '🔁 Repaso']], 'recuerdo-activo'],
    ['📅', 'Repaso espaciado', 'Vuelve a cada tarjeta mañana, en 3 días, en una semana, en 15 días… "repaso: siempre intercalado" (#031, #057).', [['hoy', '🏠 Hoy'], ['repaso', '🔁 Repaso']], 'repeticion-espaciada'],
    ['🏰', 'Palacio', 'Recorre tu ciudad-palacio adelante y al revés para fijar el orden de los datos (#195, #190).', [['ciudad', '🏙️ Ciudad'], ['juego', '🎮 Juego']], 'palacio-memoria'],
  ];
  function cicloHTML() {
    return `<section class="met-ciclo" aria-labelledby="met-ciclo-t"><h3 id="met-ciclo-t">Cómo estudiar con esta app</h3>
      <ol class="met-pasos-ciclo">${CICLO.map(([ic, t, d, vs, k], i) => `<li><span class="met-ciclo-n" aria-hidden="true">${ic}</span>
        <div><b>${i + 1}. ${esc(t)}</b><p>${fmt(d)}</p><div class="met-fila-btn">${vs.map(([v, n]) => `<button type="button" class="btn" data-vista="${v}">${n}</button>`).join('')}
        <button type="button" class="link" data-met="${k}">el método →</button></div></div></li>`).join('')}</ol>
      <p class="met-ayuda">No uses todas las técnicas a la vez sobre el mismo dato: pregúntate cuál aplica (#139, #143).</p></section>`;
  }

  // ---------- M2 · Mi tabla 00–99 (palabras propias en mias.js con clave num:NN) ----------
  const propia = (nn) => { try { return mias.get(`num:${nn}`)?.palabra || ''; } catch { return ''; } };
  function miTabla(cont) {
    let sel = null;
    cont.innerHTML = '<p class="met-ayuda">Cargando tabla…</p>';
    cargarTabla().then((T) => {
      if (!T?.tabla) { cont.innerHTML = '<p class="revisar">No se pudo cargar data/tabla00_99.json.</p>'; return; }
      const render = () => {
        const nums = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0'));
        const t = sel ? T.tabla[sel] : null; const mia = sel ? propia(sel) : '';
        const alts = t ? (t.alt || []).filter((a) => a !== t.palabra) : [];
        cont.innerHTML = `<p class="met-ayuda">Meta: tu lista fija del 00 al 99, "para no inventar la imagen cada vez" (#189, #139). Que sean <b>tuyas</b> y, una vez fijadas, no las cambies. ★ = palabra propia.</p>
          <div class="met-cien" role="group" aria-label="Números del 00 al 99">${nums.map((n) => { const p = propia(n); return `<button type="button" data-nn="${n}" class="${n === sel ? 'on' : ''} ${p ? 'mia' : ''}" aria-pressed="${n === sel}" aria-label="${n}: ${esc(p || T.tabla[n]?.palabra || '')}"><b>${n}</b><small>${esc(p || T.tabla[n]?.palabra || '')}</small></button>`; }).join('')}</div>
          ${t ? `<div class="met-caja met-nn" aria-live="polite"><div class="met-grupos"><div class="met-grupo"><div class="num">${sel}</div><div class="let">${esc(t.letras)}</div>
            <div class="pal">${esc(mia || t.palabra)}${mia ? ' ★' : ''}</div>${mia ? `<p class="alt">De la tabla: ${esc(t.palabra)}</p>` : ''}
            ${alts.length ? `<p class="alt">También: ${esc(alts.join(', '))}</p>` : ''}
            ${t.nota ? `<p class="nota">${fmt(t.nota)}</p>` : ''}<p class="nota">${t.fuente === 'video' ? 'Palabra de los videos' : fmt('Propuesta del skill [complemento]')}</p></div></div>
            <label class="met-etq" for="met-mia">✏️ Mi palabra para ${sel}</label>
            <div class="met-fila-btn"><input id="met-mia" class="met-in" style="max-width:220px" value="${esc(mia)}" placeholder="${esc(t.palabra)}" autocomplete="off">
              <button type="button" class="btn pri" data-guardar>Guardar</button>${mia ? '<button type="button" class="btn" data-quitar>Quitar</button>' : ''}</div>
            <p class="met-ayuda" data-val aria-live="polite">Cuentan todas las consonantes, también la S de un plural: usa singulares.</p></div>`
          : '<p class="met-ayuda">Toca un número para ver sus letras y su palabra.</p>'}`;
      };
      cont.addEventListener('click', (e) => {
        const b = e.target.closest('[data-nn]'); if (b) { sel = b.dataset.nn; render(); cont.querySelector('#met-mia')?.focus({ preventScroll: true }); return; }
        if (e.target.closest('[data-quitar]') && sel) { mias.set(`num:${sel}`, null); render(); return; }
        if (e.target.closest('[data-guardar]') && sel) {
          const w = cont.querySelector('#met-mia').value.trim();
          if (!w) { mias.set(`num:${sel}`, null); render(); return; }
          const d = decodificar(w);
          if (d !== sel) { cont.querySelector('[data-val]').innerHTML = `<span class="met-mal">✗</span> "${esc(w)}" decodifica <b>${esc(d || 'nada')}</b>, no ${sel}. Sus consonantes deben ser exactamente ${esc(T.tabla[sel].letras)}.`; return; }
          mias.set(`num:${sel}`, { palabra: w }); render();
          cont.querySelector('[data-val]').innerHTML = `<span class="met-ok">✓</span> Guardada: ${esc(w)} = ${sel}. Úsala siempre igual.`;
        }
      });
      cont.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'met-mia') cont.querySelector('[data-guardar]')?.click(); });
      render();
    });
  }

  // ---------- detalle ----------
  function seccion(id, titulo, cuerpo, { abierta = false, extra = '', cls = '' } = {}) {
    return `<details class="met-sec ${cls}" data-sec="${id}" ${abierta ? 'open' : ''}><summary>${titulo}${extra ? ` <span class="met-n">${extra}</span>` : ''}</summary><div class="met-cuerpo">${cuerpo}</div></details>`;
  }
  function pintarDetalle(k) {
    const m = METODOS[k];
    const u = usoDe(k);
    const i = CLAVES.indexOf(k);
    const ant = CLAVES[(i - 1 + CLAVES.length) % CLAVES.length]; const sig = CLAVES[(i + 1) % CLAVES.length];
    const marcados = new Set(hechos[k] || []);
    const pasos = (m.pasos || []).map((p, n) => `<li class="${marcados.has(n) ? 'hecho' : ''}"><label><span>${fmt(p)}</span><input type="checkbox" data-paso="${n}" ${marcados.has(n) ? 'checked' : ''} aria-label="Paso ${n + 1} hecho"></label></li>`).join('');
    const ea = m.ejemplo_atlas || {};
    const ejAtlas = ea.id && MEMO[ea.id]
      ? `<div class="met-atlas"><span class="met-nombre">${esc(iconoDato(ea.id))} ${esc(nombreDato(ea.id))}</span>
          <p class="met-cita">${fmt(ea.texto)}</p>${MEMO[ea.id].ancla ? `<p><b>Ancla:</b> ${esc(MEMO[ea.id].ancla)}</p>` : ''}
          <button type="button" class="btn met-btn-ir" data-ir-ficha="${esc(ea.id)}">Ver ficha →</button></div>`
      : `<p class="met-cita">${fmt(ea.texto || 'Todavía no hay un dato del atlas con esta técnica.')}</p>`;
    const demo = DEMOS[k];
    raiz.innerHTML = `<div class="met-vista">
      <button type="button" class="met-volver" data-volver>← Todos los métodos</button>
      <header class="met-hero"><span class="met-ic" aria-hidden="true">${esc(m.icono)}</span>
        <div><h2 tabindex="-1">${esc(m.nombre)}</h2><p>${fmt(m.resumen || '')}</p>
        <div class="met-meta"><span class="met-uso ${u.n ? '' : 'cero'}">${esc(txtUso(k))}</span>${m.version_skill ? `<span>skill v${esc(m.version_skill)}</span>` : ''}</div></div></header>
      ${seccion('que', '📖 Qué es', `<p>${fmt(m.que)}</p>`, { abierta: true })}
      ${seccion('como', '⚙️ Cómo funciona', `<p>${fmt(m.como_funciona || '')}</p>`)}
      ${seccion('pasos', '🪜 Pasos', `<p class="met-progreso" data-prog></p><ol class="met-pasos">${pasos}</ol>`, { abierta: true, extra: `${(m.pasos || []).length}` })}
      ${seccion('cuando', '🚦 Cuándo y cuándo no', `<div class="met-dos"><div class="met-col si"><h4>✓ Úsalo cuando</h4>${lista(m.cuando)}</div><div class="met-col no"><h4>✗ No lo uses</h4>${lista(m.cuando_no)}</div></div>`)}
      ${k === 'memorizar-numeros' ? seccion('mitabla', '🔢 Mi tabla 00–99', '<div data-mitabla></div>', { extra: 'cuadrícula 10 × 10' }) : ''}
      ${demo ? seccion('demo', `🎮 Pruébalo · ${esc(demo.titulo)}`, '<div class="met-demo" data-demo></div>', { abierta: true, cls: 'met-demo-sec' }) : ''}
      ${seccion('video', '🎬 Ejemplo del video', `<p class="met-cita">${fmt(m.ejemplo_video || '')}</p>`)}
      ${seccion('atlas', '🗺️ Ejemplo en tu atlas', ejAtlas, { abierta: true })}
      ${u.ids.length ? seccion('usan', u.capa ? '🗂️ Fichas que se repasan' : '🗂️ Datos que la usan', `<div class="met-usan">${u.ids.map((id) => `<button type="button" data-ir-ficha="${esc(id)}">${esc(iconoDato(id))} ${esc(nombreDato(id))}</button>`).join('')}</div>`, { extra: `${u.n}` }) : ''}
      ${seccion('errores', '⚠️ Errores comunes', lista(m.errores, 'err'), { extra: `${(m.errores || []).length}` })}
      ${seccion('consejos', '💬 Consejos', lista(m.consejos, 'tip'), { extra: `${(m.consejos || []).length}` })}
      ${seccion('combina', '🔗 Combina con', `<div class="met-fila-btn">${(m.combina_con || []).map(chip).join('')}</div>`)}
      ${seccion('fuentes', '📚 Fuentes', `<p class="met-fuentes">Videos de Pablo Lomelí: ${fmt(m.fuentes || '')}. Skill <code>estudio-${esc(k)}</code>${m.version_skill ? ` · versión ${esc(m.version_skill)}` : ''}.</p>`)}
      <nav class="met-nav" aria-label="Otros métodos"><button type="button" class="btn" data-met="${esc(ant)}">← ${esc(METODOS[ant].icono)} ${esc(METODOS[ant].nombre)}</button>
        <button type="button" class="btn" data-met="${esc(sig)}">${esc(METODOS[sig].icono)} ${esc(METODOS[sig].nombre)} →</button></nav></div>`;
    progresoPasos(k);
    const mt = raiz.querySelector('[data-mitabla]'); if (mt) miTabla(mt);
    const cont = raiz.querySelector('[data-demo]');
    if (cont) { try { demo.fn(cont); } catch (err) { cont.innerHTML = `<p class="revisar">No se pudo cargar la demo: ${esc(err.message)}</p>`; } }
  }
  function progresoPasos(k) {
    const el = raiz.querySelector('[data-prog]'); if (!el) return;
    const n = (METODOS[k].pasos || []).length; const h = (hechos[k] || []).length;
    el.textContent = h ? `${h} de ${n} pasos marcados como hechos.` : 'Marca cada paso cuando lo apliques a un tema.';
  }

  // ---------- eventos (delegados en raiz) ----------
  raiz.addEventListener('click', (e) => {
    const f = e.target.closest('[data-ir-ficha]'); if (f) { irFicha(f.dataset.irFicha); return; }
    const v = e.target.closest('[data-vista]');
    if (v) { const detail = { vista: v.dataset.vista }; if (v.dataset.tec) detail.tec = v.dataset.tec; window.dispatchEvent(new CustomEvent('memo:vista', { detail })); return; }
    const b = e.target.closest('[data-met]'); if (b && !b.closest('[data-demo]')) { abrir(b.dataset.met); return; }
    if (e.target.closest('[data-volver]')) { abrir(null); }
  });
  raiz.addEventListener('change', (e) => {
    const c = e.target.closest('[data-paso]'); if (!c || !abierto) return;
    const n = Number(c.dataset.paso); const s = new Set(hechos[abierto] || []);
    c.checked ? s.add(n) : s.delete(n);
    hechos[abierto] = [...s]; grabar('memo-semio-met-pasos', hechos);
    c.closest('li')?.classList.toggle('hecho', c.checked);
    progresoPasos(abierto);
  });

  function pintar(clave) {
    if (typeof clave === 'string' && METODOS[clave]) { abierto = clave; grabar('memo-semio-metodo', abierto); }
    if (abierto && METODOS[abierto]) pintarDetalle(abierto); else pintarIndice();
  }

  // =====================================================================================
  // MINI DEMOS (una por método). Cada una pinta dentro de `cont` y engancha sus eventos.
  // =====================================================================================
  const btnFicha = (id) => (MEMO[id] ? `<button type="button" class="link" data-ir-ficha="${esc(id)}">${esc(nombreDato(id))}</button>` : '');

  // ---- sistema mayor ----
  // Palabras fijas del atlas (canon de estudio-memorizar-numeros/tabla-00-99.md) para 1 y 3+ dígitos.
  const CANON = { 1: 'té', 2: 'uña', 3: 'humo', 4: 'oro', 5: 'ola', 6: 'ajo', 7: 'oca', 8: 'uva', 9: 'pie',
    100: 'tazas', 102: 'tisana', 105: 'diésel', 110: 'dados', 115: 'dedal', 120: 'tunas', 125: 'túnel', 126: 'tinaja', 130: 'Tomás', 131: 'tomate',
    135: 'tamal', 140: 'torres', 145: 'toril', 150: 'telas', 170: 'tacos', 180: 'tofus', 190: 'topos', 200: 'nueces', 240: 'nariz', 250: 'anillos',
    300: 'mesas', 314: 'metro', 325: 'Manolo', 350: 'mulas', 360: 'mechas', 400: 'rosas', 407: 'rosca', 450: 'rulos', 456: 'reloj', 460: 'rejas',
    500: 'losas', 600: 'chozas', 700: 'casas', 710: 'gatos', 901: 'pasto', 907: 'pesca' };
  const SIGNIFICA = { '23': 'Michael Jordan (su número de playera)', '50': 'un billete de 50 dólares', '007': 'James Bond', '2012': 'el fin del mundo (la película)', '0601': 'los Reyes Magos (6 de enero)', '1000': 'un milpiés' };
  const DIG_DEF = { 0: 'S Z C suave', 1: 'T D', 2: 'N Ñ', 3: 'M', 4: 'R', 5: 'L', 6: 'J CH G suave', 7: 'G C dura K Q', 8: 'F V', 9: 'P B' };
  let tablaP = null;
  const cargarTabla = () => (tablaP ||= fetch('data/tabla00_99.json').then((r) => (r.ok ? r.json() : null)).catch(() => null));
  const enAtlas = {};
  Object.entries(MEMO).forEach(([id, m]) => (Array.isArray(m.codigo) ? m.codigo : []).forEach((c) => {
    if (c && c.numero != null && c.palabra) (enAtlas[String(c.numero)] ||= []).push({ id, palabra: c.palabra });
  }));

  function demoNumeros(cont) {
    cont.innerHTML = `<p class="met-ayuda">Escribe un número, un decimal o un rango (p. ej. <b>60-100</b>, <b>7.35-7.45</b> o <b>3.5</b>). Verás la consonante de cada dígito, cómo partirlo y la palabra-imagen de tu tabla 00–99.</p>
      <label class="met-etq" for="met-num">Número</label>
      <input id="met-num" class="met-in" inputmode="decimal" autocomplete="off" placeholder="60-100" value="60-100">
      <div data-sal aria-live="polite"></div>
      <div class="met-caja"><span class="met-etq">Decodifica (practica tu tabla)</span>
        <p style="margin:6px 0">¿Qué número es <b data-q>…</b>?</p>
        <div class="met-fila-btn"><input class="met-in" data-r inputmode="numeric" maxlength="2" style="max-width:110px" aria-label="Tu respuesta">
        <button type="button" class="btn pri" data-ok>Comprobar</button><button type="button" class="btn" data-otra>Otra</button></div>
        <p data-fb aria-live="polite" style="margin:6px 0 0"></p></div>`;
    const sal = cont.querySelector('[data-sal]');
    let T = null; let qPar = null;
    const letras = (d) => (T?.digitos?.[d] || DIG_DEF[d]);
    function grupos(s) {
      if (CANON[Number(s)] && String(Number(s)) === s) return [s];
      const out = []; let i = 0;
      while (i < s.length) { const r = s.length - i; const tri = s.slice(i);
        if (r === 3 && CANON[Number(tri)] && String(Number(tri)) === tri) { out.push(tri); break; }
        if (r === 1) { out.push(s[i]); i += 1; } else { out.push(s.slice(i, i + 2)); i += 2; } }
      return out;
    }
    function tarjetaGrupo(g, etq) {
      const t = g.length === 2 ? T?.tabla?.[g] : null;
      const mia = g.length === 2 ? propia(g) : '';
      const palabra = mia || t?.palabra || CANON[Number(g)] || (g === '0' ? '—' : '?');
      const alt = [...new Set([...(mia ? [t?.palabra] : []), ...(t?.alt || [])])].filter((a) => a && a !== palabra);
      const atl = (enAtlas[g] || enAtlas[String(Number(g))] || []).slice(0, 3);
      return `<div class="met-grupo">${etq ? `<span class="met-etq">${esc(etq)}</span>` : ''}<div class="num">${esc(g)}</div>
        <div class="let">${esc(t?.letras || [...g].map((d) => letras(d).split(' ')[0]).join('-'))}</div><div class="pal">${esc(palabra)}${mia ? ' ★' : ''}</div>
        ${alt.length ? `<p class="alt">También: ${esc(alt.join(', '))}</p>` : ''}${t?.nota ? `<p class="nota">${fmt(t.nota)}</p>` : ''}
        ${t?.fuente === 'video' ? '<p class="nota">Palabra de los videos</p>' : ''}
        ${atl.length ? `<p class="atl">En tu atlas: ${atl.map((a) => `${esc(a.palabra)} en ${btnFicha(a.id)}`).join(' · ')}</p>` : ''}</div>`;
    }
    function render() {
      const v = cont.querySelector('#met-num').value.trim();
      const tokens = v.split(/\s*(?:-|–|—|\/|\s)\s*/).filter((x) => /\d/.test(x)).slice(0, 4);
      if (!tokens.length) { sal.innerHTML = '<p class="met-ayuda">Escribe al menos un dígito.</p>'; return; }
      let html = ''; const consejos = new Set();
      tokens.forEach((tok, n) => {
        const partes = tok.split(/[.,]/).map((x) => x.replace(/\D/g, '')).filter(Boolean);
        const digitos = partes.join('');
        if (SIGNIFICA[digitos]) consejos.add(`Atajo (#189): ${digitos} ya significa algo, ${SIGNIFICA[digitos]}. Úsalo directo.`);
        html += `${n ? '<span class="met-sep" aria-hidden="true">→</span>' : ''}<div class="met-caja" style="flex:1 1 100%">
          <div class="met-digitos" aria-label="Dígito y consonante">${[...digitos].map((d) => `<span class="met-dig"><b>${d}</b><small>${esc(letras(d))}</small></span>`).join('')}</div>
          <div class="met-grupos" style="margin-top:8px">${partes.map((p, j) => grupos(p).map((g) => tarjetaGrupo(g, partes.length > 1 ? (j ? 'parte decimal' : 'parte entera') : '')).join('')).join('')}</div></div>`;
        if (partes.length > 1) consejos.add('Decimal: si la posición del punto es obvia (el pH siempre es 7,xx; el K 3,5), codifica solo los dígitos que cambian; si no, una imagen para la parte entera y otra para la decimal, en ese orden. [complemento]');
      });
      if (tokens.length > 1) consejos.add('Rango: dos imágenes, siempre en orden menor → mayor dentro de la escena; la imagen del parámetro va entre las dos o actúa sobre ambas. [complemento]');
      consejos.add('Ahora liga las palabras a la imagen del parámetro en una escena exagerada, con movimiento y conectada al significado (#139).');
      sal.innerHTML = `<div class="met-grupos">${html}</div><ul class="met-lista tip">${[...consejos].map((c) => `<li>${fmt(c)}</li>`).join('')}</ul>`;
    }
    function nuevaPregunta() {
      const pares = Object.keys(T?.tabla || {});
      if (!pares.length) { cont.querySelector('[data-q]').textContent = 'sin tabla'; return; }
      qPar = azar(pares); cont.querySelector('[data-q]').textContent = T.tabla[qPar].palabra;
      cont.querySelector('[data-r]').value = ''; cont.querySelector('[data-fb]').textContent = '';
    }
    cont.querySelector('#met-num').addEventListener('input', render);
    cont.querySelector('[data-otra]').addEventListener('click', nuevaPregunta);
    const comprobar = () => {
      const r = cont.querySelector('[data-r]').value.trim(); const fb = cont.querySelector('[data-fb]'); if (!qPar) return;
      fb.innerHTML = r.padStart(2, '0') === qPar ? `<span class="met-ok">✓ ${qPar}</span> = ${esc(T.tabla[qPar].letras)}` : `<span class="met-mal">✗</span> Era <b>${qPar}</b> (${esc(T.tabla[qPar].letras)}). Lee las consonantes, no las vocales.`;
    };
    cont.querySelector('[data-ok]').addEventListener('click', comprobar);
    cont.querySelector('[data-r]').addEventListener('keydown', (e) => { if (e.key === 'Enter') comprobar(); });
    render();
    cargarTabla().then((t) => { T = t; render(); nuevaPregunta(); });
  }

  // ---- palacio: mini recorrido de 5 ubicaciones ----
  function demoPalacio(cont) {
    let est = Object.entries(MEMO).filter(([, m]) => m.estacion && m.estacion.seccion === (ATLAS.secciones?.[0]?.id || 's1') && m.estacion.ubicacion)
      .sort((a, b) => a[1].estacion.n - b[1].estacion.n).slice(0, 5)
      .map(([id, m]) => ({ id, ubi: m.estacion.ubicacion, dato: nombreDato(id), imagen: m.ancla || m.escena }));
    let lugar = ATLAS.secciones?.[0]?.titulo || 'tu palacio';
    if (est.length < 5) { // ejemplo 1 del skill (Casa-SV)
      lugar = 'Casa · sala (ejemplo del skill)';
      est = [['Puerta', 'FC 60–100 lpm', 'Una ristra de ajos late como un corazón bajo una pila de tazas'], ['Ventana', 'FR 12–20 rpm', 'Una tina respira en el marco y despega como un cohete de la NASA'],
        ['Sofá', 'PA < 120/< 80', 'Arriba un manguito aprieta tunas; abajo un vaso se llena con su jugo'], ['Televisor', 'Fiebre ≥ 38 °C', 'La mafia sale del televisor sudando con un termómetro hirviendo'],
        ['Mesa', 'SpO₂', 'Estación reservada: depende de la altitud']].map(([ubi, dato, imagen]) => ({ id: null, ubi, dato, imagen }));
    }
    let modo = 'ver'; let orden = 'adelante'; let pos = 0; const res = {};
    const secuencia = () => (orden === 'adelante' ? est.map((_, i) => i) : est.map((_, i) => est.length - 1 - i));
    function render() {
      const seq = secuencia(); const i = seq[pos]; const e = est[i]; const memoria = modo === 'recordar';
      const fin = memoria && pos >= seq.length;
      cont.innerHTML = `<p class="met-ayuda">Palacio: <b>${esc(lugar)}</b>. 1) Mira qué imagen dejaste en cada ubicación. 2) Recórrelo de memoria hacia adelante y luego al revés (#195).</p>
        <div class="met-fila-btn" role="group" aria-label="Modo">
          <button type="button" class="btn ${modo === 'ver' ? 'pri' : ''}" data-modo="ver" aria-pressed="${modo === 'ver'}">👀 Colocar</button>
          <button type="button" class="btn ${memoria ? 'pri' : ''}" data-modo="recordar" aria-pressed="${memoria}">🧠 Recorrer de memoria</button>
          <button type="button" class="btn" data-orden>${orden === 'adelante' ? '↺ Al revés (5→1)' : '↻ Adelante (1→5)'}</button></div>
        <ol class="met-ruta" aria-label="Ubicaciones">${seq.map((j, p) => `<li><button type="button" data-pos="${p}" class="${p === pos ? 'on' : ''} ${res[j] === true ? 'ok' : res[j] === false ? 'mal' : ''}" aria-current="${p === pos}"><b>${j + 1}</b>${esc(est[j].ubi)}</button></li>`).join('')}</ol>
        ${fin ? `<div class="met-estacion"><h4>Recorrido terminado</h4><p>Recordaste <b>${Object.values(res).filter(Boolean).length} de ${est.length}</b>. ${Object.values(res).some((x) => x === false) ? 'Mejora las imágenes que fallaron y repite (#190).' : '¡Completo! Ahora hazlo al revés: refuerza más (#195).'}</p>
          <button type="button" class="btn pri" data-reinicio>Otra vuelta</button></div>`
        : `<div class="met-estacion" aria-live="polite"><span class="ubi">Estación ${i + 1} · ${esc(e.ubi)}</span>
          ${memoria && !e.visto ? `<h4>¿Qué dejaste aquí?</h4><p class="met-ayuda">Di el dato en voz alta antes de mirar.</p><button type="button" class="btn pri" data-mostrar>Mostrar</button>`
          : `<h4>${esc(e.dato)}</h4><p class="met-escena">${esc(e.imagen)}</p>${e.id ? `<p>${btnFicha(e.id)}</p>` : ''}
            ${memoria ? `<div class="met-fila-btn"><button type="button" class="btn r3" data-res="1">✓ Lo recordé</button><button type="button" class="btn r1" data-res="0">✗ Se me olvidó</button></div>` : ''}`}</div>
          ${memoria ? '' : `<div class="met-fila-btn"><button type="button" class="btn" data-mov="-1" ${pos ? '' : 'disabled'}>← Anterior</button><button type="button" class="btn pri" data-mov="1" ${pos < seq.length - 1 ? '' : 'disabled'}>Siguiente →</button></div>`}`}`;
    }
    cont.addEventListener('click', (ev) => {
      const t = ev.target.closest('button'); if (!t || t.dataset.irFicha) return;
      if (t.dataset.modo) { modo = t.dataset.modo; pos = 0; est.forEach((e) => { e.visto = false; }); Object.keys(res).forEach((k) => delete res[k]); }
      else if ('orden' in t.dataset) { orden = orden === 'adelante' ? 'atras' : 'adelante'; pos = 0; est.forEach((e) => { e.visto = false; }); Object.keys(res).forEach((k) => delete res[k]); }
      else if (t.dataset.pos) pos = Number(t.dataset.pos);
      else if (t.dataset.mov) pos = Math.max(0, Math.min(est.length - 1, pos + Number(t.dataset.mov)));
      else if ('mostrar' in t.dataset) est[secuencia()[pos]].visto = true;
      else if (t.dataset.res) { res[secuencia()[pos]] = t.dataset.res === '1'; pos += 1; }
      else if ('reinicio' in t.dataset) { pos = 0; orden = orden === 'adelante' ? 'atras' : 'adelante'; est.forEach((e) => { e.visto = false; }); Object.keys(res).forEach((k) => delete res[k]); }
      else return;
      render();
    });
    render();
  }

  // ---- mnemotecnia: acrónimo ----
  function demoMnemotecnia(cont) {
    const ALICIA = [['A', 'Aparición'], ['L', 'Localización'], ['I', 'Irradiación'], ['C', 'Características'], ['I', 'Intensidad'], ['A', 'Agravantes']];
    const propios = Object.entries(MEMO).filter(([, m]) => (m.tecnicas || []).includes('mnemotecnia') && m.acronimo).map(([id, m]) => ({ id, acr: m.acronimo, ancla: m.ancla }));
    cont.innerHTML = `<p class="met-ayuda">Acrónimo del video #143 para evaluar el dolor: <b>ALICIA</b>. Intenta decir cada palabra y luego toca la letra para comprobar. "El acrónimo es el anzuelo para tener acceso al resto de la información" (#139).</p>
      <div class="met-letras">${ALICIA.map(([l, w], i) => `<button type="button" class="met-letra" data-l="${i}" aria-pressed="false" aria-label="Letra ${l}: mostrar palabra"><b>${l}</b><span></span></button>`).join('')}</div>
      <div class="met-fila-btn"><button type="button" class="btn" data-todo>Mostrar todo</button><button type="button" class="btn" data-ocultar>Ocultar</button></div>
      <p class="met-cita">Imagen: "Alicia te hace un estudio del dolor": vestida de doctora, sigue con una lupa gigante el rayo de dolor que se irradia por la espalda del paciente.</p>
      ${propios.length ? `<div class="met-caja"><label class="met-etq" for="met-acr">En tu atlas (${propios.length} acrónimos)</label>
        <select id="met-acr" class="met-sel" style="display:block;margin:6px 0 8px">${propios.map((p, i) => `<option value="${i}">${esc(nombreDato(p.id))}</option>`).join('')}</select>
        <div data-acr aria-live="polite"></div></div>` : ''}`;
    const letra = (b, ver) => { const i = Number(b.dataset.l); b.querySelector('span').textContent = ver ? ALICIA[i][1] : ''; b.setAttribute('aria-pressed', String(ver)); };
    cont.addEventListener('click', (e) => {
      const b = e.target.closest('[data-l]'); if (b) { letra(b, b.getAttribute('aria-pressed') !== 'true'); return; }
      if (e.target.closest('[data-todo]')) cont.querySelectorAll('[data-l]').forEach((x) => letra(x, true));
      if (e.target.closest('[data-ocultar]')) cont.querySelectorAll('[data-l]').forEach((x) => letra(x, false));
    });
    const sel = cont.querySelector('#met-acr');
    const verAcr = () => { const p = propios[Number(sel.value)]; cont.querySelector('[data-acr]').innerHTML = `<p style="margin:0 0 6px"><b>${esc(p.acr)}</b></p>${p.ancla ? `<p class="met-ayuda">⚓ ${esc(p.ancla)}</p>` : ''}<p>${btnFicha(p.id)}</p>`; };
    if (sel) { sel.value = String(Math.floor(Math.random() * propios.length)); sel.addEventListener('change', verAcr); verAcr(); }
  }

  // ---- visualización: checklist de calidad sobre una escena real ----
  const OBLIG = ['Conecta con el significado clínico, no solo con el sonido de la palabra', 'Hay un protagonista claro y cada pieza del dato tiene su imagen',
    'Pasa la prueba: desde la imagen reconstruyo el dato completo', 'Es breve: una o dos frases por pieza', 'Es mía: me evoca algo a mí'];
  const POTEN = ['Exageración (gigante, absurdo, intensidad máxima)', 'Movimiento o acción', 'Sentidos (se oye, huele, toca o saborea)', 'Emoción (risa, asco, miedo, ternura)',
    'Absurdo o humor', 'Interacción entre imágenes', 'Lugar o contexto conocido', 'Color llamativo [complemento]'];
  function demoVisual(cont) {
    const ids = Object.keys(MEMO).filter((id) => MEMO[id].escena);
    let id = azar(ids);
    function render() {
      const m = MEMO[id] || {};
      cont.innerHTML = `<p class="met-ayuda">Aplica la checklist del skill a una escena real de tu atlas. Una buena escena cumple <b>todos los obligatorios</b> y <b>al menos 3 potenciadores</b>.</p>
        <div class="met-caja"><span class="met-etq">${esc(iconoDato(id))} ${esc(nombreDato(id))}</span><p class="met-escena" style="margin-top:6px">${esc(m.escena || '')}</p></div>
        <details class="met-caja"><summary>Prueba de reconstrucción: lee solo la ancla y di el dato</summary><p>⚓ ${esc(m.ancla || '')}</p><p class="met-ayuda"><b>Dato:</b> ${esc(m.dato_a_recordar || '')}</p></details>
        <div class="met-check"><h5>Obligatorios</h5>${OBLIG.map((t, i) => `<label><input type="checkbox" data-o="${i}"> <span>${fmt(t)}</span></label>`).join('')}
          <h5>Potenciadores</h5>${POTEN.map((t, i) => `<label><input type="checkbox" data-p="${i}"> <span>${fmt(t)}</span></label>`).join('')}</div>
        <p class="met-veredicto no" data-ver aria-live="polite"></p>
        <div class="met-fila-btn"><button type="button" class="btn" data-otra>🎲 Otra escena</button>${btnFicha(id)}</div>`;
      veredicto();
    }
    function veredicto() {
      const o = cont.querySelectorAll('[data-o]:checked').length; const p = cont.querySelectorAll('[data-p]:checked').length;
      const ok = o === OBLIG.length && p >= 3; const v = cont.querySelector('[data-ver]');
      v.className = `met-veredicto ${ok ? 'si' : 'no'}`;
      v.textContent = ok ? `✓ Escena fuerte: ${o}/${OBLIG.length} obligatorios y ${p} potenciadores.` : `Obligatorios ${o}/${OBLIG.length} · potenciadores ${p}/3 mínimo. ${o < OBLIG.length ? 'Si falta uno obligatorio, reescríbela.' : 'Agrega acción, sentidos o emoción.'}`;
    }
    cont.addEventListener('change', veredicto);
    cont.addEventListener('click', (e) => { if (e.target.closest('[data-otra]')) { id = azar(ids); render(); } });
    render();
  }

  // ---- conceptos: qué / cómo / por qué / para qué ----
  function demoConceptos(cont) {
    const ids = Object.keys(MEMO).filter((id) => MEMO[id].tipo_info === 'concepto');
    let id = azar(ids.length ? ids : Object.keys(MEMO));
    const PREG = [['qué', '¿Qué es? (su significado)'], ['cómo', '¿Cómo se produce o se busca?'], ['por qué', '¿Por qué ocurre? (fundamento)'], ['para qué', '¿Para qué sirve? (qué orienta)']];
    function render() {
      const m = MEMO[id] || {};
      cont.innerHTML = `<p class="met-ayuda">Interrogación elaborativa (#043, #134): responde con tus palabras solo las preguntas que apliquen. Luego compara con la fuente.</p>
        <div class="met-caja"><span class="met-etq">Concepto</span><h4 style="margin:4px 0 0">${esc(iconoDato(id))} ${esc(nombreDato(id))}</h4></div>
        ${PREG.map(([k, t]) => `<label class="met-etq" for="met-c-${k.replace(' ', '')}">${esc(t)}</label><textarea id="met-c-${k.replace(' ', '')}" class="met-in" rows="2" placeholder="Con tus palabras…"></textarea>`).join('')}
        <div class="met-fila-btn"><button type="button" class="btn pri" data-comparar>Comparar con la fuente</button><button type="button" class="btn" data-otro>🎲 Otro concepto</button></div>
        <div class="met-caja met-oculto" data-fuente aria-live="polite"><p><b>Fuente:</b> ${esc(m.dato_a_recordar || '')}</p>${m.escena ? `<p class="met-ayuda">🎬 ${esc(m.escena)}</p>` : ''}
          <span class="met-etq">Prueba contra la ilusión de competencia</span>
          <div class="met-check">${['Lo expliqué con apoyo de mis notas', 'Lo expliqué completamente de memoria', 'Se lo enseñé a otra persona (o a un peluche)'].map((t) => `<label><input type="checkbox"> <span>${t}</span></label>`).join('')}</div>
          <p>${btnFicha(id)}</p></div>`;
    }
    cont.addEventListener('click', (e) => {
      if (e.target.closest('[data-comparar]')) cont.querySelector('[data-fuente]').classList.remove('met-oculto');
      if (e.target.closest('[data-otro]')) { id = azar(ids); render(); }
    });
    render();
  }

  // ---- listas: cadena breve (ejemplo de aplicación del skill: curvas febriles, n = 4) ----
  function demoListas(cont) {
    const L = [['Continua', 'un tren continuo que nunca para en ninguna estación', 'oscila < 1 °C al día y no baja a la normalidad'],
      ['Remitente', 'un cartero que remite cartas desde una montaña rusa que sube y baja sin tocar el suelo', 'oscila > 1 °C al día sin llegar a la normalidad'],
      ['Intermitente', 'una luz intermitente que se apaga del todo una vez al día', 'picos con regreso a la temperatura normal en el mismo día'],
      ['Recurrente', 'el mismo visitante que se va unos días de vacaciones y vuelve', 'días de fiebre que alternan con días sin fiebre']];
    let reversa = false; const vistos = new Set();
    function render() {
      const orden = reversa ? [...L.keys()].reverse() : [...L.keys()];
      cont.innerHTML = `<p class="met-ayuda">Tipos de curva febril (<b>n = 4</b>) <span class="met-comp">ejemplo de aplicación</span>: cada tipo es una imagen (regla de la lengua y del espejo, #137) y se encadenan en una historia que siempre avanza. Mira la imagen, di el tipo y toca para comprobar.</p>
        <ol class="met-lista" style="padding-left:0;list-style:none">${orden.map((i, p) => `<li class="met-caja" style="margin-bottom:6px"><span class="met-etq">${reversa ? L.length - p : p + 1} de ${L.length}</span>
          <p style="margin:4px 0">🎬 ${esc(L[i][1])}${p < orden.length - 1 ? ' → …' : ''}</p>
          ${vistos.has(i) ? `<p style="margin:0"><b>${esc(L[i][0])}:</b> ${esc(L[i][2])}</p>` : `<button type="button" class="btn" data-ver="${i}">¿Qué tipo es?</button>`}</li>`).join('')}</ol>
        <p class="met-ayuda">${vistos.size === L.length ? '✓ Lista completa. ' : ''}Historia: un termómetro viaja en un tren continuo; por la ventana un cartero remite cartas desde una montaña rusa; el tren entra a un túnel con luz intermitente; en el andén espera el visitante recurrente.</p>
        <div class="met-fila-btn"><button type="button" class="btn" data-rev>${reversa ? '↻ Adelante' : '↺ En reversa (#187)'}</button><button type="button" class="btn" data-reset>Ocultar todo</button></div>`;
    }
    cont.addEventListener('click', (e) => {
      const v = e.target.closest('[data-ver]'); if (v) vistos.add(Number(v.dataset.ver));
      else if (e.target.closest('[data-rev]')) { reversa = !reversa; vistos.clear(); }
      else if (e.target.closest('[data-reset]')) vistos.clear(); else return;
      render();
    });
    render();
  }

  // ---- textos literales: primera letra, escalera y comprobación de exactitud ----
  function demoTextos(cont) {
    const LINEAS = ['La salud es un estado', 'de completo bienestar físico, mental y social,', 'y no solamente la ausencia de afecciones o enfermedades.'];
    let modo = 'pistas'; let escalon = 2;
    const palabras = (t) => norm(t).replace(/[^a-zñ0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    function render() {
      const texto = modo === 'completo' ? `<p class="met-texto">${LINEAS.map(esc).join('<br>')}</p>`
        : modo === 'pistas' ? `<p class="met-texto">${LINEAS.map((l) => l.split(' ').map((w) => `<button type="button" class="met-pal" data-w="${esc(w)}" aria-label="Mostrar palabra">${esc(w[0])}</button>`).join(' ')).join('<br>')}</p>`
          : `<p class="met-texto">${LINEAS.slice(0, escalon).map(esc).join('<br>')}</p><p class="met-ayuda">Escalón ${escalon - 1} de ${LINEAS.length - 1}: recítalo todo sin mirar. "No puedes avanzar al siguiente escalón si te equivocas" (#128).</p>`;
      cont.innerHTML = `<p class="met-ayuda">Definición de salud de la OMS (1946) <span class="met-comp">ejemplo de aplicación</span>, en 3 frases. Pistas de primera letra (#128, #073): toca una letra para ver la palabra y vuelve a ocultarla.</p>
        <div class="met-fila-btn" role="group" aria-label="Modo">${[['pistas', '🔤 Primera letra'], ['escalera', '🪜 Escalera'], ['completo', '📄 Texto completo']].map(([k, t]) => `<button type="button" class="btn ${modo === k ? 'pri' : ''}" data-modo="${k}" aria-pressed="${modo === k}">${t}</button>`).join('')}</div>
        <div class="met-caja">${texto}${modo === 'escalera' ? `<div class="met-fila-btn"><button type="button" class="btn" data-esc="-1" ${escalon > 2 ? '' : 'disabled'}>← Bajar</button><button type="button" class="btn pri" data-esc="1" ${escalon < LINEAS.length ? '' : 'disabled'}>Agregar línea →</button></div>` : ''}</div>
        <label class="met-etq" for="met-recita">Recítalo de memoria (escríbelo)</label><textarea id="met-recita" class="met-in" placeholder="La salud es…"></textarea>
        <div class="met-fila-btn"><button type="button" class="btn pri" data-comp>Comprobar exactitud</button></div><div data-res aria-live="polite"></div>`;
    }
    function comprobar() {
      const obj = palabras(LINEAS.join(' ')); const dic = palabras(cont.querySelector('#met-recita').value);
      // LCS por palabras: cuántas están en su sitio
      const dp = Array.from({ length: obj.length + 1 }, () => new Array(dic.length + 1).fill(0));
      for (let i = obj.length - 1; i >= 0; i--) for (let j = dic.length - 1; j >= 0; j--) dp[i][j] = obj[i] === dic[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      const marcas = []; let i = 0; let j = 0;
      while (i < obj.length) { if (j < dic.length && obj[i] === dic[j]) { marcas.push(['ok', obj[i]]); i++; j++; } else if (j < dic.length && dp[i][j + 1] >= dp[i + 1][j]) { j++; } else { marcas.push(['falta', obj[i]]); i++; } }
      const pct = Math.round((100 * dp[0][0]) / Math.max(obj.length, dic.length || 1));
      const nivel = pct >= 90 ? 5 : pct >= 70 ? 4 : pct >= 50 ? 3 : pct >= 25 ? 2 : 1;
      cont.querySelector('[data-res]').innerHTML = `<div class="met-caja"><p style="margin:0 0 6px"><b>${pct} %</b> de exactitud · nivel ${nivel} de 5</p>
        <div class="met-barra"><i style="width:${pct}%"></i></div><p class="met-diff" style="margin:8px 0 0">${marcas.map(([c, w]) => `<span class="${c}">${esc(w)}</span>`).join(' ')}</p>
        <p class="met-ayuda" style="margin-top:6px">Niveles (#128): 1 orden de las frases · 2 orden exacto · 3 palabras conectoras ("y no solamente") · 4 70-80 % · 5 90-100 %. En rojo, lo que faltó.</p></div>`;
    }
    cont.addEventListener('click', (e) => {
      const w = e.target.closest('[data-w]'); if (w) { const ver = w.textContent.length > 1; w.textContent = ver ? w.dataset.w[0] : w.dataset.w; return; }
      const m = e.target.closest('[data-modo]'); if (m) { modo = m.dataset.modo; render(); return; }
      const s = e.target.closest('[data-esc]'); if (s) { escalon = Math.max(2, Math.min(LINEAS.length, escalon + Number(s.dataset.esc))); render(); return; }
      if (e.target.closest('[data-comp]')) comprobar();
    });
    render();
  }

  // ---- nombres: decodificar epónimos (banco-nombres.md, sección B) ----
  function demoNombres(cont) {
    const B = [['Signo de Murphy', 'Detención brusca de la inspiración al palpar el punto cístico (colecistitis aguda)', 'RoboCop (Alex Murphy): su mano de acero bajo la costilla derecha; el paciente se congela a mitad de inspirar'],
      ['Maniobra de Giordano', 'Dolor a la puñopercusión de la fosa lumbar (pielonefritis, litiasis)', '"Jordan": Michael Jordan bota su puño contra la espalda baja y el riñón salta y grita'],
      ['Signo de Blumberg', 'Dolor a la descompresión brusca tras presionar el abdomen (irritación peritoneal)', '"¡BUM!" + iceberg: lo hundes lento, lo sueltas de golpe y el paciente grita al soltar'],
      ['Punto de McBurney', 'Unión del tercio externo con los dos tercios internos de la línea espina ilíaca–ombligo (apendicitis)', 'McDonald\'s + burn: una hamburguesa quemada clavada en la fosa ilíaca derecha'],
      ['Signo de Rovsing', 'Dolor en la fosa ilíaca derecha al presionar la izquierda (apendicitis)', '"robo" + sing: un ladrón aprieta el lado izquierdo y el apéndice canta en el derecho'],
      ['Signo de Courvoisier', 'Vesícula palpable y no dolorosa con ictericia (obstrucción biliar distal, sobre todo maligna)', 'Coñac Courvoisier: una botella grande e indolora bajo la costilla de un paciente amarillo'],
      ['Respiración de Kussmaul', 'Profunda y rápida, regular (acidosis metabólica)', '"Kuss" = beso: besos enormes y profundos con aliento a manzana'],
      ['Respiración de Cheyne-Stokes', 'Crescendo-decrescendo con apneas (IC, lesión neurológica)', '"chain" = cadena que ondula cada vez más alto, luego más bajo, y se queda tiesa'],
      ['Respiración de Biot', 'Grupos de respiraciones con apneas irregulares (tronco encefálico)', '"bote" que rema a golpes y se para cuando quiere'],
      ['Facies hipocrática', 'Ojos y sienes hundidos, nariz afilada, piel pálida-terrosa y fría (estado agónico)', 'El busto de mármol de Hipócrates se agrieta, se le hunden los ojos y se afila la nariz']];
    let orden = barajar([...B.keys()]); let pos = 0; let paso = 0; let sentido = 'hallazgo';
    function render() {
      const [nom, hall, img] = B[orden[pos]];
      const frente = sentido === 'hallazgo' ? hall : nom; const meta = sentido === 'hallazgo' ? nom : hall;
      cont.innerHTML = `<p class="met-ayuda">Decodificación (#124): <b>rasgo → imagen → nombre</b>. Epónimos del banco del skill <span class="met-comp">ejemplo de aplicación</span>. Verifica la definición con tu texto.</p>
        <div class="met-fila-btn" role="group" aria-label="Sentido"><button type="button" class="btn ${sentido === 'hallazgo' ? 'pri' : ''}" data-s="hallazgo" aria-pressed="${sentido === 'hallazgo'}">Hallazgo → nombre</button><button type="button" class="btn ${sentido === 'nombre' ? 'pri' : ''}" data-s="nombre" aria-pressed="${sentido === 'nombre'}">Nombre → hallazgo</button></div>
        <div class="met-estacion" aria-live="polite"><span class="ubi">${pos + 1} de ${B.length}</span><h4>${esc(frente)}</h4>
          ${paso >= 1 ? `<p>🎬 ${esc(img)}</p>` : ''}${paso >= 2 ? `<p class="met-ok">${esc(meta)}</p>` : ''}</div>
        <div class="met-fila-btn">${paso < 1 ? '<button type="button" class="btn" data-p>💡 Pista: la imagen</button>' : ''}${paso < 2 ? `<button type="button" class="btn pri" data-r>Mostrar ${sentido === 'hallazgo' ? 'nombre' : 'hallazgo'}</button>` : ''}
          <button type="button" class="btn" data-sig>Siguiente →</button></div>`;
    }
    cont.addEventListener('click', (e) => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.s) { sentido = t.dataset.s; paso = 0; } else if ('p' in t.dataset) paso = 1; else if ('r' in t.dataset) paso = 2;
      else if ('sig' in t.dataset) { pos = (pos + 1) % B.length; if (!pos) orden = barajar(orden); paso = 0; } else return;
      render();
    });
    render();
  }

  // ---- recuerdo activo: mini sesión con semáforo y rondas hasta cero errores ----
  function demoRecuerdo(cont) {
    let cola = []; let ronda = 1; let primera = {}; let fallos = []; let viendo = false; let total = 0;
    function iniciar() { cola = barajar(PREGUNTAS).slice(0, 5); total = cola.length; ronda = 1; primera = {}; fallos = []; viendo = false; render(); }
    function render() {
      if (!total) { cont.innerHTML = '<p class="met-ayuda">No hay preguntas en el atlas todavía.</p>'; return; }
      if (!cola.length) {
        if (fallos.length) { cola = barajar(fallos); fallos = []; ronda += 1; }
        else {
          const v = Object.values(primera).filter((x) => x === 'v').length;
          cont.innerHTML = `<div class="met-estacion"><h4>✓ Cero errores en la ronda ${ronda}</h4><p>Primera ronda: <b>${v} de ${total}</b> en verde (${Math.round((100 * v) / total)} %). Lo correcto no se repitió; solo volvieron las 🟡 y 🔴 (#039, #031).</p>
            <p class="met-ayuda">Siguiente paso: espaciar el próximo repaso (mañana, en 3 días, en una semana…).</p><button type="button" class="btn pri" data-nueva>Nueva sesión</button></div>`;
          return;
        }
      }
      const p = cola[0];
      cont.innerHTML = `<p class="met-ayuda">5 preguntas reales de tu atlas. Responde <b>sin ver</b>, luego califícate con honestidad. Rojas y amarillas vuelven en la siguiente ronda.</p>
        <div class="met-estado"><span>Ronda ${ronda}</span><span>Quedan ${cola.length}</span><span>${esc(iconoDato(p.id))} ${esc(nombreDato(p.id))}</span></div>
        <div class="met-caja"><p class="met-preg">${hueco(p.q)}</p></div>
        ${viendo ? `<div class="met-resp" aria-live="polite"><p class="r">${esc(sinHueco(p.a))}</p>${p.ancla ? `<p class="met-ayuda">⚓ ${esc(p.ancla)}</p>` : ''}</div>
          <div class="met-sem" role="group" aria-label="Califícate"><button type="button" class="v" data-c="v">🟢 Correcta</button><button type="button" class="a" data-c="a">🟡 Regular</button><button type="button" class="r" data-c="r">🔴 Incorrecta</button></div>`
        : `<label class="met-etq" for="met-ra">Tu respuesta</label><textarea id="met-ra" class="met-in" rows="2" placeholder="Escríbela o dila en voz alta"></textarea>
          ${ronda > 1 && p.ancla ? `<details><summary class="met-ayuda">Pista (ronda ${ronda})</summary><p>⚓ ${esc(p.ancla)}</p></details>` : ''}
          <div class="met-fila-btn"><button type="button" class="btn pri" data-ver>Mostrar respuesta</button></div>`}`;
    }
    cont.addEventListener('click', (e) => {
      const t = e.target.closest('button'); if (!t) return;
      if ('nueva' in t.dataset) { iniciar(); return; }
      if ('ver' in t.dataset) { viendo = true; render(); cont.querySelector('[data-c]')?.focus(); return; }
      if (t.dataset.c) { const p = cola.shift(); const k = `${p.id}#${p.i}`; if (!(k in primera)) primera[k] = t.dataset.c; if (t.dataset.c !== 'v') fallos.push(p); viendo = false; render(); }
    });
    iniciar();
  }

  // ---- repetición espaciada: simulador de la escalera ----
  function demoRepeticion(cont) {
    let esc_ = -1; let dia = 0; let hist = []; let fallosSeg = 0;
    const NOMBRES = { 1: '🔴 Otra vez', 2: '🟡 Difícil', 3: '🟢 Bien', 4: '🔵 Fácil' };
    function render() {
      const dom = esc_ >= DOMINADA; const editar = fallosSeg >= 3;
      cont.innerHTML = `<p class="met-ayuda">Una tarjeta nueva y la escalera de la app <b>[${ESCALERA.join(', ')}]</b> días (#031, #035, #038; la fórmula por botón es <span class="met-comp">complemento</span>). Califícala y mira cuándo volvería.</p>
        <div class="met-escalera" aria-hidden="true">${ESCALERA.map((d, i) => `<div class="${i === esc_ ? 'on' : ''} ${i >= DOMINADA ? 'dom' : ''}" style="height:${18 + i * 13}%">${d} d</div>`).join('')}</div>
        <div class="met-estado" aria-live="polite"><span>Día ${dia}</span><span>${esc_ < 0 ? 'Nueva' : `Escalón ${esc_} · cada ${ESCALERA[esc_]} d`}</span><span>${dom ? '✅ dominada' : esc_ < 0 ? 'sin repasar' : 'aprendiendo'}</span>${editar ? '<span class="met-mal">✏️ editar la pregunta</span>' : ''}</div>
        <div class="met-4btn">${[1, 2, 3, 4].map((n) => `<button type="button" class="btn r${n}" data-n="${n}">${NOMBRES[n]}<small>${REGLA[n].repetir ? 'vuelve en la sesión' : 'no vuelve hoy'}</small></button>`).join('')}</div>
        ${hist.length ? `<ol class="met-hist">${hist.map((h) => `<li>Día ${h.dia}: ${NOMBRES[h.n]} → escalón ${h.esc}, próximo repaso el <b>día ${h.prox}</b> (+${ESCALERA[h.esc]} d)</li>`).join('')}</ol>` : '<p class="met-ayuda">Prueba: Bien, Bien, Bien, Bien → dominada en el día 11; luego Otra vez → vuelve a 0.</p>'}
        <div class="met-fila-btn"><button type="button" class="btn" data-reset>Reiniciar</button></div>`;
    }
    cont.addEventListener('click', (e) => {
      const t = e.target.closest('button'); if (!t) return;
      if ('reset' in t.dataset) { esc_ = -1; dia = 0; hist = []; fallosSeg = 0; render(); return; }
      const n = Number(t.dataset.n); if (!n) return;
      esc_ = REGLA[n].fn(esc_); fallosSeg = n <= 2 ? fallosSeg + 1 : 0;
      const prox = dia + ESCALERA[esc_]; hist.push({ dia, n, esc: esc_, prox }); dia = prox; render();
    });
    render();
  }

  // ---- flashcards: tarjeta que se voltea ----
  function demoFlash(cont) {
    const mont = { r: 0, a: 0, v: 0 }; let p = null; let volteada = false;
    function nueva() { p = azar(PREGUNTAS); volteada = false; render(); }
    function render() {
      if (!p) { cont.innerHTML = '<p class="met-ayuda">No hay preguntas en el atlas todavía.</p>'; return; }
      cont.innerHTML = `<p class="met-ayuda">Pregunta al frente, respuesta oculta atrás (#038). Intenta responder, voltea la tarjeta y ponla en un montón: sin algoritmo, las incorrectas y regulares vuelven en la siguiente ronda (#039).</p>
        <div class="met-flip"><button type="button" class="met-tarjeta ${volteada ? 'volteada' : ''}" data-flip aria-label="${volteada ? 'Ver la pregunta' : 'Voltear: ver la respuesta'}" aria-pressed="${volteada}">
          <span class="met-cara" aria-hidden="${volteada}"><span class="lado">Frente · ${esc(nombreDato(p.id))}${p.tipo ? ` · ${esc(p.tipo)}` : ''}</span><span class="q">${hueco(p.q)}</span><span class="met-ayuda">Toca para voltear</span></span>
          <span class="met-cara atras" aria-hidden="${!volteada}"><span class="lado">Reverso</span><span class="q">${esc(sinHueco(p.a))}</span>${p.ancla ? `<span class="met-ayuda">⚓ ${esc(p.ancla)}</span>` : ''}</span></button></div>
        ${volteada ? `<div class="met-sem" role="group" aria-label="Montón"><button type="button" class="r" data-m="r">Incorrecta</button><button type="button" class="a" data-m="a">Regular</button><button type="button" class="v" data-m="v">Correcta</button></div>` : ''}
        <div class="met-montones"><span>🔴 ${mont.r}</span><span>🟡 ${mont.a}</span><span>🟢 ${mont.v}</span><button type="button" class="link" data-otra>Otra tarjeta</button></div>`;
    }
    cont.addEventListener('click', (e) => {
      if (e.target.closest('[data-flip]')) { volteada = !volteada; render(); cont.querySelector('[data-flip]')?.focus(); return; }
      const m = e.target.closest('[data-m]'); if (m) { mont[m.dataset.m] += 1; nueva(); return; }
      if (e.target.closest('[data-otra]')) nueva();
    });
    nueva();
  }

  const DEMOS = {
    'memorizar-numeros': { titulo: 'codifica un número', fn: demoNumeros },
    'palacio-memoria': { titulo: 'recorrido de 5 ubicaciones', fn: demoPalacio },
    mnemotecnia: { titulo: 'acrónimo', fn: demoMnemotecnia },
    'visualizacion-imagenes': { titulo: 'checklist de una escena', fn: demoVisual },
    'memorizar-conceptos': { titulo: 'qué, cómo, por qué, para qué', fn: demoConceptos },
    'memorizar-listas': { titulo: 'cadena de una lista', fn: demoListas },
    'memorizar-textos-literal': { titulo: 'primera letra y escalera', fn: demoTextos },
    'memorizar-nombres': { titulo: 'decodifica epónimos', fn: demoNombres },
    'recuerdo-activo': { titulo: 'sesión con semáforo', fn: demoRecuerdo },
    'repeticion-espaciada': { titulo: 'simulador de la escalera', fn: demoRepeticion },
    flashcards: { titulo: 'tarjeta que se voltea', fn: demoFlash },
  };

  return { pintar, abrir };
}
