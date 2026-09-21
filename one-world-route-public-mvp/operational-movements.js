(() => {
  'use strict';
  const json=async path=>{const r=await fetch(path);if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json()};
  const ready=Promise.all([json('./data/operational-movements.json'),json('./data/flight-geometries.json')])
    .then(([data,flights])=>{window.ONE_WORLD_MOVEMENTS.data=data;return {...data,flights}})
    .catch(error=>{console.warn('Operational movement data unavailable',error);return {movements:[],flights:{geometries:{}},unavailable:true}});
  window.ONE_WORLD_MOVEMENTS={ready,data:null,active:null,
    clear(){this.active=null;document.querySelector('#storyMovement')?.remove()},
    show(m){
      this.clear();this.active=m;
      const hud=document.querySelector('#storyHud');if(!hud)return;
      const box=document.createElement('div');box.id='storyMovement';box.className='story-movement';
      const title=document.createElement('b');title.textContent=m.mode?`Domestic ${m.mode.toLowerCase()} transfer`:'Transfer · route needs review';
      const route=document.createElement('span');route.textContent=`${m.from} → ${m.to}`;
      const note=document.createElement('small');note.textContent=`${m.reviewStatus==='reviewed'?'':'Plan needs review · '}Between international legs · country count unchanged`;
      box.append(title,route,note);hud.appendChild(box);
    }
  };
})();
