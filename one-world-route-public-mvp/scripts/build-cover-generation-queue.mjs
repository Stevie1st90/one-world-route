import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildCoverBatch} from './cover-generation-model.mjs';

const argv=Object.fromEntries(process.argv.slice(2).map(arg=>{
  const m=arg.match(/^--([^=]+)(?:=(.*))?$/);
  return m?[m[1],m[2]??true]:[arg,true];
}));
const ROOT=resolve(String(argv.root||process.cwd()));
const read=async p=>JSON.parse(await readFile(resolve(ROOT,p),'utf8'));
const [briefs,registry]=await Promise.all([
  read('data/platform/visual-briefs.json'),
  read('data/platform/generated-media.json')
]);

const includeSpecial=String(argv['include-special']||'false').toLowerCase()==='true'||argv['include-special']===true;
const {report,operatorPrompt}=buildCoverBatch({
  briefs:briefs.journeys||[],
  registryAssets:registry.assets||[],
  limit:Number(argv.limit||10),
  includeSpecial,
  family:argv.family||null,
  batchId:argv['batch-id']||null
});

const out=resolve(ROOT,String(argv.out||'data/platform/cover-generation-queue.json'));
await writeFile(out,JSON.stringify(report,null,2)+'\n');
if(argv['prompt-out']){
  const promptOut=resolve(ROOT,String(argv['prompt-out']));
  await writeFile(promptOut,operatorPrompt+'\n');
  console.log('Cover operator prompt:',promptOut);
}
console.log('Cover generation queue:',report.items.length,'->',out);
console.log('Dispatch contract:',`${report.items.length} separate image calls × 1 image; ${report.distinctPromptFingerprints} distinct prompts`);
