import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {initAudio,sfx,engine,music,tickMusic,setMuted,suspend,setIntensity} from './audio.js';
import {showAd,setHooks} from './sdk.js';
const $=id=>document.getElementById(id);
// ---------- save ----------
const DEF={coins:0,best:0,ups:{engine:0,armor:0,gun:0,fuel:0,ram:0},owned:[0],sel:0,tut:0,snd:1,runs:0};
let S; try{S=Object.assign({},DEF,JSON.parse(localStorage.getItem('zrr3d')||'{}'));S.ups=Object.assign({},DEF.ups,S.ups);}catch(e){S=structuredClone(DEF);}
const save=()=>{try{localStorage.setItem('zrr3d',JSON.stringify(S));}catch(e){}};
const TRUCKS=[{name:'RUSTY',cost:0,color:0xffffff,hp:1,gun:1,spd:1,desc:'Balanced'},{name:'DOZER',cost:1500,color:0xf0b020,hp:1.5,gun:0.9,spd:0.92,desc:'+50% armor'},{name:'HELLFIRE',cost:4500,color:0xffa040,hp:1.1,gun:1.6,spd:1.08,desc:'+60% fire rate, fast'}];
const UPS=[['engine','ENGINE','Top speed',60],['armor','ARMOR','Max armor',70],['gun','GUN','Fire rate & dmg',80],['fuel','FUEL TANK','Longer runs',50],['ram','RAM PLOW','Crash damage ↓',90]];
const MAXL=8, upCost=(b,l)=>Math.round(b*Math.pow(l+1,1.7)/5)*5;
// ---------- renderer ----------
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.max(1,Math.min(window.devicePixelRatio||1,2))); // never below native 1.0
renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene(); const SKY=new THREE.Color(0xf2a35e); scene.background=SKY; scene.fog=new THREE.Fog(0xe8955a,45,150);
const cam=new THREE.PerspectiveCamera(60,1,0.5,220);
const hemi=new THREE.HemisphereLight(0xffe2c0,0x4a3320,1.5);scene.add(hemi);
function rnd0(a,b){return a+Math.random()*(b-a);}
const sun=new THREE.DirectionalLight(0xffd0a0,2.2); sun.position.set(-20,30,10); scene.add(sun);
// sky dome w/ sun
{const g=new THREE.SphereGeometry(200,24,12),c=[],p=g.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i)/200,col=new THREE.Color().lerpColors(new THREE.Color(0xf6b46c),new THREE.Color(0x5a3d7a),Math.max(0,y)*1.6);c.push(col.r,col.g,col.b);}g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
 const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false}));m.userData.g=g;m.renderOrder=-1;scene.add(m);var skyM=m;
 const sd=new THREE.Mesh(new THREE.CircleGeometry(14,32),new THREE.MeshBasicMaterial({color:0xfff0b0,fog:false}));sd.position.set(0,28,-190);m.add(sd);var sunDisc=sd;
 const GT0=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(.35,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})();
 const halo=new THREE.Mesh(new THREE.PlaneGeometry(90,90),new THREE.MeshBasicMaterial({map:GT0,color:0xffc070,transparent:true,opacity:.6,fog:false,depthWrite:false,blending:THREE.AdditiveBlending}));halo.position.set(0,28,-191);m.add(halo);var sunHalo=halo;
 const sp=[];for(let i=0;i<500;i++){const a=Math.random()*6.283,e=rnd0(.12,1.4);sp.push(Math.cos(a)*Math.cos(e)*190,Math.sin(e)*190,Math.sin(a)*Math.cos(e)*190);}const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));var starMat=new THREE.PointsMaterial({color:0xffffff,size:1.6,sizeAttenuation:false,transparent:true,opacity:0,fog:false,depthWrite:false});m.add(new THREE.Points(sg,starMat));}
