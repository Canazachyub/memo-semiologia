// Vistas de contenido: Valores, Escalas, Facies, Siglas (y Métodos mientras no se integre js/metodos.js).
// Dueño: paquete B (ver tools/PLAN_MEJORAS.md y tools/CONTRATOS.md).
// Mejoras: V1 sección estudiada · V2 autoexamen con semáforo · V3 prueba de reconstrucción ·
// V4 mi versión (js/mias.js) · V5 render ligero · ES1/ES2 escalas · F1/F2 facies · SG1/SG2 siglas.
import { $, $$, esc, norm, resaltar, celda, haptico } from './util.js';
import * as plan from './plan.js';
import * as mias from './mias.js';

// ---------- utilidades locales ----------
const pad = (n) => String(n).padStart(2, '0');
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const numeros = (t) => (String(t ?? '').match(/\d+(?:[.,]\d+)?/g) || []).map((x) => x.replace(',', '.'));
const taparCifras = (t) => String(t ?? '').replace(/\d+(?:[.,]\d+)?/g, '…');
const MQ = matchMedia('(max-width: 760px)');
const movil = () => MQ.matches;
const sinMov = () => document.documentElement.classList.contains('sin-mov') || matchMedia('(prefers-reduced-motion: reduce)').matches;
const barajar = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

// Clave de mias.js por tipo de dato. Filas y escalas usan su id; siglas y facies llevan prefijo porque
// algunos slugs de siglas (vcm, hdl, ldl…) coinciden con ids de filas. Es el mismo prefijo del id de tarjeta.
export const claveMia = { dato: (id) => id, sigla: (id) => `sig:${id}`, facies: (id) => `fac:${id}` };

// SIGLAS y FACIES quedan en caché al crear las vistas, para tarjetasExtra(ATLAS, MEMO) sin más argumentos.
const CACHE = { SIGLAS: {}, FACIES: {} };

// ---------- ES2 · F2 · SG2: tarjetas extra de repaso (las importa js/repaso.js) ----------
// Mismo formato que construirTarjetas: {id, ref, sec, q, a, m, nombre} + tipo. Ids estables (no por índice de pregunta).
export function tarjetasExtra(ATLAS, MEMO, extra = {}) {
  const SIGLAS = extra.SIGLAS || CACHE.SIGLAS || {};
  const FACIES = extra.FACIES || CACHE.FACIES || {};
  const t = [];
  // ES2: una tarjeta por componente y una por corte de interpretación. Sin `m`: entran con "Solo con técnica" apagado.
  for (const e of ATLAS?.escalas || []) {
    (e.items || []).forEach(([item, valor], k) => {
      if (item && valor) t.push({ id: `esc:${e.id}:i${k}`, ref: e.id, sec: 'escalas', q: `${e.nombre} · «${item}»: ¿qué evalúa y cuánto vale?`, a: valor, m: null, nombre: e.nombre, tipo: 'componente' });
    });
    (e.interpretacion || []).forEach(([rango, texto], k) => {
      if (rango && texto) t.push({ id: `esc:${e.id}:r${k}`, ref: e.id, sec: 'escalas', q: `${e.nombre}: un puntaje de ${rango} significa…`, a: texto, m: null, nombre: e.nombre, tipo: 'umbral' });
    });
  }
  // F2: facies en los dos sentidos. Si falta la inversa (rasgo → nombre), se genera fac:<id>#inv.
  for (const f of ATLAS?.facies || []) {
    const fm = FACIES[f.id];
    const tieneInv = (fm?.preguntas || []).some((p) => p.tipo === 'inversa');
    if (!tieneInv && f.rasgo) t.push({ id: `fac:${f.id}#inv`, ref: f.id, sec: 'facies', q: `Rasgo: ${f.rasgo}. ¿Qué facies es?`, a: `Facies ${f.nombre}`, m: fm ? { ...fm, imagen: f.imagen } : null, nombre: f.nombre, tipo: 'inversa' });
  }
  // SG2: pares que se confunden como pregunta trampa, sig:<id>#tr.
  for (const [id, s] of Object.entries(SIGLAS)) {
    const conf = (s.confusiones || []).map((c) => (typeof c === 'string' ? c : `${c.sigla || ''}: ${c.clave || c.diferencia || ''}`)).filter(Boolean);
    if (conf.length) t.push({ id: `sig:${id}#tr`, ref: id, sec: 'siglas', q: `Trampa · ${s.sigla} (${s.significado}): ¿con qué se confunde y cómo la distingues?`, a: conf.join(' · '), m: { ancla: s.ancla, escena: s.escena }, nombre: s.sigla, tipo: 'trampa' });
  }
  return t;
}

// ---------- V2 · ES1: autoexamen por lista (no toca srs) ----------
// memo-semio-autoexamen = { <ámbito>: { fecha:'AAAA-MM-DD', ronda, filas:{id:'r'|'a'|'v'}, cola:[ids]|null } }
// ámbito = id de sección (s1…s12), 'todas' (Valores sin filtro) o 'escalas'. Cada día empieza en la ronda 1.
const AE_K = 'memo-semio-autoexamen';
const aeTodo = () => { try { return JSON.parse(localStorage.getItem(AE_K)) || {}; } catch { return {}; } };
function aeGet(amb) {
  const a = aeTodo()[amb];
  return a && a.fecha === hoyISO() ? { filas: {}, cola: null, ronda: 1, ...a } : { fecha: hoyISO(), ronda: 1, filas: {}, cola: null };
}
function aeSet(amb, a) { const t = aeTodo(); t[amb] = a; try { localStorage.setItem(AE_K, JSON.stringify(t)); } catch { /* sin almacenamiento */ } }
const SEM = [['r', '🔴', 'No lo sabía'], ['a', '🟡', 'Dudé'], ['v', '🟢', 'Lo sabía']];

