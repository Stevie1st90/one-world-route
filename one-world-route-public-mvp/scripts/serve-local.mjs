import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const share=require('../api/share.js');
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const host=process.env.OWR_HOST||'127.0.0.1';
const port=Number(process.env.OWR_PORT||4173);

const mime={
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.xml':'application/xml; charset=utf-8',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
  '.ico':'image/x-icon','.webmanifest':'application/manifest+json; charset=utf-8','.txt':'text/plain; charset=utf-8'
};

function shareQuery(pathname){
  let m=pathname.match(/^\/(en|de|it|es|fr|pt)\/trip\/([^/]+)$/);
  if(m)return {type:'trip',lang:m[1],slug:decodeURIComponent(m[2])};
  m=pathname.match(/^\/trip\/([^/]+)$/);
  if(m)return {type:'trip',slug:decodeURIComponent(m[1])};
  m=pathname.match(/^\/route\/([^/]+)$/);
  if(m)return {type:'route',id:decodeURIComponent(m[1])};
  m=pathname.match(/^\/country\/([^/]+)$/);
  if(m)return {type:'country',slug:decodeURIComponent(m[1])};
  return null;
}

async function staticFile(pathname,res){
  let rel=decodeURIComponent(pathname);
  if(rel==='/'||rel==='')rel='/index.html';
  const target=resolve(root,'.'+rel);
  if(target!==root&&!target.startsWith(root+sep)){res.writeHead(403);res.end('Forbidden');return}
  try{
    const info=await stat(target);
    if(!info.isFile())throw new Error('not file');
    const body=await readFile(target);
    res.setHeader('Content-Type',mime[extname(target).toLowerCase()]||'application/octet-stream');
    res.setHeader('Cache-Control','no-store');
    res.end(body);
  }catch{
    res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');
  }
}

const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/',`http://${req.headers.host||host}`);
    const q=shareQuery(url.pathname);
    if(q){req.query=q;share(req,res);return}
    await staticFile(url.pathname,res);
  }catch(err){
    console.error(err);
    if(!res.headersSent)res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});
    res.end('Local preview error');
  }
});

server.listen(port,host,()=>{
  console.log(`ONE WORLD ROUTE local preview: http://${host}:${port}/`);
  console.log(`Italy: http://${host}:${port}/?trip=italy-grand-tour&lang=de`);
  console.log(`Road trip: http://${host}:${port}/?trip=southern-europe-road-trip&lang=de`);
  console.log(`Road trip share: http://${host}:${port}/de/trip/southern-europe-road-trip`);
  console.log(`Cruise: http://${host}:${port}/?trip=western-mediterranean-cruise-loop&lang=de`);
});
