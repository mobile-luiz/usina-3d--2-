/* Usina em 3D: Oficina automotiva: veículos em manutenção, baias e situação. */
"use strict";

/* ---------- Oficina automotiva ---------- */
const TIPOS_OFI=[
  {tipo:'Cavalo mecânico', pre:'CM', modelo:'cavalo', servicos:['Troca de embreagem','Revisão de freios','Reparo no câmbio','Troca de pneus','Vazamento no radiador']},
  {tipo:'Trator transbordo', pre:'TT', modelo:'transbordo', servicos:['Reparo no sistema hidráulico','Troca de mangueiras','Revisão de 500 h','Pneu rasgado']},
  {tipo:'Colhedora', pre:'CH', modelo:'colhedora', servicos:['Troca de facas do corte de base','Reparo no elevador','Revisão do motor','Troca de rolos picadores']},
  {tipo:'Caminhonete', pre:'CA', modelo:'caminhonete', servicos:['Revisão de 10 mil km','Troca de amortecedores','Alinhamento e balanceamento']},
  {tipo:'Caminhão pipa', pre:'PI', modelo:'cavalo', servicos:['Reparo na bomba d\'água','Troca de embreagem']},
  {tipo:'Motoniveladora', pre:'MN', modelo:'motoniveladora', servicos:['Troca das lâminas de corte','Reparo no círculo da lâmina','Revisão de 250 h']}
];
const STATUS_OFI=['Aguardando mecânico','Em reparo','Aguardando peça','Pronto para liberar'];
const MECANICOS=['Severino','Josué','Marcos','Edvaldo','Cícero','Ronaldo'];
const FROTA_TOTAL=186;
const OFI={veiculos:[], grupo:null, marcas:null, seq:200};
const BAIAS=[77,83,89,95,101,107].map(x=>({x, z:11.6}));
const ESPERA=[{x:104.2,z:24.4}];

function novoVeiculoOfi(idade){
  const T=pick(TIPOS_OFI), prev=Math.random()<0.35;
  const horasPrev=prev?rnd(4,10):rnd(6,40);
  const entrada=new Date(Date.now()-(idade??rnd(0.3,1)*horasPrev)*3600e3);
  return {cod:`${T.pre}-${OFI.seq++}`, tipo:T.tipo, modelo:T.modelo, servico:prev?'Manutenção preventiva':pick(T.servicos),
    manut:prev?'Preventiva':'Corretiva', status:pick(STATUS_OFI.slice(0,3)), entrada, previsao:new Date(entrada.getTime()+horasPrev*3600e3),
    mecanico:pick(MECANICOS), local:'Oficina'};
}
function gerarOficina(){
  OFI.veiculos=[];
  const n=6+Math.floor(rnd(0,4));
  for(let i=0;i<n;i++){ const v=novoVeiculoOfi(); if(i===0) v.status='Pronto para liberar'; OFI.veiculos.push(v); }
  /* um caminhão atrasado e um aguardando peça, para aparecer nos alertas */
  OFI.veiculos[1].status='Aguardando peça'; OFI.veiculos[1].entrada=new Date(Date.now()-rnd(26,60)*3600e3); OFI.veiculos[1].previsao=new Date(Date.now()-rnd(2,10)*3600e3);
}
function evoluirOficina(){
  const vs=OFI.veiculos;
  vs.filter(v=>v.status==='Pronto para liberar' && Math.random()<0.35).forEach(v=>vs.splice(vs.indexOf(v),1));
  vs.forEach(v=>{
    if(v.local!=='Oficina') return;
    const r=Math.random();
    if(v.status==='Aguardando mecânico' && r<0.35) v.status='Em reparo';
    else if(v.status==='Aguardando peça' && r<0.15) v.status='Em reparo';
    else if(v.status==='Em reparo' && Date.now()>v.entrada.getTime()+(v.previsao-v.entrada)*0.7 && r<0.3) v.status='Pronto para liberar';
  });
  if(vs.filter(v=>v.local==='Oficina').length<10 && Math.random()<0.3){ const v=novoVeiculoOfi(0.05); v.status='Aguardando mecânico'; vs.push(v); }
  /* colhedora quebrada numa frente: atendimento mecânico no campo */
  vs.filter(v=>v.campo).forEach(v=>{ if(!FR[v.campo-1] || FR[v.campo-1].ativa || !/colhedora|elevador/i.test(FR[v.campo-1].motivo)) vs.splice(vs.indexOf(v),1); });
  FR.forEach((s,i)=>{
    if(!s.ativa && /colhedora|elevador/i.test(s.motivo) && !vs.some(v=>v.campo===i+1)){
      vs.push({cod:`CH-${String(i*2+1).padStart(2,'0')}`, tipo:'Colhedora', modelo:'colhedora', servico:s.motivo, manut:'Corretiva', status:'Em reparo',
        entrada:new Date(Date.now()-(performance.now()-s.parouEm)), previsao:new Date(Date.now()+rnd(1,4)*3600e3), mecanico:'Equipe de campo', local:`No campo, ${s.f.nome}`, campo:i+1});
    }
  });
}
function statusItemOfi(v){
  if(v.status==='Aguardando peça') return 'stop';
  if(v.status==='Pronto para liberar') return 'ok';
  const now=Date.now(); if(now>v.previsao) return 'red';
  return (v.previsao-now)<(v.previsao-v.entrada)*0.2?'warn':'ok';
}
function atualizarOficinaST(){
  const st=ST.find(s=>s.id==='oficina'); if(!st) return;
  st.items=OFI.veiculos.map(v=>({cod:`${v.cod} ${v.tipo}`, origem:`${v.servico}. ${v.status}. ${v.local}, ${v.mecanico}. Previsão ${dm(v.previsao)} ${hm(v.previsao)}`,
    el:Math.round((Date.now()-v.entrada)/60000), status:statusItemOfi(v)})).sort((a,b)=>SEV[a.status]-SEV[b.status] || b.el-a.el);
}

