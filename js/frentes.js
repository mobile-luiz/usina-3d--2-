/* Usina em 3D: Frentes de colheita: colhedoras, transbordos, fila e carregamento de caminhões. */
"use strict";

/* ---------- Frentes de colheita: colhedoras, transbordos e caminhões ---------- */
/* número de frota dos caminhões canavieiros: é assim que a usina chama no rádio, não pela placa */
const FROTAS=[...Array(160)].map((_,i)=>3101+i).sort(()=>Math.random()-.5); let iFrota=0;
const novaFrota=()=>String(FROTAS[iFrota++%FROTAS.length]);
/* no máximo 2 caminhões aguardando para carregar em cada frente; o CCO só despacha vazio se houver vaga */
const FILA_MAX=2;
const MOTIVOS_FRENTE=['Chuva na frente de corte','Quebra da colhedora','Embuchamento do elevador da colhedora','Pneu furado no transbordo'];

function setCargaCaminhao(t,f){
  t.g.userData.carga.forEach(m=>{
    if(m.geometry.type==='BoxGeometry'){ m.visible=f>0.02; m.scale.y=Math.max(0.02,f); m.position.y=1.225+0.875*f; }
    else m.visible=f>0.95;
  });
}
function frenteBloqueado(s,t){
  if(!t.path||!t.path.length) return false;
  const [tx,tz]=t.path[0], dx=tx-t.x, dz=tz-t.z, d=Math.hypot(dx,dz); if(d<0.01) return false;
  const px=t.x+dx/d*7.2, pz=t.z+dz/d*7.2;
  return [s.carregando,...s.fila,...s.saindo].some(o=>{ if(!o||o===t) return false; const fx=Math.cos(o.rot), fz=-Math.sin(o.rot);
    return [6.2,3.5,1,-1.5,-4,-6.6].some(k=>Math.hypot(o.x+fx*k-px,o.z+fz*k-pz)<2.0); });
}
function moverSeguro(s,t,dt){ return frenteBloqueado(s,t)?false:moverAte(t,dt); }
function moverAte(o,dt){
  if(!o.path || !o.path.length) return true;
  const [tx,tz]=o.path[0], dx=tx-o.x, dz=tz-o.z, d=Math.hypot(dx,dz), passo=o.speed*dt;
  if(d<=passo){ o.x=tx; o.z=tz; o.path.shift(); }
  else { o.x+=dx/d*passo; o.z+=dz/d*passo; virar(o,Math.atan2(-dz,dx),dt); }
  o.g.position.set(o.x,o.y||-0.6,o.z);
  return !o.path.length;
}
function virar(o,alvo,dt){
  let d=alvo-o.rot; d=Math.atan2(Math.sin(d),Math.cos(d));
  o.rot+= dt? d*Math.min(1,dt*6) : d; o.g.rotation.y=o.rot;
}
function novoCaminhaoFrente(s,x,z,esperaBase){
  const t={g:makeTruck('cana',pick(cabs)), x, z, y:-0.6, rot:Math.PI, speed:9, path:[], frota:novaFrota(), chegou:performance.now(), base:esperaBase||0, fill:0};
  t.g.rotation.y=Math.PI; t.g.position.set(x,-0.6,z); setCargaCaminhao(t,0);
  return t;
}
const FR = FRENTES.map((f,i)=>{
  const L={x:f.fx-6, z:f.fz+3}, filaZ=f.fz+12;
  const s={f, i, st:ST.find(x=>x.id===f.id), L, filaZ, ativa:true, motivo:'', parouEm:0,
    colh:[], tb:null, carregando:null, fila:[], saindo:[], vindo:[], transito:Math.floor(rnd(2,6)), alvo:1+Math.floor(rnd(0,2)),
    share:rnd(0.8,1.2), nColh:1, nTb:2+Math.floor(rnd(0,3)), ritmo:0, dust:null};
  s.talhao=criarTalhao(f);
  {
    const g=makeColhedora(), row=Math.floor(rnd(0,3)), x=rnd(f.fx-18,f.fx+12);
    const c={g, x, z:rowZ(f,row), dir:1, rot:0, row, man:null, cod:String(1101+i)}; g.position.set(x,-0.6,c.z); s.colh.push(c);
    for(let r=0;r<row;r++) cortarFaixa(s.talhao,r,f.fx-30,f.fx+30);
    cortarFaixa(s.talhao,row,f.fx-30,x+4.3);
  }
  s.rebolos=[]; for(let k=0;k<28;k++){ const m=BX(0.22,0.22,0.42,MT.cana,0,-50,0); m.castShadow=false; m.visible=false; s.rebolos.push({m,vx:0,vy:0,vz:0,vida:0}); }
  const tg=makeTransbordo();
  s.tb={g:tg, x:L.x+9.6, z:L.z-3.5, y:-0.6, rot:0, speed:9, path:[], estado:'indo', t:0, fill:0, cod:String(2201+i*3)};
  tg.position.set(s.tb.x,-0.6,s.tb.z); puxarCarretas(tg); setCargaTransbordo(s.tb,0);
  s.carregando=novoCaminhaoFrente(s,L.x,L.z,0); s.carregando.fill=rnd(0,0.6); setCargaCaminhao(s.carregando,s.carregando.fill);
  for(let k=0;k<Math.min(s.alvo,FILA_MAX);k++){ const q=filaPos(s,k); s.fila.push(novoCaminhaoFrente(s,q[0],q[1],rnd(4,32))); }
  const e={origin:new THREE.Vector3(), count:10, rise:2.2, drift:2, size:1.5, rate:0.55, op:0.3, color:0xcbb68a, parts:[]};
  for(let k=0;k<e.count;k++){ const m=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1), new THREE.MeshStandardMaterial({color:lin(e.color),transparent:true,opacity:0,roughness:1,depthWrite:false})); scene.add(m); e.parts.push({m,life:k/e.count,j:Math.random()}); }
  smokeEmitters.push(e); s.dust=e;
  const po={origin:new THREE.Vector3(), count:16, rise:2.6, drift:2.4, size:2.6, rate:0.45, op:0, color:0xa58a5e, parts:[]};
  for(let k=0;k<po.count;k++){ const m=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1), new THREE.MeshStandardMaterial({color:lin(po.color),transparent:true,opacity:0,roughness:1,depthWrite:false})); scene.add(m); po.parts.push({m,life:k/po.count,j:Math.random()}); }
  smokeEmitters.push(po); s.poeira=po;
  /* caminhão pipa de prontidão no canto da área colhida */
  const pg=makePipa(), px=f.fx+20, pz=f.fz+5.8; pg.position.set(px,-0.6,pz); pg.rotation.y=Math.PI;
  const sp={origin:new THREE.Vector3(px+3.5,0.2,pz), count:16, rise:0.5, drift:3.2, size:1.1, rate:0.8, op:0, color:0xdbe7ef, parts:[]};
  for(let k=0;k<sp.count;k++){ const m=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1), new THREE.MeshStandardMaterial({color:lin(sp.color),transparent:true,opacity:0,roughness:1,depthWrite:false})); scene.add(m); sp.parts.push({m,life:k/sp.count,j:Math.random()}); }
  smokeEmitters.push(sp);
  s.pipa={g:pg, x0:px, z:pz, x:px, cod:`PI-${31+i}`, nivel:rnd(0.45,1), estado:'prontidao', t:rnd(4,18), desde:performance.now(), spray:sp, dir:-1};
  return s;
});
function filaPos(s,k){ return [s.L.x+16+k*16, s.filaZ]; }
const filaCap=s=>Math.max(1,Math.floor((estradaRect(s.f)[2]-7-(s.L.x+16))/16)+1);
/* uma frente começa parada para mostrar o alerta */
(function(){ if(Math.random()<0.75){ const s=pick(FR); s.ativa=false; s.motivo=pick(MOTIVOS_FRENTE); s.parouEm=performance.now()-rnd(8,30)*60000; } })();

