// Ajustes de comodidad y de estudio + panel ⚙️ + capa de atajos. Dueño: paquete C.
// API estable (ver tools/CONTRATOS.md):
//   get(k)          → valor guardado o su valor por defecto. get('reducirMov') devuelve SIEMPRE un booleano efectivo
//                     (ajuste forzado o, en "auto", prefers-reduced-motion del sistema).
//   set(k, v)       → guarda, aplica al DOM y avisa a los oyentes.
//   alCambiar(fn)   → fn(k, v) en cada cambio; devuelve la función para desuscribirse.
// Extras: DEFECTOS, aplicar(), abrir(), cerrar(), mostrarAtajos().
// Claves: fs ('s'|'m'|'l'|'xl') · lectura (bool) · reducirMov ('auto'|'si'|'no') · nuevasDia (10|15|20|30)
//         diaSemanal (0=domingo … 6=sábado) · bloque ('25/5'|'50/10'|'60/10') · nuevasNoEstudiadas (bool)
//         recordarRespaldo (bool) · notifActivo (bool) · notifHora ('HH:MM') · notifPalacio (bool) (ver js/notificaciones.js).
//         La fecha de examen vive en el plan (js/plan.js → memo-semio-plan.examen).
import * as respaldo from './respaldo.js';
import * as plan from './plan.js';
import * as notif from './notificaciones.js';

const CLAVE = 'memo-semio-ajustes';
export const DEFECTOS = {
  fs: 'm', lectura: false, reducirMov: 'auto', nuevasDia: 15, diaSemanal: 0, bloque: '25/5',
  nuevasNoEstudiadas: false, recordarRespaldo: true,
  notifActivo: false, notifHora: '19:00', notifPalacio: true,
};
export const TAM_LETRA = { s: 14, m: 15, l: 17, xl: 19 };
const fns = new Set();
const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; } };
const mqMov = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export function get(k) {
  const v = leer()[k] ?? DEFECTOS[k];
  if (k === 'reducirMov') return v === true || v === 'si' || ((v === 'auto' || v == null) && !!mqMov?.matches);
  return v;
}
/** Valor tal como se guardó (p. ej. 'auto' para reducirMov). */
export function crudo(k) { return leer()[k] ?? DEFECTOS[k]; }
export function set(k, v) {
  const a = leer(); a[k] = v;
  try { localStorage.setItem(CLAVE, JSON.stringify(a)); } catch { /* sin almacenamiento */ }
  aplicar();
  avisar(k, k === 'reducirMov' ? get(k) : v);
}
export function alCambiar(fn) { fns.add(fn); return () => fns.delete(fn); }
function avisar(k, v) {
  fns.forEach((f) => { try { f(k, v); } catch (e) { console.error(e); } });
  window.dispatchEvent(new CustomEvent('memo:ajustes', { detail: { k, v } }));
}
mqMov?.addEventListener?.('change', () => { if (crudo('reducirMov') === 'auto') { aplicar(); avisar('reducirMov', get('reducirMov')); } });

/** Lleva los ajustes visuales al DOM: --fs en :root, body.lectura, html.sin-mov. */
export function aplicar() {
  const r = document.documentElement;
  r.style.setProperty('--fs', `${TAM_LETRA[crudo('fs')] || 15}px`);
  r.classList.toggle('sin-mov', get('reducirMov'));
  r.classList.toggle('con-mov', crudo('reducirMov') === 'no');
  r.classList.toggle('lectura', !!get('lectura'));
  document.body?.classList.toggle('lectura', !!get('lectura'));
}

// ---------------------------------------------------------------- panel ⚙️
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
let dlg = null;

function opciones(nombre, lista, actual, etiqueta) {
  return `<div class="aj-seg" role="radiogroup" aria-label="${esc(etiqueta)}">${lista.map(([v, t, aria]) =>
    `<button type="button" role="radio" data-aj="${nombre}" data-v="${esc(v)}" aria-checked="${String(v) === String(actual)}"${aria ? ` aria-label="${esc(aria)}"` : ''}>${esc(t)}</button>`).join('')}</div>`;
}
const fecha = (ms) => new Date(ms).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });

