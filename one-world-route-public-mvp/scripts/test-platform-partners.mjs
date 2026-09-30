import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../platform/partners.js',import.meta.url),'utf8');

function load(){
  const window={ONE_WORLD_PLATFORM_MODULES:{}};
  const context={window,console};
  vm.createContext(context);
  vm.runInContext(source,context);
  return window.ONE_WORLD_PLATFORM_MODULES.partners;
}
const helper={
  t:key=>({partnerOptions:'Partner options',partnerDisclosure:'Partner links may support this service.'}[key]||key),
  esc:value=>String(value),
  local:value=>value?.en||'',
  facetLabel:value=>value
};

test('commercial layer stays hidden when disabled',async()=>{
  const partners=load();
  await partners.load(async()=>({ok:true,json:async()=>({schemaVersion:1,enabled:false,partners:[]})}));
  assert.equal(partners.status().enabled,false);
  assert.equal(partners.render({kind:'rail',discovery:{regions:['europe'],modes:['rail']}},helper),'');
});

test('commercial links are filtered by journey metadata and rendered transparently',async()=>{
  const partners=load();
  await partners.load(async()=>({ok:true,json:async()=>({
    schemaVersion:1,enabled:true,disclosureRequired:true,
    partners:[
      {id:'rail-pass',label:{en:'Rail partner'},url:'https://partner.example/rail',category:'transport',modes:['rail'],regions:['europe']},
      {id:'car-hire',label:{en:'Car partner'},url:'https://partner.example/car',category:'transport',modes:['car'],regions:['europe']}
    ]
  })}));
  const meta={kind:'rail',discovery:{regions:['europe'],modes:['rail'],themes:['culture']}};
  const links=partners.linksFor(meta);
  assert.equal(links.length,1);
  assert.equal(links[0].id,'rail-pass');
  const html=partners.render(meta,helper);
  assert.match(html,/Rail partner/);
  assert.match(html,/rel="sponsored noopener noreferrer"/);
  assert.match(html,/Partner links may support this service/);
  assert.doesNotMatch(html,/Car partner/);
});

test('unsafe partner URLs are discarded',async()=>{
  const partners=load();
  await partners.load(async()=>({ok:true,json:async()=>({
    schemaVersion:1,enabled:true,
    partners:[{id:'bad-link',label:{en:'Bad'},url:'javascript:alert(1)',category:'other'}]
  })}));
  assert.equal(partners.status().enabled,false);
  assert.equal(partners.linksFor({kind:'rail',discovery:{}}).length,0);
});


test('partner matching is read-only and does not change journey metadata',async()=>{
  const partners=load();
  await partners.load(async()=>({ok:true,json:async()=>({
    schemaVersion:1,enabled:true,disclosureRequired:true,
    partners:[{id:'rail-pass',label:{en:'Rail partner'},url:'https://partner.example/rail',category:'transport',modes:['rail'],regions:['europe']}]
  })}));
  const meta={kind:'rail',discovery:{regions:['europe'],modes:['rail'],themes:['culture']},featured:true};
  const before=JSON.stringify(meta);
  const links=partners.linksFor(meta);
  assert.equal(links.length,1);
  assert.equal(JSON.stringify(meta),before);
});
