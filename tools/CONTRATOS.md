# Contratos de la app Memo Semiología (para agentes en paralelo)

App estática, vanilla JS con módulos ES y sin build, publicada en GitHub Pages. Raíz: `C:\PROGRAMACION\memo-semiologia`.
Probar con `py -m http.server 8765` en la raíz, ya corriendo en http://127.0.0.1:8765.

## Archivos existentes (NO editar salvo que tu tarea lo diga)
- `index.html`: pestañas `<nav class="tabs">` y secciones `<section id="v-<vista>" class="vista">`. Las integra el coordinador.
- `js/app.js`: carga los datos y la navegación. Lo integra el coordinador.
- `js/srs.js`: repetición espaciada. API: `info(id)`, `vence(id)`, `calificar(id, nota1a4)`, `nivel(id)` (nueva / aprendiendo / dominada), `previsualizar`, `textoIntervalo`.
- `js/ciudad.js`: lista del paseo (vista sin mapa).
- `css/app.css`: variables de tema `--bg --card --ink --muted --line --ok --up --dn --memo --memo-bg --accent --radius --shadow`, modo claro y oscuro. Clases reutilizables: `.btn .btn.pri .tarjeta .chip .kpi .fin .porque .revisar`.

## Datos
- `data/atlas.json`:
  - `secciones[]` con `{ id: "s1".."s12", titulo, color, icono, filas[] }`.
  - Cada fila es `{ id, parametro, nombre, icono, normal: {t, lit}, altura, sube, baja, clave: {tipo, texto, icono}, perla }`.
  - `escalas[]` con `{ id, nombre, icono, items: [[nombre, texto]], interpretacion: [[rango, texto, N|L|M|G]], perla }`.
  - `facies[]` con `{ id, nombre, rasgo, orienta, imagen }`.
  - `glosario[]` con `{ titulo, items: [{ sigla, significado }] }`.
- `data/memoria.json`: `{ id: entrada }` según `C:\Users\User\.claude\skills\atlas-memoria\esquema-memoria.md`. Campos: `escena`, `ancla`, `codigo[]`, `acronimo`, `preguntas[{q, a, tipo}]`, `imagen`, `estacion: {seccion, n, ubicacion}`, `tecnicas[]`.
- `data/palacios.json`: `{ ciudad, orden_paseo: ["s1".."s12", "escalas"], lugares: { sid: { lugar, icono, porque, ruta: [micro-ubicaciones] } } }`.
- `data/mapa.json` **(nuevo, lo crea el agente MAPA)**:
  ```json
  { "centro": [lat, lng], "zoom": 15,
    "lugares": { "s1": { "lat": 0, "lng": 0, "nombre": "…", "fuente": "OSM node/way id o búsqueda" } },
    "ruta": [[lat, lng], …],
    "estaciones": { "s1": [[lat, lng], …] } }
  ```
  - `ruta` es el recorrido a pie en el orden de `orden_paseo`.
  - `estaciones[sid]` tiene un punto por dato (mismo orden y largo que las filas de la sección o que las escalas), alrededor del lugar en un radio de 25–80 m y sobre sitios caminables cuando sea posible.
- `data/memoria_siglas.json` **(nuevo, lo crea el agente SIGLAS)**: `{ "<sigla-slug>": { sigla, significado, grupo, tecnica, sustituta, escena, ancla, confusiones: [], preguntas: [{q, a, tipo}] } }`.
- `data/memoria_facies.json` **(nuevo, lo crea el agente FACIES)**: `{ "<facies-id>": { escena, ancla, tecnicas[], rasgo_clave, preguntas[], imagen_prompt } }`.
- `img/memo/<id>.webp`: imágenes de escenas. `img/lugares/<sid>.webp`: ilustración de cada lugar. `img/avatar.webp`: avatar del jugador. Pueden no existir todavía: **el código debe funcionar sin ellas**, con un emoji como reemplazo.

## Interfaz de un módulo de vista (igual que `js/ciudad.js`)
```js
export function crearX({ ATLAS, MEMO, PALACIOS, MAPA, SIGLAS, FACIES, srs, raiz }) {
  // raiz = <div> dentro de <section id="v-x">; pinta todo dentro de raiz
  return { pintar() { … } };   // se llama cada vez que se abre la pestaña
}
```

