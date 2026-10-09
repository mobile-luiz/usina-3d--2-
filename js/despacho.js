/* Usina em 3D: Despacho dos caminhões vazios pelo CCO. Ao sair da balança vazio, o sistema escolhe a frente,
   o motorista avisa pelo rádio e o painel mostra o destino e quanto falta para chegar. */
"use strict";

/* O 3D roda acelerado: cada minuto de viagem leva ESCALA_DESPACHO milissegundos na tela */
const ESCALA_DESPACHO = 1000;
const PATIO_MAX = 6;   /* vazios esperando ordem no pátio; acima disso o caminhão nem é registrado na simulação */
const DESP = { patio: [], radio: [], carregados: [], iniciado: false, filtro: 'todos' };
const NOME_CANAL = { despacho: 'despacho', frentes: 'frentes', campo: 'campo' };
document.querySelectorAll('#radioFiltro button').forEach(b => b.addEventListener('click', () => {
  DESP.filtro = b.dataset.canal;
  document.querySelectorAll('#radioFiltro button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  desenharRadio();
}));

const minutosViagem = s => Math.max(1, Math.round(s.f.km / VEL_CAMINHAO * 60));
const vagasFrente = s => FILA_MAX - s.fila.length - s.vindo.length;
function faltaMin(v){ return v.t0 == null ? v.min : Math.max(0, Math.ceil(v.min - (performance.now() - v.t0) / ESCALA_DESPACHO)); }
/* pátio: só conta como "no pátio" depois que o motorista confirmou no rádio; quem já foi chamado não é chamado de novo */
const noPatio = () => DESP.patio.filter(p => p.noPatio);

/* regra do sistema: só frente colhendo e com vaga; vai para a que tem menos caminhões comprometidos e, no empate, a mais perto */
function escolherFrente(){
  const c = FR.filter(s => s.ativa && vagasFrente(s) > 0);
  if(!c.length) return null;
  c.sort((a, b) => (a.fila.length + a.vindo.length) - (b.fila.length + b.vindo.length) || minutosViagem(a) - minutosViagem(b));
  return c[0];
}

/* ---------- Conversas de rádio no jeito de usina ----------
   Toda conversa segue o procedimento do rádio: quem chama dá o indicativo de quem quer e o seu ("CCO, 3127"),
   o outro responde "Prossiga" ou "QAP", vem a mensagem e fecha com "QSL" (entendido) ou "Copiado".
   As frases variam e não se repetem: cada lista de frases é sorteada sem repetir até usar todas.
   Papéis (definem a voz): motorista, coo, frente, campo. Canais (filtro do painel): despacho, frentes, campo. */
const LIDER = ['Damião', 'Cícero', 'Galego', 'Raimundo', 'Tonho', 'Nego Bia'];
const liderDe = s => LIDER[s.i % LIDER.length];

/* sorteio sem repetição: só volta a usar uma frase depois de usar todas as outras da mesma lista */
const SACOS = {};
function pickR(a){
  if(!a.length) return undefined;
  if(!a.every(x => typeof x === 'string' || typeof x === 'function')) return a[Math.floor(Math.random() * a.length)];
  const k = a.length + '|' + a.map(x => String(x).replace(/\d+([.,]\d+)?/g, '#').slice(0, 80)).join('|');
  let b = SACOS[k];
  if(!b || !b.ordem.length){
    const ult = b && b.ult, o = [...a.keys()].sort(() => Math.random() - 0.5);
    if(o.length > 1 && o[0] === ult) o.push(o.shift());
    b = SACOS[k] = { ordem: o, ult };
  }
  const i = b.ordem.shift(); b.ult = i; return a[i];
}

/* um participante do rádio: rótulo na tela, como é chamado no rádio e o papel (voz) */
const P = {
  coo:      ()      => ({ rot: 'CCO', ind: 'CCO', papel: 'coo' }),
  frota:    n       => ({ rot: `Frota ${n}`, ind: n, papel: 'motorista' }),
  frente:   s       => ({ rot: `${s.f.nome} (${liderDe(s)})`, ind: s.f.nome, papel: 'frente' }),
  tb:       s       => ({ rot: `Transbordo ${s.tb.cod}`, ind: s.tb.cod, papel: 'campo' }),
  colh:     c       => ({ rot: `Colhedora ${c.cod}`, ind: c.cod, papel: 'campo' }),
  outro:    (r, i)  => ({ rot: r, ind: i || r, papel: 'campo' })
};

/* monta a conversa: chamada, resposta, mensagens e (quando cabe) o fechamento. Cada fala acontece uma vez só. */
function qso(a, b, corpo, canal, opcional, op = {}){
  const f = [];
  const fala = t => q => f.push({ quem: q.rot, texto: t.charAt(0).toUpperCase() + t.slice(1), papel: q.papel, coo: q.papel === 'coo', canal });
  fala(pickR([`${b.ind}, ${a.ind}.`, `${b.ind}, ${a.ind}, câmbio.`, `${a.ind} chamando ${b.ind}.`, `${b.ind}, aqui é ${/^(apontador|pipa|comboio)/.test(a.ind) ? 'o ' : ''}${a.ind}.`]))(a);
  fala(pickR([`Prossiga, ${a.ind}.`, `QAP, ${a.ind}.`, `Na escuta, ${a.ind}, prossiga.`, `Pode falar, ${a.ind}.`, `Fala, ${a.ind}.`, `${a.ind}, prossiga.`]))(b);
  corpo.forEach(([quem, texto, aoTocar]) => { fala(texto)(quem === 'a' ? a : b); if(aoTocar) f[f.length - 1].aoTocar = aoTocar; });
  const ult = corpo.length ? corpo[corpo.length - 1][0] : 'a';
  if(!op.semFecho){
    if(ult === 'a') fala(pickR(['QSL.', `QSL, ${a.ind}.`, 'Copiado.', `Copiado, ${a.ind}.`, 'Positivo.', 'Entendido.']))(b);
    else fala(pickR(['QSL, câmbio.', 'Copiado, obrigado.', 'Positivo, QSL.', 'Valeu, câmbio.', 'QSL.', 'Copiado.']))(a);
  }
  filaRadio(f, opcional);
}
/* mensagem geral, sem resposta (aviso para todos) */
function geral(a, texto, canal){ filaRadio([{ quem: a.rot, texto, papel: a.papel, coo: a.papel === 'coo', canal }], true); }
function conversa(falas, canal, opcional){ filaRadio(falas.map(([quem, texto, papel]) => ({ quem, texto, papel, coo: papel === 'coo', canal })), opcional); }
function falarRadio(quem, texto, coo){ conversa([[quem, texto, coo ? 'coo' : 'motorista']], 'despacho'); }

function enviarParaFrente(frota, s, doPatio, p){
  const min = minutosViagem(s), f = s.f;
  /* a vaga na frente já fica reservada, mas o caminhão só pega a estrada quando confirma no rádio */
  const v = { frota, frente: s, min, t0: null, saiu: null, pronto: false, doPatio };
  s.vindo.push(v);
  const partiu = () => {
    v.t0 = performance.now(); v.saiu = new Date();
    if(p){ const k = DESP.patio.indexOf(p); if(k >= 0) DESP.patio.splice(k, 1); }
    desenharDespacho();
  };
  const corpo = doPatio ? [
    ['a', pickR([`Abriu vaga na ${f.nome}. Pode sair do pátio de vazio e seguir pra lá.`, `Libera do pátio de vazio e toca pra ${f.nome}, ${f.fazenda}.`, `Tem vaga na ${f.nome} agora. Sai do pátio e segue pra lá.`, `Sistema liberou a ${f.nome} pra você. Pode sair do pátio.`])],
    ['b', pickR([`Positivo, saindo do pátio pra ${f.nome}.`, `QSL, tô saindo agora pra ${f.nome}.`, `Copiado, já tô manobrando pra sair.`, `Beleza, ${f.nome}. Saindo.`]), partiu],
    ['a', pickR([`Previsão de ${fmt(min)}, são ${f.km} km.`, `São ${f.km} km, chega em ${fmt(min)} mais ou menos.`, `${f.talhao}, ${f.km} km. Previsão ${fmt(min)}.`])]
  ] : [
    ['a', pickR([`Saindo vazio da balança, o sistema mandou pra ${f.nome}.`, `Tarado e saindo da balança. Sistema deu ${f.nome}.`, `Vazio na saída da balança, destino ${f.nome} pelo sistema.`, `Passei na balança vazio. Tô indo pra ${f.nome}, conforme o sistema.`, `Saindo da balança agora, vazio. O sistema me jogou pra ${f.nome}.`]), partiu],
    ['b', pickR([`Positivo. ${f.nome}, ${f.fazenda}, ${f.talhao}. São ${f.km} km, previsão de ${fmt(min)}.`, `Confirmado ${f.nome}, ${f.fazenda}. Previsão de chegada ${fmt(min)}. Atenção na rodovia.`, `Isso, ${f.nome}. ${f.km} km, chega em ${fmt(min)} mais ou menos.`, `Confirmado. ${f.talhao} da ${f.fazenda}, previsão ${fmt(min)}.`, `QSL, ${f.nome}. Lá tá com ${s.fila.length} na fila, previsão de ${fmt(min)}.`])]
  ];
  if(doPatio) qso(P.coo(), P.frota(frota), corpo, 'despacho');
  else qso(P.frota(frota), P.coo(), corpo, 'despacho');
  desenharDespacho();
}

/* chamado quando um caminhão termina a volta na usina e passa vazio pela balança */
function despacharVazio(frota){
  const s = escolherFrente();
  if(s){ enviarParaFrente(frota, s, false); return; }
  if(DESP.patio.length >= PATIO_MAX) return;
  const jaTinha = DESP.patio.length > 0;
  const p = { frota, desde: null, noPatio: false, chamado: false };
  DESP.patio.push(p);
  const estacionou = () => { p.noPatio = true; p.desde = performance.now(); desenharDespacho(); };
  qso(P.frota(frota), P.coo(), [
    ['a', pickR(['Saindo vazio da balança, o sistema não deu destino.', 'Vazio na balança aqui, sem frente no sistema.', 'Tarado aqui, o sistema tá sem destino pra mim.', 'Passei vazio na balança e não apareceu frente.'])],
    ['b', pickR([`QRX no pátio de vazio. As frentes estão com fila completa, assim que abrir eu te chamo.`, `Encosta no pátio de vazio e aguarda. Fila cheia em todas as frentes.`, `Fica no pátio de vazio, vaga ${noPatio().length + 1}. Eu te chamo quando liberar.`, `Pátio de vazio, por favor. Tá tudo cheio no campo agora.`])],
    ['a', pickR(['QSL, encostando no pátio.', 'Positivo, fico no aguardo.', 'Copiado, tô no pátio.', 'Beleza, aguardando.']), estacionou]
  ], 'despacho', jaTinha, { semFecho: true });   /* com o pátio já ocupado, essa conversa vira opcional para não abafar o resto do rádio */
  desenharDespacho();
}

function chegouNaFrente(v, s){
  qso(P.frota(v.frota), P.frente(s), [
    ['a', pickR([`Chegando aí, entro em ${s.fila.length}º na fila.`, `Tô na entrada do carreador, encostando na fila.`, `Cheguei, encostei atrás do último.`, `Encostando aqui, sou o ${s.fila.length}º.`])]
  ], 'despacho', true);
  desenharDespacho();
}

/* motorista que sai carregado da frente avisa o CCO que está indo para a usina */
function saiuCarregado(s, t){
  const f = s.f, min = minutosViagem(s), ton = t.ton || Math.round(rnd(48, 62));
  DESP.carregados.push({ frota: t.frota, frente: s, ton, min, t0: performance.now(), saiu: new Date() });
  const bal = ST.filter(x => x.id === 'balanca').flatMap(x => x.items).length;
  qso(P.frota(t.frota), P.coo(), [
    ['a', pickR([`Saindo carregado da ${f.nome}, destino usina. Umas ${ton} toneladas.`, `Carregado na ${f.nome}, tô saindo pra usina.`, `Fechei a carga na ${f.nome}, seguindo pra balança. Deu umas ${ton} toneladas.`, `Saindo da ${f.nome} carregado, rumo à usina.`, `Carga completa na ${f.nome}. Tô saindo pra usina agora.`])],
    ['b', pickR([`QSL. Previsão de chegada ${fmt(min)}. Balança com ${bal} na fila.`, `Copiado, ${t.frota}. Boa viagem, atenção na rodovia.`, `Positivo. Chega em ${fmt(min)} mais ou menos, a balança tá ${bal > 5 ? 'com fila' : 'tranquila'}.`, `QSL, registrado. Pode seguir.`, `Copiado. Previsão de ${fmt(min)} até a balança.`])]
  ], 'despacho', false, { semFecho: true });
  desenharDespacho();
}

/* CCO chama uma frente de cada vez e pergunta como está o carregamento; o líder responde com o que está acontecendo lá */
let iChamada = 0;
function chamarFrente(){
  const s = FR[iChamada++ % FR.length], f = s.f;
  const pergunta = pickR(['Como está o carregamento aí?', 'Me passa a situação aí, por favor.', 'Como é que tá aí? Me passa o carregamento.', 'Situação da frente, por favor.', 'Como tá o andamento aí?', 'Me dá um retorno do carregamento.']);
  if(!s.ativa){
    const desde = hm(new Date(Date.now() - (performance.now() - s.parouEm)));
    qso(P.coo(), P.frente(s), [
      ['a', pergunta],
      ['b', `${pickR(['Continua parado', 'Ainda parado aqui', 'Tô parado', 'Seguimos parados'])} desde ${desde}, ${s.motivo.toLowerCase()}. ${s.fila.length ? `Tem ${s.fila.length} caminh${s.fila.length > 1 ? 'ões' : 'ão'} na fila esperando.` : 'Sem caminhão na fila.'} ${pickR(['O mecânico já tá aqui mexendo.', 'Já acionei a oficina, tão vindo.', 'Mecânico tá a caminho.', 'Tão trocando a peça agora.'])}`],
      ['a', pickR([`QSL. Não vou mandar vazio pra aí até liberar. Me avisa.`, `Copiado. Segura os vazios aí e me chama quando voltar a colher.`, `Entendido. Qualquer coisa me chama.`])]
    ], 'frentes');
    return;
  }
  const car = s.carregando, partes = [];
  partes.push(car ? pickR([`A ${car.frota} tá no carregamento com ${Math.round(car.fill * 100)}%.`, `${car.frota} carregando, tá com ${Math.round(car.fill * 100)}%.`, `Tô carregando a ${car.frota}, já tá em ${Math.round(car.fill * 100)}%.`])
                  : pickR(['Ninguém no carregamento agora, o próximo já tá encostando.', 'Acabou de sair um, o próximo tá entrando.']));
  partes.push(s.fila.length >= FILA_MAX ? pickR([`${s.fila.length} na fila, fila completa.`, `Fila cheia, ${s.fila.length} esperando.`, `Tem ${s.fila.length} aguardando, tá completo.`])
              : s.fila.length ? pickR([`${s.fila.length} na fila.`, `Tem ${s.fila.length} esperando.`]) : pickR(['Fila zerada.', 'Ninguém na fila.', 'Fila vazia, tô precisando de caminhão.']));
  if(s.vindo.length) partes.push(pickR([`A ${s.vindo[0].frota} tá vindo, chega em ${fmt(faltaMin(s.vindo[0]))}.`, `Tô esperando a ${s.vindo[0].frota}, falta ${fmt(faltaMin(s.vindo[0]))}.`]));
  partes.push(pickR([`Colhedora rendendo ${nf(s.ritmo)} toneladas por hora.`, `Tamo tirando ${nf(s.ritmo)} toneladas por hora.`, `Rendimento de ${nf(s.ritmo)} por hora.`, `A colhedora tá fazendo ${nf(s.ritmo)} por hora.`]));
  if(s.pipa && s.pipa.estado === 'molhando') partes.push(pickR(['O pipa tá molhando a manobra.', 'Pipa molhando o carreador.']));
  if(Math.random() < 0.35) partes.push(pickR(['Cana boa, bem em pé.', 'Tem um pedaço de cana deitada, a colhedora tá devagar ali.', 'Muita palha hoje, mas tá rodando.', 'Carreador bom, sem atoleiro.', 'Terreno meio pedregoso nessa ponta.', 'O talhão tá rendendo bem.']));
  qso(P.coo(), P.frente(s), [
    ['a', pergunta],
    ['b', partes.join(' ')],
    ['a', s.fila.length + s.vindo.length < FILA_MAX ? pickR(['QSL. Vou mandar mais um vazio assim que sair da balança.', 'Copiado. O próximo vazio vai pra aí.', 'Entendido, já vou mandar caminhão.'])
                                                     : pickR(['QSL, bom trabalho.', 'Copiado. Segue assim.', 'QSL, obrigado.', 'Beleza, valeu.'])]
  ], 'frentes', false, { semFecho: true });
}

/* falas ligadas ao que está acontecendo no 3D (cada tipo no máximo a cada 60 s para não cansar) */
const ULT_CAMPO = {};
function eventoCampo(tipo, s, o){
  if(typeof filaRadio !== 'function') return;
  if(tipo === 'saiuCarregado'){ saiuCarregado(s, o); return; }   /* toda saída carregada é avisada ao CCO */
  if(tipo === 'pipa' && o.estado !== 'molhando' && o.estado !== 'abastecendo') return;
  const agora = performance.now();
  if(agora - (ULT_CAMPO[tipo] || 0) < 60000) return;
  if((tipo === 'basculando' || tipo === 'manobra') && Math.random() < 0.6) return;
  ULT_CAMPO[tipo] = agora;
  const f = s && s.f;
  if(tipo === 'basculando' && o) qso(P.tb(s), P.frota(o.frota), [
    ['a', pickR(['Encostando pra bascular, segura firme aí.', 'Vou bascular, não sai do lugar.', 'Tô do teu lado, segura que vou virar.', 'Alinha aí que vou despejar.'])],
    ['b', pickR(['Positivo, pode bascular.', 'Pode virar, tô parado.', 'Positivo, manda.', 'Tô travado, pode descer.'])]
  ], 'campo', true, { semFecho: true });
  else if(tipo === 'manobra') dialogoManobra(s, o);
  else if(tipo === 'pipa'){
    if(o.estado === 'molhando') dialogoPipaMolhar(s);
    else if(o.estado === 'abastecendo') dialogoPipaEncher(s);
  }
  else if(tipo === 'descarga') qso(P.outro('Hilo', 'hilo'), P.coo(), [
    ['a', pickR([`Descarregou a ${o.frota}, ${o.ton} toneladas. Mesa alimentando normal.`, `${o.frota} descarregada, ${o.ton} toneladas. Esteira rodando bem.`, `Liberei a ${o.frota}, ${o.ton} toneladas no hilo.`])]
  ], 'campo', true);
}

/* conversas do dia a dia que acontecem no rádio sem estar ligadas a um evento do 3D */
/* ---------- Diálogos com os outros veículos do campo ----------
   Colhedora, transbordo, pipa, motoniveladora (patrol), comboio, oficina volante e brigada conversam entre si,
   com o líder da frente e com o CCO. Os números (nível do pipa, ritmo, fila, distância) vêm do que está acontecendo. */
const MOTONIV = ['07', '12'];
/* escolhe um roteiro inteiro (falas que combinam entre si), sem repetir até usar todos */
const roteiro = (chave, lista) => lista[+pickR(lista.map((_, i) => `${chave}:${i}`)).split(':')[1]];
const nPipa = s => s.pipa ? s.pipa.cod.replace(/\D/g, '') : '31';
const P2 = {
  pipa:   s => P.outro(`Pipa ${nPipa(s)}`, `pipa ${nPipa(s)}`),
  patrol: n => P.outro(`Motoniveladora ${n}`, `patrol ${n}`),
  comboio:() => P.outro('Comboio 4', 'comboio 4'),
  oficina:() => P.outro('Oficina volante', 'oficina volante'),
  brigada:() => P.outro('Brigada', 'brigada')
};

/* líder pede o pipa para molhar a manobra (quando o pipa começa a molhar no 3D) */
function dialogoPipaMolhar(s){
  const f = s.f, nv = Math.round((s.pipa ? s.pipa.nivel : 0.7) * 100);
  qso(P.frente(s), P2.pipa(s), [
    ['a', pickR(['Tá muita poeira na manobra, os motoristas não tão enxergando nada. Dá uma molhada aí?', 'Molha a área de manobra pra mim? O transbordo tá levantando muito pó.', 'Preciso de água na manobra e na entrada do carreador, tá uma poeira só.'])],
    ['b', pickR([`QSL. Tô com ${nv}% no tanque, já tô encostando.`, `Positivo, ${f.nome}. Tenho ${nv}% de água, dá pra molhar tudo.`, `Copiado. Tô do lado da colhedora, em dois minutos começo.`])],
    ['a', pickR(['Molha também a entrada do carreador, onde os caminhões fazem fila.', 'Capricha na curva da entrada, que ali junta caminhão.', 'Cuidado com o pessoal do apontamento perto da carreta.'])],
    ['b', pickR(['Positivo, faço a entrada também.', 'Pode deixar, molho a curva também.', 'QSL, vou devagar ali.'])]
  ], 'campo', true, { semFecho: true });
}

/* pipa avisa que vai encher; CCO organiza quem cobre a frente enquanto isso */
function dialogoPipaEncher(s){
  const outra = FR.find(x => x !== s && x.ativa && x.pipa) || null, volta = Math.round(rnd(20, 40));
  qso(P2.pipa(s), P.coo(), [
    ['a', pickR([`Tanque vazio. Vou encher no ponto d'água da ${s.f.fazenda}, volto em uns ${volta} minutos.`, `Acabou a água aqui na ${s.f.nome}. Indo encher, devo voltar em ${volta} minutos.`])],
    ['b', outra ? pickR([`QSL. Enquanto isso o pipa ${nPipa(outra)} da ${outra.f.nome} dá uma passada na ${s.f.nome} se precisar.`, `Copiado. Se a ${s.f.nome} precisar, eu desloco o pipa ${nPipa(outra)}.`])
                : 'QSL. Vai e volta rápido que a poeira tá forte hoje.'],
    ['a', pickR(['Positivo, câmbio.', 'Copiado. Te aviso quando voltar.', 'Beleza, já tô saindo.'])]
  ], 'campo', true, { semFecho: true });
}

/* colhedora e transbordo combinando a manobra do fim da linha */
function dialogoManobra(s, c){
  const cheio = Math.round((s.tb ? s.tb.fill : 0.5) * 100);
  qso(P.colh(c), P.tb(s), [
    ['a', pickR(['Fim de linha, vou manobrar pra próxima. Me acompanha.', 'Virando no fim da linha, encosta do outro lado.', 'Vou virar pra linha de cima, me espera na cabeceira.'])],
    ['b', cheio > 70 ? pickR([`Tô com ${cheio}% no transbordo. Depois dessa virada vou bascular no caminhão.`, `Transbordo quase cheio, ${cheio}%. Na volta eu basculo e já encosto de novo.`])
                     : cheio < 15 ? pickR(['Copiado. Acabei de bascular, tô vazio, pode mandar.', 'Positivo, tô vazio, te acompanho.'])
                     : pickR([`Copiado. Tô com ${cheio}%, dá pra mais uma linha inteira.`, `Positivo, te acompanho. Ainda cabe bastante, tô com ${cheio}%.`])],
    ['a', pickR(['Beleza. Cuidado que a cabeceira tá com toco.', 'QSL. Vou devagar na virada pra você alinhar.', 'Fechado. Segura a distância do elevador.'])],
    ['b', pickR(['Positivo.', 'Pode deixar.', 'Copiado.'])]
  ], 'campo', true, { semFecho: true });
}

const DIALOGOS_VEICULOS = [
  /* colhedora com problema chama o líder (cada roteiro é uma conversa coerente do começo ao fim) */
  s => qso(P.colh(s.colh[0]), P.frente(s), roteiro('colh', [
    [['a', 'Tô sentindo a colhedora embuchando no picador. Vou ter que parar uns minutos pra limpar.'],
     ['b', 'Para com segurança e desliga o picador antes de mexer. Quanto tempo?'],
     ['a', 'Uns quinze minutos, acho que resolvo sozinho.'],
     ['b', 'QSL. Vou avisar o CCO pra segurar os vazios.']],
    [['a', 'O corte de base tá arrancando muita soqueira. Acho que as facas tão gastas.'],
     ['b', 'Quando foi a última troca?'],
     ['a', 'Ontem à tarde, mas pegou muita pedra nesse talhão.'],
     ['b', 'Termina essa linha e para na cabeceira. Vou chamar a oficina pra trocar as facas.'],
     ['a', 'Positivo, termino e paro.']],
    [['a', 'Tá saindo muita cana pelo extrator, a perda tá alta nessa linha.'],
     ['b', 'Baixa a rotação do extrator primário e me fala se melhorou.'],
     ['a', 'Baixei. Já tá saindo bem menos.'],
     ['b', 'Beleza, mantém assim. Mas fica de olho na impureza.']],
    [['a', 'A cana tá muito deitada aqui, vou ter que colher num sentido só.'],
     ['b', 'Vai perder rendimento. Quanto falta pra acabar esse pedaço?'],
     ['a', 'Umas seis linhas.'],
     ['b', 'QSL. Colhe no sentido certo mesmo, melhor que perder cana. Aviso o CCO que o ritmo vai cair.']]
  ]), 'campo', true, { semFecho: true }),

  /* CCO manda a motoniveladora arrumar o carreador */
  s => { const n = pickR(MOTONIV), outra = pickR(FR.filter(x => x !== s));
    qso(P.coo(), P2.patrol(n), [
      ['a', pickR([`Onde você tá agora?`, `Me passa sua posição.`, `Tá terminando aí?`])],
      ['b', pickR([`Tô no carreador da ${outra.f.fazenda}, terminando de patrolar.`, `Tô na estrada da ${outra.f.fazenda}, acabei agora.`, `Finalizando a curva da ${outra.f.fazenda}.`])],
      ['a', pickR([`Quando liberar, vai pro carreador da ${s.f.nome}. Os motoristas tão reclamando de buraco perto da porteira.`, `Preciso de você na ${s.f.nome}, a estrada tá cheia de costela e os caminhões carregados tão sofrendo.`, `Desloca pra ${s.f.nome}. Tem um trecho com erosão depois da ponte.`])],
      ['b', `QSL. Daqui pra lá são uns ${Math.round(rnd(6, 15))} quilômetros, em ${Math.round(rnd(25, 45))} minutos tô lá.`],
      ['a', 'Positivo. Quando chegar, avisa os motoristas no rádio pra reduzir no trecho.'],
      ['b', 'Copiado, CCO.']
    ], 'campo', true, { semFecho: true }); },

  /* motoniveladora avisa os motoristas */
  s => { const n = pickR(MOTONIV);
    geral(P2.patrol(n), pickR([
      `Atenção motoristas: patrol trabalhando no carreador da ${s.f.fazenda}. Reduzam e passem pela esquerda. Câmbio.`,
      `Atenção, motoniveladora ${n} na estrada da ${s.f.nome}. Pista com meia faixa, cuidado na curva. Câmbio.`]), 'campo'); },

  /* motorista conversa com a motoniveladora */
  s => { const n = pickR(MOTONIV), fr = novaFrota();
    qso(P.frota(fr), P2.patrol(n), roteiro('patrolMot', [
      [['a', 'Tô chegando no trecho onde você tá trabalhando, carregado. Passo por onde?'],
       ['b', 'Segura um minutinho que eu termino a passada e te libero.'],
       ['a', 'Positivo, parado aguardando.'],
       ['b', 'Pronto, liberado. Pode vir pela direita, devagar.'],
       ['a', 'Copiado, passando. Valeu.']],
      [['a', 'Tô chegando no seu trecho, vazio. Dá pra passar?'],
       ['b', 'Dá sim. Vem pela esquerda, que o lado direito tá fofo ainda.'],
       ['a', 'QSL, pela esquerda.']],
      [['a', 'A estrada tá com uma valeta funda logo depois da ponte. Você vai passar lá?'],
       ['b', 'Vou sim, é o próximo trecho. Obrigado pelo aviso.'],
       ['a', 'Nada. Bom serviço aí.']]
    ]), 'campo', true, { semFecho: true }); },

  /* comboio negocia o abastecimento com a colhedora */
  s => { const nv = Math.round(rnd(10, 22));
    qso(P.colh(s.colh[0]), P2.comboio(), [
      ['a', pickR([`Tô com ${nv}% de diesel aqui na ${s.f.nome}. Consegue passar?`, `Entrei na reserva, ${nv}% no tanque. Onde você tá?`])],
      ['b', pickR([`Tô abastecendo o transbordo da ${pickR(FR.filter(x => x !== s)).f.nome}. Em uns ${Math.round(rnd(15, 30))} minutos chego.`, `Saindo do posto agora, cheio. Chego aí em ${Math.round(rnd(20, 35))} minutos.`])],
      ['a', pickR(['Dá tempo. Me encontra na cabeceira do talhão.', 'Beleza, vou parar na cabeceira pra você encostar.', 'Traz graxa também, que o elevador tá chiando.'])],
      ['b', pickR(['QSL, cabeceira do talhão.', 'Positivo, levo a graxa.', 'Copiado. Quando eu chegar te chamo.'])]
    ], 'campo', true, { semFecho: true }); },

  /* oficina volante atende a frente */
  s => qso(P.frente(s), P2.oficina(), roteiro('oficina', [
    [['a', `O transbordo ${s.tb.cod} tá com vazamento de óleo no comando. Consegue dar uma olhada?`],
     ['b', 'Tô terminando um serviço na usina. Ele pode continuar rodando?'],
     ['a', 'Pode, mas tá pingando bastante.'],
     ['b', 'Então roda devagar e para se acender a luz do óleo. Em uns quarenta minutos chego.'],
     ['a', 'QSL, aguardando.']],
    [['a', `A colhedora ${s.colh[0].cod} tá com a temperatura subindo. Pode vir?`],
     ['b', 'QSL. Tô a uns vinte minutos daí. Tá na faixa vermelha?'],
     ['a', 'Ainda não, mas subindo rápido.'],
     ['b', 'Para na sombra e deixa em marcha lenta, sem desligar. Deve ser o radiador sujo de palha.'],
     ['a', 'Positivo, vou parar.']],
    [['a', `O pneu do transbordo ${s.tb.cod} tá baixando de novo.`],
     ['b', 'É o mesmo da semana passada? Pode ser a válvula.'],
     ['a', 'O mesmo. Traseiro esquerdo.'],
     ['b', 'Copiado. Levo uma válvula nova e o compressor. Para quando o pneu ficar mole.']]
  ]), 'campo', true, { semFecho: true }),

  /* pipa e líder: pipa oferece ajuda */
  s => qso(P2.pipa(s), P.frente(s), [
    ['a', `Tô com ${Math.round((s.pipa ? s.pipa.nivel : 0.6) * 100)}% no tanque. Precisa molhar alguma coisa aí?`],
    ['b', pickR(['Molha a cabeceira do talhão, a colhedora vai virar ali daqui a pouco.', 'Por enquanto não, fica de prontidão perto da colhedora.', 'Dá uma passada no carreador da entrada, que vai passar caminhão carregado.'])],
    ['a', pickR(['Positivo, indo.', 'QSL, fico de prontidão.', 'Copiado.'])]
  ], 'campo', true, { semFecho: true }),

  /* brigada e frente: fumaça na palhada */
  s => qso(P.frente(s), P2.brigada(), [
    ['a', pickR(['Tô vendo uma fumaça na palhada perto da divisa. Pode verificar?', 'Saiu uma faísca do escapamento do trator e pegou na palha. Já tá controlado, mas vem conferir.'])],
    ['b', `QSL, saindo agora com o caminhão da brigada. Em ${Math.round(rnd(10, 20))} minutos chego. O pipa pode adiantar?`],
    ['a', `Positivo, vou mandar o pipa ${nPipa(s)} pra lá.`],
    ['b', 'Copiado. Ninguém chega perto sem EPI.']
  ], 'campo', true, { semFecho: true })
];

function conversaVeiculos(){
  const ativas = FR.filter(s => s.ativa), s = pickR(ativas.length ? ativas : FR);
  pickR(DIALOGOS_VEICULOS)(s);
}

function conversaAmbiente(){
  const ativas = FR.filter(s => s.ativa), s = pickR(ativas.length ? ativas : FR), outra = pickR(FR.filter(x => x !== s));
  const h = new Date().getHours() + new Date().getMinutes() / 60, noite = h >= 18 || h < 5.5;
  const cenas = [
    () => qso(P.colh(s.colh[0]), P.outro('Comboio 4', 'comboio 4'), [
      ['a', pickR([`Tô entrando na reserva aqui na ${s.f.nome}, consegue chegar com o diesel?`, `Precisando de diesel e graxa aqui na ${s.f.nome}.`, `Passa aqui na ${s.f.nome} quando puder, tô baixo de diesel.`])],
      ['b', `QSL. Tô terminando na ${outra.f.nome}, em uns ${Math.round(rnd(15, 35))} minutos chego aí.`]], 'campo', true),
    () => qso(P.outro(`Apontador ${s.f.nome}`, `apontador da ${s.f.nome}`), P.coo(), [
      ['a', `${s.f.talhao.replace('talhão', 'Talhão')} com ${Math.round(rnd(35, 85))}% colhido. ${pickR(['Previsão de mudar de talhão amanhã cedo.', 'Hoje à noite a gente muda de talhão.', 'Ainda tem cana pra amanhã o dia todo.'])}`]], 'campo', true),
    () => qso(P.frente(s), P.coo(), [
      ['a', `O transbordo ${s.tb.cod} tá com pneu baixo. Manda a borracharia volante quando der.`],
      ['b', 'QSL, vou acionar a borracharia. Roda devagar até chegar.']], 'campo', true, { semFecho: true }),
    () => { const rec = ST.filter(x => x.id === 'balanca').flatMap(x => x.items).length;
      qso(P.outro('Balança', 'balança'), P.coo(), [['a', `${rec} carregado${rec === 1 ? '' : 's'} aguardando pesagem, ${rec > 5 ? 'a fila tá crescendo' : 'tudo fluindo normal'}.`]], 'campo', true); },
    () => qso(P.outro('Laboratório', 'laboratório'), P.coo(), [
      ['a', `A ${novaFrota()} foi sorteada pra sonda. ${pickR(['Impureza mineral um pouco alta, vou avisar a frente.', 'Amostra dentro do padrão.', 'ATR bom nessa carga.'])}`]], 'campo', true),
    () => qso(P.frota(novaFrota()), P.frota(novaFrota()), [
      ['a', pickR([`Atenção que tem um buraco grande no carreador da ${s.f.fazenda}, perto da porteira.`, `Cuidado no cruzamento da rodovia, tem um carro parado no acostamento.`, `Tem gado solto na estrada da ${s.f.fazenda}, vai devagar.`, `A ponte do riacho tá com uma tábua solta, passa devagar.`])],
      ['b', pickR(['Copiado, obrigado pela dica.', 'Valeu, vou ficar esperto.', 'QSL, obrigado.', 'Beleza, obrigado por avisar.'])]], 'campo', true, { semFecho: true }),
    () => geral(P.coo(), pickR([
      'Atenção todos os motoristas: velocidade máxima de 40 no carreador e 60 na estrada de terra. Câmbio.',
      'Atenção frentes: não esqueçam o checklist da máquina na troca de operador. Câmbio.',
      noite ? 'Atenção todas as frentes: giroflex ligado e iluminação de serviço acesa. Cuidado redobrado na manobra. Câmbio.'
            : 'Atenção motoristas: hidratação, gente, o sol tá forte. Câmbio.']), 'campo'),
    () => qso(P.frente(s), P.coo(), [
      ['a', pickR(['Tá começando a chuviscar aqui.', 'O vento virou e tá vindo nuvem carregada pra cá.'])],
      ['b', 'QSL. Me avisa se o carreador começar a escorregar que a gente para.']], 'campo', true, { semFecho: true })
  ];
  /* perto da troca de turno, o CCO avisa uma vez */
  const proxTurno = SAFRA.turnos.map(t => (SAFRA.horaInicio + t.de) % 24).find(t => { const d = (t - h + 24) % 24; return d > 0 && d < 0.4; });
  if(proxTurno !== undefined && DESP.avisouTurno !== proxTurno){
    DESP.avisouTurno = proxTurno;
    geral(P.coo(), `Atenção todas as frentes: troca de turno às ${proxTurno} horas. O ônibus do próximo turno já tá saindo da usina. Câmbio.`, 'frentes');
    return;
  }
  /* mais da metade das vezes, a conversa é entre os veículos do campo */
  if(Math.random() < 0.6){ conversaVeiculos(); return; }
  pickR(cenas)();
}

function tickDespacho(){
  const agora = performance.now();
  /* carregados que chegaram na usina saem da lista; o "a caminho da usina" de cada frente vem daqui */
  for(let k = DESP.carregados.length - 1; k >= 0; k--){
    const c = DESP.carregados[k];
    if(agora - c.t0 >= c.min * ESCALA_DESPACHO){
      DESP.carregados.splice(k, 1);
      if(agora - (ULT_CAMPO.balanca || 0) > 50000 && Math.random() < 0.5){
        ULT_CAMPO.balanca = agora;
        qso(P.frota(c.frota), P.outro('Balança', 'balança'), [
          ['a', pickR([`Chegando carregado da ${c.frente.f.nome}.`, `Tô na entrada, carregado da ${c.frente.f.nome}.`, `Encostando na balança, vim da ${c.frente.f.nome}.`])],
          ['b', pickR(['Pode subir na balança.', 'Aguarda o sinal verde e sobe.', 'Pode encostar, tá liberado.'])]
        ], 'campo', true, { semFecho: true });
      }
    }
  }
  FR.forEach(s => s.transito = DESP.carregados.filter(c => c.frente === s).length);
  FR.forEach(s => s.vindo.forEach(v => { if(!v.pronto && v.t0 != null && agora - v.t0 >= v.min * ESCALA_DESPACHO) v.pronto = true; }));
  /* abriu vaga: o mais antigo do pátio sai primeiro */
  for(const p of noPatio()){
    if(p.chamado) continue;
    const s = escolherFrente(); if(!s) break;
    p.chamado = true;
    enviarParaFrente(p.frota, s, true, p);
  }
  if(document.body.classList.contains('modo-painel')){ desenharDespacho(); desenharCarregados(); }
}

/* começo da simulação: cada frente colhendo já tem vazios a caminho até completar a vaga */
function iniciarDespacho(){
  if(DESP.iniciado) return; DESP.iniciado = true;
  /* cada frente já tem alguns carregados na estrada indo para a usina */
  FR.forEach(s => { for(let k = s.transito; k > 0; k--){ const min = minutosViagem(s);
    DESP.carregados.push({ frota: novaFrota(), frente: s, ton: Math.round(rnd(48, 62)), min, t0: performance.now() - rnd(0.05, 0.9) * min * ESCALA_DESPACHO, saiu: new Date(Date.now() - rnd(3, 30) * 60000) }); } });
  FR.filter(s => s.ativa).forEach(s => {
    for(let k = vagasFrente(s); k > 0; k--){
      const min = minutosViagem(s), frota = novaFrota();
      s.vindo.push({ frota, frente: s, min, t0: performance.now() - rnd(0.1, 0.8) * min * ESCALA_DESPACHO, saiu: new Date(Date.now() - rnd(2, 15) * 60000), pronto: false });
      DESP.radio.unshift({ hora: new Date(), quem: `Frota ${frota}`, texto: `CCO, frota ${frota} saindo da balança vazio, seguindo para a ${s.f.nome} conforme o sistema mandou.`, coo: false, canal: 'despacho' });
    }
  });
  desenharDespacho(); desenharRadio();
  setInterval(tickDespacho, 500);
  /* o CCO chama uma frente a cada 40 a 60 segundos */
  (function agenda(){ setTimeout(() => { chamarFrente(); agenda(); }, rnd(40000, 60000)); })();
  setTimeout(chamarFrente, 9000);
  /* conversas do dia a dia, só quando o rádio está livre */
  (function ambiente(){ setTimeout(() => { if(!RADIO.tocando && RADIO.fila.length === 0) conversaAmbiente(); ambiente(); }, rnd(16000, 30000)); })();
}

/* ---------- Telas ---------- */
const radio3d = document.getElementById('radio3d');
function mostrarRadio3D(quem, texto, coo){
  if(!radio3d) return;
  radio3d.innerHTML = `<b class="${coo ? 'coo' : ''}"><i class="onda" aria-hidden="true"><i></i><i></i><i></i></i>${quem}</b><span>${texto}</span>`;
  radio3d.classList.toggle('e-coo', !!coo);
  radio3d.classList.add('on');
  clearTimeout(radio3d._t);
}
function esconderRadio3D(){ if(!radio3d) return; clearTimeout(radio3d._t); radio3d._t = setTimeout(() => radio3d.classList.remove('on'), 1500); }

function desenharDespacho(){
  const el = document.getElementById('gDesp'); if(!el) return;
  const vs = FR.flatMap(s => s.vindo).sort((a, b) => faltaMin(a) - faltaMin(b));
  el.innerHTML = '<tr><th>Frota</th><th>Vai para</th><th>Saiu</th><th>Chega em</th></tr>' + (vs.length ? vs.map(v => {
    const f = faltaMin(v), pct = clamp((v.min - f) / v.min * 100, 0, 100);
    if(v.t0 == null) return `<tr class="aguarda"><td><b>Frota ${v.frota}</b></td><td>${v.frente.f.nome}<small>${v.frente.f.fazenda}, ${v.frente.f.km} km</small></td><td>–</td>
      <td class="chega">${v.doPatio ? 'Chamado no pátio' : 'Saindo da balança'}<small>aguardando confirmar no rádio</small></td></tr>`;
    return `<tr><td><b>Frota ${v.frota}</b></td><td>${v.frente.f.nome}<small>${v.frente.f.fazenda}, ${v.frente.f.km} km</small></td><td>${hm(v.saiu)}</td>
      <td class="chega">${v.pronto ? 'Chegando' : fmt(f)}<span class="pbar"><i style="width:${pct}%"></i></span></td></tr>`;
  }).join('') : '<tr><td colspan="4">Nenhum vazio a caminho agora.</td></tr>');
  const p = document.getElementById('gPatio');
  const np = noPatio();
  p.textContent = np.length ? `${np.length} vazio${np.length > 1 ? 's' : ''} no pátio esperando vaga numa frente: ${np.map(x => 'frota ' + x.frota + (x.chamado ? ' (chamado pelo CCO)' : '')).join(', ')}.` : '';
}

function desenharCarregados(){
  const el = document.getElementById('gCarr'); if(!el) return;
  const cs = DESP.carregados.slice().sort((a, b) => (a.min - (performance.now() - a.t0) / ESCALA_DESPACHO) - (b.min - (performance.now() - b.t0) / ESCALA_DESPACHO));
  el.innerHTML = '<tr><th>Frota</th><th>Vem da</th><th>Carga</th><th>Saiu</th><th>Chega em</th></tr>' + (cs.length ? cs.map(c => {
    const f = Math.max(0, Math.ceil(c.min - (performance.now() - c.t0) / ESCALA_DESPACHO)), pct = clamp((c.min - f) / c.min * 100, 0, 100);
    return `<tr><td><b>Frota ${c.frota}</b></td><td>${c.frente.f.nome}<small>${c.frente.f.fazenda}</small></td><td>${c.ton} t</td><td>${hm(c.saiu)}</td>
      <td class="chega">${fmt(f)}<span class="pbar"><i style="width:${pct}%"></i></span></td></tr>`;
  }).join('') : '<tr><td colspan="5">Nenhum carregado na estrada agora.</td></tr>');
}
function desenharRadio(){
  const el = document.getElementById('gRadio'); if(!el) return;
  const lista = DESP.radio.filter(m => DESP.filtro === 'todos' || m.canal === DESP.filtro).slice(0, 14);
  el.innerHTML = lista.map(m => `<li class="${m.coo ? 'coo' : ''}${typeof RADIO !== 'undefined' && RADIO.falandoAgora === m ? ' falando' : ''}"><span class="h">${hm(m.hora)}</span><span><b>${m.quem}<em>${NOME_CANAL[m.canal] || ''}</em></b>${m.texto}</span></li>`).join('') || '<li>Sem mensagens neste canal.</li>';
}
