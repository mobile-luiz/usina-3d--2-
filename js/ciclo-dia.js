/* Usina em 3D: Ciclo de dia e noite pela hora real (sol, lua, céu, neblina, janelas e postes acesos à noite). */
"use strict";

/* Nascer e pôr do sol aproximados para o Agreste/Zona da Mata (ajuste se a usina for em outra região) */
const LUZ = { nasce: 5.3, poe: 17.6, modo: 'auto' };   /* modo: auto | dia | tarde | noite */
const MODOS_LUZ = { auto:'Luz automática', dia:'Luz de dia', tarde:'Luz de fim de tarde', noite:'Luz de noite' };
const HORA_FIXA = { dia: 10.5, tarde: 17.2, noite: 21.5 };

const hemiLuz = scene.children.find(o => o.isHemisphereLight);
const SOL_AZ0 = Math.atan2(70, 55);                    /* mesma direção do sol original ao meio-dia */
const corSolDia = lin(0xffeccc), corSolBaixo = lin(0xff9a55), corLua = lin(0x9db4e0);
const nevDia = lin(HORIZ), nevNoite = lin(0x1a2230);
const ceuHemi = lin(0xd6e6ff), ceuHemiNoite = lin(0x31406a), chaoHemi = lin(0x7a6c4e), chaoHemiNoite = lin(0x1c1a16);
const janelaAcesa = lin(0xffc46e);
const vtSol = new THREE.Vector3();
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* torres de iluminação nas áreas da usina: só acendem à noite */
const POSTES_LUZ = [];
(function torresDeLuz(){
  const pos = [[-60,10],[-38,-8],[-9,-6],[20,-8],[-30,-46],[38,-30],[60,-6],[46,28],[96,20],[-66,-30]];
  const metal = mat(0x55626c, 0.55, 0.6);
  const lampMat = new THREE.MeshStandardMaterial({ color: lin(0xfff3d6), emissive: lin(0xffe2a8), emissiveIntensity: 0, roughness: 0.4 });
  const halo = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,'rgba(255,230,170,1)'); gr.addColorStop(0.35,'rgba(255,210,140,.45)'); gr.addColorStop(1,'rgba(255,200,120,0)'); g.fillStyle = gr; g.fillRect(0,0,w,h); });
  pos.forEach(([x, z], i) => {
    const y = 0;
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 16, 6), metal); poste.position.set(x, y + 8, z); scene.add(poste);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.9), lampMat); cab.position.set(x, y + 16.1, z); cab.userData.noAO = true; scene.add(cab);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending, fog: true }));
    sp.scale.set(9, 9, 1); sp.position.set(x, y + 16, z); scene.add(sp);
    /* só metade das torres tem luz de verdade: cada luz pesa no desempenho */
    let luz = null;
    if(i % 2 === 0){ luz = new THREE.PointLight(lin(0xffd59a), 0, 70, 1.6); luz.position.set(x, y + 15, z); scene.add(luz); }
    POSTES_LUZ.push({ luz, sp });
  });
  POSTES_LUZ.mat = lampMat;
})();

function horaDecimal(){
  const q = new URLSearchParams(location.search).get('hora');
  if(q !== null && !isNaN(+q)) return clamp(+q, 0, 23.99);
  if(LUZ.modo !== 'auto') return HORA_FIXA[LUZ.modo];
  const d = new Date(); return d.getHours() + d.getMinutes() / 60;
}

