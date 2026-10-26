// Recordatorios de repaso sin servidor propio (skill estudio-repeticion-espaciada: repasar a la misma hora cada día,
// hábito diario; palacio y repaso semanal en sus días). Dueño: paquete C.
//
// API (ver tools/CONTRATOS.md):
//   iniciar({ srs, plan, tarjetas?, PALACIOS?, ATLAS? })  → una vez desde app.js. tarjetas = REPASO.tarjetas
//                         (cuenta las que tienen técnica, igual que el badge de Repaso); sin lista usa srs.todas().
//   pedirPermiso()        → Promise<'granted'|'denied'|'default'|'no-soportado'>; si se concede, activa y programa.
//   programar()           → recalcula, escribe el resumen para el service worker (IndexedDB), insignia y
//                           Periodic Background Sync. Llamarlo cuando cambie el repaso (ya escucha los eventos).
//   estado()              → Promise<{ soporte, permiso, activo, hora, palacio, instalada, ios, segundoPlano, hoy, manana, ultimaNotif }>
//   cuentas()             → { hoy, manana, palacios[], semanal, temas } (síncrono)
//   probar()              → muestra una notificación de prueba ahora.
//   ics() / urlGoogle()   → respaldo infalible: evento diario en el calendario del usuario.
//   htmlAjustes() / montarAjustes(seccion) → sección "🔔 Recordatorios" de ⚙️ (la usa js/ajustes.js).
//
// Ajustes (memo-semio-ajustes, entran en el respaldo): notifActivo (bool) · notifHora ('HH:MM', 19:00) · notifPalacio (bool).
// IndexedDB 'memo-semio-notif' / store 'kv' (lo lee sw.js, que no puede leer localStorage):
//   'resumen'     = { v, generado, activo, hora, palacio, diaSemanal, vencidasPorDia:{fecha:n}, palaciosPorDia:{fecha:[nombres]},
//                     temasPorDia:{fecha:n}, ultimaActividad }
//   'ultimaNotif' = 'AAAA-MM-DD' (clave aparte para que la app y el SW no se pisen)
//   'posponer'    = ms ("En 1 h")
// Eventos que escucha: storage (memo-semio-v1 / -plan / -ajustes), memo:srs, memo:plan, memo:estudiada, visibilitychange.
import * as ajustes from './ajustes.js';

export const URL_APP = 'https://canazachyub.github.io/memo-semiologia/?vista=hoy';
const DIA = 86400000;
const DIAS_RESUMEN = 14;
const ESTUDIANDO_MS = 45 * 60000; // si calificó hace menos de esto, está repasando: no interrumpir
const DB = 'memo-semio-notif', ST = 'kv';

let C = null; // contexto de iniciar()
let ultimoResumen = '';
let tic = 0;

// ---------------------------------------------------------------- utilidades
const pad = (n) => String(n).padStart(2, '0');
const fecha = (ms = Date.now()) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const inicioDia = (n = 0) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d.getTime(); };
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const plural = (n, s, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;
const minutos = (h) => { const [a, b] = String(h || '19:00').split(':').map(Number); return (a || 0) * 60 + (b || 0); };

const conf = () => ({
  activo: ajustes.get('notifActivo') === true,
  hora: /^\d{1,2}:\d{2}$/.test(ajustes.get('notifHora') || '') ? ajustes.get('notifHora') : '19:00',
  palacio: ajustes.get('notifPalacio') !== false,
  diaSemanal: +(ajustes.get('diaSemanal') ?? 0),
});

export function soporte() {
  const w = typeof window !== 'undefined' ? window : {};
  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const iosVer = ios ? +((ua.match(/OS (\d+)[_.](\d+)/) || []).slice(1).join('.') || 0) : 0;
  return {
    notificaciones: 'Notification' in w,
    sw: 'serviceWorker' in navigator,
    periodicSync: 'ServiceWorkerRegistration' in w && 'periodicSync' in ServiceWorkerRegistration.prototype,
    insignia: 'setAppBadge' in navigator,
    instalada: !!(w.matchMedia?.('(display-mode: standalone)').matches || w.matchMedia?.('(display-mode: window-controls-overlay)').matches || navigator.standalone),
    ios, iosVer, android: /Android/.test(ua),
    https: location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname),
  };
}
const permiso = () => ('Notification' in window ? Notification.permission : 'no-soportado');

