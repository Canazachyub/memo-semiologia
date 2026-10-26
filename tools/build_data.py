# -*- coding: utf-8 -*-
"""Junta los datos del resumen de valores del vault en data/atlas.json para la app.

Reutiliza el generador del vault (secciones, íconos, siglas, facies) para no duplicar criterios.
Uso: py tools/build_data.py
"""
import importlib.util
import json
import os
import re
import shutil
import sys
import unicodedata

sys.stdout.reconfigure(encoding="utf-8")

VAULT = r"C:\Users\User\Documents\CEREBRO DIGITAL\MEDICINA UNAP\MEDICINA UNAP"
DATOS = os.path.join(VAULT, r"outputs\SEMIOLOGIA\resumen-valores")
GEN = os.path.join(VAULT, r".claude\skills\esquema-drawio-a3\resumen_valores_hc.py")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

spec = importlib.util.spec_from_file_location("gen", GEN)
gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)


def slug(t):
    t = unicodedata.normalize("NFD", t.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def vacio(t):
    t = (t or "").strip()
    return not t or t == "—" or t.startswith(gen.SIN)


def limpio(t):
    """Texto del vault sin la marca SIN DATO (lo que quede después de ella)."""
    t = (t or "").strip()
    if gen.SIN in t:
        t = re.sub(r"^\(|\)$", "", t.replace(gen.SIN, "").strip(" ():;,·")).strip(" ;,")
    return "" if t == "—" else t


def campo(r, lit, k):
    """{'t': texto, 'lit': bool} usando literatura solo si falta en el vault."""
    if not vacio(r.get(k)):
        return {"t": r[k].strip(), "lit": False}
    if lit.get(k):
        return {"t": lit[k], "lit": True}
    resto = limpio(r.get(k))
    return {"t": resto, "lit": False} if resto else None


def main():
    datos = {k: json.load(open(os.path.join(DATOS, f"valores_{k}.json"), encoding="utf-8"))
             for k in "ABCDE" if os.path.exists(os.path.join(DATOS, f"valores_{k}.json"))}
    filas = [r for d in datos.values() for r in d["filas"]]
    claves = json.load(open(os.path.join(DATOS, "claves.json"), encoding="utf-8"))
    lits = json.load(open(os.path.join(DATOS, "completado_literatura.json"), encoding="utf-8"))

    usadas, secciones = set(), []
    for titulo, color, prefijos in gen.SECCIONES:
        filas_sec = []
        for pre in prefijos:
            for r in filas:
                if id(r) in usadas or not r["parametro"].lower().startswith(pre.lower()):
                    continue
                usadas.add(id(r))
                lit = lits.get(r["parametro"], {})
                if gen.fila_vacia(r, lit):
                    continue
                cl = claves.get(r["parametro"])
                altura = None
                if r.get("altura") and not r["altura"].startswith(gen.SIN):
                    altura = {"t": r["altura"], "lit": False}
                elif lit.get("altura"):
                    altura = {"t": lit["altura"], "lit": True}
                filas_sec.append({
                    "id": slug(r["parametro"]),
                    "parametro": r["parametro"],
                    "nombre": gen.nombre_corto(r["parametro"]),
                    "icono": gen.icono_param(r["parametro"]),
                    "normal": campo(r, lit, "normal"),
                    "altura": altura,
                    "sube": campo(r, lit, "sube"),
                    "baja": campo(r, lit, "baja"),
                    "perla": None if vacio(r.get("perla")) else r["perla"],
                    "clave": {"tipo": cl["tipo"], "texto": cl["clave"], "lit": cl.get("lit", False),
                              "icono": gen.ICONO_CLAVE.get(cl["tipo"], "💡")} if cl and cl.get("clave") else None,
                    "nota": r.get("nota") or None,
                    "fuente": r.get("fuente") or None,
                })
        if filas_sec:
            num = titulo.split(" ")[0]
            secciones.append({"id": f"s{num}", "titulo": titulo, "color": color,
                              "icono": gen.ICONO_SECCION.get(num, ""), "filas": filas_sec})

    # facies: copiar la imagen del vault si existe
    os.makedirs(os.path.join(RAIZ, "img", "facies"), exist_ok=True)
    facies = []
    for fa in datos["A"].get("facies", []) + datos.get("D", {}).get("facies", []):
        img = None
        for k, rutas in gen.IMG_FACIES.items():
            if k.lower() in fa["nombre"].lower():
                for ruta in rutas:
                    p = os.path.join(gen.COMP, ruta)
                    if os.path.exists(p):
                        destino = f"img/facies/{slug(fa['nombre'])}{os.path.splitext(p)[1]}"
                        shutil.copy2(p, os.path.join(RAIZ, destino))
                        img = destino
                        break
                break
        quiz = f"img/facies_quiz/{slug(fa['nombre'])}.webp"
        facies.append({"id": slug(fa["nombre"]), "nombre": fa["nombre"], "rasgo": fa["rasgo"],
                       "orienta": fa["orienta"], "imagen": img,
                       "imagen_quiz": quiz if os.path.exists(os.path.join(RAIZ, quiz)) else None})

    escalas = json.load(open(os.path.join(DATOS, "escalas.json"), encoding="utf-8"))["escalas"]
    for es in escalas:
        es["id"] = slug(es["nombre"])

    atlas = {
        "titulo": "Valores de la historia clínica",
        "subtitulo": "Semiología UNA Puno 2026 · extraído de tu vault",
        "secciones": secciones,
        "escalas": escalas,
        "facies": facies,
        "glosario": [{"titulo": t, "items": [{"sigla": s, "significado": m} for s, m in pares]}
                     for t, pares in gen.GLOSARIO],
    }
    os.makedirs(os.path.join(RAIZ, "data"), exist_ok=True)
    json.dump(atlas, open(os.path.join(RAIZ, "data", "atlas.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    n = sum(len(s["filas"]) for s in secciones)
    print(f"{len(secciones)} secciones · {n} parámetros · {len(escalas)} escalas · "
          f"{len(facies)} facies ({sum(1 for f in facies if f['imagen'])} con imagen)")
    sobrantes = [r["parametro"] for r in filas if id(r) not in usadas]
    if sobrantes:
        print("sin sección:", sobrantes)


if __name__ == "__main__":
    main()