const BIOMES=[{n:'DESERT HIGHWAY',sky:0xf2a35e,fog:0xe8955a,dirt:0xffffff,hemi:0xffe2c0,top:0x5a3d7a,bot:0xf6b46c,si:2.2,hi:1.5,disc:0xfff0b0,night:0,sun:0xffd0a0},{n:'TOXIC NIGHT',sky:0x16202e,fog:0x1c2a33,dirt:0x6f8078,hemi:0x8fb4ff,top:0x04060f,bot:0x24463e,si:.55,hi:.85,disc:0xdff4ff,night:1,sun:0x9ab8ff},{n:'BLOOD MOON',sky:0x5a1c1c,fog:0x4e1d1b,dirt:0xa06a5e,hemi:0xffa090,top:0x0e0205,bot:0x9a3322,si:.9,hi:1,disc:0xff3a2a,night:.75,sun:0xff8a70},{n:'FROZEN PASS',sky:0xbcd4e6,fog:0xc8dbe8,dirt:0xe8f0ff,hemi:0xe0f0ff,top:0x5a7aa8,bot:0xe8f2ff,si:2,hi:1.6,disc:0xffffff,night:0,sun:0xfff4e8}];
let biome=0,biomeT=1,NIGHT=0;const bc={sky:new THREE.Color(),fog:new THREE.Color()};
// ---------- helpers ----------
const rnd=(a,b)=>a+Math.random()*(b-a), clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function boxG(w,h,d,col,x=0,y=0,z=0){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);const c=new THREE.Color(col),a=[];for(let i=0;i<g.attributes.position.count;i++)a.push(c.r,c.g,c.b);g.setAttribute('color',new THREE.Float32BufferAttribute(a,3));g.deleteAttribute('uv');return g;}
function colG(g,col){g=g.toNonIndexed?g:g;const c=new THREE.Color(col),a=[];for(let i=0;i<g.attributes.position.count;i++)a.push(c.r,c.g,c.b);g.setAttribute('color',new THREE.Float32BufferAttribute(a,3));if(g.attributes.uv)g.deleteAttribute('uv');return g;}
const VC=new THREE.MeshLambertMaterial({vertexColors:true});
function blobTex(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),gr=x.createRadialGradient(32,32,2,32,32,32);gr.addColorStop(0,'rgba(0,0,0,.55)');gr.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gr;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
const blobMat=new THREE.MeshBasicMaterial({map:blobTex(),transparent:true,depthWrite:false});
// ---------- road ----------
const TILE=40,NT=6,ROADW=16,HALF=6.6;
function roadTex(){const c=document.createElement('canvas');c.width=256;c.height=512;const x=c.getContext('2d');x.fillStyle='#3b3a3c';x.fillRect(0,0,256,512);
 for(let i=0;i<5000;i++){x.fillStyle=`rgba(${Math.random()<.5?255:0},${Math.random()<.5?255:0},${Math.random()<.5?255:0},${Math.random()*.06})`;x.fillRect(Math.random()*256,Math.random()*512,2,2);}
 for(let i=0;i<14;i++){x.fillStyle='rgba(0,0,0,.18)';x.beginPath();x.ellipse(Math.random()*256,Math.random()*512,rnd(6,30),rnd(4,16),Math.random()*3,0,7);x.fill();}
 x.fillStyle='#e9e2c8';x.fillRect(6,0,6,512);x.fillRect(244,0,6,512);x.fillStyle='#f2c230';for(let y=0;y<512;y+=128){x.fillRect(84,y,5,70);x.fillRect(167,y,5,70);}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
function dirtTex(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#a8713f';x.fillRect(0,0,256,256);for(let i=0;i<4000;i++){const v=Math.random();x.fillStyle=v<.5?'rgba(90,55,25,.25)':'rgba(220,170,110,.2)';x.fillRect(Math.random()*256,Math.random()*256,rnd(1,4),rnd(1,4));}
 for(let i=0;i<60;i++){x.fillStyle='rgba(110,120,50,.35)';x.beginPath();x.arc(Math.random()*256,Math.random()*256,rnd(3,12),0,7);x.fill();}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(10,4);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
const roadMat=new THREE.MeshLambertMaterial({map:roadTex()}),dirtMat=new THREE.MeshLambertMaterial({map:dirtTex()});
const tiles=[];
for(let i=0;i<NT;i++){const g=new THREE.Group();const r=new THREE.Mesh(new THREE.PlaneGeometry(ROADW,TILE),roadMat);r.rotation.x=-Math.PI/2;g.add(r);
 const d=new THREE.Mesh(new THREE.PlaneGeometry(160,TILE),dirtMat);d.rotation.x=-Math.PI/2;d.position.y=-0.05;g.add(d);g.position.z=-i*TILE;scene.add(g);tiles.push(g);}
// roadside props: instanced, recycled
const PROPS=[];
function propKind(geo,count,mat=VC){const m=new THREE.InstancedMesh(geo,mat,count);m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.frustumCulled=false;scene.add(m);const k={m,count,items:[]};PROPS.push(k);return k;}
let roofMesh=null;
const treeG=mergeGeometries([boxG(.5,2,.5,0x6b4a2a,0,1,0),colG(new THREE.ConeGeometry(2,4,7).translate(0,4,0),0x5d7a2e),colG(new THREE.ConeGeometry(1.5,3,7).translate(0,5.6,0),0x6f8f36)]);
const deadTreeG=mergeGeometries([boxG(.4,4,.4,0x4a3526,0,2,0),boxG(2,.25,.25,0x4a3526,.6,3,0),boxG(.25,.25,1.6,0x4a3526,0,2.4,.5)]);
const poleG=mergeGeometries([boxG(.25,6,.25,0x555555,0,3,0),boxG(2.2,.2,.2,0x555555,-1,6,0),boxG(.6,.25,.4,0xfff2a0,-2,5.85,0)]);
const wreckG=mergeGeometries([boxG(2,1,4.2,0x7a5a4a,0,.7,0),boxG(1.8,.8,2.2,0x5a4038,0,1.5,-.3),boxG(1.7,.6,.1,0x203040,0,1.5,.82),...[[-1,1.3],[1,1.3],[-1,-1.3],[1,-1.3]].map(([x,z])=>boxG(.3,.8,.8,0x1a1a1a,x,.45,z))]);
function facade(base,cols,rows,w,h,lit){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=base;x.fillRect(0,0,w,h);
 for(let i=0;i<1500;i++){x.fillStyle=`rgba(0,0,0,${Math.random()*.08})`;x.fillRect(Math.random()*w,Math.random()*h,rnd(1,5),rnd(1,5));}
 const cw=w/cols,rh=h/rows;for(let r=0;r<rows;r++)for(let q=0;q<cols;q++){const L=Math.random();x.fillStyle=L<lit?'#ffb35a':(L<.75?'#1d2633':'#2c3a4a');x.fillRect(q*cw+cw*.2,r*rh+rh*.22,cw*.6,rh*.5);x.fillStyle='rgba(255,255,255,.12)';x.fillRect(q*cw+cw*.2,r*rh+rh*.22,cw*.6,2);
  if(L>.9){x.strokeStyle='#0008';x.beginPath();x.moveTo(q*cw+cw*.25,r*rh+rh*.3);x.lineTo(q*cw+cw*.7,r*rh+rh*.65);x.stroke();}}
 const g=x.createLinearGradient(0,h*.6,0,h);g.addColorStop(0,'rgba(60,40,20,0)');g.addColorStop(1,'rgba(60,40,20,.45)');x.fillStyle=g;x.fillRect(0,0,w,h);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return new THREE.MeshLambertMaterial({map:t});}
const towerTG=new THREE.BoxGeometry(7,14,7).translate(0,7,0),houseTG=new THREE.BoxGeometry(6,4,6).translate(0,2,0);
const roofG=mergeGeometries([colG(new THREE.ConeGeometry(4.8,2.2,4).rotateY(Math.PI/4).translate(0,5.1,0),0x7a3b2a)]);
const NI=a=>a.map(g=>g.index?g.toNonIndexed():g);
const cactusG=mergeGeometries(NI([colG(new THREE.CylinderGeometry(.45,.5,4.2,7).translate(0,2.1,0),0x4f7a35),colG(new THREE.CylinderGeometry(.28,.3,1.6,6).translate(-1,2.6,0),0x5a8a3c),boxG(.9,.35,.35,0x4f7a35,-.55,1.9,0),colG(new THREE.CylinderGeometry(.26,.28,1.3,6).translate(.95,3,0),0x5a8a3c),boxG(.8,.32,.32,0x4f7a35,.5,2.4,0),colG(new THREE.DodecahedronGeometry(1.6,0).scale(1.3,.8,1).translate(2.6,.6,.4),0xb07a4a),colG(new THREE.DodecahedronGeometry(.9,0).translate(-2.2,.4,-.6),0x9a6a40)]));
const rockG=mergeGeometries(NI([colG(new THREE.DodecahedronGeometry(3,0).scale(1.4,.9,1.1).translate(0,1.2,0),0x8f6a4c),colG(new THREE.DodecahedronGeometry(1.8,0).translate(3,.6,1),0x7a5a40)]));
const signG=mergeGeometries([boxG(.3,5,.3,0x444,-1.6,2.5,0),boxG(.3,5,.3,0x444,1.6,2.5,0),boxG(4.4,2,.25,0x1f6a3a,0,5,0),boxG(4,.18,.27,0xffffff,0,5.6,0),boxG(2.6,.18,.27,0xffffff,-.4,4.9,0),boxG(1.4,.18,.27,0xffffff,.8,4.3,0)]);
const gasG=mergeGeometries([boxG(6,4,5,0xcfc3a8,0,2,0),boxG(6.4,.5,5.4,0x8a3b2a,0,4.2,0),boxG(3.6,1.1,.2,0xf0e2c0,0,3.2,2.55),boxG(3.2,.6,.22,0x1f5a3a,0,3.2,2.6),boxG(1.2,2.2,.2,0x4a3a30,-1.6,1.1,2.55),boxG(1.6,1.2,.2,0x2a3a4a,1.4,1.6,2.55),boxG(7,.4,5,0xe8e0d0,6.5,4.6,1),boxG(7,.25,5.05,0xc03a2a,6.5,4.35,1),boxG(.5,4.4,.5,0x999,9.5,2.2,1),boxG(.8,1.6,.6,0xb03a2a,5,.8,1.8),boxG(.8,1.6,.6,0x3a7a5a,7.4,.8,1.8),boxG(14,.2,6,0x6a6a6a,4,.1,1.4)]);
const kinds={tower:propKind(towerTG,6,facade('#8d8a86',4,7,256,512,.12)),tower2:propKind(towerTG,4,facade('#a07760',4,7,256,512,.08)),house:propKind(houseTG,12,facade('#d9c29a',3,2,256,170,.15)),tree:propKind(treeG,30),dead:propKind(deadTreeG,16),pole:propKind(poleG,14),wreck:propKind(wreckG,10),cactus:propKind(cactusG,12),rock:propKind(rockG,8),sign:propKind(signG,2),gas:propKind(gasG,2)};
kinds.cactus.hide=()=>biome===1||biome===3;kinds.tree.hide=()=>biome===0&&Math.random()<.6;
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(1,1,1),_p=new THREE.Vector3(),_e=new THREE.Euler();
let propZ=20;
function placeProp(k,i,z){const side=Math.random()<.5?-1:1;let x;
 if(k===kinds.pole)x=side*(ROADW/2+.8);else if(k===kinds.sign)x=side*(ROADW/2+3);else if(k===kinds.gas)x=side*(ROADW/2+9);else if(k===kinds.wreck)x=side*rnd(ROADW/2+1.5,ROADW/2+4);else if(k===kinds.tower||k===kinds.tower2)x=side*rnd(ROADW/2+9,ROADW/2+35);else x=side*rnd(ROADW/2+5,ROADW/2+30);
 k.items[i]={x,z,ry:k===kinds.pole?(side>0?0:Math.PI):k===kinds.gas?(side>0?-Math.PI/2:Math.PI/2):k===kinds.sign?0:rnd(0,6.28),s:(k===kinds.tower||k===kinds.tower2)?rnd(.8,1.4):rnd(.8,1.2)};
 const it=k.items[i];_q.setFromEuler(_e.set(0,it.ry,0));_s.setScalar(it.s);_m.compose(_p.set(it.x,0,it.z),_q,_s);k.m.setMatrixAt(i,_m);k.m.instanceMatrix.needsUpdate=true;if(k===kinds.house&&roofMesh){roofMesh.setMatrixAt(i,_m);roofMesh.instanceMatrix.needsUpdate=true;}
 if(k===kinds.pole){_m2.copy(_m).multiply(_m3.makeTranslation(-2,5.6,0));glowMesh.setMatrixAt(i,_m2);_m2.copy(_m).multiply(_m3.makeTranslation(-2.2,.07,0));poolMesh.setMatrixAt(i,_m2);glowMesh.instanceMatrix.needsUpdate=poolMesh.instanceMatrix.needsUpdate=true;}
 if(k.hide&&k.hide()){_m.makeScale(0,0,0);k.m.setMatrixAt(i,_m);}}
function glowTex(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.3,'rgba(255,220,150,.55)');g.addColorStop(1,'rgba(255,200,120,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
const GT=glowTex();var glowMat=new THREE.MeshBasicMaterial({map:GT,color:0xffd890,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,fog:false});var poolMat=new THREE.MeshBasicMaterial({map:GT,color:0xffc070,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
const glowMesh=new THREE.InstancedMesh(new THREE.SphereGeometry(.55,8,6),glowMat,14),poolMesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(9,9).rotateX(-Math.PI/2),poolMat,14);for(const m of[glowMesh,poolMesh]){m.frustumCulled=false;scene.add(m);}
const _m2=new THREE.Matrix4(),_m3=new THREE.Matrix4();
roofMesh=new THREE.InstancedMesh(roofG,VC,12);roofMesh.frustumCulled=false;scene.add(roofMesh);
function initProps(){for(const k of PROPS)for(let i=0;i<k.count;i++)placeProp(k,i,rnd(-200,20));}
function updateProps(tz){for(const k of PROPS)for(let i=0;i<k.count;i++)if(k.items[i].z>tz+25)placeProp(k,i,tz-rnd(150,210));}
// ---------- models ----------
const loader=new GLTFLoader(); let truckSrc=null,zombieGeo=null,zombieMat=null;
const loadGLB=u=>new Promise(r=>loader.load(u,g=>r(g),undefined,()=>r(null)));
function procTruck(){const g=new THREE.Group();const body=mergeGeometries([boxG(2.4,1,4.4,0xc8402a,0,1.3,0),boxG(2.2,1,2.2,0xb83a26,0,2.2,.3),boxG(2,.75,.1,0x223344,0,2.25,-.82),boxG(2.8,1,.5,0x555a60,0,1.0,-2.45),boxG(.5,.5,1.3,0x333,0,3.05,.3)]);g.add(new THREE.Mesh(body,VC));
 const wg=colG(new THREE.CylinderGeometry(.75,.75,.7,16).rotateZ(Math.PI/2),0x1a1a1a);for(const [x,z] of [[-1.35,1.4],[1.35,1.4],[-1.35,-1.4],[1.35,-1.4]]){const w=new THREE.Mesh(wg,VC);w.position.set(x,.75,z);g.add(w);}return g;}
function procZombie(){return mergeGeometries([boxG(.8,.8,.8,0x86a36a,0,2.0,0),boxG(.9,1,.5,0x3e5f9a,0,1.2,0),boxG(.35,.8,.35,0x5a4632,-.22,.4,0),boxG(.35,.8,.35,0x5a4632,.22,.4,0),boxG(.25,.25,.9,0x86a36a,-.55,1.5,-.4),boxG(.25,.25,.9,0x86a36a,.55,1.5,-.4),boxG(.15,.15,.05,0xffee55,-.18,2.1,-.41),boxG(.15,.15,.05,0xffee55,.18,2.1,-.41)]);}
// ---------- player ----------
const truck=new THREE.Group();scene.add(truck);let truckBody=null,truckMats=[],truckBodies=[],hellKit=null;
const tShadow=new THREE.Mesh(new THREE.PlaneGeometry(4,6),blobMat);tShadow.rotation.x=-Math.PI/2;tShadow.position.y=.03;truck.add(tShadow);
var headMat=new THREE.MeshBasicMaterial({map:GT,color:0xfff0c8,transparent:true,opacity:.15,depthWrite:false,blending:THREE.AdditiveBlending});{const hl=new THREE.Mesh(new THREE.PlaneGeometry(7,16).rotateX(-Math.PI/2),headMat);hl.position.set(0,.08,9);truck.add(hl);}
const shieldM=new THREE.Mesh(new THREE.SphereGeometry(3.6,20,14),new THREE.MeshBasicMaterial({color:0x5ab8ff,transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending}));shieldM.position.y=1.6;shieldM.visible=false;truck.add(shieldM);
const gunPivot=new THREE.Object3D();truck.add(gunPivot);gunPivot.position.set(0,3.2,.3);
const muzzle=new THREE.Mesh(new THREE.SphereGeometry(.22,8,6),new THREE.MeshBasicMaterial({color:0xffa030,fog:false,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));muzzle.visible=false;scene.add(muzzle);
const P={x:0,z:0,vx:0,speed:0,hp:100,maxHp:100,fuel:100,maxFuel:100,nitro:1,nitroT:0,dist:0,kills:0,coins:0,combo:0,comboT:0,fireT:0,alive:false,revived:false,inv:0,tilt:0,bounce:0,nextBoss:700};
// ---------- zombies (instanced: 1 draw call) ----------
const ZN=140; let zMesh=null; const Z=[];for(let i=0;i<ZN;i++)Z.push({on:false});
const zShadow=new THREE.InstancedMesh(new THREE.PlaneGeometry(1.4,1.4).rotateX(-Math.PI/2),blobMat,ZN);zShadow.frustumCulled=false;scene.add(zShadow);zShadow.count=0;
let zColor=null;
function spawnZombie(z,x,type=0){const s=Z.find(q=>!q.on);if(!s)return;Object.assign(s,{on:true,x:x??rnd(-HALF-1,HALF+1),z,y:0,vx:0,vy:0,vz:0,dead:false,t:Math.random()*6,spd:type===1?rnd(3,4.5):type===2?rnd(.4,.8):rnd(.6,1.4),hp:type===1?1:type===2?5+Math.floor(P.dist/600):1+Math.floor(P.dist/1500),type,ry:0,rx:0,spin:0,flash:0,sc:type===1?.9:type===2?rnd(1.05,1.2):rnd(.95,1.1)});s.ry=Math.PI+rnd(-.4,.4);}
let fMesh=null;const FZN=30;
// barrels
const BR=[],BRN=8;const barrelMesh=new THREE.InstancedMesh(mergeGeometries([colG(new THREE.CylinderGeometry(.7,.7,1.7,12).translate(0,.85,0),0xd02a1e),colG(new THREE.CylinderGeometry(.72,.72,.35,12).translate(0,.85,0),0xffc21a),colG(new THREE.CylinderGeometry(.74,.74,.1,12).translate(0,1.62,0),0x777777),colG(new THREE.CylinderGeometry(.74,.74,.1,12).translate(0,.08,0),0x777777)]),new THREE.MeshLambertMaterial({vertexColors:true,emissive:0x400800}),BRN);barrelMesh.frustumCulled=false;scene.add(barrelMesh);barrelMesh.count=0;for(let i=0;i<BRN;i++)BR.push({on:false});
// power-up crates
const PWT=[{k:'magnet',c:0x39e0ff,n:'🧲 MAGNET',d:9},{k:'shield',c:0x4a8cff,n:'🛡 SHIELD',d:7},{k:'rapid',c:0xff7a1a,n:'🔥 RAPID FIRE',d:8},{k:'x2',c:0xffd23f,n:'✖2 COINS',d:10}];
function crateTex(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,128,128);x.strokeStyle='#555';x.lineWidth=14;x.strokeRect(7,7,114,114);x.fillStyle='#333';x.font='bold 84px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('?',64,70);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
const PU=[],PUN=4;const puMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1.4,1.4,1.4),new THREE.MeshLambertMaterial({map:crateTex(),emissive:0x222222}),PUN);puMesh.frustumCulled=false;puMesh.setColorAt(0,new THREE.Color());scene.add(puMesh);puMesh.count=0;for(let i=0;i<PUN;i++)PU.push({on:false});
const puRing=new THREE.InstancedMesh(new THREE.PlaneGeometry(4,4).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:GT,color:0xffffff,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}),PUN);puRing.frustumCulled=false;puRing.setColorAt(0,new THREE.Color());scene.add(puRing);puRing.count=0;
// boss
let boss=null,bossObj=null;
// ---------- obstacles & pickups ----------
const OB=[],ON=10;const obMesh=new THREE.InstancedMesh(mergeGeometries([boxG(3.6,1.1,.6,0x9a9aa0,0,.9,0),boxG(3.6,.25,.62,0xe23a2a,0,1.3,0),boxG(3.6,.25,.62,0xe23a2a,0,.6,0),boxG(.3,1,.3,0x555,-1.5,.3,0),boxG(.3,1,.3,0x555,1.5,.3,0)]),VC,ON);obMesh.frustumCulled=false;scene.add(obMesh);obMesh.count=0;
for(let i=0;i<ON;i++)OB.push({on:false});
const PK=[],PN=40;const coinMat=new THREE.MeshLambertMaterial({color:0xffc21a,emissive:0x8a5a00});
const coinMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(.5,.5,.12,18).rotateX(Math.PI/2),coinMat,PN);coinMesh.frustumCulled=false;scene.add(coinMesh);coinMesh.count=0;
const fuelMesh=new THREE.InstancedMesh(mergeGeometries([boxG(.9,1.1,.5,0xe8362a,0,.9,0),boxG(.3,.25,.3,0x222,.25,1.55,0),boxG(.6,.12,.52,0xffffff,0,.9,0)]),VC,8);fuelMesh.frustumCulled=false;scene.add(fuelMesh);fuelMesh.count=0;
for(let i=0;i<PN;i++)PK.push({on:false});const FU=[];for(let i=0;i<8;i++)FU.push({on:false});
// ---------- particles ----------
const PCN=600,pPos=new Float32Array(PCN*3),pCol=new Float32Array(PCN*3),pv=[];for(let i=0;i<PCN;i++){pv.push({l:0,vx:0,vy:0,vz:0});pPos[i*3+1]=-99;}
const pGeo=new THREE.BufferGeometry();pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));pGeo.setAttribute('color',new THREE.BufferAttribute(pCol,3));
const pts=new THREE.Points(pGeo,new THREE.PointsMaterial({size:.32,vertexColors:true,map:dotTex(),transparent:true,alphaTest:.3,depthWrite:false}));pts.frustumCulled=false;scene.add(pts);let pI=0;
function burst(x,y,z,n,col,sp=6,up=5){const c=new THREE.Color(col);pGeo.attributes.color.needsUpdate=true;for(let k=0;k<n;k++){const i=pI=(pI+1)%PCN,q=pv[i];q.l=rnd(.4,.9);q.vx=rnd(-sp,sp);q.vy=rnd(1,up);q.vz=rnd(-sp,sp)-P.speed*.3;pPos[i*3]=x;pPos[i*3+1]=y;pPos[i*3+2]=z;const v=rnd(.7,1.2);pCol[i*3]=c.r*v;pCol[i*3+1]=c.g*v;pCol[i*3+2]=c.b*v;}}
function dotTex(){const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');x.fillStyle='#fff';x.beginPath();x.arc(16,16,14,0,7);x.fill();return new THREE.CanvasTexture(c);}
// tracers
const TRN=24,trPos=new Float32Array(TRN*6),trL=new Float32Array(TRN);const trGeo=new THREE.BufferGeometry();trGeo.setAttribute('position',new THREE.BufferAttribute(trPos,3));
const tracers=new THREE.LineSegments(trGeo,new THREE.LineBasicMaterial({color:0xfff2a0,fog:false}));tracers.frustumCulled=false;scene.add(tracers);let trI=0;
function tracer(a,b){const i=trI=(trI+1)%TRN;trPos.set([a.x,a.y,a.z,b.x,b.y,b.z],i*6);trL[i]=.06;}
// ---------- UI ----------
function floatTxt(txt,x,y,col){const d=document.createElement('div');d.className='float';d.textContent=txt;d.style.left=x+'px';d.style.top=y+'px';if(col)d.style.color=col;document.body.appendChild(d);setTimeout(()=>d.remove(),900);}
{const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.translate(256,256);for(let i=0;i<70;i++){const a=Math.random()*6.283,r0=rnd(150,220),r1=rnd(300,380),w=rnd(1,4);x.strokeStyle=`rgba(255,255,255,${rnd(.25,.7)})`;x.lineWidth=w;x.beginPath();x.moveTo(Math.cos(a)*r0,Math.sin(a)*r0);x.lineTo(Math.cos(a)*r1,Math.sin(a)*r1);x.stroke();}document.getElementById('speed').style.backgroundImage=`url(${c.toDataURL()})`;}
const flash=document.createElement('div');flash.id='flash';document.body.appendChild(flash);
const _v=new THREE.Vector3();function toScreen(x,y,z){_v.set(x,y,z).project(cam);return[(_v.x+1)/2*innerWidth,(1-_v.y)/2*innerHeight];}
let state='load';
function show(id){document.body.classList.toggle('st-over',id==='over');for(const s of['menu','garage','over','pause'])$(s).classList.toggle('hide',s!==id);$('hud').classList.toggle('hide',!(id==='hud'||id==='pause'));}
function refreshMenu(){refreshMissions();$('mcoin').textContent=S.coins;$('mbest').textContent=S.best;$('bsound').textContent=S.snd?'🔊':'🔇';}
function refreshGarage(){$('gcoin').textContent=S.coins;
 $('trucks').innerHTML=TRUCKS.map((t,i)=>{const own=S.owned.includes(i);return `<div class="tk ${S.sel===i?'sel':''}" data-i="${i}"><b>${t.name}</b><div class="sw" style="background:#${(t.color===0xffffff?0xc8402a:t.color).toString(16).padStart(6,'0')}"></div>${own?(S.sel===i?'SELECTED':'OWNED'):'🪙 '+t.cost}<br><small>${t.desc}</small></div>`}).join('');
 $('ups').innerHTML=UPS.map(([k,n,d,b])=>{const l=S.ups[k],c=upCost(b,l);return `<div class="up"><b>${n}</b><small>${d}</small><div class="lv">${Array.from({length:MAXL},(_,i)=>`<i class="${i<l?'on':''}"></i>`).join('')}</div><button data-k="${k}" ${l>=MAXL||S.coins<c?'disabled':''}>${l>=MAXL?'MAX':'🪙 '+c}</button></div>`}).join('');}
$('trucks').onclick=e=>{const t=e.target.closest('.tk');if(!t)return;const i=+t.dataset.i;if(S.owned.includes(i)){S.sel=i;sfx.click();}else if(S.coins>=TRUCKS[i].cost){S.coins-=TRUCKS[i].cost;S.owned.push(i);S.sel=i;sfx.buy();}else{sfx.click();applyTruck(i);for(const x of document.querySelectorAll('.tk'))x.classList.toggle('pv',x===t);return;}save();applyTruck();refreshGarage();};
$('ups').onclick=e=>{const b=e.target.closest('button');if(!b||b.disabled)return;const k=b.dataset.k,u=UPS.find(x=>x[0]===k),c=upCost(u[3],S.ups[k]);if(S.coins<c)return;S.coins-=c;S.ups[k]++;save();sfx.buy();refreshGarage();};
function applyTruck(pv){const sel=pv??S.sel,t=TRUCKS[sel];if(truckBodies.length){for(const b of new Set(truckBodies))b.visible=false;truckBody=truckBodies[sel];truckBody.visible=true;}const own=truckBodies[1]&&truckBodies[1]!==truckBodies[0]&&sel===1;for(const m of truckMats)m.color.setHex(own?0xffffff:t.color);truck.scale.setScalar(1);gunPivot.position.set(0,sel===1?3.3:3.2,sel===1?.6:.3);if(hellKit)hellKit.visible=sel===2;}
// ---------- missions ----------
const MPOOL=[['kill','Smash %d zombies',[40,80,150,250]],['dist','Drive %d m in one run',[500,1000,1800,3000]],['smash','Smash %d barricades',[2,5,8,12]],['boss','Kill %d Brutes',[1,2,3,4]],['coin','Collect %d coins in one run',[60,150,300,500]],['boom','Blow up %d barrels',[3,8,15,25]]];
const MS={run:{}};if(!S.mis)S.mis=[];
function newMission(){const used=S.mis.map(m=>m.k);const pool=MPOOL.filter(m=>!used.includes(m[0]));const m=pool[Math.floor(Math.random()*pool.length)];const tier=Math.min(3,Math.floor((S.done||0)/3));return{k:m[0],t:m[1].replace('%d',m[2][tier]),goal:m[2][tier],p:0,r:50+tier*60};}
while(S.mis.length<3)S.mis.push(newMission());
function mission(k,v,abs){for(const m of S.mis){if(m.k!==k||m.p>=m.goal)continue;if(abs){if(v>m.p)m.p=Math.min(m.goal,Math.floor(v));}else m.p=Math.min(m.goal,m.p+v);if(m.p>=m.goal){S.coins+=m.r;S.done=(S.done||0)+1;banner('MISSION DONE +'+m.r);sfx.buy();}}}
function refreshMissions(){S.mis=S.mis.map(m=>m.p>=m.goal&&state!=='play'?newMission():m);save();$('mis').innerHTML='<b>MISSIONS</b>'+S.mis.map(m=>`<div class="mi"><span>${m.t}</span><i style="width:${m.p/m.goal*100}%"></i><em>${Math.floor(m.p)}/${m.goal} · 🪙${m.r}</em></div>`).join('');}
// ---------- game flow ----------
function resetWorld(){for(const z of Z)z.on=false;for(const o of OB)o.on=false;for(const p of PK)p.on=false;for(const f of FU)f.on=false;for(const b of BR)b.on=false;for(const u of PU)u.on=false;P.pw={magnet:0,shield:0,rapid:0,x2:0};P.nextHorde=1100;P.tutT=0;P.tutStep=0;if(bossObj)bossObj.visible=false;boss=null;$('bossbar').classList.add('hide');
 P.x=0;P.z=0;P.vx=0;P.dist=0;P.kills=0;P.coins=0;P.combo=0;P.revived=false;P.bonusGiven=0;P.nitro=1;P.nitroT=0;P.inv=0;P.nextBoss=700;spawnZ=-30;P.mark=0;P.smash=0;setBiome(0,true);biomeT=0.5;updBiome(1);biomeT=1;MS.run={};
 const t=TRUCKS[S.sel];P.maxHp=Math.round((100+S.ups.armor*30)*t.hp);P.hp=P.maxHp;P.maxFuel=100+S.ups.fuel*30;P.fuel=P.maxFuel;P.speed=8;
 for(let i=0;i<NT;i++)tiles[i].position.z=-i*TILE+TILE;initProps();for(let i=0;i<25;i++)spawnZombie(rnd(-140,-25));}
let spawnZ=-30;
function startRun(){applyTruck();initAudio();sfx.click();resetWorld();P.alive=true;state='play';show('hud');music(true);$('tut').classList.toggle('hide',S.tut>=2);if(S.tut<2)tutMsg('◀ DRAG TO STEER ▶','Gun fires automatically');}
function endRun(reason){mission('coin',P.coins,true);navigator.vibrate&&navigator.vibrate(200);P.alive=false;state='over';sfx.over();music(false);engine(0,false);
 const d=Math.floor(P.dist),bonus=Math.floor(d/10)-(P.bonusGiven||0);P.bonusGiven=(P.bonusGiven||0)+bonus;P.coins+=bonus;P.earned=P.coins;S.coins+=P.coins;let nr=false;if(d>S.best){S.best=d;nr=true;}S.runs++;if(S.tut<2)S.tut++;save();
 $('otitle').textContent=reason==='fuel'?'OUT OF FUEL!':'WRECKED!';$('odist').textContent=d+' m';$('okill').textContent=P.kills;$('ocoin').textContent=P.coins;$('onew').classList.toggle('hide',!nr);
 $('brevive').classList.toggle('hide',P.revived);$('bdouble').disabled=false;show('over');}
$('bplay').onclick=startRun;$('boagain').onclick=async()=>{if(S.runs%2===0)await adBreak();startRun();};$('bgplay').onclick=startRun;
$('bgarage').onclick=$('bogarage').onclick=()=>{sfx.click();refreshGarage();show('garage');state='garage';};
$('bgback').onclick=()=>{sfx.click();applyTruck();refreshMenu();show('menu');state='menu';};
$('bsound').onclick=()=>{S.snd=S.snd?0:1;setMuted(!S.snd);save();refreshMenu();};
$('bpause').onclick=()=>{if(state!=='play')return;state='pause';show('pause');suspend(true);};
$('bresume').onclick=()=>{state='play';show('hud');suspend(false);};
$('bquit').onclick=()=>{suspend(false);music(false);engine(0,false);state='menu';refreshMenu();show('menu');};
let adBusy=false;async function adBreak(){if(adBusy)return'busy';adBusy=true;suspend(true);const r=await showAd(true);suspend(false);adBusy=false;return r;}
$('brevive').onclick=async()=>{const r=await adBreak();if(r==='error'||r==='busy'||state!=='over')return;S.coins-=P.earned;save();P.revived=true;P.alive=true;P.hp=P.maxHp*.6;P.fuel=Math.max(P.fuel,P.maxFuel*.5);P.inv=3;state='play';show('hud');music(true);
 for(const z of Z)if(z.on&&Math.abs(z.z-P.z)<20)z.on=false;for(const o of OB)if(o.on&&o.z>P.z-40)o.on=false;};
$('bdouble').onclick=async()=>{if($('bdouble').disabled)return;$('bdouble').disabled=true;const r=await adBreak();if(r==='error'||r==='busy'){$('bdouble').disabled=false;return;}S.coins+=P.earned;$('ocoin').textContent=P.earned*2;$('bdouble').disabled=true;save();sfx.buy();};
setHooks(()=>{if(state==='play'){state='pause';show('pause');}suspend(true);},()=>suspend(false));
// ---------- input ----------
let drag=null,steer=0,keys={};
canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,px:P.x};initAudio();});
addEventListener('pointermove',e=>{if(!drag)return;const w=Math.min(innerWidth,innerHeight*1.2);P.tx=clamp(drag.px+(e.clientX-drag.x)/w*HALF*2.6,-HALF,HALF);if(S.tut<2&&P.tutStep===0&&Math.abs(e.clientX-drag.x)>30)$('tut').classList.add('hide');});
addEventListener('pointerup',()=>{drag=null;});addEventListener('pointercancel',()=>{drag=null;});
addEventListener('keydown',e=>{keys[e.code]=1;if(e.code==='Space')nitro();if(e.code==='Escape'||e.code==='KeyP')(state==='play'?$('bpause'):$('bresume')).click();});addEventListener('keyup',e=>keys[e.code]=0);
$('bboost').addEventListener('pointerdown',e=>{e.stopPropagation();nitro();});
function nitro(){if(state!=='play'||P.nitro<1)return;P.nitro=0;P.nitroT=2.6;sfx.nitro();shake(.5);}
// ---------- camera ----------
let shakeA=0;function shake(a){shakeA=Math.max(shakeA,a);}
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);cam.aspect=w/h;cam.fov=w<h?78:60;cam.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
// ---------- update ----------
const tmpA=new THREE.Vector3(),tmpB=new THREE.Vector3();
function hitZombie(z,dmg,fromRam){z.hp-=dmg;z.flash=.1;if(z.hp>0&&!fromRam){burst(z.x,1.6,z.z,4,0x7ac74f,2,3);return;}
 z.dead=true;z.vy=rnd(7,11)*(fromRam?1:.6);z.vx=(z.x-P.x)*1.5+rnd(-3,3);z.vz=fromRam?-P.speed*1.1:-2;z.spin=rnd(-10,10);burst(z.x,1.5,z.z,fromRam?18:10,0x6fbf3a,5,7);sfx.splat();
 P.kills++;P.combo++;mission('kill',1);P.comboT=1.6;const g=(1+Math.floor(Math.min(P.combo,40)/10)+(z.type===2?2:0))*(P.pw.x2>0?2:1);P.coins+=g;P.nitro=Math.min(1,P.nitro+.06);if(P.combo>=5&&P.combo%5===0){$('combo').textContent=P.combo+'× COMBO!';$('combo').style.opacity=1;clearTimeout(window.__ct);window.__ct=setTimeout(()=>$('combo').style.opacity=0,900);}
 const [sx,sy]=toScreen(z.x,2.5,z.z);floatTxt('+'+g,sx,sy);}
