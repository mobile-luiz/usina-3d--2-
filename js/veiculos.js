/* Usina em 3D: Modelos de veículos (caminhões, colhedora, transbordo, carros), pátio de bagaço, retroescavadeira e rota dos treminhões. */
"use strict";

/* ---------- Veículos detalhados: pneus com banda, rodas, cabines arredondadas ---------- */
const GEO={};
const memo=(k,f)=>GEO[k]||(GEO[k]=f());
function rbox(w,h,d,r){ r=Math.max(0.01,Math.min(r??0.12,w/2-0.01,h/2-0.01,d/2-0.01)); return memo(`rb|${w}|${h}|${d}|${r}`,()=>THREE.RoundedBoxGeometry?new THREE.RoundedBoxGeometry(w,h,d,2,r):new THREE.BoxGeometry(w,h,d)); }
const RB=(w,h,d,m,x,y,z,p,r)=>M(rbox(w,h,d,r),m,x,y,z,p);
const BX=(w,h,d,m,x,y,z,p)=>M(memo(`bx|${w}|${h}|${d}`,()=>new THREE.BoxGeometry(w,h,d)),m,x,y,z,p);
const TXV={
  pneu: canvasTex(256,64,(g,w,h)=>{ g.fillStyle='#202224'; g.fillRect(0,0,w,h); g.fillStyle='#121314'; for(let i=0;i<32;i++){ g.fillRect(i*8,10,3,h-20); g.fillRect(i*8+4,18,2,h-36);} g.fillStyle='#2a2d30'; g.fillRect(0,0,w,7); g.fillRect(0,h-7,w,7); }),
  agri: canvasTex(256,64,(g,w,h)=>{ g.fillStyle='#202224'; g.fillRect(0,0,w,h); g.strokeStyle='#0f1011'; g.lineWidth=5; for(let i=0;i<20;i++){ const x=i*12.8; g.beginPath(); g.moveTo(x,6); g.lineTo(x+9,h/2); g.stroke(); g.beginPath(); g.moveTo(x+6,h/2); g.lineTo(x-3,h-6); g.stroke(); } }),
  aro: canvasTex(128,128,(g,w,h)=>{ const c=w/2; const gr=g.createRadialGradient(c,c,4,c,c,c); gr.addColorStop(0,'#d9dcdf'); gr.addColorStop(0.55,'#aab0b5'); gr.addColorStop(0.8,'#7d848a'); gr.addColorStop(1,'#3a3e42'); g.fillStyle=gr; g.fillRect(0,0,w,h);
    g.fillStyle='#2b2e31'; for(let i=0;i<8;i++){ const a=i/8*Math.PI*2; g.beginPath(); g.arc(c+Math.cos(a)*36,c+Math.sin(a)*36,8,0,Math.PI*2); g.fill(); }
    g.fillStyle='#e6e8ea'; g.beginPath(); g.arc(c,c,17,0,Math.PI*2); g.fill(); g.fillStyle='#5a6066'; for(let i=0;i<10;i++){ const a=i/10*Math.PI*2; g.beginPath(); g.arc(c+Math.cos(a)*12,c+Math.sin(a)*12,2.4,0,Math.PI*2); g.fill(); }
    g.strokeStyle='#1d2023'; g.lineWidth=6; g.beginPath(); g.arc(c,c,c-3,0,Math.PI*2); g.stroke(); }),
  grade: canvasTex(128,64,(g,w,h)=>{ g.fillStyle='#16191b'; g.fillRect(0,0,w,h); g.fillStyle='#3a3f44'; for(let y=6;y<h;y+=9) g.fillRect(6,y,w-12,4); g.fillStyle='#b8bec4'; g.fillRect(w/2-14,h/2-5,28,10); }),
  esteira: canvasTex(256,32,(g,w,h)=>{ g.fillStyle='#1e2022'; g.fillRect(0,0,w,h); g.fillStyle='#34373a'; for(let x=0;x<w;x+=10) g.fillRect(x,0,6,h); g.fillStyle='#111'; g.fillRect(0,h/2-2,w,4); }),
  ripas: canvasTex(64,256,(g,w,h)=>{ g.fillStyle='#a3211b'; g.fillRect(0,0,w,h); g.fillStyle='#1d2124'; for(let y=0;y<h;y+=16) g.fillRect(4,y,w-8,6); }),
  espiral: canvasTex(64,128,(g,w,h)=>{ g.fillStyle='#b3241e'; g.fillRect(0,0,w,h); g.strokeStyle='#3a0d0b'; g.lineWidth=5; for(let y=-h;y<h*2;y+=22){ g.beginPath(); g.moveTo(0,y); g.lineTo(w,y+18); g.stroke(); } })
};
const MV={
  pneu:new THREE.MeshStandardMaterial({map:TXV.pneu,roughness:0.92,metalness:0}),
  agri:new THREE.MeshStandardMaterial({map:TXV.agri,roughness:0.95,metalness:0}),
  aro:new THREE.MeshStandardMaterial({map:TXV.aro,roughness:0.35,metalness:0.7,envMapIntensity:1}),
  aroAm:new THREE.MeshStandardMaterial({map:TXV.aro,color:lin(0xf2c218),roughness:0.4,metalness:0.4}),
  aroBranco:new THREE.MeshStandardMaterial({map:TXV.aro,color:lin(0xffffff),roughness:0.35,metalness:0.25}),
  grade:new THREE.MeshStandardMaterial({map:TXV.grade,roughness:0.5,metalness:0.5}),
  esteira:new THREE.MeshStandardMaterial({map:TXV.esteira,roughness:0.9,metalness:0.2}),
  ripas:new THREE.MeshStandardMaterial({map:TXV.ripas,roughness:0.7,metalness:0.2}),
  espiral:new THREE.MeshStandardMaterial({map:TXV.espiral,roughness:0.5,metalness:0.3}),
  cromo:mat(0xdfe3e6,0.18,1),
  plast:mat(0x1c1f22,0.75,0.05),
  ambar:new THREE.MeshStandardMaterial({color:lin(0xffa21a),emissive:lin(0xff8a00),emissiveIntensity:0.8,roughness:0.3}),
  lanterna:new THREE.MeshStandardMaterial({color:lin(0xd11a1a),emissive:lin(0x8a0000),emissiveIntensity:0.6,roughness:0.3})
};
function pneuGeo(r,w){
  return memo(`pn|${r}|${w}`,()=>{
    const ri=r*0.62, p=[[0,-w/2+0.03],[ri,-w/2+0.03],[ri*1.06,-w/2],[r-0.08,-w/2],[r-0.01,-w/2+0.07],[r,-w/2+0.12],[r,w/2-0.12],[r-0.01,w/2-0.07],[r-0.08,w/2],[ri*1.06,w/2],[ri,w/2-0.03],[0,w/2-0.03]].map(([a,b])=>new THREE.Vector2(a,b));
    return new THREE.LatheGeometry(p,26);
  });
}
const _mudGeo=(r,w)=>memo(`mud|${r}|${w}`,()=>new THREE.CylinderGeometry(r,r,w,18,1,true,Math.PI/2,Math.PI));
function roda(p,x,y,z,r,w,lado,opt){
  opt=opt||{};
  const t=M(pneuGeo(r,w),opt.agri?MV.agri:MV.pneu,x,y,z,p); t.rotation.x=Math.PI/2;
  const f=M(memo(`ar|${r}`,()=>new THREE.CircleGeometry(r*0.6,24)),opt.aro||MV.aro,x,y,z+lado*(w/2-0.025),p); if(lado<0) f.rotation.y=Math.PI; f.castShadow=false;
  if(opt.para){ const m=M(_mudGeo(r+0.14,w+0.12),MV.plast,x,y,z,p); m.rotation.x=Math.PI/2; m.material.side=THREE.DoubleSide; m.castShadow=false; }
}
function eixo(p,x,r,w,meia,opt){ roda(p,x,r,meia,r,w,1,opt); roda(p,x,r,-meia,r,w,-1,opt); }

