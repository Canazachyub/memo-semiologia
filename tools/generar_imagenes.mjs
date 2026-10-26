// Genera con Codex las imágenes de las entradas con imagen_clave (o todas con --todas), en orden de prioridad.
// Uso: node tools/generar_imagenes.mjs [--todas] [--max N]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const raiz = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')));
const args = process.argv.slice(2);
const todas = args.includes('--todas');
const max = args.includes('--max') ? +args[args.indexOf('--max') + 1] : Infinity;
const log = (m) => { const l = `[${new Date().toLocaleTimeString()}] ${m}`; console.log(l); fs.appendFileSync(path.join(raiz, 'tools/logs/imagenes.log'), l + '\n'); };
fs.mkdirSync(path.join(raiz, 'tools/logs'), { recursive: true });

const leer = () => {
  const m = {};
  for (const f of fs.readdirSync(path.join(raiz, 'data/memoria_parts')).filter((f) => f.endsWith('.json')).sort())
    Object.assign(m, JSON.parse(fs.readFileSync(path.join(raiz, 'data/memoria_parts', f), 'utf8')));
  return m;
};
// prioridad: signos vitales, escalas, gases, electrolitos… (orden del paseo)
const ORDEN = ['s1', 'escalas', 'l11', 's11', 's5', 's3', 's9', 's6', 's12', 's2', 's4', 's10', 's7', 's8'];
const existe = (id) => ['png', 'webp'].some((x) => fs.existsSync(path.join(raiz, `img/memo/${id}.${x}`)));

const memo = leer();
const cola = Object.entries(memo)
  .filter(([id, m]) => (todas || m.imagen_clave) && m.imagen_prompt && !existe(id))
  .sort(([, a], [, b]) => ORDEN.indexOf(a.estacion?.seccion) - ORDEN.indexOf(b.estacion?.seccion))
  .slice(0, max);
log(`cola: ${cola.length} imágenes`);

let ok = 0;
for (const [id, m] of cola) {
  const tmp = path.join(raiz, `tools/logs/prompt_${id}.txt`);
  fs.writeFileSync(tmp, m.imagen_prompt, 'utf8');
  for (let intento = 1; intento <= 2 && !existe(id); intento++) {
    const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(raiz, 'tools/gen_img_memo.ps1'), '-Id', id, '-PromptFile', tmp], { encoding: 'utf8' });
    log(`${id} (intento ${intento}): ${(r.stdout || r.stderr || '').trim().split('\n').pop()}`);
  }
  if (existe(id)) ok++;
  // cada 5 imágenes: optimizar y re-unir para que la app ya las muestre
  if (ok && ok % 5 === 0) posproceso();
}
function posproceso() {
  const py = 'C:/PROGRAMACION/VIDEOS YOUTUBE/output/1984/tiktok/.venv/Scripts/python.exe';
  spawnSync(py, [path.join(raiz, 'tools/optimizar_img.py')], { encoding: 'utf8' });
  spawnSync('py', [path.join(raiz, 'tools/unir_memoria.py')], { encoding: 'utf8' });
}
posproceso();
log(`TERMINADO: ${ok}/${cola.length}`);
