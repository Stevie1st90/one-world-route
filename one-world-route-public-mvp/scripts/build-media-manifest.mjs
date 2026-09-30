import {readFile,writeFile} from 'node:fs/promises';

const ROOT=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('data/platform/trips.json',ROOT),'utf8'));
const trips=[];
const generated=JSON.parse(await readFile(new URL('data/platform/generated-media.json',ROOT),'utf8'));

for(const meta of catalog.trips||[]){
  if(!meta.dataset)continue;
  const trip=JSON.parse(await readFile(new URL(String(meta.dataset).replace(/^\.\//,''),ROOT),'utf8'));
  const reference=trip.media?.heroAssetId||meta.visual?.coverAssetId;
  const candidate=generated.assets.find(a=>a.assetId===reference&&a.status==='published'&&a.rightsStatus==='approved');
  const hero=candidate||trip.media?.hero||null;
  const gallery=Array.isArray(trip.media?.gallery)?trip.media.gallery:[];
  const mediaItems=[hero,...gallery].filter(Boolean);
  const imageItems=mediaItems.filter(item=>item.type==='image');
  const status=imageItems.length?'licensed-local':hero?.type==='art-directed'?'art-directed':'missing';
  trips.push({
    id:meta.id,
    slug:meta.slug,
    status,
    hero:hero?{...hero}:null,
    galleryCount:gallery.length,
    licensedImageCount:imageItems.length
  });
}

const report={
  schemaVersion:1,
  updatedAt:catalog.updatedAt||null,
  summary:{
    journeys:trips.length,
    artDirected:trips.filter(item=>item.status==='art-directed').length,
    licensedLocal:trips.filter(item=>item.status==='licensed-local').length,
    missing:trips.filter(item=>item.status==='missing').length
  },
  journeys:trips.sort((a,b)=>a.id.localeCompare(b.id))
};

await writeFile(new URL('data/platform/media-manifest.json',ROOT),JSON.stringify(report,null,2)+'\n');
console.log('Built media manifest:',report.summary);