function update(dt){
 const t=TRUCKS[S.sel];const boosting=P.nitroT>0;const top=(22+S.ups.engine*2.5)*t.spd*(boosting?1.55:1);
 P.speed+=(top-P.speed)*Math.min(1,dt*(boosting?3:.8));
 // steering
 const kx=(keys.ArrowRight||keys.KeyD?1:0)-(keys.ArrowLeft||keys.KeyA?1:0);if(kx)P.tx=clamp((P.tx??P.x)+kx*dt*14,-HALF,HALF);
 const tx=P.tx??0,nvx=clamp((tx-P.x)*8,-16,16);P.vx+=(nvx-P.vx)*Math.min(1,dt*10);P.x=clamp(P.x+P.vx*dt,-HALF,HALF);
 P.z-=P.speed*dt;P.dist+=P.speed*dt;P.fuel-=dt*(2.6+P.dist/4000);P.nitroT-=dt;if(P.nitroT<=0)P.nitro=Math.min(1,P.nitro+dt*.05);
 P.inv-=dt;P.comboT-=dt;if(P.comboT<0&&P.combo){P.combo=0;$('combo').style.opacity=0;}
 truck.position.set(P.x,0,P.z);P.tilt+=(-P.vx*.03-P.tilt)*dt*8;truck.rotation.set(0,Math.PI-P.vx*.025,P.tilt);
 P.bounce+=dt*P.speed*.5;if(truckBody)truckBody.position.y=Math.sin(P.bounce)*.04+(boosting?.05:0);
 truck.visible=!(P.inv>0&&Math.floor(P.inv*10)%2);
 // world recycle
 for(const g of tiles)if(g.position.z>P.z+TILE*1.5)g.position.z-=TILE*NT;updateProps(P.z);
 // spawning
 const dens=Math.min(3.4,.75+P.dist/1500);
 if(S.tut<2){if(P.tutStep===0&&P.dist>120){P.tutStep=1;tutMsg('AUTO-GUN FIRES FOR YOU','Steer into zombies · shoot red barrels for BOOM!');}
  if(P.tutStep===1&&P.dist>260){P.tutStep=2;const o=OB.find(q=>!q.on);if(o)Object.assign(o,{on:true,x:P.x,z:P.z-70,broken:false,vy:0,y:0,r:0});P.nitro=1;tutMsg('TAP NITRO ▶','Smash barricades for free!');$('bboost').classList.add('hint');}
  if(P.tutStep===2&&P.dist>420){P.tutStep=3;const f=FU.find(q=>!q.on);if(f)Object.assign(f,{on:true,x:P.x,z:P.z-60});tutMsg('GRAB FUEL CANS','Running dry ends the run');$('bboost').classList.remove('hint');}
  if(P.tutStep===3&&P.dist>560){P.tutStep=4;$('tut').classList.add('hide');}}
 if(P.dist>P.nextHorde&&!boss&&P.dist<P.nextBoss-150){P.nextHorde=P.dist+rnd(1000,1300);banner('⚠ HORDE INCOMING!');sfx.alarm();for(let i=0;i<34+P.dist/150;i++)spawnZombie(P.z-rnd(70,140),rnd(-HALF-1,HALF+1),Math.random()<.2?1:0);spawnBarrel(P.z-95,rnd(-3,3));spawnBarrel(P.z-125,rnd(-3,3));}
 while(spawnZ>P.z-150){spawnZ-=rnd(3,7)/dens;const r=Math.random();
  if(r<.07){const x=rnd(-HALF+2,HALF-2);for(let i=0;i<8+dens*3;i++)spawnZombie(spawnZ-rnd(0,6),x+rnd(-3,3));} // horde
  else spawnZombie(spawnZ,undefined,P.dist>400&&Math.random()<.15?1:(P.dist>700&&Math.random()<.05+Math.min(.1,P.dist/30000)?2:0));
  if(r<.07&&Math.random()<.6)spawnBarrel(spawnZ-3,rnd(-HALF+1,HALF-1));else if(P.dist>250&&Math.random()<.025)spawnBarrel(spawnZ,rnd(-HALF+1,HALF-1));
  if(P.dist>150&&Math.random()<.014){const u=PU.find(q=>!q.on);if(u)Object.assign(u,{on:true,x:rnd(-HALF+1,HALF-1),z:spawnZ,t:PWT[Math.floor(Math.random()*PWT.length)]});}
  if(Math.random()<.06*Math.min(2,dens)){const o=OB.find(q=>!q.on);if(o){Object.assign(o,{on:true,x:rnd(-HALF+1.5,HALF-1.5),z:spawnZ,broken:false,vy:0,y:0,r:0});}}
  if(Math.random()<.22){const n=5,x=rnd(-HALF+1,HALF-1);for(let i=0;i<n;i++){const p=PK.find(q=>!q.on);if(p)Object.assign(p,{on:true,x,z:spawnZ-i*2.2,y:1.2});}}
  if(Math.random()<.045){const f=FU.find(q=>!q.on);if(f)Object.assign(f,{on:true,x:rnd(-HALF+1,HALF-1),z:spawnZ});}}
 if(P.dist>P.nextBoss&&!boss)spawnBoss();
 const bi=Math.floor(P.dist/1500)%BIOMES.length;if(bi!==biome)setBiome(bi);updBiome(dt);
 if(Math.floor(P.dist/500)>P.mark){P.mark=Math.floor(P.dist/500);if(P.mark%3)banner(P.mark*500+' m');}
 mission('dist',P.dist,true);
 // gun
 const rate=(.2-S.ups.gun*.013)/t.gun/(P.pw.rapid>0?2.5:1),dmg=1+Math.floor(S.ups.gun/3);P.fireT-=dt;let tgt=null,best=1e9;
 if(boss&&boss.z<P.z-3&&boss.z>P.z-55){tgt=boss;}else for(const z of Z){if(!z.on||z.dead)continue;const dz=P.z-z.z;if(dz<4||dz>45)continue;const d=dz+Math.abs(z.x-P.x)*2;if(d<best){best=d;tgt=z;}}
 if(tgt!==boss)for(const b of BR){if(!b.on)continue;const dz=P.z-b.z;if(dz<6||dz>40)continue;const d=(dz+Math.abs(b.x-P.x)*2)*.6;if(d<best){best=d;tgt=b;}}
 if(tgt){const a=Math.atan2(tgt.x-P.x,P.z-tgt.z);gunPivot.rotation.y+=(-a-gunPivot.rotation.y)*Math.min(1,dt*15);
  if(P.fireT<=0){P.fireT=rate;gunPivot.getWorldPosition(tmpA);tmpA.y+=.2;tmpB.set(tgt.x+rnd(-.2,.2),tgt===boss?3:tgt.barrel?1:1.5,tgt.z);tracer(tmpA,tmpB);muzzle.position.copy(tmpA).lerp(tmpB,.012);muzzle.visible=true;muzzle.scale.setScalar(rnd(.7,1.3));sfx.gun();
   if(tgt.barrel){explode(tgt);}else if(tgt===boss){boss.hp-=dmg;boss.flash=.08;burst(tmpB.x,3,tmpB.z,3,0x7ac74f,2,3);if(boss.hp<=0)killBoss();}else hitZombie(tgt,dmg,false);}
 }else gunPivot.rotation.y*=.9;
 if(P.fireT<rate-.04)muzzle.visible=false;
 // zombies
 if(zMesh){let n=0,nf=0;for(let i=0;i<ZN;i++){const z=Z[i];if(!z.on){continue;}
  if(z.dead){z.vy-=25*dt;z.x+=z.vx*dt;z.y+=z.vy*dt;z.z+=z.vz*dt;z.rx+=z.spin*dt;if(z.y<-1||z.z>P.z+15){z.on=false;continue;}}
  else{z.t+=dt;const chase=z.type===1||Math.abs(z.z-P.z)<25;z.z+=z.spd*dt*(z.type===1?1.5:1);if(chase)z.x+=clamp(P.x-z.x,-1,1)*dt*z.spd*.6;z.ry=Math.PI+Math.sin(z.t*2)*.15;
   if(z.z>P.z+12){z.on=false;continue;}
   if(Math.abs(z.z-P.z)<2.6&&Math.abs(z.x-P.x)<(z.type===2?2.3:1.9)){const fat=z.type===2&&!boosting;hitZombie(z,99,true);shake(fat?.5:.15);if(P.inv<=0&&P.pw.shield<=0)P.hp-=(fat?Math.max(3,9-S.ups.ram*.8):Math.max(.1,.6-S.ups.ram*.06))*(boosting?0:1);if(fat){P.speed*=.8;sfx.crash();}}}
  const wob=z.dead?0:Math.sin(z.t*z.spd*5)*.12;_q.setFromEuler(_e.set(z.rx+(z.dead?0:.15),z.ry,wob));_s.setScalar(z.sc);_m.compose(_p.set(z.x,z.y+(z.dead?0:Math.abs(wob)*.5),z.z),_q,_s);const MM=z.type===2&&fMesh&&nf<FZN?fMesh:zMesh,ix=MM===fMesh?nf++:n;MM.setMatrixAt(ix,_m);
  MM.setColorAt(ix,z.flash>0?_c.setRGB(3,3,3):(z.type===1?_c.setRGB(1.25,.8,.8):_c.setRGB(1,1,1)));z.flash-=dt;
  _m.makeTranslation(z.x,.02,z.z);zShadow.setMatrixAt(n+nf,_m);if(MM===zMesh)n++;}
  if(fMesh){fMesh.count=nf;fMesh.instanceMatrix.needsUpdate=true;if(fMesh.instanceColor)fMesh.instanceColor.needsUpdate=true;}zMesh.count=n;zShadow.count=n+nf;zMesh.instanceMatrix.needsUpdate=true;if(zMesh.instanceColor)zMesh.instanceColor.needsUpdate=true;zShadow.instanceMatrix.needsUpdate=true;}
 // obstacles
 {let n=0;for(const o of OB){if(!o.on)continue;if(o.z>P.z+15){o.on=false;continue;}
  if(o.broken){o.vy-=25*dt;o.y+=o.vy*dt;o.z-=P.speed*.5*dt;o.r+=dt*6;}
  else if(Math.abs(o.z-P.z)<2.4&&Math.abs(o.x-P.x)<3.4){o.broken=true;o.vy=9;mission('smash',1);navigator.vibrate&&navigator.vibrate(60);burst(o.x,1,o.z,25,0xbbbbbb,6,8);burst(o.x,1,o.z,10,0xff5533,5,6);sfx.crash();shake(.7);
   if(!boosting&&P.inv<=0&&P.pw.shield<=0){const d=Math.max(6,28-S.ups.ram*3)*(S.sel===1?.7:1);P.hp-=d;P.speed*=.55;flash.style.opacity=1;setTimeout(()=>flash.style.opacity=0,120);}else{P.coins+=5;const[sx,sy]=toScreen(o.x,2,o.z);floatTxt('SMASH +5',sx,sy,'#9cff57');}}
  _q.setFromEuler(_e.set(o.r,0,o.r*.5));_m.compose(_p.set(o.x,o.y,o.z),_q,_s.setScalar(1));obMesh.setMatrixAt(n++,_m);}obMesh.count=n;obMesh.instanceMatrix.needsUpdate=true;}
 // pickups
 {let n=0;const mag=1.6+S.ups.ram*.1;for(const p of PK){if(!p.on)continue;if(p.z>P.z+10){p.on=false;continue;}
  if(P.pw.magnet>0&&p.z>P.z-30&&p.z<P.z+2){p.x+=(P.x-p.x)*Math.min(1,dt*6);p.z+=(P.z-p.z)*Math.min(1,dt*5);}
  if(Math.abs(p.z-P.z)<2.2&&Math.abs(p.x-P.x)<mag){p.on=false;P.coins+=P.pw.x2>0?2:1;sfx.coin();continue;}
  _q.setFromEuler(_e.set(0,performance.now()*.004+p.z,0));_m.compose(_p.set(p.x,1.2+Math.sin(performance.now()*.005+p.z)*.15,p.z),_q,_s.setScalar(1));coinMesh.setMatrixAt(n++,_m);}coinMesh.count=n;coinMesh.instanceMatrix.needsUpdate=true;
  n=0;for(const f of FU){if(!f.on)continue;if(f.z>P.z+10){f.on=false;continue;}
  if(Math.abs(f.z-P.z)<2.4&&Math.abs(f.x-P.x)<2){f.on=false;P.fuel=Math.min(P.maxFuel,P.fuel+35);sfx.fuel();const[sx,sy]=toScreen(f.x,2,f.z);floatTxt('+FUEL',sx,sy,'#9cff57');continue;}
  _q.setFromEuler(_e.set(0,performance.now()*.002,0));_m.compose(_p.set(f.x,Math.sin(performance.now()*.004)*.2,f.z),_q,_s.setScalar(1.2));fuelMesh.setMatrixAt(n++,_m);}fuelMesh.count=n;fuelMesh.instanceMatrix.needsUpdate=true;}
 // boss
 if(boss){boss.t+=dt;boss.z+=dt*3;boss.x+=clamp(P.x-boss.x,-1,1)*dt*2;bossObj.position.set(boss.x,Math.abs(Math.sin(boss.t*3))*.3,boss.z);bossObj.rotation.set(0,Math.PI,Math.sin(boss.t*3)*.1);
  bossObj.children[0].material.emissive.setRGB(boss.flash>0?.25:0,boss.flash>0?.05:0,0);boss.flash-=dt;$('bboss').style.width=(boss.hp/boss.max*100)+'%';
  if(Math.abs(boss.z-P.z)<3.5&&Math.abs(boss.x-P.x)<2.8){if(boosting){boss.hp-=boss.max*.35;boss.z-=8;sfx.crash();shake(1);if(boss.hp<=0)killBoss();}else{if(P.inv<=0&&P.pw.shield<=0){P.hp-=35;P.inv=1;}P.speed*=.3;boss.z-=6;sfx.crash();shake(1);flash.style.opacity=1;setTimeout(()=>flash.style.opacity=0,150);}}
  if(boss&&boss.z>P.z+12){bossObj.visible=false;boss=null;$('bossbar').classList.add('hide');P.nextBoss=P.dist+600;}}
 updBarrels(dt,boosting);updPU(dt);
 for(const k in P.pw)if(P.pw[k]>0)P.pw[k]-=dt;shieldM.visible=P.pw.shield>0;if(shieldM.visible){shieldM.material.opacity=.16+Math.sin(performance.now()*.01)*.06*(P.pw.shield<2?3:1);}
 $('speed').classList.toggle('on',boosting);updPwHud();
 // particles & tracers
 for(let i=0;i<PCN;i++){const q=pv[i];if(q.l<=0)continue;q.l-=dt;q.vy-=20*dt;pPos[i*3]+=q.vx*dt;pPos[i*3+1]=Math.max(.05,pPos[i*3+1]+q.vy*dt);pPos[i*3+2]+=q.vz*dt;if(q.l<=0)pPos[i*3+1]=-99;}pGeo.attributes.position.needsUpdate=true;
 for(let i=0;i<TRN;i++)if(trL[i]>0){trL[i]-=dt;if(trL[i]<=0)trPos.fill(0,i*6,i*6+6);}trGeo.attributes.position.needsUpdate=true;
 if(S.sel===2&&Math.random()<.5){const sx=Math.random()<.5?-.75:.75,a=Math.sin(truck.rotation.y),c=Math.cos(truck.rotation.y);burst(P.x-sx*c,3.5,P.z+2.05,1,boosting?0x66ccff:0xff7a1a,.6,2.5);}
 if(boosting&&Math.random()<.6)burst(P.x+rnd(-.8,.8),1,P.z+2.6,1,0x66ccff,1,1);
 if(Math.random()<dt*20)burst(P.x+(Math.random()<.5?-1.3:1.3),.3,P.z+1.8,1,0x9a7a5a,1.2,1.2);
 // end conditions
 if(P.hp<=0){P.hp=0;burst(P.x,1.5,P.z,40,0x333333,6,8);burst(P.x,1.5,P.z,30,0xff7a22,6,8);sfx.crash();shake(1.2);endRun('hp');}
 else if(P.fuel<=0){P.fuel=0;endRun('fuel');}
 // HUD
 $('hcoin').textContent=P.coins;$('hdist').textContent=Math.floor(P.dist);$('hkill').textContent=P.kills;
 $('bhp').style.width=(P.hp/P.maxHp*100)+'%';$('bfuel').style.width=(P.fuel/P.maxFuel*100)+'%';
 $('bhp').parentNode.classList.toggle('low',P.hp/P.maxHp<.3);$('bfuel').parentNode.classList.toggle('low',P.fuel/P.maxFuel<.25);
 $('bnitro').style.height=(boosting?100:P.nitro*100)+'%';$('bboost').classList.toggle('off',P.nitro<1&&!boosting);
 engine(P.speed,true);setIntensity(boss||P.pw.rapid>0?1:0);if(Math.random()<dt*.35)sfx.groan();
}
const _c=new THREE.Color();
function spawnBarrel(z,x){const b=BR.find(q=>!q.on);if(b)Object.assign(b,{on:true,x,z,barrel:true});}
function explode(b){if(!b.on)return;b.on=false;burst(b.x,1.2,b.z,45,0xff8a1a,9,10);burst(b.x,1.2,b.z,25,0xffe060,6,12);burst(b.x,1.5,b.z,25,0x333333,5,8);sfx.boom();shake(.9);navigator.vibrate&&navigator.vibrate(80);
 let k=0;for(const z of Z)if(z.on&&!z.dead&&Math.hypot(z.x-b.x,z.z-b.z)<6.5){hitZombie(z,99,true);k++;}
 for(const o of BR)if(o.on&&Math.hypot(o.x-b.x,o.z-b.z)<5)setTimeout(()=>explode(o),120);
 if(boss&&Math.hypot(boss.x-b.x,boss.z-b.z)<7){boss.hp-=boss.max*.2;boss.flash=.2;if(boss.hp<=0)killBoss();}
 if(Math.hypot(P.x-b.x,P.z-b.z)<4.5&&P.inv<=0&&P.pw.shield<=0&&P.nitroT<=0){P.hp-=18;flash.style.opacity=1;setTimeout(()=>flash.style.opacity=0,150);}
 const[sx,sy]=toScreen(b.x,2.5,b.z);floatTxt(k>2?'BOOM ×'+k:'BOOM!',sx,sy,'#ffb84a');mission('boom',1);}
