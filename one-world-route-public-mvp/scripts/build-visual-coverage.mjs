import {readFile,writeFile} from 'node:fs/promises';
import '../platform/visual-policy.js';
const ROOT=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,ROOT),'utf8'));
const [catalog,manifest,countries]=await Promise.all(['data/platform/trips.json','data/platform/media-manifest.json','data/country-centroids.json'].map(read));
const policy=globalThis.ONE_WORLD_VISUAL_POLICY,assets=manifest.destinationAssets||[];
const countryUses=new Map(),placeUses=new Map(),regionUses=new Map();
for(const meta of catalog.trips){
  const trip=await read(meta.dataset.slice(2)),entry=manifest.journeys.find(j=>j.id===meta.id);
  const reusable=entry.countries.length===1;
  for(const cc of entry.countries){const v=countryUses.get(cc)||{journeys:[],eligibleJourneys:[]};v.journeys.push(meta.id);if(reusable)v.eligibleJourneys.push(meta.id);countryUses.set(cc,v);}
  for(const place of trip.places||[]){const id=place.experienceRef||place.id,v=placeUses.get(id)||{name:place.name,countryCode:place.countryCode,journeys:[]};if(!v.journeys.includes(meta.id))v.journeys.push(meta.id);placeUses.set(id,v);}
  for(const region of meta.discovery?.regions||[]){const v=regionUses.get(region)||[];v.push(meta.id);regionUses.set(region,v);}
}
const journeys=manifest.journeys.map(j=>{const meta=catalog.trips.find(m=>m.id===j.id),c={journeyCover:j.journeyCover,destinationAssets:assets,autoRouteVisual:j.autoRouteVisual,countries:j.countries};const social=policy.resolveJourneyVisual({...meta,visualAnchor:meta.visualAnchor||j.visualAnchor},{...c,purpose:'social',ratio:'vertical'});return {id:j.id,title:meta.title.en,autoRouteVisual:policy.usable(j.autoRouteVisual),destinationVisual:Boolean(j.destinationAssetId),journeyCover:policy.usable(j.journeyCover),portrait:Boolean(j.hero?.derivatives?.portrait),vertical:Boolean(social.entry?.derivatives?.vertical||social.entry?.aspectRatio==='9:16'),rightsApproved:policy.usable(j.hero),currentResolvedVisual:j.resolvedKind,coverageLevel:j.coverageLevel,scope:j.autoRouteVisual?.scope};});
const continents=[...new Set(countries.map(c=>c.region))].map(name=>({type:'continent',id:name.toLowerCase(),name,journeys:[...new Set(countries.filter(c=>c.region===name).flatMap(c=>countryUses.get(c.cca2)?.journeys||[]))]}));
const destinationQueue=[...continents,...countries.map(c=>({type:'country',id:c.cca2,name:c.name,parent:{type:'continent',id:c.region.toLowerCase()},...countryUses.get(c.cca2)||{journeys:[],eligibleJourneys:[]}})),...[...placeUses].map(([id,value])=>({type:'place',id,parent:{type:'country',id:value.countryCode},...value})),...[...regionUses].map(([id,journeys])=>({type:'region',id,name:id,journeys}))].map(d=>({...d,available:assets.some(a=>a.destination?.type===d.type&&a.destination.id===d.id),priority:d.type==='country'?(d.eligibleJourneys?.length||0):d.journeys.length})).sort((a,b)=>b.priority-a.priority||a.type.localeCompare(b.type)||a.id.localeCompare(b.id));
const report={schemaVersion:1,summary:{journeys:journeys.length,auto:journeys.filter(j=>j.autoRouteVisual).length,destination:journeys.filter(j=>j.destinationVisual).length,bespoke:journeys.filter(j=>j.journeyCover).length,vertical:journeys.filter(j=>j.vertical).length},journeys,destinationQueue};
await writeFile(new URL('data/platform/visual-coverage.json',ROOT),JSON.stringify(report,null,2)+'\n');
console.log('Visual coverage:',report.summary);
