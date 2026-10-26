# 🧠 Memo Semiología · Valores

App web para **memorizar** los valores de la historia clínica (signos vitales, hemograma, bioquímica, ECG, Rx, gases, líquidos), las escalas clínicas y las facies. No basta con leer la tabla.

- **📋 Valores:** Normal / Si sube / Si baja / clave clínica. Cada dato trae **🧠 Cómo recordarlo**: la técnica elegida y por qué, el código de números (sistema mayor), la escena, el ancla y la imagen.
- **🙈 Autoexamen:** oculta los valores y los revela con un toque.
- **🔁 Repaso:** recuerdo activo con repetición espaciada. El progreso se guarda en el navegador y se puede exportar o importar.
- **📊 Progreso** por sección. **🧩 Métodos:** qué técnica se usa y de qué video sale.

## Datos
- `data/atlas.json`: se genera desde el vault con `py tools/build_data.py`. **No se edita a mano.**
- `data/memoria.json`: capa de memoria. La genera el skill `atlas-memoria` con los sub-skills `estudio-*`.
- `data/metodos.json`: catálogo de técnicas.
- Texto *gris con lit.*: completado con literatura estándar; no está en la teoría del curso.

## Scripts
```bash
py tools/build_data.py        # vault → data/atlas.json (+ imágenes de facies)
py tools/optimizar_img.py     # png/jpg → webp liviano (requiere Pillow)
py tools/validar_memoria.py   # revisa memoria.json (ids, campos, sistema mayor)
py -m http.server 8765        # probar en http://127.0.0.1:8765
```

> Material de estudio personal. No reemplaza la bibliografía del curso; los valores de referencia varían según el laboratorio y la altitud (Puno, 3800 m).
