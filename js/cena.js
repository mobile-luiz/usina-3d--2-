/* Usina em 3D: Renderizador, céu, texturas, materiais, terreno, canavial, prédios e equipamentos da usina. */
"use strict";

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage = document.getElementById('stage');
const labelsEl = document.getElementById('labels');

/* ---------- Renderer com tom de cor realista ---------- */
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);
const canvas = renderer.domElement;
const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
const lin = c => new THREE.Color(c).convertSRGBToLinear();
const HORIZ = 0xcfdbe0;
scene.fog = new THREE.Fog(lin(HORIZ), 650, 1900);

/* céu físico (Sky) com o sol na mesma direção da luz; o ambiente dos reflexos vem dele */
const SOL = new THREE.Vector3(70,115,55).normalize();
let skyMesh=null;
function ajustarCeu(u){ u.turbidity.value=4.5; u.rayleigh.value=1.9; u.mieCoefficient.value=0.004; u.mieDirectionalG.value=0.82; u.sunPosition.value.copy(SOL); }
if(THREE.Sky){
  skyMesh=new THREE.Sky(); skyMesh.scale.setScalar(1100); ajustarCeu(skyMesh.material.uniforms); skyMesh.material.depthTest=false; skyMesh.renderOrder=-1000; scene.add(skyMesh);
  scene.background=null;
}else{
  const cv=document.createElement('canvas'); cv.width=4; cv.height=256;
  const g=cv.getContext('2d'), gr=g.createLinearGradient(0,0,0,256);
  gr.addColorStop(0,'#6fa6dc'); gr.addColorStop(0.55,'#b9d3e6'); gr.addColorStop(1,'#dfe7e6');
  g.fillStyle=gr; g.fillRect(0,0,4,256);
  const t=new THREE.CanvasTexture(cv); t.encoding=THREE.sRGBEncoding; scene.background=t;
}
/* ambiente para reflexos (metal, inox) */
(function ambiente(){
  const pm=new THREE.PMREMGenerator(renderer);
  const env=new THREE.Scene();
  const geo=new THREE.SphereGeometry(100,32,16), pos=geo.attributes.position, cols=[];
  const top=lin(0x5f95cc), hor=lin(0xd9e2e4), bot=lin(0x6d6650), tmp=new THREE.Color();
  for(let i=0;i<pos.count;i++){
    const y=pos.getY(i)/100;
    if(y>0) tmp.copy(hor).lerp(top,Math.pow(y,0.6)); else tmp.copy(hor).lerp(bot,Math.min(1,-y*3));
    cols.push(tmp.r,tmp.g,tmp.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));
  env.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide})));
  const s=new THREE.Mesh(new THREE.SphereGeometry(9,16,8),new THREE.MeshBasicMaterial({color:new THREE.Color(5,4.7,4.2)}));
  s.position.copy(SOL).multiplyScalar(80); env.add(s);
  scene.environment=pm.fromScene(env,0.03).texture;
})();

const camera = new THREE.PerspectiveCamera(32, 1, 1.5, 2300);
scene.add(new THREE.HemisphereLight(lin(0xd6e6ff), lin(0x7a6c4e), 0.35));
const sun = new THREE.DirectionalLight(lin(0xffeccc), 2.25);
sun.position.set(70, 115, 55);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 3;
Object.assign(sun.shadow.camera, {left:-120, right:120, top:120, bottom:-120, near:10, far:420});
scene.add(sun);

/* ---------- Texturas geradas em canvas ---------- */
function canvasTex(w,h,draw,rep){
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
  draw(cv.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(cv);
  t.encoding=THREE.sRGBEncoding; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=ANISO;
  if(rep) t.repeat.set(rep[0],rep[1]);
  return t;
}
function grain(g,w,h,base,amp,n){
  g.fillStyle=base; g.fillRect(0,0,w,h);
  for(let i=0;i<n;i++){
    const v=(Math.random()-0.5)*amp, s=1+Math.random()*2;
    g.fillStyle=v>0?`rgba(255,255,255,${v})`:`rgba(0,0,0,${-v})`;
    g.fillRect(Math.random()*w,Math.random()*h,s,s);
  }
}
function blotches(g,w,h,rgba,n,rmax){
  for(let i=0;i<n;i++){
    const x=Math.random()*w,y=Math.random()*h,r=rmax*(0.3+Math.random()*0.7);
    const gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,rgba); gr.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=gr; g.fillRect(x-r,y-r,r*2,r*2);
  }
}
const TX = {
  concreto: canvasTex(256,256,(g,w,h)=>{ grain(g,w,h,'#d6d2c7',0.14,9000); blotches(g,w,h,'rgba(80,70,50,.06)',6,60); g.strokeStyle='rgba(0,0,0,.14)'; g.lineWidth=2; g.strokeRect(0,0,w,h); }, [152/7,80/7]),
  asfalto:  canvasTex(256,256,(g,w,h)=>{ grain(g,w,h,'#45494c',0.22,16000); blotches(g,w,h,'rgba(0,0,0,.12)',5,50); }),
  solo:     canvasTex(256,256,(g,w,h)=>{ grain(g,w,h,'#a38c66',0.2,14000); blotches(g,w,h,'rgba(90,70,40,.18)',10,50); blotches(g,w,h,'rgba(120,140,70,.12)',8,60); }, [90,90]),
  grama:    canvasTex(256,256,(g,w,h)=>{ grain(g,w,h,'#8ea35f',0.2,16000); blotches(g,w,h,'rgba(60,80,30,.18)',10,50); blotches(g,w,h,'rgba(170,150,90,.15)',6,50); }, [22,14]),
  parede:   canvasTex(128,128,(g,w,h)=>{ grain(g,w,h,'#d3cec2',0.1,3000); g.fillStyle='rgba(0,0,0,.08)'; for(let y=0;y<h;y+=16) g.fillRect(0,y,w,1); }, [1,1]),
  cana:     canvasTex(128,128,(g,w,h)=>{ g.fillStyle='#7c6a42'; g.fillRect(0,0,w,h); const c=['#b8a067','#8f7c4c','#c9b37a','#6f8c3a','#5f7a34','#a08b55']; for(let i=0;i<520;i++){ g.fillStyle=c[i%c.length]; g.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*2.5,8+Math.random()*30);} }, [2,1]),
  palha:    canvasTex(128,128,(g,w,h)=>{ grain(g,w,h,'#d3bd78',0.25,6000); }, [3,3])
};
function texMat(t,rep,rough){ const m=new THREE.MeshStandardMaterial({map:t,roughness:rough??0.95,metalness:0}); if(rep){ m.map=t.clone(); m.map.needsUpdate=true; m.map.repeat.set(rep[0],rep[1]); } return m; }

/* ---------- Materiais ---------- */
const matCache = {};
function mat(c, r, m){
  r = r ?? 0.85; m = m ?? 0;
  const k=c+'|'+r+'|'+m;
  return matCache[k] || (matCache[k] = new THREE.MeshStandardMaterial({color:lin(c), roughness:r, metalness:m, envMapIntensity:0.8}));
}
const MT = {
  aco:    mat(0x9aa3aa,0.4,0.75),
  inox:   mat(0xdfe4e8,0.25,0.9),
  estrut: mat(0x55626c,0.55,0.6),
  branco: mat(0xf1f1ed,0.45,0.05),
  amarelo:mat(0xe2b11f,0.5,0.25),
  azul:   mat(0x2f6f9f,0.5,0.3),
  vidro:  new THREE.MeshStandardMaterial({color:lin(0x1c2a33),roughness:0.08,metalness:0.9,envMapIntensity:1.4}),
  pneu:   mat(0x17191b,0.9,0),
  farol:  new THREE.MeshStandardMaterial({color:lin(0xfff6dc),emissive:lin(0xfff1c0),emissiveIntensity:0.6,roughness:0.3}),
  cana:   texMat(TX.cana,null,1),
  palhaCana: mat(0x6f8f3a,1,0),
  bagaco: texMat(TX.palha,null,1),
  acucar: mat(0xf4efe2,1,0),
  concreto: texMat(TX.concreto,null,0.95),
  asfalto: texMat(TX.asfalto,null,0.9),
  parede: texMat(TX.parede,null,0.95)
};

/* ---------- Helpers de geometria ---------- */
function M(geo, c, x, y, z, parent){
  const m = new THREE.Mesh(geo, typeof c==='number'?mat(c):c);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  (parent||scene).add(m); return m;
}
const B  = (w,h,d,c,x,y,z,p) => M(new THREE.BoxGeometry(w,h,d), c, x, y+h/2, z, p);
const Cy = (rt,rb,h,c,x,y,z,s,p) => M(new THREE.CylinderGeometry(rt,rb,h,s||24), c, x, y+h/2, z, p);
function asfaltoBox(w,d,x,z,y){
  const m=texMat(TX.asfalto,[Math.max(1,w/8),Math.max(1,d/8)],0.9);
  const b=M(new THREE.BoxGeometry(w,0.06,d),m,x,(y??0)+0.03,z); b.castShadow=false; return b;
}

/* ---------- Terreno, estrada, canaviais ---------- */
/* terreno: plano na região da usina e dos talhões, com morros e matas ao fundo */
const smooth=(a,b,x)=>{ const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };
/* canaviais nos morros: talhões com carreadores, poucas matas (reserva) e as fazendas */
const FAZENDAS_POS=[[430,80,0.3],[-440,-150,1.2],[140,330,-0.4],[-260,320,0.9]];
const MATAS=(()=>{ const m=[]; let seed=7; const rr=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
  for(let c=0;c<26;c++){ const a=rr()*Math.PI*2, r=520+rr()*1000; m.push({x:Math.cos(a)*r, z:Math.sin(a)*r-20, r:22+rr()*38}); } return m; })();
const MORRO={bx:78,bz:62,larg:72,prof:56};
const hashBloco=(i,j)=>{ const v=Math.sin(i*127.1+j*311.7)*43758.5453; return v-Math.floor(v); };
function blocoEm(x,z,lim){
  if(x>-360&&x<360&&z>-290&&z<270) return null;
  if(z>22&&z<66) return null;
  if(Math.hypot(x,z+10)>(lim||980)) return null;
  const i=Math.floor((x+2400)/MORRO.bx), j=Math.floor((z+2400)/MORRO.bz), lx=(x+2400)-i*MORRO.bx, lz=(z+2400)-j*MORRO.bz;
  if(MATAS.some(m=>Math.hypot(x-m.x,z-m.z)<m.r+7)) return null;
  if(FAZENDAS_POS.some(([fx,fz])=>Math.hypot(x-fx,z-fz)<48)) return null;
  if(lx>MORRO.larg||lz>MORRO.prof) return 'estrada';
  return hashBloco(i,j)<0.16?'colhido':'cana';
}
function alturaTerreno(x,z){
  const r=Math.hypot(x,z+10), k=smooth(470,820,r);
  if(k<=0) return -0.62;
  const n=Math.sin(x*0.0061+1.7)*0.5+Math.sin(z*0.0053+0.4)*0.5+Math.sin((x+z)*0.0109)*0.35+Math.sin((x-z)*0.017+2.1)*0.25+Math.sin(x*0.031)*Math.cos(z*0.027)*0.12;
  return -0.62+k*(48+52*n)+smooth(1100,1900,r)*90;
}
const TX_CAMPO=canvasTex(256,256,(g,w,h)=>{ grain(g,w,h,'#6c8f3c',0.22,20000); blotches(g,w,h,'rgba(40,70,20,.22)',14,50); blotches(g,w,h,'rgba(170,170,80,.16)',10,50); g.lineCap='round';
  for(let i=0;i<1400;i++){ const x=Math.random()*w,y=Math.random()*h; g.strokeStyle=['rgba(120,160,70,.55)','rgba(60,95,35,.5)','rgba(160,180,90,.4)'][i%3]; g.lineWidth=1; g.beginPath(); g.moveTo(x,y); g.lineTo(x+(Math.random()-.5)*3,y-3-Math.random()*4); g.stroke(); } }, [1,1]);