/* ---------- Pátio de bagaço, moega da caldeira e retroescavadeira ---------- */
const BAG = {};
(function patioBagaco(){
  const bagMat=texMat(TX.palha,[3,2],1); bagMat.color=lin(0xc7ad7c);
  /* piso e muros de contenção */
  const piso=M(new THREE.BoxGeometry(24,0.06,14),MT.concreto,-55,0.03,-39.5); piso.castShadow=false;
  B(24,2.6,0.6,MT.parede,-55,0,-46.4); B(0.6,2.6,14,MT.parede,-67,0,-39.5);
  /* montes de bagaço */
  const monte=M(new THREE.SphereGeometry(1,32,14,0,Math.PI*2,0,Math.PI/2),bagMat,-58,0,-39.5);
  monte.scale.set(7.2,4,5.6); BAG.monte=monte;
  const monte2=M(new THREE.SphereGeometry(1,24,10,0,Math.PI*2,0,Math.PI/2),bagMat,-62.5,0,-43.2);
  monte2.scale.set(3.6,2.2,2.6);
  /* esteira empilhadeira: leva o bagaço que sobra da moenda até o pátio */
  function esteira(A,Bf,mItem,n,vel,larg){
    const L=A.distanceTo(Bf), dir=Bf.clone().sub(A).normalize(), mid=A.clone().add(Bf).multiplyScalar(0.5);
    const g=new THREE.Group(); g.position.copy(mid); scene.add(g);
    g.rotation.y=Math.atan2(-(Bf.z-A.z),Bf.x-A.x);
    const inner=new THREE.Group(); g.add(inner); inner.rotation.z=Math.asin((Bf.y-A.y)/L);
    B(L,0.4,larg,MT.estrut,0,-0.2,0,inner); B(L,0.08,larg-0.4,mat(0x2a2d2f,0.9),0,0.2,0,inner);
    [-1,1].forEach(sd=>B(L,0.5,0.08,MT.amarelo,0,0.24,sd*(larg/2-0.05),inner));
    [0.15,0.45,0.75,0.95].forEach(k=>{ const p=A.clone().lerp(Bf,k); B(0.3,Math.max(0.3,p.y-0.25),0.3,MT.estrut,p.x,0,p.z); });
    const up=new THREE.Vector3(0,0.45,0);
    for(let i=0;i<n;i++){ const m=B(0.9,0.35,larg-0.6,mItem,A.x,A.y,A.z); m.rotation.copy(g.rotation); m.rotation.z=inner.rotation.z; m.rotation.order='YXZ';
      belts.push({mesh:m, from:A.clone().add(up), to:Bf.clone().add(up), t:i/n, speed:vel}); }
  }
  esteira(new THREE.Vector3(-34,2.6,-32.6), new THREE.Vector3(-57,7.6,-32.6), bagMat, 12, 0.06, 1.6);
  vaporDe(-57.4,7.4,-32.6,{count:12,rise:-4.5,drift:0.4,size:0.7,rate:0.9,op:0.7,color:0xc2a875});
  /* moega da caldeira e esteira até a fornalha */
  const moega=M(new THREE.CylinderGeometry(1.9,0.8,1.8,4,1,true),mat(0x9aa3aa,0.41,0.75),-39.5,2.2,-39.2); moega.rotation.y=Math.PI/4; moega.material.side=THREE.DoubleSide;
  [[-40.6,-40.3],[-40.6,-38.1],[-38.4,-40.3],[-38.4,-38.1]].forEach(([x,z])=>B(0.25,1.4,0.25,MT.estrut,x,0,z));
  B(1.6,0.3,1.6,bagMat,-39.5,2.4,-39.2);
  esteira(new THREE.Vector3(-38.6,2.0,-39.2), new THREE.Vector3(-34,7.1,-39.2), bagMat, 5, 0.18, 1.3);
  /* retroescavadeira: pá na frente, braço retro atrás */
  const g=new THREE.Group(); scene.add(g);
  const am=MT.amarelo, preto=mat(0x1d2124,0.85);
  B(4.4,1.1,2.1,am,-0.2,0.7,0,g);
  B(1.9,1.0,1.6,am,1.3,1.8,0,g); B(0.15,0.6,1.2,preto,2.27,1.9,0,g);
  B(1.7,1.9,1.9,MT.vidro,-0.7,1.8,0,g); B(2.0,0.16,2.2,am,-0.7,3.75,0,g);
  Cy(0.08,0.08,0.9,MT.estrut,0.6,2.8,-0.6,8,g);
  [[1.5,0.62,0.45],[-1.4,0.95,0.55]].forEach(([x,r,w])=>{ roda(g,x,r,1.15,r,w,1,{agri:true,aro:MV.aroAm}); roda(g,x,r,-1.15,r,w,-1,{agri:true,aro:MV.aroAm}); });
  const braco=new THREE.Group(); braco.position.set(0.3,2.2,0); g.add(braco);
  [-1.05,1.05].forEach(z=>B(3.1,0.32,0.28,am,1.55,-0.16,z,braco));
  const pa=new THREE.Group(); pa.position.set(3.1,0,0); braco.add(pa);
  B(0.12,1.0,2.5,preto,0.35,-0.6,0,pa); B(0.9,0.1,2.5,preto,0.75,-1.05,0,pa); B(0.6,0.1,2.5,preto,0.6,-0.1,0,pa);
  const cargaPa=B(0.8,0.55,2.3,bagMat,0.65,-0.95,0,pa); cargaPa.visible=false;
  /* braço retro (recolhido) e sapatas */
  const retro=new THREE.Group(); retro.position.set(-2.4,1.5,0); retro.rotation.z=0.9; g.add(retro);
  B(0.35,2.8,0.4,am,0,0,0,retro); const stk=B(0.3,2.0,0.35,am,0.6,1.6,0,retro); stk.rotation.z=-2.2;
  B(0.6,0.5,0.7,preto,1.4,1.0,0,retro);
  [-1.25,1.25].forEach(z=>B(0.35,1.1,0.35,preto,-2.3,0,z,g));
  g.position.set(-43.3,0,-39.2);
  Object.assign(BAG,{g,braco,pa,cargaPa,t:0,i:0});
})();