## Estado del juego (compartido)
`js/juego-estado.js` lo crea el agente JUEGO y lo pueden importar otros módulos. API mínima:
- `sumarXP(cantidad, motivo)`
- `capturar(id)`
- `capturado(id) → bool`
- `nivel() → {n, xp, siguiente}`
- `racha() → días`
- `logros() → []`
- `registrarActividad()`

Se guarda en localStorage con la clave `memo-semio-juego`, y todo acceso va dentro de try/catch.

## Reglas
- Sin dependencias de build. Librerías externas solo por CDN: `https://unpkg.com/` o `https://cdn.jsdelivr.net/npm/`, por ejemplo Leaflet 1.9.x.
- Teselas del mapa: CARTO (`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`; para oscuro, `dark_all`), con la atribución © OpenStreetMap © CARTO.
- Debe funcionar en el celular: táctil, 360 px de ancho, sin scroll horizontal. Respetar el modo oscuro.
- Español, accesible: botones con texto o `aria-label`.
- No romper las vistas existentes. Probar en http://127.0.0.1:8765 y revisar la consola.

## Módulos tras el paso 0 (2026-10-26)
`js/app.js` solo carga datos, monta módulos y navega. Arma el contexto `CTX = { ATLAS, MEMO, METODOS, PALACIOS, SIGLAS, FACIES, MAPA, RUTA, CASOS, srs }`, que reciben todos los módulos, y además `raiz`.
- `js/util.js`: `$ $$ esc norm resaltar celda`.
- `js/vistas.js` (paquete B): `crearVistas(CTX)` devuelve `{tabla, escalas, facies, siglas, metodos, filtros, panelMemoria, filtrarSeccion}`, y además exporta `tarjetasExtra(ATLAS, MEMO)`, que importa repaso.js.
- `js/repaso.js` (A): `crearRepaso({...CTX, raiz, alPendientes(n)})` devuelve `{pintar, tarjetas, pendientes}`.
- `js/progreso.js` (A): `crearProgreso({...CTX, tarjetas, raiz})`.
- `js/hoy.js` (A): `crearHoy({...CTX, tarjetas, raiz})`, pestaña "🏠 Hoy" (`#v-hoy`).
- `js/plan.js` (A): `cargar() guardar(p) marcarEstudiada(sid) estudiada(sid) hoyToca() faseSimulacro() topeDue(ms)`.
- `js/mias.js` (B): `get(ref) set(ref, obj|null) todas()`.
- `js/ajustes.js` (C): `get(k) set(k, v) alCambiar(fn)`.
- `js/respaldo.js` (C): `exportar() importar(txt)` cubre todas las claves `memo-semio-*`.
- `js/metodos.js` (agente MÉTODOS): `crearMetodos({...CTX, raiz})`, que app.js carga dinámicamente.
- **Eventos globales:** `window.dispatchEvent(new CustomEvent('memo:ir', {detail: {id}}))` abre la ficha de un dato; `memo:vista` con `{vista}` cambia de pestaña.
- **CSS por paquete:** A va en `css/repaso.css`, B en `css/vistas.css`, C en `css/ajustes.css` y en `css/app.css` (solo C edita app.css), D en `css/entrenar.css` y `css/juego.css`.

