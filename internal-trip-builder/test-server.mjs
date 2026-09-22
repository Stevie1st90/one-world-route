import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createDraft} from './lib.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const repoRoot=resolve(here,'..');
const publicRoot=resolve(repoRoot,'one-world-route-public-mvp');
const catalogPath=resolve(publicRoot,'data/platform/trips.json');
const slug='builder-ci-proof';
const draftPath=resolve(here,'drafts',slug+'.json');
const reportPath=resolve(here,'drafts',slug+'.report.json');
const tripPath=resolve(publicRoot,'data/platform/trips',slug+'.json');
const base='http://127.0.0.1:4318';

const originalCatalog=await readFile(catalogPath,'utf8');
let child;

async function request(path,options={}){
  const r=await fetch(base+path,{headers:{'Content-Type':'application/json'},...options});
  const body=await r.json().catch(()=>null);
  return {r,body};
}
async function waitForServer(){
  for(let i=0;i<60;i++){
    try{const r=await fetch(base+'/api/state');if(r.ok)return}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error('builder server did not start');
}
async function cleanup(){
  child?.kill('SIGTERM');
  await writeFile(catalogPath,originalCatalog);
  await Promise.all([unlink(draftPath).catch(()=>{}),unlink(reportPath).catch(()=>{}),unlink(tripPath).catch(()=>{})]);
}

test('local builder serves preview and publish gate end to end',async t=>{
  t.after(cleanup);
  child=spawn(process.execPath,[resolve(here,'server.mjs')],{
    cwd:repoRoot,
    env:{...process.env,OWR_BUILDER_PORT:'4318'},
    stdio:['ignore','pipe','pipe']
  });
  await waitForServer();
  const catalog=JSON.parse(originalCatalog);
  const draft=createDraft(catalog,{slug,kind:'cycling',days:5,title:'Builder CI Proof'});
  const all=value=>Object.fromEntries(catalog.supportedLocales.map(l=>[l,value]));
  draft.trip.status='sourced-beta';
  draft.catalogEntry.status='sourced-beta';
  draft.trip.title=all('Builder CI Proof');
  draft.trip.summary=all('A local builder integration proof using the shared regional trip contract.');
  draft.catalogEntry.title=all('Builder CI Proof');
  draft.catalogEntry.subtitle=all('5 days · internal builder integration proof');
  draft.catalogEntry.discovery={regions:['europe'],themes:['cycling'],modes:['bicycle'],durationBand:'7-14',featured:false,fit:{pace:'active',seasons:['summer'],party:['solo','couples'],startRegion:'europe',accessibility:'complex-planning'}};
  draft.trip.places=[
    {id:'proof-a',type:'city',countryCode:'DE',name:{en:'Proof A'},coordinates:{lat:50,lng:8}},
    {id:'proof-b',type:'city',countryCode:'DE',name:{en:'Proof B'},coordinates:{lat:50.5,lng:8.5}}
  ];
  draft.trip.stops=[
    {id:'proof-stop-a',sequence:1,placeId:'proof-a',dayStart:1,dayEnd:2,nights:2},
    {id:'proof-stop-b',sequence:2,placeId:'proof-b',dayStart:3,dayEnd:5,nights:3}
  ];
  draft.trip.sources=[{id:'proof-source',title:'Proof source',issuer:'ONE WORLD ROUTE QA',issuerType:'primary-source',url:'https://example.com/proof',checkedAt:'2026-09-22'}];
  draft.trip.segments=[{id:'proof-leg',sequence:1,fromStopId:'proof-stop-a',toStopId:'proof-stop-b',transport:{mode:'bicycle',stages:[]},planning:{durationMinutes:null,durationBasis:'live-timetable-required'},verification:{status:'current-check-required',lastVerified:'2026-09-22',sourceIds:['proof-source']}}];

  const created=await request('/api/drafts',{method:'POST',body:JSON.stringify({slug,kind:'cycling',days:5,title:'Builder CI Proof'})});
  assert.equal(created.r.status,201);
  const saved=await request('/api/drafts/'+slug,{method:'PUT',body:JSON.stringify(draft)});
  assert.equal(saved.r.status,200);

  const validation=await request('/api/drafts/'+slug+'/validate',{method:'POST',body:'{}'});
  assert.equal(validation.r.status,200);
  assert.equal(validation.body.ok,true,JSON.stringify(validation.body.errors));

  const previewCatalog=await request('/preview/'+slug+'/data/platform/trips.json');
  assert.equal(previewCatalog.r.status,200);
  assert.ok(previewCatalog.body.trips.some(item=>item.id===slug&&item.kind==='cycling'));

  const previewTrip=await request('/preview/'+slug+'/data/platform/trips/'+slug+'.json');
  assert.equal(previewTrip.r.status,200);
  assert.equal(previewTrip.body.id,slug);

  const previewIndex=await fetch(base+'/preview/'+slug+'/?trip='+slug);
  assert.equal(previewIndex.ok,true);
  assert.match(await previewIndex.text(),/features\.bundle\.js/);

  const published=await request('/api/drafts/'+slug+'/publish',{method:'POST',body:'{}'});
  assert.equal(published.r.status,200,JSON.stringify(published.body));
  assert.equal(published.body.ok,true);

  const publicCatalog=JSON.parse(await readFile(catalogPath,'utf8'));
  assert.ok(publicCatalog.trips.some(item=>item.id===slug));
  const publicTrip=JSON.parse(await readFile(tripPath,'utf8'));
  assert.equal(publicTrip.kind,'cycling');
});
