# -*- coding: utf-8 -*-
"""Une data/casos_parts/*.json en data/casos.json y valida ids, opciones y respuesta.
Uso: py tools/unir_casos.py
"""
import glob, json, os, sys
sys.stdout.reconfigure(encoding="utf-8")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
atlas = json.load(open(os.path.join(RAIZ, "data", "atlas.json"), encoding="utf-8"))
ids = {f["id"] for s in atlas["secciones"] for f in s["filas"]} | {e["id"] for e in atlas["escalas"]}
casos, errores = {}, []
for p in sorted(glob.glob(os.path.join(RAIZ, "data", "casos_parts", "*.json"))):
    for k, c in json.load(open(p, encoding="utf-8")).items():
        if k in casos:
            errores.append(f"{k}: id repetido")
        if len(c.get("opciones", [])) != 4 or not 0 <= c.get("correcta", -1) <= 3:
            errores.append(f"{k}: opciones/correcta inválidas")
        for d in c.get("datos_ids", []):
            if d not in ids:
                errores.append(f"{k}: dato '{d}' no existe")
        casos[k] = c
json.dump(casos, open(os.path.join(RAIZ, "data", "casos.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"casos.json: {len(casos)} casos · {len(errores)} errores")
for e in errores:
    print("  ✗", e)