function updBarrels(dt,boosting){let n=0;for(const b of BR){if(!b.on)continue;if(b.z>P.z+12){b.on=false;continue;}if(Math.abs(b.z-P.z)<2.4&&Math.abs(b.x-P.x)<2){explode(b);continue;}
 _q.identity();_m.compose(_p.set(b.x,0,b.z),_q,_s.setScalar(1));barrelMesh.setMatrixAt(n++,_m);}barrelMesh.count=n;barrelMesh.instanceMatrix.needsUpdate=true;}
function updPU(dt){let n=0;const T=performance.now();for(const u of PU){if(!u.on)continue;if(u.z>P.z+10){u.on=false;continue;}
 if(Math.abs(u.z-P.z)<2.6&&Math.abs(u.x-P.x)<2.4){u.on=false;P.pw[u.t.k]=u.t.d;sfx.power();banner(u.t.n);burst(u.x,1.5,u.z,30,u.t.c,5,6);continue;}
 _q.setFromEuler(_e.set(.4,T*.003,.3));_m.compose(_p.set(u.x,1.4+Math.sin(T*.005)*.25,u.z),_q,_s.setScalar(1));puMesh.setMatrixAt(n,_m);puMesh.setColorAt(n,_c.setHex(u.t.c));_m.compose(_p.set(u.x,.06,u.z),_q.identity(),_s.setScalar(1+Math.sin(T*.008)*.15));puRing.setMatrixAt(n,_m);puRing.setColorAt(n,_c.setHex(u.t.c));n++;}
 puMesh.count=puRing.count=n;puMesh.instanceMatrix.needsUpdate=puRing.instanceMatrix.needsUpdate=true;if(puMesh.instanceColor)puMesh.instanceColor.needsUpdate=true;if(puRing.instanceColor)puRing.instanceColor.needsUpdate=true;}
