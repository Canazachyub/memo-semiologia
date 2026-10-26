# -*- coding: utf-8 -*-
"""R6 · Ids estables de pregunta (pid).

Agrega `pid` a cada pregunta que no lo tenga en:
  - data/memoria_parts/*.json   (luego hay que regenerar data/memoria.json con tools/unir_memoria.py)
  - data/memoria_siglas.json
  - data/memoria_facies.json

El pid se calcula UNA sola vez como hash corto de (ref + texto de la pregunta): "q" + 7 hex.
Una vez asignado no se recalcula aunque cambie la pregunta: así una pregunta editada conserva
su historial de repaso. Para una pregunta nueva, déjala sin pid y vuelve a correr el script.
Si dos preguntas de la misma ficha colisionan, se agrega un sufijo.

Uso: py tools/ids_preguntas.py            (escribe los archivos)
     py tools/ids_preguntas.py --revisar  (solo informa qué faltaría)
"""
import glob
import hashlib
import json
import os
import sys
import unicodedata

sys.stdout.reconfigure(encoding="utf-8")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOLO_REVISAR = "--revisar" in sys.argv


def norm(t):
    t = unicodedata.normalize("NFD", str(t or "").lower())
    return " ".join("".join(c for c in t if unicodedata.category(c) != "Mn").split())


def nuevo_pid(ref, q, usados):
    base = "q" + hashlib.sha1(f"{ref}|{norm(q)}".encode("utf-8")).hexdigest()[:7]
    pid, k = base, 2
    while pid in usados:
        pid, k = f"{base}{k}", k + 1
    return pid


def asignar(entradas):
    """entradas: dict ref -> entrada con 'preguntas'. Devuelve cuántos pid se agregaron."""
    n = 0
    for ref, e in entradas.items():
        if not isinstance(e, dict):
            continue
        preguntas = e.get("preguntas") or []
        usados = {p["pid"] for p in preguntas if isinstance(p, dict) and p.get("pid")}
        for p in preguntas:
            if isinstance(p, dict) and not p.get("pid"):
                p["pid"] = nuevo_pid(ref, p.get("q"), usados)
                usados.add(p["pid"])
                n += 1
    return n


def procesar(ruta):
    crudo = open(ruta, encoding="utf-8", newline="").read()
    datos = json.loads(crudo)
    n = asignar(datos)
    if n and not SOLO_REVISAR:
        # conserva el formato del archivo: sangría, fin de línea y salto final
        lineas = crudo.splitlines()
        indent = len(lineas[1]) - len(lineas[1].lstrip(" ")) if len(lineas) > 1 else 2
        eol = "\r\n" if "\r\n" in crudo else "\n"
        texto = json.dumps(datos, ensure_ascii=False, indent=indent or 2).replace("\n", eol)
        if crudo.endswith("\n"):
            texto += eol
        with open(ruta, "w", encoding="utf-8", newline="") as f:
            f.write(texto)
    print(f"{os.path.relpath(ruta, RAIZ)}: {n} pid {'faltan' if SOLO_REVISAR else 'nuevos'}")
    return n


total = 0
for p in sorted(glob.glob(os.path.join(RAIZ, "data", "memoria_parts", "*.json"))):
    total += procesar(p)
for nombre in ("memoria_siglas.json", "memoria_facies.json"):
    total += procesar(os.path.join(RAIZ, "data", nombre))
print(f"Total: {total}." + ("" if SOLO_REVISAR or not total else " Regenera data/memoria.json con: py tools/unir_memoria.py"))