export function crearVistas({ ATLAS, MEMO, METODOS, PALACIOS, SIGLAS, FACIES, EXPLICA = {}, srs }) {
  CACHE.SIGLAS = SIGLAS || {}; CACHE.FACIES = FACIES || {};
  METODOS = METODOS || {}; PALACIOS = PALACIOS || {};
  const nombreMetodo = (k) => METODOS[k]?.nombre || k;
  const FILA = {}; ATLAS.secciones.forEach((s) => s.filas.forEach((f) => { FILA[f.id] = { ...f, sec: s }; }));
  const ESCALA = {}; ATLAS.escalas.forEach((e) => { ESCALA[e.id] = e; });
  const FAC = {}; ATLAS.facies.forEach((f) => { FAC[f.id] = f; });

  let secFiltro = null, tecFiltro = null;
  let ocultarModo = '';        // V2: '' | 'n' | 'ub' | 'todo'
  let escOcultas = false;      // ES1
  let facOcultas = false;      // F1
  let sigModo = '';            // SG1: '' | 'sig' (oculta significado) | 'inv' (oculta sigla)
  const visibles = { valores: [], escalas: [] };

  // ---------- V5: la búsqueda espera 150 ms ----------
  // app.js repinta en cada 'input' de #buscar; este listener se registra antes y marca que el repintado viene de ahí.
  let desdeBusqueda = false; const timers = {};
  $('#buscar')?.addEventListener('input', () => { desdeBusqueda = true; setTimeout(() => { desdeBusqueda = false; }, 0); });
  const conRetardo = (nombre, fn) => (...args) => {
    clearTimeout(timers[nombre]);
    if (desdeBusqueda) timers[nombre] = setTimeout(() => fn(...args), 150); else fn(...args);
  };

  // ---------- V1: sección estudiada ----------
  function fechaEstudiada(sid) {
    const v = plan.cargar()?.estudiadas?.[sid];
    if (!v) return '';
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) { const [, m, d] = v.slice(0, 10).split('-'); return `${d}/${m}`; }
    const d = new Date(v); return isNaN(d) ? '' : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  }
  function btnEstudiada(sid) {
    let est = false; try { est = plan.estudiada(sid); } catch { /* plan sin datos */ }
    return est
      ? `<button type="button" class="v-est on" data-estudiada="${esc(sid)}" aria-pressed="true" title="Tocar dos veces para desmarcar">✅ Estudiada${fechaEstudiada(sid) ? ` el ${fechaEstudiada(sid)}` : ''}</button>`
      : `<button type="button" class="v-est" data-estudiada="${esc(sid)}" aria-pressed="false" title="Primero comprende el tema; al marcarlo se liberan sus tarjetas nuevas en Repaso">📖 Marcar como estudiada</button>`;
  }
  function alternarEstudiada(b) {
    const sid = b.dataset.estudiada;
    let est = false; try { est = plan.estudiada(sid); } catch { /* */ }
    if (est && !b.dataset.confirmar) { // dos toques para desmarcar (evita borrar por error, sin diálogos nativos)
      b.dataset.confirmar = '1'; b.textContent = '¿Desmarcar? Toca otra vez';
      setTimeout(() => { if (b.isConnected && b.dataset.confirmar) b.outerHTML = btnEstudiada(sid); }, 3000);
      return;
    }
    if (est) { const p = plan.cargar() || {}; if (p.estudiadas) delete p.estudiadas[sid]; plan.guardar(p); }
    else plan.marcarEstudiada(sid);
    $$(`[data-estudiada="${CSS.escape(sid)}"]`).forEach((x) => { x.outerHTML = btnEstudiada(sid); });
    window.dispatchEvent(new CustomEvent('memo:estudiada', { detail: { sid, estudiada: !est } }));
  }

  // ---------- panel de memoria (V1 orden · V3 · V4) ----------
  function bloqueTecnica(m) {
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
    const lugar = m.estacion && PALACIOS.lugares?.[m.estacion.seccion];
    const acr = m.acronimo ? (typeof m.acronimo === 'string' ? `<p class="acr">🔤 ${esc(m.acronimo)}</p>`
      : `<p class="acr">🔤 <b>${esc(m.acronimo.sigla)}</b> — ${esc(m.acronimo.desarrollo)}</p>`) : '';
    return `${tec ? `<div class="tec">${tec}</div>` : ''}
      ${lugar ? `<p class="donde">📍 ${esc(PALACIOS.ciudad)} · ${esc(lugar.icono)} ${esc(lugar.lugar)} › <b>${esc(m.estacion.ubicacion)}</b></p>` : ''}
      ${cod ? `<div class="codigo">${cod}</div>` : ''}
      ${m.ancla ? `<p class="ancla">⚓ ${esc(m.ancla)}</p>` : ''}
      ${acr}
      ${m.escena ? `<p class="escena">🎬 ${esc(m.escena)}</p>` : ''}
      ${ruta}
      ${m.revisar ? '<p class="revisar">⚠️ Pendiente de revisión</p>' : ''}`;
  }
  function bloqueMia(mia) {
    if (!mia) return '';
    const ch = mia.check ? Object.values(mia.check).filter(Boolean).length : null;
    return `<div class="v-mia"><p class="h">✍️ Tu versión${ch !== null ? ` <span class="v-ch">checklist ${ch}/4</span>` : ''}</p>
      ${mia.ancla ? `<p class="ancla">⚓ ${esc(mia.ancla)}</p>` : ''}
      ${mia.escena ? `<p class="escena">🎬 ${esc(mia.escena)}</p>` : ''}
      ${mia.notaPregunta ? `<p class="v-nota">📝 ${esc(mia.notaPregunta)}</p>` : ''}</div>`;
  }
  // Contenido del panel 🧠: 1) qué recordar, 2) por qué, 3) la técnica (oficial o la tuya).
  function contenidoMemoria(m, ref) {
    const f = FILA[ref], e = ESCALA[ref];
    const mia = ref ? mias.get(claveMia.dato(ref)) : null;
    const img = m.imagen ? `<img src="${esc(m.imagen)}" alt="${esc(mia?.ancla || m.ancla || '')}" loading="lazy" decoding="async" data-zoom>` : '';
    const dato = m.dato_a_recordar || f?.normal?.t || '';
    const x = ref ? EXPLICA[ref] : null;
    const porque = [
      x?.porque ? `<p class="porque">🧪 ${esc(x.porque)}</p>` : '',
      m.por_que ? `<p class="porque">${esc(m.por_que)}</p>` : '',
      f?.clave?.texto ? `<p class="v-pq">${esc(f.clave.icono || '🔑')} ${resaltar(f.clave.texto)}</p>` : '',
      (f?.perla || e?.perla) ? `<p class="v-pq">💡 ${resaltar(f?.perla || e?.perla)}</p>` : '',
    ].join('');
    const tecnica = bloqueTecnica(m);
    const html = `${img ? `<div class="v-img">${img}</div>` : ''}
      <div class="v-memo" data-ref="${esc(ref || '')}">
        ${dato ? `<div class="v-paso"><p class="h">🎯 Qué recordar</p><p class="v-dato">${resaltar(dato)}</p></div>` : ''}
        ${porque ? `<div class="v-paso"><p class="h">💡 Por qué</p>${porque}</div>` : ''}
        ${x?.ejemplo ? `<div class="v-paso"><p class="h">🩺 Ejemplo clínico</p><p class="porque">${resaltar(x.ejemplo)}</p>${x.origen === 'literatura' ? '<p class="v-pq"><small>📚 De literatura estándar (no estaba en tu vault)</small></p>' : ''}</div>` : ''}
        ${mia ? `${bloqueMia(mia)}<details class="v-oficial"><summary>Versión oficial de la técnica</summary><div class="v-tec">${tecnica}</div></details>`
    : `<div class="v-paso v-tec"><p class="h">🧠 La técnica</p>${tecnica}</div>`}
        ${ref ? `<div class="v-acc">
          <button type="button" class="btn" data-v3-abrir>🧩 Pruébame</button>
          <button type="button" class="btn" data-ed-abrir="${esc(claveMia.dato(ref))}">✏️ ${mia ? 'Editar mi versión' : 'Mi versión'}</button>
        </div><div class="v-zona"></div>` : ''}
      </div>`;
    return { html, img: !!img };
  }
  // Compatibilidad: devuelve el panel completo (antes se pintaba dentro de cada fila).
  function panelMemoria(m, ref) {
    if (!m) return '';
    const c = contenidoMemoria(m, ref);
    return `<div class="memo ${c.img ? '' : 'sin-img'}" ${ref ? `data-lazy="${esc(ref)}" data-lleno="1"` : ''}>${c.html}</div>`;
  }
  // V5: el panel se llena al abrirse (app.js le pone la clase 'on', aquí se detecta con un MutationObserver).
  function llenar(el) {
    const ref = el.dataset.lazy; const m = MEMO[ref];
    if (!m) return;
    el.dataset.lleno = '1';
    const c = contenidoMemoria(m, ref);
    el.innerHTML = c.html;
    el.classList.toggle('sin-img', !c.img);
  }
  const obs = new MutationObserver((muts) => {
    for (const mu of muts) {
      const el = mu.target;
      if (!el.classList?.contains('memo') || !el.dataset.lazy) continue;
      const abierto = el.classList.contains('on');
      if (abierto && !el.dataset.lleno) llenar(el);
      el.closest('.fila')?.querySelector('.memo-btn')?.setAttribute('aria-expanded', String(abierto));
      // Diseño v2: en el celular la fila se despliega si alguien abre su panel (memo:ir, hoy.js…);
      // en Escalas la tarjeta ocupa todo el ancho de la grilla mientras el panel está abierto.
      const fila = el.closest('.v-fila');
      if (abierto && fila && movil() && !fila.classList.contains('abierta')) alternarFila(fila, true);
      const card = el.closest('.v-esc');
      if (card && card.classList.contains('memo-abierta') !== abierto) {
        card.classList.toggle('memo-abierta', abierto);
        if (abierto) requestAnimationFrame(() => card.scrollIntoView({ block: 'nearest', behavior: sinMov() ? 'auto' : 'smooth' }));
      }
    }
  });
  ['#tabla', '#escalas'].forEach((s) => { const r = $(s); if (r) obs.observe(r, { subtree: true, attributes: true, attributeFilter: ['class'] }); });
  const placeholderMemo = (id) => (MEMO[id] ? `<div class="memo" data-lazy="${esc(id)}"></div>` : '');

  // ---------- V4: editor de mi versión ----------
  function oficialDe(clave) {
    if (clave.startsWith('sig:')) { const s = SIGLAS[clave.slice(4)]; return { ancla: s?.ancla, escena: s?.escena }; }
    if (clave.startsWith('fac:')) { const f = FACIES[clave.slice(4)]; return { ancla: f?.ancla, escena: f?.escena }; }
    return { ancla: MEMO[clave]?.ancla, escena: MEMO[clave]?.escena };
  }
  const CHECK = [['significado', 'Conecta con el significado clínico'], ['protagonista', 'Tiene un protagonista claro'], ['accion', 'Hay acción o movimiento exagerado'], ['sentidos', 'Usa otros sentidos (oír, oler, tocar)']];
  function abrirEditor(zona, clave) {
    const mia = mias.get(clave) || {}; const of = oficialDe(clave);
    zona.innerHTML = `<form class="v-ed" data-clave="${esc(clave)}">
      <p class="h">✏️ Mi versión <span class="vacio">· "Es tuya: la imagen evoca algo para ti"</span></p>
      <label>Mi ancla (una línea)<input name="ancla" maxlength="300" value="${esc(mia.ancla || '')}" placeholder="${esc(of.ancla || 'La frase gancho')}"></label>
      <label>Mi escena<textarea name="escena" rows="4" maxlength="2000" placeholder="${esc(of.escena || 'Protagonista + acción + sentidos, ligada al significado')}">${esc(mia.escena || '')}</textarea></label>
      <label>Nota para la pregunta (opcional)<input name="notaPregunta" maxlength="300" value="${esc(mia.notaPregunta || '')}" placeholder="Tu reformulación, se ve debajo de la pregunta en Repaso"></label>
      <fieldset class="v-check"><legend>Checklist de la escena</legend>
        ${CHECK.map(([k, t]) => `<label><input type="checkbox" name="ck-${k}" ${mia.check?.[k] ? 'checked' : ''}> ${t}</label>`).join('')}
      </fieldset>
      <p class="v-aviso" hidden></p>
      <div class="btns"><button type="submit" class="btn pri">Guardar</button>
        <button type="button" class="btn" data-ed="cancelar">Cancelar</button>
        ${mias.get(clave) ? '<button type="button" class="btn r1" data-ed="borrar">Borrar mi versión</button>' : ''}</div>
    </form>`;
    zona.querySelector('input[name="ancla"]')?.focus();
  }
  function refrescarMia(clave) {
    if (clave.startsWith('sig:') || clave.startsWith('fac:')) {
      $$(`[data-mia-box="${CSS.escape(clave)}"]`).forEach((el) => { el.outerHTML = miaBox(clave); });
    } else {
      $$(`.memo[data-lazy="${CSS.escape(clave)}"]`).forEach((el) => { if (el.dataset.lleno) llenar(el); });
    }
  }
  function guardarEditor(form) {
    const clave = form.dataset.clave; const fd = new FormData(form);
    const obj = { ancla: String(fd.get('ancla') || '').trim(), escena: String(fd.get('escena') || '').trim(), notaPregunta: String(fd.get('notaPregunta') || '').trim(),
      check: Object.fromEntries(CHECK.map(([k]) => [k, fd.get(`ck-${k}`) === 'on'])) };
    if (!obj.ancla && !obj.escena && !obj.notaPregunta) {
      const av = form.querySelector('.v-aviso'); av.hidden = false; av.textContent = 'Escribe al menos tu ancla, tu escena o una nota.'; return;
    }
    mias.set(clave, obj);
    refrescarMia(clave);
    window.dispatchEvent(new CustomEvent('memo:mia-cambio', { detail: { ref: clave } }));
  }
  // Caja compacta de "mi versión" para facies y siglas.
  function miaBox(clave) {
    const mia = mias.get(clave);
    return `<div class="mia-box" data-mia-box="${esc(clave)}">${bloqueMia(mia)}
      <div class="v-acc"><button type="button" class="btn" data-ed-abrir="${esc(clave)}">✏️ ${mia ? 'Editar mi versión' : 'Mi versión'}</button></div><div class="v-zona"></div></div>`;
  }

  // ---------- V3: prueba de reconstrucción ----------
  function abrirPrueba(vm) {
    const ref = vm.dataset.ref; const m = MEMO[ref]; if (!m) return;
    const mia = mias.get(claveMia.dato(ref));
    const nombre = FILA[ref]?.nombre || ESCALA[ref]?.nombre || ref;
    const ancla = mia?.ancla || m.ancla || '';
    vm.closest('.memo')?.classList.add('probando');
    vm.querySelector('.v-zona').innerHTML = `<div class="v-prueba" role="group" aria-label="Prueba de reconstrucción">
      <p class="h">🧩 Prueba de reconstrucción</p>
      <p>Solo con la imagen y el ancla: <b>${esc(nombre)}</b>, ¿qué ${FILA[ref] ? 'valor' : 'dato'} es?</p>
      ${m.imagen ? `<img src="${esc(m.imagen)}" alt="Escena de ${esc(nombre)}" class="v-pr-img">` : '<p class="vacio">🖼️ Sin imagen: imagina tu escena.</p>'}
      ${ancla ? `<p class="ancla">⚓ ${esc(taparCifras(ancla))}</p>` : ''}
      <textarea class="v-pr-in" rows="2" placeholder="¿Qué valor es? Escríbelo de memoria"></textarea>
      <div class="btns"><button type="button" class="btn pri" data-v3="ver">Revelar</button><button type="button" class="btn" data-v3="cerrar">Cerrar prueba</button></div>
      <div class="v-pr-res" hidden></div></div>`;
    vm.querySelector('.v-pr-in')?.focus();
  }
  function revelarPrueba(vm) {
    const ref = vm.dataset.ref; const m = MEMO[ref];
    const dato = m.dato_a_recordar || FILA[ref]?.normal?.t || '';
    const escrito = vm.querySelector('.v-pr-in').value;
    const mios = numeros(escrito);
    const cifras = numeros(dato);
    const marcadas = esc(dato).replace(/\d+(?:[.,]\d+)?/g, (x) => (mios.includes(x.replace(',', '.')) ? `<b class="v-okn">${x}✓</b>` : `<b>${x}</b>`));
    const acertadas = cifras.filter((c) => mios.includes(c)).length;
    const res = vm.querySelector('.v-pr-res'); res.hidden = false;
    res.innerHTML = `<div class="v-compara"><div><p class="h">Tú escribiste</p><p>${esc(escrito) || '<span class="vacio">(nada)</span>'}</p></div>
      <div><p class="h">Dato</p><p>${marcadas}</p></div></div>
      ${cifras.length ? `<p class="vacio">Cifras que coinciden: ${acertadas}/${cifras.length}. Califica tú: no te engañes.</p>` : ''}
      <div class="btns"><button type="button" class="btn r3" data-v3="ok">✓ Lo reconstruí</button><button type="button" class="btn r1" data-v3="no">✗ No me salió</button></div>`;
    vm.querySelector('[data-v3="ver"]')?.remove();
  }
  function cerrarPrueba(vm) { vm.closest('.memo')?.classList.remove('probando'); vm.querySelector('.v-zona').innerHTML = ''; }

  // ---------- V2 · ES1: semáforo por fila ----------
  const ambitoValores = () => secFiltro || 'todas';
  function botonesAE(id, amb, color) {
    return `<div class="ae" role="group" aria-label="Autoexamen: ¿lo sabías?">${SEM.map(([c, ico, t]) =>
      `<button type="button" class="${color === c ? 'on' : ''}" data-ae="${c}" data-id="${esc(id)}" data-amb="${esc(amb)}" aria-pressed="${color === c}" title="${t}" aria-label="${t}">${ico}</button>`).join('')}</div>`;
  }
  function barraAE(tipo) {
    const amb = tipo === 'escalas' ? 'escalas' : ambitoValores();
    const a = aeGet(amb);
    const ids = visibles[tipo];
    const verdes = ids.filter((id) => a.filas[id] === 'v').length;
    const errores = ids.filter((id) => a.filas[id] === 'r' || a.filas[id] === 'a').length;
    const marcadas = ids.filter((id) => a.filas[id]).length;
    const cero = a.ronda > 1 && ids.length && verdes === ids.length;
    return `<span class="v-ae-txt">Ronda ${a.ronda} · 🟢 ${verdes} / ${ids.length}${marcadas < ids.length ? ` <span class="vacio">(${ids.length - marcadas} sin marcar)</span>` : ''}</span>
      ${cero ? '<span class="v-ae-ok">🎉 Cero errores</span>' : ''}
      <button type="button" class="btn" data-ae-ronda="${esc(tipo)}" ${errores ? '' : 'disabled'}>🔁 Ronda de errores (${errores})</button>
      ${a.ronda > 1 || marcadas ? `<button type="button" class="btn" data-ae-reset="${esc(tipo)}">↺ Reiniciar</button>` : ''}`;
  }
  function pintarBarraAE(tipo) { const el = $(`#ae-${tipo}`); if (el) el.innerHTML = barraAE(tipo); }
  function marcarAE(b) {
    const { id, amb } = b.dataset; const a = aeGet(amb);
    a.filas[id] = a.filas[id] === b.dataset.ae ? undefined : b.dataset.ae;
    if (!a.filas[id]) delete a.filas[id];
    aeSet(amb, a);
    $$('button', b.parentElement).forEach((x) => { const on = x.dataset.ae === a.filas[id]; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
    pintarBarraAE(amb === 'escalas' ? 'escalas' : 'valores');
  }
  function rondaAE(tipo) {
    const amb = tipo === 'escalas' ? 'escalas' : ambitoValores();
    const a = aeGet(amb);
    const cola = visibles[tipo].filter((id) => a.filas[id] === 'r' || a.filas[id] === 'a');
    if (!cola.length) return;
    cola.forEach((id) => delete a.filas[id]);
    a.ronda += 1; a.cola = cola; aeSet(amb, a);
    (tipo === 'escalas' ? pintarEscalas : pintarTabla)();
    $(tipo === 'escalas' ? '#escalas' : '#tabla')?.scrollIntoView({ block: 'start' });
  }
  function resetAE(tipo) {
    const amb = tipo === 'escalas' ? 'escalas' : ambitoValores();
    aeSet(amb, { fecha: hoyISO(), ronda: 1, filas: {}, cola: null });
    (tipo === 'escalas' ? pintarEscalas : pintarTabla)();
  }

  // ---------- filtro por técnica (pedido de Métodos) ----------
  function chipTec() {
    return tecFiltro ? `<button type="button" class="chip on v-tec-chip" data-tec-quitar aria-label="Quitar filtro de técnica ${esc(nombreMetodo(tecFiltro))}">${esc(METODOS[tecFiltro]?.icono || '🧩')} ${esc(nombreMetodo(tecFiltro))} ✕</button>` : '';
  }
  const pasaTec = (id) => !tecFiltro || (MEMO[id]?.tecnicas || []).includes(tecFiltro);

  // ---------- Valores ----------
  // Diseño v2: en el celular cada parámetro es una fila compacta (icono + nombre + normal) que se despliega
  // (acordeón) con sube/baja/clave y 🧠. En escritorio, la grilla de 4 columnas. Chips de sección pegajosos
  // con scroll-spy: en "Todas", tocar un chip salta a la sección; "🎯 Solo esta" (o un clic programático,
  // como el de hoy.js/repaso.js) filtra, igual que antes.
  const abiertas = new Set();
  function montarSelectorOcultar() {
    const barra = $('#v-tabla .barra'); if (!barra || $('#v-ocultar')) return;
    const viejo = $('#ocultar'); // interruptor único de antes: lo reemplaza el selector (V2)
    if (viejo) { viejo.checked = false; document.body.classList.remove('ocultar'); const l = viejo.closest('label'); if (l) l.style.display = 'none'; }
    barra.insertAdjacentHTML('beforeend', `<label class="toggle v-sel">🙈 Autoexamen
      <select id="v-ocultar" aria-label="Qué columnas ocultar para el autoexamen">
        <option value="">no ocultar</option><option value="n">ocultar Normal</option><option value="ub">ocultar Sube/Baja</option><option value="todo">ocultar todo</option>
      </select></label>`);
    $('#v-ocultar').value = ocultarModo;
    $('#v-ocultar').addEventListener('change', (e) => { ocultarModo = e.target.value; hudLleno = false; aplicarOcultar(); pintarTabla(); haptico('toque'); });
  }
  function aplicarOcultar() {
    const b = document.body.classList;
    b.toggle('ocultar', ocultarModo === 'todo'); b.toggle('ocultar-n', ocultarModo === 'n'); b.toggle('ocultar-ub', ocultarModo === 'ub');
  }
  // Barra pegajosa: se mueve #filtro-sec (con su listener de app.js) a un contenedor propio encima de #tabla.
  function montarPega() {
    if ($('#v-pega')) return;
    const fs = $('#filtro-sec'), tabla = $('#tabla'); if (!fs || !tabla) return;
    const pega = document.createElement('div');
    pega.id = 'v-pega'; pega.className = 'v-pega';
    pega.innerHTML = '<div class="v-hud" id="v-hud" hidden></div>';
    tabla.before(pega); pega.prepend(fs);
    fs.classList.add('v-chips'); fs.setAttribute('role', 'navigation'); fs.setAttribute('aria-label', 'Secciones de Valores');
    // fase de captura: va antes del listener de app.js en #filtro-sec. Solo toques reales y sin filtro activo.
    $('#v-tabla').addEventListener('click', (e) => {
      const b = e.target.closest('#filtro-sec [data-s]');
      if (!b || !e.isTrusted || secFiltro || !b.dataset.s) return;
      const sec = document.getElementById(`sec-${b.dataset.s}`); if (!sec) return; // oculta por la búsqueda: filtra como siempre
      e.stopPropagation(); e.preventDefault(); irASeccion(sec); haptico('toque');
    }, true);
    if ('ResizeObserver' in window) { const ro = new ResizeObserver(medir); ro.observe(pega); const top = $('.top'); if (top) ro.observe(top); }
    addEventListener('resize', medir); medir();
  }
  function medir() {
    const r = document.documentElement.style;
    r.setProperty('--v-top-h', `${movil() ? ($('.top')?.offsetHeight || 0) : 0}px`);
    r.setProperty('--v-pega-h', `${$('#v-pega')?.offsetHeight || 0}px`);
  }
  function irASeccion(sec) {
    const pegaH = $('#v-pega')?.offsetHeight || 0;
    const r = sec.getBoundingClientRect();
    const topH = movil() && r.top < 0 ? ($('.top')?.offsetHeight || 0) : 0; // al subir reaparece la cabecera
    scrollTo({ top: Math.max(0, r.top + scrollY - pegaH - topH - 8), behavior: sinMov() ? 'auto' : 'smooth' });
  }
  let spyId = '·', spyRaf = 0;
  function spy() {
    spyRaf = 0;
    if (!$('#v-tabla')?.classList.contains('on')) return;
    let act = null;
    if (!secFiltro) {
      const lim = ($('#v-pega')?.getBoundingClientRect().bottom || 0) + 28;
      for (const s of $$('#tabla .v-sec')) { if (s.getBoundingClientRect().top <= lim) act = s.dataset.sec; else break; }
    }
    if (act === spyId) return; spyId = act;
    $$('#filtro-sec [data-s]').forEach((c) => {
      const on = !!act && c.dataset.s === act; c.classList.toggle('v-spy', on);
      if (on) c.setAttribute('aria-current', 'location'); else c.removeAttribute('aria-current');
    });
    const tira = $('#filtro-sec'); const chip = act && tira?.querySelector(`[data-s="${CSS.escape(act)}"]`);
    if (chip && tira.scrollWidth > tira.clientWidth) tira.scrollTo({ left: chip.offsetLeft - (tira.clientWidth - chip.offsetWidth) / 2, behavior: sinMov() ? 'auto' : 'smooth' });
  }
  addEventListener('scroll', () => { if (!spyRaf) spyRaf = requestAnimationFrame(spy); }, { passive: true });

  function filtros() {
    montarSelectorOcultar(); montarPega();
    const nMemo = (s) => s.filas.filter((f) => MEMO[f.id]).length;
    $('#filtro-sec').innerHTML = [`<button class="chip ${secFiltro ? '' : 'on'}" data-s="">Todas</button>`]
      .concat(ATLAS.secciones.map((s) => `<button class="chip ${secFiltro === s.id ? 'on' : ''}" data-s="${s.id}" style="--sc:${s.color}" title="${s.filas.length} parámetros · 🧠 ${nMemo(s)}"><span class="v-dot" aria-hidden="true"></span>${s.icono} ${esc(s.titulo.replace(/^\d+ · /, ''))}</button>`))
      .join('') + chipTec();
    spyId = '·';
  }
  function filaHTML(f, amb, a) {
    const m = MEMO[f.id];
    const mv = movil(), ab = mv && abiertas.has(f.id);
    const alt = f.altura ? `<span class="alt">🏔 ${f.altura.lit ? `<span class="lit">${esc(f.altura.t)}<sup>lit.</sup></span>` : esc(f.altura.t)}</span>` : '';
    const clave = f.clave ? `<div class="clave"><span class="ic">${f.clave.icono}</span>${f.clave.lit ? `<span class="lit">${resaltar(f.clave.texto)}<sup>lit.</sup></span>` : resaltar(f.clave.texto)}${f.perla ? ` · ${resaltar(f.perla)}` : ''}</div>`
      : f.perla ? `<div class="clave">💡 ${resaltar(f.perla)}</div>` : '';
    const nombre = `<span class="v-ico" aria-hidden="true">${f.icono}</span><span class="nm">${esc(f.nombre)}</span>`;
    return `<article class="fila v-fila${ab ? ' abierta' : ''}${m ? ' con-memo' : ''}" id="p-${f.id}">
      <div class="fila-cab">
        <div class="p-nom">${mv
    ? `<button type="button" class="v-fila-t" aria-expanded="${ab}" aria-controls="m-${f.id}">${nombre}${m ? '<span class="v-tiene" title="Tiene técnica" aria-label="tiene técnica">🧠</span>' : ''}<span class="v-chev" aria-hidden="true"></span></button>`
    : `<span class="v-fila-t">${nombre}</span>`}
          ${botonesAE(f.id, amb, a.filas[f.id])}</div>
        <div class="c-n"><b class="h">✅ Normal</b><span class="val">${celda(f.normal)}${alt}</span></div>
        <div class="v-mas" id="m-${f.id}"><div class="v-mas-in">
          <div class="c-u"><b class="h">🔺 Si sube</b><span class="val">${celda(f.sube)}</span></div>
          <div class="c-d"><b class="h">🔻 Si baja</b><span class="val">${celda(f.baja)}</span></div>
          ${clave}
          <div class="v-acc-fila"><button class="memo-btn" data-memo="${f.id}" ${m ? 'aria-expanded="false"' : 'disabled title="Aún sin técnica"'}>🧠 ${m ? 'Cómo recordarlo' : 'pronto'}</button></div>
        </div></div>
      </div>
      ${placeholderMemo(f.id)}
    </article>`;
  }
  function alternarFila(fila, abrir) {
    const id = fila.id.slice(2);
    const on = abrir ?? !fila.classList.contains('abierta');
    fila.classList.toggle('abierta', on);
    fila.querySelector('button.v-fila-t')?.setAttribute('aria-expanded', String(on));
    if (on) abiertas.add(id);
    else { abiertas.delete(id); fila.querySelector('.memo.on')?.classList.remove('on'); }
  }
  const vacioHTML = (icono, txt, botones = '') => `<div class="v-vacio v-ancho"><b aria-hidden="true">${icono}</b><p>${txt}</p>${botones ? `<div class="btns">${botones}</div>` : ''}</div>`;
  function pintarTabla() {
    aplicarOcultar();
    const qCrudo = $('#buscar')?.value || '';
    const q = norm(qCrudo);
    const soloMemo = $('#solo-memo')?.checked;
    const amb = ambitoValores(); const a = aeGet(amb);
    const cola = ocultarModo && a.cola ? new Set(a.cola) : null;
    const ids = [];
    const html = ATLAS.secciones.filter((s) => !secFiltro || s.id === secFiltro).map((s) => {
      const filas = s.filas.filter((f) => {
        if (soloMemo && !MEMO[f.id]) return false;
        if (!pasaTec(f.id)) return false;
        if (cola && !cola.has(f.id)) return false;
        if (!q) return true;
        return norm([f.parametro, f.nombre, f.normal?.t, f.sube?.t, f.baja?.t, f.clave?.texto, f.perla].join(' ')).includes(q);
      });
      if (!filas.length) return '';
      filas.forEach((f) => ids.push(f.id));
      const conMemo = filas.filter((f) => MEMO[f.id]).length;
      return `<div class="sec v-sec" id="sec-${s.id}" data-sec="${s.id}" style="--sc:${s.color}"><h2 style="background:${s.color}"><span class="v-sec-ico" aria-hidden="true">${s.icono}</span><span class="v-sec-t">${esc(s.titulo)}</span><span class="n">${filas.length} parámetros · 🧠 ${conMemo}</span>${btnEstudiada(s.id)}${secFiltro ? '' : `<button type="button" class="v-enfocar" data-v-enfocar="${s.id}" aria-label="Ver solo ${esc(s.titulo)}">🎯 Solo esta</button>`}</h2>
        ${filas.map((f) => filaHTML(f, amb, a)).join('')}</div>`;
    }).join('');
    visibles.valores = ids;
    const aviso = cola ? `<p class="v-ronda-aviso">🔁 Ronda ${a.ronda}: solo tus 🔴/🟡 de la ronda anterior (${cola.size}).</p>` : '';
    const botones = [qCrudo ? '<button type="button" class="btn" data-v-limpiar>✕ Borrar búsqueda</button>' : '',
      secFiltro ? '<button type="button" class="btn" data-v-todas>Ver todas las secciones</button>' : '',
      tecFiltro ? '<button type="button" class="btn" data-tec-quitar>Quitar filtro de técnica</button>' : ''].join('');
    $('#tabla').innerHTML = (ocultarModo ? `<div class="v-ae" id="ae-valores" aria-live="polite">${barraAE('valores')}</div>${aviso}` : '')
      + (html || vacioHTML('🔍', qCrudo ? `Ningún parámetro coincide con «${esc(qCrudo)}». Prueba sin tildes o con otra palabra (p. ej. «sodio», «PAM»).` : 'No hay parámetros con estos filtros.', botones));
    pintarHUD(true);
    spyId = '·'; requestAnimationFrame(spy);
  }

  // ---------- V2 como juego: revelar con animación + contador ----------
  let hudLleno = false;
  function elegibles() {
    const sel = ocultarModo === 'n' ? '.c-n .val' : ocultarModo === 'ub' ? '.c-u .val, .c-d .val' : '.c-n .val, .c-u .val, .c-d .val';
    return $$(sel, $('#tabla')).filter((v) => !(v.children.length === 1 && v.firstElementChild.classList.contains('vacio')));
  }
  function pintarHUD(repintado = false) {
    const hud = $('#v-hud'); if (!hud) return;
    if (!ocultarModo) { hud.hidden = true; hud.innerHTML = ''; return; }
    if (!hud.firstChild) {
      hud.innerHTML = `<span class="v-hud-ojo" aria-hidden="true">👁️</span>
        <span class="v-hud-txt" role="status"><b class="v-hud-n">0</b> / <span class="v-hud-t">0</span> revelados</span>
        <span class="v-hud-bar" aria-hidden="true"><i></i></span>
        <button type="button" class="v-hud-btn" data-v-reocultar>↺ Ocultar</button>`;
    }
    hud.hidden = false;
    const v = elegibles(); const n = v.length; const r = v.filter((x) => x.classList.contains('ver')).length;
    const lleno = n > 0 && r === n;
    $('.v-hud-n', hud).textContent = r; $('.v-hud-t', hud).textContent = n;
    $('.v-hud-bar i', hud).style.width = `${n ? (r / n) * 100 : 0}%`;
    $('.v-hud-ojo', hud).textContent = lleno ? '🎉' : r ? '👀' : '🙈';
    $('[data-v-reocultar]', hud).disabled = !r;
    hud.classList.toggle('lleno', lleno);
    if (lleno && !hudLleno && !repintado) {
      haptico('logro');
      hud.classList.remove('festeja'); void hud.offsetWidth; hud.classList.add('festeja');
      window.dispatchEvent(new CustomEvent('memo:aviso', { detail: { texto: `🎉 ¡Revelaste los ${n}! Marca con el semáforo lo que no sabías y haz la ronda de errores.`, ms: 5000 } }));
    }
    hudLleno = lleno;
  }
  function revelarVal(val) {
    if (val.classList.contains('ver')) return;
    val.classList.add('ver');
    haptico('toque');
    pintarHUD();
  }

  // ---------- Escalas (ES1 + calculadora) ----------
  const COLOR = { N: '#2e7d32', L: '#f9a825', M: '#ef6c00', G: '#c62828' };
  const SEMAF = { N: '🟢', L: '🟡', M: '🟠', G: '🔴' };
  const MODELO = {};
  const modeloDe = (e) => { if (!(e.id in MODELO)) MODELO[e.id] = construirModelo(e); return MODELO[e.id]; };
  const calc = {};
  const estCalc = (id) => (calc[id] ||= { abierta: false, sel: {}, val: null, ideal: '', real: '', prev: null });
  let escSoloCalc = false, escPrimera = true;
  const fmtPts = (n, tipo) => (tipo === 'uno' ? fmtNum(n) : n > 0 ? `+${fmtNum(n)}` : fmtNum(n));
  function calcHTML(e, mod) {
    const st = estCalc(e.id);
    let cuerpo = '';
    if (mod.tipo === 'suma') {
      cuerpo = mod.grupos.map((g, gi) => {
        const uno = g.tipo === 'uno';
        return `<fieldset class="v-cg"><legend>${esc(g.titulo)}${uno && !g.req ? ' <span class="vacio">· opcional</span>' : ''}${uno ? '' : ' <span class="vacio">· marca los que tenga</span>'}</legend>
          <div class="v-cops" role="${uno ? 'radiogroup' : 'group'}" aria-label="${esc(g.titulo)}">${g.opciones.map((o, oi) => {
  const on = uno ? st.sel[gi] === oi : !!st.sel[gi]?.has(oi);
  return `<button type="button" class="v-cop${on ? ' on' : ''}" role="${uno ? 'radio' : 'checkbox'}" aria-checked="${on}" data-cop="${gi}:${oi}"><span class="v-cpts">${fmtPts(o.pts, g.tipo)}</span><span class="v-ctx">${esc(o.t)}</span><span class="v-cmk" aria-hidden="true"></span></button>`;
}).join('')}</div></fieldset>`;
      }).join('');
    } else if (mod.tipo === 'clase') {
      cuerpo = `<p class="v-cayuda">¿Cuál describe al paciente?</p><div class="v-cops v-cclase" role="radiogroup" aria-label="${esc(e.nombre)}">${mod.opciones.map((o) =>
        `<button type="button" class="v-cop${st.sel.c === o.k ? ' on' : ''}" role="radio" aria-checked="${st.sel.c === o.k}" data-cclase="${o.k}"><span class="v-cpts">${esc(o.t)}</span><span class="v-ctx">${esc(o.d)}</span><span class="v-cmk" aria-hidden="true"></span></button>`).join('')}</div>`;
    } else if (mod.tipo === 'rango') {
      const marcas = []; for (let i = mod.min; i <= mod.max; i++) marcas.push(`<span>${i}</span>`);
      cuerpo = `<div class="v-crango-box"><input type="range" class="v-crango" min="${mod.min}" max="${mod.max}" step="1" value="${st.val ?? mod.min}" aria-label="Puntaje de ${esc(e.nombre)} (${mod.min} a ${mod.max})">
        <div class="v-cticks" aria-hidden="true">${marcas.join('')}</div></div>`;
    } else if (mod.tipo === 'formula') {
      cuerpo = `<div class="v-cform"><label>Peso ideal (kg)<input type="number" inputmode="decimal" min="0" step="0.1" data-cf="ideal" value="${esc(st.ideal)}" placeholder="p. ej. 20"></label>
        <label>Peso real (kg)<input type="number" inputmode="decimal" min="0" step="0.1" data-cf="real" value="${esc(st.real)}" placeholder="p. ej. 16"></label></div>
        <p class="v-cfx">${esc(mod.formula)}</p>`;
    }
    return `<div class="v-calc" data-calc="${esc(e.id)}">${cuerpo}
      <div class="v-cres" data-k=""></div>
      <div class="v-cacc"><button type="button" class="v-creset" data-calc-reset>↺ Reiniciar</button></div></div>`;
  }
  function resultadoCalc(e, mod, st) {
    if (mod.tipo === 'clase') return st.sel.c == null ? { pide: 'Toca la opción que describe al paciente.' } : { k: st.sel.c, txt: e.interpretacion[st.sel.c][0], uni: '' };
    if (mod.tipo === 'rango') return st.val == null ? { pide: `Desliza o toca un valor de ${mod.min} a ${mod.max}.` } : { k: interpretar(mod.rs, st.val), v: st.val, uni: `/ ${mod.max}` };
    if (mod.tipo === 'formula') {
      const pi = aNum(st.ideal), pr = aNum(st.real);
      if (!(pi > 0) || !(pr > 0)) return { pide: 'Escribe el peso ideal y el peso real.' };
      const v = Math.max(0, ((pi - pr) / pi) * 100);
      return { k: interpretar(mod.rs, v), v, dec: 1, uni: '% déficit', det: pr >= pi ? 'Peso real ≥ peso ideal: sin déficit.' : '' };
    }
    let v = 0; const falta = [];
    mod.grupos.forEach((g, gi) => {
      const s = st.sel[gi];
      if (g.tipo === 'uno') { if (s == null) { if (g.req) falta.push(g.letra || g.titulo); } else v += g.opciones[s].pts; }
      else s?.forEach((oi) => { v += g.opciones[oi].pts; });
    });
    if (falta.length) return { pide: `${v ? `Parcial: ${fmtNum(v)} · ` : ''}Elige ${falta.join(', ')} para completar el puntaje.` };
    const det = mod.grupos.filter((g) => g.letra).map((g) => `${g.letra}${g.opciones[st.sel[mod.grupos.indexOf(g)]].pts}`).join(' · ');
    return { k: interpretar(mod.rs, v), v, dec: mod.dec, uni: mod.max != null ? `/ ${mod.max}` : (Math.abs(v) === 1 ? 'punto' : 'puntos'), det };
  }
  function actualizarCalc(card) {
    const id = card.id.slice(2); const e = ESCALA[id]; const mod = e && modeloDe(e); const st = estCalc(id);
    const sem = card.querySelector('.sem'); const spans = sem ? [...sem.children] : [];
    const out = card.querySelector('.v-calc .v-cres');
    if (!mod || !st.abierta || !out) { spans.forEach((s) => s.classList.remove('activa')); sem?.classList.remove('v-con'); return; }
    const r = resultadoCalc(e, mod, st);
    const k = r.pide ? -1 : r.k;
    spans.forEach((s, i) => s.classList.toggle('activa', i === k)); sem?.classList.toggle('v-con', k >= 0);
    if (r.pide) { out.innerHTML = `<p class="v-cpide">👆 ${esc(r.pide)}</p>`; out.dataset.k = ''; out.removeAttribute('data-g'); st.prev = null; return; }
    const [rango, texto, g] = e.interpretacion[k];
    if (!out.querySelector('.v-cval')) {
      out.innerHTML = `<div class="v-cnum"><b class="v-cval" aria-hidden="true"></b><span class="v-cuni" aria-hidden="true"></span></div>
        <div class="v-cint" aria-live="polite"><span class="v-csem" aria-hidden="true"></span><span><span class="v-sr"></span><b class="v-cr"></b> <span class="v-ct"></span></span></div><p class="v-cdet"></p>`;
    }
    out.style.setProperty('--c', COLOR[g] || '#607d8b'); out.dataset.g = g || '';
    const num = out.querySelector('.v-cval');
    if (r.txt != null) num.textContent = r.txt; else animarNum(num, st.prev ?? r.v, r.v, r.dec || 0);
    st.prev = r.v ?? null;
    out.querySelector('.v-cuni').textContent = r.uni || '';
    out.querySelector('.v-sr').textContent = `Resultado ${r.txt ?? fmtNum(r.v, r.dec)}${r.uni ? ` ${r.uni}` : ''}: `;
    out.querySelector('.v-csem').textContent = SEMAF[g] || '⚪';
    out.querySelector('.v-cr').textContent = rango; out.querySelector('.v-ct').textContent = texto;
    out.querySelector('.v-cdet').textContent = r.det || '';
    if (out.dataset.k !== String(k)) {
      const ci = out.querySelector('.v-cint'); ci.classList.remove('salta'); void ci.offsetWidth; ci.classList.add('salta');
      if (out.dataset.k !== '') haptico(g === 'G' ? 'mal' : 'toque');
    }
    out.dataset.k = String(k);
  }
  function animarNum(el, a, b, dec) {
    if (sinMov() || a === b || !Number.isFinite(a)) { el.textContent = fmtNum(b, dec); return; }
    const t0 = performance.now(); const tok = (el._tok = (el._tok || 0) + 1);
    const paso = (t) => {
      if (el._tok !== tok) return;
      const p = Math.min(1, (t - t0) / 320); const x = a + (b - a) * (1 - (1 - p) ** 3);
      el.textContent = fmtNum(p < 1 ? x : b, p < 1 ? Math.max(dec, 0) : dec);
      if (p < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }
  function cuerpoEscala(card, e) {
    const mod = modeloDe(e); const st = estCalc(e.id);
    const c = card.querySelector('.v-esc-cuerpo'); if (!c) return;
    c.innerHTML = st.abierta && mod ? calcHTML(e, mod) : tablaEsc(e);
    card.classList.toggle('calc-on', !!st.abierta);
    $$('[data-esc-modo]', card).forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.escModo === 'calc') === !!st.abierta)));
    actualizarCalc(card);
  }
  const tablaEsc = (e) => `<table>${(e.items || []).map(([x, y]) => `<tr><td>${esc(x)}</td><td>${resaltar(y)}</td></tr>`).join('')}</table>`;
  function pintarEscalas() {
    const qCrudo = $('#buscar')?.value || '';
    const q = norm(qCrudo);
    const a = aeGet('escalas');
    const cola = escOcultas && a.cola ? new Set(a.cola) : null;
    const nCalc = ATLAS.escalas.filter((e) => modeloDe(e)).length;
    const lista = ATLAS.escalas.filter((e) => (!q || norm(JSON.stringify(e)).includes(q)) && pasaTec(e.id) && (!cola || cola.has(e.id)) && (!escSoloCalc || modeloDe(e)));
    visibles.escalas = lista.map((e) => e.id);
    const raiz = $('#escalas');
    raiz.classList.toggle('esc-ocultas', escOcultas);
    const anim = escPrimera && !sinMov(); escPrimera = false;
    raiz.innerHTML = `<div class="v-barra v-ancho">${btnEstudiada('escalas')}
        <label class="toggle"><input type="checkbox" id="v-esc-ocultar" ${escOcultas ? 'checked' : ''}> <span>🙈 Ocultar puntajes (autoexamen)</span></label>
        ${nCalc ? `<button type="button" class="chip${escSoloCalc ? ' on' : ''}" data-esc-solo-calc aria-pressed="${escSoloCalc}">🧮 Con calculadora (${nCalc})</button>` : ''}${chipTec()}</div>
      ${escOcultas ? `<div class="v-ae v-ancho" id="ae-escalas" aria-live="polite">${barraAE('escalas')}</div>` : ''}
      ${cola ? `<p class="v-ronda-aviso v-ancho">🔁 Ronda ${a.ronda}: solo tus 🔴/🟡 (${cola.size}).</p>` : ''}`
      + (lista.map((e, i) => {
        const m = MEMO[e.id]; const mod = modeloDe(e); const ab = !!(mod && estCalc(e.id).abierta);
        return `<article class="esc fila v-esc${ab ? ' calc-on' : ''}${mod ? ' calculable' : ''}${anim && i < 10 ? ' v-entra' : ''}" id="p-${e.id}"${anim && i < 10 ? ` style="--i:${i}"` : ''}>
        <div class="v-esc-cab"><h3>${e.icono || '📏'} ${esc(e.nombre)}</h3>${botonesAE(e.id, 'escalas', a.filas[e.id])}</div><p class="mide">${esc(e.mide || '')}</p>
        ${mod ? `<div class="v-modo" role="group" aria-label="Ver ${esc(e.nombre)} como"><button type="button" data-esc-modo="ficha" aria-pressed="${!ab}">📖 Ficha</button><button type="button" data-esc-modo="calc" aria-pressed="${ab}">🧮 Calcular</button></div>` : ''}
        <div class="v-esc-cuerpo">${ab ? calcHTML(e, mod) : tablaEsc(e)}</div>
        <div class="sem">${(e.interpretacion || []).map(([p, t, g]) => `<span style="--c:${COLOR[g] || '#607d8b'};border-color:${COLOR[g] || '#607d8b'}"><b style="background:${COLOR[g] || '#607d8b'}">${esc(p)}</b><i>${esc(t)}</i></span>`).join('')}</div>
        ${e.perla ? `<p class="perla">💡 ${esc(e.perla)}</p>` : ''}
        <button class="memo-btn" data-memo="${e.id}" ${m ? 'aria-expanded="false"' : 'disabled'}>🧠 ${m ? 'Cómo recordarla' : 'pronto'}</button>
        ${placeholderMemo(e.id)}</article>`;
      }).join('') || vacioHTML('📏', qCrudo ? `Ninguna escala coincide con «${esc(qCrudo)}».` : 'No hay escalas con estos filtros.',
        [qCrudo ? '<button type="button" class="btn" data-v-limpiar>✕ Borrar búsqueda</button>' : '', escSoloCalc ? '<button type="button" class="btn" data-esc-solo-calc>Ver todas las escalas</button>' : '', tecFiltro ? '<button type="button" class="btn" data-tec-quitar>Quitar filtro de técnica</button>' : ''].join('')));
    lista.forEach((e) => { if (estCalc(e.id).abierta) { const c = document.getElementById(`p-${e.id}`); if (c) actualizarCalc(c); } });
  }

  // ---------- Facies (F1): galería + modo adivina ----------
  const adiv = { ver: new Set(), ok: new Set(), mal: new Set() };
  let facPrimera = true;
  function facHTML(f, i, anim) {
    const fm = FACIES[f.id]; const nom = esc(f.nombre);
    const est = adiv.ok.has(f.id) ? ' v-ok' : adiv.mal.has(f.id) ? ' v-mal' : '';
    const ver = facOcultas && adiv.ver.has(f.id) ? ' ver' : '';
    const img = f.imagen ? `<img src="${esc(facOcultas ? (f.imagen_quiz || f.imagen) : f.imagen)}" alt="${facOcultas ? 'Facies (nombre oculto)' : `Facies ${nom}`}" loading="lazy" decoding="async" data-zoom>` : '<div class="v-fac-sin" aria-hidden="true">🙂</div>';
    const info = `<span class="fr">${esc(f.rasgo)}</span><span class="o">→ ${esc(f.orienta)}</span>`;
    const ancla = fm?.ancla ? `<span class="v-fac-ancla">⚓ ${esc(fm.ancla)}</span>` : '';
    const velo = facOcultas
      ? `<button type="button" class="v-fac-velo" data-fac-ver aria-expanded="${!!ver}" aria-label="${ver ? `Facies ${nom}` : 'Revelar qué facies es'}"><span class="v-fac-q" aria-hidden="true">?</span><span class="v-fac-nom fn">${nom}</span><span class="v-fac-det">${info}${ancla}</span></button>`
      : `<button type="button" class="v-fac-velo" data-fac-ver aria-expanded="false" aria-label="Facies ${nom}: ver rasgo y qué orienta"><span class="v-fac-nom fn">${nom}</span><span class="v-fac-det">${info}</span><span class="v-fac-pista" aria-hidden="true">toca · ¿qué orienta?</span></button>`;
    const juzga = facOcultas && ver && !est ? `<div class="v-fac-juzga" role="group" aria-label="¿La reconociste?"><button type="button" class="btn r3" data-fac-juzga="ok">✓ La sabía</button><button type="button" class="btn r1" data-fac-juzga="mal">✗ No</button></div>` : '';
    return `<article class="fac v-fac${est}${ver}${anim && i < 12 ? ' v-entra' : ''}" data-fac="${esc(f.id)}"${anim && i < 12 ? ` style="--i:${i}"` : ''}>
      <div class="v-fac-media">${img}${velo}${f.imagen ? `<button type="button" class="v-fac-zoom" data-fac-zoom aria-label="Ampliar foto">🔍</button>` : ''}${est ? `<span class="v-fac-sello" aria-hidden="true">${adiv.ok.has(f.id) ? '✓' : '✗'}</span>` : ''}</div>
      ${juzga}
      ${fm ? `<details class="fmemo"><summary>🧠 Cómo recordarla</summary>${miaBox(claveMia.facies(f.id))}<p class="ancla">⚓ ${esc(fm.ancla)}</p><p class="escena">🎬 ${esc(fm.escena)}</p></details>` : ''}</article>`;
  }
  function hudFacies(n) {
    const ok = adiv.ok.size, mal = adiv.mal.size, quedan = Math.max(0, n - ok - mal);
    const fin = n > 0 && !quedan;
    return `<span class="v-adiv-txt">${fin ? '🎉' : '🎯'} <b>${ok}</b> ✓ · <b>${mal}</b> ✗ · ${fin ? `${Math.round((ok / n) * 100)} % de aciertos` : `quedan ${quedan}`}</span>
      <span class="v-hud-bar" aria-hidden="true"><i style="width:${n ? ((ok + mal) / n) * 100 : 0}%"></i></span>
      ${ok + mal || adiv.ver.size ? '<button type="button" class="v-hud-btn" data-fac-reinicio>↺ Reiniciar</button>' : ''}`;
  }
  function pintarFacies() {
    const qCrudo = $('#buscar')?.value || '';
    const q = norm(qCrudo);
    const raiz = $('#facies');
    raiz.classList.toggle('fac-ocultas', facOcultas);
    const conFoto = ATLAS.facies.filter((f) => f.imagen).length;
    const lista = ATLAS.facies.filter((f) => !q || norm(JSON.stringify(f)).includes(q));
    const anim = facPrimera && !sinMov(); facPrimera = false;
    raiz.innerHTML = `<div class="v-barra v-ancho">${btnEstudiada('facies')}
        <div class="v-seg" role="group" aria-label="Modo de la galería"><button type="button" data-fac-modo="galeria" aria-pressed="${!facOcultas}">🖼️ Galería</button><button type="button" data-fac-modo="adivina" aria-pressed="${facOcultas}">🎯 Adivina</button></div>
        <button type="button" class="btn" data-fac-ronda ${conFoto ? '' : 'disabled'}>⏱️ Ronda rápida (${conFoto})</button></div>
      ${facOcultas ? `<div class="v-hud v-adiv v-ancho" id="v-adiv" role="status">${hudFacies(lista.length)}</div>` : `<p class="vacio v-ayuda v-ancho">${movil() ? 'Toca' : 'Pasa el cursor o toca'} una foto para ver el rasgo y qué orienta · 🔍 amplía.</p>`}`
      + (lista.map((f, i) => facHTML(f, i, anim)).join('') || vacioHTML('🙂', `Ninguna facies coincide con «${esc(qCrudo)}».`, '<button type="button" class="btn" data-v-limpiar>✕ Borrar búsqueda</button>'));
  }
  function juzgarFacies(card, bien) {
    const id = card.dataset.fac;
    (bien ? adiv.ok : adiv.mal).add(id); haptico(bien ? 'bien' : 'mal');
    card.classList.add(bien ? 'v-ok' : 'v-mal');
    card.querySelector('.v-fac-juzga')?.remove();
    card.querySelector('.v-fac-media')?.insertAdjacentHTML('beforeend', `<span class="v-fac-sello" aria-hidden="true">${bien ? '✓' : '✗'}</span>`);
    const n = $$('#facies .v-fac').length; const h = $('#v-adiv'); if (h) h.innerHTML = hudFacies(n);
    if (n && adiv.ok.size + adiv.mal.size >= n) { haptico('logro'); h?.classList.add('festeja'); }
  }
  // Ronda rápida: foto al azar, 5 s para recordar el nombre, luego ✓ / ✗ (prueba de nombres, #124).
  let rr = null;
  function abrirRonda(ids) {
    cerrarRonda();
    rr = { cola: barajar(ids), i: 0, ok: [], mal: [], timer: null, previo: document.activeElement };
    const el = document.createElement('div');
    el.className = 'v-rr'; el.id = 'v-rr'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Ronda rápida de facies');
    document.body.appendChild(el);
    pasoRonda();
  }
  function pasoRonda() {
    const el = $('#v-rr'); if (!el || !rr) return;
    clearInterval(rr.timer);
    if (rr.i >= rr.cola.length) {
      const n = rr.cola.length, pct = Math.round((rr.ok.length / n) * 100);
      el.innerHTML = `<div class="v-rr-caja"><p class="h">Fin de la ronda</p><p class="v-rr-n">${rr.ok.length} / ${n} · ${pct} %</p>
        <p>${pct >= 90 ? '🟢 Excelente' : pct >= 60 ? '🟡 Bien, repite las falladas' : '🔴 Repasa las escenas y vuelve a intentarlo'}</p>
        <div class="btns">${rr.mal.length ? `<button type="button" class="btn pri" data-rr="repetir">🔁 Repetir solo las falladas (${rr.mal.length})</button>` : ''}
        <button type="button" class="btn" data-rr="cerrar">Cerrar</button></div></div>`;
      el.querySelector('button')?.focus();
      return;
    }
    const f = FAC[rr.cola[rr.i]];
    let s = 5;
    el.innerHTML = `<div class="v-rr-caja"><div class="v-rr-top"><span>${rr.i + 1} / ${rr.cola.length}</span><span class="v-rr-cuenta" aria-live="off">${s}</span>
        <button type="button" class="icon-btn" data-rr="cerrar" aria-label="Cerrar ronda">✕</button></div>
      <img src="${esc(f.imagen_quiz || f.imagen)}" alt="Facies por adivinar">
      <p class="v-rr-pide">¿Qué facies es? Dilo en voz alta.</p>
      <div class="v-rr-res" hidden></div>
      <div class="btns"><button type="button" class="btn pri" data-rr="ver">Revelar</button></div></div>`;
    el.querySelector('[data-rr="ver"]')?.focus();
    rr.timer = setInterval(() => {
      s -= 1; const c = el.querySelector('.v-rr-cuenta'); if (c) c.textContent = s;
      if (s <= 0) revelarRonda();
    }, 1000);
  }
  function revelarRonda() {
    const el = $('#v-rr'); if (!el || !rr) return;
    clearInterval(rr.timer);
    const f = FAC[rr.cola[rr.i]]; const fm = FACIES[f.id]; const mia = mias.get(claveMia.facies(f.id));
    const res = el.querySelector('.v-rr-res'); if (!res || !res.hidden) return;
    res.hidden = false;
    res.innerHTML = `<p class="v-rr-nom">${esc(f.nombre)}</p><p>${esc(f.rasgo)}</p>${(mia?.ancla || fm?.ancla) ? `<p class="ancla">⚓ ${esc(mia?.ancla || fm.ancla)}</p>` : ''}`;
    el.querySelector('.v-rr-pide')?.remove();
    const cu = el.querySelector('.v-rr-cuenta'); if (cu) cu.textContent = '';
    el.querySelector('.btns').innerHTML = '<button type="button" class="btn r3" data-rr="ok">✓ Acerté</button><button type="button" class="btn r1" data-rr="mal">✗ Fallé</button>';
    el.querySelector('[data-rr="ok"]')?.focus();
  }
  function cerrarRonda() {
    if (rr) { clearInterval(rr.timer); try { rr.previo?.focus?.(); } catch { /* */ } }
    $('#v-rr')?.remove(); rr = null;
  }

  // ---------- Siglas (SG1 · SG2) ----------
  function siglaMemo(sigla, grupo) {
    const lista = Object.entries(SIGLAS).filter(([, s]) => s.sigla === sigla);
    return lista.find(([, s]) => s.grupo === grupo) || lista[0] || [null, null];
  }
  // ids de tarjeta de una sigla: acepta el id por pid (R6) y el viejo por índice.
  function idsSigla(sid, s) {
    return (s?.preguntas || []).map((p, i) => {
      const nuevo = p.pid ? `sig:${sid}#${p.pid}` : null; const viejo = `sig:${sid}#${i}`;
      return nuevo && srs?.info?.(nuevo) ? nuevo : srs?.info?.(viejo) ? viejo : (nuevo || viejo);
    });
  }
  function estadoSigla(sid, s) {
    if (!s || !srs) return null;
    const ids = idsSigla(sid, s); if (!ids.length) return null;
    if (!ids.some((id) => srs.info(id))) return 'nueva';
    return ids.every((id) => srs.nivel(id) === 'dominada') ? 'dominada' : 'aprendiendo';
  }
  const CHIP_SRS = { nueva: ['✨', 'nueva'], aprendiendo: ['📈', 'aprendiendo'], dominada: ['💎', 'dominada'] };
  function vencidasSiglas() {
    if (!srs) return 0;
    return Object.entries(SIGLAS).reduce((n, [sid, s]) => n + idsSigla(sid, s).filter((id) => srs.info(id) && srs.vence(id)).length, 0);
  }
  function confusionHTML(c, propia) {
    const txt = typeof c === 'string' ? c : `${c.sigla || ''}: ${c.clave || c.diferencia || ''}`;
    const tok = (txt.match(/^(?:anti-)?([A-ZÁÉÍÓÚÑ][A-Za-z0-9ÁÉÍÓÚÑáéíóúñ/+-]{0,9})\b/) || [])[1];
    const otra = tok && tok !== propia ? Object.values(SIGLAS).find((s) => s.sigla === tok) : null;
    return `<li>${otra ? `<span class="sg-otra"><b>${esc(otra.sigla)}</b> = ${esc(otra.significado)}</span>` : ''}${esc(txt)}</li>`;
  }
  function repasarSiglas() {
    window.dispatchEvent(new CustomEvent('memo:repasar', { detail: { sec: 'siglas' } }));
    window.dispatchEvent(new CustomEvent('memo:vista', { detail: { vista: 'repaso' } }));
    // respaldo mientras repaso.js no escuche 'memo:repasar': elige el grupo en su selector
    const sel = $('#rep-sec');
    if (sel && sel.value !== 'siglas' && [...sel.options].some((o) => o.value === 'siglas')) { sel.value = 'siglas'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  }

  // ---------- Métodos (respaldo simple; js/metodos.js lo reemplaza) ----------
  function metodos() {
    const uso = {};
    Object.values(MEMO).forEach((m) => (m.tecnicas || []).forEach((k) => { uso[k] = (uso[k] || 0) + 1; }));
    $('#metodos').innerHTML = Object.entries(METODOS).map(([k, m]) => `<div class="met"><h3>${m.icono} ${esc(m.nombre)} <small class="vacio">· usada en ${uso[k] || 0} datos</small></h3>
      <p>${esc(m.resumen || m.que)}</p><p class="vacio">Fuentes: ${esc(m.fuentes || '')}</p></div>`).join('');
  }

  // Diseño v2: tarjeta por grupo, filtro instantáneo local (sin repintar) y chips de grupo.
  const ICONO_GRUPO = { 'Signos y examen': '🩺', Laboratorio: '🧪', 'ECG, imagen, gases y líquidos': '📈', 'Enfermedades y cuadros': '🦠', Marcas: '🏷️' };
  let sigQ = '', sigGrupo = '';
  function itemSigla(i, grupo) {
    const [sid, s] = siglaMemo(i.sigla, grupo);
    const est = estadoSigla(sid, s);
    const chip = est ? `<span class="sg-srs sg-${est}" title="${CHIP_SRS[est][1]}" aria-label="Estado: ${CHIP_SRS[est][1]}">${CHIP_SRS[est][0]}</span>` : '';
    const conf = s?.confusiones || [];
    const html = `<details class="sigm" data-q="${esc(norm(`${i.sigla} ${i.significado}`))}" data-s="${esc(norm(i.sigla))}" data-grupo="${esc(grupo)}"${sid ? ` data-sig="${esc(sid)}"` : ''}><summary><b class="sg-s">${esc(i.sigla)}</b><span class="sg-t">${esc(i.significado)}</span>${chip}</summary>
      ${s ? `<div class="sg-cuerpo">${miaBox(claveMia.sigla(sid))}<p class="ancla">⚓ ${esc(s.ancla)}</p><p class="sg-escena">🎬 ${esc(s.escena)}</p>
      ${conf.length ? `<div class="sg-par"><div class="sg-yo"><b>${esc(s.sigla)}</b> = ${esc(s.significado)}</div><div class="sg-vs"><p class="h">⚠️ No confundir con</p><ul>${conf.map((c) => confusionHTML(c, s.sigla)).join('')}</ul></div></div>` : ''}</div>` : '<p class="vacio sg-cuerpo">Aún sin escena para esta sigla.</p>'}</details>`;
    return { html, dominada: est === 'dominada' };
  }
  function pintarSiglas() {
    const q = norm($('#buscar')?.value);
    const dominadas = [];
    const total = ATLAS.glosario.reduce((n, g) => n + g.items.length, 0);
    const grupos = ATLAS.glosario.map((g, gi) => {
      const it = g.items.filter((i) => !q || norm(`${i.sigla} ${i.significado}`).includes(q)).map((i) => itemSigla(i, g.titulo));
      it.filter((x) => x.dominada).forEach((x) => dominadas.push(x.html));
      const vivos = it.filter((x) => !x.dominada);
      return vivos.length ? `<section class="sg-grupo" data-grupo="${esc(g.titulo)}" aria-labelledby="sgg-${gi}">
        <header class="sg-cab"><span class="sg-ico" aria-hidden="true">${ICONO_GRUPO[g.titulo] || '🔤'}</span><h3 id="sgg-${gi}">${esc(g.titulo)}</h3><span class="sg-n">${vivos.length}</span></header>
        <div class="sg-lista">${vivos.map((x) => x.html).join('')}</div></section>` : '';
    }).join('');
    const venc = vencidasSiglas();
    $('#siglas').innerHTML = `<div class="v-barra">${btnEstudiada('siglas')}
        <button type="button" class="btn pri" data-sig-repasar>🔁 Repasar las de hoy${venc ? ` <span class="v-pill">${venc}</span>` : ''}</button></div>
      <div class="v-sig-top">
        <div class="v-sig-busca"><input type="search" id="v-sig-q" value="${esc(sigQ)}" placeholder="Filtra ${total} siglas: VCM, presión…" aria-label="Filtrar siglas al instante" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"><span class="v-sig-cuenta" aria-live="polite"></span></div>
        <div class="chips v-sig-grupos" role="group" aria-label="Filtrar por grupo">${[['', 'Todas', total]].concat(ATLAS.glosario.map((g) => [g.titulo, g.titulo, g.items.length])).map(([v, t, n]) =>
  `<button type="button" class="chip${sigGrupo === v ? ' on' : ''}" data-sig-grupo="${esc(v)}" aria-pressed="${sigGrupo === v}">${v ? `${ICONO_GRUPO[v] || '🔤'} ` : ''}${esc(t)} <small>${n}</small></button>`).join('')}</div>
        <div class="v-seg" role="group" aria-label="Autoexamen del glosario">${[['', '👀 Ver todo'], ['sig', '🙈 Sin significado'], ['inv', '🔁 Inverso']].map(([v, t]) =>
  `<button type="button" data-sig-modo="${v}" aria-pressed="${sigModo === v}">${t}</button>`).join('')}</div>
      </div>
      <p class="vacio v-ayuda">Repásalo a diario hasta dominarlo; las 💎 dominadas se pliegan porque ya cumplieron su función.${sigModo ? ' Toca una sigla para revelarla.' : ''}</p>
      <div class="sig ${sigModo ? `m-${sigModo}` : ''}">${grupos}
      ${dominadas.length ? `<details class="sig-dom"><summary>💎 Ya dominadas (<span class="sg-domn">${dominadas.length}</span>)</summary><div class="sg-lista">${dominadas.join('')}</div></details>` : ''}
      <div class="v-vacio" hidden><b aria-hidden="true">🔤</b><p class="v-vacio-t"></p><div class="btns"><button type="button" class="btn" data-sig-limpiar>✕ Limpiar filtros</button></div></div></div>`;
    aplicarFiltroSiglas();
  }
  function aplicarFiltroSiglas() {
    const raiz = $('#siglas'); if (!raiz?.querySelector('.sig')) return;
    const q = norm(sigQ).trim();
    const pasa = (d) => (!sigGrupo || d.dataset.grupo === sigGrupo) && (!q || d.dataset.q.includes(q));
    let total = 0;
    $$('.sg-grupo', raiz).forEach((g) => {
      let n = 0;
      $$('.sigm', g).forEach((d) => { const ok = pasa(d); d.hidden = !ok; d.classList.toggle('exacta', ok && !!q && d.dataset.s === q); if (ok) n += 1; });
      g.hidden = !n; const c = $('.sg-n', g); if (c) c.textContent = n; total += n;
    });
    const dom = $('.sig-dom', raiz);
    if (dom) { let n = 0; $$('.sigm', dom).forEach((d) => { const ok = pasa(d); d.hidden = !ok; if (ok) n += 1; }); dom.hidden = !n; $('.sg-domn', dom).textContent = n; total += n; }
    const cuenta = $('.v-sig-cuenta', raiz); if (cuenta) cuenta.textContent = q || sigGrupo ? `${total} ${total === 1 ? 'sigla' : 'siglas'}` : '';
    const vacio = $('.v-vacio', raiz);
    if (vacio) {
      vacio.hidden = total > 0;
      const glob = $('#buscar')?.value || '';
      $('.v-vacio-t', vacio).textContent = q || glob ? `Ninguna sigla coincide con «${sigQ || glob}»${sigGrupo ? ` en ${sigGrupo}` : ''}. ¿Probaste solo las primeras letras?` : 'No hay siglas en este grupo.';
    }
  }

  // ---------- eventos (delegados) ----------
  document.addEventListener('click', (e) => {
    const t = e.target;
    const est = t.closest('[data-estudiada]'); if (est) { alternarEstudiada(est); return; }
    const ae = t.closest('[data-ae]'); if (ae) { marcarAE(ae); haptico('toque'); return; }
    const ar = t.closest('[data-ae-ronda]'); if (ar) { rondaAE(ar.dataset.aeRonda); return; }
    const as = t.closest('[data-ae-reset]'); if (as) { resetAE(as.dataset.aeReset); return; }
    if (t.closest('[data-tec-quitar]')) { filtrarTecnica(null); return; }
    if (t.closest('[data-v-limpiar]')) { const b = $('#buscar'); if (b) { b.value = ''; b.dispatchEvent(new Event('input', { bubbles: true })); } return; }
    if (t.closest('[data-v-todas]')) { secFiltro = null; filtros(); pintarTabla(); return; }
    const enf = t.closest('[data-v-enfocar]');
    if (enf) { secFiltro = enf.dataset.vEnfocar; filtros(); pintarTabla(); haptico('toque'); $('#v-tabla')?.scrollIntoView({ block: 'start', behavior: sinMov() ? 'auto' : 'smooth' }); return; }
    if (t.closest('[data-v-reocultar]')) { $$('#tabla .val.ver').forEach((v) => v.classList.remove('ver')); hudLleno = false; pintarHUD(); haptico('toque'); return; }
    // Valores · acordeón (celular)
    const ft = t.closest('button.v-fila-t'); if (ft) { alternarFila(ft.closest('.v-fila')); haptico('toque'); return; }
    const ed = t.closest('[data-ed-abrir]');
    if (ed) { const z = ed.closest('.v-memo, .mia-box')?.querySelector('.v-zona'); if (z) { cerrarPrueba2(ed); abrirEditor(z, ed.dataset.edAbrir); } return; }
    const edb = t.closest('[data-ed]');
    if (edb) {
      const form = edb.closest('.v-ed'); const clave = form.dataset.clave;
      if (edb.dataset.ed === 'borrar') { mias.set(clave, null); refrescarMia(clave); window.dispatchEvent(new CustomEvent('memo:mia-cambio', { detail: { ref: clave } })); }
      else form.parentElement.innerHTML = '';
      return;
    }
    const v3a = t.closest('[data-v3-abrir]'); if (v3a) { abrirPrueba(v3a.closest('.v-memo')); return; }
    const v3 = t.closest('[data-v3]');
    if (v3) {
      const vm = v3.closest('.v-memo'); const acc = v3.dataset.v3;
      if (acc === 'ver') revelarPrueba(vm);
      else if (acc === 'cerrar') cerrarPrueba(vm);
      else if (acc === 'ok') { haptico('bien'); v3.closest('.btns').outerHTML = '<p class="v-ae-ok">🎉 Tu escena devuelve el dato: está bien hecha.</p><div class="btns"><button type="button" class="btn" data-v3="cerrar">Cerrar prueba</button></div>'; }
      else if (acc === 'no') v3.closest('.btns').outerHTML = `<p>Fortalece la imagen o la asociación (#137).</p><div class="btns"><button type="button" class="btn pri" data-v3="mejorar">✏️ Mejorar mi escena</button><button type="button" class="btn" data-v3="cerrar">Cerrar prueba</button></div>`;
      else if (acc === 'mejorar') { cerrarPrueba(vm); abrirEditor(vm.querySelector('.v-zona'), claveMia.dato(vm.dataset.ref)); }
      return;
    }
    // Escalas · calculadora
    const em = t.closest('[data-esc-modo]');
    if (em) { const card = em.closest('.esc'); const id = card.id.slice(2); const st = estCalc(id); const ab = em.dataset.escModo === 'calc'; if (st.abierta !== ab) { st.abierta = ab; cuerpoEscala(card, ESCALA[id]); haptico('toque'); } return; }
    if (t.closest('[data-esc-solo-calc]')) { escSoloCalc = !escSoloCalc; pintarEscalas(); return; }
    const cop = t.closest('[data-cop]');
    if (cop) {
      const card = cop.closest('.esc'); const id = card.id.slice(2); const mod = modeloDe(ESCALA[id]); const st = estCalc(id);
      const [gi, oi] = cop.dataset.cop.split(':').map(Number); const g = mod.grupos[gi];
      if (g.tipo === 'uno') st.sel[gi] = st.sel[gi] === oi && !g.req ? undefined : oi;
      else { const s = (st.sel[gi] ||= new Set()); if (s.has(oi)) s.delete(oi); else s.add(oi); }
      $$('[data-cop]', cop.parentElement).forEach((b) => {
        const k = +b.dataset.cop.split(':')[1]; const on = g.tipo === 'uno' ? st.sel[gi] === k : st.sel[gi].has(k);
        b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on));
      });
      haptico('toque'); actualizarCalc(card); return;
    }
    const ccl = t.closest('[data-cclase]');
    if (ccl) {
      const card = ccl.closest('.esc'); const st = estCalc(card.id.slice(2)); const k = +ccl.dataset.cclase;
      st.sel.c = st.sel.c === k ? undefined : k;
      $$('[data-cclase]', ccl.parentElement).forEach((b) => { const on = +b.dataset.cclase === st.sel.c; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
      haptico('toque'); actualizarCalc(card); return;
    }
    const tick = t.closest('.v-cticks span');
    if (tick) { const box = tick.closest('.v-crango-box'); const r = box.querySelector('.v-crango'); r.value = tick.textContent; r.dispatchEvent(new Event('input', { bubbles: true })); return; }
    const crs = t.closest('[data-calc-reset]');
    if (crs) { const card = crs.closest('.esc'); const id = card.id.slice(2); calc[id] = { ...estCalc(id), sel: {}, val: null, ideal: '', real: '', prev: null }; cuerpoEscala(card, ESCALA[id]); haptico('toque'); return; }
    // Facies
    if (t.closest('[data-fac-ronda]')) { abrirRonda(ATLAS.facies.filter((f) => f.imagen).map((f) => f.id)); return; }
    const fmodo = t.closest('[data-fac-modo]');
    if (fmodo) { const adv = fmodo.dataset.facModo === 'adivina'; if (adv !== facOcultas) { facOcultas = adv; adiv.ver.clear(); adiv.ok.clear(); adiv.mal.clear(); pintarFacies(); haptico('toque'); } return; }
    if (t.closest('[data-fac-reinicio]')) { adiv.ver.clear(); adiv.ok.clear(); adiv.mal.clear(); pintarFacies(); return; }
    const fz = t.closest('[data-fac-zoom]'); if (fz) { fz.closest('.v-fac')?.querySelector('img[data-zoom]')?.click(); return; }
    const fv = t.closest('[data-fac-ver]');
    if (fv) {
      const card = fv.closest('.v-fac');
      if (facOcultas) {
        if (card.classList.contains('ver')) return;
        card.classList.add('ver'); adiv.ver.add(card.dataset.fac); fv.setAttribute('aria-expanded', 'true');
        fv.setAttribute('aria-label', `Facies ${card.querySelector('.v-fac-nom')?.textContent || ''}`);
        if (!card.classList.contains('v-ok') && !card.classList.contains('v-mal')) {
          card.querySelector('.v-fac-media').insertAdjacentHTML('afterend', '<div class="v-fac-juzga" role="group" aria-label="¿La reconociste?"><button type="button" class="btn r3" data-fac-juzga="ok">✓ La sabía</button><button type="button" class="btn r1" data-fac-juzga="mal">✗ No</button></div>');
        }
      } else { const on = card.classList.toggle('ver'); fv.setAttribute('aria-expanded', String(on)); }
      haptico('toque'); return;
    }
    const fj = t.closest('[data-fac-juzga]'); if (fj) { juzgarFacies(fj.closest('.v-fac'), fj.dataset.facJuzga === 'ok'); return; }
    const r = t.closest('[data-rr]');
    if (r && rr) {
      const acc = r.dataset.rr;
      if (acc === 'ver') revelarRonda();
      else if (acc === 'cerrar') cerrarRonda();
      else if (acc === 'repetir') abrirRonda(rr.mal);
      else { (acc === 'ok' ? rr.ok : rr.mal).push(rr.cola[rr.i]); haptico(acc === 'ok' ? 'bien' : 'mal'); rr.i += 1; pasoRonda(); }
      return;
    }
    // Siglas
    if (t.closest('[data-sig-repasar]')) { repasarSiglas(); return; }
    const sg = t.closest('[data-sig-grupo]');
    if (sg) { sigGrupo = sg.dataset.sigGrupo; $$('[data-sig-grupo]').forEach((b) => { const on = b.dataset.sigGrupo === sigGrupo; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }); aplicarFiltroSiglas(); haptico('toque'); return; }
    const sm = t.closest('[data-sig-modo]');
    if (sm) {
      sigModo = sm.dataset.sigModo;
      $$('[data-sig-modo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sigModo === sigModo)));
      const s = $('#siglas .sig'); if (s) s.className = `sig ${sigModo ? `m-${sigModo}` : ''}`;
      $$('#siglas .sigm[open]').forEach((d) => { d.open = false; });
      haptico('toque'); return;
    }
    if (t.closest('[data-sig-limpiar]')) { sigQ = ''; sigGrupo = ''; const b = $('#buscar'); if (b?.value) { b.value = ''; pintarSiglas(); } else pintarSiglas(); $('#v-sig-q')?.focus(); return; }
    // ES1: revelar un puntaje oculto
    const ec = t.closest('.esc-ocultas .esc td:last-child, .esc-ocultas .sem i'); if (ec) { if (!ec.classList.contains('ver')) haptico('toque'); ec.classList.toggle('ver'); return; }
    // V2: revelar una celda oculta (todos los modos; una sola vez, se vuelve a ocultar con "↺ Ocultar").
    // Este listener se registra antes que el de app.js: se corta aquí para que no la vuelva a ocultar.
    const val = t.closest('#tabla .val');
    if (val && ocultarModo) {
      const b = document.body.classList;
      const oculta = b.contains('ocultar') || (b.contains('ocultar-n') && val.closest('.c-n')) || (b.contains('ocultar-ub') && val.closest('.c-u, .c-d'));
      if (oculta) { e.stopImmediatePropagation(); revelarVal(val); return; }
    }
    // Valores · tocar el normal (visible) también despliega la fila en el celular
    const cn = t.closest('.v-fila .c-n');
    if (cn && movil() && !t.closest('a, button')) { alternarFila(cn.closest('.v-fila')); haptico('toque'); }
  });
  function cerrarPrueba2(btn) { const vm = btn.closest('.v-memo'); if (vm?.closest('.memo')?.classList.contains('probando')) cerrarPrueba(vm); }
  document.addEventListener('submit', (e) => { const f = e.target.closest?.('.v-ed'); if (f) { e.preventDefault(); guardarEditor(f); haptico('bien'); } });
  document.addEventListener('change', (e) => {
    const id = e.target.id;
    if (id === 'v-esc-ocultar') { escOcultas = e.target.checked; pintarEscalas(); }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'v-sig-q') { sigQ = t.value; aplicarFiltroSiglas(); return; }
    if (t.matches?.('.v-crango')) { const card = t.closest('.esc'); estCalc(card.id.slice(2)).val = +t.value; actualizarCalc(card); return; }
    if (t.matches?.('.v-cform input')) { const card = t.closest('.esc'); estCalc(card.id.slice(2))[t.dataset.cf] = t.value; actualizarCalc(card); }
  });
  document.addEventListener('keydown', (e) => {
    if ($('#v-rr') && e.key === 'Escape') { cerrarRonda(); return; }
    if (e.key === 'Escape' && document.activeElement?.closest?.('.v-ed')) { const f = document.activeElement.closest('.v-ed'); f.parentElement.innerHTML = ''; return; }
    if (e.key === 'Escape' && e.target.id === 'v-sig-q' && e.target.value) { e.preventDefault(); e.target.value = ''; sigQ = ''; aplicarFiltroSiglas(); return; }
    if (e.key === 'Enter' && e.ctrlKey && e.target.matches?.('.v-pr-in')) { e.preventDefault(); const vm = e.target.closest('.v-memo'); if (vm.querySelector('[data-v3="ver"]')) revelarPrueba(vm); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && rr) cerrarRonda(); });
  // Al pasar de celular a escritorio (o al revés) cambia la forma de la fila: se repinta Valores si está montado.
  MQ.addEventListener?.('change', () => { medir(); if ($('#tabla')?.firstElementChild) pintarTabla(); });

  // Abrir "mi versión" de un dato desde otro módulo (p. ej. bandeja "Para editar" de Repaso):
  // window.dispatchEvent(new CustomEvent('memo:mia', { detail: { id } }))  · id = ref de fila/escala, 'sig:<slug>' o 'fac:<id>'
  window.addEventListener('memo:mia', (e) => {
    const id = String(e.detail?.id || ''); if (!id) return;
    if (id.startsWith('sig:') || id.startsWith('fac:')) {
      const sig = id.startsWith('sig:');
      if (sig) { sigQ = ''; sigGrupo = ''; }
      window.dispatchEvent(new CustomEvent('memo:vista', { detail: { vista: sig ? 'siglas' : 'facies' } }));
      setTimeout(() => {
        const box = $(`[data-mia-box="${CSS.escape(id)}"]`); if (!box) return;
        const det = box.closest('details'); if (det) det.open = true;
        const dom = box.closest('.sig-dom'); if (dom) dom.open = true;
        box.closest('.fac')?.classList.add('ver');
        abrirEditor(box.querySelector('.v-zona'), id); box.scrollIntoView({ block: 'center' });
      }, 0);
      return;
    }
    window.dispatchEvent(new CustomEvent('memo:ir', { detail: { id } }));
    setTimeout(() => {
      const el = $(`#p-${CSS.escape(id)} .memo`); if (!el) return;
      el.classList.add('on'); if (!el.dataset.lleno) llenar(el);
      const z = el.querySelector('.v-zona'); if (z) abrirEditor(z, id);
    }, 0);
  });

  // Si se abre la ficha de un dato que el filtro de técnica esconde, se quita el filtro (este listener corre antes que el de app.js).
  window.addEventListener('memo:ir', (e) => { const id = e.detail?.id; if (id && tecFiltro && !pasaTec(id)) { tecFiltro = null; filtros(); } });

  function filtrarTecnica(k) {
    tecFiltro = k || null;
    filtros(); pintarTabla();
    if ($('#v-escalas')?.classList.contains('on')) pintarEscalas();
  }

  const tabla = conRetardo('tabla', pintarTabla);
  const escalas = conRetardo('escalas', pintarEscalas);
  const facies = conRetardo('facies', pintarFacies);
  const siglas = conRetardo('siglas', pintarSiglas);

  return {
    tabla, escalas, facies, siglas, metodos, filtros, panelMemoria,
    filtrarSeccion(id) { secFiltro = id || null; filtros(); pintarTabla(); },
    filtrarTecnica,
  };
}

