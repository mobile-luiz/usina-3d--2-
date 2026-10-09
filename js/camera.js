/* Usina em 3D: Câmera, mouse e toque, filtro de áreas, troca entre o 3D e o painel gerencial, leitura da API do server.js. */
"use strict";

/* ---------- Controles de câmera ---------- */
const HOME={theta:-0.18,phi:0.92,r:190,x:12,z:-4};
const ctl={theta:HOME.theta,phi:HOME.phi,r:HOME.r,target:new THREE.Vector3(HOME.x,0,HOME.z)};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function applyCam(){
  const {theta,phi,r,target:t}=ctl;
  camera.position.set(t.x+r*Math.sin(phi)*Math.sin(theta), t.y+r*Math.cos(phi), t.z+r*Math.sin(phi)*Math.cos(theta));
  camera.lookAt(t);
}
function pan(dx,dy){
  const k=ctl.r*0.0016, s=Math.sin(ctl.theta), c=Math.cos(ctl.theta);
  ctl.target.x+=(-c*dx - s*dy)*k;
  ctl.target.z+=( s*dx - c*dy)*k;
  ctl.target.x=clamp(ctl.target.x,-260,260); ctl.target.z=clamp(ctl.target.z,-220,160);
}
let tween=null, seguindo=null;
function seguirColhedora(s){ seguindo=s; const c=s.colh[0]; flyTo(c.x,c.z+4,28,-0.5*c.dir,1.27); mostrarAviso('Acompanhando a colhedora da '+s.f.nome+'. Arraste para girar, clique em Recentralizar para sair.'); }
function flyTo(x,z,r,theta,phi){
  const to={x,z,r,theta:theta??ctl.theta,phi:phi??ctl.phi};
  if(reduce){ Object.assign(ctl,{r:to.r,theta:to.theta,phi:to.phi}); ctl.target.set(x,0,z); return; }
  tween={from:{x:ctl.target.x,z:ctl.target.z,r:ctl.r,theta:ctl.theta,phi:ctl.phi}, to, t0:performance.now(), dur:900};
}
const ptrs=new Map(); let mode=null, downPos=null, lastPinch=0, lastMid=null;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  canvas.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY}); tween=null;
  if(ptrs.size===1){ downPos={x:e.clientX,y:e.clientY}; mode=(e.button===2||e.shiftKey)?'pan':'rot'; if(mode==='pan') seguindo=null; }
  else if(ptrs.size===2){ const [a,b]=[...ptrs.values()]; mode='pinch'; downPos=null; lastPinch=Math.hypot(a.x-b.x,a.y-b.y); lastMid={x:(a.x+b.x)/2,y:(a.y+b.y)/2}; }
});
canvas.addEventListener('pointermove',e=>{
  const p=ptrs.get(e.pointerId); if(!p) return;
  const dx=e.clientX-p.x, dy=e.clientY-p.y; p.x=e.clientX; p.y=e.clientY;
  if(mode==='rot'){ ctl.theta-=dx*0.005; ctl.phi=clamp(ctl.phi-dy*0.005,0.3,1.45); }
  else if(mode==='pan'){ pan(dx,dy); }
  else if(mode==='pinch' && ptrs.size===2){
    const [a,b]=[...ptrs.values()], d=Math.hypot(a.x-b.x,a.y-b.y), mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    if(d>0) ctl.r=clamp(ctl.r*lastPinch/d,45,560);
    pan(mid.x-lastMid.x, mid.y-lastMid.y); lastPinch=d; lastMid=mid;
  }
});
const hintEl=document.getElementById('hint');
canvas.addEventListener('pointerdown',()=>hintEl.classList.add('some'),{once:true});
setTimeout(()=>hintEl.classList.add('some'),12000);
function mostrarTela(painel){
  document.body.classList.toggle('modo-painel',painel);
  document.querySelector('#togglePainel span').textContent=painel?'Voltar para o 3D':'Painel gerencial';
  document.getElementById('tituloTela').textContent=painel?'Painel gerencial':'Usina em 3D';
  document.getElementById('subTela').textContent=painel?'Moagem, turnos, safra, frentes, oficina e energia em uma tela só. O 3D continua rodando por trás.':'A safra agora, da balança à expedição, com cada carga e lote parado na etapa em que está.';
  if(painel){ if(hist.length) desenharGestao(); Object.values(CJ).forEach(c=>{ try{ c&&c.resize(); }catch(_){} }); document.getElementById('telaPainel').scrollTop=0; }
  else setTimeout(resize,30);
}
function irPara3D(){ if(!document.body.classList.contains('modo-painel')) return; try{ history.pushState(null,'',location.pathname+location.search); }catch(_){ location.hash=''; } mostrarTela(false); }
document.getElementById('togglePainel').addEventListener('click',()=>{
  if(document.body.classList.contains('modo-painel')) irPara3D(); else { location.hash='painel'; }
});
addEventListener('hashchange',()=>mostrarTela(location.hash==='#painel'));
addEventListener('popstate',()=>mostrarTela(location.hash==='#painel'));

