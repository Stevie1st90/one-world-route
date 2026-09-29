import {spawn} from 'node:child_process';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const here=resolve(fileURLToPath(new URL('.',import.meta.url)));
const root=resolve(here,'../one-world-route-public-mvp');
const catalogPath=join(root,'data/platform/trips.json');
const tripIndexPath=join(root,'data/platform/trip-index.json');
const sitemapPath=join(root,'sitemap.xml');
const slug='ci-builder-proof';
const draftTrip=join(root,'data/platform/drafts/'+slug+'.trip.json');
const draftCatalog=join(root,'data/platform/drafts/'+slug+'.catalog.json');
const publicTrip=join(root,'data/platform/trips/'+slug+'.json');
const originalCatalog=await readFile(catalogPath,'utf8');
const originalTripIndex=await readFile(tripIndexPath,'utf8');
const originalSitemap=await readFile(sitemapPath,'utf8');
const server=spawn(process.execPath,[join(here,'server.mjs')],{stdio:['ignore','pipe','pipe']});
const base='http://127.0.0.1:4175';
const wait=async()=>{
  for(let i=0;i<50;i++){try{const r=await fetch(base+'/__builder/api/state');if(r.ok)return}catch{}await new Promise(r=>setTimeout(r,100))}
  throw new Error('Trip Builder server did not start');
};
const request=async(path,opt={})=>{const r=await fetch(base+path,{headers:{'content-type':'application/json',...(opt.headers||{})},...opt});const j=await r.json();if(!r.ok||j.ok===false)throw new Error(j.error||'Request failed');return j};
try{
  await wait();
  const state=await request('/__builder/api/state');assert.ok(state.catalog.trips.some(t=>t.id==='world-195'));assert.ok(state.archetypes.includes('rail'));assert.ok(state.archetypes.includes('road-trip'));
  const maintenance=await request('/__builder/api/maintenance-queue');assert.equal(Array.isArray(maintenance.queue.items),true);assert.equal(maintenance.queue.summary.journeys>=16,true);assert.equal(Number.isFinite(maintenance.queue.summary.uniqueExternalSources),true);
  const coverage=await request('/__builder/api/experience-coverage');assert.equal(coverage.coverage.summary.journeys>=16,true);assert.equal(coverage.coverage.summary.coveredPlaces>0,true);assert.equal(Array.isArray(coverage.coverage.queue),true);assert.equal(coverage.coverage.journeys.some(item=>item.tripId==='japan-by-rail'&&item.coveragePct===100),true);
  const scaffolded=await request('/__builder/api/scaffold',{method:'POST',body:JSON.stringify({slug,kind:'rail',days:2})});assert.equal(scaffolded.trip.routePolicy.reversible,true);assert.equal(scaffolded.trip.maintenance.sourceReviewDays,90);assert.deepEqual(scaffolded.catalogEntry.discovery.regions,['global']);assert.ok(scaffolded.catalogEntry.capabilities.includes('trip-planning'));
  const skeletoned=await request('/__builder/api/draft/'+slug+'/skeleton',{method:'POST',body:JSON.stringify({mode:'rail',text:'Berlin | DE | 52.5200 | 13.4050 | 1\nParis | FR | 48.8566 | 2.3522 | 2\nLyon | FR | 45.7640 | 4.8357 | 1'})});
  assert.equal(skeletoned.trip.places.length,3);assert.equal(skeletoned.trip.stops.length,3);assert.equal(skeletoned.trip.segments.length,2);assert.equal(skeletoned.trip.planning.days,4);assert.equal(skeletoned.trip.segments.every(segment=>segment.verification.status==='draft'),true);assert.equal(skeletoned.valid,false);assert.match(skeletoned.errors.join('\\n'),/source evidence/);
  const evidenced=await request('/__builder/api/draft/'+slug+'/evidence',{method:'POST',body:JSON.stringify({segments:'1-2',status:'current-check-required',notes:'CI explicit evidence',source:{id:'ci-route-source',title:'CI Route Source',issuer:'CI Operator',issuerType:'official-operator',url:'https://example.com/ci-route',checkedAt:'2026-09-29',claims:['CI route support']}})});
  assert.equal(evidenced.trip.sources.some(source=>source.id==='ci-route-source'),true);assert.equal(evidenced.trip.segments.every(segment=>segment.verification.sourceIds.includes('ci-route-source')),true);assert.equal(evidenced.trip.segments.every(segment=>segment.verification.status==='current-check-required'),true);assert.equal(evidenced.trip.segments.every(segment=>segment.verification.lastVerified==='2026-09-29'),true);
  const title=Object.fromEntries(state.catalog.supportedLocales.map(l=>[l,'CI Builder Proof']));
  const subtitle=Object.fromEntries(state.catalog.supportedLocales.map(l=>[l,'Two-day CI rail proof']));
  const trip={schemaVersion:1,id:slug,slug,kind:'rail',status:'draft',defaultLocale:state.catalog.defaultLocale,supportedLocales:state.catalog.supportedLocales,title,summary:title,planning:{days:2,currency:'EUR'},places:[
    {id:'a',countryCode:'DE',type:'city',name:title,coordinates:{lat:50,lng:8}},
    {id:'b',countryCode:'FR',type:'city',name:title,coordinates:{lat:49,lng:7}}
  ],stops:[{id:'s1',sequence:1,placeId:'a',dayStart:1,dayEnd:1,nights:1},{id:'s2',sequence:2,placeId:'b',dayStart:2,dayEnd:2,nights:0}],segments:[{
    id:'seg1',sequence:1,fromStopId:'s1',toStopId:'s2',transport:{mode:'rail',stages:[{mode:'rail',sourceIds:['src']}]},
    verification:{status:'verified',sourceIds:['src'],lastVerified:'2026-09-22'}
  }],chapters:[],sources:[{id:'src',title:'CI Operator',issuer:'CI Operator',issuerType:'official-operator',url:'https://example.com/rail',checkedAt:'2026-09-22'}],extensions:{rail:{scope:'rail-only',sourcePolicy:'official-operator',crossBorder:true}}};
  const catalogEntry={id:slug,slug,kind:'rail',status:'draft',renderer:'regional-globe',dataset:'./data/platform/trips/'+slug+'.json',title,subtitle,capabilities:['globe','story','terrain','source-evidence','trip-planning'],discovery:{regions:['europe'],themes:['rail'],modes:['rail'],durationBand:'7-14',fit:{pace:'balanced',seasons:['multi-season'],party:['solo'],startRegion:'europe',accessibility:'standard-check'}}};
  const saved=await request('/__builder/api/draft/'+slug,{method:'PUT',body:JSON.stringify({trip,catalogEntry})});assert.equal(saved.valid,true,saved.errors?.join('\n'));
  const validated=await request('/__builder/api/draft/'+slug+'/validate',{method:'POST'});assert.equal(validated.valid,true);
  const page=await fetch(base+'/?trip='+slug+'&__draft='+slug,{redirect:'manual'});const cookie=page.headers.get('set-cookie');assert.match(cookie,/owr_builder_draft=/);
  const preview=await fetch(base+'/data/platform/trips.json',{headers:{cookie:cookie.split(';')[0]}}).then(r=>r.json());
  const injected=preview.trips.find(t=>t.id===slug);assert.ok(injected);assert.equal(injected.dataset,'./data/platform/drafts/'+slug+'.trip.json');
  const blocked=await request('/__builder/api/draft/'+slug+'/publish',{method:'POST'});
  assert.equal(blocked.published,false);
  assert.match(blocked.validation.errors.join('\\n'),/explicit public status/);

  trip.status='sourced-beta';catalogEntry.status='sourced-beta';
  const publishReady=await request('/__builder/api/draft/'+slug,{method:'PUT',body:JSON.stringify({trip,catalogEntry})});
  assert.equal(publishReady.valid,true,publishReady.errors?.join('\\n'));
  const published=await request('/__builder/api/draft/'+slug+'/publish',{method:'POST'});assert.equal(published.published,true);
  assert.equal(published.publication.valid,true);
  assert.equal(Array.isArray(published.generation),true);
  assert.equal(published.generation.every(check=>check.ok===true),true);
  assert.equal(Array.isArray(published.qualityChecks),true);
  assert.equal(published.qualityChecks.every(check=>check.ok===true),true);
  assert.equal(published.qualityChecks.length>=12,true);
  const publicCatalog=JSON.parse(await readFile(catalogPath,'utf8'));assert.ok(publicCatalog.trips.some(t=>t.id===slug&&t.status==='sourced-beta'));
  const tripIndex=JSON.parse(await readFile(tripIndexPath,'utf8'));assert.ok(tripIndex.trips.some(t=>t.id===slug));
  const sitemap=await readFile(sitemapPath,'utf8');assert.match(sitemap,new RegExp('/trip/'+slug));
  console.log('Internal Trip Builder smoke complete: draft -> validate -> preview -> explicit status -> publish -> generated artifacts');
}finally{
  server.kill('SIGTERM');
  await writeFile(catalogPath,originalCatalog);
  await writeFile(tripIndexPath,originalTripIndex);
  await writeFile(sitemapPath,originalSitemap);
  await rm(draftTrip,{force:true});await rm(draftCatalog,{force:true});await rm(publicTrip,{force:true});
}