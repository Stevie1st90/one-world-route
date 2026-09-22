import http from 'node:http';
import {readFile,stat,mkdir,rm} from 'node:fs/promises';
import {extname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  createDraft,
  listDrafts,
  loadCatalog,
  loadDraft,
  normalizeCandidate,
  publishDraft,
  runPublishGate,
  saveDraft,
  validateDraftCandidate
} from './builder-core.mjs';

const builderRoot=fileURLToPath(new URL('./',import.meta.url));
const repoRoot=resolve(builderRoot,'..');
const publicRoot=join(repoRoot,'one-world-route-public-mvp');
const workspace=join(builderRoot,'workspace');
const uiRoot=join(builderRoot,'public');
const port=Number(process.env.PORT||4177);

await mkdir(workspace,{recursive:true});

const MIME={
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.webp':'image/webp',
  '.png':'image/png',
  '.ico':'image/x-icon',
  '.webmanifest':'application/manifest+json; charset=utf-8'
};

const send=(res,status,body,type='application/json; charset=utf-8')=>{
  res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff'});
  res.end(typeof body==='string'||Buffer.isBuffer(body)?body:JSON.stringify(body,null,2));
};

const jsonBody=req=>new Promise((resolveBody,reject)=>{
  let body='';
  req.on('data',chunk=>{body+=chunk;if(body.length>5_000_000){reject(new Error('Request too large'));req.destroy();}});
  req.on('end',()=>{try{resolveBody(body?JSON.parse(body):{})}catch(error){reject(new Error('Invalid JSON: '+error.message));}});
  req.on('error',reject);
});

function safeJoin(root,relative){
  const target=resolve(root,'.'+sep+relative.replace(/^\/+/,'')); 
  const normalizedRoot=resolve(root)+sep;
  if(target!==resolve(root)&&!target.startsWith(normalizedRoot))throw new Error('Unsafe path.');
  return target;
}

async function serveFile(res,root,relative){
  const path=safeJoin(root,relative);
  let info;
  try{info=await stat(path)}catch{return false;}
  const actual=info.isDirectory()?join(path,'index.html'):path;
  try{
    const data=await readFile(actual);
    send(res,200,data,MIME[extname(actual)]||'application/octet-stream');
    return true;
  }catch{return false;}
}

async function previewCatalog(slug){
  const [catalog,draft]=await Promise.all([loadCatalog(publicRoot),loadDraft(workspace,slug)]);
  const normalized=normalizeCandidate(draft);
  const next=structuredClone(catalog);
  next.trips=(next.trips||[]).filter(item=>item.id!==slug&&item.slug!==slug);
  next.trips.push(normalized.catalogEntry);
  return next;
}

async function handleApi(req,res,url){
  if(url.pathname==='/api/health'&&req.method==='GET'){
    return send(res,200,{ok:true,service:'one-world-route-internal-trip-builder'});
  }
  if(url.pathname==='/api/catalog'&&req.method==='GET'){
    return send(res,200,await loadCatalog(publicRoot));
  }
  if(url.pathname==='/api/drafts'&&req.method==='GET'){
    return send(res,200,{drafts:await listDrafts(workspace)});
  }
  if(url.pathname==='/api/drafts'&&req.method==='POST'){
    const body=await jsonBody(req);
    const draft=await createDraft(workspace,{slug:body.slug,kind:body.kind,days:body.days,title:body.title});
    return send(res,201,draft);
  }

  const match=url.pathname.match(/^\/api\/drafts\/([a-z0-9-]+)(?:\/(gate|publish))?$/);
  if(!match)return false;
  const [,slug,action]=match;

  if(!action&&req.method==='GET')return send(res,200,await loadDraft(workspace,slug));
  if(!action&&req.method==='PUT'){
    const body=await jsonBody(req);
    const saved=await saveDraft(workspace,slug,body);
    const catalog=await loadCatalog(publicRoot);
    return send(res,200,{...saved,validation:validateDraftCandidate(saved,catalog)});
  }
  if(!action&&req.method==='DELETE'){
    await rm(join(workspace,slug),{recursive:true,force:true});
    return send(res,200,{ok:true,deleted:slug});
  }
  if(action==='gate'&&req.method==='POST'){
    const result=await runPublishGate({repoRoot,publicRoot,workspace,slug});
    return send(res,result.ok?200:422,result);
  }
  if(action==='publish'&&req.method==='POST'){
    const result=await publishDraft({repoRoot,publicRoot,workspace,slug});
    return send(res,result.ok?200:422,result);
  }
  return false;
}

async function handlePreview(req,res,url){
  const match=url.pathname.match(/^\/preview\/([a-z0-9-]+)(?:\/(.*))?$/);
  if(!match)return false;
  const [,slug,rest='']=match;
  const relative=rest||'index.html';

  try{
    if(relative==='data/platform/trips.json'){
      return send(res,200,await previewCatalog(slug));
    }
    if(relative===`data/platform/trips/${slug}.json`){
      const draft=await loadDraft(workspace,slug);
      return send(res,200,draft.trip);
    }
    const ok=await serveFile(res,publicRoot,relative);
    if(ok)return true;
    send(res,404,{error:'Preview asset not found',path:relative});
    return true;
  }catch(error){
    send(res,404,{error:error.message});
    return true;
  }
}

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  try{
    const api=await handleApi(req,res,url);
    if(api!==false)return;

    const preview=await handlePreview(req,res,url);
    if(preview!==false)return;

    if(url.pathname==='/'||url.pathname==='/builder')return send(res,302,'', 'text/plain');
    if(url.pathname==='/builder/')return serveFile(res,uiRoot,'index.html');
    if(url.pathname.startsWith('/builder/')){
      const relative=url.pathname.slice('/builder/'.length);
      if(await serveFile(res,uiRoot,relative))return;
    }
    send(res,404,{error:'Not found'});
  }catch(error){
    console.error(error);
    send(res,500,{error:error.message});
  }
});

server.listen(port,'127.0.0.1',()=>{
  console.log(`ONE WORLD ROUTE internal trip builder: http://127.0.0.1:${port}/builder/`);
  console.log('Internal-only: this directory sits outside the Vercel project root.');
});