const _vt=new THREE.Vector3();
function atualizarFrente(s,dt){
  const now=performance.now(), f=s.f;
  /* colhedoras */
  const FRENTE_C=4.3, xmin=f.fx-24.6, xmax=f.fx+24.6;
  s.colh.forEach(c=>{
    if(c.man){
      c.man.t+=dt; const k=ease(Math.min(1,c.man.t/c.man.dur));
      c.z=c.man.z0+(c.man.z1-c.man.z0)*k; c.rot=c.man.r0+(c.man.r1-c.man.r0)*k; c.x=c.man.x0+(c.man.x1-c.man.x0)*k;
      if(c.man.t>=c.man.dur){ if(c.man.regen){ regenerarTalhao(s.talhao); cortarFaixa(s.talhao,c.row,c.x-c.dir*4,c.x+c.dir*FRENTE_C); } c.man=null; }
    }else if(s.ativa){
      const a=c.x+c.dir*FRENTE_C; c.x+=c.dir*2.0*dt; const b=c.x+c.dir*FRENTE_C;
      cortarFaixa(s.talhao,c.row,a,b);
      if((c.dir>0 && b>xmax+0.6)||(c.dir<0 && b<xmin-0.6)){
        let prox=c.row+1, regen=false; if(prox>=TAL.NR){ prox=0; regen=true; }
        c.man={t:0,dur:regen?7:3.4,z0:c.z,z1:rowZ(f,prox),r0:c.rot,r1:c.rot+Math.PI,x0:c.x,x1:c.x+c.dir*1.2,regen};
        c.row=prox; c.dir=-c.dir; eventoCampo('manobra',s,c);
      }
    }
    c.g.position.set(c.x,-0.6,c.z); c.g.rotation.y=c.rot;
    c.g.userData.braco.rotation.y=-c.rot;
  });
  const c0=s.colh[0], colhendo=s.ativa && !c0.man;
  s.dust.op=colhendo?0.32:0;
  _vt.set(-2.35,5.4,0); c0.g.localToWorld(_vt); s.dust.origin.copy(_vt);
  s.poeira.op=colhendo?0.34:0; _vt.set(3.6,0.6,0); c0.g.localToWorld(_vt); s.poeira.origin.copy(_vt);
  /* rebolos de cana saindo do elevador para o transbordo */
  const enchendo=colhendo && s.tb.estado==='colhendo' && Math.abs(s.tb.off-(s.tb.t<3.5?4.6:10.7))<0.6;
  if(enchendo){ c0.g.userData.ponta.getWorldPosition(_vt); s._acum=(s._acum||0)+dt*34;
    while(s._acum>1){ s._acum--; const r=s.rebolos.find(q=>!q.m.visible); if(!r) break; r.m.visible=true; r.m.position.copy(_vt); r.vx=(Math.random()-.5)*0.7; r.vy=-0.6-Math.random(); r.vz=(Math.random()-.3)*0.6; r.vida=0; r.m.rotation.set(Math.random()*3,Math.random()*3,0); } }
  s.rebolos.forEach(r=>{ if(!r.m.visible) return; r.vida+=dt; r.vy-=9*dt; r.m.position.x+=r.vx*dt; r.m.position.y+=r.vy*dt; r.m.position.z+=r.vz*dt; r.m.rotation.x+=dt*6; if(r.m.position.y<2.4||r.vida>1.2) r.m.visible=false; });
  /* transbordo */
  const tb=s.tb;
  if(s.ativa){
    const bicaX=c0.x-c0.dir*2.4, alvoX=bicaX+c0.dir*(tb.off??4.6), alvoZ=c0.z+6.1;
    if(tb.estado==='indo'){ tb.off=4.6; tb.path= tb.z>s.L.z-8 && Math.abs(tb.x-s.L.x)<22 ? [[s.L.x+24, s.L.z-9],[alvoX, alvoZ]] : [[alvoX, alvoZ]]; if(moverAte(tb,dt) || (tb.path.length===1 && Math.hypot(tb.x-alvoX,tb.z-alvoZ)<0.3)) { tb.estado='colhendo'; tb.t=0; } }
    else if(tb.estado==='colhendo'){
      if(!c0.man && s.ativa) tb.t+=dt; const offAlvo=tb.t<3.5?4.6:10.7; tb.off+=(offAlvo-tb.off)*Math.min(1,dt*1.5);
      tb.x=bicaX+c0.dir*tb.off; tb.z=alvoZ; tb.g.position.set(tb.x,-0.6,tb.z); virar(tb,Math.atan2(0,c0.dir),dt);
      tb.fill=Math.min(1,tb.t/7); setCargaTransbordo(tb,tb.fill);
      if(tb.t>=7){ tb.estado='voltando'; tb.path=[[s.L.x-16, s.L.z-9],[s.L.x-4, s.L.z-3.5],[s.L.x+9.6, s.L.z-3.5]]; }
    }
    else if(tb.estado==='voltando'){ if(moverAte(tb,dt)){ tb.estado='aguardando'; } }
    else if(tb.estado==='aguardando'){ virar(tb,0,dt); if(s.carregando && !s.carregando.path.length){ tb.estado='basculando'; tb.t=0; eventoCampo('basculando',s,s.carregando); } }
    else if(tb.estado==='basculando'){
      tb.t+=dt; virar(tb,0,dt);
      const a=tb.t<1?tb.t:tb.t<2.2?1:Math.max(0,3.2-tb.t);
      bascular(tb,a);
      if(tb.t>1 && tb.t<2.2){ tb.fill=Math.max(0,1-(tb.t-1)/1.2); setCargaTransbordo(tb,tb.fill); s.carregando.fill=Math.min(1,s.carregando.fill+dt*0.34/1.2); setCargaCaminhao(s.carregando,s.carregando.fill); }
      if(tb.t>=3.2){ bascular(tb,0); tb.fill=0; setCargaTransbordo(tb,0); tb.estado='indo'; }
    }
  }
  puxarCarretas(tb.g);
  /* caminhão cheio sai para a usina */
  if(s.carregando && s.carregando.fill>=0.99 && tb.estado!=='basculando'){
    const t=s.carregando; t.path=[[s.L.x-14,s.L.z],[s.L.x-22,s.filaZ],[estradaRect(f)[0]+4,s.filaZ]]; t.speed=10;
    t.ton=Math.round(rnd(48,62)); s.saindo.push(t); s.carregando=null; eventoCampo('saiuCarregado',s,t);
  }
  /* próximo da fila entra para carregar */
  if(!s.carregando && s.fila.length){
    const t=s.fila.shift(); t.path=[[s.L.x+6,s.filaZ],[s.L.x+3,s.L.z],[s.L.x,s.L.z]]; t.inicioCarga=now; s.carregando=t;
  }
  if(s.carregando){ const t=s.carregando; if(moverSeguro(s,t,dt)) virar(t,Math.PI,dt); }
  s.fila.forEach((t,k)=>{ const q=filaPos(s,k); if(t.path.length===0 && (Math.abs(t.x-q[0])>0.1)) t.path=[q]; if(moverSeguro(s,t,dt)) virar(t,Math.PI,dt); });
  for(let k=s.saindo.length-1;k>=0;k--){
    const t=s.saindo[k];
    if(moverSeguro(s,t,dt)){ scene.remove(t.g); s.saindo.splice(k,1); }
  }
  /* chegada dos vazios que o CCO despachou para esta frente (nunca passa de FILA_MAX na fila) */
  const v=s.vindo.find(x=>x.pronto);
  if(v){
    const xSp=estradaRect(f)[2]-4, livre=![...s.fila,...s.saindo].some(o=>Math.abs(o.x-xSp)<16 && Math.abs(o.z-s.filaZ)<3);
    if(livre && s.fila.length<Math.min(FILA_MAX,filaCap(s))){
      s.vindo.splice(s.vindo.indexOf(v),1);
      const q=filaPos(s,s.fila.length), t=novoCaminhaoFrente(s,xSp,s.filaZ,0); t.frota=v.frota; t.path=[q]; s.fila.push(t);
      if(typeof chegouNaFrente==='function') chegouNaFrente(v,s);
    }
  }
  atualizarPipa(s,dt);
}

