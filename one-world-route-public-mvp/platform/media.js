(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const SAFE_ASSET=/^\.\/assets\/[a-z0-9_./-]+$/i;
  let visualManifest={journeys:[],destinationAssets:[]},manifestPromise;
  function setManifest(manifest){visualManifest=manifest||{journeys:[]};}
  function resolveJourneyVisual(meta,context={}){
    const record=(visualManifest.journeys||[]).find(j=>j.id===meta.id)||{};
    return root.visualPolicy.resolveJourneyVisual({...meta,visualAnchor:meta.visualAnchor||record.visualAnchor},{journeyCover:record.journeyCover,destinationAssets:visualManifest.destinationAssets||[],autoRouteVisual:record.autoRouteVisual,countries:record.countries||[],...context});
  }
  async function loadManifest(){
    manifestPromise=manifestPromise||fetch('./data/platform/media-manifest.json').then(r=>{if(!r.ok)throw Error('Media manifest unavailable');return r.json()}).then(m=>{setManifest(m);return m}).catch(()=>visualManifest);
    return manifestPromise;
  }

  function descriptor(entry,fallbackTheme='ocean',ratio='landscape'){
    const theme=String(entry?.theme||fallbackTheme||'ocean').replace(/[^a-z0-9-]/gi,'')||'ocean';
    const derivative=entry?.derivatives?.[ratio];
    const asset=String(derivative?.asset||entry?.asset||'');
    const generatedApproved=!['generated','route-render'].includes(entry?.sourceType)||(entry.rightsStatus==='approved'&&entry.status==='published');
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
        license:String(entry.license||''),srcset:ratio==='landscape'?entry.srcset||'':'',assetId:entry.assetId||null,sourceType:entry.sourceType||null
      };
    }
    return {type:'art-directed',theme,className:'visual-'+theme,style:'',attribution:'',license:String(entry?.license||'original-ui-art')};
  }

  function credit(entry,esc=value=>String(value??'')){
    const media=descriptor(entry);
    if(media.type!=='image'||!media.attribution)return '';
    return '<small class="platform-media-credit">'+esc(media.attribution)+(media.license&&entry.sourceType!=='route-render'?' · '+esc(media.license):'')+'</small>';
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

  async function resolveReference(meta,trip){
    await loadManifest();
    const result=resolveJourneyVisual(meta,{purpose:'journeyHero'});
    if(!result.entry)return trip;
    return {...trip,media:{...trip.media,hero:result.entry}};
  }
  function resolveDestinationVisual(anchor){return root.visualPolicy.destinationCandidate({visualAnchor:anchor},visualManifest.destinationAssets||[],[]);}
  function imageMarkup(entry,esc,local=value=>value?.en||value||'',{lazy=true,ratio='landscape'}={}){
    const d=descriptor(entry,'ocean',ratio);if(d.type!=='image')return '';
    return '<img class="platform-route-image" style="object-position:'+Math.round(d.focalPoint.x*100)+'% '+Math.round(d.focalPoint.y*100)+'%" '+(lazy?'loading="lazy" ':'')+'decoding="async" src="'+esc(d.asset)+'"'+(d.srcset?' srcset="'+esc(d.srcset)+'" sizes="(max-width:820px) 92vw, 400px"':'')+' alt="'+esc(local(d.alt))+'">';
  }
  root.media={descriptor,credit,routeArt,tripPreview,resolveReference,setManifest,loadManifest,resolveJourneyVisual,resolveDestinationVisual,imageMarkup};
})();
