/* Usina em 3D: Gráficos do painel gerencial com Chart.js. */
"use strict";

/* ---------- Painel gerencial ---------- */

/* ---------- Gráficos (Chart.js), com reserva em SVG se a biblioteca não carregar ---------- */
const CJ={};
const cv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function rgba(hex,a){ hex=hex.replace('#',''); if(hex.length===3) hex=hex.split('').map(c=>c+c).join(''); const n=parseInt(hex,16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; }
function canvasEm(id,h){
  const el=document.getElementById(id);
  if(!el._cv){ el.innerHTML=''; el.style.height=h+'px'; el.style.position='relative'; const c=document.createElement('canvas'); el.appendChild(c); el._cv=c; }
  return el._cv;
}
function opcoesBase(){
  const muted=cv('--muted'), line=cv('--line'), ink=cv('--ink'), panel=cv('--panel');
  return {
    responsive:true, maintainAspectRatio:false, animation:{duration:450},
    interaction:{mode:'index',intersect:false},
    plugins:{
      legend:{position:'bottom',labels:{boxWidth:9,boxHeight:9,usePointStyle:true,pointStyle:'rectRounded',color:muted,padding:12,font:{family:'Barlow',size:11.5}}},
      tooltip:{backgroundColor:ink,titleColor:panel,bodyColor:panel,titleFont:{family:'Barlow',weight:'600',size:12.5},bodyFont:{family:'Barlow',size:12},padding:10,cornerRadius:8,boxPadding:4,usePointStyle:true}
    },
    scales:{
      x:{grid:{display:false},border:{color:line},ticks:{color:muted,font:{family:'Barlow',size:10.5},maxRotation:0,autoSkip:false}},
      y:{grid:{color:rgba(line.startsWith('#')?line:'#d6dccf',0.9)},border:{display:false},ticks:{color:muted,font:{family:'Barlow',size:10.5},callback:v=>nf(v)}}
    }
  };
}
const pluginTurnos={
  id:'turnos',
  afterDatasetsDraw(ch){
    const {ctx,chartArea:a,scales:{x}}=ch; if(!ch.options.plugins.turnos) return;
    ctx.save(); ctx.font='600 11px Barlow, sans-serif'; ctx.fillStyle=cv('--muted'); ctx.textAlign='center';
    SAFRA.turnos.forEach(tr=>{
      const passo=ch.options.plugins.turnos.passo||1;
      const x0=tr.de===0?a.left:(x.getPixelForValue(tr.de*passo-1)+x.getPixelForValue(tr.de*passo))/2;
      const fim=tr.ate*passo, x1=fim>=x.max+1?a.right:(x.getPixelForValue(fim-1)+x.getPixelForValue(fim))/2;
      if(tr.de>0){ ctx.strokeStyle=rgba(cv('--muted').startsWith('#')?cv('--muted'):'#5d6b61',0.55); ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(x0,a.top); ctx.lineTo(x0,a.bottom); ctx.stroke(); }
      ctx.fillText(`Turno ${tr.id}`,(x0+x1)/2,a.top+11);
    });
    ctx.restore();
  }
};

function dadosHora(){
  const i=iniHoje().getTime(), agoraH=new Date(); agoraH.setMinutes(0,0,0);
  const labels=[], hoje=[], ontem=[], cores=[], par=[];
  for(let k=0;k<24;k++){
    const ini=i+k*H, h=hist.find(b=>b.ini.getTime()===ini), o=hist.find(b=>b.ini.getTime()===ini-24*H);
    labels.push(String((SAFRA.horaInicio+k)%24).padStart(2,'0')+'h');
    hoje.push(h?Math.round(h.t):null); ontem.push(o?Math.round(o.t):null); par.push(h?h.par:0);
    const atual=h && h.ini.getTime()===agoraH.getTime();
    cores.push(!h?'transparent': h.par?cv('--red'): atual?rgba(cv('--ok'),0.5): h.t>=META_H*0.97?cv('--ok'):cv('--warn'));
  }
  return {labels,hoje,ontem,cores,par};
}
function graficoHora(){
  const d=dadosHora(), c=canvasEm('gChart',230);
  if(!CJ.hora){
    const o=opcoesBase();
    o.plugins.turnos={passo:1};
    o.scales.y.suggestedMax=720; o.scales.y.beginAtZero=true;
    o.scales.x.ticks.callback=function(v,i){ return i%3===0?this.getLabelForValue(v):''; };
    o.plugins.tooltip.callbacks={
      title:it=>{ const k=it[0].dataIndex; return `${d.labels[k]} às ${String((SAFRA.horaInicio+k+1)%24).padStart(2,'0')}h`; },
      label:it=>it.raw==null?null:`${it.dataset.label}: ${nf(it.raw)} t`,
      afterBody:it=>{ const p=CJ.hora._par[it[0].dataIndex]; return p?`Parada de ${p} min nesta hora`:''; }
    };
    o.plugins.legend.display=false;
    CJ.hora=new Chart(c,{type:'bar',plugins:[pluginTurnos],options:o,data:{labels:d.labels,datasets:[
      {type:'bar',label:'Hoje',data:d.hoje,backgroundColor:d.cores,borderRadius:4,borderSkipped:false,categoryPercentage:0.86,barPercentage:0.92,order:2},
      {type:'line',label:'Ontem',data:d.ontem,borderColor:rgba(cv('--muted'),0.75),backgroundColor:rgba(cv('--muted'),0.75),borderWidth:1.6,borderDash:[4,3],pointRadius:0,pointHoverRadius:3,tension:0.35,order:1},
      {type:'line',label:'Meta',data:d.labels.map(()=>Math.round(META_H)),borderColor:rgba(cv('--ink'),0.55),borderWidth:1.2,borderDash:[6,4],pointRadius:0,pointHoverRadius:0,order:0}
    ]}});
  }else{
    const ds=CJ.hora.data.datasets; ds[0].data=d.hoje; ds[0].backgroundColor=d.cores; ds[1].data=d.ontem; ds[2].data=d.labels.map(()=>Math.round(META_H));
    CJ.hora.data.labels=d.labels; CJ.hora.update('none');
  }
  CJ.hora._par=d.par;
}

function dadosAcum(){
  const i=iniHoje().getTime(), agora=Date.now(), labels=[], hoje=[], ontem=[], meta=[], proj=[];
  let ah=0, ao=0; const kAgora=Math.floor((agora-i)/H);
  for(let k=0;k<=24;k++){
    labels.push(String((SAFRA.horaInicio+k)%24).padStart(2,'0')+'h');
    meta.push(Math.round(META_DIA*k/24));
    ontem.push(Math.round(ao)); 
    if(k<=kAgora) hoje.push(Math.round(ah)); else hoje.push(null);
    const h=hist.find(b=>b.ini.getTime()===i+k*H), o=hist.find(b=>b.ini.getTime()===i+(k-24)*H);
    if(h) ah+=h.t; if(o) ao+=o.t;
  }
  /* ponto de agora (fração da hora) e projeção no ritmo atual */
  const frac=(agora-i)/H - kAgora, totalAgora=totalDia();
  for(let k=0;k<=24;k++) proj.push(null);
  hoje[kAgora+1]=null;
  proj[kAgora]=hoje[kAgora];
  for(let k=kAgora+1;k<=24;k++) proj[k]=Math.round(totalAgora+ritmo*(k-kAgora-frac));
  return {labels,hoje,ontem,meta,proj,kAgora,totalAgora};
}
function graficoAcum(){
  const el=document.getElementById('gAcum'); if(!el) return;
  const d=dadosAcum(), c=canvasEm('gAcum',220);
  if(!CJ.acum){
    const o=opcoesBase();
    o.scales.y.beginAtZero=true; o.scales.y.suggestedMax=META_DIA*1.05;
    o.scales.x.ticks.callback=function(v,i){ return i%4===0?this.getLabelForValue(v):''; };
    o.plugins.tooltip.callbacks={ label:it=>it.raw==null?null:`${it.dataset.label}: ${nf(it.raw)} t` };
    const g=c.getContext('2d').createLinearGradient(0,0,0,220); g.addColorStop(0,rgba(cv('--ok'),0.35)); g.addColorStop(1,rgba(cv('--ok'),0.02));
    CJ.acum=new Chart(c,{type:'line',options:o,data:{labels:d.labels,datasets:[
      {label:'Hoje',data:d.hoje,borderColor:cv('--ok'),backgroundColor:g,fill:true,borderWidth:2.4,pointRadius:0,pointHoverRadius:4,tension:0.25},
      {label:'Projeção no ritmo atual',data:d.proj,borderColor:cv('--ok'),borderDash:[5,4],borderWidth:1.8,pointRadius:0,tension:0},
      {label:'Ontem',data:d.ontem,borderColor:rgba(cv('--muted'),0.8),borderWidth:1.6,borderDash:[2,3],pointRadius:0,tension:0.25},
      {label:'Meta',data:d.meta,borderColor:rgba(cv('--ink'),0.6),borderWidth:1.3,borderDash:[7,4],pointRadius:0,tension:0}
    ]}});
  }else{
    const ds=CJ.acum.data.datasets; ds[0].data=d.hoje; ds[1].data=d.proj; ds[2].data=d.ontem; ds[3].data=d.meta; CJ.acum.update('none');
  }
  const proj=d.proj[24]??d.totalAgora, dif=proj-META_DIA;
  document.getElementById('gAcumTxt').innerHTML=`No ritmo atual o dia fecha com <b>${nf(proj)} t</b>, ${dif>=0?`${nf(dif)} t acima`:`${nf(-dif)} t abaixo`} da meta.`;
}

function graficoSafra(){
  const ult=dias.slice(-30), c=canvasEm('gSafraChart',190);
  const labels=ult.map(d=>dm(d.ini)), vals=ult.map(d=>Math.round(d.t));
  const cores=ult.map(d=>d.t>=META_DIA*0.97?cv('--ok'):d.t>=META_DIA*0.8?cv('--warn'):cv('--red'));
  const mm=vals.map((_,i)=>{ const j=vals.slice(Math.max(0,i-6),i+1); return Math.round(j.reduce((a,b)=>a+b,0)/j.length); });
  if(!CJ.safra){
    const o=opcoesBase();
    o.scales.y.beginAtZero=true; o.scales.y.suggestedMax=16000;
    o.scales.x.ticks.callback=function(v,i){ return i%5===0?this.getLabelForValue(v):''; };
    o.plugins.tooltip.callbacks={ label:it=>`${it.dataset.label}: ${nf(it.raw)} t`, afterBody:it=>{ const d=CJ.safra._dias[it[0].dataIndex]; return d&&d.atr?`ATR ${d.atr} kg/t`:''; } };
    o.plugins.legend.labels.filter=l=>l.text!=='Meta diária';
    CJ.safra=new Chart(c,{type:'bar',options:o,data:{labels,datasets:[
      {type:'bar',label:'Moagem do dia',data:vals,backgroundColor:cores,borderRadius:3,categoryPercentage:0.86,barPercentage:0.9,order:2},
      {type:'line',label:'Média de 7 dias',data:mm,borderColor:cv('--blue'),backgroundColor:cv('--blue'),borderWidth:2,pointRadius:0,tension:0.35,order:1},
      {type:'line',label:'Meta diária',data:vals.map(()=>META_DIA),borderColor:rgba(cv('--ink'),0.55),borderWidth:1.2,borderDash:[6,4],pointRadius:0,order:0}
    ]}});
  }else{
    CJ.safra.data.labels=labels; const ds=CJ.safra.data.datasets; ds[0].data=vals; ds[0].backgroundColor=cores; ds[1].data=mm; ds[2].data=vals.map(()=>META_DIA); CJ.safra.update('none');
  }
  CJ.safra._dias=ult;
}