let pwH='';function updPwHud(){const h=PWT.filter(t=>P.pw[t.k]>0).map(t=>`<div style="border-color:#${t.c.toString(16).padStart(6,'0')}">${t.n} ${Math.ceil(P.pw[t.k])}</div>`).join('');if(h!==pwH){pwH=h;$('pw').innerHTML=h;}}
function tutMsg(a,b){const t=$('tut');t.innerHTML=a+'<small>'+b+'</small>';t.classList.remove('hide');}
function setBiome(i,instant){biome=i%BIOMES.length;biomeT=instant?1:0;if(!instant){banner(BIOMES[biome].n);}}
function banner(t){const b=$('banner');b.textContent=t;b.classList.remove('show');void b.offsetWidth;b.classList.add('show');}
function updBiome(dt){if(biomeT>=1&&biomeT!==0.5)return;biomeT=Math.min(1,biomeT+dt*.4);const B=BIOMES[biome],k=dt*1.2;
 scene.background.lerp(_c.setHex(B.sky),k);scene.fog.color.lerp(_c.setHex(B.fog),k);dirtMat.color.lerp(_c.setHex(B.dirt),k);hemi.color.lerp(_c.setHex(B.hemi),k);sun.color.lerp(_c.setHex(B.sun),k);sun.intensity+=(B.si-sun.intensity)*k;hemi.intensity+=(B.hi-hemi.intensity)*k;NIGHT+=(B.night-NIGHT)*k;sunDisc.material.color.lerp(_c.setHex(B.disc),k);sunHalo.material.color.lerp(_c.setHex(B.disc),k);starMat.opacity=NIGHT;glowMat.opacity=NIGHT*.9;poolMat.opacity=NIGHT*.9;headMat.opacity=.1+NIGHT*.9;roadMat.color.setScalar(1-NIGHT*.25);
 const g=skyM.userData.g,p=g.attributes.position,c=g.attributes.color;for(let i=0;i<p.count;i++){const y=Math.max(0,p.getY(i)/200);_c.lerpColors(new THREE.Color(B.bot),new THREE.Color(B.top),Math.min(1,y*1.6));c.setXYZ(i,c.getX(i)+(_c.r-c.getX(i))*k,c.getY(i)+(_c.g-c.getY(i))*k,c.getZ(i)+(_c.b-c.getZ(i))*k);}c.needsUpdate=true;}
