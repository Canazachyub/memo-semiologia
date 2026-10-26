# Instrucciones: generar la capa de memoria de un lote del atlas

Eres el orquestador `atlas-memoria` aplicado a un lote de datos de la app **Memo Semiología** (`C:\PROGRAMACION\memo-semiologia`).

## 1. Lee primero (obligatorio)
- `C:\Users\User\.claude\skills\atlas-memoria\SKILL.md`, `esquema-memoria.md`, `personajes.md` y `estilo-imagenes.md`.
- `C:\Users\User\.claude\skills\estudio-visualizacion-imagenes\SKILL.md` y `guia-imagen-prompt.md`: **base de toda escena**.
- `C:\Users\User\.claude\skills\estudio-memorizar-numeros\SKILL.md` y `tabla-00-99.md`: **usa SIEMPRE la palabra de la tabla** para cada par (columna Videos si existe; si no, Propuesta). No inventes otra palabra para un número que ya tiene una.
- `C:\Users\User\.claude\skills\estudio-recuerdo-activo\redactar-preguntas.md`: cómo redactar las preguntas.
- Según el tipo de dato de tu lote, lee también el SKILL.md de los métodos que vayas a usar: `estudio-mnemotecnia`, `estudio-memorizar-listas`, `estudio-memorizar-conceptos`, `estudio-memorizar-nombres`, `estudio-palacio-memoria`, `estudio-memorizar-textos-literal`.

## 2. Tus datos
`C:\PROGRAMACION\memo-semiologia\data\atlas.json`
- Las filas de tus secciones están en `secciones[].filas[]` (id, parametro, normal, altura, sube, baja, clave, perla, nota).
- Las escalas están en `escalas[]` (id, nombre, items, interpretacion, perla).

## 3. Qué producir
Un archivo JSON `C:\PROGRAMACION\memo-semiologia\data\memoria_parts\<lote>.json` con forma `{ "<id>": entrada, ... }`, con **una entrada por cada fila o escala de tu lote**, siguiendo `esquema-memoria.md`.

Campos extra:
- `"imagen_clave": true|false`: marca con `true` aproximadamente **1 de cada 3** datos (los más preguntados en exámenes de semiología o los que más cuestan). Esos son los que tendrán ilustración generada.
- `"imagen_prompt"`: **en todas las entradas**, siguiendo `guia-imagen-prompt.md` + `estilo-imagenes.md`. Sin texto ni números escritos en la imagen; usa los personajes de `personajes.md`.
- `"imagen": null`: lo llena el pipeline de imágenes.

## 3b. Ciudad-palacio de Puno (obligatorio)
`C:\PROGRAMACION\memo-semiologia\data\palacios.json` asigna cada sección a un lugar real de Puno, con una ruta ordenada de micro-ubicaciones.
- El dato número k de la sección (en el orden de `atlas.json`, empezando en 0) va en la micro-ubicación `ruta[k]` de su lugar.
- Agrega a cada entrada `"estacion": { "seccion": "<s1…s12|escalas>", "n": k, "ubicacion": "<texto de ruta[k]>" }`.
- **La escena OCURRE en esa ubicación**. Por ejemplo: "En la camilla de triaje del Hospital Regional, Cora el corazón boxeador…". Así el paseo por Puno recorre el atlas en orden.
- Si el lugar tiene relación con el dato (el plátano del potasio en el puesto de plátanos del mercado), aprovéchala. Si no la tiene, la escena igual pasa ahí.
- `ruta_palacio` (lista de `{lugar, imagen}`) solo se usa si **un mismo dato** tiene una lista larga (más de 6 elementos). En ese caso, sus sub-ubicaciones son detalles de la misma estación (izquierda, derecha, arriba, abajo; ver "pilar" en estudio-palacio-memoria).
- En `imagen_prompt`, describe el lugar de Puno de forma reconocible pero genérica (por ejemplo, "plaza andina con catedral de piedra", "islas flotantes de totora en un lago azul de altura", "malecón junto a un lago andino").

## 4. Reglas de contenido
- **El dato médico es sagrado.** `dato_a_recordar` se arma solo con lo que dice la fila. No agregues ni corrijas valores. Si la fila trae texto marcado `lit: true`, puedes usarlo, pero anota en `por_que` que es literatura.
- Elige lo que **realmente hay que memorizar**: normal y umbrales casi siempre, y 1 o 2 causas clave de "sube" o "baja" si son preguntables. No intentes meter toda la fila en una escena.
- **Escena**: 2 a 5 frases en español, en segunda persona o presente vívido. Debe ser exagerada, con movimiento y sentidos, y **ligada al significado clínico**. Cumple el checklist de calidad de estudio-visualizacion-imagenes.
- **Código**: cada palabra debe decodificar **exactamente** el número con el sistema mayor de la tabla. Rangos de menor a mayor. Decimales según la regla del skill de números.
- **Ancla**: una línea corta y pegajosa.
- **Preguntas**: de 2 a 4 por entrada (directa, umbral, inversa o caso) con respuesta breve. Agrega `"tipo"` a cada una.
- **Personajes**: usa el personaje del sistema de `personajes.md`. Si tu lote necesita uno nuevo, créalo, defínelo dentro de `por_que` y repórtalo al final.
- Si dudas de algo, pon `"revisar": true` y explica la duda en `por_que`.

## 5. Antes de terminar
Corre `py C:\PROGRAMACION\memo-semiologia\tools\validar_memoria.py data\memoria_parts\<lote>.json` desde `C:\PROGRAMACION\memo-semiologia` y **corrige hasta 0 errores**. Los avisos de letras ambiguas revísalos a mano.

No modifiques ningún otro archivo: ni atlas.json, ni los skills, ni otros lotes.

## 6. Responde al final con
- Cuántas entradas hiciste y cuántas con `imagen_clave`.
- Personajes nuevos, si creaste alguno.
- Palabras de 3 dígitos o más que usaste fuera de la tabla, para agregarlas a la tabla global.
- Las entradas con `revisar: true` y su motivo.