let ultimaLuz = null;
function aplicarLuz(forcar){
  const h = horaDecimal();
  if(!forcar && ultimaLuz !== null && Math.abs(h - ultimaLuz) < 0.02) { ajustarEnv(); return; }
  ultimaLuz = h;

  /* posição do sol: sobe a leste, desce a oeste */
  const k = (h - LUZ.nasce) / (LUZ.poe - LUZ.nasce);          /* 0 no nascer, 1 no pôr */
  const elev = Math.sin(clamp(k, -0.25, 1.25) * Math.PI) * 1.05; /* rad, negativo à noite */
  const az = SOL_AZ0 + (k - 0.5) * 2.4;
  vtSol.set(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev)).normalize();
  const sEl = vtSol.y;
  const dia = sstep(-0.04, 0.28, sEl);          /* 0 noite, 1 dia pleno */
  const noite = 1 - sstep(-0.18, 0.02, sEl);    /* 1 noite fechada */
  const baixo = 1 - sstep(0.02, 0.45, sEl);     /* sol perto do horizonte: luz alaranjada */

  const dourado = baixo * sstep(-0.03, 0.06, sEl);            /* hora dourada: sol baixo mas acima do horizonte */
  const forcaSol = 2.25 * dia + 0.9 * dourado, forcaLua = 0.38 * noite;
  if(forcaSol >= forcaLua){
    sun.position.copy(vtSol).multiplyScalar(150);
    sun.color.copy(corSolDia).lerp(corSolBaixo, baixo * 0.9);
    sun.intensity = Math.max(forcaSol, 0.05);
  }else{
    sun.position.set(-60, 120, -40);
    sun.color.copy(corLua);
    sun.intensity = forcaLua;
  }
  if(hemiLuz){
    hemiLuz.intensity = 0.12 + 0.23 * dia;
    hemiLuz.color.copy(ceuHemiNoite).lerp(ceuHemi, dia).lerp(corSolBaixo, dourado * 0.35);
    hemiLuz.groundColor.copy(chaoHemiNoite).lerp(chaoHemi, dia);
  }
  if(skyMesh){
    const u = skyMesh.material.uniforms;
    u.sunPosition.value.copy(vtSol);
    u.turbidity.value = 4.5 + baixo * 3;
    u.rayleigh.value = 1.9 + baixo * 1.2;
  }
  if(scene.fog){ scene.fog.color.copy(nevNoite).lerp(nevDia, Math.max(dia, dourado * 0.8)).lerp(corSolBaixo, dourado * 0.3); }
  renderer.toneMappingExposure = 1.0 + noite * 0.15;

  /* nuvens escurecem à noite */
  const nv = Math.max(dia, dourado * 0.8);
  NUVENS.forEach(n => n.material.color.setRGB(0.18 + 0.82 * nv, (0.2 + 0.8 * nv) * (1 - dourado * 0.12), (0.26 + 0.74 * nv) * (1 - dourado * 0.25)));

  /* janelas, faróis, cubos de status e torres de luz */
  MT.vidro.emissive.copy(janelaAcesa); MT.vidro.emissiveIntensity = 0.55 * noite;
  MT.farol.emissiveIntensity = 0.6 + 2.4 * noite;
  Object.values(COL).forEach(c => { const m = mat(c); m.emissive.setHex(c).convertSRGBToLinear(); m.emissiveIntensity = 0.45 * noite; });
  POSTES_LUZ.forEach(p => { if(p.luz) p.luz.intensity = 1.8 * noite; p.sp.material.opacity = 0.9 * noite; });
  POSTES_LUZ.mat.emissiveIntensity = 2.2 * noite;

  LUZ.dia = dia; LUZ.noite = noite; LUZ.dourado = dourado;
  ajustarEnv(true);
  document.body.dataset.luz = noite > 0.6 ? 'noite' : baixo > 0.5 && dia > 0.1 ? 'tarde' : 'dia';
}

/* os reflexos do ambiente vêm de um céu de dia: à noite eles precisam apagar */
function ajustarEnv(todos){
  const f = 0.12 + 0.88 * Math.max(LUZ.dia ?? 1, (LUZ.dourado ?? 0) * 0.7);
  scene.traverse(o => {
    if(!o.isMesh && !o.isInstancedMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    ms.forEach(m => {
      if(!m || m.envMapIntensity === undefined) return;
      if(m.userData.envBase === undefined) m.userData.envBase = m.envMapIntensity;
      else if(!todos) return;
      m.envMapIntensity = m.userData.envBase * f;
    });
  });
}

function setLuz(modo){
  LUZ.modo = MODOS_LUZ[modo] ? modo : 'auto';
  const b = document.getElementById('btnLuz'); if(b) b.lastChild.textContent = MODOS_LUZ[LUZ.modo];
  try{ localStorage.setItem('usina-luz', LUZ.modo); }catch(_){}
  aplicarLuz(true);
}
(function iniciarLuz(){
  let m = 'auto'; try{ m = localStorage.getItem('usina-luz') || 'auto'; }catch(_){}
  setLuz(m);
  const ordem = Object.keys(MODOS_LUZ);
  const b = document.getElementById('btnLuz');
  if(b) b.addEventListener('click', () => setLuz(ordem[(ordem.indexOf(LUZ.modo) + 1) % ordem.length]));
  setInterval(() => aplicarLuz(false), 20000);
})();
