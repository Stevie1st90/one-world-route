import {readFile,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {classifyCoverReleaseChanges} from './cover-release-policy.mjs';
import {spawnSync} from 'node:child_process';

const argv=Object.fromEntries(process.argv.slice(2).map(arg=>{
  const m=arg.match(/^--([^=]+)(?:=(.*))?$/);
  return m?[m[1],m[2]??true]:[arg,true];
}));
const ROOT=resolve(String(argv.root||process.cwd()));
if(!argv.spec||!argv['source-dir']){
  throw Error('Usage: node scripts/release-cover-batch.mjs --spec=/path/batch.json --source-dir=/path/masters [--skip-install=true]');
}
const SPEC=resolve(String(argv.spec));
const SOURCE=resolve(String(argv['source-dir']));
const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
const exists=async p=>access(p).then(()=>true).catch(()=>false);
const run=(cmd,args,{cwd=ROOT,quiet=false}={})=>{
  if(!quiet)console.log('\n>',cmd,...args);
  const r=spawnSync(cmd,args,{cwd,stdio:quiet?'pipe':'inherit',encoding:'utf8',shell:false});
  if(r.error)throw r.error;
  if(r.status!==0){
    const detail=quiet?[r.stdout,r.stderr].filter(Boolean).join('\n'):'';
    throw Error(`${cmd} ${args.join(' ')} failed with exit code ${r.status}${detail?'\n'+detail:''}`);
  }
  return quiet?String(r.stdout||'').trimEnd():'';
};
const git=args=>run('git',args,{quiet:true});

const dirtyBefore=git(['status','--porcelain']);
if(dirtyBefore && String(argv['allow-dirty']||'false').toLowerCase()!=='true'){
  throw Error('Refusing cover release from a dirty worktree. Use an isolated clean worktree.\n'+dirtyBefore);
}

const spec=await readJson(SPEC);
const items=Array.isArray(spec.items)?spec.items:[];
if(!items.length||items.length>10)throw Error('Cover release requires 1-10 batch items.');
const tripIds=items.map(x=>String(x.tripId||'').trim());
if(new Set(tripIds).size!==items.length)throw Error('Duplicate tripId in cover release spec.');
for(const [index,item] of items.entries()){
  if(item.reviewStatus!=='approved')throw Error(`${item.tripId||'item '+(index+1)}: reviewStatus must be approved before release`);
  if(!item.sourceFilename)throw Error(`${item.tripId}: missing sourceFilename`);
  const source=resolve(SOURCE,String(item.sourceFilename));
  if(!(await exists(source)))throw Error(`${item.tripId}: approved source master missing: ${source}`);
}

if(String(argv['skip-install']||'false').toLowerCase()!=='true'){
  run(process.platform==='win32'?'npm.cmd':'npm',['ci']);
}
run(process.execPath,['scripts/ingest-journey-covers.mjs',`--spec=${SPEC}`,`--source-dir=${SOURCE}`,`--root=${ROOT}`]);
run(process.execPath,['scripts/release-build.mjs']);
run(process.execPath,['scripts/validate-platform-data.mjs']);
run(process.execPath,['scripts/audit-platform-media.mjs']);
run(process.execPath,['--test','scripts/test-platform-media.mjs']);
run('git',['diff','--check']);

const changed=git(['status','--porcelain=v1','--untracked-files=all']).split(/\r?\n/).filter(Boolean);
const classified=classifyCoverReleaseChanges({statusLines:changed,root:ROOT,tripIds});
const unexpected=classified.filter(x=>!x.allowed&&!x.knownBuildDrift);
if(unexpected.length){
  throw Error('Cover release produced unexpected changed paths:\n'+unexpected.map(x=>x.line).join('\n'));
}

console.log('\nCOVER RELEASE VALIDATION: PASS');
console.log('batchId:',spec.batchId||'(none)');
console.log('approved Journeys:',items.length);
console.log('changed paths:',classified.length);
if(classified.some(x=>x.knownBuildDrift)){
  console.log('known build-only drift (do not stage unless source changed):');
  for(const x of classified.filter(x=>x.knownBuildDrift))console.log(' -',x.path);
}
console.log('release allowlist:');
for(const x of classified.filter(x=>x.allowed))console.log(' -',x.path);
