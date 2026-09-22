import {createServer} from 'node:http';
import {readFile,writeFile,readdir,mkdir,stat,unlink} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createDraft,normalizeCatalogEntry,validateDraft} from './lib.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const repoRoot=resolve(here,'..');
const publicRoot=resolve(repoRoot,'one-world-route-public-mvp');
const draftsRoot=resolve(here,'drafts');
const host=process.env.OWR_BUILDER_HOST||'127.0.0.1';
const port=Number(process.env.OWR_BUILDER_PORT||4317);
if(!['127.0.0.1','localhost','::1'].includes(host)&&process.env.OWR_BUILDER_ALLOW_REMOTE!=='1'){
  throw new Error('Trip Builder binds to loopback only. Set OWR_BUILDER_ALLOW_REMOTE=1 deliberately to override.');
}
await mkdir(draftsRoot,{recursive:true});

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.webmanifest':'application/manifest+json; charset=utf-8','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const send=(res,status,data,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(type.startsWith('application/json')?JSON.stringify(data,null,2):data)};
const json=async req=>{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8_000_000)throw new Error('Request too large')}return raw?JSON.parse(raw):{}};
const catalogPath=resolve(publicRoot,'data/platform/trips.json');
const draftPath=slug=>resolve(draftsRoot,slug+'.json');
const safeSlug=slug=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(slug||''));

