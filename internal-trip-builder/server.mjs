import {createServer} from 'node:http';
import {readFile,stat,mkdir} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createDraft,SLUG_PATTERN,validateDraft} from './lib/draft-core.mjs';
import {
  defaultDraftsRoot,
  listDrafts,
  loadDraft,
  loadPublicCatalog,
  mvpRoot as defaultMvpRoot,
  overlayCatalog,
  publishDraft,
  saveDraft
} from './lib/repository.mjs';

const builderRoot=resolve(fileURLToPath(new URL('./public/',import.meta.url)));
const mime={
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon',
  '.webmanifest':'application/manifest+json; charset=utf-8','.txt':'text/plain; charset=utf-8'
};

function sendJson(res,status,payload){
  const body=JSON.stringify(payload,null,2);
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(body);
}

function sendText(res,status,text,type='text/plain; charset=utf-8'){
  res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});
  res.end(text);
}

async function readBody(req,maxBytes=2_000_000){
  let size=0;
  const chunks=[];
  for await(const chunk of req){
    size+=chunk.length;
    if(size>maxBytes)throw Object.assign(new Error('Request body too large'),{statusCode:413});
    chunks.push(chunk);
  }
  if(!chunks.length)return {};
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}
  catch{throw Object.assign(new Error('Invalid JSON body'),{statusCode:400})}
}

async function staticFile(root,pathname,res){
  let rel=decodeURIComponent(pathname||'/');
  if(rel==='/'||rel==='')rel='/index.html';
  const target=resolve(root,'.'+(rel.startsWith('/')?rel:'/'+rel));
  if(target!==root&&!target.startsWith(root+sep)){sendText(res,403,'Forbidden');return}
  try{
    const info=await stat(target);
    if(!info.isFile())throw new Error('not file');
    const body=await readFile(target);
    res.writeHead(200,{'Content-Type':mime[extname(target).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(body);
  }catch{
    sendText(res,404,'Not found');
  }
}

function previewParts(pathname){
  const match=pathname.match(/^\/preview\/([a-z0-9]+(?:-[a-z0-9]+)*)(\/.*)?$/);
  if(!match)return null;
  return {slug:match[1],pathname:match[2]||'/'};
}

async function previewRequest({slug,pathname},res,{draftsRoot,mvpRoot}){
  const [draft,catalog]=await Promise.all([loadDraft(slug,{draftsRoot}),loadPublicCatalog({root:mvpRoot})]);
  if(pathname==='/data/platform/trips.json'){
    sendJson(res,200,overlayCatalog(catalog,draft));
    return;
  }
  if(pathname===`/data/platform/trips/${slug}.json`){
    sendJson(res,200,draft.trip);
    return;
  }
  await staticFile(mvpRoot,pathname,res);
}

export function createBuilderServer({
  host=process.env.OWR_BUILDER_HOST||'127.0.0.1',
  port=Number(process.env.OWR_BUILDER_PORT||4180),
  draftsRoot=process.env.OWR_BUILDER_DRAFTS?resolve(process.env.OWR_BUILDER_DRAFTS):defaultDraftsRoot,
  mvpRoot=defaultMvpRoot
}={}){
  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url||'/',`http://${req.headers.host||host}`);
      const method=String(req.method||'GET').toUpperCase();

      if(url.pathname==='/api/bootstrap'&&method==='GET'){
        const [catalog,drafts]=await Promise.all([loadPublicCatalog({root:mvpRoot}),listDrafts({draftsRoot})]);
        sendJson(res,200,{
          defaultLocale:catalog.defaultLocale,
          supportedLocales:catalog.supportedLocales,
          publicTrips:(catalog.trips||[]).map(item=>({id:item.id,title:item.title?.[catalog.defaultLocale]||item.title?.en||item.id,kind:item.kind,status:item.status})),
          drafts
        });
        return;
      }

      if(url.pathname==='/api/drafts'&&method==='POST'){
        const body=await readBody(req);
        const catalog=await loadPublicCatalog({root:mvpRoot});
        const draft=createDraft({
          slug:body.slug,kind:body.kind||'custom',days:body.days??null,
          locales:catalog.supportedLocales,defaultLocale:catalog.defaultLocale
        });
        await saveDraft(draft,{draftsRoot});
        sendJson(res,201,draft);
        return;
      }

      const draftMatch=url.pathname.match(/^\/api\/drafts\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
      if(draftMatch&&method==='GET'){
        sendJson(res,200,await loadDraft(draftMatch[1],{draftsRoot}));
        return;
      }
      if(draftMatch&&method==='PUT'){
        const body=await readBody(req);
        if(body?.trip?.slug!==draftMatch[1])throw Object.assign(new Error('Draft slug cannot be changed through this endpoint'),{statusCode:409});
        sendJson(res,200,await saveDraft(body,{draftsRoot}));
        return;
      }

      if(url.pathname==='/api/validate'&&method==='POST'){
        const body=await readBody(req);
        const catalog=await loadPublicCatalog({root:mvpRoot});
        sendJson(res,200,validateDraft(body,{publicCatalog:catalog,publish:false}));
        return;
      }

      if(url.pathname==='/api/publish'&&method==='POST'){
        const body=await readBody(req);
        const slug=String(body?.draft?.trip?.slug||'');
        if(!SLUG_PATTERN.test(slug)||body.confirmSlug!==slug){
          throw Object.assign(new Error('Publish confirmation must exactly match the draft slug'),{statusCode:409});
        }
        try{
          const result=await publishDraft(body.draft,{root:mvpRoot,draftsRoot});
          sendJson(res,200,result);
        }catch(error){
          if(error.validation){sendJson(res,422,error.validation);return}
          throw error;
        }
        return;
      }

      const preview=previewParts(url.pathname);
      if(preview&&method==='GET'){
        await previewRequest(preview,res,{draftsRoot,mvpRoot});
        return;
      }

      if(url.pathname.startsWith('/api/')){sendJson(res,404,{error:'Unknown builder API endpoint'});return}
      await staticFile(builderRoot,url.pathname,res);
    }catch(error){
      const status=Number(error.statusCode)||(/ENOENT/.test(String(error?.code))?404:500);
      console.error('[trip-builder]',error);
      sendJson(res,status,{error:error.message||'Builder server error'});
    }
  });

  return {
    server,host,port,draftsRoot,mvpRoot,
    async start(){
      await mkdir(draftsRoot,{recursive:true});
      await new Promise((resolveStart,reject)=>{
        server.once('error',reject);
        server.listen(port,host,()=>{server.off('error',reject);resolveStart()});
      });
      return this;
    },
    async stop(){
      if(!server.listening)return;
      await new Promise((resolveStop,reject)=>server.close(error=>error?reject(error):resolveStop()));
    }
  };
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const app=createBuilderServer();
  await app.start();
  console.log(`ONE WORLD ROUTE Trip Builder: http://${app.host}:${app.port}/`);
  console.log('Drafts stay local. Publish writes to the working tree only; Git commit/deploy remain separate.');
}
