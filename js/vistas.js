// Vistas de contenido: Valores, Escalas, Facies, Siglas (y Métodos mientras no se integre js/metodos.js).
// Dueño: paquete B (ver tools/PLAN_MEJORAS.md y tools/CONTRATOS.md).
// Mejoras: V1 sección estudiada · V2 autoexamen con semáforo · V3 prueba de reconstrucción ·
// V4 mi versión (js/mias.js) · V5 render ligero · ES1/ES2 escalas · F1/F2 facies · SG1/SG2 siglas.
import { $, $$, esc, norm, resaltar, celda } from './util.js';
import * as plan from './plan.js';
import * as mias from './mias.js';

// ---------- utilidades locales ----------
const pad = (n) => String(n).padStart(2, '0');
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const numeros = (t) => (String(t ?? '').match(/\d+(?:[.,]\d+)?/g) || []).map((x) => x.replace(',', '.'));
const taparCifras = (t) => String(t ?? '').replace(/\d+(?:[.,]\d+)?/g, '…');
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
  function montarSelectorOcultar() {
    const barra = $('#v-tabla .barra'); if (!barra || $('#v-ocultar')) return;
    const viejo = $('#ocultar'); // interruptor único de antes: lo reemplaza el selector (V2)
    if (viejo) { viejo.checked = false; document.body.classList.remove('ocultar'); const l = viejo.closest('label'); if (l) l.style.display = 'none'; }
    barra.insertAdjacentHTML('beforeend', `<label class="toggle v-sel">🙈 Ocultar
      <select id="v-ocultar" aria-label="Qué columnas ocultar para el autoexamen">
        <option value="">ninguno</option><option value="n">Normal</option><option value="ub">Sube/Baja</option><option value="todo">todo</option>
      </select></label>`);
    $('#v-ocultar').value = ocultarModo;
    $('#v-ocultar').addEventListener('change', (e) => { ocultarModo = e.target.value; aplicarOcultar(); pintarTabla(); });
  }
  function aplicarOcultar() {
    const b = document.body.classList;
    b.toggle('ocultar', ocultarModo === 'todo'); b.toggle('ocultar-n', ocultarModo === 'n'); b.toggle('ocultar-ub', ocultarModo === 'ub');
  }
  function filtros() {
    montarSelectorOcultar();
    $('#filtro-sec').innerHTML = [`<button class="chip ${secFiltro ? '' : 'on'}" data-s="">Todas</button>`]
      .concat(ATLAS.secciones.map((s) => `<button class="chip ${secFiltro === s.id ? 'on' : ''}" data-s="${s.id}">${s.icono} ${esc(s.titulo.replace(/^\d+ · /, ''))}</button>`))
      .join('') + chipTec();
  }
  function filaHTML(f, amb, a) {
    const m = MEMO[f.id];
    const alt = f.altura ? `<span class="alt">🏔 ${f.altura.lit ? `<span class="lit">${esc(f.altura.t)}<sup>lit.</sup></span>` : esc(f.altura.t)}</span>` : '';
    const clave = f.clave ? `<div class="clave"><span class="ic">${f.clave.icono}</span>${f.clave.lit ? `<span class="lit">${resaltar(f.clave.texto)}<sup>lit.</sup></span>` : resaltar(f.clave.texto)}${f.perla ? ` · ${resaltar(f.perla)}` : ''}</div>`
      : f.perla ? `<div class="clave">💡 ${resaltar(f.perla)}</div>` : '';
    return `<article class="fila" id="p-${f.id}">
      <div class="fila-cab">
        <div class="p-nom"><span class="nm">${f.icono} ${esc(f.nombre)}</span>
          <button class="memo-btn" data-memo="${f.id}" ${m ? 'aria-expanded="false"' : 'disabled title="Aún sin técnica"'}>🧠 ${m ? 'Cómo recordarlo' : 'pronto'}</button>
          ${botonesAE(f.id, amb, a.filas[f.id])}</div>
        <div class="c-n"><b class="h">✅ Normal</b><span class="val">${celda(f.normal)}${alt}</span></div>
        <div class="c-u"><b class="h">🔺 Si sube</b><span class="val">${celda(f.sube)}</span></div>
        <div class="c-d"><b class="h">🔻 Si baja</b><span class="val">${celda(f.baja)}</span></div>
      </div>
      ${clave}
      ${placeholderMemo(f.id)}
    </article>`;
  }
  function pintarTabla() {
    aplicarOcultar();
    const q = norm($('#buscar')?.value);
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
      return `<div class="sec"><h2 style="background:${s.color}"><span class="v-sec-t">${s.icono} ${esc(s.titulo)}</span>${btnEstudiada(s.id)}<span class="n">${filas.length} parámetros · 🧠 ${filas.filter((f) => MEMO[f.id]).length}</span></h2>
        ${filas.map((f) => filaHTML(f, amb, a)).join('')}</div>`;
    }).join('');
    visibles.valores = ids;
    const aviso = cola ? `<p class="v-ronda-aviso">🔁 Ronda ${a.ronda}: solo tus 🔴/🟡 de la ronda anterior (${cola.size}).</p>` : '';
    $('#tabla').innerHTML = (ocultarModo ? `<div class="v-ae" id="ae-valores" aria-live="polite">${barraAE('valores')}</div>${aviso}` : '')
      + (html || '<p class="fin">Sin resultados.</p>');
  }

  // ---------- Escalas (ES1) ----------
  const COLOR = { N: '#2e7d32', L: '#f9a825', M: '#ef6c00', G: '#c62828' };
  function pintarEscalas() {
    const q = norm($('#buscar')?.value);
    const a = aeGet('escalas');
    const cola = escOcultas && a.cola ? new Set(a.cola) : null;
    const lista = ATLAS.escalas.filter((e) => (!q || norm(JSON.stringify(e)).includes(q)) && pasaTec(e.id) && (!cola || cola.has(e.id)));
    visibles.escalas = lista.map((e) => e.id);
    const raiz = $('#escalas');
    raiz.classList.toggle('esc-ocultas', escOcultas);
    raiz.innerHTML = `<div class="v-barra v-ancho">${btnEstudiada('escalas')}
        <label class="toggle"><input type="checkbox" id="v-esc-ocultar" ${escOcultas ? 'checked' : ''}> <span>🙈 Ocultar puntajes (autoexamen)</span></label>${chipTec()}</div>
      ${escOcultas ? `<div class="v-ae v-ancho" id="ae-escalas" aria-live="polite">${barraAE('escalas')}</div>` : ''}
      ${cola ? `<p class="v-ronda-aviso v-ancho">🔁 Ronda ${a.ronda}: solo tus 🔴/🟡 (${cola.size}).</p>` : ''}`
      + (lista.map((e) => {
        const m = MEMO[e.id];
        return `<article class="esc fila" id="p-${e.id}"><div class="v-esc-cab"><h3>${e.icono || '📏'} ${esc(e.nombre)}</h3>${botonesAE(e.id, 'escalas', a.filas[e.id])}</div><p class="mide">${esc(e.mide || '')}</p>
        <table>${(e.items || []).map(([x, y]) => `<tr><td>${esc(x)}</td><td>${resaltar(y)}</td></tr>`).join('')}</table>
        <div class="sem">${(e.interpretacion || []).map(([p, t, g]) => `<span style="border-color:${COLOR[g] || '#607d8b'}"><b style="background:${COLOR[g] || '#607d8b'}">${esc(p)}</b><i>${esc(t)}</i></span>`).join('')}</div>
        ${e.perla ? `<p class="perla">💡 ${esc(e.perla)}</p>` : ''}
        <button class="memo-btn" data-memo="${e.id}" ${m ? 'aria-expanded="false"' : 'disabled'}>🧠 ${m ? 'Cómo recordarla' : 'pronto'}</button>
        ${placeholderMemo(e.id)}</article>`;
      }).join('') || '<p class="fin v-ancho">Sin resultados.</p>');
  }

  // ---------- Facies (F1) ----------
  function pintarFacies() {
    const q = norm($('#buscar')?.value);
    const raiz = $('#facies');
    raiz.classList.toggle('fac-ocultas', facOcultas);
    const conFoto = ATLAS.facies.filter((f) => f.imagen).length;
    raiz.innerHTML = `<div class="v-barra v-ancho">${btnEstudiada('facies')}
        <label class="toggle"><input type="checkbox" id="v-fac-ocultar" ${facOcultas ? 'checked' : ''}> <span>🙈 Ocultar nombres</span></label>
        <button type="button" class="btn" data-fac-ronda ${conFoto ? '' : 'disabled'}>🎲 Ronda rápida (${conFoto})</button></div>`
      + ATLAS.facies.filter((f) => !q || norm(JSON.stringify(f)).includes(q)).map((f) => {
        const fm = FACIES[f.id];
        return `<article class="fac" data-fac="${esc(f.id)}">${f.imagen ? `<img src="${esc(facOcultas ? (f.imagen_quiz || f.imagen) : f.imagen)}" alt="${facOcultas ? 'Facies (nombre oculto)' : `Facies ${esc(f.nombre)}`}" loading="lazy" decoding="async" data-zoom>` : ''}
       <div class="fac-txt" ${facOcultas ? 'role="button" tabindex="0" aria-label="Revelar nombre de la facies"' : ''}><b class="fn">${esc(f.nombre)}</b><span class="fr">${esc(f.rasgo)}</span><p class="o">→ ${esc(f.orienta)}</p>
       ${fm?.ancla ? `<p class="ancla fac-ancla">⚓ ${esc(fm.ancla)}</p>` : ''}</div>
       ${fm ? `<details class="fmemo"><summary>🧠 Cómo recordarla</summary>${miaBox(claveMia.facies(f.id))}<p class="ancla">⚓ ${esc(fm.ancla)}</p><p class="escena">🎬 ${esc(fm.escena)}</p></details>` : ''}</article>`;
      }).join('');
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
  function itemSigla(i, grupo) {
    const [sid, s] = siglaMemo(i.sigla, grupo);
    const est = estadoSigla(sid, s);
    const chip = est ? `<span class="sg-srs sg-${est}" title="${CHIP_SRS[est][1]}" aria-label="Estado: ${CHIP_SRS[est][1]}">${CHIP_SRS[est][0]}</span>` : '';
    const conf = s?.confusiones || [];
    const html = `<details class="sigm"${sid ? ` data-sig="${esc(sid)}"` : ''}><summary>${chip}<b class="sg-s">${esc(i.sigla)}</b> <span class="sg-t">${esc(i.significado)}</span></summary>
      ${s ? `${miaBox(claveMia.sigla(sid))}<p class="ancla">⚓ ${esc(s.ancla)}</p><p>🎬 ${esc(s.escena)}</p>
      ${conf.length ? `<div class="sg-par"><div class="sg-yo"><b>${esc(s.sigla)}</b> = ${esc(s.significado)}</div><div class="sg-vs"><p class="h">⚠️ No confundir con</p><ul>${conf.map((c) => confusionHTML(c, s.sigla)).join('')}</ul></div></div>` : ''}` : ''}</details>`;
    return { html, dominada: est === 'dominada' };
  }
  function pintarSiglas() {
    const q = norm($('#buscar')?.value);
    const dominadas = [];
    const grupos = ATLAS.glosario.map((g) => {
      const it = g.items.filter((i) => !q || norm(i.sigla + ' ' + i.significado).includes(q)).map((i) => itemSigla(i, g.titulo));
      it.filter((x) => x.dominada).forEach((x) => dominadas.push(x.html));
      const vivos = it.filter((x) => !x.dominada);
      return vivos.length ? `<h3>${esc(g.titulo)}</h3>${vivos.map((x) => x.html).join('')}` : '';
    }).join('');
    const venc = vencidasSiglas();
    $('#siglas').innerHTML = `<div class="v-barra">${btnEstudiada('siglas')}
        <label class="toggle">Autoexamen <select id="v-sig-modo" aria-label="Modo de autoexamen del glosario">
          <option value="">ver todo</option><option value="sig">🙈 ocultar significado</option><option value="inv">🔁 inverso: ocultar sigla</option></select></label>
        <button type="button" class="btn" data-sig-repasar>🔁 Repasar las de hoy${venc ? ` (${venc})` : ''}</button></div>
      <p class="vacio v-ayuda">Glosario: repásalo a diario hasta dominarlo; las 💎 dominadas se pliegan porque ya cumplió su función.</p>
      <div class="sig ${sigModo ? `m-${sigModo}` : ''}">${grupos || '<p class="fin">Sin resultados.</p>'}
      ${dominadas.length ? `<details class="sig-dom"><summary>💎 Ya dominadas (${dominadas.length})</summary>${dominadas.join('')}</details>` : ''}</div>`;
    $('#v-sig-modo').value = sigModo;
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

  // ---------- eventos (delegados) ----------
  document.addEventListener('click', (e) => {
    const t = e.target;
    const est = t.closest('[data-estudiada]'); if (est) { alternarEstudiada(est); return; }
    const ae = t.closest('[data-ae]'); if (ae) { marcarAE(ae); return; }
    const ar = t.closest('[data-ae-ronda]'); if (ar) { rondaAE(ar.dataset.aeRonda); return; }
    const as = t.closest('[data-ae-reset]'); if (as) { resetAE(as.dataset.aeReset); return; }
    if (t.closest('[data-tec-quitar]')) { filtrarTecnica(null); return; }
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
      else if (acc === 'ok') v3.closest('.btns').outerHTML = '<p class="v-ae-ok">🎉 Tu escena devuelve el dato: está bien hecha.</p><div class="btns"><button type="button" class="btn" data-v3="cerrar">Cerrar prueba</button></div>';
      else if (acc === 'no') v3.closest('.btns').outerHTML = `<p>Fortalece la imagen o la asociación (#137).</p><div class="btns"><button type="button" class="btn pri" data-v3="mejorar">✏️ Mejorar mi escena</button><button type="button" class="btn" data-v3="cerrar">Cerrar prueba</button></div>`;
      else if (acc === 'mejorar') { cerrarPrueba(vm); abrirEditor(vm.querySelector('.v-zona'), claveMia.dato(vm.dataset.ref)); }
      return;
    }
    if (t.closest('[data-fac-ronda]')) { abrirRonda(ATLAS.facies.filter((f) => f.imagen).map((f) => f.id)); return; }
    const r = t.closest('[data-rr]');
    if (r && rr) {
      const acc = r.dataset.rr;
      if (acc === 'ver') revelarRonda();
      else if (acc === 'cerrar') cerrarRonda();
      else if (acc === 'repetir') abrirRonda(rr.mal);
      else { (acc === 'ok' ? rr.ok : rr.mal).push(rr.cola[rr.i]); rr.i += 1; pasoRonda(); }
      return;
    }
    if (t.closest('[data-sig-repasar]')) { repasarSiglas(); return; }
    // F1: revelar el nombre de una facies oculta
    const ft = t.closest('.fac-ocultas .fac-txt'); if (ft) { ft.closest('.fac').classList.toggle('ver'); return; }
    // ES1: revelar un puntaje oculto
    const ec = t.closest('.esc-ocultas .esc td:last-child, .esc-ocultas .sem i'); if (ec) { ec.classList.toggle('ver'); return; }
    // V2: revelar una celda oculta en los modos parciales (el modo "todo" lo maneja app.js con .ocultar)
    const val = t.closest('.val');
    if (val && !document.body.classList.contains('ocultar')) {
      const b = document.body.classList;
      if ((b.contains('ocultar-n') && val.closest('.c-n')) || (b.contains('ocultar-ub') && val.closest('.c-u, .c-d'))) val.classList.toggle('ver');
    }
  });
  function cerrarPrueba2(btn) { const vm = btn.closest('.v-memo'); if (vm?.closest('.memo')?.classList.contains('probando')) cerrarPrueba(vm); }
  document.addEventListener('submit', (e) => { const f = e.target.closest?.('.v-ed'); if (f) { e.preventDefault(); guardarEditor(f); } });
  document.addEventListener('change', (e) => {
    const id = e.target.id;
    if (id === 'v-esc-ocultar') { escOcultas = e.target.checked; pintarEscalas(); }
    else if (id === 'v-fac-ocultar') { facOcultas = e.target.checked; pintarFacies(); }
    else if (id === 'v-sig-modo') { sigModo = e.target.value; const s = $('#siglas .sig'); if (s) s.className = `sig ${sigModo ? `m-${sigModo}` : ''}`; }
  });
  document.addEventListener('keydown', (e) => {
    if ($('#v-rr') && e.key === 'Escape') { cerrarRonda(); return; }
    if (e.key === 'Escape' && document.activeElement?.closest?.('.v-ed')) { const f = document.activeElement.closest('.v-ed'); f.parentElement.innerHTML = ''; return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.fac-ocultas .fac-txt')) { e.preventDefault(); e.target.closest('.fac').classList.toggle('ver'); }
    if (e.key === 'Enter' && e.ctrlKey && e.target.matches?.('.v-pr-in')) { e.preventDefault(); const vm = e.target.closest('.v-memo'); if (vm.querySelector('[data-v3="ver"]')) revelarPrueba(vm); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && rr) cerrarRonda(); });

  // Abrir "mi versión" de un dato desde otro módulo (p. ej. bandeja "Para editar" de Repaso):
  // window.dispatchEvent(new CustomEvent('memo:mia', { detail: { id } }))  · id = ref de fila/escala, 'sig:<slug>' o 'fac:<id>'
  window.addEventListener('memo:mia', (e) => {
    const id = String(e.detail?.id || ''); if (!id) return;
    if (id.startsWith('sig:') || id.startsWith('fac:')) {
      const sig = id.startsWith('sig:');
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
