# -*- coding: utf-8 -*-
"""Une data/explica_parts/*.json en data/explica.json (la realidad de cada carta: por qué pasa + ejemplo clínico).
Valida que cada id exista en el atlas y avisa de los que faltan. Uso: py tools/unir_explica.py
"""
import glob, json, os, sys
sys.stdout.reconfigure(encoding="utf-8")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
atlas = json.load(open(os.path.join(RAIZ, "data", "atlas.json"), encoding="utf-8"))
ids = [f["id"] for s in atlas["secciones"] for f in s["filas"]] + [e["id"] for e in atlas["escalas"]]
todo, errores = {}, []
for p in sorted(glob.glob(os.path.join(RAIZ, "data", "explica_parts", "*.json"))):
    for k, x in json.load(open(p, encoding="utf-8")).items():
        if k not in ids:
            errores.append(f"{os.path.basename(p)}: id '{k}' no existe en el atlas")
            continue
        if not x.get("porque") or not x.get("ejemplo"):
            errores.append(f"{k}: falta porque o ejemplo")
        todo[k] = {c: x.get(c) for c in ("porque", "ejemplo", "origen", "nota")}
json.dump({k: todo[k] for k in ids if k in todo}, open(os.path.join(RAIZ, "data", "explica.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
faltan = [k for k in ids if k not in todo]
print(f"explica.json: {len(todo)}/{len(ids)} cartas · {len(errores)} errores · faltan {len(faltan)}")
for e in errores:
    print("  ✗", e)