function spawnBoss(){boss={x:0,z:P.z-60,hp:40+P.dist/40+S.ups.gun*6,t:0,flash:0};boss.max=boss.hp;bossObj.visible=true;$('bossbar').classList.remove('hide');sfx.boss();shake(.6);}
function killBoss(){burst(boss.x,3,boss.z,70,0x6fbf3a,8,10);sfx.splat();sfx.crash();shake(1);P.coins+=50;mission('boss',1);const[sx,sy]=toScreen(boss.x,4,boss.z);floatTxt('BRUTE DOWN +50',sx,sy,'#9cff57');P.kills++;P.fuel=Math.min(P.maxFuel,P.fuel+30);
 bossObj.visible=false;boss=null;$('bossbar').classList.add('hide');P.nextBoss=P.dist+900;}
function updateCam(dt){const port=innerWidth<innerHeight;const back=port?13:10.5,up=port?9.5:6.2;
 const tx=P.x*.6,boosting=P.nitroT>0;cam.position.x+=(tx-cam.position.x)*Math.min(1,dt*5);cam.position.y=up;cam.position.z=P.z+back+(boosting?1.5:0);
 shakeA*=Math.pow(.02,dt);cam.position.x+=rnd(-1,1)*shakeA*.4;cam.position.y+=rnd(-1,1)*shakeA*.4;cam.lookAt(P.x*.8,1.5,P.z-12);
 const f=(innerWidth<innerHeight?78:60)+(boosting?8:0);if(Math.abs(cam.fov-f)>.1){cam.fov+=(f-cam.fov)*Math.min(1,dt*4);cam.updateProjectionMatrix();}
 skyM.position.set(cam.position.x,0,cam.position.z);sun.position.set(P.x-20,30,P.z+10);sun.target.position.set(P.x,0,P.z);sun.target.updateMatrixWorld();}