// ---------------------------------------------------------------- IndexedDB (mismo formato que sw.js)
function abrirDB() {
  return new Promise((ok, no) => {
    if (!self.indexedDB) { no(new Error('sin IndexedDB')); return; }
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
}
async function idb(modo, k, v) {
  const db = await abrirDB();
  try {
    return await new Promise((ok, no) => {
      const tx = db.transaction(ST, modo === 'get' ? 'readonly' : 'readwrite');
      const s = tx.objectStore(ST);
      const q = modo === 'get' ? s.get(k) : v == null ? s.delete(k) : s.put(v, k);
      tx.oncomplete = () => ok(q.result);
      tx.onerror = () => no(tx.error);
    });
  } finally { db.close(); }
}
const leerKV = (k) => idb('get', k).catch(() => undefined);
const escribirKV = (k, v) => idb('put', k, v).catch(() => undefined);

// ---------------------------------------------------------------- cuentas
function ids() {
  if (Array.isArray(C?.tarjetas) && C.tarjetas.length) return C.tarjetas.filter((t) => t.m).map((t) => t.id);
  return Object.keys(C?.srs?.todas?.() || {}).filter((k) => !k.startsWith('pal:'));
}
function secciones() {
  const s = (C?.ATLAS?.secciones || []).map((x) => x.id);
  return (s.length ? s : ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12']).concat('escalas');
}
const nombrePalacio = (sid) => C?.PALACIOS?.lugares?.[sid]?.lugar || C?.ATLAS?.secciones?.find((x) => x.id === sid)?.titulo || sid;

/** Resumen de los próximos días: vencidas acumuladas por día (si no repasa) y palacios que vencen. */
function calcular() {
  const srs = C.srs;
  const limites = Array.from({ length: DIAS_RESUMEN }, (_, i) => inicioDia(i + 1));
  const venc = new Array(DIAS_RESUMEN).fill(0);
  let ultimaActividad = 0;
  for (const id of ids()) {
    const t = srs.info(id);
    if (!t) continue;
    if ((t.ult || 0) > ultimaActividad) ultimaActividad = t.ult;
    for (let i = 0; i < DIAS_RESUMEN; i++) if (t.due < limites[i]) { for (let j = i; j < DIAS_RESUMEN; j++) venc[j]++; break; }
  }
  const pal = Array.from({ length: DIAS_RESUMEN }, () => []);
  for (const sid of secciones()) {
    const t = srs.info(`pal:${sid}`);
    if (!t) continue;
    if ((t.ult || 0) > ultimaActividad) ultimaActividad = t.ult;
    for (let i = 0; i < DIAS_RESUMEN; i++) if (t.due < limites[i]) { for (let j = i; j < DIAS_RESUMEN; j++) pal[j].push(nombrePalacio(sid)); break; }
  }
  let temas = 0;
  try { temas = (C.plan?.hoyToca?.().pendientes || []).length; } catch { /* sin plan */ }
  const vencidasPorDia = {}, palaciosPorDia = {};
  for (let i = 0; i < DIAS_RESUMEN; i++) { const f = fecha(inicioDia(i)); vencidasPorDia[f] = venc[i]; palaciosPorDia[f] = pal[i]; }
  return { vencidasPorDia, palaciosPorDia, temasPorDia: { [fecha()]: temas }, ultimaActividad };
}

export function cuentas() {
  if (!C) return { hoy: 0, manana: 0, palacios: [], semanal: false, temas: 0 };
  const r = calcular(), h = fecha(), m = fecha(inicioDia(1)), c = conf();
  return { hoy: r.vencidasPorDia[h], manana: r.vencidasPorDia[m], palacios: r.palaciosPorDia[h], semanal: new Date().getDay() === c.diaSemanal, temas: r.temasPorDia[h] };
}

// MANTENER IGUAL que textoRepasos() en sw.js
function texto(n, pal, semanal, temas, conPalacio) {
  const extra = [];
  if (n) extra.push(`${plural(n, 'tarjeta vencida', 'tarjetas vencidas')} (≈ ${Math.max(1, Math.ceil(n / 4))} min)`);
  if (temas) extra.push(plural(temas, 'tema nuevo', 'temas nuevos'));
  if (conPalacio && pal?.length) extra.push(`🏛️ palacio: ${pal.slice(0, 3).join(', ')}${pal.length > 3 ? '…' : ''}`);
  if (conPalacio && semanal) extra.push('📅 hoy toca repaso semanal');
  const titulo = n ? `🧠 Tienes ${plural(n, 'repaso')}` : conPalacio && pal?.length ? '🏛️ Hoy toca pasear tu palacio' : '📅 Hoy es tu repaso semanal';
  return { titulo, cuerpo: `Tu sesión de hoy: ${extra.join(' · ') || 'nada pendiente'}` };
}
function opcionesNotif(cuerpo, extra = {}) {
  return {
    body: cuerpo, icon: 'img/icon-192.png', badge: 'img/icon-192.png', tag: 'repasos', renotify: true, lang: 'es',
    data: { url: './?vista=hoy' }, actions: [{ action: 'repasar', title: 'Repasar ahora' }, { action: 'luego', title: 'En 1 h' }], ...extra,
  };
}

// ---------------------------------------------------------------- insignia + resumen para el SW
async function insignia(n) {
  try { if (!('setAppBadge' in navigator)) return; if (n > 0) await navigator.setAppBadge(n); else await navigator.clearAppBadge(); } catch { /* sin permiso o no instalada */ }
}

let pend = null;
/** Recalcula y guarda; devuelve el resumen. Barato: solo escribe en IndexedDB si algo cambió. */
export async function programar() {
  if (!C) return null;
  const c = conf();
  const r = calcular();
  const resumen = { v: 1, ...r, activo: c.activo, hora: c.hora, palacio: c.palacio, diaSemanal: c.diaSemanal };
  const firma = JSON.stringify(resumen);
  insignia(r.vencidasPorDia[fecha()] || 0);
  if (firma !== ultimoResumen) {
    ultimoResumen = firma;
    await escribirKV('resumen', { ...resumen, generado: Date.now() });
  }
  if (!pend) pend = segundoPlano(c).finally(() => { pend = null; });
  await pend;
  return resumen;
}
const programarSuave = (() => { let t = 0; return () => { clearTimeout(t); t = setTimeout(() => { programar(); revisar(); }, 400); }; })();

let syncEstado = 'sin-comprobar';
async function segundoPlano(c) {
  const s = soporte();
  if (!s.sw || !s.periodicSync) { syncEstado = 'no-soportado'; return; }
  let reg;
  try { reg = await navigator.serviceWorker.getRegistration(); } catch { /* */ }
  if (!reg?.periodicSync) { syncEstado = 'sin-sw'; return; }
  try {
    const tags = await reg.periodicSync.getTags();
    const quiere = c.activo && permiso() === 'granted';
    if (!quiere) { if (tags.includes('memo-repasos')) await reg.periodicSync.unregister('memo-repasos'); syncEstado = c.activo ? 'sin-permiso' : 'apagado'; return; }
    const p = await navigator.permissions?.query({ name: 'periodic-background-sync' }).catch(() => null);
    if (p && p.state !== 'granted') { syncEstado = s.instalada ? 'denegado' : 'instalar'; return; }
    if (!tags.includes('memo-repasos')) await reg.periodicSync.register('memo-repasos', { minInterval: 12 * 60 * 60 * 1000 });
    syncEstado = 'activo';
  } catch { syncEstado = s.instalada ? 'denegado' : 'instalar'; }
}

// ---------------------------------------------------------------- aviso con la app abierta
async function mostrarSistema(titulo, opciones) {
  const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => null);
  if (reg?.showNotification) { await reg.showNotification(titulo, opciones); return true; }
  // sin SW (p. ej. http no local): Notification directa, sin botones (en Android lanza error → se captura)
  const n = new Notification(titulo, { ...opciones, actions: undefined });
  n.onclick = () => { window.focus(); ir('hoy'); n.close(); };
  return true;
}
const ir = (vista) => window.dispatchEvent(new CustomEvent('memo:vista', { detail: { vista } }));

let revisando = false;
/** ¿Toca avisar ahora? Misma regla que el SW: activo, ya pasó la hora, hay algo, no se avisó hoy (o venció el "En 1 h"). */
async function revisar() {
  if (!C || revisando) return;
  const c = conf();
  if (!c.activo) return;
  revisando = true;
  try {
    const ahora = Date.now(), h = fecha(ahora);
    const d = new Date(ahora);
    if (d.getHours() * 60 + d.getMinutes() < minutos(c.hora)) return;
    const [ultima, posponer] = await Promise.all([leerKV('ultimaNotif'), leerKV('posponer')]);
    if (posponer && ahora < posponer) return;
    if (ultima === h && !(posponer && ahora >= posponer)) return;
    const r = calcular();
    if (ahora - r.ultimaActividad < ESTUDIANDO_MS) return; // está repasando ahora mismo
    const n = r.vencidasPorDia[h] || 0, pal = r.palaciosPorDia[h] || [], sem = new Date().getDay() === c.diaSemanal;
    if (!n && !(c.palacio && (pal.length || sem))) return;
    const { titulo, cuerpo } = texto(n, pal, sem, r.temasPorDia[h], c.palacio);
    let ok = false;
    if (document.visibilityState === 'visible') {
      // con la app a la vista basta el aviso interno (una notificación del sistema encima sería ruido)
      window.dispatchEvent(new CustomEvent('memo:aviso', { detail: { texto: `${titulo}. ${cuerpo}`, acciones: [
        { texto: 'Repasar ahora', fn: () => ir(n ? 'repaso' : 'hoy') },
        { texto: 'En 1 h', fn: () => escribirKV('posponer', Date.now() + 3600e3) },
      ] } }));
      ok = true;
    } else if (permiso() === 'granted') {
      ok = await mostrarSistema(titulo, opcionesNotif(cuerpo)).catch(() => false);
    }
    if (ok) await Promise.all([escribirKV('ultimaNotif', h), escribirKV('posponer', null)]);
  } finally { revisando = false; }
}

// ---------------------------------------------------------------- API pública
export function iniciar(ctx = {}) {
  if (C) { Object.assign(C, ctx); programarSuave(); return; }
  C = { ...ctx };
  if (!C.srs) { console.warn('notificaciones.iniciar: falta srs'); C = null; return; }
  addEventListener('storage', (e) => { if (!e.key || /^memo-semio-(v1|plan|ajustes)$/.test(e.key)) programarSuave(); });
  ['memo:srs', 'memo:plan', 'memo:estudiada'].forEach((ev) => addEventListener(ev, programarSuave));
  ajustes.alCambiar((k) => { if (/^(notif|diaSemanal|examen)/.test(k)) programarSuave(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') programar(); // al salir de la app: dejar el resumen al día para el SW
    else programarSuave();
  });
  addEventListener('pagehide', () => { programar(); });
  // la notificación tocada con la app ya abierta: el SW enfoca la ventana y pide la vista
  navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.tipo === 'NOTIF_IR') ir(e.data.vista || 'hoy'); });
  clearInterval(tic);
  tic = setInterval(() => { programar(); revisar(); }, 60000);
  // tras el registro del SW (app.js lo hace en 'load')
  setTimeout(() => { programar().then(revisar); }, 2500);
}

