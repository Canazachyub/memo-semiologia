# Diseño v2 — brief para rediseñar una vista

App: Memo Semiología (PWA de estudio de Medicina, UNA Puno). Usuario: estudiante que la usa sobre todo en el
CELULAR (390 px) y a veces en PC. Vanilla JS (módulos ES), sin frameworks ni build. Servidor local en
http://127.0.0.1:8765 (ya corriendo; no lo arranques ni lo detengas).

## Objetivo
Llevar tu vista al nivel de una app moderna y pulida (piensa en Duolingo/Anki moderno/Linear): jerarquía visual
clara, una acción principal evidente, micro-interacciones y gestos, estados vacíos con personalidad,
y que se sienta "viva" sin ser recargada. Mejora la INTERACCIÓN, no solo los colores.

## Sistema de diseño (ya existe: `css/diseno.css` — léelo primero; NO lo edites)
- Tokens: `--bg --bg-2 --card --card-2 --ink --muted --line --accent --accent-2 --grad --grad-suave
  --shadow --shadow-lg --r (16px) --r-lg (22px) --ease --font-display`. Más los antiguos de `css/app.css`
  (`--ok --ok-bg --up --up-bg --dn --dn-bg --memo --memo-bg`). Todo debe verse bien en claro Y oscuro
  (usa tokens, nunca colores fijos de fondo/texto salvo sobre `--grad`, donde el texto va blanco).
- Utilidades: `.ds-titulo` (título de vista), `.ds-sub`, `.ds-card`, `.ds-grad-texto`,
  `.ds-entra` (entrada escalonada: pon `style="--i:N"`), `.btn`, `.btn.pri` (degradado de marca), `.chip`, `.chip.on`.
- Háptica: `import { haptico } from './util.js'` → `haptico('toque'|'bien'|'mal'|'logro')`.
- Escritorio ≥1100 px: hay barra lateral; tu vista vive en una columna de máx. 1180 px.
  Celular ≤760 px: barra inferior fija (`--barra-movil`), toques ≥ 44 px, inputs ≥ 16 px.
- Movimiento: respeta `prefers-reduced-motion` y la clase `html.sin-mov` (ajuste del usuario).
- Accesibilidad: roles/aria existentes se conservan; foco visible; contraste AA; nada solo por color.

## Reglas
- Toca SOLO los archivos que te asignaron. Si necesitas algo de otro archivo (app.js, index.html,
  diseno.css, app.css), NO lo edites: anótalo en tu respuesta final.
- No cambies contratos/API públicas de los módulos (ver `tools/CONTRATOS.md`) ni el formato de localStorage.
- No cambies contenido médico.
- Comprueba sintaxis con `node --check js/<archivo>.js`. NO uses el navegador (otro agente lo usa).
- Al final responde: qué cambiaste (lista breve), qué interacciones nuevas hay y pendientes que no pudiste hacer.