function endPtr(e){
  if(downPos && ptrs.size===1 && Math.hypot(e.clientX-downPos.x,e.clientY-downPos.y)<6) escolher(e);
  ptrs.delete(e.pointerId);
  if(ptrs.size===0){ mode=null; downPos=null; } else if(ptrs.size===1){ mode='rot'; downPos=null; }
}
canvas.addEventListener('pointerup',endPtr);
canvas.addEventListener('pointercancel',e=>{ ptrs.delete(e.pointerId); if(!ptrs.size) mode=null; });
canvas.addEventListener('wheel',e=>{ e.preventDefault(); tween=null; ctl.r=clamp(ctl.r*(1+e.deltaY*0.0012),45,560); },{passive:false});

const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
function escolher(e){
  const r=canvas.getBoundingClientRect();
  ndc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc,camera);
  const hit=ray.intersectObjects(patches)[0];
  /* caminhão na frente do que foi clicado: abre a ficha do caminhão */
  const cam=typeof caminhaoNoRaio==='function'?caminhaoNoRaio(ray):null;
  if(cam && (!hit || cam.dist<hit.distance)){ abrirCaminhao(cam.rec); return; }
  if(hit) abrirPainel(hit.object.userData.st);
}

/* filtro, recentralizar, atualizar */
const filtro=document.getElementById('filtro');
filtro.addEventListener('change',()=>{
  const k=filtro.value; seguindo=null;
  overlays.forEach(o=>o.el.classList.toggle('dim', !!k && o.area!==k));
  if(k){ const a=AREAS[k]; flyTo(a.alvo[0],a.alvo[1],a.r,a.theta??HOME.theta,a.phi??HOME.phi); } else flyTo(HOME.x,HOME.z,HOME.r,HOME.theta,HOME.phi);
});
document.getElementById('recenter').addEventListener('click',()=>{
  seguindo=null;
  filtro.value=''; overlays.forEach(o=>o.el.classList.remove('dim'));
  flyTo(HOME.x,HOME.z,HOME.r,HOME.theta,HOME.phi);
});
let aoVivo=false, api=null;
async function buscarAPI(){
  if(location.protocol==='file:') return;
  try{
    const r=await fetch('/api/resumo',{cache:'no-store'});
    if(!r.ok) throw new Error(r.status);
    api=await r.json(); aoVivo=true; aplicarAPI();
  }catch(e){ if(aoVivo) console.warn('Falha ao buscar /api/resumo, mantendo últimos dados', e); }
}
function aplicarAPI(){
  if(api.safra){ Object.assign(SAFRA, api.safra); }
  hist=api.horas.map(h=>({ini:new Date(h.ini), t:h.t, par:h.par||0}));
  if(api.dias) dias=api.dias.map(d=>({ini:new Date(d.ini), t:d.t, atr:d.atr||atrDia}));
  paradas=api.paradas.map(p=>({hora:new Date(p.hora), motivo:p.motivo, dur:p.dur, categoria:p.categoria}));
  if(api.qualidade) Object.assign(qual, api.qualidade);
  fornec=api.fornecedores;
  if(api.atr) atrDia=api.atr;
  if(api.meta){ META_DIA=api.meta; META_H=META_DIA/24; }
  if(api.mix) mixAc=api.mix;
  ritmo=api.ritmo;
}
async function recarregar(){
  await buscarAPI();
  gerarDados(); ressortearFrentes(); atualizarFrentesST(false);
  if(OFI.veiculos.length){ evoluirOficina(); sincronizarOficina3D(); } atualizarOficinaST(); desenharOficina();
  montarCubos(); atualizarRotulos(); atualizarKpis();
  if(hist.length) desenharGestao();
  if(painelAtual) abrirPainel(painelAtual);
}
document.getElementById('atualizar').addEventListener('click',recarregar);
setInterval(recarregar,60000);
