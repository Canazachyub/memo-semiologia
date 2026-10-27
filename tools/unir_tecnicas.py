# -*- coding: utf-8 -*-
"""Une data/tecnicas_parts/*.json → data/tecnicas.json y aplica data/metodos_parts/*.json sobre data/metodos.json.
Pone `imagen` a cada ejemplo cuyo archivo img/tecnicas/<id>.webp|png ya existe."""
import glob, json, os, sys
sys.stdout.reconfigure(encoding="utf-8")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(RAIZ, *p)

met = json.load(open(D("data", "metodos.json"), encoding="utf-8"))
orden = list(met)
for f in sorted(glob.glob(D("data", "metodos_parts", "*.json"))):
    for k, v in json.load(open(f, encoding="utf-8")).items():
        if k not in met:
            print("AVISO método desconocido:", k, f); continue
        met[k] = {**met[k], **v}
json.dump({k: met[k] for k in orden}, open(D("data", "metodos.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

lista, ids = [], set()
for k in orden:
    f = D("data", "tecnicas_parts", f"{k}.json")
    if not os.path.exists(f): continue
    for t in json.load(open(f, encoding="utf-8")):
        if t["id"] in ids: print("AVISO id repetido:", t["id"]); continue
        ids.add(t["id"]); t["metodo"] = k
        t.pop("imagen", None)
        for ext in ("webp", "png"):
            if os.path.exists(D("img", "tecnicas", f"{t['id']}.{ext}")): t["imagen"] = f"img/tecnicas/{t['id']}.{ext}"; break
        lista.append(t)
json.dump({"lista": lista}, open(D("data", "tecnicas.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"metodos.json: {len(met)} · tecnicas.json: {len(lista)} ejemplos, {sum('imagen' in t for t in lista)} con imagen")
