// Runs server and browser tests together, including in isolated network namespaces.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawn} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const types={'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  let name=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(name!==path.resolve(root)&&!name.startsWith(root)){res.writeHead(403);res.end();return;}
  if(url.pathname.endsWith('/'))name=path.join(name,'index.html');
  try{const body=await readFile(name);res.writeHead(200,{'Content-Type':types[path.extname(name)]||'application/octet-stream'});res.end(body)}catch{res.writeHead(404);res.end('Not found')}
});
server.listen(0,'127.0.0.1',()=>{
  const child=spawn(process.execPath,[fileURLToPath(new URL('./node_modules/@playwright/test/cli.js',import.meta.url)),'test',...process.argv.slice(2)],{cwd:fileURLToPath(new URL('./',import.meta.url)),stdio:'inherit',env:{...process.env,BASE_URL:`http://127.0.0.1:${server.address().port}`}});
  child.on('exit',code=>{server.close();process.exitCode=code??1});
  child.on('error',error=>{console.error(error.message);server.close();process.exitCode=1});
});
