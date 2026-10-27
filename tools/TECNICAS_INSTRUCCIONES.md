# Atlas de técnicas + actualización de data/metodos.json

App: Memo Semiología (`C:\PROGRAMACION\memo-semiologia`). La pestaña "Métodos" muestra `data/metodos.json`
(una entrada por skill `estudio-*`). Los skills acaban de subir de versión (v2/v4) con 112 videos nuevos:
`C:\Users\User\.claude\skills\estudio-<clave>\` (SKILL.md, fuentes.md y archivos de apoyo).
Claves de metodos.json → carpeta del skill: memorizar-numeros, palacio-memoria, mnemotecnia, visualizacion-imagenes,
memorizar-conceptos, memorizar-listas, memorizar-textos-literal, memorizar-nombres, recuerdo-activo,
repeticion-espaciada, flashcards (carpeta `estudio-<clave>`).

## Tarea 1 — actualizar la entrada del método
Por cada método asignado escribe `data/metodos_parts/<clave>.json` = `{ "<clave>": { ...entrada } }` partiendo de la
entrada actual de `data/metodos.json` (MISMAS claves de campo: icono, nombre, resumen, que, como_funciona, pasos[],
cuando[], cuando_no[], ejemplo_video, ejemplo_atlas{id,texto}, errores[], consejos[], combina_con[], fuentes,
version_skill) y actualizándola con el SKILL.md nuevo: pasos, cuándo/no, errores, consejos, ejemplo_video y fuentes
(lista de #NNN). `version_skill` = número de la versión nueva ("2", "4"…). Conserva `icono`, `ejemplo_atlas` y el tono.
Textos breves y accionables (pasos ≤ 12, cada ítem ≤ 220 caracteres). Cita #NNN cuando un paso sale de un video.
`combina_con` solo con claves de la lista de arriba.

## Tarea 2 — ejemplos ilustrados del atlas de técnicas
Escribe `data/tecnicas_parts/<clave>.json` = lista de 4 ejemplos (5 como máximo) por método:
```json
{
  "id": "pal-casa-35",                 // kebab, único, prefijo corto del método
  "metodo": "palacio-memoria",
  "tecnica": "Palacio desde cero",     // nombre corto de la técnica concreta
  "titulo": "Una casa de 7 habitaciones × 5 lugares",
  "origen": "video",                   // "video" (sale literal de un video) o "aplicacion" (dato médico aplicado)
  "fuente": "#191",                    // videos que lo respaldan (para aplicacion: los del método que aplica)
  "dato": "Qué hay que recordar (la información en sí)",
  "como": "Cómo se arma, en 2-4 frases: la imagen/código/ruta y por qué funciona.",
  "pasos": ["3 a 5 pasos cortos para hacerlo uno mismo"],
  "recuerda": "Una línea: la respuesta que la imagen devuelve (p. ej. 'Litio, Sodio, Potasio…')",
  "imagen_prompt": "Escena en español para el ilustrador (ver reglas)"
}
```
Mezcla: unos 2 ejemplos `video` (los más claros de los videos, con sus datos literales: Alejandra = salamandra,
metales alcalinos, casa de 35 ubicaciones, cajas de Leitner, Dragon Ball, etc.) y 2 `aplicacion` con MEDICINA de
semiología (signos vitales, laboratorio, escalas, signos epónimos, síndromes). Datos médicos SOLO si estás seguro de
que son correctos (valores clásicos de libro). Nada de diagnósticos dudosos.

### Reglas del imagen_prompt
- 60-120 palabras, en español. Describe UNA escena concreta: protagonista, acción exagerada, objetos-símbolo, lugar.
- PROHIBIDO pedir texto, letras, números escritos, rótulos o siglas dentro de la imagen (el modelo los escribe mal).
  Los números se representan con objetos (el sistema mayor), los conceptos con íconos.
- Para métodos de proceso (recuerdo activo, espaciada, flashcards) dibuja la ESCENA del proceso (un estudiante
  tapando respuestas con tarjetas de colores, cajas de Leitner como cajones con tarjetas avanzando, un calendario
  hecho de escalones…) sin texto.
- Para mnemotecnogramas (#168): "dibujo mnemotécnico simple: una figura humana con íconos pegados en partes del
  cuerpo…" describiendo cada ícono.
- Sin gore ni desnudos. El estilo lo pone el script (cómic educativo, colores vivos): no lo describas.

## Reglas
- No inventes técnicas: todo sale de los SKILL.md/fuentes.md (o de las fichas
  `C:\PROGRAMACION\VIDEOS YOUTUBE\output\pablo_lomeli\metodos\fichas\NNN.md`).
- Toca SOLO tus archivos en data/metodos_parts y data/tecnicas_parts. Valida con
  `py -c "import json;json.load(open('<archivo>',encoding='utf8'))"`.
- Responde al final: archivos escritos y la lista de ids con su título (una línea cada uno).
