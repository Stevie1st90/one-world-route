import {readFile,writeFile} from 'node:fs/promises';
import '../platform/visual-policy.js';
const ROOT=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,ROOT),'utf8'));
const catalog=await read('data/platform/trips.json'),registry=await read('data/platform/generated-media.json'),auto=await read('data/platform/route-visuals.json'),regions=await read('data/platform/region-visuals.json');
const policy=globalThis.ONE_WORLD_VISUAL_POLICY;
const destinationAssets=(registry.assets||[]).filter(a=>a.destination&&policy.usable(a));
const journeys=[];
for(const meta of catalog.trips){
  const trip=await read(meta.dataset.replace(/^\.\//,'')),route=auto.journeys.find(j=>j.id===meta.id);
  const reference=trip.media?.heroAssetId||meta.visual?.coverAssetId;
  const cover=(registry.assets||[]).find(a=>a.assetId===reference&&!a.destination&&(!a.tripId||a.tripId===meta.id));
  const journeyCover=policy.usable(cover)?cover:policy.usable(trip.media?.hero)?trip.media.hero:null;
  const context={journeyCover,destinationAssets,autoRouteVisual:route?.media,countries:route?.countries||[]};
  const resolved=policy.resolveJourneyVisual({...meta,visualAnchor:meta.visualAnchor||trip.visualAnchor},context),gallery=trip.media?.gallery||[];
  const destination=policy.destinationCandidate({...meta,visualAnchor:meta.visualAnchor||trip.visualAnchor},destinationAssets,context.countries);
  journeys.push({id:meta.id,slug:meta.slug,status:resolved.entry?'licensed-local':'art-directed',countries:context.countries,visualAnchor:meta.visualAnchor||trip.visualAnchor||null,hero:resolved.entry||trip.media?.hero||null,journeyCover,autoRouteVisual:route?.media||null,coverageLevel:resolved.coverageLevel,resolvedKind:resolved.kind,destinationAssetId:destination?.assetId||null,galleryCount:gallery.length,licensedImageCount:gallery.filter(a=>a.type==='image').length+(resolved.entry?1:0)});
}
const report={schemaVersion:3,updatedAt:catalog.updatedAt||null,summary:{journeys:journeys.length,artDirected:journeys.filter(j=>j.status==='art-directed').length,licensedLocal:journeys.filter(j=>j.status==='licensed-local').length,missing:journeys.filter(j=>!j.hero).length},destinationAssets,regionAssets:regions.assets,journeys:journeys.sort((a,b)=>a.id.localeCompare(b.id))};
await writeFile(new URL('data/platform/media-manifest.json',ROOT),JSON.stringify(report,null,2)+'\n');
console.log('Built media manifest:',report.summary);
