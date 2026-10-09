/* Usina em 3D: Cota de entrada de cana. A cada 3 horas (janelas contadas a partir do início do dia safra)
   o CCO passa pelo rádio quanto de cana a usina precisa receber e o percentual de cada frente.
   As frentes confirmam uma a uma. Se uma frente parar no meio da janela, o CCO redistribui a cota. */
"use strict";

const COTA = {
  horas: 3,             /* tamanho da janela da cota, em horas */
  pateoAlto: 3,         /* cana no pátio acima disso (em horas de moagem): a cota baixa 10% */
  pateoBaixo: 1.5,      /* abaixo disso: a cota sobe 10% para não faltar cana */
  atual: null
};

function janelaCota(t = Date.now()){
  const ini0 = iniHoje().getTime(), k = Math.floor((t - ini0) / (COTA.horas * H));
  const ini = ini0 + k * COTA.horas * H;
  return { ini, fim: ini + COTA.horas * H, n: k + 1, de: Math.round(24 / COTA.horas) };
}
const pesoFrente = s => s.ativa ? s.share : s.share * 0.6;   /* mesmo peso que o painel usa para dividir as toneladas */

/* divide 100% entre as frentes colhendo, pelo rendimento de cada uma, sem sobra de arredondamento */
function dividirPercentual(){
  const ativas = FR.filter(s => s.ativa), soma = ativas.reduce((a, s) => a + s.share, 0) || 1;
  const pct = new Map(ativas.map(s => [s, Math.floor(s.share / soma * 100)]));
  let resto = 100 - [...pct.values()].reduce((a, b) => a + b, 0);
  ativas.slice().sort((a, b) => (b.share / soma * 100 % 1) - (a.share / soma * 100 % 1)).forEach(s => { if(resto > 0){ pct.set(s, pct.get(s) + 1); resto--; } });
  return FR.map(s => ({ s, pct: pct.get(s) || 0 }));
}

function calcularCota(){
  const j = janelaCota(), base = META_DIA * COTA.horas / 24;
  const autonomia = estoque / Math.max(1, ritmo);
  const ajuste = autonomia > COTA.pateoAlto ? -0.1 : autonomia < COTA.pateoBaixo ? 0.1 : 0;
  const total = Math.round(base * (1 + ajuste) / 10) * 10;
  return { ...j, total, ajuste, autonomia, frentes: dividirPercentual().map(x => ({ ...x, t: Math.round(total * x.pct / 100) })) };
}

/* quanto já entrou na janela, no total e por frente */
function realizadoCota(c){
  const tot = somaEntre(c.ini, Math.min(Date.now(), c.fim)), soma = FR.reduce((a, s) => a + pesoFrente(s), 0) || 1;
  return { tot, por: new Map(FR.map(s => [s, tot * pesoFrente(s) / soma])) };
}

const horaCheia = t => `${new Date(t).getHours()}`;

/* o comunicado: CCO fala a cota e o percentual de cada frente; as frentes confirmam por ordem */
function anunciarCota(tipo){
  const c = COTA.atual, cco = P.coo(), f = [];
  const fala = (q, t) => f.push({ quem: q.rot, texto: t, papel: q.papel, coo: q.papel === 'coo', canal: 'frentes' });
  const janela = `das ${horaCheia(c.ini)} às ${horaCheia(c.fim)} horas`;
  if(tipo === 'redistribuir'){
    const par = FR.filter(s => !s.ativa).map(s => s.f.nome);
    const motivo = par.length ? `${par.join(' e ')} ${par.length > 1 ? 'paradas' : 'parada'}` : 'Todas as frentes colhendo de novo';
    fala(cco, `Atenção todas as frentes, aqui é o CCO. ${motivo}, redistribuindo a cota ${janela}. Continua ${nf(c.total)} toneladas.`);
  }else{
    fala(cco, `Atenção todas as frentes, aqui é o CCO. ${tipo === 'vigente' ? 'Relembrando a cota de entrada de cana' : 'Cota de entrada de cana'} ${janela}: ${nf(c.total)} toneladas.`);
    if(c.ajuste < 0) fala(cco, `Pátio da usina com cana para ${fmt(Math.round(c.autonomia * 60))} de moagem. Cota reduzida em 10 por cento.`);
    if(c.ajuste > 0) fala(cco, `Pátio da usina baixo, só ${fmt(Math.round(c.autonomia * 60))} de cana. Cota aumentada em 10 por cento, preciso de cana.`);
  }
  c.frentes.forEach(x => fala(cco, x.pct ? `${x.s.f.nome}, ${x.pct} por cento, ${nf(x.t)} toneladas.` : `${x.s.f.nome}, parada, sem cota até voltar a colher.`));
  fala(cco, 'Confirmem por ordem. Câmbio.');
  c.frentes.filter(x => x.pct).forEach(x => fala(P.frente(x.s), pickR([
    `${x.s.f.nome}, QSL. ${x.pct} por cento.`, `${x.s.f.nome} copiou, ${nf(x.t)} toneladas.`, `QSL, ${x.s.f.nome}. ${x.pct} por cento, ${nf(x.t)} toneladas.`, `${x.s.f.nome} ciente. ${x.pct} por cento.`
  ])));
  fala(cco, pickR(['Todas confirmadas. Bom trabalho a todos. Câmbio final.', 'QSL a todas as frentes. Câmbio final.', 'Cota confirmada. Obrigado, câmbio final.']));
  filaRadio(f, false, true);
  c.anunciadaEm = Date.now();
  desenharCota();
}

