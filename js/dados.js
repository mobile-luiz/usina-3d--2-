/* Usina em 3D: Dados simulados das etapas, cubos de status, etiquetas, indicadores e painel de detalhes da etapa. */
"use strict";

/* ---------- Dados (simulados) ---------- */
const FAZ=['Faz. Santa Rita','Eng. Bom Jesus','Faz. Pindorama','Sítio Riacho Doce','Faz. Boa Vista','Eng. Novo','Faz. Serra Verde','Eng. Cachoeira'];
const CLI=['Distribuidora Nordeste','Refinaria Atlântico','Exportação Suape','Atacado Agreste'];
const SEV={red:0,warn:1,back:2,stop:3,ok:4,none:5};
const COL={red:0xd1453b,warn:0xe3a12f,stop:0x8665c9,ok:0x3f9a57,none:0x8a949c,back:0x2f7fc1};
const VAR={red:'--red',warn:'--warn',stop:'--purple',ok:'--ok',none:'--grey',back:'--blue'};
const LBL={red:'estouradas',warn:'perto',stop:'paradas',ok:'no prazo',none:'sem prazo',back:'reprocesso'};
const rnd=(a,b)=>a+Math.random()*(b-a), pick=a=>a[Math.floor(Math.random()*a.length)];

function origem(st){
  const t=Math.round(rnd(38,62));
  if(st.id==='laboratorio') return `${pick(FAZ)}, ${t} t, ATR ${Math.round(rnd(118,152))}, impureza ${rnd(5.5,14).toFixed(1).replace('.',',')} kg/t`;
  if(st.area==='recepcao') return `${pick(FAZ)}, ${t} t, ATR ${Math.round(rnd(118,152))}`;
  if(st.id==='carregamento') return `${pick(CLI)}, ${Math.round(rnd(30,40))} t`;
  if(st.id==='tanques') return `Etanol ${pick(['hidratado','anidro'])}, ${rnd(0.6,2.4).toFixed(1).replace('.',',')} mi L`;
  if(st.id==='cogeracao') return `${Math.round(rnd(18,32))} MW gerados`;
  if(st.id==='armazem') return `Açúcar VHP, ${Math.round(rnd(400,1800))} t`;
  if(st.area==='destilaria') return `${Math.round(rnd(180,320))} m³`;
  return `${t*4} t`;
}
function gerarDados(){
  let seq = 4800 + Math.floor(Math.random()*100);
  const paradaEm = pick(ST.filter(s=>s.sla)).id;
  ST.forEach(st=>{
    const n=Math.max(1,Math.round(st.base*rnd(0.7,1.3)));
    st.items=[];
    for(let i=0;i<n;i++){
      let status, el;
      if(!st.sla){ status='none'; el=Math.round(rnd(20,900)); }
      else{
        const r=Math.random();
        el=Math.max(1,Math.round(st.sla*(r<0.11?rnd(1.05,1.8):r<0.24?rnd(0.8,0.99):rnd(0.05,0.78))));
        status = el>st.sla?'red':el>=st.sla*0.8?'warn':'ok';
        if(st.id===paradaEm && i<2) status='stop';
        if(['cozimento','centrifugacao','secagem'].includes(st.id) && Math.random()<0.08) status='back';
      }
      const cod = ['Dorna','Tanque','Turbogerador','Pilha'].includes(st.pre) ? `${st.pre} ${i+1}` : `${st.pre} ${seq++}`;
      const it={cod, origem:origem(st), el, status};
      if(st.area==='recepcao') it.atr=+it.origem.match(/ATR (\d+)/)[1];
      st.items.push(it);
    }
    st.items.sort((a,b)=>SEV[a.status]-SEV[b.status] || b.el-a.el);
  });
  /* recepção real vinda da balança, quando o server.js estiver rodando */
  if(aoVivo && api && api.recepcao){
    ST.filter(st=>st.area==='recepcao').forEach(st=>{
      st.items=(api.recepcao[st.id]||[]).map(it=>({...it, status: it.el>st.sla?'red':it.el>=st.sla*0.8?'warn':'ok'}));
      st.items.sort((a,b)=>SEV[a.status]-SEV[b.status] || b.el-a.el);
    });
  }
}