const ground=(function(){
  const geo=new THREE.PlaneGeometry(3600,3600,300,300); geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position, cols=[], c=new THREE.Color(), uv=geo.attributes.uv;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), z=pos.getZ(i), y=alturaTerreno(x,z); pos.setY(i,y);
    const n=0.5+0.5*Math.sin(x*0.021+Math.sin(z*0.013)*2)*Math.cos(z*0.017), alto=Math.min(1,Math.max(0,(y+0.62)/90));
    const bl=blocoEm(x,z,2600);
    if(bl==='cana') c.setHSL(0.13+n*0.03,0.32,0.42+n*0.06);
    else if(bl==='colhido') c.setHSL(0.12,0.42,0.68+n*0.06);
    else if(bl==='estrada') c.setHSL(0.09,0.3,0.55);
    else c.setHSL(0.24+n*0.04-alto*0.02,0.38+n*0.1,0.62+n*0.18-alto*0.12);
    cols.push(...c.convertSRGBToLinear().toArray());
    uv.setXY(i,x/9,z/9);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3)); geo.computeVertexNormals();
  const m=new THREE.MeshStandardMaterial({map:TX_CAMPO,vertexColors:true,roughness:1});
  const g=new THREE.Mesh(geo,m); g.receiveShadow=true; scene.add(g); return g;
})();
const grama = new THREE.Mesh(new THREE.PlaneGeometry(240,118), texMat(TX.grama,[27,14],1)); grama.material.polygonOffset=true; grama.material.polygonOffsetFactor=-1; grama.material.polygonOffsetUnits=-1;
grama.rotation.x=-Math.PI/2; grama.position.set(16,-0.61,-4); grama.receiveShadow=true; scene.add(grama);

const slabMat = texMat(TX.concreto,null,0.95);
slabMat.map=TX.concreto.clone(); slabMat.map.needsUpdate=true; slabMat.map.repeat.set(194/7,80/7);
const slab = M(new THREE.BoxGeometry(194,0.6,80), slabMat, 15, -0.3, -7);
slab.castShadow = false;
const estrada = M(new THREE.BoxGeometry(1800,0.5,14), texMat(TX.asfalto,[220,2],0.9), 0,-0.3,42); estrada.castShadow=false;
B(1800,0.06,0.25,0xf2f2ee,0,-0.05,35.6).castShadow=false;
B(1800,0.06,0.25,0xf2f2ee,0,-0.05,48.4).castShadow=false;
for(let x=-880;x<880;x+=9) B(3.6,0.06,0.3,0xf2f2ee,x,-0.05,42).castShadow=false;
B(1800,0.4,2.2,0xb6ab90,0,-0.62,50.3).castShadow=false;
asfaltoBox(18,4,-68,34,-0.05);
asfaltoBox(16,4,55,34,-0.05);
asfaltoBox(14,4,92,34,-0.05);
/* pistas internas dos caminhões */
asfaltoBox(5,64,-62,1);
asfaltoBox(5,77,-74,-4.5);
asfaltoBox(17,5,-68,-28);
for(let z=-24;z<30;z+=5) B(0.18,0.07,2.4,0xf2f2ee,-68,0,z).castShadow=false;

/* frentes de colheita: posição no canavial */
const FRENTES = [
  {id:'frente1', nome:'Frente 1', fx:-140, fz:-105, fazenda:'Faz. Santa Rita', talhao:'talhão 12', km:14},
  {id:'frente2', nome:'Frente 2', fx:5,    fz:-130, fazenda:'Eng. Bom Jesus',  talhao:'talhão 4',  km:22},
  {id:'frente3', nome:'Frente 3', fx:140,  fz:-100, fazenda:'Faz. Pindorama',  talhao:'talhão 7',  km:9},
  {id:'frente4', nome:'Frente 4', fx:-170, fz:-10,    fazenda:'Eng. Cachoeira',  talhao:'talhão 21', km:31}
];
const corteRect = f => [f.fx-32, f.fz-12, f.fx+32, f.fz+16];
/* estrada de terra (carreador) por onde os caminhões chegam, esperam e saem: fica sempre fora da cana */
const estradaRect = f => { let x1=f.fx-85, x2=f.fx+100; const z1=f.fz+8.4, z2=f.fz+15.6;
  if(z2>-62 && z1<58){ if(f.fx<0) x2=Math.min(x2,-106); else x1=Math.max(x1,94); }
  return [x1,z1,x2,z2]; };
const talhaoRect = f => [f.fx-32, f.fz-12-6*1.55-0.9, f.fx+32, f.fz-12];
const cortes = f => [[...corteRect(f),3],[...estradaRect(f),0.8],[...talhaoRect(f),0.9]];
FRENTES.forEach(f=>{
  const [x1,z1,x2,z2]=corteRect(f);
  const pl=new THREE.Mesh(new THREE.PlaneGeometry(x2-x1,z2-z1), texMat(TX.palha,[(x2-x1)/6,(z2-z1)/6],1));
  pl.rotation.x=-Math.PI/2; pl.position.set((x1+x2)/2,-0.6,(z1+z2)/2); pl.receiveShadow=true; pl.material.polygonOffset=true; pl.material.polygonOffsetFactor=-3; pl.material.polygonOffsetUnits=-3; scene.add(pl);
  { const [a1,b1,a2,b2]=talhaoRect(f); const p2=new THREE.Mesh(new THREE.PlaneGeometry(a2-a1,b2-b1), texMat(TX.palha,[(a2-a1)/6,(b2-b1)/6],1)); p2.rotation.x=-Math.PI/2; p2.position.set((a1+a2)/2,-0.605,(b1+b2)/2); p2.receiveShadow=true; p2.material.polygonOffset=true; p2.material.polygonOffsetFactor=-3; p2.material.polygonOffsetUnits=-3; scene.add(p2); }
  const [e1,,e2]=estradaRect(f); const est=M(new THREE.BoxGeometry(e2-e1,0.08,6.4), texMat(TX.solo,[(e2-e1)/8,1],1), (e1+e2)/2, -0.46, f.fz+12); est.castShadow=false; est.material.color=lin(0xc9b08a);
});
const canaTempo={value:0};
/* ---------- Touceiras de cana (colmos com nós e folhas) para os talhões em colheita ---------- */
const TX_COLMO=canvasTex(32,256,(g,w,h)=>{
  const gr=g.createLinearGradient(0,h,0,0); gr.addColorStop(0,'#7d6a3a'); gr.addColorStop(0.35,'#a8a24e'); gr.addColorStop(1,'#7f9f3f');
  g.fillStyle=gr; g.fillRect(0,0,w,h);
  for(let y=10;y<h;y+=24+Math.random()*8){ g.fillStyle='rgba(60,45,25,.75)'; g.fillRect(0,y,w,2.5); g.fillStyle='rgba(235,225,170,.45)'; g.fillRect(0,y+3,w,2); g.fillStyle='rgba(120,70,110,.18)'; g.fillRect(0,y-7,w,6); }
  for(let i=0;i<40;i++){ g.fillStyle='rgba(255,255,220,.12)'; g.fillRect(Math.random()*w,Math.random()*h,1,18); }
});
const TX_FOLHA=canvasTex(256,256,(g,w,h)=>{
  g.clearRect(0,0,w,h); g.lineCap='round';
  const verdes=['#4d7a2c','#5b8a33','#6a9a3c','#7aa846','#3f6a26','#88b052'];
  const folha=(x0,y0,cx,cy,x1,y1,larg,cor)=>{ for(let k=larg;k>0;k-=1.2){ g.strokeStyle=cor; g.globalAlpha=1; g.lineWidth=k; g.beginPath(); g.moveTo(x0,y0); g.quadraticCurveTo(cx,cy,x1+(larg-k)*0.0,y1); g.stroke(); }
    g.strokeStyle='rgba(225,235,190,.55)'; g.lineWidth=0.9; g.beginPath(); g.moveTo(x0,y0); g.quadraticCurveTo(cx,cy,x1,y1); g.stroke(); };
  for(let i=0;i<8;i++){ const x0=118+Math.random()*20, dx=(Math.random()-.5)*230; folha(x0,256,x0+dx*0.35,150-Math.random()*40,x0+dx,200-Math.random()*60,3.5,['#b39a55','#9c8a4c','#c2ad6a'][i%3]); }
  for(let i=0;i<42;i++){ const x0=108+Math.random()*40, dx=(Math.random()-.5)*250, alto=Math.random(); folha(x0,256,x0+dx*0.4,20+Math.random()*90*(1-alto),x0+dx,45+Math.random()*130,4+Math.random()*4,verdes[i%verdes.length]); }
});
const TX_FRANJA=canvasTex(512,128,(g,w,h)=>{
  g.clearRect(0,0,w,h); g.lineCap='round';
  g.fillStyle='#3d5f25'; g.fillRect(0,h*0.72,w,h*0.28);
  const verdes=['#4d7a2c','#5b8a33','#6a9a3c','#7aa846','#3f6a26','#88b052','#a3a85a'];
  for(let i=0;i<150;i++){ const x0=Math.random()*w, dx=(Math.random()-.5)*110, top=Math.random()*55;
    g.strokeStyle=verdes[i%verdes.length]; g.lineWidth=2.5+Math.random()*3; g.beginPath(); g.moveTo(x0,h); g.quadraticCurveTo(x0+dx*0.3,top,x0+dx,top+20+Math.random()*40); g.stroke(); }
});
function juntarGeos(geos){
  const arr=geos.map(g=>g.index?g.toNonIndexed():g), out=new THREE.BufferGeometry();
  ['position','normal','uv'].forEach(a=>{ const tot=arr.reduce((s,g)=>s+g.attributes[a].array.length,0), it=arr[0].attributes[a].itemSize, buf=new Float32Array(tot); let o=0; arr.forEach(g=>{ buf.set(g.attributes[a].array,o); o+=g.attributes[a].array.length; }); out.setAttribute(a,new THREE.BufferAttribute(buf,it)); });
  return out;
}
const GEO_COLMO=(()=>{ const gs=[]; for(let i=0;i<7;i++){ const h=2.3+Math.random()*1.0, r=0.032+Math.random()*0.02; const c=new THREE.CylinderGeometry(r*0.8,r,h,6,1,true); c.translate(0,h/2,0);
  c.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler((Math.random()-.5)*0.16,0,(Math.random()-.5)*0.16))); const a=Math.random()*Math.PI*2, d=0.05+Math.random()*0.22; c.translate(Math.cos(a)*d,0,Math.sin(a)*d); gs.push(c);} return juntarGeos(gs); })();