/* a cada 5 s: virou a janela, passa a cota nova; uma frente parou ou voltou, redistribui */
function verificarCota(){
  const j = janelaCota();
  if(!COTA.atual || COTA.atual.ini !== j.ini){
    const primeira = !COTA.atual;
    COTA.atual = calcularCota();
    /* ao abrir o sistema no meio da janela, o CCO relembra a cota que está valendo */
    anunciarCota(primeira && Date.now() - j.ini > 10 * 60000 ? 'vigente' : 'nova');
    return;
  }
  const ativasAgora = FR.filter(s => s.ativa).map(s => s.i).join(',');
  const ativasCota = COTA.atual.frentes.filter(x => x.pct).map(x => x.s.i).join(',');
  if(ativasAgora && ativasAgora !== ativasCota){
    COTA.atual.frentes = dividirPercentual().map(x => ({ ...x, t: Math.round(COTA.atual.total * x.pct / 100) }));
    anunciarCota('redistribuir');
  }
}

/* ---------- Painel ---------- */
function desenharCota(){
  const el = document.getElementById('gCota'); if(!el || !COTA.atual) return;
  const c = COTA.atual, r = realizadoCota(c), agora = Date.now();
  const decorrido = clamp((agora - c.ini) / (c.fim - c.ini), 0, 1), pctTot = c.total ? r.tot / c.total * 100 : 0;
  const esperado = c.total * decorrido, dif = r.tot - esperado;
  document.getElementById('gCotaJan').textContent = `${hm(new Date(c.ini))} às ${hm(new Date(c.fim))}, janela ${c.n} de ${c.de}`;
  el.innerHTML = `
    <div class="trio">
      <div><b>${nf(c.total)} t</b><span>de cota na janela${c.ajuste ? ` (${c.ajuste > 0 ? '+' : '−'}10% pelo pátio)` : ''}</span></div>
      <div><b>${nf(r.tot)} t</b><span>já entraram, ${nf(pctTot, 1)}% da cota</span></div>
      <div><b class="${dif >= 0 ? 'q-ok' : 'q-red'}">${dif >= 0 ? '+' : '−'}${nf(Math.abs(dif))} t</b><span>${dif >= 0 ? 'adiantado' : 'atrasado'} em relação ao ritmo da cota</span></div>
    </div>
    <table class="tbl cota">
      <tr><th>Frente</th><th>%</th><th>Cota</th><th>Realizado</th><th>Atingido</th></tr>
      ${c.frentes.map(x => { const re = r.por.get(x.s) || 0, at = x.t ? re / x.t * 100 : 0;
        return `<tr class="${x.pct ? '' : 'parada'}"><td>${x.s.f.nome}<small>${x.s.f.fazenda}</small></td><td>${x.pct}%</td><td>${nf(x.t)} t</td><td>${nf(re)} t</td>
          <td class="chega">${x.pct ? nf(at) + '%' : 'parada'}<span class="pbar"><i style="width:${Math.min(100, at)}%;background:${at >= decorrido * 100 - 5 ? 'var(--ok)' : 'var(--warn)'}"></i><em style="left:${decorrido * 100}%"></em></span></td></tr>`; }).join('')}
    </table>
    <p class="meta-txt">Próxima cota às ${hm(new Date(c.fim))}. Passada no rádio às ${c.anunciadaEm ? hm(new Date(c.anunciadaEm)) : '–'}. A marca na barra mostra onde cada frente deveria estar agora.</p>`;
}
document.getElementById('btnCotaRadio').addEventListener('click', () => { if(COTA.atual) anunciarCota('vigente'); });

setTimeout(() => { verificarCota(); setInterval(verificarCota, 5000); }, 12000);
setInterval(() => { if(document.body.classList.contains('modo-painel')) desenharCota(); }, 2000);
