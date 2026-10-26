# -*- coding: utf-8 -*-
"""Regenera la lista de precache de sw.js (y su versión) leyendo los archivos reales.

Uso (desde la raíz o desde cualquier carpeta):
    py tools/precache.py          # reescribe el bloque // <precache> … // </precache> de sw.js
    py tools/precache.py --ver    # solo muestra qué entraría, sin escribir

- PRECACHE: el "app shell" que se guarda al instalar: index.html, manifest, js/*.js, css/*.css,
  data/*.json (sin *.sample.json ni las carpetas *_parts) e íconos/avatar.
- IMAGENES: img/**/*.webp|png|jpg que NO van en el precache. Se bajan solo si el usuario pulsa
  "Descargar imágenes para usar sin conexión" en ⚙️ Ajustes (o al verlas, por la caché en ejecución).
- VERSION: hash corto del contenido del shell. Cambia cuando cambia cualquier archivo, así el
  navegador detecta un sw.js nuevo y la app muestra "Hay una versión nueva · Recargar".
Correrlo antes de publicar en GitHub Pages. En desarrollo no hace falta: js/css/data van por red primero.
"""
import glob, hashlib, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SW = os.path.join(RAIZ, "sw.js")


def rel(p):
    return os.path.relpath(p, RAIZ).replace(os.sep, "/")


def lista(patron):
    return sorted(rel(p) for p in glob.glob(os.path.join(RAIZ, patron), recursive=True) if os.path.isfile(p))


def main():
    shell = ["./", "index.html", "manifest.webmanifest"]
    shell += lista("js/*.js") + lista("css/*.css")
    shell += [d for d in lista("data/*.json") if not d.endswith(".sample.json")]
    shell += lista("img/icon-*.png") + lista("img/avatar*.webp")
    fijos = set(shell)
    imagenes = [p for p in lista("img/**/*.*")
                if p not in fijos and os.path.splitext(p)[1].lower() in (".webp", ".png", ".jpg", ".jpeg", ".svg")]

    h = hashlib.sha1()
    for p in shell:
        if p == "./":
            continue
        h.update(p.encode())
        with open(os.path.join(RAIZ, p), "rb") as f:
            h.update(f.read())
    h.update("\n".join(imagenes).encode())
    version = h.hexdigest()[:10]

    peso = sum(os.path.getsize(os.path.join(RAIZ, p)) for p in shell if p != "./")
    peso_img = sum(os.path.getsize(os.path.join(RAIZ, p)) for p in imagenes)
    print(f"shell: {len(shell)} archivos · {peso / 1e6:.1f} MB · versión {version}")
    print(f"imágenes opcionales: {len(imagenes)} · {peso_img / 1e6:.1f} MB")
    if "--ver" in sys.argv:
        print("\n".join(shell))
        return

    bloque = ("// <precache> (generado por tools/precache.py; no editar a mano)\n"
              f"const VERSION = '{version}';\n"
              f"const PRECACHE = {json.dumps(shell, ensure_ascii=False)};\n"
              f"const IMAGENES = {json.dumps(imagenes, ensure_ascii=False)};\n"
              f"const PESO_IMAGENES = {peso_img};\n"
              "// </precache>")
    with open(SW, encoding="utf-8") as f:
        txt = f.read()
    nuevo, n = re.subn(r"// <precache>.*?// </precache>", lambda _m: bloque, txt, flags=re.S)
    if n != 1:
        sys.exit("sw.js no tiene el bloque // <precache> … // </precache>")
    if nuevo != txt:
        with open(SW, "w", encoding="utf-8", newline="\n") as f:
            f.write(nuevo)
        print("sw.js actualizado")
    else:
        print("sw.js ya estaba al día")


if __name__ == "__main__":
    main()
