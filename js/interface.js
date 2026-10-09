/* Usina em 3D: Menu "Mais", tema claro/escuro, modo TV e o destaque de moagem em cima do 3D. */
"use strict";

/* ---------- Menu "Mais" ---------- */
const btnMais = document.getElementById('btnMais'), menuMais = document.getElementById('menuMais');
function abrirMenu(on){
  menuMais.hidden = !on; btnMais.setAttribute('aria-expanded', String(on));
  if(on){ const b = menuMais.querySelector('button:not([hidden])'); b && b.focus(); }
}
btnMais.addEventListener('click', e => { e.stopPropagation(); abrirMenu(menuMais.hidden); });
menuMais.addEventListener('click', e => { if(e.target.closest('button') && e.target.closest('#btnLuz,#btnTema,#btnQualidade,#btnSo3D,#btnSom,#btnVozCCO') === null) abrirMenu(false); });
document.addEventListener('click', e => { if(!menuMais.hidden && !e.target.closest('.mais')) abrirMenu(false); });
addEventListener('keydown', e => { if(e.key === 'Escape' && !menuMais.hidden){ abrirMenu(false); btnMais.focus(); } });

/* ---------- Tema ---------- */
const TEMAS = { sistema:'Tema do sistema', claro:'Tema claro', escuro:'Tema escuro' };
let tema = 'sistema';
function setTema(t){
  tema = TEMAS[t] ? t : 'sistema';
  const r = document.documentElement;
  if(tema === 'sistema') delete r.dataset.theme; else r.dataset.theme = tema === 'claro' ? 'light' : 'dark';
  document.getElementById('btnTema').lastChild.textContent = TEMAS[tema];
  try{ localStorage.setItem('usina-tema', tema); }catch(_){}
  /* os gráficos guardam as cores de quando foram criados: refaz com as cores novas */
  Object.keys(CJ).forEach(k => { try{ CJ[k] && CJ[k].destroy(); }catch(_){} delete CJ[k]; });
  if(hist.length) desenharGestao();
}
document.getElementById('btnTema').addEventListener('click', () => { const o = Object.keys(TEMAS); setTema(o[(o.indexOf(tema) + 1) % o.length]); });
try{ setTema(localStorage.getItem('usina-tema') || 'sistema'); }catch(_){ setTema('sistema'); }

/* ---------- Destaque de moagem em cima do 3D ---------- */
const hero3d = document.getElementById('hero3d');
hero3d.addEventListener('click', () => { location.hash = 'painel'; });
function desenharHero3D(){
  if(!hist.length) return;
  const agora = Date.now(), ini = iniHoje().getTime(), fim = ini + 24 * H;
  const tot = totalDia(), pct = tot / META_DIA * 100, esperado = META_DIA * (agora - ini) / (fim - ini), dif = tot - esperado;
  const aut = ritmo > 0 ? Math.round(estoque / ritmo * 60) : 0, ap = aproveitamento();
  const cls = (v, ok, alerta) => v >= ok ? 'q-ok' : v >= alerta ? 'q-warn' : 'q-red';
  hero3d.innerHTML = `
    <span class="h3-main"><b>${nf(ritmo)}</b><span>t/h moendo agora</span></span>
    <span class="h3-meta">
      <span class="h3-bar"><i style="width:${Math.min(100, pct)}%"></i><em style="left:${Math.min(100, esperado / META_DIA * 100)}%"></em></span>
      <small><b>${nf(tot)} t</b>, ${nf(pct, 1)}% da meta do dia. <span class="${dif >= 0 ? 'q-ok' : 'q-red'}">${dif >= 0 ? 'Adiantado' : 'Atrasado'} ${nf(Math.abs(dif))} t</span></small>
    </span>
    <span class="h3-mini ${cls(aut, 120, 90)}"><b>${fmt(aut)}</b><span>de cana no pátio</span></span>
    <span class="h3-mini ${cls(ap.pct, 95, 90)}"><b>${nf(ap.pct, 1)}%</b><span>de tempo aproveitado</span></span>`;
  hero3d.setAttribute('aria-label', `Moendo ${nf(ritmo)} toneladas por hora, ${nf(pct, 1)}% da meta do dia. Abrir o painel gerencial.`);
}
setInterval(desenharHero3D, 1000);

/* ---------- Modo TV: passa pelas áreas e pelo painel sozinho ---------- */
const TV = { on:false, i:0, t:null, passos:['', 'recepcao', 'fabrica', 'energia', 'colheita', 'destilaria', 'expedicao', 'oficina', 'painel'], tempo:{ '':20000, painel:40000 }, padrao:22000 };
const tvArea = document.getElementById('tvArea'), sairTV = document.getElementById('sairTV');
function passoTV(){
  const k = TV.passos[TV.i % TV.passos.length]; TV.i++;
  if(k === 'painel'){ location.hash = 'painel'; tvArea.textContent = 'Painel gerencial'; }
  else{
    irPara3D();
    fecharPainel();
    filtro.value = k; filtro.dispatchEvent(new Event('change'));
    tvArea.textContent = k ? AREAS[k].nome : 'Toda a usina';
  }
  document.getElementById('telaPainel').scrollTop = 0;
  TV.t = setTimeout(passoTV, TV.tempo[k] ?? TV.padrao);
}
function setTV(on){
  TV.on = on; clearTimeout(TV.t);
  document.body.classList.toggle('modo-tv', on);
  sairTV.hidden = !on;
  if(on){
    TV.i = 0; abrirMenu(false);
    try{ document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); }catch(_){}
    setTimeout(resize, 60); passoTV();
  }else{
    try{ if(document.fullscreenElement) document.exitFullscreen(); }catch(_){}
    filtro.value = ''; filtro.dispatchEvent(new Event('change'));
    irPara3D(); tvArea.textContent = ''; setTimeout(resize, 60);
  }
}
document.getElementById('btnTV').addEventListener('click', () => setTV(true));
sairTV.addEventListener('click', () => setTV(false));
addEventListener('keydown', e => { if(e.key === 'Escape' && TV.on) setTV(false); });
document.addEventListener('fullscreenchange', () => { if(!document.fullscreenElement && TV.on) setTV(false); });