// ---------- calculadora de escalas: modelo leído de data/atlas.json (sin criterios inventados) ----------
// Una escala recibe calculadora solo si TODOS sus ítems tienen una estructura reconocible:
//  · suma:    "N c/u" / "N puntos c/u" (criterios que suman), "−N" (un criterio), "Componente (X)" con
//             opciones "N texto · N texto" (elige una; Glasgow O/V/M) o "+N si … · 0 si …" (elige una, opcional).
//  · clase:   "Clase/Grado <romano>" que coincide 1:1 con la interpretación (NYHA, grados de coma, West Haven).
//  · rango:   un ítem "0 … 10" (EVA): deslizador.
//  · formula: "% déficit = (peso ideal − peso real) / peso ideal × 100" (Gómez).
// La interpretación sale de los rangos de `interpretacion` (≥, ≤, <, >, a-b, n).
const aNum = (s) => parseFloat(String(s ?? '').replace(/−/g, '-').replace(',', '.'));
function fmtNum(x, dec = 0) {
  const t = dec && !Number.isInteger(x) ? x.toFixed(dec) : String(Math.round(x));
  return t.replace('.', ',').replace(/^-/, '−');
}
function parseRango(p) {
  const s = String(p).replace(/−/g, '-').replace(/,/g, '.').replace(/\s*(%|ml|\/5)\s*/g, '').trim();
  let m = s.match(/^(≥|≤|<|>)\s*(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const n = +m[2];
    return { '≥': { min: n, max: Infinity }, '≤': { min: -Infinity, max: n }, '<': { min: -Infinity, max: n, maxEx: true }, '>': { min: n, max: Infinity, minEx: true } }[m[1]];
  }
  m = s.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/); if (m) return { min: +m[1], max: +m[2] };
  if (/^-?\d+(?:\.\d+)?$/.test(s)) return { min: +s, max: +s };
  return null;
}
function interpretar(rs, v) {
  const dentro = (r) => (r.minEx ? v > r.min : v >= r.min) && (r.maxEx ? v < r.max : v <= r.max);
  let k = rs.findIndex(dentro);
  if (k < 0) { // fuera de todos los rangos (p. ej. McIsaac 5 o un hueco 24-25 %): el más cercano
    let d = Infinity;
    rs.forEach((r, i) => { const di = v < r.min ? r.min - v : v - r.max; if (di < d) { d = di; k = i; } });
  }
  return k;
}
function construirModelo(e) {
  const items = e.items || []; const interp = e.interpretacion || [];
  if (!items.length || !interp.length) return null;
  if (items.length === interp.length && items.every(([x], k) => (String(x).match(/^(?:Clase|Grado)\s+([IVX]+)\b/) || [])[1] === interp[k][0])) {
    return { tipo: 'clase', opciones: items.map(([x, y], k) => ({ t: x, d: y, k })) };
  }
  const rs = interp.map(([p]) => parseRango(p));
  if (!rs.every(Boolean)) return null;
  for (const [, y] of items) {
    const m = String(y).match(/^(\d+)\s[^·]*?\.\.\.\s*(\d+)\b/);
    if (m && +m[2] > +m[1]) return { tipo: 'rango', min: +m[1], max: +m[2], rs };
  }
  const fx = items.find(([, y]) => /peso ideal[^·]*?[−-]\s*peso real\)\s*\/\s*peso ideal\s*×\s*100/.test(String(y)));
  if (fx) return { tipo: 'formula', formula: fx[1], rs };
  const grupos = [];
  for (const [x, y] of items) {
    const lab = String(x), txt = String(y);
    let m = lab.match(/^\+?([−-]?\d+(?:[.,]\d+)?)\s*(?:puntos?\s*)?c\/u\b/i);
    if (m) { grupos.push({ titulo: lab, tipo: 'varios', opciones: txt.split(' · ').map((t) => ({ t, pts: aNum(m[1]) })) }); continue; }
    m = lab.match(/^([+−-]\d+(?:[.,]\d+)?)$/);
    if (m) { grupos.push({ titulo: lab, tipo: 'varios', opciones: [{ t: txt, pts: aNum(m[1]) }] }); continue; }
    const partes = txt.split(' · ');
    const letra = (lab.match(/\(([A-Z])\)\s*$/) || [])[1];
    const comp = partes.map((p) => p.match(/^(\d+)\s+(.+)$/));
    if (letra && comp.every(Boolean)) { grupos.push({ titulo: lab, letra, tipo: 'uno', req: true, opciones: comp.map((c) => ({ t: c[2], pts: +c[1] })) }); continue; }
    const si = partes.map((p) => p.match(/^([+−-]?\d+(?:[.,]\d+)?)\s+si\s+(.+)$/));
    if (si.every(Boolean)) { grupos.push({ titulo: lab, tipo: 'uno', req: false, opciones: si.map((c) => ({ t: c[2], pts: aNum(c[1]) })) }); continue; }
    return null;
  }
  const todosReq = grupos.every((g) => g.tipo === 'uno' && g.req);
  return {
    tipo: 'suma', grupos, rs: rs.map((r, i) => ({ ...r, p: interp[i][0] })),
    dec: grupos.some((g) => g.opciones.some((o) => !Number.isInteger(o.pts))) ? 1 : 0,
    max: todosReq ? grupos.reduce((n, g) => n + Math.max(...g.opciones.map((o) => o.pts)), 0) : null,
  };
}
