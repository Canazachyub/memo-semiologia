// Genera con Codex las imágenes del atlas de técnicas (data/tecnicas_parts) → img/tecnicas/<id>.png → webp.
// Uso: node tools/generar_tecnicas.mjs [--max N]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const raiz = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')));
const args = process.argv.slice(2);
const max = args.includes('--max') ? +args[args.indexOf('--max') + 1] : Infinity;
const log = (m) => { const l = `[${new Date().toLocaleTimeString()}] ${m}`; console.log(l); fs.appendFileSync(path.join(raiz, 'tools/logs/imagenes.log'), l + '\n'); };
const existe = (id) => ['png', 'webp'].some((x) => fs.existsSync(path.join(raiz, `img/tecnicas/${id}.${x}`)));
const dir = path.join(raiz, 'data/tecnicas_parts');
const cola = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
  .filter((t) => t.imagen_prompt && !existe(t.id)).slice(0, max);
log(`técnicas: cola ${cola.length}`);
let ok = 0;
for (const t of cola) {
  const tmp = path.join(raiz, `tools/logs/prompt_tec_${t.id}.txt`);
  fs.writeFileSync(tmp, `Técnica de memoria: ${t.tecnica}. ${t.imagen_prompt}`, 'utf8');
  for (let i = 1; i <= 2 && !existe(t.id); i++) {
    const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(raiz, 'tools/gen_img_memo.ps1'), '-Id', t.id, '-PromptFile', tmp, '-Sub', 'tecnicas'], { encoding: 'utf8' });
    const ult = (r.stdout || r.stderr || '').trim().split('\n').pop();
    log(`tecnicas/${t.id} (intento ${i}): ${ult}`);
    if (/usage limit/i.test(fs.existsSync(path.join(raiz, `tools/logs/codex_${t.id}.log`)) ? fs.readFileSync(path.join(raiz, `tools/logs/codex_${t.id}.log`), 'utf8') : '')) { log('LÍMITE DE CODEX: corto aquí'); fin(); process.exit(2); }
  }
  if (existe(t.id)) ok++;
  if (ok && ok % 5 === 0) posproceso();
}
function posproceso() {
  const py = 'C:/PROGRAMACION/VIDEOS YOUTUBE/output/1984/tiktok/.venv/Scripts/python.exe';
  spawnSync(py, [path.join(raiz, 'tools/optimizar_img.py')], { encoding: 'utf8' });
  spawnSync('py', [path.join(raiz, 'tools/unir_tecnicas.py')], { encoding: 'utf8' });
}
function fin() { posproceso(); log(`TÉCNICAS TERMINADO: ${ok}/${cola.length}`); }
fin();
