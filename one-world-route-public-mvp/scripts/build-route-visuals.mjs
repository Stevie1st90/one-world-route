import {readFile,writeFile,mkdir,access,readdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {hash,extractRoute,cameraFit,RATIOS,STYLE_VERSION,RENDERER_VERSION} from './route-visual-model.mjs';
const ROOT=new URL('../',import.meta.url),json=async p=>JSON.parse(await readFile(new URL(p,ROOT),'utf8'));
const catalog=await json('data/platform/trips.json'),source=await json('data/visual-sources/source.json');
const manifestPath=new URL('data/platform/route-visuals.json',ROOT);
const old=await json('data/platform/route-visuals.json').catch(()=>({journeys:[]}));
const deps={countries:await json('data/country-centroids.json'),waypoints:await json('data/route-waypoints.json'),flights:await json('data/flight-geometries.json'),movements:await json('data/operational-movements.json')};
const sourceHash=hash(await readFile(new URL(source.asset,ROOT)));
if(sourceHash!==source.sha256||source.rightsStatus!=='approved')throw Error('Basemap provenance/checksum invalid');
const codeHash=hash((await Promise.all(['scripts/route-visual-model.mjs','scripts/route-visual-provider.mjs'].map(p=>readFile(new URL(p,ROOT),'utf8')))).join('\n'));
const check=process.argv.includes('--check'),only=process.argv.find(x=>x.startsWith('--trip='))?.slice(7);
if(only&&!catalog.trips.some(t=>t.id===only))throw Error('Unknown trip '+only);
const journeys=[];let provider,rendered=0,reused=0;
for(const meta of catalog.trips){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(meta.id))throw Error("Invalid route asset identity");
  const trip=await json(meta.dataset.replace(/^\.\//,'')),route=extractRoute(meta,trip,deps);
  const previous=old.journeys.find(t=>t.id===meta.id),formats={};
  for(const [ratio,size] of Object.entries(RATIOS)){
    const inputHash=hash({route,title:meta.title,kind:meta.kind,ratio,size,style:STYLE_VERSION,renderer:RENDERER_VERSION,provider:source.provider,sourceHash,codeHash});
    const folder='assets/generated/routes/'+meta.id,asset='./'+folder+'/'+ratio+'-'+inputHash.slice(0,16)+'.webp';
    const prior=previous?.formats?.[ratio];
    let good=prior?.inputHash===inputHash&&prior.asset===asset;
    if(good)good=hash(await readFile(new URL(asset.replace(/^\.\//,''),ROOT)).catch(()=>Buffer.from('missing')))===prior.outputHash;
    if(!good){
      if(check||only&&meta.id!==only)throw Error(meta.id+' '+ratio+': stale/missing route visual. Run node scripts/build-route-visuals.mjs --all');
      if(!provider){const {localReliefProvider}=await import('./route-visual-provider.mjs');provider=await localReliefProvider(fileURLToPath(new URL(source.asset,ROOT)));}
      await mkdir(new URL(folder+'/',ROOT),{recursive:true});
      const result=await provider.render(route,ratio,fileURLToPath(new URL(asset.slice(2),ROOT)));
      formats[ratio]={asset,inputHash,outputHash:hash(await readFile(new URL(asset.slice(2),ROOT))),bytes:result.bytes,...size,camera:result.camera};
      if(ratio==='landscape'){
        const cardAsset=asset.replace('.webp','-600.webp');await provider.resize(fileURLToPath(new URL(asset.slice(2),ROOT)),fileURLToPath(new URL(cardAsset.slice(2),ROOT)));
        formats[ratio].responsive={asset:cardAsset,width:600,outputHash:hash(await readFile(new URL(cardAsset.slice(2),ROOT))),bytes:(await readFile(new URL(cardAsset.slice(2),ROOT))).length};
      }
      rendered++;
    }else{
      formats[ratio]=prior;reused++;
      if(ratio==='landscape'&&(!prior.responsive||hash(await readFile(new URL(prior.responsive.asset.slice(2),ROOT)).catch(()=>Buffer.from('missing')))!==prior.responsive.outputHash))throw Error(meta.id+': missing/corrupt responsive derivative');
    }
  }
  const landscape=formats.landscape;
  const alt=Object.fromEntries(Object.entries(meta.title).map(([locale,title])=>[locale,({en:'Geographic route illustration: ',de:'Geografische Routendarstellung: ',it:'Illustrazione geografica del percorso: ',es:'Ilustración geográfica de la ruta: ',fr:'Illustration géographique du parcours : ',pt:'Ilustração geográfica da rota: '}[locale]||'Geographic route illustration: ')+title]));
  const media={assetId:'auto-route-'+meta.id,type:'image',sourceType:'route-render',mediaKind:'route-visual',tripId:meta.id,status:'published',rightsStatus:'approved',asset:landscape.asset,aspectRatio:'16:9',focalPoint:{x:.5,y:.5},alt,attribution:'Made with Natural Earth · ONE WORLD ROUTE',attributionRequired:false,license:'Natural Earth public domain; original route presentation',provider:source.provider,sourceLicenseUrl:source.licenseUrl,geometryBasis:route.schematic?'Includes schematic coordinate connectors; not navigation geometry':'Provided segment geometry',scope:route.scope,derivatives:Object.fromEntries(['portrait','vertical'].map(r=>[r,{asset:formats[r].asset,focalPoint:{x:.5,y:.5},width:formats[r].width,height:formats[r].height}])),srcset:landscape.responsive.asset+' 600w, '+landscape.asset+' 1200w'};
  journeys.push({id:meta.id,scope:route.scope,bounds:route.bounds,countries:route.countries,regions:route.regions,geometry:{lines:route.lines.length,detailed:route.detailed,schematic:route.schematic},formats,media});
}
const report={schemaVersion:1,styleVersion:STYLE_VERSION,rendererVersion:RENDERER_VERSION,provider:source.provider,sourceHash,journeys};
const serialized=JSON.stringify(report,null,2)+'\n';
if(check){if(await readFile(manifestPath,'utf8')!==serialized)throw Error('Route visual manifest stale');}
else await writeFile(manifestPath,serialized);
if(process.argv.includes('--prune')&&!check){
  const keep=new Set(journeys.flatMap(j=>Object.values(j.formats).flatMap(f=>[f.asset,f.responsive?.asset]).filter(Boolean).map(p=>p.slice(2))));
  for(const j of journeys){const folder='assets/generated/routes/'+j.id;for(const file of await readdir(new URL(folder+'/',ROOT)))if(!keep.has(folder+'/'+file))await rm(new URL(folder+'/'+file,ROOT));}
}
console.log(JSON.stringify({journeys:journeys.length,rendered,reused,assets:journeys.length*4,check,bytes:journeys.reduce((n,j)=>n+Object.values(j.formats).reduce((s,f)=>s+f.bytes+(f.responsive?.bytes||0),0),0)}));
