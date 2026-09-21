import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../platform.js',import.meta.url),'utf8');
const appSource=await readFile(new URL('../app.js',import.meta.url),'utf8');
const iteration2Source=await readFile(new URL('../iteration2.js',import.meta.url),'utf8');
const cssSource=await readFile(new URL('../platform.css',import.meta.url),'utf8');
const swSource=await readFile(new URL('../sw.js',import.meta.url),'utf8');

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

test('regional chapter controls bind NodeLists rather than a single element',()=>{
  assert.match(source,/\$\$\('\[data-trip-chapter\]'/);
  assert.doesNotMatch(source,/(?<!\$)\$\('\[data-trip-chapter\]'[^\n]*\.forEach/);
});

test('regional routes own timeline and block legacy world mutation paths',()=>{
  for(const token of ['regionalRouteRange','regionalTimelineTitle','syncRegionalUrl','isolateRegionalRuntime'])assert.match(source,new RegExp(token));
  assert.match(appSource,/platformOwnsRoute/);
  assert.match(appSource,/if\(!state\.globe \|\| platformOwnsRoute\(\)\) return/);
  assert.match(iteration2Source,/platform-regional-trip/);
  assert.match(cssSource,/platform-regional-trip \.journey-context/);
});

test('mobile platform keeps Traveller available',()=>{
  assert.match(cssSource,/platform-pill\.secondary\{display:flex\}/);
  assert.match(source,/id="platformTravellerBtn"/);
  assert.match(source,/platform-pill-icon/);
});

test('localhost service worker cannot keep stale QA bundles',()=>{
  assert.match(swSource,/LOCAL_PREVIEW/);
  assert.match(swSource,/self\.registration\.unregister/);
});



test('regional routes expose generic story and terrain APIs',()=>{
  for(const token of ['platformStoryBtn','platformStoryHud','startRegionalStory','setRegionalTerrain','regionalTerrainStyle','regionalRouteGeoJson','focusRoute'])assert.match(source,new RegExp(token));
  assert.match(source,/setTerrain:setRegionalTerrain/);
  assert.match(source,/startStory:startRegionalStory/);
});

test('regional settings remain visible while legacy world search stays hidden',()=>{
  assert.match(cssSource,/platform-regional-trip #searchBtn/);
  assert.match(cssSource,/platform-regional-trip #infoBtn/);
  assert.match(cssSource,/platform-regional-trip #settingsBtn/);
  assert.match(cssSource,/platform-regional-trip \.top-actions\{display:flex\}/);
});

test('legacy terrain delegates trip URLs to platform terrain',async()=>{
  const terrain=await readFile(new URL('../iteration9.js',import.meta.url),'utf8');
  assert.match(terrain,/ONE_WORLD_PLATFORM/);
  assert.match(terrain,/params\.has\('trip'\)/);
});

test('regional story does not reuse the legacy 194-leg range',()=>{
  assert.match(source,/id="regionalRouteRange"/);
  assert.doesNotMatch(source,/id="routeRange"[^\n]*currentTrip/);
  assert.match(source,/currentTrip\.segments\.length/);
});


test('regional route focus fits the whole trip and terrain labels localize',()=>{
  assert.match(source,/function focusRegionalTerrainRoute/);
  assert.match(source,/fitBounds\(bounds/);
  assert.match(source,/focusRoute:\(\)=>\{if\(document\.body\.classList\.contains\('terrain-view'\)\)focusRegionalTerrainRoute/);
  assert.match(source,/function localizeRegionalMapStyle/);
  assert.match(source,/name:\\?\$\{lang\}/);
});

test('regional Story control is not hidden behind desktop side panels',()=>{
  assert.match(cssSource,/\.platform-story-btn\{[^}]*left:50%[^}]*bottom:18px/);
  assert.match(cssSource,/\.platform-story-mode \.mobile-panel-btn\{display:none!important\}/);
});