/* ---------- Veículos ---------- */
/* caminhão cabine avançada; kind: cana (com reboque), acucar (baú), cavalo (só o cavalo) */
function makeTruck(kind, cab){
  const g=new THREE.Group();
  const tinta=mat(cab,0.32,0.35), cinza=mat(0x3b4045,0.55,0.4), escuro=mat(0x24282c,0.6,0.4);
  const L=kind==='cavalo'?7.6:13.4, cx=kind==='cavalo'?2.6:-0.5;
  [-0.48,0.48].forEach(z=>BX(L,0.3,0.18,escuro,cx,0.82,z,g));
  /* cabine */
  RB(2.3,2.45,2.5,tinta,5.35,2.35,0,g,0.2);
  RB(0.5,0.6,2.56,cinza,6.42,1.0,0,g,0.1);
  const gr=BX(0.05,0.85,1.7,MV.grade,6.52,1.82,0,g);
  [-0.98,0.98].forEach(z=>{ RB(0.08,0.24,0.46,MT.farol,6.53,1.32,z,g,0.04); });
  const pb=BX(0.06,1.05,2.24,MT.vidro,6.5,2.88,0,g); pb.rotation.z=0.07;
  BX(1.15,0.82,2.52,MT.vidro,5.75,2.9,0,g);
  RB(0.55,0.12,2.42,tinta,6.6,3.47,0,g,0.04);
  const def=RB(1.7,0.75,2.32,tinta,4.85,3.92,0,g,0.22); def.rotation.z=-0.1;
  [-0.6,0.6].forEach(z=>Cy(0.09,0.09,0.16,MV.ambar,5.6,3.6,z,10,g));
  [-1,1].forEach(s=>{
    BX(0.05,0.05,0.38,escuro,6.42,2.95,s*1.42,g);
    RB(0.12,0.62,0.22,MV.plast,6.42,2.75,s*1.62,g,0.04);
    BX(0.65,0.06,0.32,cinza,5.55,0.72,s*1.1,g); BX(0.65,0.06,0.32,cinza,5.55,1.15,s*1.1,g);
    BX(0.02,1.7,0.02,MV.plast,4.55,2.3,s*1.262,g);
  });
  const tq=M(memo('tq',()=>new THREE.CylinderGeometry(0.4,0.4,1.5,20)),MV.cromo,3.55,0.98,1.0,g); tq.rotation.z=Math.PI/2;
  const ar=M(memo('ar',()=>new THREE.CylinderGeometry(0.2,0.2,1.0,14)),cinza,3.6,0.9,-0.95,g); ar.rotation.z=Math.PI/2;
  Cy(0.1,0.1,2.4,MV.cromo,4.08,1.6,-1.05,12,g);
  /* rodas do cavalo */
  roda(g,5.25,0.53,1.13,0.53,0.34,1,{para:true}); roda(g,5.25,0.53,-1.13,0.53,0.34,-1,{para:true});
  const tracao=kind==='cavalo'?[1.95,0.85]:[2.5,1.45];
  tracao.forEach(x=>eixo(g,x,0.53,0.72,0.95,{para:x===tracao[0]}));
  if(kind==='cavalo'){
    Cy(0.6,0.6,0.12,escuro,1.4,1.05,0,20,g);
  }
  else if(kind==='cana'){
    g.userData.carga=[];
    [[1.0,[2.5,1.45]],[-4.15,[-3.1,-5.15]]].forEach(([x,ax],k)=>{
      RB(4.85,0.22,2.48,escuro,x,1.1,0,g,0.04);
      for(let i=0;i<6;i++) [-1.2,1.2].forEach(z=>BX(0.1,2.15,0.1,mat(0x4e3f2c,0.8),x-2.3+i*0.92,2.28,z,g));
      [-1.2,1.2].forEach(z=>{ BX(4.8,0.09,0.09,mat(0x4e3f2c,0.8),x,2.15,z,g); BX(4.8,0.09,0.09,mat(0x4e3f2c,0.8),x,3.3,z,g); });
      BX(0.12,2.1,2.4,escuro,x+2.42,2.25,0,g);
      [-0.9,0.9].forEach(z=>RB(0.06,0.14,0.3,MV.lanterna,x-2.45,1.0,z,g,0.03));
      g.userData.carga.push(BX(4.6,1.75,2.25,MT.cana,x,2.1,0,g));
      [-0.65,0,0.65].forEach(z=>{ const c=M(memo('feixe',()=>new THREE.CylinderGeometry(0.42,0.42,4.5,12)),z===0?MT.palhaCana:MT.cana,x,3.05+(z===0?0.1:0),z,g); c.rotation.z=Math.PI/2; g.userData.carga.push(c); });
      if(k===1){ ax.forEach(a=>eixo(g,a,0.53,0.72,0.95,{para:true})); BX(1.2,0.12,0.12,escuro,-1.25,0.85,0,g); }
    });
  }else{
    RB(8.9,2.65,2.48,mat(0xeceae3,0.4,0.15),-1.1,2.25,0,g,0.08);
    BX(8.92,0.32,2.5,MT.azul,-1.1,1.2,0,g);
    BX(0.04,2.4,2.3,mat(0xd6d4cc,0.5,0.3),-5.56,2.25,0,g);
    [-0.9,0.9].forEach(z=>RB(0.06,0.14,0.3,MV.lanterna,-5.58,1.1,z,g,0.03));
    [-3.6,-4.7].forEach(x=>eixo(g,x,0.53,0.72,0.95,{para:true}));
  }
  scene.add(g); return g;
}

