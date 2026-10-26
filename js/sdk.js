// GameMonetize SDK wrapper (https://github.com/MonetizeGame/GameMonetize.com-SDK)
let pauseCb=()=>{},resumeCb=()=>{},waiters=[],lastAd=-1e9; export const sdkLog=[];
window.__gmEvent=e=>{sdkLog.push(e.name);
  if(e.name==='SDK_GAME_PAUSE')pauseCb();
  if(e.name==='SDK_GAME_START'){resumeCb();const w=waiters;waiters=[];w.forEach(f=>f('ok'));}
  if(e.name==='SDK_ERROR'){const w=waiters;waiters=[];w.forEach(f=>f('error'));}};
export function setHooks(p,r){pauseCb=p;resumeCb=r;}
const has=()=>typeof window.sdk!=='undefined'&&window.sdk.showBanner;
export function showAd(force){
  return new Promise(res=>{
    const n=performance.now(); if(!force&&n-lastAd<60000){res('cooldown');return;}
    if(!has()){sdkLog.push('noad');res('noad');return;}
    lastAd=n; waiters.push(res); setTimeout(()=>{const i=waiters.indexOf(res);if(i>=0){waiters.splice(i,1);res('timeout');}},35000);
    try{window.sdk.showBanner();}catch(e){res('error');}
  });
}
