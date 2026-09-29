import http from 'node:http';
import {readFile,writeFile,mkdir,readdir,access,rename,rm} from 'node:fs/promises';
import {createReadStream,existsSync} from 'node:fs';
import {extname,join,normalize,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {validateTripDraft,normalizeCatalogEntry,validatePublicationReadiness,scaffoldTripDraft,journeyArchetypes} from '../one-world-route-public-mvp/scripts/trip-draft-contract.mjs';
import {buildExperienceCoverage} from '../one-world-route-public-mvp/scripts/experience-coverage-model.mjs';
import {buildMaintenanceQueue} from '../one-world-route-public-mvp/scripts/maintenance-queue-model.mjs';

const here=resolve(fileURLToPath(new URL('.',import.meta.url)));
const publicRoot=resolve(here,'../one-world-route-public-mvp');
const draftsDir=join(publicRoot,'data/platform/drafts');
const tripsDir=join(publicRoot,'data/platform/trips');
const catalogPath=join(publicRoot,'data/platform/trips.json');
const experienceIndexPath=join(publicRoot,'data/platform/place-experiences/index.json');
const tripIndexPath=join(publicRoot,'data/platform/trip-index.json');
const sitemapPath=join(publicRoot,'sitemap.xml');
const host='127.0.0.1',port=Number(process.env.OWR_BUILDER_PORT||4175);
const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json'};
const json=p=>readFile(p,'utf8').then(JSON.parse);
const send=(res,status,data,type='application/json; charset=utf-8')=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store'});res.end(type.startsWith('application/json')?JSON.stringify(data,null,2):data)};
const safeSlug=v=>{const s=String(v||'');if(!slugPattern.test(s))throw new Error('Invalid normalized slug');return s};
const paths=s=>({trip:join(draftsDir,s+'.trip.json'),catalog:join(draftsDir,s+'.catalog.json')});
async function exists(p){try{await access(p);return true}catch{return false}}
async function readBody(req){let s='';for await(const c of req){s+=c;if(s.length>3000000)throw new Error('Payload too large')}return s?JSON.parse(s):{}}
async function atomic(p,v){const tmp=p+'.tmp';await writeFile(tmp,JSON.stringify(v,null,2)+'\n');await rename(tmp,p)}
async function loadDraft(s){const p=paths(s);return{trip:await json(p.trip),catalogEntry:await json(p.catalog)}}
const publicationGenerators=[
  ['Trip index generation',['scripts/build-trip-index.mjs']],
  ['SEO sitemap generation',['scripts/generate-seo.mjs']]
];
const publishChecks=[
  ['Platform data validation',['scripts/validate-platform-data.mjs']],
  ['Public data validation',['scripts/validate-public-data.mjs']],
  ['Platform model tests',['--test','scripts/test-platform-model.mjs']],
  ['Platform locale tests',['--test','scripts/test-platform-i18n.mjs']],
  ['Platform formatter tests',['--test','scripts/test-platform-formatters.mjs']],
  ['Public trip index tests',['--test','scripts/test-trip-index.mjs']],
  ['Share page tests',['--test','scripts/test-share-pages.mjs']],
  ['Platform navigation tests',['--test','scripts/test-platform-navigation.mjs']],
  ['Trip draft contract tests',['--test','scripts/test-trip-draft-contract.mjs']],
  ['Maintenance queue tests',['--test','scripts/test-maintenance-queue.mjs']],
  ['Journey maintenance contract',['scripts/audit-platform-maintenance.mjs']],
  ['Experience coverage tests',['--test','scripts/test-experience-coverage.mjs']],
  ['Regional runtime integration',['--test','scripts/test-regional-runtime.mjs']],
  ['Rail validator tests',['--test','scripts/test-platform-rail-validator.mjs']],
  ['Story controller tests',['--test','scripts/test-platform-story.mjs']],
  ['Continuity tests',['--test','scripts/test-continuity.mjs']]
];

function runNodeSteps(steps){
  const results=[];
  for(const [name,args] of steps){
    const r=spawnSync(process.execPath,args.map(arg=>arg.startsWith('scripts/')?join(publicRoot,arg):arg),{cwd:publicRoot,encoding:'utf8'});
    const result={name,ok:r.status===0,output:String(r.status===0?r.stdout:(r.stderr||r.stdout||'')).trim().slice(-4000)};
    results.push(result);
    if(!result.ok)return{ok:false,results,failed:name};
  }
  return{ok:true,results};
}
const runPublishChecks=()=>runNodeSteps(publishChecks);

async function experienceCoverage(){
  const catalog=await json(catalogPath),datasets=new Map(),profiles=[];
  for(const meta of catalog.trips||[]){
    if(meta.renderer!=='regional-globe')continue;
    const relative=String(meta.dataset||'').replace(/^\.\//,'');
    datasets.set(meta.id,await json(join(publicRoot,relative)));
  }
  const index=await json(experienceIndexPath);
  for(const shardMeta of index.shards||[]){
    const relative=String(shardMeta.dataset||'').replace(/^\.\//,'');
    const shard=await json(join(publicRoot,relative));
    profiles.push(...(shard.profiles||[]));
  }
  return buildExperienceCoverage({catalog,datasets,profiles});
}

async function maintenanceQueue(){
  const catalog=await json(catalogPath),datasets=new Map(),profiles=[];
  const shared=await json(join(publicRoot,'data/platform/shared-knowledge.json')).catch(()=>({items:[],reviewPolicies:{}}));
  for(const meta of catalog.trips||[]){
    if(meta.renderer!=='regional-globe')continue;
    const relative=String(meta.dataset||'').replace(/^\.\//,'');
    datasets.set(meta.id,await json(join(publicRoot,relative)));
  }
  const index=await json(experienceIndexPath);
  for(const shardMeta of index.shards||[]){
    const relative=String(shardMeta.dataset||'').replace(/^\.\//,'');
    const shard=await json(join(publicRoot,relative));
    profiles.push(...(shard.profiles||[]));
  }
  return buildMaintenanceQueue({catalog,datasets,shared,profiles,now:new Date()});
}

async function scaffold(input){
  const slug=safeSlug(input.slug),kind=safeSlug(input.kind||'custom'),catalog=await json(catalogPath),p=paths(slug);
  if(await exists(p.trip)||(catalog.trips||[]).some(t=>t.id===slug))throw new Error('Draft or public trip already exists');
  const result=scaffoldTripDraft({slug,kind,days:input.days||null,catalog});
  await mkdir(draftsDir,{recursive:true});await atomic(p.trip,result.trip);await atomic(p.catalog,result.catalogEntry);return result;
}
async function listDrafts(){
  await mkdir(draftsDir,{recursive:true});const files=await readdir(draftsDir),out=[];
  for(const f of files.filter(x=>x.endsWith('.trip.json')).sort()){const slug=f.slice(0,-10);try{const d=await loadDraft(slug);out.push({slug,kind:d.trip.kind,status:d.trip.status||'draft',title:d.trip.title?.en||slug})}catch{}}
  return out;
}
async function saveDraft(slug,payload){
  slug=safeSlug(slug);if(payload.trip?.id!==slug)throw new Error('Trip ID must match draft slug');
  const catalog=await json(catalogPath),result=validateTripDraft({trip:payload.trip,catalogEntry:payload.catalogEntry,catalog}),p=paths(slug);
  await mkdir(draftsDir,{recursive:true});await atomic(p.trip,payload.trip);await atomic(p.catalog,result.catalogEntry);
  return{...result,trip:payload.trip,catalogEntry:result.catalogEntry};
}
async function clonePublic(slug){
  slug=safeSlug(slug);const catalog=await json(catalogPath),entry=(catalog.trips||[]).find(t=>t.id===slug);
  if(!entry||entry.renderer==='legacy-world')throw new Error('Reusable public trip not found');
  const p=paths(slug);if(await exists(p.trip))throw new Error('Draft already exists');
  const trip=await json(join(publicRoot,String(entry.dataset).replace(/^\.\//,'')));await mkdir(draftsDir,{recursive:true});
  await atomic(p.trip,{...trip,status:'draft'});await atomic(p.catalog,{...entry,status:'draft'});return loadDraft(slug);
}
async function validateSlug(slug){
  const d=await loadDraft(slug),catalog=await json(catalogPath);return validateTripDraft({trip:d.trip,catalogEntry:d.catalogEntry,catalog});
}
async function publish(slug){
  slug=safeSlug(slug);
  const d=await loadDraft(slug),catalog=await json(catalogPath);
  const gate=validateTripDraft({trip:d.trip,catalogEntry:d.catalogEntry,catalog});
  const publication=validatePublicationReadiness(d);
  if(!gate.valid||!publication.valid){
    return {published:false,validation:{...gate,valid:false,errors:[...gate.errors,...publication.errors]},publication};
  }
  const trip={...d.trip};
  const entry={...normalizeCatalogEntry(d.catalogEntry,trip)};
  const existingIndex=(catalog.trips||[]).findIndex(t=>t.id===slug);
  const trips=[...(catalog.trips||[])];
  if(existingIndex>=0)trips[existingIndex]=entry;else trips.push(entry);
  const next={...catalog,updatedAt:new Date().toISOString().slice(0,10),trips};
  const target=join(tripsDir,slug+'.json');
  const snapshots=new Map();
  for(const filePath of [catalogPath,target,tripIndexPath,sitemapPath]){
    snapshots.set(filePath,await readFile(filePath).catch(()=>null));
  }
  const restore=async()=>{
    for(const [filePath,value] of snapshots){
      if(value===null)await rm(filePath,{force:true});
      else await writeFile(filePath,value);
    }
  };
  try{
    await atomic(target,trip);
    await atomic(catalogPath,next);
    const generation=runNodeSteps(publicationGenerators);
    if(!generation.ok){
      const failed=generation.results.find(result=>!result.ok);
      throw new Error((failed?.name||'Publication artifact generation')+' failed'+(failed?.output?'\\n'+failed.output:''));
    }
    const quality=runPublishChecks();
    if(!quality.ok){
      const failed=quality.results.find(result=>!result.ok);
      throw new Error((failed?.name||'Publish quality gate')+' failed'+(failed?.output?'\\n'+failed.output:''));
    }
    await atomic(paths(slug).trip,trip);
    await atomic(paths(slug).catalog,entry);
    return {published:true,validation:gate,publication,generation:generation.results,qualityChecks:[...generation.results,...quality.results]};
  }catch(error){
    await restore();
    throw error;
  }
}
function cookieDraft(req){const m=String(req.headers.cookie||'').match(/(?:^|;\s*)owr_builder_draft=([^;]+)/);return m?decodeURIComponent(m[1]):null}
async function file(res,p){if(!existsSync(p))return false;res.writeHead(200,{'content-type':mime[extname(p)]||'application/octet-stream','cache-control':'no-store'});createReadStream(p).pipe(res);return true}

async function handler(req,res){
  const u=new URL(req.url,'http://'+host+':'+port),pathname=decodeURIComponent(u.pathname);
  try{
    if(pathname==='/__builder'||pathname==='/__builder/')return void await file(res,join(here,'index.html'));
    if(pathname==='/__builder/app.js')return void await file(res,join(here,'app.js'));
    if(pathname==='/__builder/styles.css')return void await file(res,join(here,'styles.css'));
    if(pathname==='/__builder/api/state'&&req.method==='GET')return send(res,200,{ok:true,catalog:await json(catalogPath),drafts:await listDrafts(),archetypes:journeyArchetypes()});
    if(pathname==='/__builder/api/experience-coverage'&&req.method==='GET')return send(res,200,{ok:true,coverage:await experienceCoverage()});
    if(pathname==='/__builder/api/maintenance-queue'&&req.method==='GET')return send(res,200,{ok:true,queue:await maintenanceQueue()});
    if(pathname==='/__builder/api/scaffold'&&req.method==='POST')return send(res,201,{ok:true,...await scaffold(await readBody(req))});
    if(pathname==='/__builder/api/clone'&&req.method==='POST'){const b=await readBody(req);return send(res,201,{ok:true,...await clonePublic(b.slug)})}
    const m=pathname.match(/^\/__builder\/api\/draft\/([a-z0-9-]+)(?:\/(validate|publish))?$/);
    if(m){
      const slug=safeSlug(m[1]),action=m[2];
      if(req.method==='GET'&&!action)return send(res,200,{ok:true,...await loadDraft(slug)});
      if(req.method==='PUT'&&!action)return send(res,200,{ok:true,...await saveDraft(slug,await readBody(req))});
      if(req.method==='POST'&&action==='validate')return send(res,200,{ok:true,...await validateSlug(slug)});
      if(req.method==='POST'&&action==='publish')return send(res,200,{ok:true,...await publish(slug)});
    }
    if(pathname==='/data/platform/trips.json'){
      const slug=cookieDraft(req);
      if(slug&&slugPattern.test(slug)&&await exists(paths(slug).trip)){
        const catalog=await json(catalogPath),d=await loadDraft(slug),entry={...normalizeCatalogEntry(d.catalogEntry,d.trip),dataset:'./data/platform/drafts/'+slug+'.trip.json'};
        return send(res,200,{...catalog,trips:[...(catalog.trips||[]).filter(t=>t.id!==slug),entry]});
      }
    }
    if(pathname==='/'&&u.searchParams.get('__draft'))res.setHeader('set-cookie','owr_builder_draft='+encodeURIComponent(safeSlug(u.searchParams.get('__draft')))+'; Path=/; SameSite=Strict');
    const rel=pathname==='/'?'index.html':pathname.replace(/^\//,''),p=resolve(publicRoot,normalize(rel));
    if(!p.startsWith(publicRoot))throw new Error('Forbidden');
    if(await file(res,p))return;send(res,404,{ok:false,error:'Not found'});
  }catch(e){console.error(e);send(res,400,{ok:false,error:e.message})}
}
http.createServer(handler).listen(port,host,()=>console.log('ONE WORLD ROUTE Trip Builder: http://'+host+':'+port+'/__builder/'));