function makeMecanico(){
  const g=new THREE.Group(), azul=mat(0x2f5b8f,0.8), pele=mat(0x9a6a4a,0.7);
  [-0.15,0.15].forEach(z=>B(0.22,0.85,0.22,azul,0,0,z,g));
  B(0.35,0.75,0.6,azul,0,0.85,0,g); M(new THREE.SphereGeometry(0.2,12,8),pele,0,1.85,0,g);
  M(new THREE.SphereGeometry(0.22,12,6,0,Math.PI*2,0,Math.PI/2),MT.amarelo,0,1.9,0,g);
  scene.add(g); return g;
}
function modeloOfi(v){
  let g;
  if(v.modelo==='colhedora'){ g=makeColhedora(); g.userData.braco.rotation.x=-1.35; }
  else if(v.modelo==='transbordo') g=makeTransbordo(true);
  else if(v.modelo==='motoniveladora') g=makeMotoniveladora();
  else if(v.modelo==='caminhonete') g=makeCaminhonete(pick([0xeeeeea,0x3d464d,0xc23a31]));
  else g=makeTruck('cavalo',pick(cabs));
  return g;
}
function colocar(g,x,z,rot){
  g.rotation.y=rot; g.position.set(0,0,0); g.updateMatrixWorld(true);
  const bb=new THREE.Box3().setFromObject(g), c=bb.getCenter(new THREE.Vector3());
  g.position.set(x-c.x,0,z-c.z);
}
function sincronizarOficina3D(){
  if(OFI.grupo){ OFI.grupo.forEach(o=>scene.remove(o)); }
  if(OFI.marcas){ scene.remove(OFI.marcas); }
  OFI.grupo=[]; OFI.marcas=new THREE.Group(); scene.add(OFI.marcas);
  const naOfi=OFI.veiculos.filter(v=>v.local==='Oficina');
  const emBaia=naOfi.filter(v=>v.status!=='Aguardando mecânico').slice(0,BAIAS.length);
  const espera=naOfi.filter(v=>!emBaia.includes(v)).slice(0,ESPERA.length);
  emBaia.forEach((v,i)=>{
    const b=BAIAS[i], g=modeloOfi(v); colocar(g,b.x,b.z,-Math.PI/2); OFI.grupo.push(g);
    const cor=COL[statusItemOfi(v)], m=mat(cor,0.6);
    [[5.4,0.14,b.x,b.z-4.8],[5.4,0.14,b.x,b.z+4.8],[0.14,9.6,b.x-2.7,b.z],[0.14,9.6,b.x+2.7,b.z]].forEach(([w,d,x,z])=>{ const s=new THREE.Mesh(new THREE.BoxGeometry(w,0.05,d),m); s.position.set(x,0.07,z); OFI.marcas.add(s); });
    if(v.status==='Em reparo'){ const mc=makeMecanico(); mc.position.set(b.x+2.2,0,b.z+2.6); mc.rotation.y=Math.PI/2; OFI.grupo.push(mc); }
    if(v.status==='Aguardando peça'){ const c=M(new THREE.ConeGeometry(0.3,0.8,12),mat(0xe3721f,0.6),b.x+2.1,0.4,b.z+4); OFI.grupo.push(c); }
  });
  espera.forEach((v,i)=>{ const e=ESPERA[i], g=modeloOfi(v); colocar(g,e.x,e.z,0); OFI.grupo.push(g); });
  OFI.marcas.visible=!document.body.classList.contains('so3d');
}

