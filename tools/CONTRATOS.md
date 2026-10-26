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
