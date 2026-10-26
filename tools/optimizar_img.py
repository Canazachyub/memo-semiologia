# -*- coding: utf-8 -*-
"""Convierte img/**/*.png|jpg a .webp (máx. 900 px) y actualiza las rutas en data/*.json."""
import glob, json, os, sys
sys.stdout.reconfigure(encoding="utf-8")
from PIL import Image
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cambios = {}
for p in glob.glob(os.path.join(RAIZ, "img", "**", "*.*"), recursive=True):
    if os.path.splitext(p)[1].lower() not in (".png", ".jpg", ".jpeg"):
        continue
    if os.path.basename(p).startswith("icon-"):  # íconos de la PWA: quedan en PNG con transparencia
        continue
    im = Image.open(p).convert("RGB")
    im.thumbnail((900, 900))
    w = os.path.splitext(p)[0] + ".webp"
    im.save(w, "WEBP", quality=80)
    os.remove(p)
    rel = lambda x: os.path.relpath(x, RAIZ).replace(os.sep, "/")
    cambios[rel(p)] = rel(w)
for j in glob.glob(os.path.join(RAIZ, "data", "*.json")):
    t = open(j, encoding="utf-8").read()
    for a, b in cambios.items():
        t = t.replace(a, b)
    open(j, "w", encoding="utf-8").write(t)
print(f"{len(cambios)} imágenes → webp")
