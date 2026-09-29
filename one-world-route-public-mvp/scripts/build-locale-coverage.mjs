import {readFile,writeFile} from 'node:fs/promises';

const ROOT=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('data/platform/trips.json',ROOT),'utf8'));
const locales=Array.isArray(catalog.supportedLocales)&&catalog.supportedLocales.length?catalog.supportedLocales:['en'];
const checkMode=process.argv.includes('--check');

const text=value=>String(value??'').trim();
const hasLocale=(value,locale)=>typeof value==='string'?Boolean(text(value)):Boolean(text(value?.[locale]));
const datasetUrl=value=>new URL(String(value||'').replace(/^\.\//,''),ROOT);

function addField(rows,{tripId,field,value}){
  for(const locale of locales)rows.push({tripId,field,locale,ok:hasLocale(value,locale)});
}

const rows=[];
for(const meta of catalog.trips||[]){
  addField(rows,{tripId:meta.id,field:'catalog.title',value:meta.title});
  addField(rows,{tripId:meta.id,field:'catalog.subtitle',value:meta.subtitle});
  if(!meta.dataset)continue;
  let trip;
  try{trip=JSON.parse(await readFile(datasetUrl(meta.dataset),'utf8'))}
  catch{continue}
  addField(rows,{tripId:meta.id,field:'trip.summary',value:trip.summary});
  for(const place of trip.places||[])addField(rows,{tripId:meta.id,field:'place.'+place.id+'.name',value:place.name});
  for(const chapter of trip.chapters||[])addField(rows,{tripId:meta.id,field:'chapter.'+chapter.id+'.title',value:chapter.title});
  for(let i=0;i<(trip.highlights||[]).length;i++){
    const highlight=trip.highlights[i];
    if(typeof highlight==='object')addField(rows,{tripId:meta.id,field:'highlight.'+(i+1),value:highlight});
  }
}

const byTrip=(catalog.trips||[]).map(meta=>{
  const tripRows=rows.filter(row=>row.tripId===meta.id);
  const localeCoverage=Object.fromEntries(locales.map(locale=>{
    const localeRows=tripRows.filter(row=>row.locale===locale);
    const missing=localeRows.filter(row=>!row.ok).map(row=>row.field);
    return [locale,{
      checked:localeRows.length,
      complete:localeRows.length-missing.length,
      missing,
      coveragePct:localeRows.length?Math.round((localeRows.length-missing.length)*100/localeRows.length):100
    }];
  }));
  const missingTotal=Object.values(localeCoverage).reduce((sum,item)=>sum+item.missing.length,0);
  return {id:meta.id,slug:meta.slug,status:meta.status,missingTotal,complete:missingTotal===0,locales:localeCoverage};
}).sort((a,b)=>Number(a.complete)-Number(b.complete)||b.missingTotal-a.missingTotal||a.id.localeCompare(b.id));

const totals=Object.fromEntries(locales.map(locale=>{
  const localeRows=rows.filter(row=>row.locale===locale);
  const missing=localeRows.filter(row=>!row.ok).length;
  return [locale,{
    checked:localeRows.length,
    complete:localeRows.length-missing,
    missing,
    coveragePct:localeRows.length?Math.round((localeRows.length-missing)*100/localeRows.length):100
  }];
}));

const report={
  schemaVersion:1,
  updatedAt:catalog.updatedAt||null,
  supportedLocales:locales,
  summary:{
    journeys:byTrip.length,
    completeJourneys:byTrip.filter(item=>item.complete).length,
    incompleteJourneys:byTrip.filter(item=>!item.complete).length,
    localeCoverage:totals
  },
  journeys:byTrip
};
const out=new URL('data/platform/locale-coverage.json',ROOT);
const serialized=JSON.stringify(report,null,2)+'\n';

if(checkMode){
  let existing='';
  try{existing=await readFile(out,'utf8')}catch{}
  if(existing!==serialized){
    console.error('Locale coverage artifact is stale. Run node scripts/build-locale-coverage.mjs');
    process.exit(1);
  }
  console.log('Locale coverage artifact current:',report.summary.completeJourneys+'/'+report.summary.journeys,'journeys complete');
}else{
  await writeFile(out,serialized);
  console.log('Built locale coverage:',report.summary.completeJourneys+'/'+report.summary.journeys,'journeys complete');
}
