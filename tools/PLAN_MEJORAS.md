# Plan de mejoras · Memo Semiología

Plan priorizado para estudiar de forma más cómoda y efectiva. Se armó con estas fuentes:
- Lectura de `index.html`, `js/app.js`, `js/srs.js`, `js/ciudad.js`, `js/entrenar.js`, `js/juego.js`, `js/juego-caza.js`, `js/juego-estado.js` y `css/app.css`.
- Una prueba en http://127.0.0.1:8765.
- Los 11 skills `estudio-*` y `atlas-memoria`.

Fecha: 2026-10-25.

**Formato de cada mejora:**
- **Problema:** qué resuelve.
- **Skill:** la regla que la respalda, con su #video.
- **Cambio:** qué implementar.
- **Esfuerzo:** S (≤ 2 h), M (medio día), L (1-2 días).
- **Prioridad:** P1 (hacer ya), P2 (siguiente), P3 (cuando sobre tiempo).

Lo marcado **[complemento]** es UX general, sin respaldo en los videos. Ninguna mejora contradice los skills.

---

## 0. Diagnóstico (qué se encontró en el código)

| # | Hallazgo | Dónde | Regla que se incumple |
|---|---|---|---|
| D1 | `srs.calificar()` mueve el calendario **cada vez** que se califica. En la ronda de errores, una tarjeta "Otra vez" vuelve a la cola y al acertarla sube de escalón el mismo día. Además, Entrenar (`srsFallo`, `srsEnt`), Juego y Caza también llaman a `calificar` y vuelven a mover la misma tarjeta el mismo día. | `js/srs.js`, `app.js` `calificar()`, `entrenar.js:171-176`, `juego.js:652-670`, `juego-caza.js:90` | "Solo **la primera respuesta del día** mueve el calendario; las rondas posteriores sirven para llegar a cero errores" (repeticion-espaciada, regla-intervalos.md; #039, #031, #038) |
| D2 | Las rondas de errores no tienen fin: la tarjeta vuelve a la cola sin límite, no hay resumen de sesión y no se sabe en qué ronda vas. | `app.js` `pintarRepaso` | Rondas hasta cero errores **o 3 rondas**; al final, resumen con correctas, regulares, incorrectas, % y tarjetas para editar (#039, #031, #040, #058, #067, #010) |
| D3 | `editar = true` solo muestra un aviso que desaparece. No hay dónde ver ni arreglar esas tarjetas, y `racha` nunca se reinicia al editar. | `srs.js`, `app.js:322` | La pregunta que falla 2-3 veces **se edita**: sintetizar, explicar, ejemplo o mnemotecnia (#040, #038, #039) |
| D4 | El textarea de Repaso no se usa: no compara lo escrito con la respuesta. | `app.js:303` | Responder sin ver, comparar y **no engañarse** (#039, #030) |
| D5 | El Juego (memoparada y caza) y los minijuegos Siglas y Facies arrancan con **4 opciones**. El modo escrito es opcional. | `juego.js:549` (`modo='elegir'`), `juego-caza.js:401`, `entrenar.js:492-560` | "Abiertas antes que opción múltiple: ver opciones te hace reconocer" (#007). El test queda solo para practicar el formato (nota de conflicto de recuerdo-activo) |
| D6 | En Entrenar › Siglas y Facies, la pista de la escena se puede abrir **antes** del primer intento. | `entrenar.js:503, 557` | El ancla "nunca debe mostrarse antes del intento"; es la pista de la ronda 2 (#039, #038) |
| D7 | Las tarjetas nuevas entran en Repaso (15 por sesión) sin importar si el tema ya se estudió. | `app.js` `armarCola` | "No puedes hacer preguntas sin antes haber entendido el tema" (#021, #039, #010, #014) |
| D8 | No hay fecha de examen, plan 80/20, simulacro ni repaso semanal. | — | repeticion-espaciada, pasos 1-3 y reglas 4-6 (#035, #031, #019, #063, #015) |
| D9 | El paseo de Ciudad solo va hacia adelante, no se califica y no se programa su repaso. | `ciudad.js` | Repasar el palacio **adelante y atrás** (#195, #190), con recuerdo activo (#134, #073) y espaciado al día, a la semana y al mes (#148, #190) |
| D10 | Las tarjetas usan ids por posición (`${id}#${i}`). Si se reordenan las preguntas en `memoria.json`, el historial se cruza. | `app.js` `construirTarjetas` | Cada pregunta necesita un "id estable para no perder su historial al editar el atlas" (repeticion-espaciada `[complemento]`) |
| D11 | **Exportar** solo guarda `memo-semio-v1` (srs). Se pierden el juego, Entrenar, los récords y cualquier dato personal futuro. | `app.js:411` | [complemento] |
| D12 | No hay manifest ni service worker, así que la app no funciona sin red. Las 10 pestañas no caben en el móvil. Valores pinta 145 fichas con sus paneles (unos 8000 nodos de DOM) de una sola vez. | `index.html`, `app.js` | Repasar en **tiempos muertos** (transporte, filas) pide uso offline en el móvil (#020, #049, #073). El resto es [complemento] |

---

## 1. Repaso (núcleo del sistema)

### R1 · El calendario se mueve una sola vez al día por tarjeta — **P1 · M**
- **Problema:** D1. Hoy un "Otra vez" seguido de un acierto en la ronda 2 deja la tarjeta en el escalón 1 (3 días) en lugar de mañana. Además, jugar mueve el calendario varias veces.
- **Skill:** regla-intervalos.md, flujo de la sesión, puntos 3-4: "Primera respuesta del día → calificar() → guardar. Si vuelve a la cola, reinsertar **sin volver a calificar el calendario**" (#039, #031, #038). La regla 3 dice: 3 fallos seguidos → editar.
- **Cambio en `js/srs.js`:**
  - Guardar en cada tarjeta `dia` (fecha local `AAAA-MM-DD` de la última calificación), `lapsos`, `fallos` (fallos seguidos, en lugar de `racha`) y `ultimo` (la nota).
  - `calificar(id, nota, {fuente})`:
    - Si `t.dia === hoy`, **no** cambia `esc` ni `due`.
    - Solo si la nota es 1 o 2, suma 1 a `fallos` una vez por día (no por ronda), para que la marca de editar cuente días.
    - Devuelve `{repetirHoy, movido:false}`.
    - Si no es la primera vez del día, aplica la regla actual, guarda `dia = hoy` y devuelve `movido:true`.
  - `fuente` (`'repaso'|'juego'|'caza'|'entrenar'|'simulacro'|'semanal'`) se guarda en un log corto `t.hist = [[dia, nota, fuente]]` de máximo 20 entradas. Ese log alimenta Progreso (P1).
  - `editar` pasa a `true` con `fallos >= 3` y solo vuelve a `false` con la nueva función `marcarEditada(id)`.
  - Migrar las tarjetas viejas: `racha` → `fallos`.
  - Juego, Caza y Entrenar no cambian: la regla vive dentro de `calificar`.

### R2 · Rondas con semáforo y resumen de sesión — **P1 · M**
- **Problema:** D2. Hoy la cola es infinita y al final no hay medición.
- **Skill:** semáforo 🔴🟡🟢🔵 (#039, #012). "Solo se repiten las rojas y amarillas" (#039, #031, #040, #056). Ronda hasta cero errores o tras 3 rondas (regla-intervalos.md). Resumen con % de retención y preguntas para editar (#058, #067, #010). Equivalencia de botones: 🔴 Otra vez · 🟡 Difícil · 🟢 Bien · 🔵 Fácil (regla 7).
- **Cambio en `js/repaso.js` (nuevo, extraído de `app.js`):**
  - Los botones muestran el color y el nombre: `🔴 Otra vez · mañana`, `🟡 Difícil`, `🟢 Bien`, `🔵 Fácil`.
  - La sesión guarda `{ronda: 1, cola, falladas: []}`. Las notas 1 y 2 pasan a `falladas`, no al final de la cola.
  - Al vaciarse la cola: si hay falladas y `ronda < 3`, se muestra "Ronda 2: solo tus errores (n)" y se arranca la ronda con ellas. Si no, se pasa al resumen.
  - **Resumen:**
    - 🟢/🔵, 🟡 y 🔴 de la ronda 1 y el % de retención (🟢 + 🔵 sobre el total).
    - Rondas usadas y tiempo.
    - Lista de las que quedaron sin salir ("vuelven mañana").
    - Lista de las marcadas `editar`, con enlace a la ficha.
  - Cabecera: barra de progreso, "Ronda k · i/n".
  - Teclado: Espacio revela; 1-4 califican.

### R3 · El ancla como pista solo desde la ronda 2 — **P1 · S**
- **Problema:** en el repaso no hay ayuda escalonada. Al revelar se ve todo de golpe y no se puede pedir el ancla antes de rendirse.
- **Skill:** "`ancla`: la frase gancho sirve de pista cuando la pregunta falla en la ronda 2. Nunca debe mostrarse antes del intento" (#039, #038). En flashcards, el código, el acrónimo y la ruta del palacio "van al reverso como pista para la ronda 2, nunca al frente".
- **Cambio:** en la ronda ≥ 2, antes de revelar, aparece el botón `💡 Pista (ancla)`. Muestra solo `m.ancla` o el ancla propia (V4), y queda registrado. En la ronda 1 no hay pista. Tecla `P`.

### R4 · Comparar lo que escribiste — **P1 · S**
- **Problema:** D4.
- **Skill:** "Tapa la respuesta, di o escribe la respuesta" y "evalúate siendo honesto: el primer principio es no engañarse a uno mismo" (#039, #030).
- **Cambio:**
  - Al revelar se muestran dos columnas, "Tú escribiste" y "Respuesta", igual que `.jg-compara` del juego.
  - Las cifras de la respuesta que aparecen en lo escrito se marcan con ✓. Se reutiliza `numeros()` de `js/juego-util.js`.
  - Si coinciden todas las cifras, el botón 🟢 se resalta como sugerencia, pero **califica el usuario**.
  - Ctrl+Enter revela.

### R5 · Bandeja "Para editar" — **P1 · M**
- **Problema:** D3. La tarjeta que siempre falla se sigue repitiendo "como gorila".
- **Skill:** "Si falla 2 o 3 veces seguidas, la pregunta está mal diseñada: edítala". Arreglos: sintetizar, explicar mejor, agregar un ejemplo, una mnemotecnia o algo visual (#040, #038, #039). "Si una tarjeta vuelve una y otra vez a *otra vez*, espaciarla no la arregla: hay que recodificarla" (repeticion-espaciada).
- **Cambio:**
  - En Repaso (pestaña interna) y en Progreso, una lista de las tarjetas con `editar`, con la pregunta, la respuesta, las veces falladas y la técnica actual.
  - Acciones por tarjeta:
    1. `✏️ Mi versión`: abre el editor de V4 sobre esa ficha. Ahí se puede reescribir la escena o el ancla y agregar una **nota de pregunta** (reformulación propia que se muestra debajo de la pregunta oficial).
    2. `🧩 Sugerencia`: texto fijo según la técnica de la ficha. Si es `memorizar-numeros`: "revisa el código en el Gimnasio del sistema mayor". Si es una lista: "divídela en ¿cuántas? + una por pieza".
    3. `✅ Ya la arreglé`: llama a `srs.marcarEditada(id)` y la tarjeta vuelve al escalón 0.
  - Con `?editar=1` en la URL se ve el contador.

### R6 · Ids estables de pregunta — **P2 · M**
- **Problema:** D10.
- **Skill:** cada pregunta debe ser atómica y tener un "id estable para no perder su historial al editar el atlas" (repeticion-espaciada `[complemento]`).
- **Cambio:**
  - En `tools/unir_memoria.py`, o con un script nuevo `tools/ids_preguntas.py`, agregar `pid` a cada pregunta de `memoria.json`, `memoria_siglas.json` y `memoria_facies.json`. El `pid` es un hash corto de `q`, o un slug fijo la primera vez.
  - `construirTarjetas` usa `${ref}#${pid}`, con respaldo al índice.
  - En `srs.js`, `migrar(mapaIndice→pid)` corre una sola vez y deja la marca `estado.v = 2`.
  - `validar_memoria.py` falla si hay `pid` repetidos.

### R7 · Mezclar tipos y no encadenar hermanas — **P2 · S**
- **Problema:** salen seguidas 3 o 4 preguntas de la misma ficha (FC directa, FC umbral, FC caso), y el contexto regala la respuesta.
- **Skill:** "Mezclar tipos: concepto, aplicación (caso clínico), dato duro y pregunta trampa" (#007). "De fácil a difícil" (#006, #008, #019, #030).
- **Cambio en `armarCola`:**
  - Barajar sin que dos tarjetas de la misma `ref` queden a menos de 3 posiciones.
  - Las **nuevas** de una ficha entran en orden de dificultad: `directa → umbral → inversa → lista → caso → trampa`.
  - Debajo de la pregunta, un chip pequeño con el `tipo` ("caso", "trampa").

### R8 · Tarjetas cloze — **P2 · S**
- **Problema:** hoy hay 3 preguntas `cloze` y se muestran como texto plano con `{{…}}`.
- **Skill:** el hueco (cloze) sirve para "cifras dentro de una frase" (#039, #038, #024), con la convención `{{c1::…}}` (flashcards).
- **Cambio:**
  - En el frente, `{{c1::x}}` se pinta como `[ … ]` y en el reverso como `<mark>x</mark>`.
  - Además, se genera una cloze automática por ficha **sin preguntas** a partir de `normal.t`, con id `${id}#cz`: "Potasio: [ … ] mEq/L". Las cifras se ocultan con la misma regex de `resaltar()`.

### R9 · Repaso semanal — **P2 · M**
- **Problema:** no existe el repaso acumulado.
- **Skill:** "Un día a la semana sin contenido nuevo, solo para repasar todo lo de esa semana" (#015, #067, #035). Regla 6: "Repaso semanal: incluye todo lo estudiado en los últimos 7 días aunque no esté vencido; solo *Otra vez* mueve el calendario".
- **Cambio:**
  - En Repaso, el modo `📅 Semanal`: cola con las tarjetas cuyo `hist` tiene alguna fecha de los últimos 7 días.
  - En este modo `calificar(id, n, {fuente:'semanal'})` solo mueve el calendario con nota 1. En `srs.js`, si `fuente === 'semanal' && nota > 1`, no se mueve.
  - El día fijo se configura en Ajustes (T2). Ese día, el inicio "Hoy" (S1) lo propone.

### R10 · Tarjetas de audio para tiempos muertos — **P3 · S**
- **Problema:** no se puede repasar sin mirar la pantalla, por ejemplo en el transporte.
- **Skill:** "Grabar preguntas y respuestas con pausas: en la pausa respondes y la grabación te confirma; sirve para el transporte" (#020, #073).
- **Cambio:**
  - En Repaso, botón `🎧 Modo audio`. Con `speechSynthesis` (es-ES o es-419) lee la pregunta, deja una pausa configurable de 5-10 s y lee la respuesta.
  - Después espera un toque grande en 🔴 / 🟢 (pantalla completa, una mano).
  - Sin red ni dependencias.

### R11 · Exportar a Anki/Quizlet en CSV — **P3 · S**
- **Skill:** "Exportación tabular de dos columnas (frente, reverso) en CSV UTF-8" (#021, #010). Pablo recomienda Anki para lo que más cuesta (#024).
- **Cambio:** en Progreso, `⬇️ CSV (Anki)` exporta las tarjetas (todas, o solo las de `editar` o las vencidas) con este formato: `"q","a · ⚓ ancla"`, UTF-8 con BOM.

---

## 2. Plan hacia un examen con fecha

### E1 · Fecha de examen, regla 80/20 y "qué me toca hoy" — **P1 · M**
- **Problema:** D8. No hay forma de planear hacia una fecha.
- **Skill:**
  - Paso 1: "Calcular el tiempo total: fija la fecha límite y reparte el temario entre los días" (#035).
  - 80/20: "terminar el temario en el primer 80 % del tiempo y dejar el último 20 % para repasos acumulados y simulacros" (#035, #031, #019, #063).
  - Regla 4: "ningún repaso se programa después de la víspera del examen" (#038, #042).
  - Variante de plazo corto (≤ 2 semanas): escalera `[1, 2, 4, 7]`.
  - Cronograma visible: "qué me toca hoy" (#019, #020).
- **Cambio:**
  - **`js/plan.js` (nuevo).** Clave `memo-semio-plan` = `{examen:'AAAA-MM-DD', inicio, temario:['s1',…,'escalas','siglas','facies'], estudiadas:{sid: fecha}}`.
  - **Calendario por día:** las secciones del temario aún no estudiadas se reparten entre los días del primer 80 %, en el orden de `orden_paseo`.
  - **Funciones:** `faseSimulacro()` (de `enFaseSimulacro` en regla-intervalos.md), `hoyToca()` → `{secciones nuevas, vencidas, simulacro?}` y `tope()`.
  - **`srs.js`:**
    - `calificar` recorta `due` a la víspera del examen si hay plan, con la misma lógica de `regla-intervalos.md`.
    - Si faltan ≤ 14 días al crear el plan, usa la escalera corta. Guardar `estado.escalera`.
    - En la fase de simulacro, `armarCola` pone **0 nuevas**.
  - **UI:** el formulario va en Ajustes (T2) y en la vista Hoy (S1). Se ve una barra `Día 12 de 30 · fase de temario (80 %) · te tocan: 🧪 Bioquímica + 🫀 ECG`.

### E2 · Modo simulacro — **P1 · M**
- **Problema:** no hay forma de medirse en condiciones de examen.
- **Skill:**
  - "Simulacro al final: mismas condiciones que el examen real, con cronómetro; después porcentaje de correctas, corregir las incorrectas y volver al tema. Se hacen cuando el tema ya se domina en más del 80-90 %, no al principio" (#031, #042, #067, #148).
  - Regla 5: "mezcla al azar todas las tarjetas del temario con cronómetro; lo que se falla vuelve a 0".
  - "Sin base te acostumbras a fallar" (#148).
- **Cambio:**
  - En Repaso, el modo `🎯 Simulacro`. Se activa en la fase de simulacro (E1) o cuando la sección elegida tiene ≥ 80 % de tarjetas `dominada`. Si no, el botón queda deshabilitado y lo explica.
  - Configuración: n preguntas (20/40/80), secciones y tiempo (1 min por pregunta).
  - Formato: pregunta abierta con textarea, **sin pistas ni anclas**, sin ver la respuesta hasta el final.
  - Al terminar, se recorren las respuestas una por una y se autocalifica ✓ / ✗ (como R4).
  - Las ✗ llaman a `srs.calificar(id, 1, {fuente:'simulacro'})`.
  - Resultado: % total y % por sección. "Volver al tema" lleva a Valores filtrado por esa sección.
  - Se guarda el historial `memo-semio-simulacros` para Progreso (P1).

### E3 · Modo "examen mañana" — **P2 · S**
- **Problema:** con poco tiempo, el temario entero no cabe.
- **Skill:** "Si el examen es mañana: extrae las ideas más importantes, bloques de unas 2 horas con descanso, hazte preguntas; con que domines el 70-80 % basta" (#035, #056, #057). "Repaso al final de cada bloque de 1 h" (#057).
- **Cambio:** si `examen - hoy ≤ 1 día`, Hoy ofrece "Plan de emergencia":
  - Cola de las tarjetas de fichas con `imagen_clave: true` (marcadas como "las más preguntadas" en `INSTRUCCIONES_MEMORIA.md`), más las tarjetas de `editar`.
  - Bloques con descanso (S2) y mini-repaso al cierre de cada bloque.
  - La meta que se muestra es el 80 % de aciertos, no el 100 %.

---

## 3. Sesión de estudio guiada

### S1 · Vista "Hoy" (inicio guiado) — **P1 · L**
- **Problema:** hay 10 pestañas y ninguna dice por dónde empezar. Se puede jugar sin repasar o meter tarjetas de temas no estudiados.
- **Skill:**
  - El ciclo "estudiar y entender → crear la guía → examinarte → semáforo → corregir → rondas hasta cero → espaciar" (#039).
  - Repaso intermitente al final de cada fragmento (#058, #063).
  - "Autoexamen del tema del día: deja un descanso y hazlo en una última sesión" (#056).
  - Recuerdo activo al final de cada día (#035).
  - Dormir consolida: repasa al despertar (#047).
- **Cambio:**
  - Nueva pestaña `🏠 Hoy`, primera y por defecto en la primera visita. Archivo `js/hoy.js`.
  - Muestra una lista de pasos con check:
    1. **🔁 Repasos vencidos (n)**: abre Repaso en modo normal con las rondas de R2.
    2. **📖 Tema nuevo: <sección>**, según `plan.hoyToca()` o la siguiente no estudiada:
       - a) **Comprender**: abre Valores filtrado, con los valores visibles y el panel "¿por qué?" (V1).
       - b) **Codificar**: abre los paneles 🧠 de esa sección y el paseo de Ciudad de su lugar (C2).
       - c) **Marcar estudiada**: libera sus tarjetas nuevas (V1) y lanza el primer repaso del mismo día solo con esa sección.
    3. **⏸ Descanso**: S2.
    4. **🧪 Autoexamen del día**: Repaso de las tarjetas calificadas hoy, en una sola ronda, sin mover el calendario (`fuente:'autoexamen'`, que se trata igual que `'semanal'`).
    5. **🏛️ Palacio que toca**: C2.
  - Si es el día semanal: tarjeta de R9. Si es fase de simulacro: tarjeta de E2.
  - Al pie: racha (de `juego-estado`) y "mañana te tocan n repasos".

### S2 · Bloques con descanso — **P2 · S**
- **Problema:** las sesiones largas cansan y el repaso queda al final.
- **Skill:**
  - "Sesiones cortas con repaso acumulativo y descanso" (#190, #128).
  - "Repaso al final de cada bloque de una hora; repaso siempre intercalado" (#057).
  - Bloques de unas 2 h con descanso cuando hay urgencia (#035).
  - La técnica pomodoro aparece como un hábito de estudio en #195, pero **sin duraciones**: 25/5 o 50/10 es [complemento].
- **Cambio:**
  - Temporizador en la barra superior (`⏱ 25:00`), con duración configurable en Ajustes. Opciones: 25/5 o 50/10 [complemento], 60/10 (#057).
  - Al terminar un bloque: aviso y propuesta de **mini-repaso del bloque**, es decir, las tarjetas de las fichas abiertas o vistas durante el bloque. Para eso se registran las `ref` vistas en `sessionStorage`.
  - Descanso con cuenta regresiva. Respeta `prefers-reduced-motion` y usa `Notification` solo si el usuario la activó.

---

## 4. Progreso

### P1 · Retención por sección y bitácora — **P1 · M**
- **Problema:** Progreso solo cuenta nuevas, aprendiendo y dominadas. No mide la retención ni el avance del plan.
- **Skill:**
  - "Medir la retención: porcentaje de aciertos por tema" (#058, #067).
  - "Bitácora por tema: estudiado → guía → repasos 1, 2, 3 → examen de prueba, con el tiempo de cada uno. Lo que no se mide no se puede mejorar" (#031, #015, #067).
- **Cambio en `js/progreso.js` (nuevo, extraído de `app.js`):**
  - Tabla por sección con estas columnas:
    - `📖 estudiada` (fecha, de `plan.estudiadas`).
    - `repasos` (días distintos con calificaciones, de `hist`).
    - `% retención 30 d`: primeras respuestas del día con 3-4 sobre el total.
    - Semáforo: 🟢 ≥ 90 %, 🟡 60-89 %, 🔴 < 60 % (los mismos cortes que `fin()` de Entrenar).
    - `último simulacro %`.
    - `dominadas/total`.
  - Las barras actuales se conservan.
  - Bloque "Para editar (n)" con enlace a R5.

### P2 · Carga de los próximos días — **P2 · S**
- **Problema:** no se sabe cuánto trabajo viene.
- **Skill:** "Fecha del último repaso y del próximo" (#024). "Qué me toca hoy" (#019, #020).
- **Cambio:** fila de 7 barras pequeñas (hoy … +6 días) con las tarjetas que vencen cada día. Se calcula con `due` de srs. Incluir "vencidas atrasadas".

### P3 · Unificar progreso de juego y estudio — **P3 · S** [complemento]
- **Cambio:** en Progreso se muestran el nivel, la racha y las capturas de `juego-estado.js` junto a los KPI de srs, para no tener que ir al Juego a verlos.

---

## 5. Valores

### V1 · Comprender primero, memorizar después (sección "estudiada") — **P1 · M**
- **Problema:** D7. Además, el panel 🧠 abre directo en la escena y el código.
- **Skill:**
  - "Jamás memorices un dato sin antes comprender su funcionamiento o contexto" (#143, #139, #137).
  - Las fases de conceptos: "contexto → esencia → memorizar y repasar" (#134).
  - Las tarjetas "no antes de estudiar el tema" (#010, #014).
  - "Empezar por el final: saber cómo te lo van a preguntar" (#148).
- **Cambio:**
  - En cada cabecera de sección de Valores, el botón `📖 Marcar como estudiada` / `✅ Estudiada el 25/10`. Llama a `plan.marcarEstudiada(sid)` y, sin plan, guarda en `memo-semio-plan.estudiadas`.
  - En `armarCola`, las **nuevas** solo entran de secciones estudiadas. Las ya iniciadas en srs siguen igual. Interruptor en Ajustes: "Permitir nuevas de temas no estudiados" (apagado por defecto).
  - Si una sección no está estudiada, Repaso muestra "📖 Primero estudia: <sección> (n tarjetas esperando)".
  - Orden del panel de memoria:
    1. **🎯 Qué recordar**: `dato_a_recordar`.
    2. **💡 Por qué**: `por_que`, más `clave` y `perla` de la fila.
    3. La técnica: código, ancla, escena e imagen.

### V2 · Autoexamen de la tabla con semáforo y ronda de errores — **P1 · M**
- **Problema:** "🙈 Ocultar valores" desenfoca las tres columnas a la vez y no deja registro.
- **Skill:**
  - Formato "lista de preguntas con desplegables + semáforo con emoji" (#039, #012, #029).
  - Cornell: "tapar la columna derecha y evaluarse con ✓ / ✗ / ⚠" (#039, #040).
  - "Solo se repiten las rojas y amarillas" (#039, #031).
- **Cambio:**
  - En lugar del interruptor único, un selector `Ocultar: ninguno · Normal · Sube/Baja · todo`. Son clases `ocultar-n`, `ocultar-ub` y `ocultar` en `body`.
  - Con valores ocultos, cada fila muestra tres botones pequeños: 🔴 🟡 🟢.
  - El resultado se guarda en `memo-semio-autoexamen = {fecha, sid, filas:{id: color}}`. **No** toca srs: es un repaso por lista, no por tarjeta.
  - Botón `🔁 Ronda de errores (n)`: filtra la tabla a las filas 🔴/🟡 de ese autoexamen.
  - Contador "Ronda k · 🟢 x / n".

### V3 · Prueba de reconstrucción — **P2 · S**
- **Problema:** no hay forma de comprobar si la escena por sí sola devuelve el dato.
- **Skill:** "Si con solo recordar la imagen logras reconstruir el concepto original, está bien hecha; si no, se fortalece" (#137). Recuerdo activo verifica las escenas (#137).
- **Cambio:**
  - En el panel 🧠, el botón `🧩 Pruébame`. Muestra solo la imagen y el ancla, con el dato tapado, y un campo "¿Qué valor es?".
  - Al revelar: ✓ o ✗. Con ✗ aparece el enlace "Mejorar mi escena" (V4).

### V4 · Mi escena / mi ancla (capa personal) — **P1 · M**
- **Problema:** las escenas son generadas. Si una no le funciona al usuario, no la puede cambiar.
- **Skill:**
  - Checklist obligatorio: "**Es tuya**: la imagen evoca algo para ti" (#137, #148).
  - "Si una asociación del ejemplo no te funciona, haz la tuya" (#195, #148).
  - Tabla 00-99: "que sean tuyas … una vez fijada no la cambies" (#189).
- **Cambio:**
  - **`js/mias.js` (nuevo).** API `get(ref)`, `set(ref, {escena, ancla, notaPregunta})` y `todas()`. Clave `memo-semio-mias`, siempre con try/catch.
  - **Panel 🧠:** botón `✏️ Mi versión`, con un editor en línea de 2 textareas y la checklist corta de 4 casillas (significado, protagonista, acción, sentidos) de visualización.
  - Si existe una versión propia, se muestra **arriba** con la etiqueta "Tu versión" y la oficial queda plegada.
  - **Dónde más se usa:** el ancla propia es la pista de R3, del Juego (`htmlPista`) y de Ciudad.
  - **Respaldo:** entra en el export (T7).

### V5 · Render ligero de la tabla — **P2 · S** [complemento]
- **Problema:** D12. Hay unos 8000 nodos con todos los paneles 🧠 y las imágenes.
- **Cambio:**
  - `panelMemoria(m)` se pinta **al abrir** (al hacer clic en `data-memo`) y no dentro de `filaHTML`.
  - CSS `.fila { content-visibility: auto; contain-intrinsic-size: 160px; }`.
  - La búsqueda espera 150 ms (debounce).

---

## 6. Escalas

### ES1 · Autoexamen en Escalas — **P1 · S**
- **Problema:** "Ocultar valores" solo aplica a Valores. Las escalas se leen siempre con la respuesta a la vista.
- **Skill:** recuerdo activo, sin ver la respuesta (#039). El mismo formato de lista con semáforo (#039, #012).
- **Cambio:**
  - Un interruptor `🙈 Ocultar puntajes` en Escalas desenfoca `.esc td:last-child` y `.sem i`, y se revelan con un toque.
  - Botones 🔴 🟡 🟢 por escala, igual que V2. Comparte el código de V2.

### ES2 · Una tarjeta por componente + caso para calcular — **P2 · M**
- **Problema:** las escalas entran en Repaso solo con las 2-4 preguntas de `memoria.json`. Los componentes y los cortes no se repasan uno por uno.
- **Skill:**
  - Escala: "básica por componente + cloze del total + tarjeta de caso; una tarjeta por componente, no la escala entera en una" (flashcards, #038).
  - La plantilla de la escala pide "componentes + máximos + total + interpretación + caso: calcula el puntaje" (redactar-preguntas.md).
- **Cambio en `construirTarjetas`:**
  - Generar `esc:${id}:i${k}`: "¿Qué evalúa / cuánto vale <ítem k> en <escala>?" a partir de `items[k]`.
  - Generar `esc:${id}:r${k}`: "<escala>: puntaje <rango> significa…" a partir de `interpretacion`.
  - Ambas marcadas `tipo: 'componente' | 'umbral'` y sin `m`, así que entran con el interruptor "Solo con técnica" apagado.
  - En Entrenar, un juego nuevo opcional "🧮 Calcula la escala" (P3): un caso armado al azar con un nivel por ítem para que el usuario sume.

---

## 7. Facies

### F1 · "¿Qué facies es?" en la vista (cara sin nombre) — **P1 · S**
- **Problema:** la vista Facies muestra siempre el nombre junto a la foto.
- **Skill:**
  - Prueba de nombres: "se muestra cada cara en orden aleatorio, sin el nombre, con 3 a 5 segundos para recordarlo, y se cuentan los aciertos" (#124).
  - Decodificar: "rasgo → imagen → nombre" (#124).
- **Cambio:**
  - Interruptor `🙈 Ocultar nombres` en Facies: tapa `b`, el rasgo y "orienta" con blur, y se revelan con un toque.
  - Botón `🎲 Ronda rápida`: abre las fotos al azar a pantalla completa, con cuenta de 5 s y botones ✓ / ✗. Al final, aciertos y "repetir solo las falladas".
  - Al revelar, se muestra el `ancla` de `memoria_facies.json`, no antes.

### F2 · Preguntas en los dos sentidos — **P2 · S**
- **Skill:** "`preguntas` en los dos sentidos: nombre → hallazgo y hallazgo → nombre" (nombres, #124).
- **Cambio:** si a una facies le falta la inversa, `construirTarjetas` genera `fac:${id}#inv`: "Rasgo: <rasgo>. ¿Qué facies es?" → `nombre`. Agregar el aviso en `validar_memoria.py`.

### F3 · Oclusión sobre la foto — **P3 · L**
- **Skill:** "Oclusión de imagen: rectángulos que tapan partes de una imagen" (#039, #024).
- **Cambio:** campo opcional `zonas: [{x, y, w, h, rasgo}]` en `memoria_facies.json` y tarjetas que tapan una zona por vez. Requiere marcar las zonas a mano.

---

## 8. Siglas

### SG1 · Glosario con autoexamen y repaso diario — **P1 · S**
- **Problema:** la vista Siglas es una lista abierta. Para examinarse hay que ir a Entrenar.
- **Skill:**
  - Glosario: "repásala una vez al día hasta dominarla … solo al principio: cuando dominas las palabras, el glosario ya cumplió su función" (#067, #072).
  - Recuerdo activo con desplegables (#039).
- **Cambio:**
  - Interruptor `🙈 Ocultar significado` (el `summary` muestra solo la sigla) y otro para el sentido inverso (muestra el significado y oculta la sigla).
  - Chip por sigla con su estado srs (✨ nueva · 📈 · 💎). Botón `Repasar las de hoy`: abre Repaso con `repSec='siglas'`.
  - Las siglas `💎 dominadas` se pliegan en el grupo "Ya dominadas (n)", porque el glosario "cumplió su función".

### SG2 · Pares que se confunden como preguntas trampa — **P2 · S**
- **Skill:** "trampa: confusiones típicas de examen, pares parecidos" (#007, #006, #008).
- **Cambio:** con `confusiones[]` de `memoria_siglas.json` se generan tarjetas `sig:${id}#tr`: "¿Diferencia entre X e Y?" → `clave`/`diferencia`. En la vista, mostrar el par lado a lado.

---

## 9. Entrenar

### EN1 · Abiertas primero y pista solo tras fallar — **P1 · S**
- **Problema:** D5 y D6.
- **Skill:**
  - "Abiertas mejor que opción múltiple: las opciones hacen reconocer, no recordar" (#007). Abiertas para memoria, test solo para el formato (nota de conflicto de recuerdo-activo).
  - El ancla nunca antes del intento (#039).
- **Cambio en `entrenar.js`:**
  - **Siglas y Facies:** primer intento con input de texto. Se valida con `norm()` y tolerancia (Levenshtein ≤ 1 en siglas de 2-5 letras; para el significado, que contenga las palabras clave, o "sé honesto" como en el juego).
  - **Si falla:** aparecen la pista y luego las 4 opciones (2.º intento, con menos XP).
  - **Interruptor del menú** "Modo examen tipo test" para quien quiera practicar el formato.
  - **Contrarreloj y Emparejar** quedan como están, pero llevan la etiqueta "🎮 práctica de formato (no mueve tu calendario)": `srsEnt` y `srsFallo` no se llaman en esos dos juegos.

### EN2 · Juego "Ordena la clasificación" — **P2 · M**
- **Problema:** las listas y clasificaciones (interpretación de escalas, grados) no se practican en orden.
- **Skill:** listas: "identifica el número exacto de piezas" (#137), repaso en reversa (#187, #195) y la pregunta tipo `lista`, "¿cuántos…? ¿cuáles?" (#137, #039).
- **Cambio:**
  - Juego 7 en `JUEGOS`. Toma `escalas[].interpretacion` y las filas de memoria con `acronimo` o `ruta_palacio`.
  - Paso 1: "¿Cuántos elementos?" (número). Paso 2: arrastrar o tocar en orden.
  - Paso 3 al acertar: "ahora al revés".
  - Ronda de errores con el `fin()` actual.

### EN3 · Fin de ronda con retención guardada — **P2 · S**
- **Cambio:** `fin()` guarda `{juego, fecha, pct}` en `memo-semio-entrenar.hist`, para que Progreso (P1) lo muestre. El semáforo actual de 90 % y 60 % ya coincide con el skill.

---

## 10. Juego (mapa y caza)

### J1 · Reto de captura abierto por defecto — **P1 · S**
- **Problema:** D5. Capturar con 4 opciones a la vista es reconocer, no recordar.
- **Skill:** "Abiertas antes que opción múltiple" (#007). "Entre más trabajo te cueste recordar y lo logres, mayor es el beneficio" (#042).
- **Cambio:**
  - En `juego.js`, `nuevoReto(d, modo = 'escribir')`. Mismo cambio en `juego-caza.js:401`: `modo: 'escribir'`, salvo los casos clínicos (`caso`), que quedan en `elegir` porque son de formato test.
  - El botón "🔘 Ver 4 opciones" sigue disponible, pero acertar con opciones da `XP.practica`-like: la mitad de XP, y la nota srs máxima es 2 (Difícil).
  - Acertar escribiendo da el XP completo y nota 3.
  - El `fallo()` actual ya pasa a `elegir` después del error: se conserva.

### J2 · Misión diaria "Repasa tus vencidas" — **P2 · S**
- **Skill:** "El repaso es el secreto para recordar lo que estudias" (#053). La prioridad son las vencidas (repeticion-espaciada, flujo 1).
- **Cambio:** en `crearMisiones()`, si hay ≥ 5 vencidas, una de las 3 misiones es "Recaptura 5 cartas ⏰ vencidas". La ponderación de la caza ya favorece las vencidas: se mantiene.

### J3 · Pausar temporizadores en segundo plano — **P2 · S** [complemento]
- **Cambio:** con `document.visibilitychange`, pausar `arrancarReloj` y las animaciones de caza y juego si la pestaña está oculta o la vista no está activa. Ahorra batería en el móvil.

---

## 11. Ciudad (palacio de Puno)

### C1 · Paseo al revés y estación al azar — **P1 · S**
- **Problema:** D9. Solo se puede recorrer hacia adelante.
- **Skill:**
  - "Repasa hacia adelante y después hacia atrás: el recorrido inverso refuerza más" (#195, #190, #187).
  - El palacio permite "ir directo a cualquier elemento" (#148).
  - Pregunta por ubicación: "¿Qué hay en la estación 7?" (#139, #148, palacio `preguntas`).
- **Cambio en `ciudad.js`:**
  - En `lugar(sid)`, tres botones: `🚶 Adelante`, `🔙 Al revés` y `🎲 Al azar`.
  - `paseo = {sid, orden:[índices], i, revelado}`. `pasoPaseo` usa `orden[i]`.
  - En el modo al azar, la pregunta es "📍 Estación k (<ubicación>): ¿qué hay?".

### C2 · Paseo con semáforo y repaso del palacio programado — **P1 · M**
- **Problema:** el paseo no registra si recordaste y nada avisa cuándo volver a pasear.
- **Skill:**
  - "Repaso activo: aparta la vista, recorre el palacio, di el dato y luego comprueba. Si solo vuelves a mirar las notas, te engañas" (#134, #073).
  - "Espacia los repasos: … al día, a la semana y al mes" (#190, #148).
  - Hoja de carga con "Repasos [ ] 0 · [ ] +1 d · [ ] +1 sem · [ ] +1 mes" (plantilla-palacio.md).
  - "Arregla las imágenes que fallan" (#190, #195).
- **Cambio:**
  - Al revelar una estación, aparecen los botones 🔴 🟡 🟢 en lugar de "Siguiente".
  - Al terminar un lugar: resumen y `🔁 Repetir solo las fallidas (n)`. Las fallidas quedan con el enlace `✏️ Mejorar escena` (V4).
  - El resultado del lugar se califica en srs como **una tarjeta de palacio** `pal:${sid}`:
    - nota 3 si ≥ 90 % 🟢;
    - nota 2 si ≥ 60 %;
    - nota 1 si es menor.
  - Así el lugar sigue la escalera (1, 3, 7, 15 días…) y en el mapa del paseo muestra el chip `🏛️ toca repasar` o `próximo: en 7 días`.
  - Hoy (S1) lista los palacios vencidos.

### C3 · Repasar el palacio vacío — **P2 · S**
- **Skill:** "Repasa el palacio vacío, ubicación por ubicación y en orden, hasta que salga solo" (#195). "Si tienes que memorizar las ubicaciones de un palacio, entonces no es un palacio" (#132, #129).
- **Cambio:**
  - Modo `🧭 Solo el recorrido` en `lugar(sid)`: muestra "Estación k → ?" y revela solo la ubicación (`L.ruta[k]`), sin el dato.
  - Se recomienda la primera vez que se abre un lugar. Se guarda `memo-semio-ciudad.vacio[sid] = fecha`.

### C4 · Estaciones en grupos de 5 y numeración continua — **P2 · S**
- **Problema:** los lugares tienen entre 7 y 19 estaciones seguidas, sin agrupar.
- **Skill:** "Usa el mismo número de ubicaciones en todas las habitaciones… 5 por habitación: así sabes que la habitación 3 empieza en la 11" (#073, #139, #195). "Numera las estaciones de forma continua en todo el palacio" (#139, #148).
- **Cambio:**
  - En `lugar()` y en el paseo, separar visualmente cada bloque de 5 ("Tramo 1 · estaciones 1-5"). Es solo UI: no cambia `palacios.json`.
  - Mostrar el número global del recorrido ("estación 37 del paseo") junto al número local.

### C5 · Palacio propio (casa) como alternativa — **P3 · L**
- **Problema:** una ciudad es un palacio **abierto**, apto para información general. Valores exige detalle.
- **Skill:** "Regla de oro: los lugares cerrados son para la información a detalle; los abiertos, para la información general" (#129). Un lugar abierto sirve "solo si lo conoces a la perfección" (#129, #073). El palacio en tu propia casa es "más poderoso" (#195, #073).
- **Cambio:**
  - En Ciudad, `⚙️ Usar mis propios lugares`: un editor que reemplaza `lugares[sid].lugar/ruta` en `memo-semio-palacio-propio`, con 5 ubicaciones por habitación y la checklist de las 3 cualidades.
  - Las escenas oficiales siguen nombrando lugares de Puno. Hay que avisar de que la ubicación propia **sustituye solo el "dónde"**.

---

## 12. Métodos

### M1 · "Cómo estudiar con esta app" (ciclo + atajos a cada modo) — **P2 · S**
- **Problema:** Métodos es un catálogo y no explica el orden de uso.
- **Skill:** el ciclo de 5 pasos más rondas (#039), "repaso: siempre intercalado" (#057) y "no uses todas las técnicas a la vez" (#139, #143).
- **Cambio:**
  - Al inicio de Métodos, una tira de 5 pasos: Comprender → Codificar → Recuerdo activo → Rondas → Espaciar. Cada paso enlaza a su vista (Valores con 💡, panel 🧠, Repaso, Repaso de errores, Hoy).
  - Cada tarjeta de método agrega `Ver los n datos que la usan →`: Valores filtrado por `tecnicas`, con un filtro nuevo `tec` en `pintarTabla`.

### M2 · Mi tabla 00-99 — **P2 · S**
- **Skill:** "Meta: tu lista fija del 00 al 99, para no inventar la imagen cada vez" (#189, #139). "Que sean tuyas; una vez fijada, no la cambies" (tabla-00-99.md).
- **Cambio:**
  - En Métodos › Números, una cuadrícula 10×10 con `data/tabla00_99.json`. Tocar un número muestra las letras y la palabra.
  - `✏️` permite una palabra propia, guardada en `mias.js` con la clave `num:NN`. Hay que validar con `decodificar()` de `entrenar.js` que las consonantes cuadren.
  - El Gimnasio del sistema mayor usa la palabra propia si existe.

---

## 13. Transversales de comodidad

### T1 · PWA offline — **P1 · M**
- **Problema:** D12. No funciona en el transporte ni sin datos.
- **Skill:** repasar en **tiempos muertos**: transporte, filas, pausas (#020, #049, #073). "Practicar en el teléfono en tiempos muertos" (#008, #020).
- **Cambio:**
  - **`manifest.webmanifest`:** `name`, `short_name: "Memo Semio"`, `start_url: "./"`, `display: "standalone"`, colores del tema e íconos 192 y 512 en `img/icon-*.png` (se pueden generar del avatar).
  - **`sw.js`:**
    - Precache del app shell: `index.html`, `css/*.css`, `js/*.js` y `data/*.json`.
    - Runtime cache-first para `img/**`.
    - Stale-while-revalidate para `data/*.json`, para que una publicación nueva llegue sin romper.
    - Leaflet de unpkg y las teselas, con caché best-effort; si no hay red, Juego muestra `mostrarSinMapa()`, que ya existe.
    - Versionar `CACHE = 'memo-v<fecha>'`.
  - **`app.js`:** registrar el SW y mostrar un aviso discreto "Hay una versión nueva · Recargar".
  - **`index.html`:** `<link rel="manifest">`, `theme-color` y `apple-touch-icon`.

### T2 · Ajustes: tamaño de letra, modo lectura, estudio — **P1 · S** [complemento, salvo lo marcado]
- **Problema:** con tipografía de 13-15 px, leer escenas largas en el móvil cansa. No hay dónde configurar el estudio.
- **Cambio:**
  - **`js/ajustes.js`** y un botón `⚙️` junto a 🌓. Clave `memo-semio-ajustes`.
  - **Letra:** `A− / A / A+ / A++` cambia `--fs` en `:root`. `body { font-size: var(--fs, 15px) }` y las demás medidas en `em`/`rem` en las clases de texto (`.escena`, `.tarjeta .q`, `.fila-cab > div`).
  - **Modo lectura:** `body.lectura` sube el interlineado a 1.7, limita el ancho a 70ch, oculta las imágenes decorativas y quita el blur de fondo.
  - **Reducir animaciones:** hereda `prefers-reduced-motion` y se puede forzar. Juego y Entrenar ya tienen `sinMov()`: lo leen de aquí.
  - **Estudio:** nuevas por día (10/15/20/30), día de repaso semanal (R9), duración de bloques (S2), fecha de examen (E1) y "permitir nuevas de temas no estudiados" (V1).

### T3 · Atajos de teclado — **P2 · S** [complemento]
- **Cambio:**
  - `/` enfoca la búsqueda.
  - `g` seguido de una letra cambia de pestaña: `h` hoy, `v` valores, `r` repaso, `e` escalas, `p` progreso.
  - `?` abre una capa con todos los atajos.
  - En Repaso: Espacio revela, 1-4 califican, `P` pista (R3), `E` abre "Mi versión" (V4).
  - `Esc` cierra el visor de imagen y los editores.
  - Se ignora todo atajo si el foco está en un input o textarea, salvo Ctrl+Enter.

### T4 · Navegación móvil — **P2 · M** [complemento]
- **Problema:** 10 pestañas con scroll horizontal oculto (`scrollbar-width: none`) en 360 px. Repaso y Progreso quedan fuera de la vista.
- **Cambio:**
  - Con `max-width: 760px`, una barra inferior fija con 5 botones: `🏠 Hoy · 📋 Valores · 🔁 Repaso (badge) · 🎮 Juego · ☰ Más`.
  - "Más" abre una hoja con las demás pestañas.
  - En escritorio se mantienen las pestañas.
  - Respetar `env(safe-area-inset-bottom)`.

### T5 · Accesibilidad — **P2 · S** [complemento]
- **Cambio:**
  - **Pestañas:** `role="tab"`, `aria-selected`, `aria-controls="v-…"` y navegación con flechas. `role="tabpanel"` en las secciones.
  - **Foco:** `:focus-visible` con un contorno de 2 px en `--accent`.
  - **Avisos y paneles:** el feedback de acierto o error va en un `aria-live="polite"` (Repaso, Entrenar y Juego). El botón `memo-btn` lleva `aria-expanded`.
  - **Contraste e imágenes:** `.memo-btn[disabled]` tiene opacidad 0.35; subirla a 0.55 por contraste. Agregar `alt` descriptivo a las imágenes de escena (hoy `alt=""` en Repaso y Ciudad): usar `m.ancla`.
  - **Visor:** botón de cerrar visible, `Esc` y foco atrapado.

### T6 · Rendimiento en móvil — **P2 · S** [complemento]
- **Cambio:**
  - V5 (render perezoso de los paneles) y `content-visibility`.
  - `decoding="async"` en las imágenes.
  - `fetch` de `casos.json` y `ruta_diaria.json` solo al abrir Juego o Repaso con casos.
  - Medir con Lighthouse móvil antes y después. Meta: TBT < 200 ms en Valores.

### T7 · Respaldo completo y recordatorio — **P1 · S** [complemento]
- **Problema:** D11. Con V4 y E1 habría datos personales valiosos que hoy no se exportan.
- **Cambio:**
  - **`js/respaldo.js`:** `exportar()` junta todas las claves `memo-semio-*` en `{version: 2, fecha, datos: {clave: valor}}`. `importar()` acepta este formato y el viejo, que solo traía srs.
  - **Recordatorio:** si pasaron más de 7 días desde el último export, aviso discreto en Hoy: "💾 Respalda tu progreso".
  - **Botón** también en Ajustes.

---

## 14. Resumen de prioridades

**P1 (21):** R1, R2, R3, R4, R5 · E1, E2 · S1 · P1 · V1, V2, V4 · ES1 · F1 · SG1 · EN1 · J1 · C1, C2 · T1, T2, T7.

**P2:** R6, R7, R8, R9 · E3 · S2 · P2 · V3, V5 · ES2 · F2 · SG2 · EN2, EN3 · J2, J3 · C3, C4 · M1, M2 · T3, T4, T5, T6.

**P3:** R10, R11 · P3 · F3 · C5.

---

## 15. Reparto sugerido (paquetes independientes por archivo)

### Paso 0 · Coordinador (antes de lanzar los paquetes, unos 45 min)
Este paso evita que dos agentes editen `app.js` o `index.html` a la vez.
1. **Extraer módulos de `app.js`:**
   - Mover Repaso (`construirTarjetas`, `armarCola`, `pintarRepaso`, `calificar`, keydown) a **`js/repaso.js`** con `export function crearRepaso({ATLAS, MEMO, SIGLAS, FACIES, CASOS, srs, raiz, alPendientes})`, que devuelve `{pintar, tarjetas, pendientes}`.
   - Mover Progreso a **`js/progreso.js`** (`crearProgreso({..., tarjetas})`).
   - Mover Valores, Escalas, Facies, Métodos y Siglas a **`js/vistas.js`** (`crearVistas({...})`, que devuelve `{tabla, escalas, facies, metodos, siglas}`).
   - Sin cambiar comportamiento. `app.js` queda solo con carga de datos, navegación y eventos globales.
2. **Crear stubs vacíos con la API acordada:**
   - `js/plan.js`: `cargar()`, `guardar(p)`, `marcarEstudiada(sid)`, `estudiada(sid)`, `hoyToca()`, `faseSimulacro()`, `topeDue(ms)`.
   - `js/mias.js`: `get(ref)`, `set(ref, obj)`, `todas()`.
   - `js/ajustes.js`: `get(k)`, `set(k, v)`, `alCambiar(fn)`.
   - `js/hoy.js`: `crearHoy({...})`.
   - `js/respaldo.js`: `exportar()`, `importar(txt)`.
3. **En `index.html`:**
   - Agregar la pestaña `🏠 Hoy` y `<section id="v-hoy">`.
   - Agregar los `<link>` a los CSS nuevos: `css/repaso.css`, `css/vistas.css` y `css/ajustes.css`.
   - Agregar el `<link rel="manifest">`, que en ese momento todavía apunta a un archivo vacío.
4. Registrar estas APIs en `tools/CONTRATOS.md`.

### Paquete A · Repaso, Progreso, plan de examen y sesión guiada
- **Archivos (exclusivos):** `js/srs.js`, `js/repaso.js`, `js/progreso.js`, `js/plan.js`, `js/hoy.js` y `css/repaso.css`.
- **Mejoras:** R1, R2, R3, R4, R5, R7, R8, R9 · E1, E2, E3 · S1, S2 · P1, P2 · R6 (la parte de srs y repaso; el script de ids es de Python y va en `tools/`).
- **Contratos que respeta:**
  - `srs.calificar(id, nota, {fuente})` sigue siendo compatible: D no cambia nada.
  - Lee `mias.get(ref)` para la pista y `ajustes.get('nuevasDia')`.
  - Escala el `pal:${sid}` que llega desde Ciudad (C2) como una tarjeta más.

### Paquete B · Vistas de contenido: Valores, Escalas, Facies, Siglas y Métodos
- **Archivos (exclusivos):** `js/vistas.js`, `js/mias.js`, `css/vistas.css`, `data/memoria*.json` (solo agregar `pid`) y `tools/ids_preguntas.py` + `tools/validar_memoria.py`.
- **Mejoras:** V1 (UI del botón "estudiada", llamando a `plan.marcarEstudiada`), V2, V3, V4, V5 · ES1, ES2 (la generación de tarjetas se entrega como `export function tarjetasExtra(ATLAS)` en `vistas.js`, que A importa) · F1, F2 · SG1, SG2 · M1, M2 · R6 (los `pid` en los datos).
- **Contratos:** es dueño de `mias.js`. No toca `srs.js`: solo lo lee con `srs.info` y `srs.nivel`.

### Paquete C · Transversal: PWA, ajustes, accesibilidad, navegación y respaldo
- **Archivos (exclusivos):** `index.html`, `css/app.css`, `css/ajustes.css`, `sw.js` (nuevo), `manifest.webmanifest` (nuevo), `img/icon-*.png`, `js/ajustes.js`, `js/respaldo.js` y `js/app.js` (solo registro del SW, atajos globales, la barra móvil y el botón ⚙️).
- **Mejoras:** T1, T2, T3, T4, T5, T6 (la parte global de CSS y fetch perezoso), T7.
- **Contratos:**
  - Expone `ajustes` y la variable CSS `--fs`.
  - Los demás paquetes no editan `app.css`: ponen sus reglas en su propio CSS.
  - La lista de precache de `sw.js` se genera leyendo `js/` y `css/` en el build manual (`tools/precache.py`), para no tener que coordinar nombres.

### Paquete D · Ciudad, Entrenar y Juego
- **Archivos (exclusivos):** `js/ciudad.js`, `js/entrenar.js`, `css/entrenar.css`, `js/juego.js`, `js/juego-caza.js`, `js/juego-estado.js` y `css/juego.css`.
- **Mejoras:** C1, C2, C3, C4 (C5 más adelante) · EN1, EN2, EN3 · J1, J2, J3.
- **Contratos:**
  - Usa `srs.calificar(id, nota, {fuente:'juego'|'caza'|'entrenar'|'palacio'})`.
  - C2 califica `pal:${sid}`.
  - Lee `mias.get(ref)` para las pistas.
  - Lee `ajustes.get('reducirMov')` en `sinMov()`.

**Orden recomendado:** Paso 0 → A, B, C y D en paralelo → integración final del coordinador. La integración cubre: probar en 360 px y en oscuro, revisar la consola, comprobar que `vistas.tarjetasExtra` entra en `repaso.js` y que Hoy enlaza bien a cada vista.