const ESTADO_PIPA={prontidao:'De prontidão',molhando:'Molhando a área de manobra',abastecendo:'Reabastecendo'};
function atualizarPipa(s,dt){
  const p=s.pipa; if(!p) return;
  p.t-=dt;
  if(p.estado==='molhando'){
    p.nivel=Math.max(0,p.nivel-dt*0.012);
    p.x+=p.dir*dt*0.6; if(p.x<p.x0-2){ p.x=p.x0-2; p.dir=1; } if(p.x>p.x0){ p.x=p.x0; p.dir=-1; }
    p.g.position.x=p.x; p.spray.origin.set(p.x+3.5,0.2,p.z);
  }
  p.spray.op=p.estado==='molhando'?0.42:0;
  if(p.t<=0){
    const novo = p.estado==='molhando' ? (p.nivel<0.2?'abastecendo':'prontidao')
               : p.estado==='abastecendo' ? 'prontidao'
               : (s.ativa || !/chuva/i.test(s.motivo)) ? 'molhando' : 'prontidao';
    if(p.estado==='abastecendo') p.nivel=1;
    if(novo!==p.estado) eventoCampo('pipa',s,{...p,estado:novo});
    p.estado=novo; p.desde=performance.now(); p.t= novo==='molhando'?rnd(10,18): novo==='abastecendo'?rnd(8,12): rnd(14,28);
  }
}
function itensFrente(s){
  const now=performance.now(), it=[];
  if(!s.ativa) s.colh.forEach((c,k)=>it.push({cod:`Colhedora CH-${String(s.i*2+k+1).padStart(2,'0')}`, origem:`Parada: ${s.motivo}`, el:Math.round((now-s.parouEm)/60000), status:'stop'}));
  if(s.carregando){ const t=s.carregando; it.push({cod:`Frota ${t.frota}`, origem:`Carregando, ${Math.round(t.fill*100)}% cheio`, el:Math.round(t.base+(now-(t.inicioCarga||t.chegou))/60000)}); }
  s.fila.forEach(t=>it.push({cod:`Frota ${t.frota}`, origem:'Aguardando carregamento', el:Math.round(t.base+(now-t.chegou)/60000)}));
  s.vindo.forEach(v=>it.push({cod:`Frota ${v.frota}`, origem:`Vazio vindo da usina, chega em ${fmt(faltaMin(v))}`, el:Math.round(v.min-faltaMin(v)), status:'none'}));
  if(s.pipa) it.push({cod:`Caminhão pipa ${s.pipa.cod}`, origem:`${ESTADO_PIPA[s.pipa.estado]}, ${Math.round(s.pipa.nivel*100)}% de água`, el:Math.round((now-s.pipa.desde)/60000), status:'none'});
  return it;
}
function atualizarFrentesST(redesenhar){
  FR.forEach(s=>{
    const st=s.st;
    st.items=itensFrente(s).map(i=>({...i, status:i.status||(i.el>st.sla?'red':i.el>=st.sla*0.8?'warn':'ok')}))
      .sort((a,b)=>SEV[a.status]-SEV[b.status] || b.el-a.el);
    if(redesenhar) cubosDe(st);
  });
  if(redesenhar){ atualizarRotulos(); desenharFrentes(); if(painelAtual && painelAtual.area==='colheita') abrirPainel(painelAtual); }
}
function ressortearFrentes(){
  FR.forEach(s=>{
    s.alvo=1+Math.floor(rnd(1,4));
    if(!s.ativa && Math.random()<0.25){ s.ativa=true; s.motivo=''; }
    s.ritmo=s.ativa? s.nColh*rnd(22,30) : 0;
  });
}
const filaTotal=()=>FR.reduce((a,s)=>a+s.fila.length,0);