export async function pedirPermiso() {
  if (!('Notification' in window)) return 'no-soportado';
  let p = Notification.permission;
  if (p === 'default') {
    try { p = await Notification.requestPermission(); } catch { p = await new Promise((ok) => Notification.requestPermission(ok)); } // Safari antiguo: callback
  }
  if (p === 'granted') { ajustes.set('notifActivo', true); await programar(); }
  return p;
}

export async function estado() {
  const s = soporte(), c = conf(), k = cuentas();
  if (C) await programar();
  const ultimaNotif = await leerKV('ultimaNotif');
  return { soporte: s, permiso: permiso(), ...c, instalada: s.instalada, ios: s.ios, segundoPlano: syncEstado, hoy: k.hoy, manana: k.manana, palacios: k.palacios, semanal: k.semanal, ultimaNotif: ultimaNotif || null };
}

export async function probar() {
  const k = cuentas(), c = conf();
  const { titulo, cuerpo } = texto(k.hoy || 0, k.palacios, k.semanal, k.temas, c.palacio);
  if (permiso() !== 'granted') {
    window.dispatchEvent(new CustomEvent('memo:aviso', { detail: { texto: `(Prueba, aviso interno) ${titulo}. ${cuerpo}` } }));
    return 'aviso';
  }
  await mostrarSistema(`${titulo} · prueba`, opcionesNotif(cuerpo, { tag: 'repasos-prueba' }));
  insignia(k.hoy || 0);
  return 'sistema';
}