async function loadCatalog(){return JSON.parse(await readFile(catalogPath,'utf8'))}
async function loadDraft(slug){return JSON.parse(await readFile(draftPath(slug),'utf8'))}
async function saveDraft(slug,payload){
  const out={trip:payload.trip,catalogEntry:payload.catalogEntry,updatedAt:new Date().toISOString()};
  await writeFile(draftPath(slug),JSON.stringify(out,null,2)+'\n');
  return out;
}
async function listDrafts(){
  const names=(await readdir(draftsRoot)).filter(name=>name.endsWith('.json')&&!name.endsWith('.report.json'));
  const out=[];
  for(const name of names){
    try{
      const d=JSON.parse(await readFile(resolve(draftsRoot,name),'utf8'));
      out.push({slug:d.trip?.slug||name.replace(/\.json$/,''),kind:d.trip?.kind||'custom',title:d.trip?.title?.en||d.trip?.slug||name,updatedAt:d.updatedAt||null,publishedAt:d.publishedAt||null});
    }catch{}
  }
  return out.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
}
async function staticFile(root,pathname,res){
  let rel=decodeURIComponent(pathname||'/');
  if(rel==='/'||rel==='')rel='/index.html';
  const target=resolve(root,'.'+rel);
  if(target!==root&&!target.startsWith(root+sep))return send(res,403,'Forbidden','text/plain; charset=utf-8');
  try{
    const info=await stat(target);if(!info.isFile())throw new Error();
    const body=await readFile(target);
    res.writeHead(200,{'Content-Type':mime[extname(target).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(body);
  }catch{send(res,404,'Not found','text/plain; charset=utf-8')}
}
function runGate(){
  const commands=[
    ['scripts/validate-platform-data.mjs'],
    ['--test','scripts/test-platform-model.mjs'],
    ['--test','scripts/test-platform-navigation.mjs'],
    ['--test','scripts/test-regional-runtime.mjs']
  ];
  const results=[];
  for(const args of commands){
    const r=spawnSync(process.execPath,args,{cwd:publicRoot,encoding:'utf8',maxBuffer:8_000_000});
    results.push({command:['node',...args].join(' '),status:r.status,stdout:r.stdout||'',stderr:r.stderr||''});
    if(r.status!==0)break;
  }
  return {ok:results.every(r=>r.status===0),results};
}
async function publish(slug){
  const draft=await loadDraft(slug);
  const catalog=await loadCatalog();
  if((catalog.trips||[]).some(item=>item.id===slug||item.slug===slug))return {status:409,body:{ok:false,error:'A public trip with this slug already exists. Builder v1 only publishes new trips.'}};
  const item=normalizeCatalogEntry(draft.catalogEntry,draft.trip,catalog);
  const validation=validateDraft({catalog,item,trip:draft.trip});
  if(!validation.ok)return {status:422,body:{ok:false,validation}};
  const target=resolve(publicRoot,'data/platform/trips',slug+'.json');
  const nextCatalog=structuredClone(catalog);
  nextCatalog.updatedAt=new Date().toISOString().slice(0,10);
  nextCatalog.trips.push(item);
  await writeFile(target,JSON.stringify(draft.trip,null,2)+'\n');
  await writeFile(catalogPath,JSON.stringify(nextCatalog,null,2)+'\n');
  const gate=runGate();
  if(!gate.ok){
    await writeFile(catalogPath,JSON.stringify(catalog,null,2)+'\n');
    await unlink(target).catch(()=>{});
    const report={ok:false,slug,at:new Date().toISOString(),validation,gate};
    await writeFile(resolve(draftsRoot,slug+'.report.json'),JSON.stringify(report,null,2)+'\n');
    return {status:422,body:report};
  }
  const published={...draft,publishedAt:new Date().toISOString(),catalogEntry:item};
  await writeFile(draftPath(slug),JSON.stringify(published,null,2)+'\n');
  const report={ok:true,slug,at:new Date().toISOString(),validation,gate,target:'one-world-route-public-mvp/data/platform/trips/'+slug+'.json'};
  await writeFile(resolve(draftsRoot,slug+'.report.json'),JSON.stringify(report,null,2)+'\n');
  return {status:200,body:report};
}
async function preview(slug,rest,res){
  if(!safeSlug(slug))return send(res,400,'Invalid preview slug','text/plain; charset=utf-8');
  let draft;try{draft=await loadDraft(slug)}catch{return send(res,404,'Draft not found','text/plain; charset=utf-8')}
  const rel='/'+String(rest||'').replace(/^\/+/, '');
  if(rel==='/data/platform/trips.json'){
    const catalog=await loadCatalog();
    const entry=normalizeCatalogEntry(draft.catalogEntry,draft.trip,catalog);
    const previewCatalog={...catalog,trips:[...(catalog.trips||[]).filter(t=>t.id!==slug),entry]};
    return send(res,200,previewCatalog);
  }
  if(rel===`/data/platform/trips/${slug}.json`)return send(res,200,draft.trip);
  return staticFile(publicRoot,rel==='/'?'/index.html':rel,res);
}

const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/',`http://${req.headers.host||host}`);
    if(url.pathname==='/api/state'&&req.method==='GET')return send(res,200,{drafts:await listDrafts(),publicCatalog:await loadCatalog()});
    if(url.pathname==='/api/drafts'&&req.method==='POST'){
      const input=await json(req),catalog=await loadCatalog();
      if(!safeSlug(input.slug))return send(res,400,{ok:false,error:'Slug must contain lowercase letters, numbers and hyphens only.'});
      if((catalog.trips||[]).some(t=>t.id===input.slug||t.slug===input.slug))return send(res,409,{ok:false,error:'Slug already exists in the public catalog.'});
      try{await stat(draftPath(input.slug));return send(res,409,{ok:false,error:'Draft already exists.'})}catch{}
      const draft=createDraft(catalog,input);await saveDraft(input.slug,draft);
      return send(res,201,{ok:true,...draft});
    }
    const draftMatch=url.pathname.match(/^\/api\/drafts\/([a-z0-9-]+)$/);
    if(draftMatch&&req.method==='GET')return send(res,200,await loadDraft(draftMatch[1]));
    if(draftMatch&&req.method==='PUT'){
      const payload=await json(req);if(payload.trip?.slug!==draftMatch[1])return send(res,400,{ok:false,error:'Draft slug cannot be changed by save.'});
      const saved=await saveDraft(draftMatch[1],payload);return send(res,200,{ok:true,...saved});
    }
    const validateMatch=url.pathname.match(/^\/api\/drafts\/([a-z0-9-]+)\/validate$/);
    if(validateMatch&&req.method==='POST'){
      const draft=await loadDraft(validateMatch[1]),catalog=await loadCatalog();
      const item=normalizeCatalogEntry(draft.catalogEntry,draft.trip,catalog);
      return send(res,200,validateDraft({catalog,item,trip:draft.trip}));
    }
    const publishMatch=url.pathname.match(/^\/api\/drafts\/([a-z0-9-]+)\/publish$/);
    if(publishMatch&&req.method==='POST'){
      const result=await publish(publishMatch[1]);return send(res,result.status,result.body);
    }
    const previewMatch=url.pathname.match(/^\/preview\/([a-z0-9-]+)(\/.*)?$/);
    if(previewMatch)return preview(previewMatch[1],previewMatch[2]||'/',res);
    await staticFile(here,url.pathname,res);
  }catch(err){
    console.error(err);
    send(res,500,{ok:false,error:err.message||'Internal Trip Builder error'});
  }
});

server.listen(port,host,()=>{
  console.log(`ONE WORLD ROUTE Internal Trip Builder: http://${host}:${port}/`);
  console.log('Drafts stay outside the public Vercel root until Publish passes the gate.');
});
