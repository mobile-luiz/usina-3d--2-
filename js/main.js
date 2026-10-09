/* Usina em 3D: Pós-processamento (sombras de contato), qualidade, loop de animação e inicialização. */
"use strict";

/* ---------- Loop ---------- */
let composer=null, ssao=null, fxaa=null, qualidade='alta';
const POS_OK = !!(THREE.EffectComposer && THREE.SSAOPass && THREE.ShaderPass && THREE.FXAAShader && THREE.SSAOShader);
const semAO=[];
function montarPos(){
  if(!POS_OK || composer) return;
  const w=stage.clientWidth, h=stage.clientHeight;
  composer=new THREE.EffectComposer(renderer);
  ssao=new THREE.SSAOPass(scene,camera,w,h);
  ssao.kernelRadius=1.6; ssao.minDistance=0.000024; ssao.maxDistance=0.0013;
  ssao.beautyRenderTarget.texture.encoding=THREE.sRGBEncoding;
  /* fumaça, vapor, telhados e cercas transparentes não geram sombra de contato */
  const ov=ssao.overrideVisibility.bind(ssao), rv=ssao.restoreVisibility.bind(ssao);
  ssao.overrideVisibility=function(){ ov(); semAO.forEach(o=>{ o.userData._v=o.visible; o.visible=false; }); };
  ssao.restoreVisibility=function(){ rv(); semAO.forEach(o=>{ o.visible=o.userData._v; }); };
  composer.addPass(ssao);
  fxaa=new THREE.ShaderPass(THREE.FXAAShader);
  composer.addPass(fxaa);
}
function listarSemAO(){
  semAO.length=0;
  scene.traverse(o=>{ if(o.isSprite || (o.isMesh && (o.material.transparent || o.isSky || o.userData.noAO))) semAO.push(o); });
}
function resize(){
  const w=stage.clientWidth, h=stage.clientHeight;
  if(!w||!h) return;
  renderer.setPixelRatio(qualidade==='alta'?Math.min(window.devicePixelRatio||1,1.5):Math.min(window.devicePixelRatio||1,2));
  renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
  if(composer){
    const pr=renderer.getPixelRatio();
    composer.setPixelRatio(pr); composer.setSize(w,h);
    fxaa.material.uniforms.resolution.value.set(1/(w*pr),1/(h*pr));
  }
}
function setQualidade(q,aviso){
  qualidade=(q==='alta'&&POS_OK)?'alta':'leve';
  const b=document.getElementById('btnQualidade');
  b.setAttribute('aria-pressed',String(qualidade==='alta'));
  b.lastChild.textContent=qualidade==='alta'?'Qualidade alta':'Qualidade leve';
  if(qualidade==='alta') montarPos();
  resize();
  document.body.dataset.qualidade=qualidade+(composer?'-pos':'');
  if(aviso) mostrarAviso(aviso);
  try{ localStorage.setItem('usina-qualidade',qualidade); }catch(_){}
}
function mostrarAviso(t){
  const a=document.getElementById('aviso'); a.textContent=t; a.classList.add('on');
  clearTimeout(a._t); a._t=setTimeout(()=>a.classList.remove('on'),4500);
}
/* mede a fluidez nos primeiros segundos e cai para a qualidade leve se o PC não aguentar */
const fps={n:0,t0:0,feito:/alta/.test(location.search)};
function medirFps(now){
  if(fps.feito || qualidade!=='alta') return;
  if(!fps.t0){ fps.t0=now+2500; return; }
  if(now<fps.t0) return;
  fps.n++;
  if(now-fps.t0>4000){ fps.feito=true; const v=fps.n/((now-fps.t0)/1000); if(v<24) setQualidade('leve','A qualidade foi reduzida para manter a animação fluida. Use o botão Qualidade para voltar.'); }
}
/* modo só 3D: esconde pisos, cubos e etiquetas para ver a usina como ela é */
function setSo3D(on){
  document.body.classList.toggle('so3d',on);
  document.getElementById('btnSo3D').setAttribute('aria-pressed',String(on));
  ST.forEach(st=>{ st.group.visible=!on; (st.bordas||[]).forEach(m=>m.visible=!on); });
  patches.forEach(p=>p.visible=!on);
  if(OFI.marcas) OFI.marcas.visible=!on;
}
addEventListener('resize',resize);

