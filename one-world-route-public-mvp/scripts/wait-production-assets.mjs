import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const base=process.env.OWR_BASE_URL||'https://one-world-route.vercel.app';
const files=['core.bundle.js','core.bundle.css','features.bundle.js','features.bundle.css','data/platform/discovery-index.json','data/platform/media-delivery.json','assets/globe/earth-blue-marble.webp'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const expected=new Map(await Promise.all(files.map(async file=>[file,hash(await readFile(new URL('../'+file,import.meta.url)))])));
for(let attempt=0;attempt<40;attempt++){
  const results=await Promise.all(files.map(async file=>{
    try{const response=await fetch(base+'/'+file,{cache:'no-store',signal:AbortSignal.timeout(10000)});return response.ok&&hash(Buffer.from(await response.arrayBuffer()))===expected.get(file)}catch{return false}
  }));
  if(results.every(Boolean)){console.log('Production assets match this commit');process.exit(0)}
  console.log('Waiting for current Production assets:',files.filter((_,i)=>!results[i]).join(', '));
  await new Promise(resolve=>setTimeout(resolve,15000));
}
throw new Error('Production assets do not match the current commit');
