/* Usina em 3D: Voz do rádio. Cada mensagem aparece na tela no mesmo momento em que é falada,
   com chiado e bipe de rádio; o CCO responde só depois que o motorista termina de falar. */
"use strict";

const RADIO = { fila: [], tocando: null, som: true, liberado: false, vozes: [], avisou: false };
const FILA_RADIO_MAX = 14;   /* se acumular mais falas que isso, as conversas mais antigas vão direto para o histórico sem tocar */
let idConversa = 0;

/* ---------- Texto para fala: frota falada em pares ("frota 31 27"), abreviações por extenso ---------- */
const ORDINAL = { 1:'primeiro', 2:'segundo', 3:'terceiro' };
function paraFala(t){
  return t
    .replace(/\b(11|22|3[0-2])(\d{2})\b/g, '$1 $2')          /* frota, transbordo e colhedora: "31 27", como se fala no rádio */
    .replace(/\bQAP\b/g, 'quê á pê').replace(/\bQSL\b/g, 'quê ésse éle').replace(/\bQRX\b/g, 'quê érre xis')
    .replace(/\bCCO\b/g, 'cê cê ó')
    /* "Frente 3: 35" era lido como hora (3h35): dois-pontos depois de nome vira pausa, e número:número só é hora se for hh:mm de verdade */
    .replace(/([A-Za-zÀ-ú]+ \d{1,2}): /g, '$1, ')
    .replace(/\b(\d{1,2}):(\d{2})\b/g, (_, h, m) => +h < 24 && +m < 60 ? `${+h} ${+h === 1 ? 'hora' : 'horas'}${+m ? ' e ' + (+m) : ''}` : `${h}, ${m}`)
    .replace(/(\d+)d (\d+)h/g, (_, d, h) => `${d} ${d === '1' ? 'dia' : 'dias'} e ${h} ${h === '1' ? 'hora' : 'horas'}`)
    .replace(/(\d+)h(\d{2})/g, (_, h, m) => `${h} ${h === '1' ? 'hora' : 'horas'}${+m ? ` e ${+m} minutos` : ''}`)
    .replace(/(\d+) min\b/g, (_, m) => `${m} ${m === '1' ? 'minuto' : 'minutos'}`)
    .replace(/(\d+) km\b/g, '$1 quilômetros')
    .replace(/\bFaz\./g, 'Fazenda').replace(/\bEng\./g, 'Engenho')
    .replace(/(\d)º/g, (_, n) => ORDINAL[n] || n + 'º');
}

/* ---------- Vozes ---------- */
/* escolhe as vozes mais nítidas: as "Natural/Online" do Edge e a do Google primeiro.
   O CCO fala com voz feminina e o pessoal do campo com voz masculina, quando o computador tiver as duas. */
const VOZ_FEM = /francisca|thalita|maria|luciana|vit[oó]ria|leila|yara|manuela|brenda|elza|giovanna|let[ií]cia|google portugu/i;
const VOZ_MASC = /ant[oô]nio|daniel|donato|f[aá]bio|humberto|j[uú]lio|nicolau|val[eé]rio|heitor/i;
function nota(v){ const n = v.name.toLowerCase(); return (/natural|online|neural/.test(n) ? 10 : 0) + (/google/.test(n) ? 6 : 0) + (/microsoft/.test(n) ? 3 : 0) + (/^pt[-_]br/i.test(v.lang) ? 2 : 0); }
function carregarVozes(){
  if(!('speechSynthesis' in window)) return;
  const v = speechSynthesis.getVoices();
  let pt = v.filter(x => /^pt[-_]BR/i.test(x.lang));
  if(!pt.length) pt = v.filter(x => /^pt/i.test(x.lang));
  pt.sort((a, b) => nota(b) - nota(a));
  RADIO.vozes = pt;
  let salva = null; try{ salva = localStorage.getItem('usina-voz-cco'); }catch(_){}
  RADIO.vozCOO = pt.find(x => x.name === salva) || pt.find(x => VOZ_FEM.test(x.name)) || pt[0] || null;
  RADIO.vozCampo = pt.find(x => VOZ_MASC.test(x.name) && x !== RADIO.vozCOO) || pt.find(x => x !== RADIO.vozCOO) || pt[0] || null;
  RADIO.vozCampo2 = pt.find(x => x !== RADIO.vozCOO && x !== RADIO.vozCampo) || RADIO.vozCampo;
  atualizarBotaoVoz();
}
/* o CCO tem sempre a mesma voz; dá para escolher qual no menu Mais */
function nomeCurto(v){ return v ? v.name.replace(/Microsoft |Google |Online |\(Natural\)|- Portuguese.*$|portuguese.*$/gi, '').trim() || v.name : 'padrão'; }
function atualizarBotaoVoz(){ const b = document.getElementById('btnVozCCO'); if(b) b.lastChild.textContent = `Voz do CCO: ${nomeCurto(RADIO.vozCOO)}`; }
function trocarVozCCO(){
  if(!RADIO.vozes.length){ mostrarAviso('Nenhuma voz em português instalada neste computador.'); return; }
  const i = RADIO.vozes.indexOf(RADIO.vozCOO), v = RADIO.vozes[(i + 1) % RADIO.vozes.length];
  RADIO.vozCOO = v;
  if(RADIO.vozCampo === v) RADIO.vozCampo = RADIO.vozes.find(x => x !== v) || v;
  try{ localStorage.setItem('usina-voz-cco', v.name); }catch(_){}
  atualizarBotaoVoz();
  if(RADIO.som && RADIO.liberado && !RADIO.tocando) filaRadio([{ quem: 'CCO', texto: 'CCO na escuta. Teste de voz.', papel: 'coo', coo: true, canal: 'frentes' }]);
}
if('speechSynthesis' in window){ carregarVozes(); speechSynthesis.onvoiceschanged = carregarVozes; }