/* cubos por etapa */
const cubeGeo=new THREE.BoxGeometry(0.85,0.85,0.85);
const diaGeo=new THREE.OctahedronGeometry(0.6,0);
function montarCubos(){ ST.forEach(cubosDe); }
function cubosDe(st){
  {
    while(st.group.children.length) st.group.remove(st.group.children[0]);
    const gap=1.25, cols=Math.max(1,Math.floor((st.w-1.2)/gap)), rows=Math.max(1,Math.floor((st.d/2-0.6)/gap));
    const x0=st.x-(cols-1)*gap/2, z0=st.z+0.5;
    st.items.slice(0,cols*rows*2).forEach((it,i)=>{
      const layer=Math.floor(i/(cols*rows)), k=i%(cols*rows);
      const c=k%cols, r=Math.floor(k/cols);
      const geo = it.status==='back'?diaGeo:cubeGeo;
      const m=new THREE.Mesh(geo, mat(COL[it.status]));
      m.position.set(x0+c*gap, (st.y||0)+0.49+layer*0.9, z0+r*gap);
      m.castShadow=true; st.group.add(m);
    });
  }
}

/* ---------- Rótulos HTML ---------- */
const tri='<svg viewBox="0 0 10 10"><path d="M5 1 9.5 9h-9z" fill="currentColor"/></svg>';
const overlays=[];
ST.forEach(st=>{
  const b=document.createElement('button');
  b.type='button'; b.className='tag';
  b.addEventListener('click',()=>abrirPainel(st));
  labelsEl.appendChild(b);
  st.label=b;
  overlays.push({el:b, pos:new THREE.Vector3(st.x,(st.y||0)+0.6,st.z+st.d/2), area:st.area});
});
Object.entries(AREAS).forEach(([k,a])=>{
  if(!a.tag) return;
  const d=document.createElement('div'); d.className='area'; d.textContent=a.nome;
  labelsEl.appendChild(d);
  overlays.push({el:d, pos:new THREE.Vector3(...a.tag), area:k});
});
[['area','Casa de cana',[-54,14.5,-16],'recepcao'],['dock','Esteira de cana',[-38.5,6.4,-21],'recepcao'],['dock','Mesa alimentadora',[-45.6,3.2,-24],'recepcao']].forEach(([cls,txt,pos,area])=>{
  const d=document.createElement('div'); d.className=cls; d.textContent=txt; labelsEl.appendChild(d); overlays.push({el:d,pos:new THREE.Vector3(...pos),area});
});
[['Garra',()=>CASA.garra&&CASA.garra.position,1.6,'recepcao'],['Retroescavadeira',()=>BAG.g&&BAG.g.position,5,'energia']].forEach(([txt,fn,dy,area])=>{
  const d=document.createElement('div'); d.className='dock'; d.textContent=txt; labelsEl.appendChild(d); overlays.push({el:d,seguir:fn,dy,area});
});
[['area','Pátio de bagaço',[-58,9,-40],'energia'],['dock','Moega da caldeira',[-39.5,4.4,-41.6],'energia'],['dock','Esteira de bagaço',[-46,7.6,-31.5],'energia']].forEach(([cls,txt,pos,area])=>{
  const d=document.createElement('div'); d.className=cls; d.textContent=txt; labelsEl.appendChild(d); overlays.push({el:d,pos:new THREE.Vector3(...pos),area});
});
(function(){ const d=document.createElement('div'); d.className='dock'; d.textContent='Docas de carregamento'; labelsEl.appendChild(d); overlays.push({el:d,pos:new THREE.Vector3(55,1,37),area:'expedicao'}); })();

function atualizarRotulos(){
  ST.forEach(st=>{
    const red=st.items.filter(i=>i.status==='red').length;
    st.label.innerHTML=`${st.nome} <span class="n">${st.items.length}</span>${red?`<span class="al">${tri}${red}</span>`:''}`;
    st.label.setAttribute('aria-label',`${st.nome}: ${st.items.length} em andamento, ${red} estouradas`);
  });
}
const vtmp=new THREE.Vector3();
const popups=[];
function descarregar(t){
  t.g.userData.carga.forEach(m=>m.visible=false);
  estoque+=t.ton;
  t.frota=t.frota||novaFrota(); eventoCampo('descarga',null,t);
  descarregadas.push({ton:t.ton, quando:Date.now()});
  const el=document.createElement('div'); el.className='pop'; el.textContent=`+${t.ton} t descarregadas`;
  labelsEl.appendChild(el);
  popups.push({el, pos:new THREE.Vector3(-62,6,-14), t0:performance.now()});
}
function posicionarRotulos(){
  const w=stage.clientWidth, h=stage.clientHeight;
  for(let i=popups.length-1;i>=0;i--){
    const p=popups[i], k=(performance.now()-p.t0)/2200;
    if(k>=1){ p.el.remove(); popups.splice(i,1); continue; }
    vtmp.copy(p.pos); vtmp.y+=k*5; vtmp.project(camera);
    p.el.style.opacity=k<0.15?k/0.15:1-Math.max(0,(k-0.6)/0.4);
    p.el.style.transform=`translate(${(vtmp.x+1)/2*w}px,${(1-vtmp.y)/2*h}px) translate(-50%,-50%)`;
  }
  overlays.forEach(o=>{
    if(o.seguir){ const q=o.seguir(); if(!q){ o.el.style.display='none'; return; } vtmp.set(q.x,q.y+(o.dy||0),q.z); }
    else vtmp.copy(o.pos);
    vtmp.project(camera);
    if(vtmp.z>1){ o.el.style.display='none'; return; }
    o.el.style.display='';
    const x=(vtmp.x+1)/2*w, y=(1-vtmp.y)/2*h;
    o.el.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;
  });
}