function desenharOficina(){
  const el=document.getElementById('gOfi'); if(!el) return;
  const vs=OFI.veiculos, cont=s=>vs.filter(v=>v.status===s).length;
  const atras=vs.filter(v=>v.status!=='Pronto para liberar' && Date.now()>v.previsao).length;
  const media=vs.length?vs.reduce((s,v)=>s+(Date.now()-v.entrada),0)/vs.length/60000:0;
  const disp=(1-vs.filter(v=>v.status!=='Pronto para liberar').length/FROTA_TOTAL)*100;
  el.innerHTML=[
    [String(vs.length),'veículos em manutenção'],[nf(disp,1)+'%',`da frota disponível (${FROTA_TOTAL} veículos)`],
    [String(cont('Em reparo')),'em reparo'],[String(cont('Aguardando peça')),'aguardando peça'],
    [String(cont('Aguardando mecânico')),'aguardando mecânico'],[String(cont('Pronto para liberar')),'prontos para liberar'],
    [fmt(Math.round(media)),'tempo médio na oficina'],[`${vs.filter(v=>v.manut==='Corretiva').length} e ${vs.filter(v=>v.manut==='Preventiva').length}`,'corretivas e preventivas']
  ].map(([n,l])=>`<div><b>${n}</b><span>${l}</span></div>`).join('');
  document.getElementById('gOfiAlerta').textContent=atras?`${atras} ${atras>1?'veículos passaram':'veículo passou'} da previsão de liberação.`:'';
  const ord=vs.slice().sort((a,b)=>a.entrada-b.entrada);
  document.getElementById('gOfiLista').innerHTML='<tr><th>Veículo</th><th>Situação</th><th>Na oficina</th></tr>'+ord.map(v=>{
    const st=statusItemOfi(v), atr=st==='red';
    return `<tr><td><b>${v.cod}</b> <small>${v.tipo}</small><br><small>${v.servico}${v.campo?`, ${v.local.toLowerCase()}`:''}</small></td>
      <td><span class="dot" style="display:inline-block;background:var(${VAR[st]})"></span> <small>${v.status}</small><br><small class="${atr?'late':''}">${atr?'atrasado, previsão era ':'previsão '}${dm(v.previsao)} ${hm(v.previsao)}</small></td>
      <td class="${atr?'late':''}">${fmt(Math.round((Date.now()-v.entrada)/60000))}</td></tr>`;
  }).join('');
}

