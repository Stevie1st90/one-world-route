import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../platform/formatters.js',import.meta.url),'utf8');

function loadFormatters(){
  const window={ONE_WORLD_PLATFORM_MODULES:{}};
  const context={window,Intl};
  vm.createContext(context);
  vm.runInContext(source,context);
  return window.ONE_WORLD_PLATFORM_MODULES.formatters;
}

test('duration formatter handles exact, range and minimum timings',()=>{
  const f=loadFormatters();
  assert.equal(f.durationLabel({durationMinutes:75}),'75 min');
  assert.equal(f.durationLabel({durationRangeMinutes:[80,110]}),'80–110 min');
  assert.equal(f.durationLabel({minimumInVehicleMinutes:45}),'≥ 45 min');
  assert.equal(f.durationLabel({durationMinutes:null}),'—');
  assert.equal(f.durationLabel({durationMinutes:null,minimumInVehicleMinutes:null}),'—');
  assert.equal(f.durationLabel({durationRangeMinutes:[null,110]}),'—');
  assert.equal(f.durationLabel({}),'—');
});

test('cost formatter keeps published-from semantics and currency formatting',()=>{
  const f=loadFormatters();
  assert.equal(
    f.costLabel({
      locale:'en',
      planning:{cost:{amount:19.5,currency:'EUR',basis:'published-from'}},
      defaultCurrency:'EUR',
      publishedFrom:'from'
    }),
    'from €19.50'
  );
  assert.equal(f.costLabel({locale:'en',planning:{},publishedFrom:'from'}),'—');
});

test('editorial formatter localizes known notes without changing unknown claims',()=>{
  const f=loadFormatters();
  const known='Endpoint cruise facilities are source-backed. No specific ship service or sailing time is asserted.';
  const localized=f.editorialNote('de',known,value=>typeof value==='string'?value:value?.de||value?.en||'');
  assert.match(localized,/Kreuzfahrtanlagen/);
  assert.equal(f.editorialNote('de','Unknown editorial note',value=>String(value)),'Unknown editorial note');
  assert.equal(f.editorialNote('en',known,value=>String(value)),known);
});

test('formatters remain stateless and independent from trip/runtime globals',()=>{
  assert.doesNotMatch(source,/currentTrip|selectedSegment|localStorage|document\.|ONE_WORLD_ROUTE_GLOBE/);
});