// ---------------------------------------------------------------- respaldo infalible: calendario
const TITULO_CAL = '🧠 Repaso Memo Semiología';
const DETALLE_CAL = `Tu repaso espaciado de hoy (10–20 min, con recuerdo activo). Abre la app: ${URL_APP}`;
function inicioEvento(hora) {
  const [h, m] = String(hora).split(':').map(Number);
  const d = new Date(); d.setHours(h || 19, m || 0, 0, 0);
  return d;
}
const local = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const utc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const escIcs = (t) => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** Pliega a 75 octetos (RFC 5545 §3.1) sin partir un carácter UTF-8. */
function plegar(linea) {
  const enc = new TextEncoder();
  if (enc.encode(linea).length <= 75) return linea;
  const out = []; let act = '', bytes = 0, max = 75;
  for (const ch of linea) {
    const b = enc.encode(ch).length;
    if (bytes + b > max) { out.push(act); act = ''; bytes = 0; max = 74; } // las siguientes empiezan con un espacio
    act += ch; bytes += b;
  }
  out.push(act);
  return out.join('\r\n ');
}
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Texto .ics: evento diario a la hora elegida con alarma a la hora exacta (+ semanal si "recordarme el día semanal"). */
export function ics({ hora = conf().hora, semanal = conf().palacio, diaSemanal = conf().diaSemanal } = {}) {
  const ini = inicioEvento(hora), fin = new Date(ini.getTime() + 15 * 60000), ahora = new Date();
  const ev = (uid, resumen, rrule, desc, d0, d1) => [
    'BEGIN:VEVENT', `UID:${uid}@canazachyub.github.io`, `DTSTAMP:${utc(ahora)}`,
    `DTSTART:${local(d0)}`, `DTEND:${local(d1)}`, `RRULE:${rrule}`,
    `SUMMARY:${escIcs(resumen)}`, `DESCRIPTION:${escIcs(desc)}`, `URL:${URL_APP}`, 'TRANSP:TRANSPARENT',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escIcs(resumen)}`, 'TRIGGER:-PT0M', 'END:VALARM', 'END:VEVENT',
  ];
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Memo Semiologia//Recordatorio de repaso//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    ...ev(`memo-semio-repaso-diario-${Date.now()}`, TITULO_CAL, 'FREQ=DAILY', DETALLE_CAL, ini, fin)];
  if (semanal) {
    const s0 = new Date(ini); s0.setDate(s0.getDate() + ((diaSemanal - s0.getDay() + 7) % 7));
    lineas.push(...ev(`memo-semio-repaso-semanal-${Date.now()}`, '📅 Repaso semanal Memo Semiología', `FREQ=WEEKLY;BYDAY=${BYDAY[diaSemanal] || 'SU'}`,
      `Día de repaso semanal: sin temas nuevos, solo repasar la semana y pasear el palacio. ${URL_APP}`, s0, new Date(s0.getTime() + 15 * 60000)));
  }
  lineas.push('END:VCALENDAR');
  return `${lineas.map(plegar).join('\r\n')}\r\n`;
}
export function descargarIcs(op) {
  const blob = new Blob([ics(op)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'recordatorio-memo-semiologia.ics';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
export function urlGoogle({ hora = conf().hora } = {}) {
  const ini = inicioEvento(hora), fin = new Date(ini.getTime() + 15 * 60000);
  let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* */ }
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + `&text=${encodeURIComponent(TITULO_CAL)}&dates=${local(ini)}/${local(fin)}${tz ? `&ctz=${encodeURIComponent(tz)}` : ''}`
    + `&recur=RRULE:FREQ%3DDAILY&details=${encodeURIComponent(DETALLE_CAL)}`;
}

// ---------------------------------------------------------------- sección de ⚙️ Ajustes
export function htmlAjustes() {
  const c = conf(), s = soporte(), p = permiso();
  return `<section aria-labelledby="aj-n" class="nt" id="nt"><h3 id="aj-n">🔔 Recordatorios</h3>
    <p class="aj-nota">Repasar <b>a la misma hora cada día</b> convierte el repaso en hábito: la app te avisa cuando tienes tarjetas vencidas.</p>
    <label class="aj-fila aj-sw"><span>Recordarme repasar<small>Aviso diario si tienes tarjetas vencidas.</small></span><input type="checkbox" data-nt="activo" ${c.activo ? 'checked' : ''}></label>
    <div class="nt-explica" id="nt-explica" hidden>
      <p><b>Antes de que el navegador pregunte:</b> la app solo te enviará <b>un aviso al día</b> a la hora que elijas, y solo si tienes repasos pendientes. No hay servidor: nada sale de tu equipo.</p>
      <div class="aj-btns"><button type="button" class="btn pri" data-nt-acc="permitir">🔔 Sí, permitir notificaciones</button><button type="button" class="btn" data-nt-acc="solo-app">Solo avisos dentro de la app</button></div>
    </div>
    <label class="aj-fila"><span>Hora del recordatorio</span><input type="time" data-nt="hora" value="${esc(c.hora)}" step="300"></label>
    <label class="aj-fila aj-sw"><span>Recordarme también el día del palacio y el semanal<small>Aunque no haya tarjetas vencidas.</small></span><input type="checkbox" data-nt="palacio" ${c.palacio ? 'checked' : ''}></label>
    <div class="aj-btns"><button type="button" class="btn" data-nt-acc="probar">🧪 Probar notificación</button></div>
    <ul class="nt-estado" id="nt-estado" aria-live="polite"><li>Comprobando…</li></ul>
    <h4 class="nt-sub">📅 Respaldo infalible: tu calendario</h4>
    <p class="aj-nota">El calendario del celular avisa siempre, aunque la app esté cerrada o el navegador no permita notificaciones.</p>
    <div class="aj-btns">
      <button type="button" class="btn pri" data-nt-acc="ics">📅 Agregar recordatorio diario a mi calendario</button>
      <a class="btn" id="nt-google" href="${esc(urlGoogle())}" target="_blank" rel="noopener">Google Calendar ↗</a>
    </div>
    <details class="nt-compat"><summary>¿Qué funciona en mi dispositivo?</summary>
      <ul>
        <li><b>Android · Chrome</b>: con la app <b>instalada</b> (menú ⋮ → Instalar app) avisa en segundo plano, aunque esté cerrada. El navegador decide cuándo revisa (≈ 1–2 veces al día según el uso), así que la hora es aproximada.</li>
        <li><b>iPhone / iPad</b>: solo con la app en la <b>pantalla de inicio</b> (Compartir → Añadir a inicio) e iOS 16.4 o superior, y solo mientras está abierta o al abrirla. Para un aviso puntual usa <b>el calendario</b>.</li>
        <li><b>Computadora</b> (Chrome, Edge, Firefox): avisa mientras la pestaña o la app sigan abiertas, aunque estén en segundo plano.</li>
        <li><b>Cualquier otro caso</b> o si negaste el permiso: el <b>calendario</b> (.ics para Apple/Outlook/Samsung, o el enlace de Google Calendar).</li>
      </ul>
      ${s.ios && !s.instalada ? '<p class="revisar">Estás en iPhone/iPad sin instalar la app: aquí las notificaciones no funcionan. Usa el calendario.</p>' : ''}
      ${p === 'denied' ? '<p class="revisar">Bloqueaste las notificaciones. Para reactivarlas: 🔒 junto a la dirección → Permisos → Notificaciones.</p>' : ''}
    </details>
  </section>`;
}

async function pintarEstado(sec) {
  const ul = sec.querySelector('#nt-estado');
  if (!ul) return;
  const e = await estado();
  const s = e.soporte;
  const permTxt = { granted: '✅ Notificaciones permitidas', denied: '⛔ Notificaciones bloqueadas en este navegador', default: '⏳ Aún no diste permiso', 'no-soportado': '❌ Este navegador no tiene notificaciones' }[e.permiso];
  const sync = {
    activo: '✅ Segundo plano activo: avisa aunque la app esté cerrada', instalar: '📲 Segundo plano disponible si instalas la app',
    denegado: '⚠️ El navegador no permitió el segundo plano (usa el calendario)', apagado: '⏸️ Recordatorios apagados',
    'sin-permiso': '⏸️ Sin permiso de notificaciones: solo avisos dentro de la app',
    'no-soportado': s.ios ? '❌ iOS no permite avisos en segundo plano sin servidor: usa el calendario' : '❌ Este navegador no avisa en segundo plano: usa el calendario',
    'sin-sw': '⏳ Preparando el modo sin conexión (recarga una vez)', 'sin-comprobar': '…',
  }[e.segundoPlano] || e.segundoPlano;
  const li = [
    permTxt,
    e.instalada ? '✅ App instalada' : `📲 App no instalada${s.ios ? ' (Compartir → Añadir a inicio)' : ''}`,
    sync,
    s.insignia ? `🔢 Insignia en el ícono: ${e.hoy ? `${e.hoy}` : 'sin pendientes'}` : null,
    `🧠 Vencidas hoy: <b>${e.hoy || 0}</b> · mañana: <b>${e.manana || 0}</b>${e.palacios?.length ? ` · 🏛️ ${e.palacios.length} palacio(s)` : ''}${e.semanal ? ' · 📅 hoy es semanal' : ''}`,
    e.ultimaNotif ? `Último aviso: ${esc(e.ultimaNotif)}` : null,
  ].filter(Boolean);
  ul.innerHTML = li.map((t) => `<li>${t}</li>`).join('');
}

/** Engancha los controles de la sección (la vuelve a pintar ajustes.js en cada refresco). */
export function montarAjustes(sec) {
  if (!sec || sec.dataset.montado) return;
  sec.dataset.montado = '1';
  const explica = sec.querySelector('#nt-explica');
  const google = () => { const a = sec.querySelector('#nt-google'); if (a) a.href = urlGoogle(); };
  sec.addEventListener('change', async (e) => {
    const t = e.target, k = t.dataset?.nt;
    if (!k) return;
    if (k === 'activo') {
      if (t.checked && permiso() === 'default') { explica.hidden = false; explica.querySelector('button')?.focus(); return; } // explicación previa
      ajustes.set('notifActivo', t.checked);
      if (t.checked && permiso() === 'denied') window.dispatchEvent(new CustomEvent('memo:aviso', { detail: { texto: 'Las notificaciones están bloqueadas: te avisaré dentro de la app y te conviene el calendario.' } }));
    } else if (k === 'hora' && t.value) { ajustes.set('notifHora', t.value); google(); }
    else if (k === 'palacio') ajustes.set('notifPalacio', t.checked);
    await programar(); pintarEstado(sec);
  });
  sec.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-nt-acc]');
    if (!a) return;
    const acc = a.dataset.ntAcc;
    if (acc === 'permitir') {
      const p = await pedirPermiso();
      explica.hidden = true;
      ajustes.set('notifActivo', true); // con 'denied' quedan los avisos internos
      sec.querySelector('[data-nt="activo"]').checked = true;
      if (p === 'granted') probar();
    } else if (acc === 'solo-app') {
      explica.hidden = true; ajustes.set('notifActivo', true);
    } else if (acc === 'probar') {
      if (permiso() === 'default') { explica.hidden = false; return; }
      await probar();
    } else if (acc === 'ics') descargarIcs();
    await programar(); pintarEstado(sec);
  });
  pintarEstado(sec);
}
