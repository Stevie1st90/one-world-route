(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const SAFE_ASSET=/^\.\/assets\/[a-z0-9_./-]+$/i;

  function descriptor(entry,fallbackTheme='ocean',ratio='landscape'){
    const theme=String(entry?.theme||fallbackTheme||'ocean').replace(/[^a-z0-9-]/gi,'')||'ocean';
    const derivative=entry?.derivatives?.[ratio];
    const asset=String(derivative?.asset||entry?.asset||'');
    const generatedApproved=entry?.sourceType!=='generated'||(entry.rightsStatus==='approved'&&entry.status==='published');
    if(entry?.type==='image'&&generatedApproved&&entry.license&&entry.attribution&&SAFE_ASSET.test(asset)&&!asset.split('/').includes('..')){
      const focal=derivative?.focalPoint||entry.focalPoint||{x:.5,y:.5};
      const x=Number.isFinite(focal.x)?Math.max(0,Math.min(1,focal.x)):.5,y=Number.isFinite(focal.y)?Math.max(0,Math.min(1,focal.y)):.5;
      return {
        type:'image',
        asset,
        alt:entry.alt||'',
        focalPoint:{x,y},
        theme,
        className:'platform-media-image visual-'+theme,
        style:'background-image:linear-gradient(180deg,rgba(5,10,17,.08),rgba(5,10,17,.5)),url("'+asset.replace(/"/g,'')+'");background-position:'+Math.round(x*100)+'% '+Math.round(y*100)+'%',
        attribution:String(entry.attribution||''),
        license:String(entry.license||'')
      };
    }
    return {type:'art-directed',theme,className:'visual-'+theme,style:'',attribution:'',license:String(entry?.license||'original-ui-art')};
  }

  function credit(entry,esc=value=>String(value??'')){
    const media=descriptor(entry);
    if(media.type!=='image'||!media.attribution)return '';
    return '<small class="platform-media-credit">'+esc(media.attribution)+(media.license?' · '+esc(media.license):'')+'</small>';
  }


  function routeArt(preview){
    const arcs=(preview?.arcs||[]).filter(arc=>[arc.start?.lat,arc.start?.lng,arc.end?.lat,arc.end?.lng].every(value=>Number.isFinite(value)));
    if(!arcs.length)return '';
    const points=arcs.flatMap(arc=>[arc.start,arc.end]);
    const center=points.reduce((sum,p)=>sum+Number(p.lat),0)/points.length;
    const scale=Math.max(.2,Math.cos(center*Math.PI/180));
    const xs=points.map(p=>Number(p.lng)*scale),ys=points.map(p=>Number(p.lat));
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const span=Math.max((maxX-minX)/240,(maxY-minY)/100,.01);
    const project=p=>[160+(Number(p.lng)*scale-(minX+maxX)/2)/span,90-(Number(p.lat)-(minY+maxY)/2)/span].map(v=>Math.round(v*10)/10);
    return '<svg class="platform-route-art" viewBox="0 0 320 180" aria-hidden="true" focusable="false">'+arcs.map(arc=>{
      const [x,y]=project(arc.start),[ex,ey]=project(arc.end);
      return '<path d="M'+x+' '+y+' L'+ex+' '+ey+'"/><circle cx="'+x+'" cy="'+y+'" r="2.5"/><circle cx="'+ex+'" cy="'+ey+'" r="2.5"/>';
    }).join('')+'</svg>';
  }
  function tripPreview(trip){
    const places=new Map((trip?.places||[]).map(place=>[place.id,place]));
    const points=(trip?.stops||[]).map(stop=>places.get(stop.placeId)?.coordinates).filter(Boolean);
    return {arcs:points.slice(1).map((point,index)=>({start:points[index],end:point}))};
  }

  let registryPromise;
  async function resolveReference(meta,trip){
    const reference=trip.media?.heroAssetId||meta.visual?.coverAssetId;
    if(!reference)return trip;
    registryPromise=registryPromise||fetch('./data/platform/generated-media.json').then(r=>{if(!r.ok)throw Error('Media registry unavailable');return r.json()}).catch(()=>({assets:[]}));
    const registry=await registryPromise;
    const candidate=(registry.assets||[]).find(a=>a.assetId===reference&&a.status==='published'&&a.rightsStatus==='approved');
    if(!candidate||descriptor(candidate).type!=='image')return trip;
    return {...trip,media:{...trip.media,hero:candidate}};
  }
  root.media={descriptor,credit,routeArt,tripPreview,resolveReference};
})();