/* ---------- Movimento na oficina: entram e saem caminhões, tratores, colhedoras, prancha e motoniveladora ---------- */
const OFI_ROTA_RAW=[[230,45],[90,45],[90,21.5],[77,21.5],[74.5,23.8],[77,26.2],[94,26.2],[94,39],[240,39]];
const OFI_ROTA=suavizar(OFI_ROTA_RAW,4);
const ofiSeg=[], ofiCum=[0];
for(let i=0;i<OFI_ROTA.length-1;i++){ const l=Math.hypot(OFI_ROTA[i+1][0]-OFI_ROTA[i][0],OFI_ROTA[i+1][1]-OFI_ROTA[i][1])||0.0001; ofiSeg.push(l); ofiCum.push(ofiCum[i]+l); }
const OFI_TOTAL=ofiCum[ofiCum.length-1];
const OFI_PARADA=(()=>{ let m=1e9,k=0; OFI_ROTA.forEach((p,i)=>{ const d=Math.hypot(p[0]-79,p[1]-21.5); if(d<m){ m=d; k=i; } }); return ofiCum[k]; })();
function ofiPonto(s){ let i=0; while(i<ofiSeg.length-1 && s>ofiCum[i+1]) i++; const t=(s-ofiCum[i])/ofiSeg[i], a=OFI_ROTA[i], b=OFI_ROTA[i+1]; return {x:a[0]+(b[0]-a[0])*t, z:a[1]+(b[1]-a[1])*t, dx:b[0]-a[0], dz:b[1]-a[1]}; }
const TRAFEGO_TIPOS=[
  {nome:'Caminhão',     fazer:()=>makeTruck('cavalo',pick(cabs)), vel:9,  comp:8,  fr:6.7, tr:1.3},
  {nome:'Trator',       fazer:()=>makeTransbordo(),              vel:6,  comp:17, fr:4.2, tr:13.4},
  {nome:'Colhedora',    fazer:()=>{ const g=makeColhedora(); g.userData.braco.rotation.x=-1.35; return g; }, vel:4.5, comp:8, fr:4.7, tr:3.0},
  {nome:'Prancha',      fazer:()=>makePrancha(makeColhedora),     vel:7,  comp:19, fr:6.7, tr:12.5},
  {nome:'Motoniveladora',fazer:()=>makeMotoniveladora(),          vel:5.5,comp:9,  fr:5.0, tr:4.2},
  {nome:'Caminhonete',  fazer:()=>makeCaminhonete(pick([0xeeeeea,0x3d464d,0xc23a31])), vel:10, comp:6, fr:2.7, tr:2.7},
  {nome:'Pipa',         fazer:()=>makePipa(),                     vel:8,  comp:11, fr:6.7, tr:3.9}
];
const trafego=[]; let proxTipo=Math.floor(Math.random()*TRAFEGO_TIPOS.length), esperaSpawn=1;
function novoTrafego(s0){
  const T=TRAFEGO_TIPOS[proxTipo]; proxTipo=(proxTipo+1)%TRAFEGO_TIPOS.length;
  const v={T, g:T.fazer(), s:s0||0, wait:0, parou:false, rot:null};
  v.parou=v.s>OFI_PARADA; posTrafego(v,0); trafego.push(v);
}
function posTrafego(v,dt){
  const p=ofiPonto(v.s), alvo=Math.atan2(-p.dz,p.dx);
  if(v.rot===null||!dt) v.rot=alvo; else { let d=alvo-v.rot; d=Math.atan2(Math.sin(d),Math.cos(d)); v.rot+=d*Math.min(1,dt*6); }
  v.g.position.set(p.x,0,p.z); v.g.rotation.y=v.rot;
  puxarCarretas(v.g);
}
/* checa se a frente da máquina vai encostar em alguma outra (inclusive em curvas e no cruzamento do portão) */
function corpoTrafego(o){ const pts=[]; for(let k=-o.T.tr;k<=o.T.fr;k+=1.8){ const p=ofiPonto(clamp(o.s,0,OFI_TOTAL)); const fx=Math.cos(o.rot), fz=-Math.sin(o.rot); pts.push([o.g.position.x+fx*k, o.g.position.z+fz*k]); } return pts; }
function trafegoBloqueado(v){
  const fx=Math.cos(v.rot??0), fz=-Math.sin(v.rot??0), px=v.g.position.x+fx*(v.T.fr+1.6), pz=v.g.position.z+fz*(v.T.fr+1.6);
  return trafego.some(o=>o!==v && o.s>v.s-2 && corpoTrafego(o).some(([x,z])=>Math.hypot(x-px,z-pz)<2.6));
}
function moverTrafego(dt){
  esperaSpawn-=dt;
  const ultimo=trafego[trafego.length-1];
  if(esperaSpawn<=0 && trafego.length<5 && (!ultimo || ultimo.s-ultimo.T.tr>TRAFEGO_TIPOS[proxTipo].fr+6)){ novoTrafego(0); esperaSpawn=rnd(7,13); }
  for(let k=trafego.length-1;k>=0;k--){
    const v=trafego[k];
    if(v.wait>0){ v.wait-=dt; continue; }
    const frente=trafego[k-1];
    if(frente && frente.s-v.s < frente.T.tr+v.T.fr+3.5) continue;
    if(trafegoBloqueado(v)) continue;
    let ns=v.s+v.T.vel*dt;
    if(!v.parou && v.s<=OFI_PARADA && ns>=OFI_PARADA){ ns=OFI_PARADA; v.parou=true; v.wait=rnd(3,6); }
    if(ns>=OFI_TOTAL){ removerVeiculo(v.g); trafego.splice(k,1); continue; }
    v.s=ns; posTrafego(v,dt);
  }
}
/* começa com alguns já no caminho */
[OFI_TOTAL*0.08, OFI_TOTAL*0.42, OFI_TOTAL*0.7].forEach(s=>novoTrafego(s));
trafego.sort((a,b)=>b.s-a.s);
