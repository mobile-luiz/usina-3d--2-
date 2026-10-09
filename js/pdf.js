/* Usina em 3D: Relatório em PDF com a imagem do 3D, gráficos e tabelas. */
"use strict";

/* ---------- Exportar relatório em PDF (com a imagem do 3D e os gráficos) ---------- */
function fotografar3D(){
  try{
    applyCam();
    if(qualidade==='alta' && composer) composer.render(); else renderer.render(scene,camera);
    return canvas.toDataURL('image/jpeg',0.9);
  }catch(e){ return null; }
}
function imgGrafico(ch){
  try{
    if(!ch || !ch.canvas.width || !ch.canvas.height) return null;
    const url=ch.toBase64Image('image/png',1);
    return url.length>100?{url,w:ch.canvas.width,h:ch.canvas.height}:null;   /* gráfico sem tamanho vira "data:," e quebra o PDF */
  }catch(e){ return null; }
}
/* os gráficos só têm tamanho quando o painel está visível: no 3D, desenha o painel fora da tela só para o PDF */
async function prepararGraficosPDF(){
  if(document.body.classList.contains('modo-painel')) return;
  document.body.classList.add('pdf-graficos');
  desenharGestao();
  Object.values(CJ).forEach(c=>{ try{ c.resize(); c.update('none'); }catch(_){} });
  await new Promise(r=>setTimeout(r,700));
}
async function exportarPDF(){
  if(!window.jspdf || !window.jspdf.jsPDF){ mostrarAviso('Não foi possível carregar o gerador de PDF. Verifique a internet e tente de novo.'); return; }
  const botoes=[...document.querySelectorAll('.btnPdf')]; botoes.forEach(b=>b.disabled=true);
  mostrarAviso('Gerando o PDF...');
  await new Promise(r=>setTimeout(r,60));
  try{
    const {jsPDF}=window.jspdf, doc=new jsPDF({unit:'mm',format:'a4'});
    const W=210, Mg=14, LW=W-2*Mg, VERDE=[79,138,60], ESC=[36,51,42], CINZA=[93,107,97];
    const agora=new Date(), i=iniHoje(), fimDia=new Date(i.getTime()+24*H);
    let y=0;
    const tabela=(head,body,extra)=>{ doc.autoTable(Object.assign({startY:y,head:[head],body,theme:'striped',margin:{left:Mg,right:Mg},
      styles:{font:'helvetica',fontSize:8.4,cellPadding:1.7,textColor:[29,42,34],lineColor:[214,220,207]},
      headStyles:{fillColor:VERDE,textColor:255,fontStyle:'bold'},alternateRowStyles:{fillColor:[244,246,241]}},extra||{})); y=doc.lastAutoTable.finalY+7; };
    const secao=(t,precisa)=>{ if(y+(precisa||20)>282){ doc.addPage(); y=16; } doc.setFont('helvetica','bold'); doc.setFontSize(12.5); doc.setTextColor(...ESC); doc.text(t,Mg,y); y+=5; };
    const imagem=(g,altMax)=>{ if(!g) return; let w=LW, h=w*g.h/g.w; if(h>altMax){ h=altMax; w=h*g.w/g.h; } if(y+h>285){ doc.addPage(); y=16; } doc.addImage(g.url,'PNG',Mg,y,w,h); y+=h+6; };

    /* cabeçalho */
    doc.setFillColor(...ESC); doc.rect(0,0,W,27,'F');
    doc.setTextColor(243,246,241); doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.text('Relatório da usina',Mg,12);
    doc.setFont('helvetica','normal'); doc.setFontSize(9.3);
    doc.text(`Gerado em ${dm(agora)}/${agora.getFullYear()} às ${hm(agora)}. Dia safra de ${dm(i)}, das ${hm(i)} às ${hm(fimDia)}.`,Mg,19);
    doc.text(aoVivo?'Recepção e moagem vindas da balança. As demais áreas ainda são simuladas.':'Dados simulados para demonstração.',Mg,23.6);
    y=33;

    /* imagem do 3D */
    const foto=fotografar3D();
    if(foto){ const r=canvas.height/canvas.width, h=Math.min(92,LW*r), w=h/r; doc.addImage(foto,'JPEG',Mg+(LW-w)/2,y,w,h); doc.setDrawColor(214,220,207); doc.rect(Mg+(LW-w)/2,y,w,h); y+=h+7; }

    /* indicadores principais */
    const tot=totalDia(), ontem=ontemAteAgora(), horasRest=Math.max(0,(fimDia-agora)/H), proj=tot+ritmo*horasRest;
    const fech=dias.reduce((s,d)=>s+d.t,0), acum=fech+tot, dif=ontem>0?(tot-ontem)/ontem*100:0;
    const kpis=[[`${nf(tot)} t`,'moagem no dia safra'],[`${nf(tot/META_DIA*100,1)}%`,`da meta do dia (${nf(META_DIA)} t)`],[`${nf(ritmo)} t/h`,'ritmo de moagem agora'],
      [`${nf(proj)} t`,'previsão de fechamento do dia'],[`${dif>=0?'+':''}${nf(dif,1)}%`,`em relação a ontem até ${hm(agora)}`],[`${nf(acum)} t`,`acumulado da safra (${nf(acum/SAFRA.meta*100,1)}% da meta)`]];
    const bw=(LW-8)/3, bh=17;
    kpis.forEach((k,n)=>{ const cx=Mg+(n%3)*(bw+4), cy=y+Math.floor(n/3)*(bh+4);
      doc.setFillColor(240,243,238); doc.roundedRect(cx,cy,bw,bh,2.5,2.5,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(...ESC); doc.text(k[0],cx+4,cy+8);
      doc.setFont('helvetica','normal'); doc.setFontSize(7.8); doc.setTextColor(...CINZA); doc.text(k[1],cx+4,cy+13.5); });
    y+=2*(bh+4)+5;

    /* turnos */
    secao('Turnos',40);
    const metaT=META_DIA/SAFRA.turnos.length;
    tabela(['Turno','Horário','Moagem (t)','Meta (t)','% da meta','Parado (min)','Situação'],SAFRA.turnos.map(tr=>{
      const a=i.getTime()+tr.de*H, b=i.getTime()+tr.ate*H, t=somaEntre(a,b), par=paradas.filter(p=>p.hora.getTime()>=a&&p.hora.getTime()<b).reduce((s,p)=>s+p.dur,0);
      const st=Date.now()>=b?'Fechado':Date.now()>=a?'Em andamento':'Próximo';
      return [tr.id,`${hm(new Date(a))} às ${hm(new Date(b))}`,st==='Próximo'?'-':nf(t),nf(metaT),st==='Próximo'?'-':nf(t/metaT*100,1)+'%',String(par),st]; }));

    /* gráficos */
    await prepararGraficosPDF();
    doc.addPage(); y=16;
    secao('Moagem por hora (hoje, ontem e meta)'); imagem(imgGrafico(CJ.hora),78);
    secao('Acumulado do dia'); imagem(imgGrafico(CJ.acum),72);
    const projFim=proj-META_DIA;
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...CINZA);
    doc.text(`No ritmo atual o dia fecha com ${nf(proj)} t, ${projFim>=0?nf(projFim)+' t acima':nf(-projFim)+' t abaixo'} da meta.`,Mg,y-2); y+=4;
    secao('Safra'); imagem(imgGrafico(CJ.safra),64);
    const media=dias.length?fech/dias.length:0, diasFalta=media?Math.max(0,SAFRA.meta-acum)/media:0;
    tabela(['Acumulado (t)','% da meta','Média por dia (t)','Dias de safra','Fim previsto'],[[nf(acum),nf(acum/SAFRA.meta*100,1)+'%',nf(media),String(dias.length+1),dm(new Date(Date.now()+diasFalta*24*H))]]);

    /* produção, casa de cana e energia */
    doc.addPage(); y=16;
    const kgATR=tot*atrDia, horasDia=Math.max(1,(Date.now()-i.getTime())/H), e=energia();
    secao('Produção no dia safra',40);
    tabela(['Indicador','Valor'],[
      ['Açúcar (sacas de 50 kg)',nf(kgATR*mixAc*0.95/1000*20)],['Etanol (m3)',nf(kgATR*(1-mixAc)*0.591/1000)],['ATR médio (kg/t)',nf(atrDia)],
      ['Energia exportada (MWh)',nf(Math.max(0,tot*0.24*0.28-14*horasDia))],['Mix açúcar e etanol',`${nf(mixAc*100)}% e ${nf((1-mixAc)*100)}%`]],{columnStyles:{1:{halign:'right'}}});
    secao('Casa de cana e energia',50);
    const aut=ritmo>0?Math.round(estoque/ritmo*60):0, autB=e.queima>0?Math.round(bagEstoque/e.queima*60):0;
    tabela(['Indicador','Valor'],[
      ['Cana em estoque na casa de cana',`${nf(estoque)} t`],['Moagem garantida pelo estoque',fmt(aut)],['Bagaço no pátio',`${nf(bagEstoque)} t`],
      ['Caldeira garantida só com o pátio',fmt(autB)],['Bagaço queimado',`${nf(e.queima)} t/h`],['Vapor produzido',`${nf(e.vapor)} t/h`],
      ['Energia gerada',`${nf(e.mw,1)} MW`],['Energia exportada',`${nf(e.exporta,1)} MW`]],{columnStyles:{1:{halign:'right'}}});

    /* frentes */
    secao('Frentes de colheita',40);
    const somaShare=FR.reduce((a,s)=>a+(s.ativa?s.share:s.share*0.6),0), now=performance.now();
    tabela(['Frente','Local','Situação','Colhido (t)','Ritmo (t/h)','Carregando','Aguard.','Maior espera','A caminho','Pipa'],FR.map(s=>{
      const esp=s.fila.map(t=>Math.round(t.base+(now-t.chegou)/60000)), maior=esp.length?Math.max(...esp):0;
      return [s.f.nome,`${s.f.fazenda}, ${s.f.talhao}, ${s.f.km} km`,s.ativa?'Colhendo':`Parada: ${s.motivo}`,nf(tot*(s.ativa?s.share:s.share*0.6)/somaShare),nf(s.ritmo),
        s.carregando?`${s.carregando.frota} (${Math.round(s.carregando.fill*100)}%)`:'-',String(s.fila.length),maior?fmt(maior):'-',String(s.transito),s.pipa?`${ESTADO_PIPA[s.pipa.estado]}, ${Math.round(s.pipa.nivel*100)}%`:'-']; }),
      {styles:{font:'helvetica',fontSize:7.6,cellPadding:1.5,textColor:[29,42,34],lineColor:[214,220,207]}});

    if(COTA.atual){ const c=COTA.atual, r=realizadoCota(c);
      secao(`Cota de entrada de cana, ${hm(new Date(c.ini))} às ${hm(new Date(c.fim))} (${nf(c.total)} t)`,30);
      tabela(['Frente','%','Cota','Realizado','Atingido'],c.frentes.map(x=>{ const re=r.por.get(x.s)||0; return [x.s.f.nome,`${x.pct}%`,`${nf(x.t)} t`,`${nf(re)} t`,x.t?`${nf(re/x.t*100)}%`:'parada']; }),{columnStyles:{1:{halign:'right'},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'}}}); }
    secao('Vazios a caminho das frentes',30);
    const vs0=FR.flatMap(s=>s.vindo).filter(v=>v.t0!=null).sort((a,b)=>faltaMin(a)-faltaMin(b));
    tabela(['Frota','Vai para','Saiu','Viagem prevista','Chega em'],vs0.length?vs0.map(v=>[v.frota,`${v.frente.f.nome} (${v.frente.f.fazenda}, ${v.frente.f.km} km)`,hm(v.saiu),fmt(v.min),v.pronto?'Chegando':fmt(faltaMin(v))]):[['-','Nenhum vazio a caminho','-','-','-']]);
    if(noPatio().length){ doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...CINZA); doc.text(`No pátio esperando vaga: ${noPatio().map(x=>x.frota).join(', ')}.`,Mg,y-3); y+=3; }

    /* oficina */
    secao('Oficina automotiva',40);
    const vs=OFI.veiculos.slice().sort((a,b)=>a.entrada-b.entrada);
    const disp=(1-vs.filter(v=>v.status!=='Pronto para liberar').length/FROTA_TOTAL)*100;
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...CINZA);
    doc.text(`${vs.length} veículos em manutenção. Frota disponível: ${nf(disp,1)}% de ${FROTA_TOTAL} veículos.`,Mg,y); y+=4;
    tabela(['Veículo','Tipo','Serviço','Situação','Entrada','Previsão','Tempo'],vs.map(v=>[v.cod,v.tipo,v.servico+(v.campo?` (${v.local})`:''),v.status,`${dm(v.entrada)} ${hm(v.entrada)}`,`${dm(v.previsao)} ${hm(v.previsao)}`,fmt(Math.round((Date.now()-v.entrada)/60000))]),
      {styles:{font:'helvetica',fontSize:7.6,cellPadding:1.5,textColor:[29,42,34],lineColor:[214,220,207]},
       didParseCell:d=>{ if(d.section==='body'){ const v=vs[d.row.index]; if(v && v.status!=='Pronto para liberar' && Date.now()>v.previsao && d.column.index>=5){ d.cell.styles.textColor=[209,69,59]; d.cell.styles.fontStyle='bold'; } } }});

    /* gargalos, paradas e fornecedores */
    secao('Gargalos agora',30);
    const garg=ST.filter(s=>s.sla).map(s=>({s,red:s.items.filter(x=>x.status==='red').length,warn:s.items.filter(x=>x.status==='warn').length,stop:s.items.filter(x=>x.status==='stop').length}))
      .map(o=>({...o,score:o.red*3+o.stop*4+o.warn})).filter(o=>o.score>0).sort((a,b)=>b.score-a.score).slice(0,8);
    tabela(['Etapa','Área','Estouradas','Perto','Paradas','Pior caso'],garg.length?garg.map(o=>[o.s.nome,AREAS[o.s.area].nome,String(o.red),String(o.warn),String(o.stop),`${fmt(o.s.items[0].el)} de ${fmt(o.s.sla)}`]):[['Nenhuma etapa estourada','','','','','']]);
    secao('Paradas da moenda no dia safra',30);
    const pd=paradasDoDia().slice().sort((a,b)=>a.hora-b.hora);
    const ap=aproveitamento();
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...CINZA);
    doc.text(`Aproveitamento de tempo da moenda: ${nf(ap.pct,1)}%. Parado: ${paradasPorCategoria().map(([c,m])=>`${c.toLowerCase()} ${fmt(m)}`).join(', ')||'nada'}.`,Mg,y); y+=4;
    tabela(['Hora','Turno','Categoria','Motivo','Duração'],pd.length?pd.map(p=>[hm(p.hora),turnoDe(p.hora).id,catParada(p),p.motivo,`${p.dur} min`]):[['-','-','-','Nenhuma parada','-']]);
    secao('Qualidade da cana e do açúcar',40);
    tabela(['Indicador','Valor','Referência'],[
      ['ATR (kg/t)',nf(atrDia),'-'],['Pol da cana',nf(qual.pol,2)+'%','-'],['Pureza do caldo',nf(qual.pureza,1)+'%','-'],['Fibra',nf(qual.fibra,1)+'%','-'],
      ['Impureza mineral (kg/t)',nf(qual.impMin,1),`alerta acima de ${LIM_QUAL.impMin.alerta}`],['Impureza vegetal',nf(qual.impVeg,1)+'%',`alerta acima de ${LIM_QUAL.impVeg.alerta}%`],
      ['Cor do açúcar (UI ICUMSA)',nf(qual.cor),`máx. ${nf(LIM_QUAL.cor.ruim)}`],['Polarização do açúcar (°Z)',nf(qual.polAc,2),`mín. ${nf(LIM_QUAL.pol.ruim,1)}`],['Umidade do açúcar',nf(qual.umid,2)+'%',`máx. ${nf(LIM_QUAL.umid.ruim,2)}%`]
    ],{columnStyles:{1:{halign:'right'}}});
    secao('Maiores fornecedores no dia safra',30);
    tabela(['Fornecedor','Toneladas','Cargas','ATR','Imp. mineral (kg/t)'],fornec.slice(0,10).map(f=>[f.nome,nf(f.t),String(f.cargas),f.atr??'-',f.impMin!=null?nf(f.impMin,1):'-']),{columnStyles:{1:{halign:'right'},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'}}});

    /* rodapé com numeração */
    const n=doc.getNumberOfPages();
    for(let p=1;p<=n;p++){ doc.setPage(p); doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...CINZA);
      doc.text(`Usina em 3D, relatório do dia safra de ${dm(i)}`,Mg,291); doc.text(`Página ${p} de ${n}`,W-Mg,291,{align:'right'}); }
    doc.save(`relatorio-usina-${i.getFullYear()}-${String(i.getMonth()+1).padStart(2,'0')}-${String(i.getDate()).padStart(2,'0')}.pdf`);
    mostrarAviso('PDF gerado.');
  }catch(err){ console.error(err); mostrarAviso('Não foi possível gerar o PDF: '+err.message); }
  finally{ botoes.forEach(b=>b.disabled=false); document.body.classList.remove('pdf-graficos'); }
}
document.querySelectorAll('.btnPdf').forEach(b=>b.addEventListener('click',exportarPDF));
