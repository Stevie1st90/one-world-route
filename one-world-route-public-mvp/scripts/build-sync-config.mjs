import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const projectUrl=String(process.env.OWR_SYNC_SUPABASE_URL||'').trim().replace(/\/+$/,'');
const publishableKey=String(process.env.OWR_SYNC_SUPABASE_PUBLISHABLE_KEY||'').trim();
const enabled=Boolean(/^https:\/\//.test(projectUrl)&&/^sb_publishable_/.test(publishableKey));
const payload={
  schemaVersion:1,
  provider:'supabase',
  enabled,
  projectUrl:enabled?projectUrl:null,
  publishableKey:enabled?publishableKey:null
};
const path=fileURLToPath(new URL('../data/platform/sync-config.json',import.meta.url));
await writeFile(path,JSON.stringify(payload,null,2)+'\n','utf8');
console.log('Cloud sync config:',enabled?'enabled':'disabled');
