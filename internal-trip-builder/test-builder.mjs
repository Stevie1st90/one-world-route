import {spawn} from 'node:child_process';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const here=resolve(fileURLToPath(new URL('.',import.meta.url)));
const root=resolve(here,'../one-world-route-public-mvp');
const catalogPath=join(root,'data/platform/trips.json');
const slug='ci-builder-proof';
const draftTrip=join(root,'data/platform/drafts/'+slug+'.trip.json');
const draftCatalog=join(root,'data/platform/drafts/'+slug+'.catalog.json');
const publicTrip=join(root,'data/platform/trips/'+slug+'.json');
const originalCatalog=await readFile(catalogPath,'utf8');
const server=spawn(process.execPath,[join(here,'server.mjs')],{stdio:['ignore','pipe','pipe']});
const base='http://127.0.0.1:4175';
const wait=async()=>{
  for(let i=0;i<50;i++){try{const r=await fetch(base+'/__builder/api/state');if(r.ok)return}catch{}await new Promise(r=>setTimeout(r,100))}
  throw new Error('Trip Builder server did not start');
};
const request=async(path,opt={})=>{const r=await fetch(base+path,{headers:{'content-type':'application/json',...(opt.headers||{})},...opt});const j=await r.json();if(!r.ok||j.ok===false)throw new Error(j.error||'Request failed');return j};
try{
  await wait();
  const state=await request('/__builder/api/state');assert.ok(state.catalog.trips.some(t=>t.id==='world-195'));
  await request('/__builder/api/scaffold',{method:'POST',body:JSON.stringify({slug,kind:'rail',days:2})});
  const title=Object.fromEntries(state.catalog.supportedLocales.map(l=>[l,'CI Builder Proof']));
  const subtitle=Object.fromEntries(state.catalog.supportedLocales.map(l=>[l,'Two-day CI rail proof']));
  const trip={schemaVersion:1,id:slug,slug,kind:'rail',status:'draft',defaultLocale:state.catalog.defaultLocale,supportedLocales:state.catalog.supportedLocales,title,summary:title,planning:{days:2,currency:'EUR'},places:[
    {id:'a',countryCode:'DE',name:title,coordinates:{lat:50,lng:8}},
    {id:'b',countryCode:'FR',name:title,coordinates:{lat:49,lng:7}}
  ],stops:[{id:'s1',sequence:1,placeId:'a'},{id:'s2',sequence:2,placeId:'b'}],segments:[{
    id:'seg1',sequence:1,fromStopId:'s1',toStopId:'s2',transport:{mode:'rail',stages:[{mode:'rail',sourceIds:['src']}]},
    verification:{status:'verified',sourceIds:['src'],lastVerified:'2026-09-22'}
  }],chapters:[],sources:[{id:'src',title:'CI Operator',issuer:'CI Operator',issuerType:'official-operator',url:'https://example.com/rail',checkedAt:'2026-09-22'}],extensions:{rail:{scope:'rail-only',sourcePolicy:'official-operator',crossBorder:true}}};
  const catalogEntry={id:slug,slug,kind:'rail',status:'draft',renderer:'regional-globe',dataset:'./data/platform/trips/'+slug+'.json',title,subtitle,capabilities:['globe','story','terrain','source-evidence'],discovery:{regions:['europe'],themes:['rail'],modes:['rail'],durationBand:'7-14',fit:{pace:'balanced',seasons:['multi-season'],party:['solo'],startRegion:'europe',accessibility:'standard-check'}}};
  const saved=await request('/__builder/api/draft/'+slug,{method:'PUT',body:JSON.stringify({trip,catalogEntry})});assert.equal(saved.valid,true,saved.errors?.join('\n'));
  const validated=await request('/__builder/api/draft/'+slug+'/validate',{method:'POST'});assert.equal(validated.valid,true);
  const page=await fetch(base+'/?trip='+slug+'&__draft='+slug,{redirect:'manual'});const cookie=page.headers.get('set-cookie');assert.match(cookie,/owr_builder_draft=/);
  const preview=await fetch(base+'/data/platform/trips.json',{headers:{cookie:cookie.split(';')[0]}}).then(r=>r.json());
  const injected=preview.trips.find(t=>t.id===slug);assert.ok(injected);assert.equal(injected.dataset,'./data/platform/drafts/'+slug+'.trip.json');
  const published=await request('/__builder/api/draft/'+slug+'/publish',{method:'POST'});assert.equal(published.published,true);
  const publicCatalog=JSON.parse(await readFile(catalogPath,'utf8'));assert.ok(publicCatalog.trips.some(t=>t.id===slug));
  console.log('Internal Trip Builder smoke complete: draft -> validate -> preview -> publish');
}finally{
  server.kill('SIGTERM');
  await writeFile(catalogPath,originalCatalog);
  await rm(draftTrip,{force:true});await rm(draftCatalog,{force:true});await rm(publicTrip,{force:true});
}