import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../platform.js',import.meta.url),'utf8');

function loadPlatform(search=''){
  const window={addEventListener(){},ONE_WORLD_PLATFORM:null};
  const context={
    window,
    document:{querySelector(){return null},querySelectorAll(){return []}},
    navigator:{language:'en'},
    location:{search,assign(){}},
    localStorage:{getItem(){return null},setItem(){},removeItem(){}},
    URLSearchParams,
    Intl,
    console,
    setTimeout(){},
    clearInterval(){},
    setInterval(){return 1},
    fetch(){throw new Error('fetch should not run in navigation unit test')}
  };
  vm.createContext(context);
  vm.runInContext(source,context);
  return context.window.ONE_WORLD_PLATFORM;
}

test('trip URL builder preserves language and clears route-specific state',()=>{
  const platform=loadPlatform('?trip=italy-grand-tour&lang=de&segment=4&country=Italy&phase=3&view=ops');
  const url=platform.buildTripUrl('southern-europe-road-trip');
  const parsed=new URL(url,'http://local.test');
  assert.equal(parsed.pathname,'/');
  assert.equal(parsed.searchParams.get('trip'),'southern-europe-road-trip');
  assert.equal(parsed.searchParams.get('lang'),'de');
  for(const key of ['segment','country','phase','view'])assert.equal(parsed.searchParams.has(key),false);
});

test('switching to flagship removes trip parameter but keeps language',()=>{
  const platform=loadPlatform('?trip=western-mediterranean-cruise-loop&lang=fr');
  const url=platform.buildTripUrl('world-195');
  const parsed=new URL(url,'http://local.test');
  assert.equal(parsed.pathname,'/');
  assert.equal(parsed.searchParams.has('trip'),false);
  assert.equal(parsed.searchParams.get('lang'),'fr');
});

test('route library uses delegated click handling for dynamically filtered cards',()=>{
  assert.match(source,/results\.addEventListener\('click'/);
  assert.doesNotMatch(source,/\$\('\[data-platform-trip\]'\s*,\s*host\)\.forEach/);
});
