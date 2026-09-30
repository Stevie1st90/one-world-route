import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

let partners=[];
try{
  const raw=String(process.env.OWR_COMMERCIAL_PARTNERS_JSON||'').trim();
  if(raw)partners=JSON.parse(raw);
}catch(error){
  console.warn('Invalid OWR_COMMERCIAL_PARTNERS_JSON; commercial links disabled');
}
if(!Array.isArray(partners))partners=[];
partners=partners.filter(item=>
  item&&typeof item==='object'&&
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(item.id||''))&&
  /^https:\/\//i.test(String(item.url||''))&&
  item.label&&typeof item.label==='object'
);
const enabled=/^(1|true|yes)$/i.test(String(process.env.OWR_COMMERCIAL_ENABLED||''))&&partners.length>0;
const payload={schemaVersion:1,enabled,disclosureRequired:true,partners:enabled?partners:[]};
const path=fileURLToPath(new URL('../data/platform/commercial-config.json',import.meta.url));
await writeFile(path,JSON.stringify(payload,null,2)+'\n','utf8');
console.log('Commercial config:',enabled?partners.length+' partner(s) enabled':'disabled');
