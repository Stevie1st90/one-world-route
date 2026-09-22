import http from 'node:http';
import {readFile,writeFile,mkdir,readdir,access,rename,rm} from 'node:fs/promises';
import {createReadStream,existsSync} from 'node:fs';
import {extname,join,normalize,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {validateTripDraft,normalizeCatalogEntry} from '../one-world-route-public-mvp/scripts/trip-draft-contract.mjs';

const here=resolve(fileURLToPath(new URL('.',import.meta.url)));
const publicRoot=resolve(here,'../one-world-route-public-mvp');
const draftsDir=join(publicRoot,'data/platform/drafts');
const tripsDir=join(publicRoot,'data/platform/trips');
const catalogPath=join(publicRoot,'data/platform/trips.json');
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
const localized=(locales,v)=>Object.fromEntries(locales.map(l=>[l,v]));
const band=d=>d==null?'7-14':d<=14?'7-14':d<=30?'15-30':d<=89?'31-89':'90-plus';

async function scaffold(input){
  const slug=safeSlug(input.slug),kind=safeSlug(input.kind||'custom'),catalog=await json(catalogPath),p=paths(slug);
  if(await exists(p.trip)||(catalog.trips||[]).some(t=>t.id===slug))throw new Error('Draft or public trip already exists');
  const locales=catalog.supportedLocales||['en'],human=slug.split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join(' '),days=input.days?Number(input.days):null;
  const trip={schemaVersion:1,id:slug,slug,kind,status:'draft',defaultLocale:catalog.defaultLocale||'en',supportedLocales:[...locales],title:localized(locales,human),summary:localized(locales,'TODO — editorial summary'),geography:{regions:[],countries:[]},planning:{days,currency:'EUR'},rendering:{},places:[],stops:[],segments:[],chapters:[],travellerContext:{scope:[]},sources:[],extensions:{}};
  const catalogEntry={id:slug,slug,kind,status:'draft',renderer:'regional-globe',dataset:'./data/platform/trips/'+slug+'.json',title:localized(locales,human),subtitle:localized(locales,'TODO — discovery subtitle'),metrics:{},capabilities:['globe','story','terrain'],discovery:{regions:['europe'],themes:[kind],modes:[kind==='road-trip'?'road':kind],durationBand:band(days),fit:{pace:'balanced',seasons:['multi-season'],party:['solo','couples','friends'],startRegion:'europe',accessibility:'standard-check'}}};
  await mkdir(draftsDir,{recursive:true});await atomic(p.trip,trip);await atomic(p.catalog,catalogEntry);return{trip,catalogEntry};
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
  slug=safeSlug(slug);const d=await loadDraft(slug),catalog=await json(catalogPath),gate=validateTripDraft({trip:d.trip,catalogEntry:d.catalogEntry,catalog});
  if(!gate.valid)return{published:false,...gate};
  const trip={...d.trip,status:d.trip.status==='draft'?'sourced-beta':d.trip.status};
  const entry={...normalizeCatalogEntry(d.catalogEntry,trip),status:d.catalogEntry.status==='draft'?'sourced-beta':d.catalogEntry.status};
  const next={...catalog,trips:[...(catalog.trips||[]).filter(t=>t.id!==slug),entry]},target=join(tripsDir,slug+'.json');
  const oldCatalog=await readFile(catalogPath,'utf8'),had=await exists(target),oldTrip=had?await readFile(target,'utf8'):null;
  try{
    await atomic(target,trip);await atomic(catalogPath,next);
    const r=spawnSync(process.execPath,[join(publicRoot,'scripts/validate-platform-data.mjs')],{cwd:publicRoot,encoding:'utf8'});
    if(r.status!==0)throw new Error((r.stderr||r.stdout||'Platform validation failed').trim());
    await atomic(paths(slug).trip,trip);await atomic(paths(slug).catalog,entry);return{published:true,validation:gate};
  }catch(e){await writeFile(catalogPath,oldCatalog);if(had)await writeFile(target,oldTrip);else await rm(target,{force:true});throw e}
}
function cookieDraft(req){const m=String(req.headers.cookie||'').match(/(?:^|;\s*)owr_builder_draft=([^;]+)/);return m?decodeURIComponent(m[1]):null}
async function file(res,p){if(!existsSync(p))return false;res.writeHead(200,{'content-type':mime[extname(p)]||'application/octet-stream','cache-control':'no-store'});createReadStream(p).pipe(res);return true}

async function handler(req,res){
  const u=new URL(req.url,'http://'+host+':'+port),pathname=decodeURIComponent(u.pathname);
  try{
    if(pathname==='/__builder'||pathname==='/__builder/')return void await file(res,join(here,'index.html'));
    if(pathname==='/__builder/api/state'&&req.method==='GET')return send(res,200,{ok:true,catalog:await json(catalogPath),drafts:await listDrafts()});
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