/* ciclo do caminhão (CCT): ida e volta até a frente, fila e carregamento no campo, e o tempo dentro da usina */
const VEL_CAMINHAO=35, TEMPO_CARREGAR=25;   /* km/h médio na estrada e carreador, minutos para encher o caminhão */
function permanenciaUsina(){
  const med=id=>{ const it=(ST.find(x=>x.id===id)||{items:[]}).items; return it.length?it.reduce((a,i)=>a+i.el,0)/it.length:0; };
  return med('balanca')+med('laboratorio')+med('hilo');
}
function cicloFrente(s,esperaMedia){ return Math.round(2*s.f.km/VEL_CAMINHAO*60 + esperaMedia + TEMPO_CARREGAR + permanenciaUsina()); }
function desenharFrentes(){
  const el=document.getElementById('gFrentes'); if(!el) return;
  const tot=total24(), somaShare=FR.reduce((a,s)=>a+(s.ativa?s.share:s.share*0.6),0);
  const now=performance.now();
  const resumo=FR.map(s=>{ const esp=s.fila.map(t=>Math.round(t.base+(now-t.chegou)/60000)); const em=esp.length?esp.reduce((a,b)=>a+b,0)/esp.length:0;
    return {s, peso:Math.max(0.01,s.ativa?s.share:s.share*0.6), ciclo:cicloFrente(s,em)}; });
  const somaP=resumo.reduce((a,r)=>a+r.peso,0);
  const raio=resumo.reduce((a,r)=>a+r.s.f.km*r.peso,0)/somaP, cicloMed=Math.round(resumo.reduce((a,r)=>a+r.ciclo*r.peso,0)/somaP);
  FR.forEach((s,k)=>s.ciclo=resumo[k].ciclo);
  document.getElementById('gFrTrio').innerHTML=[
    [filaTotal(),'caminhões aguardando'],[FR.filter(s=>s.carregando).length,'carregando agora'],[FR.reduce((a,s)=>a+s.transito,0),'carregados a caminho da usina'],[FR.reduce((a,s)=>a+s.vindo.length,0),'vazios a caminho das frentes'],
    [nf(raio,1)+' km','de raio médio (pelo que cada frente colhe)'],[fmt(cicloMed),'de ciclo médio do caminhão, da usina à frente e de volta']
  ].map(([n,l])=>`<div><b>${n}</b><span>${l}</span></div>`).join('');
  FR.forEach(s=>{
    const f=s.f, ton=tot*(s.ativa?s.share:s.share*0.6)/somaShare;
    const esperas=s.fila.map(t=>Math.round(t.base+(now-t.chegou)/60000)), maior=esperas.length?Math.max(...esperas):0;
    let b=s.btn;
    if(!b){
      b=s.btn=document.createElement('button'); b.type='button'; b.className='fr';
      b.addEventListener('click',()=>{ irPara3D(); flyTo(f.fx-3,f.fz+1,60); abrirPainel(s.st); });
      el.appendChild(b);
    }
    const car=s.carregando;
    b.innerHTML=`<div class="fr-top"><b>${f.nome}</b><span class="chip ${s.ativa?'ok':'stop'}">${s.ativa?'Colhendo':'Parada'}</span></div>
      <small>${f.fazenda}, ${f.talhao}, ${f.km} km da usina, ciclo de ${fmt(s.ciclo)}${s.ativa?'':`. ${s.motivo}`}</small>
      <div class="fr-nums"><span><b>${nf(ton)} t</b>colhidas no dia</span><span><b>${nf(s.ritmo)} t/h</b>ritmo agora</span><span><b>${s.nColh} e ${s.nTb}</b>colhedoras e transbordos</span></div>
      <div class="fr-load"><span>${car?`Carregando frota ${car.frota}`:'Nenhum caminhão carregando'}</span><span>${car?Math.round(car.fill*100)+'%':''}</span></div>
      <div class="pbar"><i style="width:${car?car.fill*100:0}%"></i></div>
      <div class="fr-fila ${maior>40?'late':''}">${s.fila.length} de ${FILA_MAX} na fila${s.fila.length?`, maior espera ${fmt(maior)}`:''}. ${s.vindo.length?`${s.vindo.length} vazio vindo, chega em ${fmt(Math.min(...s.vindo.map(faltaMin)))}. `:''}${s.transito} carregado a caminho da usina.</div>
      ${s.pipa?`<div class="fr-pipa"><span>Pipa ${s.pipa.cod}: ${ESTADO_PIPA[s.pipa.estado].toLowerCase()}</span><span class="agua"><i style="width:${Math.round(s.pipa.nivel*100)}%"></i></span><span>${Math.round(s.pipa.nivel*100)}% de água</span></div>`:''}`;
  });
}
