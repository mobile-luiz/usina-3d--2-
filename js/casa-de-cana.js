/* Usina em 3D: Casa de cana (garra e estoque) e pátio de bagaço (retro, caldeira e energia). */
"use strict";

/* ---------- Casa de cana: garra e estoque ---------- */
let estoque=Math.round(rnd(900,1500)), estoqueAlvo=estoque;
const PILHA={x:-52.5,z:-15}, MESA={x:-45.6,z:-21};
const ease=k=>k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
function animarGarra(dt){
  const c=CASA; if(!c.ponte) return;
  const fases=[ // [duração, tipo]
    [2.6,'irPilha'],[1.8,'descer'],[0.9,'fechar'],[1.8,'subir'],[3.2,'irMesa'],[1.2,'descerMesa'],[0.8,'abrir'],[1.2,'subirMesa']];
  c.t+=dt;
  const [dur,tipo]=fases[c.fase]; const k=ease(Math.min(1,c.t/dur));
  if(!c.alvo) c.alvo={x:PILHA.x+(Math.random()-0.5)*5, z:PILHA.z+(Math.random()-0.5)*8};
  const topoPilha=CASA.pilha.scale.y+0.9;
  if(tipo==='irPilha'){ c.x=c.ox+(c.alvo.x-c.ox)*k; c.z=c.oz+(c.alvo.z-c.oz)*k; c.y=7; }
  else if(tipo==='descer'){ c.y=7-(7-topoPilha-1.2)*k; }
  else if(tipo==='fechar'){ c.ab=1-k; if(k>0.6) c.feixe.visible=true; }
  else if(tipo==='subir'){ c.y=topoPilha+1.2+(7-topoPilha-1.2)*k; }
  else if(tipo==='irMesa'){ c.x=c.alvo.x+(MESA.x-c.alvo.x)*k; c.z=c.alvo.z+(MESA.z-c.alvo.z)*k; }
  else if(tipo==='descerMesa'){ c.y=7-2.2*k; }
  else if(tipo==='abrir'){ c.ab=k; if(k>0.4) c.feixe.visible=false; }
  else if(tipo==='subirMesa'){ c.y=4.8+2.2*k; }
  if(c.t>=dur){ c.t=0; c.fase=(c.fase+1)%fases.length; if(c.fase===0){ c.ox=c.x; c.oz=c.z; c.alvo=null; } }
  c.ponte.position.x=c.x; c.carro.position.z=c.z-c.ponte.position.z;
  const topo=8.0, comp=Math.max(0.2,topo-(c.y+0.4));
  c.cabo.scale.y=comp; c.cabo.position.y=-1.35-comp/2;
  c.garra.position.set(c.x,c.y,c.z);
  c.dedos.forEach(d=>d.rotation.x=0.15+c.ab*0.55);
  const sc=clamp(estoque/1200,0.45,1.45);
  c.pilha.scale.y+= (3.2*sc-c.pilha.scale.y)*Math.min(1,dt*2);
  c.pilha.scale.x=5.2*(0.85+sc*0.15);
}
function atualizarEstoque(){
  if(Math.random()<0.02) estoqueAlvo=Math.round(rnd(700,1700));
  estoque+= (estoqueAlvo-estoque)*0.01 - (Math.random()*1.5);
  estoque=Math.max(120,estoque);
}
/* retroescavadeira: pega bagaço no monte e despeja na moega da caldeira */
const RETRO_K=[
  {x:-43.3,z:-39.2,r:0,          a:1,   b:-0.9, c:0},
  {x:-45.6,z:-36.6,r:0.9,        a:0.35,b:0,    c:0, d:2.2},
  {x:-47.2,z:-38.4,r:Math.PI,    a:0,   b:0.2,  c:0, d:2.2},
  {x:-49.0,z:-39.5,r:Math.PI,    a:0,   b:0.25, c:0, d:1.5},
  {x:-49.0,z:-39.5,r:Math.PI,    a:0.25,b:0.7,  c:1, d:1.3},
  {x:-46.6,z:-37.0,r:Math.PI-0.9,a:0.35,b:0.7,  c:1, d:2.2},
  {x:-45.0,z:-38.7,r:0.02,       a:0.6, b:0.7,  c:1, d:2.2},
  {x:-43.3,z:-39.2,r:0,          a:1,   b:0.7,  c:1, d:1.6},
  {x:-43.3,z:-39.2,r:0,          a:1,   b:-0.9, c:0, d:1.1}
];
let bagEstoque=Math.round(rnd(2600,4200)), bagAlvo=bagEstoque, retroViagens=0;
function animarRetro(dt){
  const R=BAG; if(!R.g) return;
  const A=RETRO_K[R.i], Bk=RETRO_K[(R.i+1)%RETRO_K.length], dur=Bk.d||1.5;
  R.t+=dt; const k=ease(Math.min(1,R.t/dur));
  let dr=Bk.r-A.r; dr=Math.atan2(Math.sin(dr),Math.cos(dr));
  R.g.position.set(A.x+(Bk.x-A.x)*k,0,A.z+(Bk.z-A.z)*k);
  R.g.rotation.y=A.r+dr*k;
  const arm=A.a+(Bk.a-A.a)*k, bk=A.b+(Bk.b-A.b)*k;
  R.braco.rotation.z=-0.55+arm*1.3;
  R.pa.rotation.z=bk-R.braco.rotation.z*0.6;
  R.cargaPa.visible = (A.c>0.5 && Bk.c>0.5) || (Bk.c>0.5 && k>0.5) || (A.c>0.5 && k<0.4);
  if(R.t>=dur){ R.t=0; R.i=(R.i+1)%RETRO_K.length; if(R.i===RETRO_K.length-1) retroViagens++; }
}
function atualizarBagaco(){
  if(Math.random()<0.02) bagAlvo=Math.round(rnd(1800,4800));
  bagEstoque+=(bagAlvo-bagEstoque)*0.01+(Math.random()-0.5)*3;
  bagEstoque=Math.max(200,bagEstoque);
  if(BAG.monte){ const sc=clamp(bagEstoque/3500,0.4,1.4); BAG.monte.scale.y+=(4*sc-BAG.monte.scale.y)*0.2; BAG.monte.scale.x=7.2*(0.8+sc*0.2); }
}
function energia(){
  const queima=ritmo*0.24, vapor=queima*2.1, mw=queima*0.28, interno=14;
  return {queima, vapor, mw, exporta:Math.max(0,mw-interno), gerado:ritmo*0.27};
}
function desenharBagaco(){
  const el=document.getElementById('gBag'); if(!el) return;
  const e=energia(), aut=e.queima>0?Math.round(bagEstoque/e.queima*60):0;
  el.innerHTML=[
    [nf(bagEstoque)+' t','de bagaço no pátio'],[fmt(aut),'de caldeira garantida só com o pátio'],
    [nf(e.queima)+' t/h','de bagaço queimado na caldeira'],[nf(e.vapor)+' t/h','de vapor produzido'],
    [nf(e.mw,1)+' MW','de energia gerada'],[nf(e.exporta,1)+' MW','exportados para a rede'],
    [nf(e.gerado-e.queima,1)+' t/h','de sobra indo para o pátio'],[nf(Math.round(e.queima*0.12)),'viagens da retro por hora']
  ].map(([n,l])=>`<div><b>${n}</b><span>${l}</span></div>`).join('');
  document.getElementById('gBagAlerta').textContent = aut<360 ? `Bagaço baixo: com a moenda parada, a caldeira só aguenta ${fmt(aut)}.` : '';
}
function desenharCasa(){
  const el=document.getElementById('gCasa'); if(!el) return;
  const aut=ritmo>0?Math.round(estoque/ritmo*60):0;
  el.innerHTML=[
    [nf(estoque)+' t','de cana em estoque'],[fmt(aut),'de moagem garantida pelo estoque'],
    [nf(ritmo/54),'cargas descarregadas por hora'],[nf(ritmo/13),'garradas por hora na mesa']
  ].map(([n,l])=>`<div><b>${n}</b><span>${l}</span></div>`).join('');
  const a=document.getElementById('gCasaAlerta');
  a.textContent = aut<90 ? `Estoque baixo: a moenda para em ${fmt(aut)} se não chegar cana.` : '';
}
