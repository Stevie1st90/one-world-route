import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {visualSystemContract} from './visual-system.mjs';

const argv=Object.fromEntries(process.argv.slice(2).map(arg=>{
  const m=arg.match(/^--([^=]+)(?:=(.*))?$/);
  return m?[m[1],m[2]??true]:[arg,true];
}));
const ROOT=resolve(String(argv.root||process.cwd()));
const out=resolve(ROOT,String(argv.out||'data/platform/visual-system.json'));
const content=JSON.stringify(visualSystemContract(),null,2)+'\n';
if(String(argv.check||'false').toLowerCase()==='true'||argv.check===true){
  const existing=await readFile(out,'utf8').catch(()=>null);
  if(existing!==content)throw Error('Visual system contract is stale. Run: node scripts/build-visual-system-contract.mjs');
  console.log('Visual system contract: current');
}else{
  await writeFile(out,content);
  console.log('Visual system contract:',out);
}
