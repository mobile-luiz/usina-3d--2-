/* Usina em 3D: Dia safra, turnos, safra e todas as seções do painel gerencial, exportação em CSV. */
"use strict";

/* ---------- Dia safra, turnos e safra ---------- */
const SAFRA = {
  horaInicio: 7,                                   /* o dia safra vai das 07:00 às 07:00 */
  turnos: [{id:'A',de:0,ate:8},{id:'B',de:8,ate:16},{id:'C',de:16,ate:24}],  /* horas contadas a partir das 07:00 */
  inicio: '2026-08-17',                            /* primeiro dia da safra */
  fimPlanejado: '2026-12-20',                      /* último dia planejado da safra */
  meta: 1750000                                    /* meta de moagem da safra, em t */
};
let META_DIA=14400, META_H=META_DIA/24;
const H=3600e3;
/* motivos de parada e a categoria de cada um (a categoria mostra de quem é a parada: indústria, campo ou clima) */
const CAT_PARADA={
  'Troca de facas do preparo':'Industrial','Embuchamento na moenda':'Industrial','Manutenção na caldeira':'Industrial','Quebra de corrente da esteira':'Industrial',
  'Falta de cana no pátio':'Agrícola','Atraso de caminhões das frentes':'Agrícola',
  'Chuva na frente de corte':'Clima',
  'Queda de energia da rede':'Externa'
};
const MOTIVOS=Object.keys(CAT_PARADA);
const COR_CAT={Industrial:'var(--red)',Agrícola:'var(--warn)',Clima:'var(--blue)',Externa:'var(--purple)',Outros:'var(--grey)'};
const catParada=p=>p.categoria||CAT_PARADA[p.motivo]||'Outros';
/* qualidade da cana (laboratório PCTS) e do açúcar VHP. Os limites são referências: ajuste conforme o contrato e a usina */
const LIM_QUAL={impMin:{alerta:10,ruim:13}, impVeg:{alerta:8,ruim:10}, cor:{alerta:1000,ruim:1200}, pol:{alerta:99.2,ruim:99.0}, umid:{alerta:0.12,ruim:0.15}};
let qual={pol:14.2,pureza:86.5,fibra:13.1,impMin:9,impVeg:6.5,cor:850,polAc:99.35,umid:0.1};
const nf=(v,d)=>Number(v).toLocaleString('pt-BR',{maximumFractionDigits:d||0,minimumFractionDigits:d||0});
const descarregadas=[];
let hist=[], paradas=[], fornec=[], dias=[], ritmo=600, mixAc=0.54, atrDia=136;
function hh(d){ return String(d.getHours()).padStart(2,'0')+':00'; }
function hm(d){ return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
function dm(d){ return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0'); }
function inicioDiaSafra(d){
  const x=new Date(d); x.setMinutes(0,0,0);
  if(x.getHours()<SAFRA.horaInicio) x.setDate(x.getDate()-1);
  x.setHours(SAFRA.horaInicio); return x;
}
const iniHoje=()=>inicioDiaSafra(new Date());
function turnoDe(data){
  const h=((data.getTime()-inicioDiaSafra(data).getTime())/H);
  return SAFRA.turnos.find(t=>h>=t.de && h<t.ate) || SAFRA.turnos[0];
}
function horasEntre(a,b){ return hist.filter(x=>x.ini.getTime()>=a && x.ini.getTime()<b); }
function somaEntre(a,b){ return horasEntre(a,b).reduce((s,x)=>s+x.t,0); }
function totalDia(){ const i=iniHoje().getTime(); return somaEntre(i,i+24*H); }
const total24=totalDia;
function ontemAteAgora(){
  const corte=Date.now()-24*H, i=iniHoje().getTime()-24*H;
  return horasEntre(i,i+24*H).reduce((s,x)=>s+x.t*clamp((corte-x.ini.getTime())/H,0,1),0);
}
function paradasDoDia(){ const i=iniHoje().getTime(); return paradas.filter(p=>p.hora.getTime()>=i); }
/* aproveitamento de tempo da moenda: horas moendo de verdade sobre as horas que já passaram no dia safra */
function aproveitamento(){
  const min=Math.max(1,(Date.now()-iniHoje().getTime())/60000), par=paradasDoDia().reduce((s,p)=>s+p.dur,0);
  return {pct:clamp((min-par)/min*100,0,100), par, min};
}
function paradasPorCategoria(){
  const c={}; paradasDoDia().forEach(p=>{ const k=catParada(p); c[k]=(c[k]||0)+p.dur; });
  return Object.entries(c).sort((a,b)=>b[1]-a[1]);
}
function gerarQualidade(){
  qual={pol:rnd(13.6,15.2), pureza:rnd(84.5,88.8), fibra:rnd(12.2,14.2), impMin:rnd(6.5,12.5), impVeg:rnd(4.8,8.8), cor:rnd(620,1150), polAc:rnd(99.15,99.5), umid:rnd(0.07,0.14)};
}
/* situação de um valor de qualidade: maior é pior (impureza, cor, umidade) ou menor é pior (pol do açúcar) */
function nivelQual(k,v){ const l=LIM_QUAL[k]; if(!l) return ''; const pior=l.ruim>l.alerta; return (pior?v>=l.ruim:v<=l.ruim)?'red':(pior?v>=l.alerta:v<=l.alerta)?'warn':'ok'; }

function gerarHistorico(){
  const agora=new Date(), i0=iniHoje().getTime()-24*H, hAtual=new Date(agora); hAtual.setMinutes(0,0,0);
  hist=[]; paradas=[];
  const n=Math.round((hAtual.getTime()-i0)/H)+1;
  const comParada=new Set(); const nPar=3+Math.floor(Math.random()*3);
  while(comParada.size<nPar) comParada.add(Math.floor(Math.random()*(n-1)));
  for(let k=0;k<n;k++){
    const ini=new Date(i0+k*H), r=rnd(570,645);
    let t, par=0;
    if(k===n-1){ t=ritmo*(agora.getMinutes()+agora.getSeconds()/60)/60; }
    else if(comParada.has(k)){ par=Math.round(rnd(14,52)); t=r*(1-par/60); paradas.push({hora:new Date(ini.getTime()+rnd(5,30)*60000), motivo:pick(MOTIVOS), dur:par}); }
    else t=r;
    hist.push({ini, t, par});
  }
  /* dias fechados da safra (o último é ontem, calculado das horas) */
  dias=[];
  const d0=new Date(SAFRA.inicio+'T00:00:00'); d0.setHours(SAFRA.horaInicio);
  let atr=124;
  for(let d=d0.getTime(); d<i0; d+=24*H){
    atr=clamp(atr+rnd(-0.6,0.9),118,148);
    let t=rnd(12900,14800); if(Math.random()<0.08) t*=rnd(0.3,0.7);
    dias.push({ini:new Date(d), t, atr:Math.round(atr)});
  }
  dias.push({ini:new Date(i0), t:somaEntre(i0,i0+24*H), atr:Math.round(atr)});
  gerarFornecedores(); gerarQualidade();
}
function gerarFornecedores(){
  const tot=Math.max(1,totalDia());
  const pesos=FAZ.map(()=>rnd(0.4,1.6)), sp=pesos.reduce((a,b)=>a+b,0);
  fornec=FAZ.map((n,i)=>{ const t=tot*pesos[i]/sp; return {nome:n, t, cargas:Math.round(t/54), atr:Math.round(rnd(124,150)), impMin:+rnd(5.5,14).toFixed(1)}; }).sort((a,b)=>b.t-a.t);
  atrDia=Math.round(fornec.reduce((a,f)=>a+f.atr*f.t,0)/tot);
}
function tick(){
  atualizarEstoque(); desenharCasa(); atualizarBagaco(); desenharBagaco();
  if(aoVivo){ desenharHero(); return; }
  const agora=new Date(), cur=hist[hist.length-1];
  if(agora.getHours()!==cur.ini.getHours()){
    const ini=new Date(agora); ini.setMinutes(0,0,0);
    hist.push({ini, t:0, par:0});
    if(agora.getHours()===SAFRA.horaInicio){
      /* virou o dia safra: o dia que fechou entra no acumulado */
      const iOntem=ini.getTime()-24*H;
      dias.push({ini:new Date(iOntem), t:somaEntre(iOntem,ini.getTime()), atr:atrDia});
      const corte=iOntem; hist=hist.filter(x=>x.ini.getTime()>=corte); paradas=paradas.filter(p=>p.hora.getTime()>=corte);
      gerarFornecedores(); desenharGestao();
    }
  }
  ritmo=clamp(ritmo+rnd(-4,4),560,650);
  hist[hist.length-1].t+=ritmo/3600;
  desenharHero(); desenharTurnos();
}

function desenharHero(){
  const agora=new Date(), ini=iniHoje(), fim=ini.getTime()+24*H;
  const tot=totalDia(), pct=tot/META_DIA, horasRest=Math.max(0,(fim-agora)/H);
  const esperado=META_DIA*(1-horasRest/24);
  document.getElementById('gDiaSub').textContent=`Desde as ${hm(ini)} de ${dm(ini)}, fecha às ${hm(new Date(fim))}`;
  document.getElementById('gMoagem').textContent=nf(tot);
  document.getElementById('gMetaBar').style.width=Math.min(100,pct*100)+'%';
  document.getElementById('gMetaMarca').style.left=Math.min(100,esperado/META_DIA*100)+'%';
  const falta=META_DIA-tot, precisa=horasRest>0.05?falta/horasRest:0;
  document.getElementById('gMetaTxt').innerHTML=`${nf(pct*100,1)}% da meta do dia (${nf(META_DIA)} t). `+
    (falta<=0?`Meta batida com ${nf(-falta)} t a mais.`:
     `${tot>=esperado?'Adiantado':'Atrasado'} ${nf(Math.abs(tot-esperado))} t em relação ao ritmo da meta. Precisa de <b>${nf(precisa)} t/h</b> até o fim do dia.`);
  document.getElementById('gRitmo').textContent=nf(ritmo);
  document.getElementById('gProj').textContent=nf(tot+ritmo*horasRest);
  const ontem=ontemAteAgora(), dif=ontem>0?(tot-ontem)/ontem*100:0;
  const el=document.getElementById('gOntem');
  const d1=Math.abs(dif)<0.05?0:dif; el.textContent=(d1>0?'+':'')+nf(d1,1)+'%'; el.style.color=d1>0?'var(--ok)':d1<0?'var(--red)':'var(--ink)';
  document.getElementById('gOntemTxt').textContent=`que ontem até ${hm(agora)} (${nf(ontem)} t)`;
}

function desenharTurnos(){
  const el=document.getElementById('gTurnos'); if(!el) return;
  const agora=Date.now(), i=iniHoje().getTime(), metaT=META_DIA/SAFRA.turnos.length;
  let destaque='';
  el.innerHTML=SAFRA.turnos.map(tr=>{
    const a=i+tr.de*H, b=i+tr.ate*H, t=somaEntre(a,b);
    const par=paradas.filter(p=>p.hora.getTime()>=a && p.hora.getTime()<b).reduce((s,p)=>s+p.dur,0);
    const st= agora>=b?'fechado': agora>=a?'agora':'futuro';
    const pct=t/metaT*100;
    if(st==='agora'){
      const rest=(b-agora)/H, falta=metaT-t;
      destaque= falta>0 ? `Turno ${tr.id} fecha às ${hm(new Date(b))}, em ${fmt(Math.round(rest*60))}. Para bater ${nf(metaT)} t, precisa de <b>${nf(falta/Math.max(rest,0.05))} t/h</b> (agora está em ${nf(ritmo)} t/h).`
                        : `Turno ${tr.id} já bateu a meta de ${nf(metaT)} t.`;
    }
    const cor= st==='futuro'?'var(--line)': pct>=99.5?'var(--ok)': st==='fechado'?(pct>=95?'var(--warn)':'var(--red)'):'var(--accent)';
    return `<div class="turno ${st}">
      <div class="tt"><b>Turno ${tr.id}</b><span class="chip ${st==='agora'?'ok':st==='fechado'?'cinza':'cinza'}">${st==='agora'?'Agora':st==='fechado'?'Fechado':'Próximo'}</span></div>
      <small>${hm(new Date(a))} às ${hm(new Date(b))}</small>
      <div class="tv">${st==='futuro'?'–':nf(t)+' t'}</div>
      <div class="pbar"><i style="width:${Math.min(100,pct)}%;background:${cor}"></i></div>
      <small>${st==='futuro'?`meta ${nf(metaT)} t`:`${nf(pct)}% da meta`}${par?`, ${par} min parado`:''}</small>
    </div>`;
  }).join('');
  document.getElementById('gTurnoTxt').innerHTML=destaque;
}

function desenharGrafico(){
  if(window.Chart){ graficoHora(); graficoAcum(); return; }
  desenharGraficoSVG();
}
function desenharGraficoSVG(){
  const W=340,Ht=158,pad=24,bw=(W-pad)/24, maxY=720, y=v=>Ht-18-(v/maxY)*(Ht-34);
  const i=iniHoje().getTime(), agoraH=new Date(); agoraH.setMinutes(0,0,0);
  let g=`<svg viewBox="0 0 ${W} ${Ht}" role="img" aria-label="Toneladas moídas por hora no dia safra, comparadas com ontem">`;
  [0,300,600].forEach(v=>g+=`<line x1="${pad}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${pad-4}" y="${y(v)+3}" text-anchor="end">${v}</text>`);
  SAFRA.turnos.forEach(tr=>{
    const x=pad+tr.de*bw;
    if(tr.de>0) g+=`<line x1="${x}" x2="${x}" y1="12" y2="${Ht-18}" stroke="var(--muted)" stroke-dasharray="2 3" opacity=".6"/>`;
    g+=`<text x="${x+(tr.ate-tr.de)*bw/2}" y="9" text-anchor="middle" font-weight="600">Turno ${tr.id}</text>`;
  });
  for(let k=0;k<24;k++){
    const ini=i+k*H, x=pad+k*bw+1;
    const ont=hist.find(b=>b.ini.getTime()===ini-24*H), hoje=hist.find(b=>b.ini.getTime()===ini);
    if(ont) g+=`<rect x="${x}" y="${y(ont.t)}" width="${bw-2}" height="${Math.max(0,Ht-18-y(ont.t))}" rx="1.5" fill="var(--muted)" opacity=".18"><title>Ontem ${hh(ont.ini)}: ${nf(ont.t)} t</title></rect>`;
    if(hoje){
      const atual=hoje.ini.getTime()===agoraH.getTime();
      const cor=hoje.par?'var(--red)':(atual||hoje.t>=META_H*0.97)?'var(--ok)':'var(--warn)';
      g+=`<rect x="${x+1.5}" y="${y(hoje.t)}" width="${bw-5}" height="${Math.max(0,Ht-18-y(hoje.t))}" rx="1.5" fill="${cor}" opacity="${atual?0.55:0.92}"><title>${hh(hoje.ini)}: ${nf(hoje.t)} t${hoje.par?`, parada de ${hoje.par} min`:''}${atual?' (hora em andamento)':''}${ont?`. Ontem: ${nf(ont.t)} t`:''}</title></rect>`;
    }
    if(k%4===0) g+=`<text x="${x+(bw-2)/2}" y="${Ht-5}" text-anchor="middle">${String((SAFRA.horaInicio+k)%24).padStart(2,'0')}h</text>`;
  }
  g+=`<line x1="${pad}" x2="${W}" y1="${y(META_H)}" y2="${y(META_H)}" stroke="var(--ink)" stroke-dasharray="4 3" opacity=".6"/><text x="${W-2}" y="${y(META_H)-4}" text-anchor="end">meta ${nf(META_H)} t/h</text></svg>`;
  document.getElementById('gChart').innerHTML=g;
}

function desenharSafra(){
  const el=document.getElementById('gSafra'); if(!el) return;
  const fech=dias.reduce((s,d)=>s+d.t,0), acum=fech+totalDia();
  const nDias=dias.length+1, media=dias.length?fech/dias.length:0;
  const falta=Math.max(0,SAFRA.meta-acum), diasFalta=media?falta/media:0;
  const fimPrev=new Date(Date.now()+diasFalta*24*H);
  const atrSafra=dias.length?Math.round(dias.reduce((s,d)=>s+d.atr*d.t,0)/fech):atrDia;
  const ult7=dias.slice(-7), media7=ult7.length?ult7.reduce((s,d)=>s+d.t,0)/ult7.length:0;
  const fimPl=new Date((SAFRA.fimPlanejado||SAFRA.inicio)+'T12:00:00'), diasPl=Math.max(1,Math.ceil((fimPl-Date.now())/(24*H)));
  const precisaDia=falta/diasPl, tendencia=media?(media7-media)/media*100:0;
  el.innerHTML=[
    [nf(acum)+' t','moídas na safra'],[nf(acum/SAFRA.meta*100,1)+'%',`da meta de ${nf(SAFRA.meta/1e6,2)} milhão de t`],
    [nf(media)+' t','de média por dia'],[String(nDias),`dias de safra, desde ${dm(new Date(SAFRA.inicio+'T12:00:00'))}`],
    [dm(fimPrev),`fim previsto da safra (faltam ${nf(diasFalta)} dias)`],[nf(atrSafra),'kg/t de ATR médio da safra'],
    [nf(media7)+' t',`de média nos últimos 7 dias (${tendencia>=0?'+':''}${nf(tendencia,1)}% sobre a safra)`],
    [nf(precisaDia)+' t',`por dia para fechar a meta até ${dm(fimPl)}`+(media7>=precisaDia?', ritmo atual atende':', ritmo atual não atende')]
  ].map(([n,l])=>`<div><b>${n}</b><span>${l}</span></div>`).join('');
  document.getElementById('gSafraBar').style.width=Math.min(100,acum/SAFRA.meta*100)+'%';
  if(window.Chart){ graficoSafra(); return; }
  /* últimos 21 dias */
  const ult=dias.slice(-21), W=340,Ht=96,pad=4,bw=(W-pad)/Math.max(21,ult.length), maxY=16000, y=v=>Ht-16-(v/maxY)*(Ht-24);
  let g=`<svg viewBox="0 0 ${W} ${Ht}" role="img" aria-label="Moagem dos últimos dias da safra">`;
  ult.forEach((d,k)=>{
    const x=pad+k*bw+1, cor=d.t>=META_DIA*0.97?'var(--ok)':d.t>=META_DIA*0.8?'var(--warn)':'var(--red)';
    g+=`<rect x="${x}" y="${y(d.t)}" width="${bw-2}" height="${Ht-16-y(d.t)}" rx="1.5" fill="${cor}" opacity=".9"><title>${dm(d.ini)}: ${nf(d.t)} t</title></rect>`;
    if(k%5===0||k===ult.length-1) g+=`<text x="${x+(bw-2)/2}" y="${Ht-3}" text-anchor="middle">${dm(d.ini)}</text>`;
  });
  g+=`<line x1="0" x2="${W}" y1="${y(META_DIA)}" y2="${y(META_DIA)}" stroke="var(--ink)" stroke-dasharray="4 3" opacity=".6"/></svg>`;
  document.getElementById('gSafraChart').innerHTML=g;
}

function desenharQualidade(){
  const el=document.getElementById('gQual'); if(!el) return;
  const q=qual;
  const L=LIM_QUAL;
  el.innerHTML=`<h4>Cana (laboratório PCTS)</h4><div class="grid3">`+[
    [nf(atrDia),'kg/t de ATR'],[nf(q.pol,2)+'%','pol da cana'],[nf(q.pureza,1)+'%','pureza do caldo'],
    [nf(q.fibra,1)+'%','fibra'],[nf(q.impMin,1),'kg/t de impureza mineral','impMin',`alerta acima de ${L.impMin.alerta}`],[nf(q.impVeg,1)+'%','impureza vegetal','impVeg',`alerta acima de ${L.impVeg.alerta}%`]
  ].map(([v,l,k,ref])=>`<div class="${k?'q-'+nivelQual(k,q[k]):''}"><b>${v}</b><span>${l}${ref?`<em>${ref}</em>`:''}</span></div>`).join('')+`</div>
  <h4>Açúcar VHP</h4><div class="grid3">`+[
    [nf(q.cor),'UI de cor ICUMSA','cor',`máx. ${nf(L.cor.ruim)}`],[nf(q.polAc,2)+' °Z','polarização','pol',`mín. ${nf(L.pol.ruim,1)}`],[nf(q.umid,2)+'%','umidade','umid',`máx. ${nf(L.umid.ruim,2)}%`]
  ].map(([v,l,k,ref])=>`<div class="q-${nivelQual(k,k==='pol'?q.polAc:q[k])}"><b>${v}</b><span>${l}<em>${ref}</em></span></div>`).join('')+`</div>`;
  const al=[]; if(nivelQual('impMin',q.impMin)!=='ok') al.push(`impureza mineral em ${nf(q.impMin,1)} kg/t (desgasta a moenda e baixa a extração)`);
  if(nivelQual('cor',q.cor)!=='ok') al.push(`cor do açúcar em ${nf(q.cor)} UI, perto do limite do contrato`);
  if(nivelQual('pol',q.polAc)!=='ok') al.push(`polarização do açúcar em ${nf(q.polAc,2)} °Z`);
  document.getElementById('gQualAlerta').textContent=al.length?'Atenção: '+al.join('; ')+'.':'';
}
function desenharGestao(){
  const tot=totalDia(), kgATR=tot*atrDia;
  const horasDia=Math.max(1,(Date.now()-iniHoje().getTime())/H);
  const acucarT=kgATR*mixAc*0.95/1000, etanolM3=kgATR*(1-mixAc)*0.591/1000, mwh=Math.max(0,tot*0.24*0.28-14*horasDia);
  const med=id=>{ const it=(ST.find(s=>s.id===id)||{items:[]}).items; return it.length?it.reduce((a,i)=>a+i.el,0)/it.length:0; };
  const filaBal=Math.round(med('balanca')), perman=Math.round(med('balanca')+med('laboratorio')+med('hilo'));
  document.getElementById('gProd').innerHTML=[
    [nf(acucarT*20),'sacas de açúcar (50 kg)'],[nf(etanolM3),'m³ de etanol'],
    [nf(atrDia),'kg/t de ATR médio'],[nf(mwh),'MWh de energia exportada'],
    [nf(fornec.reduce((a,f)=>a+f.cargas,0)),'cargas de cana recebidas'],[fmt(filaBal),'de espera média na balança'],[fmt(perman),'de permanência média do caminhão na usina (balança ao hilo)'],
    [nf(tot>0?mwh*1000/tot:0),'kWh exportados por tonelada de cana']
  ].map(([n,l])=>`<div><b>${n}</b><span>${l}</span></div>`).join('');
  document.getElementById('gMix').innerHTML=`<span style="width:${mixAc*100}%;background:var(--warn)">Açúcar ${nf(mixAc*100)}%</span><span style="width:${(1-mixAc)*100}%;background:var(--blue)">Etanol ${nf((1-mixAc)*100)}%</span>`;

  const garg=ST.filter(s=>s.sla).map(s=>({s, red:s.items.filter(i=>i.status==='red').length, warn:s.items.filter(i=>i.status==='warn').length, stop:s.items.filter(i=>i.status==='stop').length}))
    .map(o=>({...o, score:o.red*3+o.stop*4+o.warn})).filter(o=>o.score>0).sort((a,b)=>b.score-a.score).slice(0,5);
  const ol=document.getElementById('gGarg'); ol.innerHTML='';
  garg.forEach(o=>{
    const li=document.createElement('li'), b=document.createElement('button'); b.type='button';
    const pior=o.s.items[0];
    b.innerHTML=`<span><b>${o.s.nome}</b><small>${o.red} estouradas, ${o.warn} perto${o.stop?`, ${o.stop} paradas`:''}. Pior: ${fmt(pior.el)} de ${fmt(o.s.sla)}</small></span>${o.red?`<span class="al">${o.red}</span>`:''}`;
    b.addEventListener('click',()=>{ irPara3D(); abrirPainel(o.s); flyTo(o.s.x,o.s.z,70); });
    li.appendChild(b); ol.appendChild(li);
  });
  if(!garg.length) ol.innerHTML='<li class="meta-txt">Nenhuma etapa estourada agora.</li>';

  document.getElementById('gForn').innerHTML='<tr><th>Fornecedor</th><th>Toneladas</th><th>Cargas</th><th>ATR</th><th title="Impureza mineral (terra) em kg por tonelada">Imp. min.</th></tr>'+
    fornec.slice(0,6).map(f=>`<tr><td>${f.nome}</td><td>${nf(f.t)}</td><td>${f.cargas}</td><td>${f.atr??'–'}</td><td class="q-${f.impMin!=null?nivelQual('impMin',f.impMin):''}">${f.impMin!=null?nf(f.impMin,1):'–'}</td></tr>`).join('');
  desenharQualidade();
  const pd=paradasDoDia(), totPar=pd.reduce((s,p)=>s+p.dur,0);
  document.getElementById('gParTot').textContent=pd.length?`${fmt(totPar)} no dia`:'';
  const ap=aproveitamento(), cats=paradasPorCategoria(), maxCat=cats.length?cats[0][1]:1;
  document.getElementById('gAprov').innerHTML=`<div class="aprov"><b class="${ap.pct>=95?'q-ok':ap.pct>=90?'q-warn':'q-red'}">${nf(ap.pct,1)}%</b><span>de aproveitamento de tempo da moenda no dia safra (${fmt(Math.round(ap.min-ap.par))} moendo de ${fmt(Math.round(ap.min))})</span></div>`+
    (cats.length?`<div class="cats">${cats.map(([c,m])=>`<div class="cat"><span>${c}</span><span class="cbar"><i style="width:${m/maxCat*100}%;background:${COR_CAT[c]||COR_CAT.Outros}"></i></span><b>${fmt(m)}</b></div>`).join('')}</div>`:'');
  const pl=document.getElementById('gParadas');
  pl.innerHTML=pd.length?pd.slice().sort((a,b)=>b.hora-a.hora).map(p=>`<li><span class="h">${hm(p.hora)}</span><span>${p.motivo} <small class="tn">${catParada(p).toLowerCase()}, turno ${turnoDe(p.hora).id}</small></span><span class="d">${p.dur} min</span></li>`).join(''):'<li>Nenhuma parada no dia safra.</li>';
  desenharGrafico(); desenharHero(); desenharTurnos(); desenharSafra(); desenharFrentes();
}
document.getElementById('gExport').addEventListener('click',()=>{
  const i=iniHoje(), metaT=META_DIA/SAFRA.turnos.length;
  const L=[`Relatório da usina - dia safra de ${dm(i)} (${hm(i)} às ${hm(new Date(i.getTime()+24*H))})`,'',
    `Moagem do dia (t);${nf(totalDia())}`,`Meta do dia (t);${nf(META_DIA)}`,`Ontem até esta hora (t);${nf(ontemAteAgora())}`,`ATR médio (kg/t);${atrDia}`,'',
    'Turno;Horário;Toneladas;Meta;% da meta'];
  SAFRA.turnos.forEach(tr=>{ const a=i.getTime()+tr.de*H, b=i.getTime()+tr.ate*H, t=somaEntre(a,b); L.push(`${tr.id};${hm(new Date(a))} às ${hm(new Date(b))};${nf(t)};${nf(metaT)};${nf(t/metaT*100,1)}`); });
  L.push('','Hora;Toneladas hoje;Toneladas ontem;Parada (min)');
  for(let k=0;k<24;k++){ const ini=i.getTime()+k*H, hoje=hist.find(b=>b.ini.getTime()===ini), ont=hist.find(b=>b.ini.getTime()===ini-24*H); if(!hoje&&!ont) continue; L.push(`${hh(new Date(ini))};${hoje?nf(hoje.t):''};${ont?nf(ont.t):''};${hoje?hoje.par||0:''}`); }
  L.push('','Safra','Dia;Toneladas;ATR'); dias.forEach(d=>L.push(`${dm(d.ini)};${nf(d.t)};${d.atr}`));
  L.push('','Fornecedor;Toneladas;Cargas;ATR;Impureza mineral (kg/t)'); fornec.forEach(f=>L.push(`${f.nome};${nf(f.t)};${f.cargas};${f.atr??''};${f.impMin!=null?nf(f.impMin,1):''}`));
  const ap=aproveitamento();
  L.push('',`Aproveitamento de tempo da moenda (%);${nf(ap.pct,1)}`,'Categoria de parada;Minutos'); paradasPorCategoria().forEach(([c,m])=>L.push(`${c};${m}`));
  L.push('','Hora;Turno;Categoria;Motivo da parada;Duração (min)'); paradasDoDia().forEach(p=>L.push(`${hm(p.hora)};${turnoDe(p.hora).id};${catParada(p)};${p.motivo};${p.dur}`));
  L.push('','Qualidade;Valor',`Pol da cana (%);${nf(qual.pol,2)}`,`Pureza do caldo (%);${nf(qual.pureza,1)}`,`Fibra (%);${nf(qual.fibra,1)}`,`Impureza mineral (kg/t);${nf(qual.impMin,1)}`,`Impureza vegetal (%);${nf(qual.impVeg,1)}`,`Cor do açúcar (UI ICUMSA);${nf(qual.cor)}`,`Polarização do açúcar (°Z);${nf(qual.polAc,2)}`,`Umidade do açúcar (%);${nf(qual.umid,2)}`);
  L.push('','Oficina','Veículo;Tipo;Serviço;Manutenção;Situação;Local;Entrada;Previsão;Tempo na oficina');
  OFI.veiculos.forEach(v=>L.push(`${v.cod};${v.tipo};${v.servico};${v.manut};${v.status};${v.local};${dm(v.entrada)} ${hm(v.entrada)};${dm(v.previsao)} ${hm(v.previsao)};${fmt(Math.round((Date.now()-v.entrada)/60000))}`));
  if(typeof COTA !== 'undefined' && COTA.atual){ const c=COTA.atual, r=realizadoCota(c);
    L.push('',`Cota de entrada de cana;${hm(new Date(c.ini))} às ${hm(new Date(c.fim))};${nf(c.total)} t`,'Frente;%;Cota (t);Realizado (t)'); c.frentes.forEach(x=>L.push(`${x.s.f.nome};${x.pct};${nf(x.t)};${nf(r.por.get(x.s)||0)}`)); }
  L.push('','Vazios a caminho das frentes','Frota;Frente;Saiu;Viagem prevista (min);Falta (min)'); FR.forEach(f=>f.vindo.filter(v=>v.t0!=null).forEach(v=>L.push(`${v.frota};${f.f.nome};${hm(v.saiu)};${v.min};${faltaMin(v)}`)));
  if(noPatio().length) L.push(`Vazios no pátio esperando vaga;${noPatio().map(x=>x.frota).join(' ')}`);
  L.push('','Rádio do CCO','Hora;Quem;Mensagem'); DESP.radio.forEach(m=>L.push(`${hm(m.hora)};${m.quem};${m.texto.replace(/;/g,',')}`));
  L.push('','Etapa;Em andamento;Estouradas;Perto de estourar'); ST.forEach(s=>L.push(`${s.nome};${s.items.length};${s.items.filter(i=>i.status==='red').length};${s.items.filter(i=>i.status==='warn').length}`));
  const blob=new Blob(['\ufeff'+L.join('\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`usina-dia-safra-${i.toISOString().slice(0,10)}.csv`; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
});
