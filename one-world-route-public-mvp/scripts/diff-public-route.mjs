import {readFile,writeFile} from 'node:fs/promises';
const [oldPath,newPath,outPath]=process.argv.slice(2);
if(!oldPath||!newPath)throw new Error('Usage: node scripts/diff-public-route.mjs <old.json> <new.json> [output.json]');
const oldData=JSON.parse(await readFile(oldPath,'utf8')),newData=JSON.parse(await readFile(newPath,'utf8'));
const watchedSegment=['from','to','planDeparture','planArrival','mode','corridor','feasibility','dataQuality','bookingTier','planStatus','transportBudgetEur','visaTypeTarget','visaStatusTarget','healthPriorityTarget','healthStatusTarget','planB','lastVerified','alertLevel','alertMessage'];
const watchedCountry=['readiness','visaType','visaAction','visaStatus','healthPriority','healthStatus','healthNote','entryConflict','entryDocs','planEntry'];
const keyMap=(rows,key)=>new Map((rows||[]).map(x=>[String(x[key]),x]));
const oldSeg=keyMap(oldData.segments,'id'),newSeg=keyMap(newData.segments,'id'),oldCountry=keyMap(oldData.countries,'number'),newCountry=keyMap(newData.countries,'number');
const changes=[];
function compare(kind,id,before,after,fields,label){
  if(!before||!after){changes.push({kind,id,label,type:before?'removed':'added'});return}
  const changed={};for(const f of fields){if(JSON.stringify(before[f])!==JSON.stringify(after[f]))changed[f]={from:before[f]??null,to:after[f]??null}}
  if(Object.keys(changed).length)changes.push({kind,id,label,type:'updated',changed});
}
for(const [id,row] of newSeg)compare('segment',Number(id),oldSeg.get(id),row,watchedSegment,(row.from||'?')+' → '+(row.to||'?'));
for(const [id,row] of oldSeg)if(!newSeg.has(id))compare('segment',Number(id),row,null,watchedSegment,(row.from||'?')+' → '+(row.to||'?'));
for(const [id,row] of newCountry)compare('country',Number(id),oldCountry.get(id),row,watchedCountry,row.name||id);
for(const [id,row] of oldCountry)if(!newCountry.has(id))compare('country',Number(id),row,null,watchedCountry,row.name||id);
const result={generatedAt:new Date().toISOString(),summary:{total:changes.length,segments:changes.filter(x=>x.kind==='segment').length,countries:changes.filter(x=>x.kind==='country').length},changes};
const json=JSON.stringify(result,null,2);
if(outPath)await writeFile(outPath,json);else console.log(json);