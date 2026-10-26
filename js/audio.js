let ac=null,master=null,eng=null,engF=null,engG=null,noiseBuf=null,musicOn=false,muted=false,mT=0,musG=null;
export function initAudio(){ if(ac){if(ac.state==='suspended')ac.resume();return;}
  ac=new (window.AudioContext||window.webkitAudioContext)(); master=ac.createGain(); master.gain.value=muted?0:0.7; master.connect(ac.destination);
  noiseBuf=ac.createBuffer(1,ac.sampleRate,ac.sampleRate); const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  eng=ac.createOscillator(); eng.type='sawtooth'; engF=ac.createBiquadFilter(); engF.type='lowpass'; engF.frequency.value=300; engG=ac.createGain(); engG.gain.value=0;
  eng.connect(engF).connect(engG).connect(master); eng.start();
  musG=ac.createGain(); musG.gain.value=0.16; musG.connect(master);
}
export function setMuted(m){muted=m; if(master)master.gain.value=m?0:0.7;}
export function suspend(s){ if(!ac)return; s?ac.suspend():ac.resume(); }
export function engine(speed,on){ if(!ac)return; const t=ac.currentTime; eng.frequency.setTargetAtTime(38+speed*2.2,t,0.1); engF.frequency.setTargetAtTime(200+speed*18,t,0.1); engG.gain.setTargetAtTime(on?0.07:0,t,0.15); }
function noise(dur,f,q,vol,type='bandpass'){ if(!ac)return; const t=ac.currentTime,s=ac.createBufferSource(); s.buffer=noiseBuf; const fl=ac.createBiquadFilter(); fl.type=type; fl.frequency.value=f; fl.Q.value=q; const g=ac.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur); s.connect(fl).connect(g).connect(master); s.start(t,Math.random()*0.5); s.stop(t+dur); }
function tone(f0,f1,dur,vol,type='square'){ if(!ac)return; const t=ac.currentTime,o=ac.createOscillator(); o.type=type; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(f1,t+dur); const g=ac.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur); o.connect(g).connect(master); o.start(t); o.stop(t+dur); }
let lastGun=0;
export const sfx={
  gun(){ if(!ac||ac.currentTime-lastGun<0.05)return; lastGun=ac.currentTime; noise(0.09,1800,0.8,0.25); tone(160,60,0.07,0.12); },
  splat(){ noise(0.18,500,1.5,0.35); tone(220,70,0.12,0.12,'sine'); },
  crash(){ noise(0.5,300,0.6,0.7,'lowpass'); tone(90,30,0.4,0.3,'sawtooth'); },
  coin(){ tone(880,1760,0.09,0.12,'triangle'); },
  fuel(){ tone(400,900,0.2,0.15,'triangle'); },
  nitro(){ noise(0.9,900,0.4,0.4,'highpass'); tone(120,400,0.5,0.15,'sawtooth'); },
  boss(){ tone(80,40,1.2,0.4,'sawtooth'); noise(1,200,1,0.3,'lowpass'); },
  click(){ tone(600,900,0.05,0.12,'triangle'); },
  buy(){ tone(523,1046,0.12,0.15,'triangle'); setTimeout(()=>tone(784,1568,0.15,0.15,'triangle'),90); },
  boom(){ noise(0.9,180,0.5,0.9,'lowpass'); tone(70,25,0.7,0.45,'sine'); noise(0.3,2500,0.5,0.25); },
  power(){ tone(440,880,0.1,0.15,'square'); setTimeout(()=>tone(660,1320,0.12,0.15,'square'),80); setTimeout(()=>tone(880,1760,0.18,0.15,'triangle'),160); },
  alarm(){ for(let i=0;i<3;i++)setTimeout(()=>{tone(520,380,0.25,0.18,'sawtooth');},i*300); },
  groan(){ if(!ac)return; const t=ac.currentTime,o=ac.createOscillator(); o.type='sawtooth'; const b=90+Math.random()*50; o.frequency.setValueAtTime(b,t); o.frequency.linearRampToValueAtTime(b*0.7,t+0.8); const fl=ac.createBiquadFilter(); fl.type='bandpass'; fl.frequency.value=500; fl.Q.value=4; const g=ac.createGain(); g.gain.setValueAtTime(0.001,t); g.gain.linearRampToValueAtTime(0.08,t+0.2); g.gain.exponentialRampToValueAtTime(0.001,t+0.9); o.connect(fl).connect(g).connect(master); o.start(t); o.stop(t+1); },
  over(){ tone(300,80,0.8,0.25,'sawtooth'); }
};
// simple driving rock loop
const bass=[40,40,43,40,47,45,43,38];
export function music(on){ musicOn=on; }
let inten=0; export function setIntensity(v){inten=v;}
const lead=[64,67,69,67,64,62,64,71];
export function tickMusic(){ if(!ac||!musicOn)return; const step=60/140/2; while(mT<ac.currentTime+0.2){ if(mT<ac.currentTime)mT=ac.currentTime; const i=Math.floor(mT/step)%16, n=bass[(i>>1)%8];
  const o=ac.createOscillator(); o.type='square'; o.frequency.value=440*Math.pow(2,(n-69)/12); const g=ac.createGain(); g.gain.setValueAtTime(0.5,mT); g.gain.exponentialRampToValueAtTime(0.01,mT+step*0.9); const f=ac.createBiquadFilter(); f.type='lowpass'; f.frequency.value=700; o.connect(f).connect(g).connect(musG); o.start(mT); o.stop(mT+step);
  if(i%4===0){const k=ac.createOscillator(); k.frequency.setValueAtTime(140,mT); k.frequency.exponentialRampToValueAtTime(40,mT+0.12); const kg=ac.createGain(); kg.gain.setValueAtTime(1,mT); kg.gain.exponentialRampToValueAtTime(0.01,mT+0.15); k.connect(kg).connect(musG); k.start(mT); k.stop(mT+0.16);}
  if(i%8===4){const s=ac.createBufferSource(); s.buffer=noiseBuf; const sg=ac.createGain(); sg.gain.setValueAtTime(0.5,mT); sg.gain.exponentialRampToValueAtTime(0.01,mT+0.12); s.connect(sg).connect(musG); s.start(mT); s.stop(mT+0.13);}
  if(inten&&i%2===0){const lo=ac.createOscillator(); lo.type='sawtooth'; lo.frequency.value=440*Math.pow(2,(lead[(i>>1)%8]-57)/12); const lg=ac.createGain(); lg.gain.setValueAtTime(0.18,mT); lg.gain.exponentialRampToValueAtTime(0.01,mT+step*1.8); const lf=ac.createBiquadFilter(); lf.type='lowpass'; lf.frequency.value=1800; lo.connect(lf).connect(lg).connect(musG); lo.start(mT); lo.stop(mT+step*2);}
  if(i%2===1){const h=ac.createBufferSource(); h.buffer=noiseBuf; const hf=ac.createBiquadFilter(); hf.type='highpass'; hf.frequency.value=7000; const hg=ac.createGain(); hg.gain.setValueAtTime(0.12,mT); hg.gain.exponentialRampToValueAtTime(0.01,mT+0.04); h.connect(hf).connect(hg).connect(musG); h.start(mT); h.stop(mT+0.05);}
  mT+=step; } }
