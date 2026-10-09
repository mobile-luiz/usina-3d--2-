/* Usina em 3D: Ficha do caminhão. Clicando num caminhão canavieiro, mostra a frota, o motorista, a matrícula,
   há quanto tempo ele está trabalhando, a pausa obrigatória e onde o caminhão está; e liga o rastro do caminho que ele fez. */
"use strict";

/* ---------- Motoristas (ligados ao número da frota) ---------- */
const NOMES_MOT = ['José Carlos', 'Antônio Marcos', 'Francisco das Chagas', 'Severino Ramos', 'Cícero Romão', 'João Batista', 'Edvaldo', 'Josivaldo',
  'Genivaldo', 'Erivaldo', 'Gilvan', 'Ednaldo', 'Manoel Messias', 'Luiz Carlos', 'Valdemir', 'Damião', 'Reginaldo', 'Adeildo', 'Givanildo', 'Joselito',
  'Marcos Antônio', 'Paulo Roberto', 'Wellington', 'Rosivaldo', 'Edilson', 'Aldo', 'Claudemir', 'Josenildo'];
const SOBRENOMES_MOT = ['da Silva', 'dos Santos', 'Ferreira', 'de Lima', 'Bezerra', 'Cavalcanti', 'de Souza', 'Barbosa', 'Pereira', 'Nunes', 'Tavares', 'de Melo', 'Alves', 'Gomes', 'Rodrigues', 'de Oliveira'];
const hashN = n => { let h = 2166136261; for(const c of String(n)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };

function motoristaDe(frota){
  const h = hashN(frota), agora = new Date();
  const turno = turnoDe(agora), iniTurno = inicioDiaSafra(agora).getTime() + turno.de * H;
  /* cada motorista pega o caminhão entre a hora do turno e uns 40 min depois */
  const inicio = iniTurno + (h % 41) * 60000;
  const jornada = Math.max(0, Date.now() - inicio);
  /* lei do motorista: 30 min de pausa a cada 5h30 dirigindo; quem já passou de 4h fez a primeira pausa */
  const pausouEm = jornada > 4 * H ? inicio + (3.6 + (h % 7) / 10) * H : null;
  const dirigindo = Date.now() - (pausouEm ? pausouEm + 30 * 60000 : inicio);
  return {
    nome: `${NOMES_MOT[h % NOMES_MOT.length]} ${SOBRENOMES_MOT[(h >>> 8) % SOBRENOMES_MOT.length]}`,
    matricula: String(10000 + (h >>> 4) % 89999).padStart(6, '0'),
    turno: turno.id, inicio: new Date(inicio), jornada, pausouEm: pausouEm ? new Date(pausouEm) : null,
    proximaPausa: 5.5 * H - dirigindo
  };
}

/* ---------- Todos os caminhões canavieiros que estão na tela, e onde cada um está ---------- */
function caminhoesNaTela(){
  const lista = [];
  trucks.forEach(t => {
    if(!t.frota) t.frota = novaFrota();
    lista.push({ g: t.g, frota: t.frota, obj: t, carga: !t.done[2] ? t.ton : 0, onde: () => {
      if(!t.done[0]) return t.wait > 0 ? 'Parado na balança de entrada, pesando' : `Chegando na usina carregado, indo para a balança`;
      if(!t.done[1]) return t.wait > 0 ? 'No laboratório, tirando amostra (sonda)' : 'Indo para o laboratório';
      if(!t.done[2]) return t.wait > 0 ? 'No hilo, descarregando a cana' : 'Indo para o hilo descarregar';
      return 'Vazio, saindo pela balança da usina';
    } });
  });
  FR.forEach(s => {
    s.fila.forEach((t, k) => lista.push({ g: t.g, frota: t.frota, obj: t, carga: 0, onde: () => `Na fila da ${s.f.nome}, ${s.fila.indexOf(t) + 1}º para carregar` }));
    if(s.carregando){ const t = s.carregando; lista.push({ g: t.g, frota: t.frota, obj: t, carga: () => Math.round((t.fill || 0) * 55), onde: () => `Carregando na ${s.f.nome}, ${Math.round((t.fill || 0) * 100)}% cheio` }); }
    s.saindo.forEach(t => lista.push({ g: t.g, frota: t.frota, obj: t, carga: t.ton, onde: () => `Saindo carregado da ${s.f.nome} para a usina` }));
  });
  PATIO.vagas.forEach(v => { if(v.g.visible && v.frota) lista.push({ g: v.g, frota: v.frota, obj: v, carga: 0, onde: () => v.saindo ? 'Saindo do pátio de vazios para a frente' : 'No pátio de vazios, aguardando vaga numa frente' }); });
  return lista.filter(c => c.g && c.g.visible !== false && c.g.parent);
}

/* usado pelo clique no 3D (camera.js): devolve o caminhão atingido pelo raio, se houver */
function caminhaoNoRaio(raio){
  const lista = caminhoesNaTela();
  const hits = raio.intersectObjects(lista.map(c => c.g), true);
  if(!hits.length) return null;
  let o = hits[0].object; while(o && !lista.some(c => c.g === o)) o = o.parent;
  const c = lista.find(x => x.g === o);
  return c ? { rec: c, dist: hits[0].distance } : null;
}

/* ---------- Rastro: guarda por onde cada caminhão passou (últimos ~2 minutos) ---------- */
const RASTROS = new WeakMap();
const RASTRO_MAX = 300;
setInterval(() => {
  caminhoesNaTela().forEach(c => {
    let r = RASTROS.get(c.g); if(!r){ r = []; RASTROS.set(c.g, r); }
    const p = c.g.position, u = r[r.length - 1];
    if(!u || Math.hypot(p.x - u.x, p.z - u.z) > 0.4){ r.push({ x: p.x, y: p.y, z: p.z }); if(r.length > RASTRO_MAX) r.shift(); }
  });
  if(CARD.rastro) desenharRastro();
}, 400);

const rastroMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide });
let rastroMesh = null;
function apagarRastro(){ if(rastroMesh){ scene.remove(rastroMesh); rastroMesh.geometry.dispose(); rastroMesh = null; } }
/* faixa no chão seguindo o caminho; mais forte perto do caminhão e apagando para trás */
function desenharRastro(){
  apagarRastro();
  if(!CARD.rec) return;
  const r = (RASTROS.get(CARD.rec.g) || []).concat([{ x: CARD.rec.g.position.x, y: CARD.rec.g.position.y, z: CARD.rec.g.position.z }]);
  if(r.length < 2) return;
  const pos = [], cor = [], idx = [], larg = 0.75, c0 = new THREE.Color(0xffc23d), c1 = new THREE.Color(0xff5a00);
  r.forEach((p, i) => {
    const a = r[Math.max(0, i - 1)], b = r[Math.min(r.length - 1, i + 1)];
    let dx = b.x - a.x, dz = b.z - a.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const y = p.y + 0.18, k = i / (r.length - 1), c = c0.clone().lerp(c1, k).multiplyScalar(0.7 + 0.3 * k);
    pos.push(p.x - dz * larg, y, p.z + dx * larg, p.x + dz * larg, y, p.z - dx * larg);
    cor.push(c.r, c.g, c.b, c.r, c.g, c.b);
    if(i){ const j = i * 2; idx.push(j - 2, j - 1, j, j - 1, j + 1, j); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  g.setIndex(idx);
  rastroMesh = new THREE.Mesh(g, rastroMat); rastroMesh.renderOrder = 2; rastroMesh.userData.noAO = true;
  scene.add(rastroMesh);
  if(typeof semAO !== 'undefined' && !semAO.includes(rastroMesh)) semAO.push(rastroMesh);
}

/* ---------- Ficha ---------- */
const CARD = { rec: null, rastro: false, el: document.getElementById('cardCam') };
function abrirCaminhao(rec){
  fecharPainel();
  CARD.rec = rec;
  /* a ficha é montada uma vez; a cada segundo só os textos mudam (o botão não some debaixo do clique) */
  CARD.el.innerHTML = `
    <div class="cc-top"><div><b id="ccFrota"></b><span>Caminhão canavieiro</span></div>
      <button type="button" class="cc-x" id="ccFechar" aria-label="Fechar">&times;</button></div>
    <p class="cc-onde" id="ccOnde"></p>
    <dl>
      <dt>Motorista</dt><dd id="ccNome"></dd>
      <dt>Matrícula</dt><dd id="ccMat"></dd>
      <dt>Trabalhando há</dt><dd id="ccJor"></dd>
      <dt>Pausa obrigatória</dt><dd id="ccPausa"></dd>
      <dt>Carga</dt><dd id="ccCarga"></dd>
    </dl>
    <button type="button" class="cc-rastro" id="ccRastro"></button>`;
  document.getElementById('ccFechar').onclick = fecharCaminhao;
  document.getElementById('ccRastro').onclick = () => { CARD.rastro = !CARD.rastro; CARD.rastro ? desenharRastro() : apagarRastro(); desenharCard(); };
  CARD.el.hidden = false;
  desenharCard();
  if(CARD.rastro) desenharRastro();
}
function fecharCaminhao(){ CARD.rec = null; CARD.el.hidden = true; apagarRastro(); }

function desenharCard(){
  const c = CARD.rec; if(!c) return;
  /* o caminhão pode ter mudado de lista (fila, carregando, saindo): acha de novo pelo modelo 3D */
  const atual = caminhoesNaTela().find(x => x.g === c.g);
  if(atual && atual.frota !== c.frota) c.frota = atual.frota;   /* caminhão da usina que saiu e voltou como outra frota */
  const m = motoristaDe(c.frota), carga = atual ? (typeof atual.carga === 'function' ? atual.carga() : atual.carga) : 0, pausa = m.proximaPausa;
  const $ = id => document.getElementById(id);
  $('ccFrota').textContent = `Frota ${c.frota}`;
  $('ccOnde').textContent = atual ? atual.onde() : 'Na estrada, fora da área mostrada';
  $('ccNome').textContent = m.nome;
  $('ccMat').textContent = m.matricula;
  $('ccJor').className = m.jornada > 8 * H ? 'q-red' : '';
  $('ccJor').innerHTML = `${fmt(Math.round(m.jornada / 60000))}<small>desde ${hm(m.inicio)}, turno ${m.turno}${m.jornada > 8 * H ? ', em hora extra' : ''}</small>`;
  $('ccPausa').className = pausa < 0 ? 'q-red' : pausa < 30 * 60000 ? 'q-warn' : '';
  $('ccPausa').innerHTML = `${pausa < 0 ? `vencida há ${fmt(Math.round(-pausa / 60000))}` : `daqui a ${fmt(Math.round(pausa / 60000))}`}<small>${m.pausouEm ? `última pausa às ${hm(m.pausouEm)}` : 'ainda não fez pausa no turno'}</small>`;
  $('ccCarga').textContent = carga ? `${carga} t de cana` : 'vazio';
  const br = $('ccRastro'); br.setAttribute('aria-pressed', String(CARD.rastro)); br.textContent = CARD.rastro ? 'Esconder rastro' : 'Mostrar rastro';
}
setInterval(() => { if(CARD.rec) desenharCard(); }, 1000);
addEventListener('keydown', e => { if(e.key === 'Escape' && CARD.rec) fecharCaminhao(); });
