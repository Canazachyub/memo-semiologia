// Ciudad-palacio de Puno: mapa del paseo + paseo de memoria (recuerdo activo por estaciones).
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function crearCiudad({ ATLAS, MEMO, PALACIOS, raiz }) {
  // estaciones por lugar, en el orden del atlas
  const datosDe = (sid) => (sid === 'escalas'
    ? ATLAS.escalas.map((e) => ({ id: e.id, nombre: e.nombre, icono: e.icono || '📏', valor: (e.interpretacion || []).map((x) => `${x[0]} ${x[1]}`).join(' · ') }))
    : (ATLAS.secciones.find((s) => s.id === sid)?.filas || []).map((f) => ({ id: f.id, nombre: f.nombre, icono: f.icono, valor: f.normal?.t || '' })));
  const estaciones = (sid) => {
    const L = PALACIOS.lugares[sid];
    return datosDe(sid).map((d, n) => ({ ...d, n, ubicacion: MEMO[d.id]?.estacion?.ubicacion || L.ruta[n] || `Estación ${n + 1}`, m: MEMO[d.id] }));
  };
  const titulo = (sid) => (sid === 'escalas' ? '📏 Escalas clínicas' : ATLAS.secciones.find((s) => s.id === sid)?.titulo || sid);

  let abierto = null; // lugar abierto
  let paseo = null;   // { sid, i, revelado }

  function mapa() {
    const orden = PALACIOS.orden_paseo;
    raiz.innerHTML = `<p class="porque">🗺️ Tu atlas es un paseo por <b>${esc(PALACIOS.ciudad)}</b>. Cada sección vive en un lugar real y cada dato en una estación del recorrido.
      Recorre el paseo con los ojos cerrados: en cada parada, ¿qué dato está y cuál es su valor? <i>${esc(PALACIOS._nota || '')}</i></p>
      <div class="paseo">${orden.map((sid, i) => {
        const L = PALACIOS.lugares[sid]; const est = estaciones(sid); const con = est.filter((e) => e.m).length;
        return `<button class="parada" data-lugar="${sid}"><span class="pn">${i + 1}</span><span class="pi">${L.icono}</span>
          <span class="pt"><b>${esc(L.lugar)}</b><small>${esc(titulo(sid))} · ${est.length} estaciones · 🧠 ${con}</small></span></button>`;
      }).join('<div class="tramo"></div>')}</div>`;
  }

  function lugar(sid) {
    const L = PALACIOS.lugares[sid];
    raiz.innerHTML = `<div class="rep-top"><button class="btn" data-volver>← Mapa del paseo</button>
      <button class="btn pri" data-paseo="${sid}">🚶 Hacer el paseo de memoria</button></div>
      <h2 class="lugar-t">${L.icono} ${esc(L.lugar)}</h2><p class="porque">${esc(titulo(sid))} — ${esc(L.porque)}</p>
      <ol class="estaciones">${estaciones(sid).map((e) => `<li>
        ${e.m?.imagen ? `<img src="${esc(e.m.imagen)}" alt="" loading="lazy" data-zoom>` : `<span class="ph">${e.icono}</span>`}
        <div><span class="ub">📍 ${esc(e.ubicacion)}</span><b>${e.icono} ${esc(e.nombre)}</b>
        ${e.m?.ancla ? `<span class="an">⚓ ${esc(e.m.ancla)}</span>` : ''}
        <a href="#p-${e.id}" data-ir="${e.id}" class="link">ver ficha</a></div></li>`).join('')}</ol>`;
  }

  function pasoPaseo() {
    const est = estaciones(paseo.sid); const L = PALACIOS.lugares[paseo.sid];
    if (paseo.i >= est.length) {
      const sig = PALACIOS.orden_paseo[PALACIOS.orden_paseo.indexOf(paseo.sid) + 1];
      raiz.innerHTML = `<div class="fin"><b>🏁</b>Terminaste ${esc(L.lugar)}.<div class="btns" style="justify-content:center">
        <button class="btn" data-volver>Mapa</button>${sig ? `<button class="btn pri" data-paseo="${sig}">Seguir a ${PALACIOS.lugares[sig].icono} ${esc(PALACIOS.lugares[sig].lugar)} →</button>` : ''}</div></div>`;
      return;
    }
    const e = est[paseo.i];
    raiz.innerHTML = `<div class="tarjeta ${paseo.revelado ? 'revelada' : ''}">
      <div class="meta"><span>${L.icono} ${esc(L.lugar)}</span><span>${paseo.i + 1} / ${est.length}</span></div>
      <div class="q">📍 ${esc(e.ubicacion)}</div>
      <p class="porque">Cierra los ojos y llega a este punto: ¿qué ves aquí, qué dato representa y cuál es su valor?</p>
      ${paseo.revelado ? '' : '<div class="btns"><button class="btn pri" data-revelar>Revelar (espacio)</button></div>'}
      <div class="a">${e.m?.imagen ? `<img src="${esc(e.m.imagen)}" alt="" style="max-width:260px;border-radius:12px" data-zoom>` : ''}
        <div class="resp">${e.icono} ${esc(e.nombre)}</div><p>${esc(e.valor)}</p>
        ${e.m?.escena ? `<div class="pista">🎬 ${esc(e.m.escena)}</div>` : ''}
        <div class="btns"><button class="btn" data-atras>← Anterior</button><button class="btn pri" data-sig>Siguiente estación → (enter)</button></div></div></div>`;
  }

  raiz.addEventListener('click', (ev) => {
    const t = ev.target.closest('button, a'); if (!t) return;
    if (t.dataset.lugar) { abierto = t.dataset.lugar; paseo = null; lugar(abierto); }
    else if (t.hasAttribute('data-volver')) { abierto = null; paseo = null; mapa(); }
    else if (t.dataset.paseo) { paseo = { sid: t.dataset.paseo, i: 0, revelado: false }; pasoPaseo(); }
    else if (t.hasAttribute('data-revelar')) { paseo.revelado = true; pasoPaseo(); }
    else if (t.hasAttribute('data-sig')) { paseo.i += 1; paseo.revelado = false; pasoPaseo(); }
    else if (t.hasAttribute('data-atras')) { paseo.i = Math.max(0, paseo.i - 1); paseo.revelado = true; pasoPaseo(); }
  });
  document.addEventListener('keydown', (ev) => {
    if (!paseo || !raiz.closest('.vista.on')) return;
    if (ev.key === ' ' && !paseo.revelado) { ev.preventDefault(); paseo.revelado = true; pasoPaseo(); }
    else if (ev.key === 'Enter' && paseo.revelado) { paseo.i += 1; paseo.revelado = false; pasoPaseo(); }
  });

  return { pintar: () => (paseo ? pasoPaseo() : abierto ? lugar(abierto) : mapa()) };
}