## Paquete B · contratos nuevos (2026-10-26)
- **R6 · `pid` estable en cada pregunta** de `data/memoria.json` (vía `memoria_parts/*.json`), `memoria_siglas.json` y `memoria_facies.json`: `"q" + 7 hex` (hash de ref + q, asignado una sola vez). Pregunta nueva → déjala sin pid y corre `py tools/ids_preguntas.py` y luego `py tools/unir_memoria.py`. `py tools/validar_memoria.py` falla si falta un pid o se repite dentro de la ficha. Los pid `n`, `cz`, `inv`, `tr` están reservados.
- **Los ids de tarjeta NO cambiaron** (siguen `${ref}#${i}`, `sig:${id}#${i}`, `fac:${id}#${i}` en repaso.js y juego.js). Migración para quien la haga (A en srs/repaso, D en juego): id nuevo = `${prefijo}#${p.pid}`; el mapa viejo→nuevo se arma en tiempo de ejecución desde los datos actuales (`preguntas[i].pid` ↔ índice `i`), válido porque al agregar los pid no se reordenó ninguna pregunta. Correr la migración una vez (`estado.v = 2`) **antes** de que alguien reordene preguntas.
- **`vistas.tarjetasExtra(ATLAS, MEMO, {SIGLAS, FACIES}?)`** → `{id, ref, sec, q, a, m, nombre, tipo}`: ES2 `esc:<id>:i<k>` (tipo `componente`) y `esc:<id>:r<k>` (`umbral`), sin `m`; F2 `fac:<id>#inv` solo si falta la inversa; SG2 `sig:<id>#tr` (`trampa`). Sin el 3.er argumento usa SIGLAS/FACIES cacheados por `crearVistas` (app.js lo llama antes que crearRepaso).
- **`VISTAS.filtrarTecnica(clave|null)`**: filtra Valores (y Escalas) por `MEMO[id].tecnicas` con chip "🧩 método ✕".
- **`js/mias.js`, claves:** fila/escala = `<id>`; sigla = `sig:<slug>`; facies = `fac:<id>`; Métodos M2 = `num:NN`. Valor `{ancla, escena, notaPregunta, check:{significado, protagonista, accion, sentidos}, ts}`. La clave de mias = la parte del id de tarjeta antes de `#` (los slugs de siglas chocan con ids de filas: vcm, hdl, ldl…; por eso el prefijo).
- **Eventos:** `memo:mia {id}` abre el editor "Mi versión" de ese dato (id = clave de mias); B emite `memo:mia-cambio {ref}` al guardar/borrar, `memo:estudiada {sid, estudiada}` al marcar una sección y `memo:repasar {sec}` antes de `memo:vista {vista:'repaso'}` ("Repasar las de hoy" de Siglas; mientras repaso.js no lo escuche, B elige `siglas` en `#rep-sec`).
- **V1:** secciones marcables `s1…s12`, `escalas`, `facies`, `siglas` (usa `plan.marcarEstudiada/estudiada`; desmarcar = `plan.guardar` sin esa clave). Acepta `estudiadas[sid]` como ms o `'AAAA-MM-DD'`.
- **`memo-semio-autoexamen`** (V2/ES1, no toca srs): `{ <ámbito>: {fecha:'AAAA-MM-DD', ronda, filas:{id:'r'|'a'|'v'}, cola:[ids]|null} }`, ámbito = `s1…s12` | `todas` | `escalas`.
- **V2:** el selector "Ocultar: ninguno · Normal · Sube/Baja · todo" lo inserta vistas.js en `#v-tabla .barra` y esconde el viejo `#ocultar`; clases en `body`: `ocultar` (todo), `ocultar-n`, `ocultar-ub`.

## Paquete C · transversal (2026-10-26)
- **Avisos:** `window.dispatchEvent(new CustomEvent('memo:aviso', {detail: {texto, acciones, ms}}))` muestra un aviso accesible (aria-live).
- **Variables CSS:** `--fs` (tamaño de letra base, en <html>) y `--barra-movil` (alto de la barra inferior en móvil ≤760 px). Los tamaños se escriben en rem.
- **URL:** `?vista=<id>` abre una pestaña (lo usan los accesos directos del manifest); `?sw=0` desinstala el service worker para desarrollar.
- **Publicar:** correr `py tools/precache.py` antes de cada commit/push. Actualiza la lista y la versión de `sw.js`.
- **Ajustes que lee el paquete A:** nuevasDia, nuevasNoEstudiadas, diaSemanal, bloque. `reducirMov` devuelve booleano efectivo.

## Recordatorios de repaso · `js/notificaciones.js` (paquete C, 2026-10-25)
- **Enganche (coordinador, una línea en `js/app.js`, después de crear `REPASO`):**
  ```js
  import * as notificaciones from './notificaciones.js';   // junto a los demás imports
  notificaciones.iniciar({ ...CTX, tarjetas: REPASO.tarjetas }); // tras const REPASO = crearRepaso(...)
  ```
  Es idempotente (llamarla otra vez solo actualiza el contexto). `ajustes.js` ya importa el módulo para la sección ⚙️ "🔔 Recordatorios".
