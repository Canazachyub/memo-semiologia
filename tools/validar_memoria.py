# -*- coding: utf-8 -*-
"""Valida data/memoria.json: ids existentes, campos mínimos y que cada palabra del código
decodifique su número con el sistema mayor (versión en español usada en el skill).
También valida los `pid` de pregunta (R6) en memoria.json, memoria_siglas.json y
memoria_facies.json: toda pregunta debe tener pid y no puede repetirse dentro de la ficha
(el id de tarjeta es `<ref>#<pid>`). Avisa si a una facies le falta la pregunta inversa (F2).
Uso: py tools/validar_memoria.py [archivo.json]
     (con un archivo distinto de memoria.json, por ejemplo un lote de memoria_parts, la falta de
     pid es solo aviso: se asigna con py tools/ids_preguntas.py)
"""
import json
import os
import re
import sys
import unicodedata

sys.stdout.reconfigure(encoding="utf-8")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
atlas = json.load(open(os.path.join(RAIZ, "data", "atlas.json"), encoding="utf-8"))
RUTA = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, "data", "memoria.json")
memo = json.load(open(RUTA, encoding="utf-8"))
metodos = json.load(open(os.path.join(RAIZ, "data", "metodos.json"), encoding="utf-8"))
ids = {f["id"] for s in atlas["secciones"] for f in s["filas"]} | {e["id"] for e in atlas["escalas"]}


def sin_tildes(t):
    return "".join(c for c in unicodedata.normalize("NFD", t.lower()) if unicodedata.category(c) != "Mn")


def decodificar(palabra):
    """Palabra → dígitos (sistema mayor). Devuelve None si tiene letras ambiguas (y, x, w)."""
    w = sin_tildes(palabra).replace(" ", "")
    if re.search(r"[xyw]", w):
        return None
    out, i = [], 0
    while i < len(w):
        c, n = w[i], w[i + 1] if i + 1 < len(w) else ""
        if c + n in ("ch",):
            out.append("6"); i += 2; continue
        if c + n in ("rr", "ll"):
            out.append("4" if c == "r" else "5"); i += 2; continue
        if c + n == "qu":
            out.append("7"); i += 2; continue
        if c in "sz" or (c == "c" and n in "ei"):
            out.append("0")
        elif c in "td":
            out.append("1")
        elif c in "nñ":
            out.append("2")
        elif c == "m":
            out.append("3")
        elif c == "r":
            out.append("4")
        elif c == "l":
            out.append("5")
        elif c == "j" or (c == "g" and n in "ei"):
            out.append("6")
        elif c in "ckq" or c == "g":
            out.append("7")
        elif c in "fv":
            out.append("8")
        elif c in "pb":
            out.append("9")
        i += 1
    return "".join(out)


errores, avisos = [], []
for k, m in memo.items():
    if k not in ids:
        errores.append(f"{k}: id no existe en atlas.json")
    for campo in ("tipo_info", "tecnicas", "escena", "preguntas"):
        if not m.get(campo):
            errores.append(f"{k}: falta '{campo}'")
    if len(m.get("preguntas") or []) < 2:
        avisos.append(f"{k}: menos de 2 preguntas")
    for t in m.get("tecnicas") or []:
        if t not in metodos:
            avisos.append(f"{k}: técnica '{t}' no está en metodos.json")
    for c in m.get("codigo") or []:
        num = re.sub(r"\D", "", str(c.get("numero", "")))
        dec = decodificar(c.get("palabra", ""))
        if dec is None:
            avisos.append(f"{k}: '{c.get('palabra')}' tiene letras ambiguas, revisar a mano ({num})")
        elif dec != num:
            errores.append(f"{k}: '{c.get('palabra')}' decodifica {dec}, no {num}")
    est = m.get("estacion")
    if not est:
        avisos.append(f"{k}: sin estación del palacio de Puno")
    img = m.get("imagen")
    if img and not os.path.exists(os.path.join(RAIZ, img)):
        errores.append(f"{k}: imagen no encontrada {img}")


# ---------- R6: pid estables ----------
ES_FINAL = os.path.abspath(RUTA) == os.path.abspath(os.path.join(RAIZ, "data", "memoria.json"))
PID_OK = re.compile(r"^[A-Za-z0-9_-]{2,24}$")


def validar_pids(nombre, entradas, falta_es_error=True):
    vistos = {}
    for ref, e in entradas.items():
        if not isinstance(e, dict):
            continue
        locales = set()
        for i, p in enumerate(e.get("preguntas") or []):
            pid = p.get("pid") if isinstance(p, dict) else None
            if not pid:
                (errores if falta_es_error else avisos).append(
                    f"{nombre} · {ref}: la pregunta {i} no tiene pid (corre py tools/ids_preguntas.py)")
                continue
            if not PID_OK.match(str(pid)):
                errores.append(f"{nombre} · {ref}: pid inválido '{pid}' (solo letras, números, _ y -)")
            if pid in ("n", "cz", "inv", "tr"):
                errores.append(f"{nombre} · {ref}: pid '{pid}' está reservado para tarjetas generadas")
            if pid in locales:
                errores.append(f"{nombre} · {ref}: pid repetido '{pid}'")
            locales.add(pid)
            if pid in vistos and vistos[pid] != ref:
                avisos.append(f"{nombre}: pid '{pid}' se usa en {vistos[pid]} y en {ref}")
            vistos.setdefault(pid, ref)


validar_pids(os.path.basename(RUTA), memo, falta_es_error=ES_FINAL)
if ES_FINAL:
    for nombre in ("memoria_siglas.json", "memoria_facies.json"):
        ruta = os.path.join(RAIZ, "data", nombre)
        if os.path.exists(ruta):
            validar_pids(nombre, json.load(open(ruta, encoding="utf-8")))
    # F2: preguntas en los dos sentidos para facies (rasgo → nombre)
    ruta = os.path.join(RAIZ, "data", "memoria_facies.json")
    if os.path.exists(ruta):
        for k, f in json.load(open(ruta, encoding="utf-8")).items():
            if not any((p.get("tipo") == "inversa") for p in f.get("preguntas") or []):
                avisos.append(f"memoria_facies.json · {k}: falta la pregunta inversa (rasgo → nombre); la app genera fac:{k}#inv")

print(f"{len(memo)} entradas · {len(errores)} errores · {len(avisos)} avisos")
for e in errores:
    print("  ✗", e)
for a in avisos:
    print("  ·", a)
sys.exit(1 if errores else 0)
