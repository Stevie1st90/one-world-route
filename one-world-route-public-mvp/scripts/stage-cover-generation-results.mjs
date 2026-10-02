import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises';
import {resolve,dirname,extname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const argv=Object.fromEntries(process.argv.slice(2).map(arg=>{
  const m=arg.match(/^--([^=]+)(?:=(.*))?$/);
  return m?[m[1],m[2]??true]:[arg,true];
}));
if(!argv.spec||!argv['source-dir']){
  throw Error('Usage: node scripts/stage-cover-generation-results.mjs --spec=/path/cover-generation-queue.json --source-dir=/path/downloads [--out-dir=/path/staged]');
}
const specPath=resolve(String(argv.spec));
const sourceDir=resolve(String(argv['source-dir']));
const outDir=resolve(String(argv['out-dir']||resolve(dirname(specPath),'staged-cover-masters')));
const spec=JSON.parse(await readFile(specPath,'utf8'));
const items=spec.items||[];
if(!items.length)throw Error('Cover spec contains no items');
if(spec.dispatchContract?.imagesPerToolCall!==1)throw Error('Unsupported cover spec: imagesPerToolCall must be 1');

const natural=(a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'});
const supported=new Set(['.png','.jpg','.jpeg','.webp']);
const files=(await readdir(sourceDir,{withFileTypes:true}))
  .filter(e=>e.isFile()&&supported.has(extname(e.name).toLowerCase()))
  .map(e=>e.name)
  .sort(natural);
if(files.length!==items.length){
  throw Error(`Expected exactly ${items.length} generated images, found ${files.length} in ${sourceDir}. Do not stage a partial or over-generated batch.`);
}

await mkdir(outDir,{recursive:true});
const hashes=new Set();
const staged=[];
for(let i=0;i<items.length;i++){
  const item=items[i];
  if(Number(item.sequence||i+1)!==i+1)throw Error(`Queue sequence mismatch at index ${i}`);
  const source=resolve(sourceDir,files[i]);
  const sourceBytes=await readFile(source);
  const sourceHash=createHash('sha256').update(sourceBytes).digest('hex');
  if(hashes.has(sourceHash))throw Error(`Exact duplicate generated image detected: ${files[i]}`);
  hashes.add(sourceHash);
  const meta=await sharp(sourceBytes).metadata();
  if(!meta.width||!meta.height)throw Error(`Unreadable generated image: ${files[i]}`);
  const ratio=meta.width/meta.height;
  if(Math.abs(ratio-16/9)>=0.03)throw Error(`${files[i]} is not 16:9 enough (${meta.width}x${meta.height})`);
  if(meta.width<1200)throw Error(`${files[i]} is below the 1200px production-review minimum`);
  const target=resolve(outDir,item.sourceFilename);
  if(extname(source).toLowerCase()==='.png')await copyFile(source,target);
  else await sharp(sourceBytes).png().toFile(target);
  const stagedBytes=await readFile(target);
  staged.push({
    sequence:i+1,
    tripId:item.tripId,
    inputFilename:basename(source),
    sourceFilename:item.sourceFilename,
    width:meta.width,
    height:meta.height,
    sha256:createHash('sha256').update(stagedBytes).digest('hex'),
    technicalPass:true
  });
}
const report={
  schemaVersion:1,
  batchId:spec.batchId||null,
  expected:items.length,
  staged:staged.length,
  sequenceSource:'natural-filename-order',
  warning:'Semantic Journey correctness still requires the shared visual QA step before ingestion.',
  items:staged
};
const reportPath=resolve(outDir,'cover-stage-report.json');
await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({outDir,report:reportPath,staged:staged.length},null,2));
