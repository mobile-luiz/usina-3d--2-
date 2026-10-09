/* Usina em 3D: Pátio de vazios. Caminhões que saem vazios da balança sem vaga em nenhuma frente
   estacionam aqui, cada um com o número de frota, e saem assim que o CCO libera uma frente. */
"use strict";

/* o pátio fica fora da cerca da usina, colado na rodovia: os caminhões estacionam de frente para a rodovia
   e saem pela saída do pátio, entrando na pista no sentido das frentes */
const PATIO = { x0: -106, x1: -82, z0: 15, z1: 35, zVaga: 25, faixa: 38.8, passo: 3.8, vagas: [] };
const xVaga = k => -102.7 + k * PATIO.passo;
(function montarPatio(){
  const cx = (PATIO.x0 + PATIO.x1) / 2, cz = (PATIO.z0 + PATIO.z1) / 2;
  /* piso, faixas entre as vagas e a saída asfaltada até a rodovia */
  const piso = B(PATIO.x1 - PATIO.x0, 0.08, PATIO.z1 - PATIO.z0, MT.concreto, cx, -0.02, cz); piso.castShadow = false; piso.receiveShadow = true;
  asfaltoBox(PATIO.x1 - PATIO.x0, 3, cx, 34, 0.02);
  for(let k = 0; k <= PATIO_MAX; k++){
    const x = xVaga(k) - PATIO.passo / 2;
    const l = B(0.16, 0.05, 15, 0xf2f2ee, x, 0.06, PATIO.zVaga); l.castShadow = false;
  }
  /* placa de saída */
  Cy(0.08, 0.08, 3, MT.estrut, PATIO.x1 - 0.8, 0, PATIO.z1 - 2, 6);
  B(2.6, 1.2, 0.12, MT.azul, PATIO.x1 - 0.8, 2.6, PATIO.z1 - 2);
  /* um caminhão por vaga, de frente para a rodovia, escondido até ser ocupado */
  for(let k = 0; k < PATIO_MAX; k++){
    const g = makeTruck('cana', cabs[k % cabs.length]);
    g.userData.carga.forEach(m => m.visible = false);
    const x = xVaga(k), z = PATIO.zVaga;
    g.position.set(x, 0.06, z); g.rotation.y = -Math.PI / 2; g.visible = false; scene.add(g);
    const el = document.createElement('div'); el.className = 'dock vazio patio-vaga'; labelsEl.appendChild(el);
    overlays.push({ el, pos: new THREE.Vector3(x, 5, z), area: 'recepcao' });
    PATIO.vagas.push({ g, el, x, z, frota: null, saindo: false, caminho: null });
  }
  const tag = document.createElement('button'); tag.type = 'button'; tag.className = 'tag'; labelsEl.appendChild(tag);
  overlays.push({ el: tag, pos: new THREE.Vector3(cx, 1, PATIO.z0 - 1), area: 'recepcao' });
  tag.addEventListener('click', () => abrirPatio());
  PATIO.tag = tag;
})();

/* caminho de saída: anda reto até a saída, faz a curva para a direita e segue pela rodovia no sentido das frentes */
function caminhoSaida(v){
  return [
    new THREE.Vector3(v.x, 0.06, PATIO.z1 - 1),
    new THREE.Vector3(v.x - 1.2, 0.06, PATIO.faixa - 1.6),
    new THREE.Vector3(v.x - 5, 0.06, PATIO.faixa),
    new THREE.Vector3(-260, 0.06, PATIO.faixa)
  ];
}

/* painel lateral do pátio, no mesmo formato das etapas */
const PATIO_ST = { nome: 'Pátio de vazios', area: 'recepcao', sla: null, items: [] };
function itensPatio(){
  return noPatio().map((p, k) => ({ cod: `Frota ${p.frota}`, origem: p.chamado ? 'Chamado pelo CCO, saindo para a frente' : `${k + 1}º da fila, aguardando vaga numa frente`, el: Math.round((performance.now() - p.desde) / ESCALA_DESPACHO), status: 'none' }));
}
function abrirPatio(){
  PATIO_ST.items = itensPatio();
  abrirPainel(PATIO_ST);
  document.getElementById('pSub').textContent = `Vazios esperando o CCO liberar uma frente (até ${PATIO_MAX}). O primeiro que chegou é o primeiro a sair.`;
}

/* deixa o 3D igual à lista do despacho: estaciona quem entrou e tira quem foi liberado */
function sincronizarPatio(){
  const fila = noPatio().map(p => p.frota);   /* só quem já confirmou no rádio que estacionou */
  PATIO.vagas.forEach(v => { if(v.frota && !v.saindo && !fila.includes(v.frota)){ v.saindo = true; v.el.classList.add('vazio'); if(reduce){ v.g.visible = false; v.frota = null; v.saindo = false; v.caminho = null; } } });
  fila.forEach(fr => {
    if(PATIO.vagas.some(v => v.frota === fr && !v.saindo)) return;
    const v = PATIO.vagas.find(x => !x.frota); if(!v) return;
    v.frota = fr; v.saindo = false; v.caminho = null; v.g.position.set(v.x, 0.06, v.z); v.g.rotation.y = -Math.PI / 2; v.g.visible = true;
    v.el.textContent = fr; v.el.classList.remove('vazio');
  });
  PATIO.tag.innerHTML = `Pátio de vazios <span class="n">${fila.length}</span>`;
  PATIO.tag.setAttribute('aria-label', `Pátio de vazios: ${fila.length} caminhões aguardando`);
  if(painelAtual === PATIO_ST) abrirPatio();
}
/* quem foi liberado sai pela saída do pátio e pega a rodovia */
const vtP = new THREE.Vector3();
function animarPatio(dt){
  PATIO.vagas.forEach(v => {
    if(!v.saindo) return;
    if(!v.caminho) v.caminho = caminhoSaida(v);
    const g = v.g, alvo = v.caminho[0];
    vtP.subVectors(alvo, g.position); vtP.y = 0;
    const d = vtP.length(), passo = 8 * dt;
    if(d <= passo){ g.position.copy(alvo); v.caminho.shift(); }
    else{
      g.position.addScaledVector(vtP, passo / d);
      /* vira suave na direção do próximo ponto (o modelo olha para +x quando a rotação é zero) */
      const rot = Math.atan2(-vtP.z, vtP.x);
      let dr = rot - g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      g.rotation.y += dr * Math.min(1, dt * 5);
    }
    if(!v.caminho.length){
      g.visible = false; g.position.set(v.x, 0.06, v.z); g.rotation.y = -Math.PI / 2;
      v.frota = null; v.saindo = false; v.caminho = null;
    }
  });
}
setInterval(sincronizarPatio, 400);