function moverCaminhoes(dt){
  trucks.forEach(t=>{
    if(t.wait>0){ t.wait-=dt; if(t.wait<=0 && t.parada===2) descarregar(t); return; }
    let gap=Infinity;
    trucks.forEach(o=>{ if(o===t) return; const d=o.s-t.s; if(d>0 && d<gap) gap=d; });
    if(gap<17.5) return;
    let ns=t.s+t.speed*dt;
    for(let k=0;k<stopS.length;k++){
      if(!t.done[k] && t.s<=stopS[k].s && ns>=stopS[k].s){ ns=stopS[k].s; t.done[k]=true; t.wait=stopS[k].wait; t.parada=k; break; }
    }
    if(ns>=total){ despacharVazio(t.frota||novaFrota()); t.frota=novaFrota(); ns=0; t.done=stopS.map(()=>false); t.rot=null; t.parada=-1; t.ton=Math.round(48+Math.random()*16); t.g.userData.carga.forEach(m=>m.visible=true); }
    t.s=ns; placeTruck(t,dt);
  });
}
function animarFumaca(dt){
  smokeEmitters.forEach(e=>{
    e.parts.forEach(p=>{
      p.life+=dt*e.rate; if(p.life>1) p.life-=1;
      const l=p.life;
      p.m.position.set(e.origin.x+l*e.drift+(p.j-0.5)*1.2, e.origin.y+l*e.rise, e.origin.z-l*e.drift*0.4+(p.j-0.5));
      p.m.scale.setScalar(e.size*(0.35+l*1.1)*(0.8+p.j*0.4));
      p.m.material.opacity=e.op*Math.min(1,l*6)*(1-l);
    });
  });
}
let last=performance.now();
function frame(now){
  const dt=Math.min(0.05,(now-last)/1000); last=now;
  if(tween){
    const k=clamp((now-tween.t0)/tween.dur,0,1), e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2, f=tween.from, to=tween.to;
    ctl.target.set(f.x+(to.x-f.x)*e,0,f.z+(to.z-f.z)*e);
    ctl.r=f.r+(to.r-f.r)*e; ctl.theta=f.theta+(to.theta-f.theta)*e; ctl.phi=f.phi+(to.phi-f.phi)*e;
    if(k>=1) tween=null;
  }
  if(!reduce){
    moverCaminhoes(dt);
    FR.forEach(s=>atualizarFrente(s,dt));
    animarGarra(dt);
    animarRetro(dt);
    animarPatio(dt);
    animarNuvens(dt);
    moverTrafego(dt);
    belts.forEach(b=>{ b.t=(b.t+b.speed*dt)%1; b.mesh.position.lerpVectors(b.from,b.to,b.t); });
    forkPath.t+=dt*0.12;
    const fz=forkPath.z1+(forkPath.z2-forkPath.z1)*(0.5-0.5*Math.cos(forkPath.t*Math.PI*2));
    fork.position.set(forkPath.x,0,fz); fork.rotation.y=Math.sin(forkPath.t*Math.PI*2)>0?Math.PI/2:-Math.PI/2;
  }
  animarFumaca(reduce?0:dt);
  canaTempo.value=now/1000;
  if(seguindo && !tween){ const c=seguindo.colh[0], k=Math.min(1,dt*2); ctl.target.x+=(c.x-ctl.target.x)*k; ctl.target.z+=(c.z+4-ctl.target.z)*k; }
  if(document.body.classList.contains('modo-painel')){ requestAnimationFrame(frame); return; }
  applyCam();
  if(skyMesh) skyMesh.position.copy(camera.position);
  if(qualidade==='alta' && composer) composer.render(); else renderer.render(scene,camera);
  medirFps(now);
  posicionarRotulos();
  requestAnimationFrame(frame);
}

gerarOficina(); sincronizarOficina3D();
listarSemAO();
try{ const q=localStorage.getItem('usina-qualidade'); setQualidade(q||'alta'); }catch(_){ setQualidade('alta'); }
document.getElementById('btnQualidade').addEventListener('click',()=>setQualidade(qualidade==='alta'?'leve':'alta'));
document.getElementById('btnSo3D').addEventListener('click',e=>setSo3D(e.currentTarget.getAttribute('aria-pressed')!=='true'));
gerarHistorico(); iniciarDespacho(); desenharHero3D(); resize(); HOME.r=Math.round(190*Math.max(1,1.75/camera.aspect)); ctl.r=HOME.r; applyCam(); recarregar();
setInterval(tick,1000);
setInterval(desenharGrafico,15000);
if(window.Chart){ Chart.defaults.font.family='Barlow, "Segoe UI", sans-serif'; }
setInterval(()=>atualizarFrentesST(true),3000);
if(window.ResizeObserver) new ResizeObserver(resize).observe(stage);
if(reduce) animarFumaca(0);
mostrarTela(location.hash==='#painel');
requestAnimationFrame(frame);