const GEO_FOLHA=(()=>{ const gs=[]; [0,1,2,3].forEach(k=>{ const p=new THREE.PlaneGeometry(2.5,2.4); p.translate(0,1.2,0); p.rotateY(k*Math.PI/4+0.3); p.translate(0,1.25,0); gs.push(p); });
  const b=new THREE.PlaneGeometry(1.5,1.5); b.translate(0,1.35,0); b.rotateY(1.2); gs.push(b); return juntarGeos(gs); })();
const MAT_COLMO=new THREE.MeshStandardMaterial({map:TX_COLMO,roughness:0.6,metalness:0});
const MAT_FOLHA=new THREE.MeshStandardMaterial({map:TX_FOLHA,alphaTest:0.42,side:THREE.DoubleSide,roughness:0.8,metalness:0});
MAT_FOLHA.onBeforeCompile=sh=>{
  sh.uniforms.uTempo=canaTempo;
  sh.vertexShader='uniform float uTempo;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vec3 ip=vec3(0.0);
    #ifdef USE_INSTANCING
      ip=vec3(instanceMatrix[3]);
    #endif
    float bal=sin(uTempo*1.8+ip.x*0.45+ip.z*0.3)*0.11*max(0.0,position.y-1.4);
    transformed.x+=bal; transformed.z+=bal*0.6;`);
};
/* talhão em colheita: 6 linhas de cana na frente da área colhida */
const TAL={NR:6, PASSO:0.5, LARG:1.55};
const rowZ=(f,r)=>f.fz-12.8-r*TAL.LARG;
const _m4t=new THREE.Matrix4(), _qt=new THREE.Quaternion(), _et=new THREE.Euler(), _pt=new THREE.Vector3(), _st=new THREE.Vector3();
function aplicarTouceira(t,j,cortada){
  const b=t.base[j];
  _qt.setFromEuler(_et.set(0,b.rot,0)); _pt.set(b.x,-0.6,b.z);
  _st.set(b.sc,cortada?0.1:b.sc,b.sc); _m4t.compose(_pt,_qt,_st); t.ims.setMatrixAt(j,_m4t);
  const z=cortada?0.0001:b.sc; _st.set(z,z,z); _m4t.compose(_pt,_qt,_st); t.iml.setMatrixAt(j,_m4t);
  t.cortado[j]=cortada?1:0;
}
function criarTalhao(f){
  const xs=[]; for(let x=f.fx-24.6;x<=f.fx+24.6+0.001;x+=TAL.PASSO) xs.push(x);
  const n=xs.length*TAL.NR, ims=new THREE.InstancedMesh(GEO_COLMO,MAT_COLMO,n), iml=new THREE.InstancedMesh(GEO_FOLHA,MAT_FOLHA,n);
  const base=[];
  for(let r=0;r<TAL.NR;r++) for(let i=0;i<xs.length;i++) base.push({x:xs[i]+(Math.random()-.5)*0.28, z:rowZ(f,r)+(Math.random()-.5)*0.35, sc:1.0+Math.random()*0.28, rot:Math.random()*Math.PI*2});
  const col=new THREE.Color();
  const t={xs,ims,iml,base,cortado:new Uint8Array(n)};
  for(let j=0;j<n;j++){ aplicarTouceira(t,j,false); col.setHSL(0.2+Math.random()*0.05,0.25,0.8+Math.random()*0.18); iml.setColorAt(j,col.convertSRGBToLinear()); }
  ims.castShadow=iml.castShadow=true; ims.receiveShadow=iml.receiveShadow=true; iml.userData.noAO=true;
  scene.add(ims); scene.add(iml);
  return t;
}
function cortarFaixa(t,r,xa,xb){
  if(r<0||r>=TAL.NR) return;
  const n=t.xs.length, lo=Math.min(xa,xb), hi=Math.max(xa,xb); let mud=false;
  for(let i=0;i<n;i++){ const x=t.xs[i]; if(x>=lo && x<=hi){ const j=r*n+i; if(!t.cortado[j]){ aplicarTouceira(t,j,true); mud=true; } } }
  if(mud){ t.ims.instanceMatrix.needsUpdate=true; t.iml.instanceMatrix.needsUpdate=true; }
}
/* capim e flores nas margens dos carreadores */
(function capim(){
  const tx=canvasTex(128,96,(g,w,h)=>{ g.clearRect(0,0,w,h); g.lineCap='round'; const cs=['#5f8f34','#6fa03c','#4f7d2c','#88b04c','#9cb85a'];
    for(let i=0;i<70;i++){ const x=8+Math.random()*112, dx=(Math.random()-.5)*36; g.strokeStyle=cs[i%cs.length]; g.lineWidth=1.5+Math.random()*2; g.beginPath(); g.moveTo(x,h); g.quadraticCurveTo(x+dx*0.4,h*0.4,x+dx,10+Math.random()*50); g.stroke(); }
    ['#f2f0e6','#e9c93a','#d9584a','#8f7fd6'].forEach(c=>{ for(let i=0;i<4;i++){ g.fillStyle=c; g.beginPath(); g.arc(10+Math.random()*108,12+Math.random()*40,2.6,0,Math.PI*2); g.fill(); } }); });
  const geo=juntarGeos([0,1].map(k=>{ const p=new THREE.PlaneGeometry(1.1,0.8); p.translate(0,0.4,0); p.rotateY(k*Math.PI/2+0.4); return p; }));
  const m=new THREE.MeshStandardMaterial({map:tx,alphaTest:0.45,side:THREE.DoubleSide,roughness:0.9});
  const pts=[];
  FRENTES.forEach(f=>{ const [x1,z1,x2,z2]=estradaRect(f); [z1+0.2,z2-0.2].forEach(z=>{ for(let x=x1+1;x<x2-1;x+=0.6) pts.push([x+(Math.random()-.5)*0.4,z+(Math.random()-.5)*0.7]); }); });
  const im=new THREE.InstancedMesh(geo,m,pts.length), m4=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler(), sc=new THREE.Vector3(), col=new THREE.Color();
  pts.forEach(([x,z],i)=>{ const k=0.8+Math.random()*0.7; q.setFromEuler(e.set(0,Math.random()*3,0)); sc.set(k,k,k); m4.compose(new THREE.Vector3(x,-0.6,z),q,sc); im.setMatrixAt(i,m4); col.setHSL(0.24+Math.random()*0.05,0.3,0.8+Math.random()*0.2); im.setColorAt(i,col.convertSRGBToLinear()); });
  im.receiveShadow=true; im.userData.noAO=true; scene.add(im);
})();
function regenerarTalhao(t){ for(let j=0;j<t.base.length;j++) aplicarTouceira(t,j,false); t.ims.instanceMatrix.needsUpdate=true; t.iml.instanceMatrix.needsUpdate=true; }

(function canaviais(){
  /* textura lateral: touceiras de folhas subindo; textura de cima: folhagem vista do alto */
  const lado=canvasTex(256,256,(g,w,h)=>{
    const gr=g.createLinearGradient(0,h,0,0); gr.addColorStop(0,'#2e3f1c'); gr.addColorStop(0.35,'#3f5c25'); gr.addColorStop(1,'#5f8a35');
    g.fillStyle=gr; g.fillRect(0,0,w,h);
    const cs=['#4f7a2e','#5f8c36','#6e9b3e','#3a5a22','#86a447','#9da857','#b4ad63'];
    for(let i=0;i<1100;i++){ const x=Math.random()*w; g.strokeStyle=cs[i%cs.length]; g.globalAlpha=0.55+Math.random()*0.45; g.lineWidth=0.8+Math.random()*2.2;
      g.beginPath(); g.moveTo(x,h); g.quadraticCurveTo(x+(Math.random()-.5)*40,h*0.55,x+(Math.random()-.5)*90,Math.random()*h*0.45); g.stroke(); }
    g.globalAlpha=1; for(let i=0;i<70;i++){ g.fillStyle='rgba(205,190,120,.5)'; g.fillRect(Math.random()*w,h*0.55+Math.random()*h*0.45,1.5,10+Math.random()*25); }
  });
  const topo=canvasTex(256,256,(g,w,h)=>{
    g.fillStyle='#456b28'; g.fillRect(0,0,w,h);
    const cs=['#5c8a33','#6e9b3e','#3c5e22','#86a447','#a2ac5a','#4b7a2c'];
    for(let i=0;i<1600;i++){ const x=Math.random()*w,y=Math.random()*h,a=Math.random()*Math.PI*2,l=6+Math.random()*26;
      g.strokeStyle=cs[i%cs.length]; g.lineWidth=1+Math.random()*2; g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+Math.cos(a+0.6)*l*0.6,y+Math.sin(a+0.6)*l*0.6,x+Math.cos(a)*l,y+Math.sin(a)*l); g.stroke(); }
  });
  const canaMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.88,metalness:0,map:lado});
  canaMat.onBeforeCompile=sh=>{
    sh.uniforms.uTempo=canaTempo; sh.uniforms.tTopo={value:topo};
    sh.vertexShader='uniform float uTempo;\nvarying vec3 vWP;\nvarying vec3 vWN;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 wp0=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        wp0=instanceMatrix*wp0;
      #endif
      wp0=modelMatrix*wp0;
      float alto=step(0.0,position.y);
      transformed.z+=sin(uTempo*1.7+wp0.x*0.35+wp0.z*0.23)*0.16*alto;
      transformed.x+=sin(uTempo*1.3+wp0.z*0.31)*0.004*alto;
      vWP=wp0.xyz; vWN=normal;`);
    sh.fragmentShader='uniform sampler2D tTopo;\nvarying vec3 vWP;\nvarying vec3 vWN;\n'+sh.fragmentShader.replace('#include <map_fragment>',`
      vec3 an=abs(vWN);
      vec4 tx;
      if(an.y>0.5) tx=texture2D(tTopo, vWP.xz*0.11);
      else if(an.x>0.5) tx=texture2D(map, vec2(vWP.z*0.13, vWP.y*0.48+0.3));
      else tx=texture2D(map, vec2(vWP.x*0.13, vWP.y*0.48+0.3));
      tx=mapTexelToLinear(tx);
      diffuseColor*=tx;`);
  };
  const palhaMat=texMat(TX.palha,null,1);
  palhaMat.onBeforeCompile=sh=>{
    sh.vertexShader='varying vec3 vWP;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 wq=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        wq=instanceMatrix*wq;
      #endif
      vWP=(modelMatrix*wq).xyz;`);
    sh.fragmentShader='varying vec3 vWP;\n'+sh.fragmentShader.replace('#include <map_fragment>',`vec4 tx=mapTexelToLinear(texture2D(map, vWP.xz*0.25)); diffuseColor*=tx;`);
  };

  const cells = [];
  for(let x=-330; x<330; x+=46){
    for(let z=-260; z<240; z+=36){
      const x2=x+40, z2=z+30;
      if(x2>-104 && x<134 && z2>-62 && z<58) continue;
      if(z2>32 && z<56) continue;
      cells.push([x,z,x2,z2,Math.random()<0.2]);
    }
  }
  const pe=[], colh=[];
  cells.forEach(([x1,z1,x2,z2,colhido])=>{
    if(colhido){ colh.push({x:(x1+x2)/2, z:(z1+z2)/2, w:x2-x1, d:z2-z1}); return; }
    for(let z=z1+0.8; z<z2; z+=1.55){
      let partes=[[x1,x2]];
      FRENTES.forEach(f=>cortes(f).forEach(([a1,b1,a2,b2,mz])=>{
        if(z<b1-0.8 || z>b2+mz) return;
        partes=partes.flatMap(([p1,p2])=> (p2<=a1-1||p1>=a2+1)?[[p1,p2]]:[[p1,Math.max(p1,a1-1)],[Math.min(p2,a2+1),p2]].filter(([q1,q2])=>q2-q1>1));
      }));
      partes.forEach(([p1,p2])=>pe.push({x:(p1+p2)/2, z, w:p2-p1}));
    }
  });
  const geo=new THREE.BoxGeometry(1,1,1,1,1,1);
  const im = new THREE.InstancedMesh(geo, canaMat, pe.length);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  pe.forEach((r,i)=>{
    const h = 2.1+Math.random()*0.7; r.h=h;
    m4.makeScale(r.w, h, 1.25); m4.setPosition(r.x, -0.62+h/2, r.z);
    im.setMatrixAt(i, m4);
    col.setHSL(0.18+Math.random()*0.06, 0.3, 0.78+Math.random()*0.16);
    im.setColorAt(i, col.convertSRGBToLinear());
  });
  im.receiveShadow = im.castShadow = true;
  scene.add(im);
  /* franja de folhas: quebra o topo reto das linhas e dá o recorte das folhas */
  const franjaMat=new THREE.MeshStandardMaterial({map:TX_FRANJA,alphaTest:0.45,side:THREE.DoubleSide,roughness:0.85});
  franjaMat.onBeforeCompile=sh=>{
    sh.uniforms.uTempo=canaTempo;
    sh.vertexShader='uniform float uTempo;\nvarying vec2 vUvF;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 wf=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        wf=instanceMatrix*wf;
      #endif
      wf=modelMatrix*wf;
      transformed.z+=sin(uTempo*1.7+wf.x*0.35+wf.z*0.23)*0.18*uv.y;
      vUvF=vec2(wf.x*0.21+wf.z*0.37, uv.y);`);
    sh.fragmentShader='varying vec2 vUvF;\n'+sh.fragmentShader.replace('#include <map_fragment>','vec4 txf=mapTexelToLinear(texture2D(map, vUvF)); diffuseColor*=txf;');
  };
  const fr=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),franjaMat,pe.length*2);
  pe.forEach((r,i)=>{ [-0.36,0.36].forEach((dz,k)=>{ m4.makeScale(r.w,1.45,1); m4.setPosition(r.x,-0.62+r.h+0.35,r.z+dz); fr.setMatrixAt(i*2+k,m4);
    col.setHSL(0.2+Math.random()*0.05,0.25,0.82+Math.random()*0.16); fr.setColorAt(i*2+k,col.convertSRGBToLinear()); }); });
  fr.castShadow=true; fr.receiveShadow=true; fr.userData.noAO=true; scene.add(fr);
  /* talhões já colhidos: palha no chão */
  const ic=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1), palhaMat, colh.length);
  colh.forEach((c,i)=>{ m4.makeScale(c.w,0.12,c.d); m4.setPosition(c.x,-0.56,c.z); ic.setMatrixAt(i,m4); });
  ic.receiveShadow=true; scene.add(ic);
  ic.material.polygonOffset=true; ic.material.polygonOffsetFactor=-2; ic.material.polygonOffsetUnits=-2;
  const terraM=texMat(TX.solo,null,1); terraM.polygonOffset=true; terraM.polygonOffsetFactor=-2; terraM.polygonOffsetUnits=-2;
  terraM.onBeforeCompile=sh=>{ sh.vertexShader='varying vec3 vWS;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 ws=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        ws=instanceMatrix*ws;
      #endif
      vWS=(modelMatrix*ws).xyz;`); sh.fragmentShader='varying vec3 vWS;\n'+sh.fragmentShader.replace('#include <map_fragment>','vec4 txs=mapTexelToLinear(texture2D(map, vWS.xz*0.12)); diffuseColor*=txs;'); };
  const cheios=cells.filter(c=>!c[4]), it=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),terraM,cheios.length);
  cheios.forEach((c,i)=>{ m4.makeScale(c[2]-c[0],1,c[3]-c[1]); m4.setPosition((c[0]+c[2])/2,-0.611,(c[1]+c[3])/2); it.setMatrixAt(i,m4); });
  it.receiveShadow=true; scene.add(it);
  /* cana nos morros: linhas em segmentos que acompanham a inclinação do terreno */
  const segs=[], SEG=20;
  for(let z=-1100; z<1100; z+=2.6){
    for(let x=-1100; x<1100; x+=SEG){
      const cx=x+SEG/2;
      if(blocoEm(cx,z)!=='cana' || blocoEm(cx-9,z)!=='cana' || blocoEm(cx+9,z)!=='cana') continue;
      segs.push([cx,z]);
    }
  }
  const imM=new THREE.InstancedMesh(geo, canaMat, segs.length), qq=new THREE.Quaternion(), ee=new THREE.Euler(), ss=new THREE.Vector3(), pp=new THREE.Vector3();
  segs.forEach(([x,z],i)=>{
    const y0=alturaTerreno(x-SEG/2,z), y1=alturaTerreno(x+SEG/2,z), yc=alturaTerreno(x,z), h=2.2+Math.random()*0.6;
    qq.setFromEuler(ee.set(0,0,Math.atan2(y1-y0,SEG))); ss.set(SEG+0.4,h,1.7); pp.set(x,Math.min(yc,(y0+y1)/2)+h/2-0.35,z);
    m4.compose(pp,qq,ss); imM.setMatrixAt(i,m4);
    const bi=Math.floor((x+2400)/MORRO.bx), bj=Math.floor((z+2400)/MORRO.bz), hv=hashBloco(bi+7,bj+3);
    col.setHSL(0.17+hv*0.07,0.3,0.74+hv*0.2+Math.random()*0.05); imM.setColorAt(i,col.convertSRGBToLinear());
  });
  imM.receiveShadow=true; imM.castShadow=false; scene.add(imM);
})();


/* árvores */
const FOLHAS=[0x4f7a37,0x5f8c43,0x46703a,0x6b9548];
function tree(x,z,s){
  s = s||1;
  Cy(0.25*s,0.38*s,2.2*s,mat(0x6b4f35,1),x,-0.6,z,8);
  const f=FOLHAS[Math.floor(Math.random()*FOLHAS.length)];
  const blobs=[[0,3.4,0,1.9],[0.9,3.0,0.5,1.3],[-0.8,3.1,-0.4,1.4],[0.2,4.3,-0.2,1.2]];
  blobs.forEach(([bx,by,bz,br])=>{
    const m=M(new THREE.IcosahedronGeometry(br*s,1), mat(f,0.95), x+bx*s, -0.6+by*s, z+bz*s);
    m.rotation.set(Math.random(),Math.random(),Math.random());
  });
}
[[-90,-40],[-91,-20],[-89,0],[120,-40],[121,-18],[119,4],[122,26],[-100,-50],[118,-52],[-20,-53],[10,-54],[40,-53],[-60,-53]]
 .forEach(([x,z])=>tree(x,z,0.85+Math.random()*0.35));
for(let x=-220;x<=220;x+=7){ if(Math.random()<0.18) continue; tree(x+Math.random()*2,54+Math.random()*2,0.75+Math.random()*0.4); }
/* ---------- Cenário de campo: estradas de terra, matas, nuvens, postes, fazendas e capim ---------- */
/* estradas de terra entre os talhões, com trilho de pneu e capim no meio */
(function estradasDeTerra(){
  const tx=canvasTex(128,256,(g,w,h)=>{
    g.fillStyle='#7d9a46'; g.fillRect(0,0,w,h);
    const terra=(a,b)=>{ g.fillStyle='#9b8159'; g.fillRect(a,0,b-a,h); for(let i=0;i<900;i++){ g.fillStyle=Math.random()<0.5?'rgba(70,55,35,.25)':'rgba(220,200,160,.18)'; g.fillRect(a+Math.random()*(b-a),Math.random()*h,1.5,2+Math.random()*3); } };
    terra(14,52); terra(76,114);
    g.fillStyle='rgba(60,48,30,.35)'; g.fillRect(24,0,14,h); g.fillRect(88,0,14,h);
    for(let i=0;i<500;i++){ const x=Math.random()<0.5?Math.random()*14:(Math.random()<0.5?52+Math.random()*24:114+Math.random()*14); g.strokeStyle=['#6f9a3e','#8db04e','#5d8434'][i%3]; g.lineWidth=1.4; const y=Math.random()*h; g.beginPath(); g.moveTo(x,y); g.lineTo(x+(Math.random()-.5)*4,y-4-Math.random()*6); g.stroke(); }
  });
  const m=new THREE.MeshStandardMaterial({map:tx,roughness:1,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const zonaUsina=(x,z)=>x>-110&&x<140&&z>-66&&z<62, faixaEstrada=z=>z>30&&z<58;
  const tiras=[];
  for(let x=-330;x<330;x+=46){ const cx=x+43; let ini=null; for(let z=-262;z<=242;z+=2){ const livre=!zonaUsina(cx,z)&&!faixaEstrada(z)&&z<242; if(livre&&ini===null) ini=z; if((!livre||z>=242)&&ini!==null){ if(z-ini>6) tiras.push({x:cx,z:(ini+z)/2,L:z-ini,eixo:'z'}); ini=null; } } }
  for(let z=-260;z<240;z+=36){ const cz=z+33; if(faixaEstrada(cz)) continue; let ini=null; for(let x=-332;x<=332;x+=2){ const livre=!zonaUsina(x,cz)&&x<332; if(livre&&ini===null) ini=x; if((!livre||x>=332)&&ini!==null){ if(x-ini>6) tiras.push({x:(ini+x)/2,z:cz,L:x-ini,eixo:'x'}); ini=null; } } }
  tiras.forEach(t=>{
    const geo=new THREE.PlaneGeometry(6,t.L); const uv=geo.attributes.uv; for(let i=0;i<uv.count;i++) uv.setY(i,uv.getY(i)*t.L/9);
    const pm=new THREE.Mesh(geo,m); pm.rotation.x=-Math.PI/2; if(t.eixo==='x') pm.rotation.z=Math.PI/2;
    pm.position.set(t.x,-0.612,t.z); pm.receiveShadow=true; scene.add(pm);
  });
})();

/* matas e fileiras de árvores (instanciadas, longe da usina) */
(function matas(){
  const pts=[];
  const add=(x,z,tipo)=>pts.push({x,z,tipo,y:alturaTerreno(x,z)});
  for(const mm of MATAS){ const cx=mm.x, cz=mm.z, raio=mm.r, n=Math.round(raio*0.9);
    for(let i=0;i<n;i++){ const aa=Math.random()*Math.PI*2, rr=Math.sqrt(Math.random())*raio; add(cx+Math.cos(aa)*rr, cz+Math.sin(aa)*rr, Math.random()<0.35?1:0); } }
  for(let x=-350;x<=350;x+=9){ add(x+Math.random()*3,-282+Math.random()*3,1); add(x+Math.random()*3,262+Math.random()*3,Math.random()<0.5?1:0); }
  for(let z=-280;z<=262;z+=9){ add(-352+Math.random()*3,z,1); add(352+Math.random()*3,z,0); }
  const tronco=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22,0.35,1,6),mat(0x6b5a48,1),pts.length);
  const copa=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.95}),pts.length);
  const m4=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler(), sc=new THREE.Vector3(), p=new THREE.Vector3(), col=new THREE.Color();
  pts.forEach((t,i)=>{
    const euc=t.tipo===1, H=euc?11+Math.random()*7:4+Math.random()*3, R=euc?2.2+Math.random():3+Math.random()*2.2;
    q.identity(); sc.set(1,H*(euc?0.75:0.55),1); p.set(t.x,t.y+H*(euc?0.375:0.275),t.z); m4.compose(p,q,sc); tronco.setMatrixAt(i,m4);
    q.setFromEuler(e.set(Math.random(),Math.random()*3,Math.random())); sc.set(R,euc?R*1.9:R*0.85,R); p.set(t.x,t.y+(euc?H*0.78:H*0.62+R*0.4),t.z); m4.compose(p,q,sc); copa.setMatrixAt(i,m4);
    col.setHSL(euc?0.2+Math.random()*0.04:0.26+Math.random()*0.06,euc?0.3:0.45,euc?0.32+Math.random()*0.06:0.22+Math.random()*0.08); copa.setColorAt(i,col.convertSRGBToLinear());
  });
  tronco.castShadow=copa.castShadow=false; copa.receiveShadow=true;
  scene.add(tronco); scene.add(copa);
})();

/* nuvens */
const NUVENS=[];
(function nuvens(){
  const tx=canvasTex(256,128,(g,w,h)=>{ g.clearRect(0,0,w,h); for(let i=0;i<26;i++){ const x=40+Math.random()*176, y=50+Math.random()*40, r=18+Math.random()*34; const gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,'rgba(255,255,255,.9)'); gr.addColorStop(0.6,'rgba(250,250,252,.5)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(x-r,y-r,r*2,r*2); }
    const sh=g.createLinearGradient(0,40,0,110); sh.addColorStop(0,'rgba(0,0,0,0)'); sh.addColorStop(1,'rgba(150,160,175,.35)'); g.globalCompositeOperation='source-atop'; g.fillStyle=sh; g.fillRect(0,0,w,h); });
  tx.wrapS=tx.wrapT=THREE.ClampToEdgeWrapping;
  for(let i=0;i<46;i++){
    const sm=new THREE.SpriteMaterial({map:tx,transparent:true,depthWrite:false,opacity:0.75+Math.random()*0.25,fog:true});
    const sp=new THREE.Sprite(sm), k=1+Math.random()*1.6; sp.scale.set(190*k,80*k,1);
    const a=Math.random()*Math.PI*2, r=200+Math.random()*1300; sp.position.set(Math.cos(a)*r,240+Math.random()*120,Math.sin(a)*r);
    sp.renderOrder=-10; scene.add(sp); NUVENS.push(sp);
  }
})();
function animarNuvens(dt){ NUVENS.forEach(n=>{ n.position.x+=dt*3; if(n.position.x>1500) n.position.x=-1500; }); }

/* postes de energia ao longo da estrada */
(function postes(){
  const madeira=mat(0x6e5a44,0.95), fio=mat(0x2a2c2e,0.6,0.4);
  const xs=[]; for(let x=-640;x<=640;x+=34) xs.push(x);
  xs.forEach(x=>{ Cy(0.16,0.22,10.5,madeira,x,-0.6,51.6,8); B(2.6,0.18,0.18,madeira,x,9.2,51.6); [-1.1,0,1.1].forEach(dx=>Cy(0.07,0.07,0.25,MT.branco,x+dx,9.38,51.6,6)); });
  for(let i=0;i<xs.length-1;i++) [-1.1,0,1.1].forEach(dx=>{ const w=M(new THREE.CylinderGeometry(0.025,0.025,34,4),fio,(xs[i]+xs[i+1])/2+dx,9.3,51.6); w.rotation.z=Math.PI/2; w.castShadow=false; });
})();

/* fazendas na paisagem: celeiro vermelho, casa e silos */
(function fazendas(){
  const telhado=(w,d,h,m,x,y,z,rotY)=>{ const g=new THREE.Group(); g.position.set(x,y,z); g.rotation.y=rotY; scene.add(g);
    [-1,1].forEach(s=>{ const p=B(w+0.6,0.18,d/2/Math.cos(0.5)+0.4,m,0,0,s*d/4,g); p.rotation.x=s*0.5; p.position.y=h/2-0.1; });
    const tri=new THREE.Shape(); tri.moveTo(-d/2,0); tri.lineTo(d/2,0); tri.lineTo(0,h); tri.lineTo(-d/2,0);
    const tg=new THREE.ShapeGeometry(tri); [-w/2,w/2].forEach(px=>{ const o=M(tg,mat(0x9e2b25,0.8),px,0,0,g); o.rotation.y=Math.PI/2; o.material.side=THREE.DoubleSide; }); return g; };
  FAZENDAS_POS.forEach(([x,z,r])=>{
    const y=alturaTerreno(x,z), g=new THREE.Group(); g.position.set(x,y,z); g.rotation.y=r; scene.add(g);
    B(16,6,10,mat(0x9e2b25,0.8),0,0,0,g); B(16.2,0.4,10.2,MT.branco,0,0,0,g); B(4,4.2,0.1,mat(0x6b2019,0.8),0,0,5.06,g);
    const tg=new THREE.Group(); tg.position.set(0,6,0); g.add(tg);
    [-1,1].forEach(s=>{ const p=B(16.6,0.2,6.4,mat(0x5d6266,0.5,0.5),0,0,s*2.6,tg); p.rotation.x=s*0.62; p.position.y=1.7; });
    const tri=new THREE.Shape(); tri.moveTo(-5,0); tri.lineTo(5,0); tri.lineTo(0,3.6); tri.lineTo(-5,0); const sg=new THREE.ShapeGeometry(tri);
    [-8,8].forEach(px=>{ const o=new THREE.Mesh(sg,mat(0x9e2b25,0.8)); o.material.side=THREE.DoubleSide; o.position.set(px,0,0); o.rotation.y=Math.PI/2; tg.add(o); });
    [[13,-3],[13,3.5]].forEach(([sx,sz])=>{ Cy(2.4,2.4,11,mat(0xc9cdd0,0.4,0.6),sx,0,sz,20,g); M(new THREE.SphereGeometry(2.4,20,10,0,Math.PI*2,0,Math.PI/2),mat(0xb0b5b9,0.4,0.6),sx,11,sz,g); });
    B(9,4,7,MT.branco,-15,0,4,g); const ct=new THREE.Group(); ct.position.set(-15,4,4); g.add(ct);
    [-1,1].forEach(s=>{ const p=B(9.6,0.2,4.6,mat(0xc0583a,0.7),0,0,s*1.8,ct); p.rotation.x=s*0.6; p.position.y=1.2; });
    [-1,1].forEach(s=>{ const o=new THREE.Mesh(new THREE.ShapeGeometry((()=>{ const t=new THREE.Shape(); t.moveTo(-3.5,0); t.lineTo(3.5,0); t.lineTo(0,2.5); t.lineTo(-3.5,0); return t; })()),MT.branco); o.material.side=THREE.DoubleSide; o.position.set(s*4.5,0,0); o.rotation.y=Math.PI/2; ct.add(o); });
    for(let i=0;i<5;i++){ const t=new THREE.Group(); g.add(t); }
  });
})();

/* capim em volta da usina e na beira da estrada */
(function capimUsina(){
  const tx=canvasTex(128,96,(g,w,h)=>{ g.clearRect(0,0,w,h); g.lineCap='round'; const cs=['#5f8f34','#6fa03c','#4f7d2c','#88b04c','#9cb85a','#b0b866'];
    for(let i=0;i<80;i++){ const x=6+Math.random()*116, dx=(Math.random()-.5)*34; g.strokeStyle=cs[i%cs.length]; g.lineWidth=1.3+Math.random()*1.8; g.beginPath(); g.moveTo(x,h); g.quadraticCurveTo(x+dx*0.4,h*0.4,x+dx,8+Math.random()*55); g.stroke(); }
    ['#f2f0e6','#e9c93a'].forEach(c=>{ for(let i=0;i<3;i++){ g.fillStyle=c; g.beginPath(); g.arc(10+Math.random()*108,10+Math.random()*40,2.2,0,Math.PI*2); g.fill(); } }); });
  const geo=juntarGeos([0,1].map(k=>{ const p=new THREE.PlaneGeometry(1.0,0.7); p.translate(0,0.35,0); p.rotateY(k*Math.PI/2+0.4); return p; }));
  const m=new THREE.MeshStandardMaterial({map:tx,alphaTest:0.45,side:THREE.DoubleSide,roughness:0.9});
  const pts=[];
  for(let i=0;i<9000 && pts.length<5200;i++){
    const x=-104+Math.random()*240, z=-63+Math.random()*118;
    if(x>-83&&x<113&&z>-48&&z<34) continue; if(z>34.5&&z<50) continue;
    pts.push([x,z]);
  }
  for(let x=-400;x<400;x+=0.9){ pts.push([x+(Math.random()-.5)*0.6,50.6+Math.random()*1.4]); pts.push([x+(Math.random()-.5)*0.6,33.6+Math.random()*1.2]); }
  const im=new THREE.InstancedMesh(geo,m,pts.length), m4=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler(), sc=new THREE.Vector3(), col=new THREE.Color();
  pts.forEach(([x,z],i)=>{ const k=0.7+Math.random()*0.8; q.setFromEuler(e.set(0,Math.random()*3,0)); sc.set(k,k,k); m4.compose(new THREE.Vector3(x,-0.6,z),q,sc); im.setMatrixAt(i,m4); col.setHSL(0.23+Math.random()*0.06,0.32,0.75+Math.random()*0.25); im.setColorAt(i,col.convertSRGBToLinear()); });
  im.receiveShadow=true; im.userData.noAO=true; scene.add(im);
})();


/* cerca do perímetro */
function cerca(x1,z1,x2,z2){
  const L=Math.hypot(x2-x1,z2-z1), n=Math.max(1,Math.round(L/4)), ang=Math.atan2(-(z2-z1),x2-x1);
  for(let i=0;i<=n;i++){ const t=i/n; B(0.12,2.2,0.12,MT.estrut,x1+(x2-x1)*t,0,z1+(z2-z1)*t).castShadow=false; }
  const tela=new THREE.Mesh(new THREE.BoxGeometry(L,2,0.03), new THREE.MeshStandardMaterial({color:lin(0x9aa3a8),transparent:true,opacity:0.28,roughness:0.6,metalness:0.4,depthWrite:false}));
  tela.position.set((x1+x2)/2,1.05,(z1+z2)/2); tela.rotation.y=ang; scene.add(tela);
  const trilho=M(new THREE.BoxGeometry(L,0.06,0.06),MT.aco,(x1+x2)/2,2.15,(z1+z2)/2); trilho.rotation.y=ang; trilho.castShadow=false;
}
cerca(-81.6,32.6,-78,32.6); cerca(-56,32.6,44,32.6); cerca(66,32.6,84,32.6); cerca(100,32.6,111.6,32.6);
cerca(-81.6,-46.6,111.6,-46.6); cerca(-81.6,-46.6,-81.6,32.6); cerca(111.6,-46.6,111.6,32.6);

/* postes de luz */
[[-68,8],[-68,-18],[-42,26],[-13,27.4],[24,-30],[-42,-30],[66,-12],[66,28],[0,-44]].forEach(([x,z])=>{
  Cy(0.12,0.18,10,MT.estrut,x,0,z,10);
  B(2.2,0.15,0.15,MT.estrut,x+1,9.8,z);
  B(0.8,0.25,0.5,MT.farol,x+2,9.6,z);
});

/* ---------- Áreas e etapas ---------- */
const AREAS = {
  recepcao:  {nome:'Recepção de cana',   cor:0x4f8a3c, tag:[-62,3,27],  alvo:[-52,-9], r:88},
  fabrica:   {nome:'Fábrica de açúcar',  cor:0xc98a1e, tag:[-9,11,-27], alvo:[-9,-6],  r:110},
  energia:   {nome:'Energia',            cor:0x6f7c86, tag:[9.5,9,-40], alvo:[-38,-38],r:88, theta:Math.PI-0.35, phi:0.88},
  destilaria:{nome:'Destilaria',         cor:0x2f7fc1, tag:[45,15,-27], alvo:[45,-24], r:100},
  expedicao: {nome:'Armazém e expedição',cor:0x8b6a3e, tag:[63,10,14],   alvo:[46,14],  r:95},
  colheita:  {nome:'Frentes de colheita', cor:0x9a7b3c, tag:null,          alvo:[-20,-62], r:480},
  oficina:   {nome:'Oficina automotiva', cor:0x5a6b7d, tag:null, alvo:[92,18], r:88, phi:0.84}
};
const ST = [
  {id:'balanca',      nome:'Balança',             area:'recepcao',  x:-49,z:20, w:12,d:9,  sla:8,   base:6,  pre:'Carga'},
  {id:'laboratorio',  nome:'Laboratório PCTS',    area:'recepcao',  x:-49,z:7,  w:12,d:9,  sla:15,  base:8,  pre:'Amostra'},
  {id:'hilo',         nome:'Hilo e descarga',     area:'recepcao',  x:-49,z:-1.6,w:12,d:7, sla:20,  base:10, pre:'Carga'},
  {id:'moenda',       nome:'Moenda',              area:'fabrica',   x:-29,z:-19,w:14,d:12, sla:30,  base:10, pre:'Lote de moagem'},
  {id:'tratamento',   nome:'Tratamento do caldo', area:'fabrica',   x:-9, z:-19,w:14,d:12, sla:40,  base:9,  pre:'Lote de caldo'},
  {id:'evaporacao',   nome:'Evaporação',          area:'fabrica',   x:11, z:-19,w:14,d:12, sla:60,  base:8,  pre:'Lote de xarope'},
  {id:'cozimento',    nome:'Cozimento',           area:'fabrica',   x:11, z:5,  w:14,d:12, sla:120, base:12, pre:'Massa cozida'},
  {id:'centrifugacao',nome:'Centrifugação',       area:'fabrica',   x:-9, z:5,  w:14,d:12, sla:30,  base:9,  pre:'Lote de açúcar'},
  {id:'secagem',      nome:'Secagem',             area:'fabrica',   x:-29,z:5,  w:14,d:12, sla:45,  base:8,  pre:'Lote de açúcar'},
  {id:'caldeira',     nome:'Caldeira',            area:'energia',   x:-28,z:-38,w:14,d:10, sla:60,  base:6,  pre:'Lote de bagaço'},
  {id:'cogeracao',    nome:'Cogeração',           area:'energia',   x:-10,z:-38,w:14,d:10, sla:null,base:4,  pre:'Turbogerador'},
  {id:'fermentacao',  nome:'Fermentação',         area:'destilaria',x:37, z:-18,w:14,d:14, sla:480, base:8,  pre:'Dorna'},
  {id:'destilacao',   nome:'Destilação',          area:'destilaria',x:55, z:-18,w:12,d:14, sla:120, base:6,  pre:'Batelada'},
  {id:'tanques',      nome:'Tanques de etanol',   area:'destilaria',x:46, z:-38,w:28,d:10, sla:null,base:6,  pre:'Tanque'},
  {id:'armazem',      nome:'Armazém de açúcar',   area:'expedicao', x:37, z:14, w:14,d:16, sla:null,base:14, pre:'Pilha'},
  {id:'ensaque',      nome:'Ensaque',             area:'expedicao', x:55, z:8,  w:12,d:8,  sla:30,  base:8,  pre:'Ordem de ensaque'},
  {id:'carregamento', nome:'Carregamento',        area:'expedicao', x:55, z:20, w:12,d:8,  sla:90,  base:7,  pre:'Carreta'}
];
ST.push({id:'oficina', nome:'Oficina', area:'oficina', x:104, z:26.5, w:14, d:8, sla:1440, base:4, pre:'Veículo'});
FRENTES.forEach(f=>ST.push({id:f.id, nome:f.nome, area:'colheita', x:f.fx+2, z:f.fz+4, w:22, d:9, y:-0.42, sla:40, base:2, pre:'Caminhão'}));

/* prédios: paredes baixas + estrutura metálica aberta */
function walls(x1,z1,x2,z2,h){
  const t=0.5, w=x2-x1, d=z2-z1, m=MT.parede;
  B(w,h,t,m,(x1+x2)/2,0,z1); B(w,h*0.4,t,m,(x1+x2)/2,0,z2);
  B(t,h,d,m,x1,0,(z1+z2)/2); B(t,h,d,m,x2,0,(z1+z2)/2);
  B(w,0.25,t+0.1,MT.estrut,(x1+x2)/2,h,z1);
}
function estrutura(x1,z1,x2,z2,h,passo){
  const cols=[];
  for(let x=x1;x<=x2+0.01;x+=passo){ cols.push([x,z1]); }
  for(let z=z1+passo;z<=z2+0.01;z+=passo){ cols.push([x1,z]); cols.push([x2,z]); }
  cols.forEach(([x,z])=>B(0.45,h,0.45,MT.estrut,x,0,z));
  B(x2-x1+0.4,0.5,0.4,MT.estrut,(x1+x2)/2,h-0.5,z1);
  B(0.4,0.5,z2-z1,MT.estrut,x1,h-0.5,(z1+z2)/2);
  B(0.4,0.5,z2-z1,MT.estrut,x2,h-0.5,(z1+z2)/2);
  for(let x=x1;x<=x2+0.01;x+=passo) B(0.3,0.35,z2-z1,MT.estrut,x,h-0.45,(z1+z2)/2).castShadow=true;
  /* faixa de telhado só no fundo, para não esconder a operação */
  const tel=M(new THREE.BoxGeometry(x2-x1+1.2,0.18,passo*0.9),mat(0xb8bec2,0.45,0.6),(x1+x2)/2,h+0.2,z1+passo*0.45);
  tel.rotation.x=-0.06;
}
walls(-38,-27,20,13,3);   estrutura(-38,-27,20,13,10,8);
walls(28,-27,63,-9,3);    estrutura(28,-27,63,-9,14,7);
walls(28,3,63,25,3);      estrutura(28,3,63,25,9,7);

/* pisos das etapas */
const patches = [];
const smokeEmitters = [];
const belts = [];
const CASA = {};
ST.forEach(st=>{
  const a = AREAS[st.area];
  const Y=st.y||0;
  const p = M(new THREE.BoxGeometry(st.w,0.05,st.d), mat(st.area==='colheita'?0xc9b98f:0xeceae3,0.95), st.x, Y+0.025, st.z);
  p.castShadow=false; p.userData.st = st; patches.push(p);
  const t=0.18, c=mat(a.cor,0.6);
  [[st.w,t,st.x,st.z-st.d/2],[st.w,t,st.x,st.z+st.d/2],[t,st.d,st.x-st.w/2,st.z],[t,st.d,st.x+st.w/2,st.z]]
    .forEach(([w,d,x,z])=>{ const m=B(w,0.07,d,c,x,Y,z); m.castShadow=false; (st.bordas=st.bordas||[]).push(m); });
  st.group = new THREE.Group(); scene.add(st.group); st.items=[];
  equip(st);
});

function vaporDe(x,y,z,o){ smokeEmitters.push(Object.assign({origin:new THREE.Vector3(x,y,z),count:12,rise:5,drift:3,size:1.8,rate:0.35,op:0.4,color:0xf3f4f2},o||{})); }
function tanque(r,h,matTanque,x,y,z){
  Cy(r,r,h,matTanque,x,y,z,28);
  M(new THREE.SphereGeometry(r,24,10,0,Math.PI*2,0,Math.PI/2),matTanque,x,y+h,z);
  for(let k=1;k<4;k++) Cy(r+0.04,r+0.04,0.08,MT.aco,x,y+h*k/4,z,28).castShadow=false;
}
function escada(x,z,h){ B(0.08,h,0.6,MT.amarelo,x,0,z); for(let y=0.5;y<h;y+=0.5) B(0.1,0.05,0.6,MT.amarelo,x,y,z).castShadow=false; }

/* ---------- Equipamentos ---------- */
function equip(st){
  const cx = st.x, bz = st.z - st.d*0.24;
  switch(st.id){
    case 'balanca':
      B(4.4,0.25,10,MT.aco,-62,0,14);
      B(2.2,2.7,2.2,MT.branco,-57.5,0,10); B(2.25,0.8,2.25,MT.vidro,-57.5,1.4,10); B(2.6,0.25,2.6,MT.azul,-57.5,2.7,10);
      Cy(0.1,0.1,1.2,MT.estrut,-59.6,0,20,8); B(0.12,0.12,4.6,mat(0xd1453b,0.5),-59.6,1.2,22.2);
      B(6,2.6,2.8,MT.branco,cx-2,0,bz); B(6.02,0.9,2.82,MT.vidro,cx-2,1.2,bz); B(6.4,0.25,3.2,MT.azul,cx-2,2.6,bz);
      break;
    case 'laboratorio':
      B(8,3,3.2,MT.branco,cx,0,bz); B(8.05,0.9,3.25,MT.vidro,cx,1.3,bz); B(8.4,0.25,3.6,MT.azul,cx,3,bz);
      B(1.2,0.8,1,MT.aco,cx+2.5,3.25,bz);
      B(0.5,7,0.5,MT.amarelo,-66,0,2); B(0.5,7,0.5,MT.amarelo,-58,0,2);
      B(8.6,0.6,0.6,MT.amarelo,-62,6.6,2); B(1,0.8,0.8,MT.estrut,-62,6,2); B(0.3,3,0.3,MT.aco,-62,3,2);
      break;
    case 'hilo': {
      /* casa de cana: galpão com telhado translúcido */
      const X1=-69, X2=-40, Z1=-24, Z2=-6, H=11, COLS=[-69,-58,-49,-40];
      COLS.forEach(x=>[Z1,Z2].forEach(z=>B(0.55,H,0.55,MT.estrut,x,0,z)));
      [Z1,Z2].forEach(z=>B(X2-X1+0.6,0.6,0.6,MT.estrut,(X1+X2)/2,H-0.6,z));
      COLS.forEach(x=>{
        const a=M(new THREE.BoxGeometry(0.35,0.4,9.8),MT.estrut,x,H+1.1,Z1+4.5); a.rotation.x=-0.36;
        const b=M(new THREE.BoxGeometry(0.35,0.4,9.8),MT.estrut,x,H+1.1,Z2-4.5); b.rotation.x=0.36;
      });
      const telhaMat=new THREE.MeshStandardMaterial({color:lin(0xdfe4e6),transparent:true,opacity:0.16,roughness:0.3,metalness:0.2,side:THREE.DoubleSide,depthWrite:false});
      const t1=new THREE.Mesh(new THREE.PlaneGeometry(X2-X1+1,9.8),telhaMat); t1.rotation.x=-Math.PI/2+0.36; t1.position.set((X1+X2)/2,H+1.15,Z1+4.5); scene.add(t1);
      const t2=new THREE.Mesh(new THREE.PlaneGeometry(X2-X1+1,9.8),telhaMat); t2.rotation.x=-Math.PI/2-0.36; t2.position.set((X1+X2)/2,H+1.15,Z2-4.5); scene.add(t2);
      B(X2-X1+0.6,0.3,0.4,MT.estrut,(X1+X2)/2,H+2.6,(Z1+Z2)/2);
      B(0.4,2,Z2-Z1-1,MT.parede,X2,0,(Z1+Z2)/2);
      /* hilo: pórtico que tomba a cana do caminhão para o estoque */
      [[-67.2,-17.5],[-67.2,-10.5],[-57,-17.5],[-57,-10.5]].forEach(([x,z])=>B(0.6,8.2,0.6,MT.azul,x,0,z));
      B(11,0.7,0.6,MT.azul,-62.1,7.7,-17.5); B(11,0.7,0.6,MT.azul,-62.1,7.7,-10.5);
      B(1.8,1,7.6,MT.amarelo,-62,7.1,-14); B(0.12,3,0.12,MT.aco,-62.5,4.1,-14); B(0.12,3,0.12,MT.aco,-61.5,4.1,-14);
      B(3,0.3,3,MT.estrut,-62,3.8,-14);
      /* estoque de cana (cresce e diminui com o volume) */
      const pilha=M(new THREE.SphereGeometry(1,28,12,0,Math.PI*2,0,Math.PI/2),texMat(TX.cana,[5,2],1),-52.5,0,-15);
      pilha.scale.set(5.2,3.2,7.6); CASA.pilha=pilha;
      /* mesa alimentadora */
      const mesa=M(new THREE.BoxGeometry(4.4,0.35,4.2),MT.aco,-45.6,1.5,-21); mesa.rotation.z=-0.22;
      const mesaCana=M(new THREE.BoxGeometry(3.8,0.5,3.6),MT.cana,-45.6,1.9,-21); mesaCana.rotation.z=-0.22; CASA.mesaCana=mesaCana;
      [[-47.5,-22.8],[-47.5,-19.2],[-43.8,-22.8],[-43.8,-19.2]].forEach(([x,z])=>B(0.3,x<-46?1.8:1.0,0.3,MT.estrut,x,0,z));
      /* esteira de cana inclinada até a moenda */
      const A=new THREE.Vector3(-43.4,1.4,-21), Bf=new THREE.Vector3(-34.6,5.0,-21);
      const L=A.distanceTo(Bf), ang=Math.atan2(Bf.y-A.y,Bf.x-A.x), mid=A.clone().add(Bf).multiplyScalar(0.5);
      const est=M(new THREE.BoxGeometry(L,0.4,2),MT.estrut,mid.x,mid.y,mid.z); est.rotation.z=ang;
      const lona=M(new THREE.BoxGeometry(L,0.08,1.6),mat(0x2a2d2f,0.9),mid.x,mid.y+0.24,mid.z); lona.rotation.z=ang;
      [-1,1].forEach(sd=>{ const g=M(new THREE.BoxGeometry(L,0.6,0.08),MT.amarelo,mid.x,mid.y+0.5,mid.z+sd*0.95); g.rotation.z=ang; });
      [0.2,0.55,0.85].forEach(k=>{ const p=A.clone().lerp(Bf,k); B(0.3,p.y-0.2,1.6,MT.estrut,p.x,0,-21); });
      const dir=Bf.clone().sub(A).normalize(), up=new THREE.Vector3(-dir.y,dir.x,0).multiplyScalar(0.45);
      for(let i=0;i<7;i++){ const m=B(1.1,0.4,1.2,MT.cana,A.x,A.y,A.z); m.rotation.z=ang; belts.push({mesh:m, from:A.clone().add(up), to:Bf.clone().add(up), t:i/7, speed:0.12}); }
      /* garra: ponte rolante com garra hidráulica */
      [Z1,Z2].forEach(z=>B(28,0.5,0.5,MT.amarelo,-54.5,9.3,z));
      const ponte=new THREE.Group(); scene.add(ponte);
      B(1.2,0.9,18.4,MT.amarelo,0,0,0,ponte); ponte.position.set(-52,8.9,-15);
      const carro=new THREE.Group(); ponte.add(carro);
      B(2.2,0.9,2.2,mat(0xd1453b,0.5,0.3),0,-0.9,0,carro);
      const cabo=B(0.12,1,0.12,MT.aco,0,0,0,carro); 
      const garra=new THREE.Group(); scene.add(garra);
      B(1.4,0.8,1.4,MT.estrut,0,0,0,garra);
      const dedos=[];
      [0,1,2,3].forEach(k=>{
        const pv=new THREE.Group(); pv.rotation.y=k*Math.PI/2; garra.add(pv);
        const h=new THREE.Group(); h.position.set(0,0,0.6); pv.add(h);
        B(0.25,1.8,0.35,MT.estrut,0,-1.6,0.2,h); dedos.push(h);
      });
      const feixe=B(1.4,0.9,1.4,MT.cana,0,-1.8,0,garra); feixe.visible=false;
      Object.assign(CASA,{ponte,carro,cabo,garra,dedos,feixe,fase:0,t:0,x:-46,z:-21,y:7,ox:-46,oz:-21,ab:1});
      break;
    }
    case 'moenda':
      B(13,0.5,4,MT.concreto,cx,0,bz);
      for(let i=0;i<5;i++){
        const x = cx-5+i*2.5;
        B(1.9,1.9,3,mat(0x4f6b4a,0.55,0.4),x,0.5,bz);
        [[0,3.2],[0.55,2.75],[-0.55,2.75]].forEach(([dx,y])=>M(new THREE.CylinderGeometry(0.5,0.5,3.2,20),MT.aco,x+dx,y,bz).rotation.x=Math.PI/2);
        Cy(0.45,0.45,0.6,MT.estrut,x,3.6,bz+1.2,12);
      }
      B(13,0.3,0.7,MT.amarelo,cx,0.5,bz+2.1);
      break;
    case 'tratamento':
      [cx-3.8,cx-0.2].forEach(x=>{ tanque(1.5,3.4,MT.inox,x,0,bz); });
      Cy(2.1,2.1,1.6,MT.aco,cx+4,0,bz,32); Cy(1.9,1.9,0.05,mat(0x9a7b3c,0.2,0),cx+4,1.62,bz,32);
      escada(cx-2,bz+1.6,3.4);
      break;
    case 'evaporacao':
      B(13,0.4,3.2,MT.estrut,cx,4.2,bz);
      for(let i=0;i<5;i++){ const x=cx-5+i*2.5; tanque(0.95,5.4,MT.inox,x,0,bz); }
      vaporDe(cx+5,7.4,bz,{count:10,rise:5,drift:2.5,size:1.6,rate:0.4,op:0.32});
      break;
    case 'cozimento':
      B(13.6,0.4,3.2,MT.estrut,cx,1.6,bz);
      for(let i=0;i<4;i++){
        const x=cx-4.8+i*3.2;
        [-0.9,0.9].forEach(dx=>B(0.25,1.6,0.25,MT.estrut,x+dx,0,bz));
        tanque(1.2,4.3,MT.inox,x,2,bz);
        M(new THREE.ConeGeometry(1.2,1,24),MT.aco,x,1.5,bz).rotation.x=Math.PI;
      }
      break;
    case 'centrifugacao':
      B(12.8,1.4,3.2,MT.estrut,cx,0,bz); B(12.8,0.1,3.2,mat(0x6b7780,0.5,0.6),cx,1.4,bz);
      for(let i=0;i<6;i++){ const x=cx-5+i*2; Cy(0.75,0.6,1.3,MT.inox,x,1.5,bz,24); Cy(0.25,0.25,0.9,MT.azul,x,2.8,bz,12); }
      break;
    case 'secagem':
      [cx-4,cx+4].forEach(x=>B(1.2,1.4,2.2,MT.concreto,x,0,bz));
      M(new THREE.CylinderGeometry(1.35,1.35,10.5,28),MT.aco,cx,2.75,bz).rotation.z=Math.PI/2;
      [cx-3.6,cx,cx+3.6].forEach(x=>M(new THREE.CylinderGeometry(1.45,1.45,0.35,28),MT.estrut,x,2.75,bz).rotation.z=Math.PI/2);
      Cy(0.4,0.4,3,MT.aco,cx+4.8,3.5,bz,12);
      break;
    case 'caldeira':
      B(8.4,7,3.8,mat(0x8f5a46,0.8),cx-2,0,bz); B(8.5,0.4,3.9,MT.estrut,cx-2,7,bz);
      for(let y=1.5;y<7;y+=1.8) B(8.45,0.12,3.85,mat(0x6e4535,0.8),cx-2,y,bz).castShadow=false;
      Cy(0.85,1.2,18,mat(0xa5a9ab,0.6,0.3),cx+4.6,0,bz,20);
      Cy(0.88,0.88,1.1,mat(0xd1453b,0.5),cx+4.6,15.2,bz,20); Cy(0.88,0.88,1.1,MT.branco,cx+4.6,16.3,bz,20);
      vaporDe(cx+4.6,18.4,bz,{count:26,rise:13,drift:7,size:3.2,rate:0.17,op:0.55,color:0xd2d4d1});
      break;
    case 'cogeracao':
      B(6.4,0.5,3,MT.concreto,cx-3,0,bz);
      B(5,2.2,2.4,mat(0x2f6f9f,0.4,0.45),cx-3.6,0.5,bz);
      M(new THREE.CylinderGeometry(1,1,2.6,24),MT.aco,cx-0.2,1.6,bz).rotation.z=Math.PI/2;
      [[cx+3.6,bz-0.6],[cx+3.6,bz+1.4]].forEach(([x,z])=>{ B(1.6,2,1.4,mat(0x6f7c86,0.6,0.4),x,0,z); for(let k=0;k<3;k++) Cy(0.08,0.12,0.8,mat(0xc9a35b,0.6),x-0.4+k*0.4,2,z,8); });
      /* torres de resfriamento */
      [[6,-38],[13,-38]].forEach(([x,z])=>{
        M(new THREE.CylinderGeometry(2.2,3.2,6,28,1,true),mat(0xc9c6bd,0.9),x,3,z).material.side=THREE.DoubleSide;
        vaporDe(x,6.2,z,{count:14,rise:6,drift:3,size:2.6,rate:0.28,op:0.42});
      });
      break;
    case 'fermentacao':
      B(14,0.4,4,MT.concreto,cx,0,bz);
      for(let i=0;i<4;i++) tanque(1.55,5,MT.branco,cx-5.1+i*3.4,0.4,bz);
      B(13.6,0.25,1,MT.amarelo,cx,5.9,bz+1.3);
      break;
    case 'destilacao':
      [-3,0,3].forEach((o,i)=>{ Cy(0.62,0.62,12-i*1.5,MT.inox,cx+o,0,bz,20); M(new THREE.SphereGeometry(0.62,16,8,0,Math.PI*2,0,Math.PI/2),MT.inox,cx+o,12-i*1.5,bz); });
      [4,8].forEach(y=>{ B(8.4,0.18,2.4,mat(0x6b7780,0.5,0.6),cx,y,bz); B(8.4,0.6,0.06,MT.amarelo,cx,y+0.2,bz+1.2).castShadow=false; });
      escada(cx+4.3,bz,8);
      break;
    case 'tanques':
      B(28,0.6,0.6,MT.concreto,cx,0,bz+3.6);
      [-9.6,-3.2,3.2,9.6].forEach(o=>{ Cy(2.45,2.45,4.4,MT.branco,cx+o,0,bz,32); M(new THREE.ConeGeometry(2.5,0.7,32),mat(0xdedfdb,0.5,0.1),cx+o,4.75,bz); Cy(2.47,2.47,0.35,mat(0x2f6f9f,0.5),cx+o,3.2,bz,32).castShadow=false; });
      break;
    case 'armazem':
      M(new THREE.ConeGeometry(4.4,3.6,24),MT.acucar,cx,1.8,bz);
      B(0.7,0.4,8,MT.estrut,cx,5.4,bz+1.5); B(0.3,5.4,0.3,MT.estrut,cx,0,bz+5);
      break;
    case 'ensaque':
      B(3,2.8,2.2,MT.azul,cx-3.4,0,bz); B(1.2,1.2,1,MT.aco,cx-3.4,2.8,bz);
      B(5.4,0.3,1.2,MT.estrut,cx+1,0.9,bz); B(5.4,0.08,1,mat(0x2a2d2f,0.9),cx+1,1.2,bz);
      for(let i=0;i<4;i++) belts.push({mesh:B(0.9,0.35,0.6,mat(0xefe6cc,0.95),cx-1.4,1.28,bz), from:new THREE.Vector3(cx-1.4,1.45,bz), to:new THREE.Vector3(cx+3.4,1.45,bz), t:i/4, speed:0.22});
      for(let l=0;l<3;l++) for(let k=0;k<3;k++) B(0.9,0.42,0.6,mat(0xefe6cc,0.95),cx+4.6,l*0.42,bz-0.8+k*0.65);
      break;
    case 'oficina': {
      /* galpão da oficina: baias, valas, bancadas e telhado translúcido */
      const X1=74, X2=110, Z1=6, Z2=17, Hh=6.5;
      const piso=M(new THREE.BoxGeometry(X2-X1,0.05,Z2-Z1),mat(0x8d9890,0.55,0.05),(X1+X2)/2,0.025,(Z1+Z2)/2); piso.castShadow=false;
      B(X2-X1,4.2,0.5,MT.parede,(X1+X2)/2,0,Z1+0.25); B(0.5,4.2,Z2-Z1,MT.parede,X1,0,(Z1+Z2)/2); B(0.5,4.2,Z2-Z1,MT.parede,X2,0,(Z1+Z2)/2);
      for(let x=X1;x<=X2+0.01;x+=6){ B(0.4,Hh,0.4,MT.estrut,x,0,Z2); B(0.4,Hh+0.8,0.4,MT.estrut,x,0,Z1+0.5); const v=M(new THREE.BoxGeometry(0.3,0.35,Z2-Z1),MT.estrut,x,Hh+0.4,(Z1+Z2)/2); v.rotation.x=0.07; }
      B(X2-X1+0.4,0.45,0.4,MT.amarelo,(X1+X2)/2,Hh-0.45,Z2);
      const tel=new THREE.Mesh(new THREE.PlaneGeometry(X2-X1+1,Z2-Z1+0.6),new THREE.MeshStandardMaterial({color:lin(0xdfe4e6),transparent:true,opacity:0.16,roughness:0.3,metalness:0.2,side:THREE.DoubleSide,depthWrite:false}));
      tel.rotation.x=-Math.PI/2+0.07; tel.position.set((X1+X2)/2,Hh+0.65,(Z1+Z2)/2); scene.add(tel);
      for(let x=X1+6;x<X2;x+=6) B(0.12,0.06,Z2-Z1-1,MT.amarelo,x,0.03,(Z1+Z2)/2+0.4).castShadow=false;
      [77,83].forEach(x=>B(1.3,0.06,6.5,mat(0x1d2124,0.9),x,0.03,12).castShadow=false);
      for(let x=X1+1.5;x<X2-1;x+=6){ B(2.2,0.95,0.8,mat(0x6b7780,0.5,0.5),x+1.2,0,Z1+1); B(0.9,1.4,0.6,mat(0xc23a31,0.45,0.3),x+3.6,0,Z1+0.9); }
      [0,0.45,0.9,1.35].forEach((y,i)=>{ const p=M(new THREE.TorusGeometry(0.55,0.22,8,16),MT.pneu,108.8,0.22+y,7.6+(i%2)*0.1); p.rotation.x=Math.PI/2; });
      Cy(0.45,0.45,1.3,mat(0x2f6f9f,0.5,0.3),109.2,0,15.8,14);
      /* placa da oficina */
      const cv=document.createElement('canvas'); cv.width=512; cv.height=96; const g2=cv.getContext('2d');
      g2.fillStyle='#24332a'; g2.fillRect(0,0,512,96); g2.fillStyle='#f3f6f1'; g2.font='700 58px "Barlow Condensed", "Arial Narrow", sans-serif'; g2.textBaseline='middle'; g2.fillText('Oficina automotiva',24,50);
      const tx=new THREE.CanvasTexture(cv); tx.encoding=THREE.sRGBEncoding;
      const pl=new THREE.Mesh(new THREE.PlaneGeometry(9,1.7),new THREE.MeshStandardMaterial({map:tx,roughness:0.6})); pl.position.set((X1+X2)/2,Hh+0.35,Z2+0.22); scene.add(pl);
      break;
    }
    case 'carregamento':
      B(10.5,1.2,2.4,MT.concreto,cx,0,bz);
      [-3,0,3].forEach(o=>B(2.4,0.1,0.3,MT.amarelo,cx+o,1.2,bz+1.1).castShadow=false);
      break;
  }
}

/* tubulações aéreas com suportes */
function pipe(pts, y, m, r){
  r = r||0.45;
  for(let i=0;i<pts.length-1;i++){
    const [ax,az]=pts[i],[bx,bz]=pts[i+1];
    const L=Math.abs(bx-ax)+Math.abs(bz-az);
    const p=M(new THREE.CylinderGeometry(r/2,r/2,L+r,14),m,(ax+bx)/2,y,(az+bz)/2);
    if(ax!==bx) p.rotation.z=Math.PI/2; else p.rotation.x=Math.PI/2;
  }
  pts.forEach(([x,z])=>{ B(0.3,y-0.3,0.3,MT.estrut,x,0,z); M(new THREE.SphereGeometry(r/2*1.15,12,8),m,x,y,z); });
}
pipe([[-29,-22],[-9,-22],[11,-22],[16,-22],[16,2],[11,2],[-9,2],[-29,2]], 5.6, MT.amarelo);
pipe([[-29,9],[24,9],[24,12],[33,12]], 5.6, MT.amarelo);
pipe([[-9,-25],[24,-25],[24,-21],[31,-21]], 4.6, mat(0x4f8fc4,0.4,0.4), 0.4);
pipe([[55,-24],[55,-30],[46,-30],[46,-34]], 3.4, mat(0x4f8fc4,0.4,0.4), 0.4);
/* esteira de bagaço até a caldeira */
B(1.6,0.3,9,MT.estrut,-33,2.2,-29.5); B(1.3,0.15,9,MT.bagaco,-33,2.5,-29.5);
[-26,-33].forEach(z=>B(0.3,2.2,1.4,MT.estrut,-33,0,z));