/* colhedora de cana sobre esteiras */

/* trator com transbordo basculante */

/* colhedora de cana sobre esteiras */
function makeColhedora(){
  const g=new THREE.Group();
  const verde=mat(0xb3241e,0.3,0.35), am=mat(0x1b1d20,0.45,0.4), escuro=mat(0x24282c,0.6,0.4), preto=mat(0x111214,0.22,0.45);
  [-1.18,1.18].forEach(z=>{
    RB(5.4,1.0,0.78,MV.esteira,0,0.5,z,g,0.32);
    [-2.2,0,2.2].forEach(x=>{ const r=M(memo('rl',()=>new THREE.CylinderGeometry(0.34,0.34,0.8,16)),escuro,x,0.5,z,g); r.rotation.x=Math.PI/2; });
  });
  RB(4.6,1.45,2.35,verde,-0.25,1.72,0,g,0.14);
  RB(4.62,0.18,2.38,mat(0xd9d9d6,0.4,0.2),-0.25,2.5,0,g,0.05);
  RB(2.5,1.25,2.5,verde,-1.5,3.15,0,g,0.16);
  BX(1.4,0.9,0.04,MV.grade,-1.5,3.1,1.26,g); BX(1.4,0.9,0.04,MV.grade,-1.5,3.1,-1.26,g);
  Cy(0.62,0.72,0.9,preto,-2.35,3.75,0,20,g);
  const capuz=M(memo('capuz',()=>new THREE.CylinderGeometry(0.66,0.66,1.3,18,1,false,0,Math.PI)),preto,-2.35,4.75,0,g); capuz.rotation.x=Math.PI/2; capuz.rotation.z=Math.PI/2;
  Cy(0.09,0.09,1.2,MV.cromo,-0.6,3.8,-0.8,10,g);
  /* cabine envidraçada */
  BX(1.75,1.55,2.15,MT.vidro,1.4,3.35,0,g);
  [[0.55,1.05],[0.55,-1.05],[2.25,1.05],[2.25,-1.05]].forEach(([x,z])=>BX(0.08,1.6,0.08,verde,x,3.35,z,g));
  RB(2.0,0.2,2.35,verde,1.4,4.22,0,g,0.06);
  [-0.6,0,0.6].forEach(z=>RB(0.12,0.12,0.25,MT.farol,2.42,4.22,z,g,0.03));
  for(let y=0.9;y<3.2;y+=0.38) BX(0.5,0.05,0.05,am,0.9,y,-1.32,g);
  /* frente: rolos divisores, rolo tombador, corte de base e cortador de ponteiros */
  [-1.0,1.0].forEach(z=>{
    const r=M(memo('div',()=>new THREE.CylinderGeometry(0.26,0.18,2.5,14)),MV.espiral,3.15,1.05,z,g); r.rotation.z=Math.PI/2-0.72;
    const c=M(memo('pont',()=>new THREE.ConeGeometry(0.2,0.6,10)),am,4.05,0.3,z,g); c.rotation.z=-Math.PI/2;
  });
  const tomb=M(memo('tomb',()=>new THREE.CylinderGeometry(0.22,0.22,1.7,14)),escuro,3.45,0.95,0,g); tomb.rotation.x=Math.PI/2;
  RB(0.9,0.6,2.0,am,2.85,0.45,0,g,0.1);
  const braco=BX(2.4,0.18,0.25,am,3.4,3.55,0,g); braco.rotation.z=0.42;
  Cy(0.62,0.62,0.18,am,4.45,4.0,0,20,g);
  /* elevador (vai para o lado do transbordo) */
  const piv=new THREE.Group(); piv.position.set(-2.4,2.5,0.7); g.add(piv);
  RB(1.0,0.55,5.6,MV.ripas,0,0,2.8,piv,0.08);
  [-0.52,0.52].forEach(x=>BX(0.06,0.4,5.5,am,x,0.15,2.8,piv));
  const ext=M(memo('ext2',()=>new THREE.CylinderGeometry(0.72,0.72,1.25,22)),preto,0,0.95,5.25,piv); ext.rotation.z=Math.PI/2;
  [-0.62,0.62].forEach(x=>{ const t=M(memo('extT',()=>new THREE.SphereGeometry(0.72,20,12)),preto,x,0.95,5.25,piv); t.scale.set(0.3,1,1); });
  const boca=M(memo('boca',()=>new THREE.CylinderGeometry(0.5,0.62,0.7,18)),preto,0,0.95,5.95,piv); boca.rotation.x=Math.PI/2+0.5;
  const aba=RB(1.0,0.08,0.9,verde,0,0.2,6.2,piv,0.03); aba.rotation.x=0.6;
  piv.rotation.x=-0.32;
  g.userData.braco=piv;
  const ponta=new THREE.Object3D(); ponta.position.set(0,0.4,6.0); piv.add(ponta); g.userData.ponta=ponta;
  scene.add(g); return g;
}

