// Versiones "limpias" de las fotos de facies (sin título, etiquetas ni flechas) para los quiz,
// para que la imagen no regale la respuesta. Uso: node tools/facies_limpias.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const raiz = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')));
const PY = 'C:/PROGRAMACION/VIDEOS YOUTUBE/output/1984/tiktok/.venv/Scripts/python.exe';
const log = (m) => { const l = `[${new Date().toLocaleTimeString()}] ${m}`; console.log(l); fs.appendFileSync(path.join(raiz, 'tools/logs/imagenes.log'), l + '\n'); };
const atlas = JSON.parse(fs.readFileSync(path.join(raiz, 'data/atlas.json'), 'utf8'));
const INSTR = 'Edita la imagen adjunta: ELIMINA por completo todos los textos, títulos, recuadros de color con letras, etiquetas, ' +
  'flechas y líneas indicadoras. Rellena esas zonas con el fondo o la piel/ropa que corresponda, de forma natural. ' +
  'CONSERVA idéntico el rostro, la expresión, los rasgos clínicos, la iluminación, el encuadre y el estilo de la ilustración. ' +
  'Mismo formato y proporción que la original. La imagen final no debe tener ninguna letra ni número.';
const tmpDir = path.join(raiz, 'tools/logs/facies_ref');
fs.mkdirSync(tmpDir, { recursive: true });
fs.writeFileSync(path.join(raiz, 'tools/logs/prompt_facies_limpia.txt'), INSTR, 'utf8');

let ok = 0;
for (const f of atlas.facies.filter((x) => x.imagen)) {
  const out = path.join(raiz, `img/facies_quiz/${f.id}.png`);
  if (fs.existsSync(out) || fs.existsSync(out.replace(/\.png$/, '.webp'))) { ok++; continue; }
  const ref = path.join(tmpDir, `${f.id}.png`); // Codex recibe PNG
  spawnSync(PY, ['-c', `from PIL import Image; Image.open(r'${path.join(raiz, f.imagen)}').convert('RGB').save(r'${ref}')`]);
  for (let i = 1; i <= 2 && !fs.existsSync(out); i++) {
    const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(raiz, 'tools/gen_img_edit.ps1'),
      '-Ref', ref, '-Out', out, '-PromptFile', path.join(raiz, 'tools/logs/prompt_facies_limpia.txt')], { encoding: 'utf8' });
    log(`facies_quiz/${f.id} (intento ${i}): ${(r.stdout || r.stderr || '').trim().split('\n').pop()}`);
  }
  if (fs.existsSync(out)) ok++;
}
spawnSync(PY, [path.join(raiz, 'tools/optimizar_img.py')]);
spawnSync('py', [path.join(raiz, 'tools/build_data.py')]);
spawnSync(PY, [path.join(raiz, 'tools/optimizar_img.py')]); // build_data vuelve a copiar las fotos originales del vault
log(`FACIES LIMPIAS TERMINADO: ${ok}/${atlas.facies.length}`);