// attract mode in menu: truck idles forward slowly
let last=performance.now(),fpsA=60;window.__perf={frames:0,slow:0};
function loop(now){requestAnimationFrame(loop);let dt=Math.min(.05,(now-last)/1000);last=now;if(state==='load')return;
 window.__perf.frames++;if(dt>.034)window.__perf.slow++;fpsA+=(1/Math.max(dt,.001)-fpsA)*.05;window.__perf.fps=fpsA;window.__perf.calls=renderer.info.render.calls;window.__perf.tris=renderer.info.render.triangles;
 if(state==='play'){const t0=performance.now();update(dt);window.__perf.js=(window.__perf.js||0)*.95+(performance.now()-t0)*.05;}else if(state==='menu'||state==='garage'){P.z-=dt*0;P.dist=0;truck.position.set(0,0,P.z);truck.rotation.set(0,Math.PI,0);P.x=0;P.vx=0;
  for(const g of tiles)if(g.position.z>P.z+TILE*1.5)g.position.z-=TILE*NT;updateProps(P.z);}
 if(state==='garage'||state==='menu'){const W=innerWidth,H=innerHeight,pt=W<H;if(state==='menu')(pt?cam.setViewOffset(W,H,0,H*.22,W,H):cam.setViewOffset(W,H,-W*.2,0,W,H));else (pt?cam.setViewOffset(W,H,0,H*.3,W,H):cam.setViewOffset(W,H,0,H*.12,W,H));const t=now*.0003,r=state==='garage'?8.5:10,port=innerWidth<innerHeight;cam.position.set(Math.sin(t)*r,state==='garage'?3.2:4.2,P.z+Math.cos(t)*r);cam.lookAt(0,state==='garage'?(port?2.6:0.6):1.6,P.z);if(cam.fov!==50){cam.fov=port?70:50;cam.updateProjectionMatrix();}skyM.position.set(cam.position.x,0,cam.position.z);}
 else if(state!=='pause'){if(cam.view&&cam.view.enabled){cam.clearViewOffset();}updateCam(dt);}tickMusic();renderer.render(scene,cam);}
