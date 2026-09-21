import {spawnSync} from 'node:child_process';
for(const script of ['build-flight-geometries.mjs','validate-public-data.mjs','validate-platform-data.mjs','audit-route-continuity.mjs','build-bundles.mjs','generate-seo.mjs']){
  const p=new URL('./'+script,import.meta.url);
  const r=spawnSync(process.execPath,[p.pathname],{stdio:'inherit'});
  if(r.status!==0)process.exit(r.status||1);
}
console.log('ONE WORLD ROUTE release build complete');