import {mkdir,readFile,readdir,rename,writeFile,unlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SLUG_PATTERN,synchronizeDraft,validateDraft} from './draft-core.mjs';

export const repoRoot=resolve(fileURLToPath(new URL('../../',import.meta.url)));
export const mvpRoot=resolve(repoRoot,'one-world-route-public-mvp');
export const defaultDraftsRoot=resolve(repoRoot,'internal-trip-builder/drafts');

const jsonText=value=>JSON.stringify(value,null,2)+'\n';

function ensureInside(root,target){
  const resolved=resolve(target);
  if(resolved!==root&&!resolved.startsWith(root+sep))throw new Error('Path escapes allowed root');
  return resolved;
}

export function draftFilePath(slug,{draftsRoot=defaultDraftsRoot}={}){
  if(!SLUG_PATTERN.test(String(slug||'')))throw new Error('Invalid draft slug');
  return ensureInside(draftsRoot,resolve(draftsRoot,slug+'.json'));
}

export async function readJson(path){
  return JSON.parse(await readFile(path,'utf8'));
}

export async function writeJsonAtomic(path,value){
  await mkdir(dirname(path),{recursive:true});
  const temp=path+'.tmp';
  await writeFile(temp,jsonText(value),'utf8');
  await rename(temp,path);
}

export async function loadPublicCatalog({root=mvpRoot}={}){
  return readJson(resolve(root,'data/platform/trips.json'));
}

export async function listDrafts({draftsRoot=defaultDraftsRoot}={}){
  await mkdir(draftsRoot,{recursive:true});
  const files=(await readdir(draftsRoot,{withFileTypes:true}))
    .filter(entry=>entry.isFile()&&entry.name.endsWith('.json'))
    .map(entry=>entry.name)
    .sort();
  const drafts=[];
  for(const file of files){
    try{
      const draft=await readJson(resolve(draftsRoot,file));
      drafts.push({
        slug:String(draft?.trip?.slug||file.replace(/\.json$/,'')),
        title:draft?.trip?.title?.[draft?.trip?.defaultLocale||'en']||draft?.trip?.title?.en||file,
        kind:draft?.trip?.kind||'custom',
        status:draft?.trip?.status||'draft',
        updatedAt:draft?.meta?.updatedAt||null
      });
    }catch{
      drafts.push({slug:file.replace(/\.json$/,''),title:file,kind:'invalid',status:'invalid',updatedAt:null});
    }
  }
  return drafts;
}

export async function loadDraft(slug,options={}){
  return readJson(draftFilePath(slug,options));
}

export async function saveDraft(input,{draftsRoot=defaultDraftsRoot}={}){
  const draft=synchronizeDraft(input);
  const slug=String(draft?.trip?.slug||'');
  if(!SLUG_PATTERN.test(slug))throw new Error('Cannot save draft without valid slug');
  const existingCreated=draft.meta?.createdAt;
  draft.meta={
    ...(draft.meta||{}),
    createdAt:existingCreated||new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
  await writeJsonAtomic(draftFilePath(slug,{draftsRoot}),draft);
  return draft;
}

export function overlayCatalog(publicCatalog,input){
  const draft=synchronizeDraft(input);
  const catalog=structuredClone(publicCatalog);
  const entry=draft.catalogEntry;
  const existingIndex=(catalog.trips||[]).findIndex(item=>item.id===entry.id||item.slug===entry.slug);
  if(existingIndex>=0)catalog.trips.splice(existingIndex,1,entry);
  else catalog.trips.push(entry);
  return catalog;
}

export async function validateStoredDraft(slug,{draftsRoot=defaultDraftsRoot,root=mvpRoot,publish=false}={}){
  const [draft,catalog]=await Promise.all([loadDraft(slug,{draftsRoot}),loadPublicCatalog({root})]);
  return validateDraft(draft,{publicCatalog:catalog,publish});
}

export async function publishDraft(input,{root=mvpRoot,draftsRoot=defaultDraftsRoot}={}){
  const publicCatalog=await loadPublicCatalog({root});
  const synchronized=synchronizeDraft(input);
  const result=validateDraft(synchronized,{publicCatalog,publish:true});
  if(!result.ok){
    const error=new Error('Publish gate failed');
    error.validation=result;
    throw error;
  }
  const draft=result.draft;
  const slug=draft.trip.slug;
  const tripPath=resolve(root,'data/platform/trips',slug+'.json');
  const catalogPath=resolve(root,'data/platform/trips.json');
  ensureInside(resolve(root,'data/platform/trips'),tripPath);

  const nextCatalog=structuredClone(publicCatalog);
  nextCatalog.updatedAt=new Date().toISOString().slice(0,10);
  nextCatalog.trips.push(draft.catalogEntry);

  const originalCatalog=await readFile(catalogPath,'utf8');
  await writeJsonAtomic(tripPath,draft.trip);
  await writeJsonAtomic(catalogPath,nextCatalog);

  const validator=spawnSync(process.execPath,[resolve(root,'scripts/validate-platform-data.mjs')],{
    cwd:root,encoding:'utf8'
  });
  if(validator.status!==0){
    await writeFile(catalogPath,originalCatalog,'utf8');
    await unlink(tripPath).catch(()=>{});
    const error=new Error('Platform validation failed after publication; working-tree changes were rolled back.');
    error.validation={
      ok:false,
      errors:[String(validator.stderr||validator.stdout||'Platform validator failed').trim()],
      warnings:[],
      metrics:draft.catalogEntry.metrics
    };
    throw error;
  }

  await saveDraft(draft,{draftsRoot});

  return {
    ok:true,
    slug,
    tripPath,
    catalogPath,
    metrics:draft.catalogEntry.metrics,
    validatorOutput:String(validator.stdout||'').trim(),
    message:'Published into the working tree and passed full platform validation. Commit and deployment remain separate explicit steps.'
  };
}