/* ---------- Efeito de rádio: chiado curto e bipe de fim de câmbio ---------- */
let audioCtx = null;
function efeitoRadio(fim){
  if(!RADIO.som || !RADIO.liberado) return;
  try{
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime, dur = fim ? 0.06 : 0.12;
    const buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * dur), audioCtx.sampleRate), d = buf.getChannelData(0);
    for(let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const ruido = audioCtx.createBufferSource(); ruido.buffer = buf;
    const filtro = audioCtx.createBiquadFilter(); filtro.type = 'bandpass'; filtro.frequency.value = 1800; filtro.Q.value = 0.8;
    const g = audioCtx.createGain(); g.gain.value = 0.07;   /* chiado baixo e só antes/depois da fala, para não atrapalhar a voz */
    ruido.connect(filtro).connect(g).connect(audioCtx.destination); ruido.start(t);
    if(fim){
      const o = audioCtx.createOscillator(), go = audioCtx.createGain();
      o.frequency.value = 1250; go.gain.setValueAtTime(0.05, t + 0.06); go.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(go).connect(audioCtx.destination); o.start(t + 0.06); o.stop(t + 0.19);
    }
  }catch(_){}
}

/* ---------- Fila: mostra e fala juntos, uma mensagem de cada vez ---------- */
/* entra uma conversa inteira; as opcionais (falas do campo) só entram se o rádio estiver com pouca coisa na fila */
function filaRadio(msgs, opcional, prioridade){
  if(!Array.isArray(msgs)) msgs = [msgs];
  if(opcional && RADIO.fila.length > 3){ msgs.forEach(m => { if(m.aoTocar){ const fn = m.aoTocar; m.aoTocar = null; fn(); } }); return; }
  const g = ++idConversa;
  msgs.forEach(m => { m.g = g; m.prio = !!prioridade; });
  /* comunicado do CCO (cota, redistribuição) passa na frente de tudo que ainda não começou a tocar */
  if(prioridade){ const i = RADIO.fila.findIndex(m => !m.prio); RADIO.fila.splice(i < 0 ? RADIO.fila.length : i, 0, ...msgs); }
  else RADIO.fila.push(...msgs);
  while(RADIO.fila.length > FILA_RADIO_MAX){
    const k = RADIO.fila.findIndex(m => !m.prio); if(k < 0) break;
    const g0 = RADIO.fila[k].g, grupo = RADIO.fila.filter(m => m.g === g0);
    RADIO.fila = RADIO.fila.filter(m => m.g !== g0); grupo.forEach(entrarNoHistorico);
  }
  if(!RADIO.tocando) proximaRadio();
}
function entrarNoHistorico(m){
  m.hora = new Date();
  /* o que a fala muda no sistema (caminhão entra no pátio, sai do pátio, pega a estrada) acontece quando ela vai ao ar */
  if(m.aoTocar){ const fn = m.aoTocar; m.aoTocar = null; try{ fn(); }catch(e){ console.error(e); } }
  DESP.radio.unshift(m); if(DESP.radio.length > 80) DESP.radio.length = 80;
  desenharRadio();
}
function proximaRadio(){
  const m = RADIO.fila.shift();
  if(!m){ RADIO.tocando = null; esconderRadio3D(); return; }
  RADIO.tocando = m; RADIO.falandoAgora = m;
  entrarNoHistorico(m);
  mostrarRadio3D(m.quem, m.texto, m.coo, true);
  let acabou = false;
  const fim = () => {
    if(acabou) return; acabou = true; clearTimeout(m._seg);
    efeitoRadio(true);
    marcarFalando(false);
    RADIO.falandoAgora = null; desenharRadio();
    const prox = RADIO.fila[0], mesmaConversa = prox && prox.g === m.g;
    /* resposta rápida dentro da conversa (às vezes demora, como no rádio de verdade); entre conversas, um silêncio maior */
    setTimeout(proximaRadio, prox && prox.pausa ? prox.pausa : mesmaConversa ? rnd(350, 1100) : rnd(1800, 3500));   /* pausa de câmbio; entre conversas diferentes, um pouco mais */
  };
  const estimado = 1200 + m.texto.length * 62;   /* duração aproximada da fala, usada sem som ou se o navegador travar */
  if(RADIO.som && RADIO.liberado && 'speechSynthesis' in window){
    efeitoRadio(false);
    const u = new SpeechSynthesisUtterance(paraFala(m.texto));
    u.lang = 'pt-BR';
    /* cada pessoa do campo tem sempre o mesmo jeito de falar: voz e tom tirados do nome dela,
       assim numa conversa entre colhedora e transbordo dá para distinguir quem está falando */
    let hq = 0; for(const ch of m.quem) hq = (hq * 31 + ch.charCodeAt(0)) >>> 0;
    const voz = m.coo ? RADIO.vozCOO : (hq % 2 ? RADIO.vozCampo2 : RADIO.vozCampo);
    if(voz) u.voice = voz;
    u.pitch = m.coo ? (RADIO.vozCOO === RADIO.vozCampo ? 1.1 : 1.0) : 0.9 + (hq % 5) * 0.04;
    u.rate = m.coo ? 0.93 : 1.0; u.volume = 1;   /* o CCO fala um pouco mais pausado, para os números ficarem claros */
    u.onstart = () => marcarFalando(true);
    u.onend = fim; u.onerror = fim;
    m._seg = setTimeout(fim, estimado * 1.8 + 3000);
    setTimeout(() => { if(!acabou) speechSynthesis.speak(u); }, 170);
  }else{
    marcarFalando(true);
    m._seg = setTimeout(fim, estimado);
    if(RADIO.som && !RADIO.liberado && !RADIO.avisou){ RADIO.avisou = true; mostrarAviso('Clique em qualquer lugar da tela para ouvir o rádio.'); }
  }
}
function marcarFalando(on){ const el = document.getElementById('radio3d'); if(el) el.classList.toggle('falando', on); }