/* trator com transbordo basculante */

/* trator azul com dois transbordos de grade (como no campo) */
const TX_TELA=canvasTex(128,64,(g,w,h)=>{ g.clearRect(0,0,w,h); g.strokeStyle='#15171a'; g.lineWidth=2.2; for(let x=0;x<=w;x+=8){ g.beginPath(); g.moveTo(x,0); g.lineTo(x,h); g.stroke(); } for(let y=0;y<=h;y+=8){ g.beginPath(); g.moveTo(0,y); g.lineTo(w,y); g.stroke(); } g.lineWidth=5; g.strokeRect(0,0,w,h); });
function makeVagao(g,x){
  const preto=mat(0x1b1d20,0.55,0.35), tela=new THREE.MeshStandardMaterial({map:TX_TELA,alphaTest:0.4,side:THREE.DoubleSide,roughness:0.6,metalness:0.4});
  BX(4.6,0.22,0.5,preto,x,0.95,0,g);
  [x-0.78,x+0.78].forEach(ax=>eixo(g,ax,0.74,0.62,1.32,{agri:true,aro:MV.aroBranco}));
  const piv=new THREE.Group(); piv.position.set(x,1.05,1.3); g.add(piv);
  BX(5.2,0.14,2.6,preto,0,0.07,-1.3,piv);
  [[-2.55,0],[2.55,0],[-2.55,-2.6],[2.55,-2.6],[0,0],[0,-2.6]].forEach(([px,pz])=>BX(0.12,2.3,0.12,preto,px,1.2,pz,piv));
  [0,-2.6].forEach(pz=>{ BX(5.2,0.12,0.12,preto,0,2.32,pz,piv); BX(5.2,0.1,0.1,preto,0,1.2,pz,piv); });
  [-2.55,2.55].forEach(px=>BX(0.12,0.12,2.6,preto,px,2.32,-1.3,piv));
  [[0,0,0],[0,-2.6,Math.PI]].forEach(([px,pz,r])=>{ const pl=M(memo('telaL',()=>new THREE.PlaneGeometry(5.1,2.2)),tela,px,1.2,pz,piv); pl.rotation.y=r; pl.castShadow=true; pl.userData.noAO=true; });
  [-2.55,2.55].forEach(px=>{ const pl=M(memo('telaF',()=>new THREE.PlaneGeometry(2.5,2.2)),tela,px,1.2,-1.3,piv); pl.rotation.y=Math.PI/2; pl.userData.noAO=true; });
  [-2.5,2.5].forEach(px=>RB(0.05,0.12,0.25,MV.lanterna,px,0.6,0.02,piv,0.02));
  const carga=B(4.9,2.0,2.4,MT.cana,0,0.15,-1.3,piv); carga.visible=false;
  return {piv,carga};
}
function makeTransbordo(semCarretas){
  const g=new THREE.Group();
  const azul=mat(0x1f4fa8,0.32,0.35), escuro=mat(0x24282c,0.6,0.4);
  roda(g,0.6,1.0,1.18,1.0,0.6,1,{agri:true,aro:MV.aroBranco}); roda(g,0.6,1.0,-1.18,1.0,0.6,-1,{agri:true,aro:MV.aroBranco});
  roda(g,2.95,0.62,1.0,0.62,0.42,1,{agri:true,aro:MV.aroBranco}); roda(g,2.95,0.62,-1.0,0.62,0.42,-1,{agri:true,aro:MV.aroBranco});
  [-1,1].forEach(s=>{ const p=M(_mudGeo(1.12,0.7),azul,0.6,1.0,s*1.18,g); p.rotation.x=Math.PI/2; p.material.side=THREE.DoubleSide; });
  RB(2.3,0.95,1.05,azul,2.55,1.6,0,g,0.2);
  BX(0.05,0.7,0.8,MV.grade,3.71,1.55,0,g);
  RB(0.45,0.5,0.95,escuro,3.95,0.95,0,g,0.08);
  RB(1.6,0.7,1.5,azul,0.85,1.6,0,g,0.08);
  BX(1.35,1.4,1.5,MT.vidro,0.82,2.65,0,g);
  [[0.15,0.72],[0.15,-0.72],[1.5,0.72],[1.5,-0.72]].forEach(([x,z])=>BX(0.08,1.45,0.08,escuro,x,2.65,z,g));
  RB(1.75,0.16,1.8,mat(0x1a1c1f,0.5,0.3),0.82,3.42,0,g,0.06);
  Cy(0.08,0.08,1.4,MV.cromo,1.9,2.4,0.38,10,g);
  [-0.4,0.4].forEach(z=>RB(0.08,0.12,0.22,MT.farol,3.72,1.9,z,g,0.03));
  BX(2.0,0.14,0.16,escuro,-1.4,0.85,0,g);
  if(semCarretas){ g.userData.basc=[]; g.userData.carga=[]; scene.add(g); return g; }
  /* carretas articuladas: cada uma segue o engate da que vai na frente */
  const carretas=[], basc=[], carga=[];
  for(let i=0;i<2;i++){ const wg=new THREE.Group(); const v=makeVagao(wg,0); BX(1.4,0.12,0.14,escuro,3.0,0.85,0,wg); scene.add(wg); carretas.push(wg); basc.push(v.piv); carga.push(v.carga); }
  g.userData.carretas=carretas; g.userData.basc=basc; g.userData.carga=carga; g.userData.carretasOk=false;
  scene.add(g); return g;
}
function setCargaTransbordo(tb,f){
  tb.g.userData.carga.forEach((c,i)=>{ const v=clamp(f*2-i,0,1); c.visible=v>0.03; c.scale.y=Math.max(0.03,v); c.position.y=0.15+v; });
}
const _hv=new THREE.Vector3();
function puxarCarretas(g){
  const cs=g.userData.carretas; if(!cs) return;
  g.updateMatrixWorld(true);
  let hx, hz, ang=g.rotation.y;
  _hv.set(-1.7,0,0); g.localToWorld(_hv); hx=_hv.x; hz=_hv.z;
  cs.forEach(w=>{
    const L=3.7;
    if(!g.userData.carretasOk){ w.position.set(hx-Math.cos(ang)*L,g.position.y,hz+Math.sin(ang)*L); w.rotation.y=ang; }
    else{ let dx=hx-w.position.x, dz=hz-w.position.z; const d=Math.hypot(dx,dz)||1; dx/=d; dz/=d; w.position.set(hx-dx*L,g.position.y,hz-dz*L); w.rotation.y=Math.atan2(-dz,dx); }
    ang=w.rotation.y; hx=w.position.x-Math.cos(ang)*3.0; hz=w.position.z+Math.sin(ang)*3.0;
  });
  g.userData.carretasOk=true;
}
function removerVeiculo(g){ scene.remove(g); (g.userData.carretas||[]).forEach(w=>scene.remove(w)); }
function bascular(tb,a){ tb.g.userData.basc.forEach(p=>p.rotation.x=a*0.95); }

