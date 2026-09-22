import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const qaRoot=fileURLToPath(new URL('./',import.meta.url));
const builder=fileURLToPath(new URL('../../internal-trip-builder/server.mjs',import.meta.url));
const port=4319;
const server=spawn(process.execPath,[builder],{stdio:'inherit',env:{...process.env,OWR_BUILDER_PORT:String(port)}});
const stop=()=>{if(!server.killed)server.kill('SIGTERM')};
process.on('exit',stop);
process.on('SIGINT',()=>{stop();process.exit(130)});

for(let i=0;i<80;i++){
  try{
    const r=await fetch(`http://127.0.0.1:${port}/api/state`);
    if(r.ok)break;
  }catch{}
  if(i===79)throw new Error('Internal Trip Builder server did not start');
  await new Promise(r=>setTimeout(r,100));
}
const child=spawn(process.execPath,[fileURLToPath(new URL('./node_modules/@playwright/test/cli.js',import.meta.url)),'test','tests/trip-builder.spec.mjs','--project=desktop-1440'],{
  cwd:qaRoot,
  stdio:'inherit',
  env:{...process.env,BASE_URL:`http://127.0.0.1:${port}`}
});
child.on('exit',code=>{stop();process.exitCode=code??1});
child.on('error',error=>{console.error(error.message);stop();process.exitCode=1});