/* o navegador só libera som depois que a pessoa interage com a página */
function liberarSom(){
  if(RADIO.liberado) return;
  RADIO.liberado = true;
  try{ audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); }catch(_){}
  try{ if('speechSynthesis' in window){ const u = new SpeechSynthesisUtterance(''); u.volume = 0; speechSynthesis.speak(u); } }catch(_){}
}
addEventListener('pointerdown', liberarSom, { once: true, capture: true });
addEventListener('keydown', liberarSom, { once: true, capture: true });

function setSom(on){
  RADIO.som = on;
  const b = document.getElementById('btnSom');
  if(b){ b.setAttribute('aria-pressed', String(on)); b.lastChild.textContent = on ? 'Som do rádio ligado' : 'Som do rádio desligado'; }
  if(!on && 'speechSynthesis' in window) speechSynthesis.cancel();   /* o cancel dispara o fim e a fila segue em silêncio */
  try{ localStorage.setItem('usina-som', on ? '1' : '0'); }catch(_){}
}
(function(){
  let on = true; try{ on = localStorage.getItem('usina-som') !== '0'; }catch(_){}
  setSom(on);
  const b = document.getElementById('btnSom'); if(b) b.addEventListener('click', () => setSom(!RADIO.som));
  const bv = document.getElementById('btnVozCCO'); if(bv) bv.addEventListener('click', trocarVozCCO);
  atualizarBotaoVoz();
})();