function makeCaminhonete(cor){
  const g=new THREE.Group(), p=mat(cor,0.28,0.4), cz=mat(0x2a2e32,0.6,0.3);
  RB(5.1,0.72,1.95,p,0,0.88,0,g,0.16);
  RB(2.3,0.82,1.88,p,0.55,1.62,0,g,0.2);
  BX(2.0,0.55,1.9,MT.vidro,0.6,1.7,0,g);
  const pb=BX(0.06,0.55,1.7,MT.vidro,1.72,1.68,0,g); pb.rotation.z=0.45;
  [-0.92,0.92].forEach(z=>BX(2.0,0.4,0.08,p,-1.45,1.42,z,g)); BX(0.08,0.4,1.9,p,-2.5,1.42,0,g);
  BX(0.05,0.32,1.3,MV.grade,2.56,0.95,0,g);
  [-0.72,0.72].forEach(z=>{ RB(0.06,0.14,0.32,MT.farol,2.56,1.15,z,g,0.03); RB(0.06,0.22,0.12,MV.lanterna,-2.56,1.1,z*1.1,g,0.02); });
  RB(0.3,0.25,2.0,cz,2.5,0.62,0,g,0.06);
  BX(0.3,0.1,1.2,MV.ambar,0.6,2.1,0,g);
  [1.6,-1.6].forEach(x=>{ roda(g,x,0.44,0.95,0.44,0.3,1,{para:false}); roda(g,x,0.44,-0.95,0.44,0.3,-1,{para:false}); });
  scene.add(g); return g;
}
/* caminhão pipa (água para combate a incêndio e para molhar a área de manobra) */
const TX_PIPA=canvasTex(512,96,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='#c23a31'; g.font='700 70px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textBaseline='middle'; g.textAlign='center'; g.fillText('ÁGUA',w/2,h/2+2); });
function makePipa(){
  const g=makeTruck('cavalo',0xc23a31), escuro=mat(0x24282c,0.6,0.4), verm=mat(0xc23a31,0.35,0.35);
  [-0.48,0.48].forEach(z=>BX(5.4,0.3,0.18,escuro,-1.7,0.82,z,g));
  eixo(g,-2.7,0.53,0.72,0.95,{para:true});
  const corpo=M(memo('pipaC',()=>new THREE.CylinderGeometry(1.08,1.08,6.2,30)),MT.branco,0.35,2.2,0,g); corpo.rotation.z=Math.PI/2;
  [3.45,-2.75].forEach(x=>{ const t=M(memo('pipaT',()=>new THREE.SphereGeometry(1.08,26,14)),MT.branco,x,2.2,0,g); t.scale.set(0.32,1,1); });
  [3.1,-2.4,0.35].forEach(x=>{ const a=M(memo('pipaA',()=>new THREE.CylinderGeometry(1.1,1.1,0.22,30)),verm,x,2.2,0,g); a.rotation.z=Math.PI/2; });
  const txt=new THREE.MeshStandardMaterial({map:TX_PIPA,transparent:true,roughness:0.5,depthWrite:false});
  [-1,1].forEach(s=>{ const pl=M(memo('pipaP',()=>new THREE.PlaneGeometry(3.6,0.68)),txt,1.75*0+0.35,2.2,s*1.095,g); pl.castShadow=false; if(s<0) pl.rotation.y=Math.PI; });
  BX(5.2,0.07,0.7,mat(0x6b7780,0.5,0.6),0.35,3.32,0,g);
  Cy(0.28,0.28,0.25,escuro,0.35,3.3,0,14,g);
  for(let y=1.2;y<3.3;y+=0.4) BX(0.06,0.05,0.5,MV.cromo,-3.18,y,0.7,g);
  const carr=M(memo('carr',()=>new THREE.CylinderGeometry(0.45,0.45,0.9,16)),verm,-3.25,1.15,-0.55,g); carr.rotation.x=Math.PI/2;
  BX(0.14,0.14,2.7,MV.cromo,-3.4,0.72,0,g);
  [-1.1,-0.4,0.4,1.1].forEach(z=>Cy(0.05,0.05,0.18,escuro,-3.4,0.5,z,8,g));
  return g;
}
/* motoniveladora (patrol) */
function makeMotoniveladora(){
  const g=new THREE.Group(), am=MT.amarelo, escuro=mat(0x24282c,0.6,0.4);
  roda(g,4.3,0.62,1.05,0.62,0.42,1,{agri:true,aro:MV.aroAm}); roda(g,4.3,0.62,-1.05,0.62,0.42,-1,{agri:true,aro:MV.aroAm});
  [-1.9,-3.4].forEach(x=>eixo(g,x,0.62,0.45,1.1,{agri:true,aro:MV.aroAm}));
  const viga=RB(5.6,0.45,0.55,am,1.7,1.85,0,g,0.1); viga.rotation.z=-0.12;
  RB(0.5,0.9,0.5,am,4.3,1.35,0,g,0.08);
  BX(0.2,0.2,2.0,escuro,4.3,0.75,0,g);
  /* lâmina sob o chassi */
  const circ=M(memo('circ',()=>new THREE.TorusGeometry(0.9,0.1,8,24)),escuro,1.2,1.15,0,g); circ.rotation.x=Math.PI/2;
  const lam=RB(0.35,0.65,3.7,mat(0x5a6066,0.4,0.7),0.9,0.5,0,g,0.08); lam.rotation.y=0.45;
  BX(0.1,0.12,3.7,MV.cromo,1.05,0.2,0,g).rotation.y=0.45;
  /* cabine e motor atrás */
  RB(2.6,0.9,2.2,am,-2.65,1.45,0,g,0.15);
  RB(2.0,1.05,1.9,am,-3.0,2.35,0,g,0.18);
  BX(0.05,0.8,1.5,MV.grade,-4.02,2.3,0,g);
  BX(1.5,1.4,1.75,MT.vidro,-0.9,2.65,0,g);
  [[-0.15,0.85],[-0.15,-0.85],[-1.65,0.85],[-1.65,-0.85]].forEach(([x,z])=>BX(0.08,1.45,0.08,am,x,2.65,z,g));
  RB(1.8,0.14,2.0,am,-0.9,3.42,0,g,0.05);
  Cy(0.08,0.08,1.2,escuro,-2.4,2.9,0.5,10,g);
  Cy(0.09,0.09,0.14,MV.ambar,-0.9,3.56,0,10,g);
  scene.add(g); return g;
}
/* cavalo com prancha (carreta rebaixada) levando uma colhedora */
function makePrancha(carga){
  const p=new THREE.Group(), escuro=mat(0x24282c,0.6,0.4), cinza=mat(0x3b4045,0.55,0.4);
  const cav=makeTruck('cavalo',pick([0xc23a31,0x2f6f9f,0xeeeeea,0x3d464d])); p.add(cav);
  RB(2.2,0.45,2.4,escuro,0.6,1.45,0,p,0.08);
  const pesc=RB(2.6,0.35,2.4,escuro,-1.2,1.15,0,p,0.06); pesc.rotation.z=0.32;
  RB(9.4,0.32,2.6,cinza,-7.0,0.82,0,p,0.06);
  [-1.32,1.32].forEach(z=>BX(9.4,0.12,0.08,MT.amarelo,-7.0,1.0,z,p));
  [-9.6,-10.6,-11.6].forEach(x=>eixo(p,x,0.45,0.6,0.95,{para:x===-9.6}));
  BX(0.9,0.5,2.4,escuro,-11.9,1.1,0,p);
  [-0.9,0.9].forEach(z=>RB(0.06,0.14,0.3,MV.lanterna,-12.36,1.1,z,p,0.03));
  if(carga){ const c=carga(); c.position.set(-6.6,0.98,0); if(c.userData.braco) c.userData.braco.rotation.x=-1.35; p.add(c); }
  scene.add(p); return p;
}
function makeCarro(cor){
  const g=new THREE.Group(), p=mat(cor,0.25,0.45);
  RB(2.0,0.62,4.3,p,0,0.66,0,g,0.18);
  RB(1.72,0.6,2.3,p,0,1.2,-0.15,g,0.24);
  BX(1.74,0.42,2.0,MT.vidro,0,1.24,-0.15,g);
  [-0.65,0.65].forEach(x=>{ RB(0.36,0.12,0.06,MT.farol,x,0.78,2.16,g,0.03); RB(0.36,0.12,0.06,MV.lanterna,x,0.8,-2.16,g,0.03); });
  [[1.4],[-1.4]].forEach(([z])=>[-0.92,0.92].forEach(x=>{ const t=M(pneuGeo(0.36,0.24),MV.pneu,x,0.36,z,g); t.rotation.z=Math.PI/2; const f=M(memo('ar|car',()=>new THREE.CircleGeometry(0.22,20)),MV.aro,x+(x>0?0.115:-0.115),0.36,z,g); f.rotation.y=x>0?Math.PI/2:-Math.PI/2; f.castShadow=false; }));
  scene.add(g); return g;
}

/* rota dos treminhões com curvas suaves */
const rawRoute = [[-210,39],[-62,39],[-62,14],[-62,2],[-62,-14],[-62,-28],[-74,-28],[-74,45],[-210,45]];
function suavizar(pts,R){
  const out=[pts[0]];
  for(let i=1;i<pts.length-1;i++){
    const a=pts[i-1],p=pts[i],b=pts[i+1];
    const l1=Math.hypot(p[0]-a[0],p[1]-a[1]), l2=Math.hypot(b[0]-p[0],b[1]-p[1]);
    const d1=[(p[0]-a[0])/l1,(p[1]-a[1])/l1], d2=[(b[0]-p[0])/l2,(b[1]-p[1])/l2];
    if(Math.abs(d1[0]*d2[1]-d1[1]*d2[0])<1e-6){ out.push(p); continue; }
    const r=Math.min(R,l1/2,l2/2), s=[p[0]-d1[0]*r,p[1]-d1[1]*r], e=[p[0]+d2[0]*r,p[1]+d2[1]*r];
    for(let k=0;k<=10;k++){ const t=k/10, u=1-t; out.push([u*u*s[0]+2*u*t*p[0]+t*t*e[0], u*u*s[1]+2*u*t*p[1]+t*t*e[1]]); }
  }
  out.push(pts[pts.length-1]); return out;
}
const route = suavizar(rawRoute,7);
const segLen=[], cum=[0];
for(let i=0;i<route.length-1;i++){
  const l=Math.hypot(route[i+1][0]-route[i][0], route[i+1][1]-route[i][1]) || 0.0001;
  segLen.push(l); cum.push(cum[i]+l);
}
const total = cum[cum.length-1];
const stopS = [[-62,14,2.6],[-62,2,2],[-62,-14,3.6]].map(([x,z,w])=>({s:cum[route.findIndex(p=>p[0]===x&&p[1]===z)], wait:w}));
function pointAt(s){
  let i=0; while(i<segLen.length-1 && s>cum[i+1]) i++;
  const t=(s-cum[i])/segLen[i], a=route[i], b=route[i+1];
  return {x:a[0]+(b[0]-a[0])*t, z:a[1]+(b[1]-a[1])*t, dx:b[0]-a[0], dz:b[1]-a[1]};
}
const cabs=[0x2f6f9f,0xc23a31,0xeeeeea,0x3a8a50,0xd9961f,0x3d464d,0x7a5fb8];
const trucks = [];
for(let i=0;i<7;i++){
  const s = ((total - i*34) % total + total) % total;
  trucks.push({g:makeTruck('cana',cabs[i]), s, wait:0, done:stopS.map(st=>st.s<s), speed:12, rot:null, ton:Math.round(48+Math.random()*16), parada:-1});
  trucks[i].g.userData.carga.forEach(m=>m.visible=!trucks[i].done[2]);
}
function placeTruck(t,dt){
  const p=pointAt(t.s), alvo=Math.atan2(-p.dz,p.dx);
  if(t.rot===null || !dt) t.rot=alvo;
  else { let d=alvo-t.rot; d=Math.atan2(Math.sin(d),Math.cos(d)); t.rot+=d*Math.min(1,dt*10); }
  t.g.position.set(p.x,0.06,p.z); t.g.rotation.y=t.rot;
}
trucks.forEach(t=>placeTruck(t));

[52,58].forEach((x,i)=>{ const t=makeTruck('acucar', i?0x2f6f9f:0xeeeeea); t.position.set(x,0,30.5); t.rotation.y=-Math.PI/2; });

const fork = new THREE.Group();
B(1.7,1.1,1.1,MT.amarelo,0,0.2,0,fork); B(0.9,0.9,0.9,MT.vidro,-0.2,1.3,0,fork); B(0.15,2.6,1,MT.estrut,0.95,0,0,fork); B(1.1,0.6,0.9,mat(0xefe6cc,0.95),1.5,0.25,0,fork);
[[-0.5,0.55],[-0.5,-0.55],[0.6,0.55],[0.6,-0.55]].forEach(([x,z])=>{ const w=M(new THREE.CylinderGeometry(0.25,0.25,0.2,12),MT.pneu,x,0.25,z,fork); w.rotation.x=Math.PI/2; });
scene.add(fork);
const forkPath={x:46.5, z1:8, z2:20, t:0};

/* carros no estacionamento e placa */
[[-30,0x2f6f9f],[-26,0xeeeeea],[-22,0xc23a31],[-14,0x3d464d],[-10,0xc7ced3],[-2,0x3a8a50],[2,0xeeeeea]].forEach(([x,c])=>{ const car=makeCarro(c); car.position.set(x,0,29); car.rotation.y=Math.random()<0.5?0:Math.PI; });
for(let x=-32;x<=4;x+=4) B(0.15,0.03,4.6,0xffffff,x+2,0,29).castShadow=false;
(function placa(){
  const cv=document.createElement('canvas'); cv.width=1024; cv.height=256;
  const g=cv.getContext('2d');
  g.fillStyle='#f7f6f1'; g.fillRect(0,0,1024,256);
  g.fillStyle='#24332a'; g.fillRect(0,0,1024,18); g.fillRect(0,238,1024,18);
  g.fillStyle='#4f8a3c'; for(let i=0;i<5;i++) g.fillRect(70+i*24,60+((i%2)*16),12,140-((i%2)*16));
  g.fillStyle='#24332a'; g.font='700 128px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textBaseline='middle';
  g.fillText('Sua Usina', 225, 136);
  const tex=new THREE.CanvasTexture(cv); tex.encoding=THREE.sRGBEncoding; tex.anisotropy=ANISO;
  const m=new THREE.Mesh(new THREE.BoxGeometry(16,4,0.3), [MT.estrut,MT.estrut,MT.estrut,MT.estrut,new THREE.MeshStandardMaterial({map:tex,roughness:0.6}),MT.estrut]);
  m.position.set(20,4.6,31); m.castShadow=true; scene.add(m);
  B(0.35,2.6,0.35,MT.estrut,14,0,31); B(0.35,2.6,0.35,MT.estrut,26,0,31);
})();

/* partículas de fumaça e vapor */
smokeEmitters.forEach(e=>{
  e.parts=[];
  for(let i=0;i<e.count;i++){
    const m=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1), new THREE.MeshStandardMaterial({color:lin(e.color), transparent:true, opacity:e.op, roughness:1, depthWrite:false}));
    m.castShadow=false; scene.add(m); e.parts.push({m, life:i/e.count, j:Math.random()});
  }
});