function htmlPanel() {
  const tema = document.documentElement.dataset.theme || 'auto';
  const examen = plan.cargar()?.examen || '';
  const u = respaldo.ultimo();
  const d = respaldo.diasSinRespaldo();
  return `<form method="dialog" class="aj-cab"><h2 id="aj-tit">⚙️ Ajustes</h2><button class="icon-btn" value="x" aria-label="Cerrar ajustes">✕</button></form>
  <div class="aj-cuerpo">
    <section aria-labelledby="aj-l"><h3 id="aj-l">📖 Lectura</h3>
      <div class="aj-fila"><span>Tamaño de letra</span>${opciones('fs', [['s', 'A−', 'Letra pequeña'], ['m', 'A', 'Letra normal'], ['l', 'A+', 'Letra grande'], ['xl', 'A++', 'Letra muy grande']], crudo('fs'), 'Tamaño de letra')}</div>
      <p class="aj-muestra">🎬 Así se verá una escena: <b>Potasio 3,5–5,0</b> mEq/L.</p>
      <label class="aj-fila aj-sw"><span>Modo lectura<small>Más interlineado, ancho cómodo y sin efectos de fondo.</small></span><input type="checkbox" data-aj="lectura" ${get('lectura') ? 'checked' : ''}></label>
      <div class="aj-fila"><span>Animaciones<small>"Auto" sigue la opción del sistema.</small></span>${opciones('reducirMov', [['auto', 'Auto'], ['si', 'Reducir'], ['no', 'Normales']], crudo('reducirMov'), 'Animaciones')}</div>
      <div class="aj-fila"><span>Tema</span>${opciones('tema', [['auto', 'Auto'], ['light', '☀️ Claro'], ['dark', '🌙 Oscuro']], tema, 'Tema')}</div>
    </section>
    <section aria-labelledby="aj-e"><h3 id="aj-e">🎓 Estudio</h3>
      <div class="aj-fila"><span>Tarjetas nuevas por día</span>${opciones('nuevasDia', [[10, '10'], [15, '15'], [20, '20'], [30, '30']], get('nuevasDia'), 'Tarjetas nuevas por día')}</div>
      <label class="aj-fila"><span>Fecha del examen<small>Reparte el temario (80 %) y deja el final para simulacros. También en <button type="button" class="link" data-aj-acc="hoy">🏠 Hoy</button>.</small></span>
        <span class="aj-fecha"><input type="date" id="aj-examen" value="${esc(examen)}">${examen ? '<button type="button" class="link" data-aj-acc="sin-examen">quitar</button>' : ''}</span></label>
      <label class="aj-fila"><span>Día de repaso semanal<small>Sin contenido nuevo: solo repasar la semana.</small></span>
        <select data-aj="diaSemanal">${DIAS.map((n, i) => `<option value="${i}" ${+get('diaSemanal') === i ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <div class="aj-fila"><span>Bloques de estudio<small>Trabajo / descanso, en minutos.</small></span>${opciones('bloque', [['25/5', '25/5'], ['50/10', '50/10'], ['60/10', '60/10']], get('bloque'), 'Bloques de estudio')}</div>
      <label class="aj-fila aj-sw"><span>Permitir nuevas de temas no estudiados<small>Por defecto, primero se comprende el tema y luego entran sus tarjetas.</small></span><input type="checkbox" data-aj="nuevasNoEstudiadas" ${get('nuevasNoEstudiadas') ? 'checked' : ''}></label>
    </section>
    ${notif.htmlAjustes()}
    <section aria-labelledby="aj-r"><h3 id="aj-r">💾 Respaldo</h3>
      <p class="aj-nota">${u ? `Último respaldo: <b>${fecha(u)}</b>${d >= 7 ? ` · hace ${d} días` : ''}` : 'Aún no has respaldado tu progreso.'} Tu progreso vive solo en este navegador: respáldalo para no perderlo al cambiar de celular o borrar datos.</p>
      <div class="aj-btns">
        <button type="button" class="btn pri" data-aj-acc="exportar">⬇️ Descargar respaldo</button>
        ${respaldo.puedeCompartir() ? '<button type="button" class="btn" data-aj-acc="compartir">📤 Compartir</button>' : ''}
        <label class="btn">📂 Importar…<input type="file" accept=".json,application/json" id="aj-importar" hidden></label>
        ${respaldo.hayPrevio() ? '<button type="button" class="btn" data-aj-acc="deshacer">↩️ Deshacer última importación</button>' : ''}
      </div>
      <label class="aj-fila aj-sw"><span>Recordarme respaldar cada 7 días</span><input type="checkbox" data-aj="recordarRespaldo" ${get('recordarRespaldo') ? 'checked' : ''}></label>
      <div id="aj-imp" class="aj-nota" aria-live="polite"></div>
    </section>
    <section aria-labelledby="aj-o"><h3 id="aj-o">📶 Sin conexión</h3>
      <p class="aj-nota" id="aj-sw" aria-live="polite">${'serviceWorker' in navigator ? 'Comprobando…' : 'Este navegador no permite el modo sin conexión.'}</p>
      <div class="aj-btns" id="aj-sw-btns" hidden>
        <button type="button" class="btn" data-aj-acc="img">🖼️ Descargar imágenes</button>
        <button type="button" class="btn" data-aj-acc="actualizar">🔄 Buscar actualización</button>
        <button type="button" class="btn" data-aj-acc="limpiar">🧹 Vaciar caché de imágenes y mapa</button>
      </div>
      <progress id="aj-prog" max="1" value="0" hidden></progress>
    </section>
    <section aria-labelledby="aj-k"><h3 id="aj-k">⌨️ Atajos</h3>
      <p class="aj-nota">Pulsa <kbd>?</kbd> en cualquier momento para ver los atajos de teclado. <button type="button" class="link" data-aj-acc="atajos">Ver ahora</button></p>
    </section>
  </div>`;
}

function enviarSW(msg) {
  const sw = navigator.serviceWorker?.controller;
  if (sw) sw.postMessage(msg);
  return !!sw;
}
function estadoSW() {
  const p = dlg?.querySelector('#aj-sw');
  if (!p || !('serviceWorker' in navigator)) return;
  if (!navigator.serviceWorker.controller) {
    p.textContent = location.protocol === 'http:' && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)
      ? 'El modo sin conexión necesita HTTPS.' : 'Preparando el modo sin conexión… (recarga la página una vez).';
    return;
  }
  enviarSW({ tipo: 'ESTADO' });
}
function alMensajeSW(e) {
  const d = e.data || {};
  const p = dlg?.querySelector('#aj-sw'); const prog = dlg?.querySelector('#aj-prog');
  if (!p) return;
  const mb = (b) => `${(b / 1e6).toFixed(1)} MB`;
  if (d.tipo === 'ESTADO') {
    dlg.querySelector('#aj-sw-btns').hidden = false;
    p.innerHTML = `✅ La app funciona sin conexión (versión <code>${esc(d.version)}</code>). Imágenes guardadas: <b>${d.enCache}/${d.imagenes}</b>${d.enCache < d.imagenes ? ` · faltan ~${mb(d.peso * (1 - d.enCache / Math.max(1, d.imagenes)))}` : ' · todas'}.`;
    const b = dlg.querySelector('[data-aj-acc="img"]'); if (b) b.disabled = d.imagenes > 0 && d.enCache >= d.imagenes;
  } else if (d.tipo === 'PROGRESO_IMG') {
    prog.hidden = false; prog.max = d.total; prog.value = d.hechas;
    p.textContent = `Descargando imágenes… ${d.hechas}/${d.total}`;
  } else if (d.tipo === 'IMG_LISTO') {
    prog.hidden = true;
    p.textContent = d.fallidas ? `Listo, pero ${d.fallidas} imágenes no se pudieron bajar.` : '✅ Imágenes listas para usar sin conexión.';
    setTimeout(estadoSW, 1200);
  } else if (d.tipo === 'LIMPIO') { p.textContent = 'Caché de imágenes y mapa vaciada.'; setTimeout(estadoSW, 800); }
}

const acciones = {
  exportar() { respaldo.descargar(); refrescar(); avisoGlobal('💾 Respaldo descargado'); },
  async compartir() { if (await respaldo.compartir()) refrescar(); else respaldo.descargar(); },
  deshacer() { if (respaldo.deshacerImportacion()) location.reload(); },
  'sin-examen'() { guardarExamen(''); refrescar(); },
  img() { if (enviarSW({ tipo: 'DESCARGAR_IMG' })) dlg.querySelector('#aj-sw').textContent = 'Descargando imágenes…'; },
  async actualizar() {
    const reg = await navigator.serviceWorker?.getRegistration();
    const p = dlg.querySelector('#aj-sw');
    if (!reg) { p.textContent = 'No hay service worker registrado.'; return; }
    p.textContent = 'Buscando…';
    try { await reg.update(); } catch { /* sin red */ }
    p.textContent = reg.waiting || reg.installing ? 'Hay una versión nueva: se ofrecerá recargar.' : 'Ya tienes la última versión.';
  },
  limpiar() { enviarSW({ tipo: 'LIMPIAR' }); },
  atajos() { cerrar(); mostrarAtajos(); },
  hoy() { cerrar(); window.dispatchEvent(new CustomEvent('memo:vista', { detail: { vista: 'hoy' } })); },
};

function guardarExamen(v) {
  if (typeof plan.fijarExamen === 'function') plan.fijarExamen(v || null); // calcula la escalera corta (≤ 14 días)
  else { const p = plan.cargar() || {}; if (v) p.examen = v; else delete p.examen; plan.guardar(p); }
  avisar('examen', v || null);
}

function refrescar() {
  if (!dlg?.open) return;
  const y = dlg.querySelector('.aj-cuerpo')?.scrollTop || 0;
  dlg.innerHTML = htmlPanel();
  dlg.querySelector('.aj-cuerpo').scrollTop = y;
  notif.montarAjustes(dlg.querySelector('#nt'));
  estadoSW();
}

function crearDialogo() {
  dlg = document.createElement('dialog');
  dlg.className = 'aj-dlg';
  dlg.setAttribute('aria-labelledby', 'aj-tit');
  document.body.append(dlg);
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) { cerrar(); return; } // clic en el fondo
    const b = e.target.closest('[data-aj]');
    if (b && b.tagName === 'BUTTON') {
      const k = b.dataset.aj; let v = b.dataset.v;
      if (k === 'nuevasDia') v = +v;
      if (k === 'tema') {
        const r = document.documentElement;
        if (v === 'auto') { delete r.dataset.theme; try { localStorage.removeItem('memo-semio-tema'); } catch { /* */ } }
        else { r.dataset.theme = v; try { localStorage.setItem('memo-semio-tema', v); } catch { /* */ } }
        avisar('tema', v);
      } else set(k, v);
      b.parentElement.querySelectorAll('[role="radio"]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      return;
    }
    const a = e.target.closest('[data-aj-acc]');
    if (a) acciones[a.dataset.ajAcc]?.();
  });
  dlg.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.id === 'aj-examen') { guardarExamen(t.value); return; }
    if (t.id === 'aj-importar' && t.files?.[0]) {
      const caja = dlg.querySelector('#aj-imp');
      try {
        const txt = await t.files[0].text();
        const r = respaldo.resumen(txt);
        const cuando = r.fecha ? ` del ${fecha(Date.parse(r.fecha))}` : '';
        if (!confirm(`Importar el respaldo${cuando}: ${r.claves.length} conjuntos de datos${r.tarjetas ? `, ${r.tarjetas} tarjetas de repaso` : ''}.\n\nReemplaza tu progreso actual en este navegador (se guarda una copia para deshacer). ¿Continuar?`)) { t.value = ''; return; }
        respaldo.importar(txt, { reemplazar: r.formato === 'v2' });
        location.reload();
      } catch (err) { caja.innerHTML = `<span class="revisar">No se pudo importar: ${esc(err.message)}</span>`; t.value = ''; }
      return;
    }
    const k = t.dataset?.aj;
    if (!k) return;
    if (t.type === 'checkbox') set(k, t.checked);
    else if (k === 'diaSemanal') set(k, +t.value);
  });
  dlg.addEventListener('close', () => { dlg.innerHTML = ''; volverFoco?.focus?.(); });
  navigator.serviceWorker?.addEventListener('message', alMensajeSW);
}

let volverFoco = null;
export function abrir() {
  if (!dlg) crearDialogo();
  volverFoco = document.activeElement;
  dlg.innerHTML = htmlPanel();
  if (!dlg.open) dlg.showModal();
  notif.montarAjustes(dlg.querySelector('#nt'));
  estadoSW();
}
export function cerrar() { if (dlg?.open) dlg.close(); }

// ---------------------------------------------------------------- atajos
export const ATAJOS = [
  ['/', 'Buscar'],
  ['g h', 'Ir a 🏠 Hoy'], ['g v', 'Ir a 📋 Valores'], ['g r', 'Ir a 🔁 Repaso'], ['g e', 'Ir a 📏 Escalas'],
  ['g p', 'Ir a 📊 Progreso'], ['g j', 'Ir a 🎮 Juego'], ['g c', 'Ir a 🏙️ Ciudad'], ['g f', 'Ir a 🙂 Facies'],
  ['g n', 'Ir a 🏋️ Entrenar'], ['g m', 'Ir a 🧩 Métodos'], ['g s', 'Ir a 🔤 Siglas'],
  [',', 'Abrir ⚙️ Ajustes'], ['?', 'Esta ayuda'], ['Esc', 'Cerrar visor, ventanas y menús'],
  ['←  →', 'Cambiar de pestaña (con el foco en las pestañas)'],
];
export const ATAJOS_REPASO = [['Espacio', 'Revelar la respuesta'], ['Ctrl + Enter', 'Revelar (escribiendo)'], ['1 – 4', 'Calificar 🔴 🟡 🟢 🔵'], ['P', 'Pista (ancla), desde la ronda 2'], ['E', 'Mi versión de la tarjeta']];
let dlgAtajos = null;
export function mostrarAtajos() {
  if (!dlgAtajos) {
    dlgAtajos = document.createElement('dialog');
    dlgAtajos.className = 'aj-dlg aj-atajos';
    dlgAtajos.setAttribute('aria-labelledby', 'at-tit');
    const filas = (l) => l.map(([k, t]) => `<tr><td>${k.split(' ').filter(Boolean).map((x) => `<kbd>${esc(x)}</kbd>`).join(' ')}</td><td>${esc(t)}</td></tr>`).join('');
    dlgAtajos.innerHTML = `<form method="dialog" class="aj-cab"><h2 id="at-tit">⌨️ Atajos de teclado</h2><button class="icon-btn" aria-label="Cerrar">✕</button></form>
      <div class="aj-cuerpo"><table class="aj-tabla"><tbody>${filas(ATAJOS)}</tbody></table>
      <h3>En Repaso</h3><table class="aj-tabla"><tbody>${filas(ATAJOS_REPASO)}</tbody></table>
      <p class="aj-nota">Los atajos no actúan mientras escribes en un campo de texto.</p></div>`;
    dlgAtajos.addEventListener('click', (e) => { if (e.target === dlgAtajos) dlgAtajos.close(); });
    document.body.append(dlgAtajos);
  }
  if (!dlgAtajos.open) dlgAtajos.showModal();
}

/** Aviso breve accesible (aria-live). También se puede pedir con el evento `memo:aviso`. */
export function avisoGlobal(texto, acciones = []) {
  window.dispatchEvent(new CustomEvent('memo:aviso', { detail: { texto, acciones } }));
}
