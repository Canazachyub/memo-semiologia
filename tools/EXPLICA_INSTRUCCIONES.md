# Explicación real de cada carta (campo `explica`)

Objetivo: que cada carta del juego enseñe la REALIDAD del dato, no solo la mnemotecnia:
por qué ocurre el fenómeno (fisiología/fisiopatología) y un ejemplo clínico concreto.

## Fuentes (en este orden)
1. Vault del usuario: `C:\Users\User\Documents\CEREBRO DIGITAL\MEDICINA UNAP\MEDICINA UNAP\`
   (sobre todo `outputs\SEMIOLOGIA\` — resumenes, bancos, complementos, resumen-valores — y las notas de clase).
   Busca con Grep por el nombre del parámetro y sinónimos.
2. Solo si el vault no lo explica: semiología/fisiología estándar (Argente-Álvarez, Surós, Guyton, Harrison).
   NUNCA inventes cifras: los valores del ejemplo deben ser coherentes con los del atlas (`data/atlas.json`).

## Formato de salida
Un JSON `data/explica_parts/<grupo>.json` (UTF-8, sin BOM):
```json
{
  "<id de la fila o escala>": {
    "porque": "2-4 oraciones: qué mide/representa y el MECANISMO de por qué sube, baja o se altera.",
    "ejemplo": "Mini-caso de 2-3 oraciones con datos concretos (edad, contexto, valor) y qué se concluye. Si cabe, ambientado en Puno/altura.",
    "origen": "vault | literatura | mixto",
    "nota": "ruta relativa dentro del vault de la nota usada (o null)"
  }
}
```
Reglas de estilo: español claro de estudiante de Medicina, sin viñetas dentro de los textos, sin markdown,
máximo ~380 caracteres por campo. No repitas el valor normal tal cual (ya se muestra); explica el porqué.
Escalas: `porque` = qué evalúa, cómo se puntúa y por qué importa; `ejemplo` = paciente con una puntuación concreta e interpretación.
Si un dato del vault contradice la literatura, sigue el vault y agrégalo al final de `porque` entre corchetes: [vault difiere de literatura: …].

Valida al terminar: `py -c "import json;d=json.load(open('data/explica_parts/<grupo>.json',encoding='utf-8'));print(len(d))"`
y que estén TODOS los ids pedidos.