- **API:** `iniciar({srs, plan, tarjetas?, PALACIOS?, ATLAS?})` · `pedirPermiso()` · `programar()` · `estado()` (Promise) · `cuentas()` · `probar()` · `ics()` · `descargarIcs()` · `urlGoogle()`.
  Cuenta como "vencidas" las tarjetas con técnica (`t.m`) igual que el badge `#pend`; sin `tarjetas` usa `srs.todas()` (sin `pal:*`). Palacios = tarjetas srs `pal:<sid>`.
- **Ajustes nuevos** (`memo-semio-ajustes`, entran en el respaldo): `notifActivo` (false) · `notifHora` ('19:00') · `notifPalacio` (true).
- **Evento recomendado para el paquete A:** `window.dispatchEvent(new CustomEvent('memo:srs'))` en `srs.js` tras cada `guardar()`. Sin él, la insignia y el resumen se recalculan cada 60 s, al cambiar de pestaña (`storage`) y al ocultar/mostrar la app (`visibilitychange`).
- **IndexedDB `memo-semio-notif` / store `kv`** (lo lee `sw.js`): `resumen` = `{v, generado, activo, hora, palacio, diaSemanal, vencidasPorDia:{fecha:n}, palaciosPorDia:{fecha:[nombres]}, temasPorDia, ultimaActividad}` (14 días); `ultimaNotif` ('AAAA-MM-DD') y `posponer` (ms) son claves aparte, compartidas por la app y el SW (así nunca avisan dos veces el mismo día).
- **Regla de aviso (app y SW, iguales):** activo · ya pasó `notifHora` · hay vencidas (o palacio/semanal con `notifPalacio`) · no se avisó hoy (o venció "En 1 h") · sin calificar nada en los últimos 45 min. Con la app visible → `memo:aviso` interno; oculta y con permiso → notificación del sistema (`tag:'repasos'`, acciones `repasar` / `luego`).
- **SW:** `periodicsync` tag `memo-repasos` (lo registra la app con `minInterval` 12 h si el permiso `periodic-background-sync` está concedido); `notificationclick` enfoca una ventana y le manda `{tipo:'NOTIF_IR', vista}` (el módulo lo convierte en `memo:vista`) o abre `./?vista=hoy|repaso`. Los textos están duplicados en `texto()` (módulo) y `textoRepasos()` (sw.js): mantenerlos iguales.

## Pulido móvil (2026-10-25)
- **Modo inmersivo:** `app.js` pone `body.inmersivo` mientras la vista es `juego`. Solo con ≤ 760 px (`css/juego.css`) esconde `.top`, `.barra-movil` y `.pie`, y `.jg` pasa a `position: fixed; inset: 0`. En escritorio no cambia nada.
- **Eventos nuevos:** `memo:atras` vuelve a la pestaña anterior al Juego (o a Hoy). `memo:menu` abre la hoja "Más" (`#hoja-mas`).
- **Cabecera móvil:** `body.top-oculta` la esconde al bajar y la muestra al subir. Lo maneja `app.js`, y no se activa en el Juego ni con el buscador enfocado.
- **Juego en el celular:** el HUD queda en una sola franja (`.jg-salir ← · nivel/XP · racha · capturas · .jg-menu ☰`). El resto va en `.jg-dock` (`data-estado` = `peek` | `media` | `llena`, arrastrable). `juego-caza.montarBarra(nodo, modo)` acepta los modos `'hud'` (por defecto), `'dock'` y `'peek'`, y `pintarBarra()` repinta todos. La acción `ruta-sig` pasa a la ruta siguiente.
- **Teclado virtual:** `visualViewport` → `--kb` y la clase `.teclado` en `.jg` (hoja de reto) y en `.jg-enc` (encuentro).
- **Prueba:** `movil-test.html?vista=<id>&escala=0.75[&solo=0|1|2]` muestra marcos de 360×740, 390×844 y 412×915.