// ---------- boot ----------
const TIPS=['TIP: Hit NITRO to smash barricades for free.','TIP: Fuel cans are red — grab them!','TIP: Every 5 kills in a row boosts your coin combo.','TIP: Upgrade your GUN to melt the Brute faster.','TIP: Biomes change every 1500 m.'];
async function boot(){const lb=$('lbar');lb.style.width='15%';$('ltip').textContent=TIPS[Math.floor(Math.random()*TIPS.length)];const lt=$('ltxt');const setP=v=>{lb.style.width=v+'%';lt.textContent='Loading… '+v+'%';};setP(15);
 const [tg,zg,wg,bg,dg,fg]=await Promise.all([loadGLB('assets/truck.glb'),loadGLB('assets/zombie.glb'),loadGLB('assets/wreck.glb'),loadGLB('assets/barr.glb'),loadGLB('assets/dozer.glb'),loadGLB('assets/fatz.glb')]);setP(70);
 const first=g=>{let m=null;g&&g.scene.traverse(o=>{if(o.isMesh&&!m)m=o;});return m;};
 const wm=first(wg);if(wm){kinds.wreck.m.geometry=wm.geometry;kinds.wreck.m.material=wm.material;}
 const bmm=first(bg);if(bmm){const g2=bmm.geometry.clone();g2.scale(.8,.8,.8);obMesh.geometry=g2;obMesh.material=bmm.material;}
 if(tg){truckBody=tg.scene;truckBody.traverse(o=>{if(o.isMesh){o.material=o.material.clone();truckMats.push(o.material);}});}else{truckBody=procTruck();truckBody.traverse(o=>{if(o.isMesh){o.material=new THREE.MeshLambertMaterial({vertexColors:true});truckMats.push(o.material);}});}
 truck.add(truckBody);{const cm=new THREE.MeshStandardMaterial({color:0xdddddd,metalness:.9,roughness:.25,emissive:0x222222});const k=new THREE.Group();for(const x of[-.75,.75]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,1.6,8),cm);p.position.set(x,2.6,-1.95);k.add(p);}const bl=new THREE.Mesh(new THREE.BoxGeometry(1,.5,.9),cm);bl.position.set(0,2.15,1.5);k.add(bl);const spk=new THREE.ConeGeometry(.18,.8,6).rotateX(Math.PI/2);for(let i=0;i<5;i++){const c=new THREE.Mesh(spk,cm);c.position.set(-1.1+i*.55,1.1,2.55);k.add(c);}k.visible=false;truck.add(k);hellKit=k;}truckBodies=[truckBody,truckBody,truckBody];if(dg){const d=dg.scene;d.traverse(o=>{if(o.isMesh){o.material=o.material.clone();truckMats.push(o.material);}});d.visible=false;truck.add(d);truckBodies[1]=d;}
 if(zg){let mesh=null;zg.scene.traverse(o=>{if(o.isMesh&&!mesh)mesh=o;});zombieGeo=mesh.geometry;zombieMat=mesh.material;}else{zombieGeo=procZombie();zombieMat=new THREE.MeshLambertMaterial({vertexColors:true});}
 zMesh=new THREE.InstancedMesh(zombieGeo,zombieMat,ZN);zMesh.frustumCulled=false;zMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);zMesh.setColorAt(0,new THREE.Color(1,1,1));zMesh.count=0;scene.add(zMesh);
 {const fm=first(fg);fMesh=new THREE.InstancedMesh(fm?fm.geometry:zombieGeo,fm?fm.material:zombieMat,FZN);fMesh.frustumCulled=false;fMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);fMesh.setColorAt(0,new THREE.Color(1,1,1));fMesh.count=0;scene.add(fMesh);}
 bossObj=new THREE.Group();const fz=first(fg);const bm=new THREE.Mesh(fz?fz.geometry:zombieGeo,(fz?fz.material:zombieMat).clone());bm.material.color&&bm.material.color.setRGB(1.1,.8,.75);if(!bm.material.emissive)bm.material.emissive=new THREE.Color();bm.scale.setScalar(fz?2.3:2.8);bossObj.add(bm);bossObj.visible=false;scene.add(bossObj);
 applyTruck();resetWorld();P.alive=false;setP(90);
 // shader warm-up so the first frame of play doesn't hitch
 state='warm';updateCam(.016);renderer.compile(scene,cam);renderer.render(scene,cam);setP(100);
 setMuted(!S.snd);setTimeout(()=>{$('load').classList.add('hide');refreshMenu();show('menu');state='menu';},150);}
boot();requestAnimationFrame(loop);
window.__game={P,S,get state(){return state},Z,startRun,setState:s=>state=s,setBiome:i=>{setBiome(i,false);},spawnBarrel,applyTruck,PU,PWT,spawnZombie};

document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='play')$('bpause').click();});
