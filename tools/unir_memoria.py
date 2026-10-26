# -*- coding: utf-8 -*-
"""Une data/memoria_parts/*.json en data/memoria.json y enlaza las imágenes existentes
(img/memo/<id>.webp). Uso: py tools/unir_memoria.py
"""
import glob
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
memo = {}
for p in sorted(glob.glob(os.path.join(RAIZ, "data", "memoria_parts", "*.json"))):
    parte = json.load(open(p, encoding="utf-8"))
    dup = set(parte) & set(memo)
    if dup:
        print(f"⚠ ids repetidos en {os.path.basename(p)}: {sorted(dup)}")
    memo.update(parte)
con_img = 0
for k, m in memo.items():
    w = f"img/memo/{k}.webp"
    if os.path.exists(os.path.join(RAIZ, w)):
        m["imagen"] = w
        con_img += 1
    else:
        m["imagen"] = None
json.dump(memo, open(os.path.join(RAIZ, "data", "memoria.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
claves = sum(1 for m in memo.values() if m.get("imagen_clave"))
print(f"memoria.json: {len(memo)} entradas · {claves} con imagen_clave · {con_img} con imagen")