/* ---------- KPIs ---------- */
function fmt(m){ if(m>=2880){ const d=Math.floor(m/1440), h=Math.floor((m%1440)/60); return `${d}d ${h}h`; } return m<60?`${m} min`:`${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}`; }
function atualizarKpis(){
  const all=ST.flatMap(s=>s.items);
  const c=s=>all.filter(i=>i.status===s).length;
  const rec=ST.filter(s=>s.area==='recepcao').flatMap(s=>s.items);
  const atr=Math.round(rec.reduce((a,i)=>a+(i.atr||0),0)/Math.max(1,rec.length));
  const chips=[
    [all.length,'em andamento'],[c('red'),'com etapa estourada'],[c('warn'),'perto de estourar'],
    [c('back'),'voltaram para reprocesso'],[c('stop'),'parados'],
    [rec.length,'cargas de cana no pátio','op'],[filaTotal(),'caminhões aguardando nas frentes','op'],[OFI.veiculos.length,'veículos na oficina','op']
  ];
  /* dois grupos: situação das etapas e operação (pátio, frentes e oficina) */
  document.getElementById('kpis').innerHTML=chips.map(([n,l,k],i)=>(k&&!chips[i-1][2]?'<i class="kdiv" aria-hidden="true"></i>':'')+`<div class="kpi ${k||''}"><b>${n}</b><span>${l}</span></div>`).join('');
  const d=new Date();
  document.getElementById('stamp').textContent=`Atualizado às ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} e recarrega a cada minuto. `+(aoVivo?'Recepção e moagem vêm da balança; as demais etapas ainda são simuladas.':'Dados simulados.');
}

/* ---------- Painel lateral ---------- */
const panel=document.getElementById('panel');
let painelAtual=null;
function abrirPainel(st){
  if(typeof CARD !== 'undefined' && CARD.rec) fecharCaminhao();
  painelAtual=st;
  document.getElementById('pTitle').textContent=st.nome;
  document.getElementById('pSub').textContent=`${AREAS[st.area].nome}. ${st.area==='colheita'?`Espera máxima para carregar: ${fmt(st.sla)}`:st.sla?`Prazo da etapa: ${fmt(st.sla)}`:'Etapa sem prazo definido'}`;
  const cont={}; st.items.forEach(i=>cont[i.status]=(cont[i.status]||0)+1);
  document.getElementById('pSum').innerHTML=Object.keys(SEV).filter(k=>cont[k]).map(k=>`<span><i class="sw" style="background:var(${VAR[k]})"></i>${cont[k]} ${LBL[k]}</span>`).join('');
  document.getElementById('pList').innerHTML=st.items.map(i=>`
    <li><span class="dot" style="background:var(${VAR[i.status]})"></span>
      <div><b>${i.cod}</b><small>${i.origem}</small></div>
      <span class="tm ${i.status==='red'?'late':''}">${fmt(i.el)}${st.sla&&i.status!=='none'?`<br><small>de ${fmt(st.sla)}</small>`:''}</span></li>`).join('');
  const frs=FR.find(x=>x.st===st), bs=document.getElementById('pSeguir'); bs.hidden=!frs; bs.onclick=()=>{ seguirColhedora(frs); fecharPainel(); };
  panel.hidden=false;
}
function fecharPainel(){ panel.hidden=true; painelAtual=null; }
document.getElementById('pClose').addEventListener('click',fecharPainel);
addEventListener('keydown',e=>{ if(e.key==='Escape') fecharPainel(); });
