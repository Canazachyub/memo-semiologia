// Imágenes fijas de la app: avatar y una ilustración por lugar de la ciudad-palacio de Puno.
// Uso: node tools/imagenes_fijas.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const raiz = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')));
const log = (m) => { const l = `[${new Date().toLocaleTimeString()}] ${m}`; console.log(l); fs.appendFileSync(path.join(raiz, 'tools/logs/imagenes.log'), l + '\n'); };
fs.mkdirSync(path.join(raiz, 'tools/logs'), { recursive: true });

const LUGAR = 'Ilustración tipo videojuego de exploración (estilo Pokémon GO / mapa de aventura), vista isométrica ligera, de un lugar real de Puno, Perú (ciudad andina a 3800 m junto al lago Titicaca, cielo azul intenso de altura, cerros áridos). Lugar: ';
const tareas = [
  ['avatar', 'img', 'Personaje avatar chibi para un juego: estudiante de medicina andino/a de Puno, con mandil blanco, estetoscopio al cuello, chullo (gorro andino de colores) y mochila, pose de caminar alegre y decidida, cuerpo entero, fondo liso blanco puro para recortar.'],
  ['s1', 'lugares', LUGAR + 'Hospital Regional de Puno, entrada de emergencia con ambulancia y cruz roja médica, edificio hospitalario moderno.'],
  ['s2', 'lugares', LUGAR + 'Plaza de Armas de Puno con pileta central, bancas, palomas y la catedral barroca de piedra al fondo.'],
  ['s3', 'lugares', LUGAR + 'Jirón Lima, calle peatonal colonial con balcones, faroles y mucha gente caminando como un río.'],
  ['s4', 'lugares', LUGAR + 'Arco Deustua, arco monumental de piedra en lo alto de unas escalinatas con vista a la ciudad.'],
  ['s5', 'lugares', LUGAR + 'Mercado Central andino lleno de puestos coloridos: frutas, plátanos, sal, azúcar, quesos, papas y chuño.'],
  ['s6', 'lugares', LUGAR + 'Malecón Bahía de los Incas junto al lago Titicaca, restaurantes de trucha frita con humo de parrilla y totorales.'],
  ['s7', 'lugares', LUGAR + 'Parque Pino con una pileta de agua, pinos altos y una iglesia de piedra al lado.'],
  ['s8', 'lugares', LUGAR + 'Catedral barroca de piedra de Puno vista desde el atrio, con campanario y ecos de sonido dibujados como ondas.'],
  ['s9', 'lugares', LUGAR + 'Estadio de fútbol de altura con pista atlética, tribunas y cerros de fondo, corredores en la pista.'],
  ['s10', 'lugares', LUGAR + 'Mirador Kuntur Wasi: gran escultura de cóndor de alas abiertas sobre un cerro con vista panorámica de la ciudad y el lago.'],
  ['s11', 'lugares', LUGAR + 'Islas flotantes de los Uros hechas de totora en el lago Titicaca, casitas de totora, balsas "caballito de totora".'],
  ['s12', 'lugares', LUGAR + 'Muelle del puerto de Puno en el lago Titicaca con lanchas, botes a pedal y agua azul profunda.'],
  ['escalas', 'lugares', LUGAR + 'Ciudad Universitaria de la Universidad Nacional del Altiplano, facultad de medicina, estudiantes con mandil, jardines y edificio académico.'],
];
const existe = (sub, id) => ['png', 'webp'].some((x) => fs.existsSync(path.join(raiz, `img/${sub}/${id}.${x}`)));
for (const [id, sub, prompt] of tareas) {
  if (existe(sub, id)) { log(`skip ${sub}/${id}`); continue; }
  const tmp = path.join(raiz, `tools/logs/prompt_${sub}_${id}.txt`);
  fs.writeFileSync(tmp, prompt, 'utf8');
  for (let i = 1; i <= 2 && !existe(sub, id); i++) {
    const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(raiz, 'tools/gen_img_memo.ps1'),
      '-Id', id, '-PromptFile', tmp, '-Sub', sub, '-Formato', id === 'avatar' ? 'vertical 2:3' : 'apaisado 3:2'], { encoding: 'utf8' });
    log(`${sub}/${id} (intento ${i}): ${(r.stdout || r.stderr || '').trim().split('\n').pop()}`);
  }
}
spawnSync('C:/PROGRAMACION/VIDEOS YOUTUBE/output/1984/tiktok/.venv/Scripts/python.exe', [path.join(raiz, 'tools/optimizar_img.py')]);
log('FIJAS TERMINADO');
