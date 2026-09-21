import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const moduleFiles=['runtime.js','map-style.js','i18n.js','model.js','traveller.js','traveller-ui.js','discovery.js','route-library.js','extensions.js'];
const moduleSources=Object.fromEntries(await Promise.all(moduleFiles.map(async name=>[name,await readFile(new URL('../platform/'+name,import.meta.url),'utf8')])));
const modularSource=moduleFiles.map(name=>moduleSources[name]).join('\n');
const source=await readFile(new URL('../platform.js',import.meta.url),'utf8');
const appSource=await readFile(new URL('../app.js',import.meta.url),'utf8');
const iteration2Source=await readFile(new URL('../iteration2.js',import.meta.url),'utf8');
const cssSource=await readFile(new URL('../platform.css',import.meta.url),'utf8');
const swSource=await readFile(new URL('../sw.js',import.meta.url),'utf8');

function loadPlatform(search=''){
  const window={addEventListener(){},ONE_WORLD_PLATFORM:null};
  const context={
    window,
    document:{querySelector(){return null},querySelectorAll(){return []},addEventListener(){}},
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
  vm.runInContext(modularSource,context);
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
  const routeLibrary=moduleSources['route-library.js'];
  assert.match(routeLibrary,/results\.addEventListener\('click'/);
  assert.doesNotMatch(routeLibrary,/\$\('\[data-platform-trip\]'\s*,\s*host\)\.forEach/);
  assert.doesNotMatch(source,/function routeCard\(/);
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
  const mapStyle=moduleSources['map-style.js'];
  assert.match(source,/function focusRegionalTerrainRoute/);
  assert.match(source,/fitBounds\(bounds/);
  assert.match(source,/focusRoute:\(\)=>\{if\(document\.body\.classList\.contains\('terrain-view'\)\)focusRegionalTerrainRoute/);
  assert.match(source,/MapStyle\.localize/);
  assert.match(mapStyle,/name:\$\{lang\}/);
});

test('regional Story control is not hidden behind desktop side panels',()=>{
  assert.match(cssSource,/\.platform-story-btn\{[^}]*left:50%[^}]*bottom:18px/);
  assert.match(cssSource,/\.platform-story-mode \.mobile-panel-btn\{display:none!important\}/);
});


test('regional terrain attribution stays compact and clear of mobile controls',()=>{
  assert.match(source,/attributionControl:false/);
  assert.match(source,/AttributionControl\(\{compact:true\}\)/);
  assert.match(cssSource,/maplibregl-ctrl-bottom-left\{left:316px;bottom:88px\}/);
  assert.match(cssSource,/@media\(max-width:820px\)[\s\S]*maplibregl-ctrl-bottom-left\{left:8px;bottom:56px\}/);
});

test('regional overview duration uses a dedicated non-overlapping unit style',()=>{
  assert.match(source,/platform-duration-number/);
  assert.match(cssSource,/\.platform-duration-number\{display:flex/);
});


test('regional UX detail modes keep sparse panels compact',()=>{
  assert.match(source,/function setRegionalDetailMode/);
  assert.match(source,/\['overview','stop','segment'\]/);
  assert.match(source,/platform-detail-'\+key/);
  assert.match(cssSource,/platform-detail-overview \.right-panel/);
  assert.match(cssSource,/platform-detail-stop \.right-panel/);
});

test('regional terrain uses branded dark map styling',()=>{
  const mapStyle=moduleSources['map-style.js'];
  assert.match(source,/MapStyle\.brandDark/);
  assert.match(mapStyle,/background-color'\]='#071019'/);
  assert.match(mapStyle,/fill-color'\]='#071b2a'/);
  assert.match(mapStyle,/text-halo-color'\]='#071019'/);
});

test('regional copy is visually reduced without removing overview content',()=>{
  assert.match(cssSource,/-webkit-line-clamp:4/);
  assert.match(cssSource,/-webkit-line-clamp:2/);
  assert.match(source,/detail-copy/);
});


test('route library exposes transparent Route Fit controls',()=>{
  const routeLibrary=moduleSources['route-library.js'];
  for(const token of ['platformFitToggle','platformFitFilters','platformRoutePace','platformRouteSeason','platformRouteParty','platformRouteStart'])assert.match(routeLibrary,new RegExp(token));
  const discovery=moduleSources['discovery.js'];
  assert.match(discovery,/fit\.pace===filters\.pace/);
  assert.match(discovery,/fit\.seasons/);
  assert.match(discovery,/fit\.party/);
  assert.match(discovery,/fit\.startRegion===filters\.start/);
  assert.match(cssSource,/\.platform-fit-filters/);
});


test('platform core delegates reusable concerns to modules',()=>{
  const routeLibrary=moduleSources['route-library.js'];
  assert.match(source,/const Model=PLATFORM_MODULES\.model/);
  assert.match(source,/const Traveller=PLATFORM_MODULES\.traveller/);
  assert.match(source,/const TravellerUi=PLATFORM_MODULES\.travellerUi/);
  assert.match(source,/const Discovery=PLATFORM_MODULES\.discovery/);
  assert.match(source,/const Extensions=PLATFORM_MODULES\.extensions/);
  assert.match(source,/const RouteLibrary=PLATFORM_MODULES\.routeLibrary/);
  assert.match(source,/RouteLibrary\.open\(/);
  assert.match(routeLibrary,/Discovery\.facets\(catalog\)/);
  assert.match(routeLibrary,/Discovery\.filter\(catalog/);
  assert.match(source,/Traveller\.load\(/);
  assert.match(source,/Model\.routeGeometry\(/);
});

test('trip specialization lives in registered extensions rather than trip-kind branches',()=>{
  const extensions=moduleSources['extensions.js'];
  assert.match(extensions,/registerExtension\('cruise'/);
  assert.match(extensions,/registerExtension\('road'/);
  assert.match(extensions,/registerExtension\('border'/);
  assert.match(source,/Extensions\.composeTripOverview/);
  assert.match(source,/Extensions\.composeStopDetail/);
  assert.match(source,/Extensions\.composeSegmentDetail/);
  assert.doesNotMatch(source,/currentTrip\.kind\s*===\s*['"]cruise['"]/);
  assert.doesNotMatch(source,/currentTrip\.kind\s*===\s*['"]road-trip['"]/);
});

test('model extension adapter prefers namespaced extensions and supports migration aliases',()=>{
  const model=moduleSources['model.js'];
  assert.match(model,/node\.extensions/);
  for(const token of ['cruiseCall','roadContext','borderContext'])assert.match(model,new RegExp(token));
});

test('traveller storage service allowlists non-secret planning fields',()=>{
  const traveller=moduleSources['traveller.js'];
  assert.match(traveller,/const ALLOWED=/);
  assert.doesNotMatch(traveller,/passportNumber|payment|bookingReference/i);
});

test('Traveller Context UI is isolated from storage policy',()=>{
  const travellerUi=moduleSources['traveller-ui.js'];
  assert.match(source,/TravellerUi\.open\(/);
  assert.match(source,/Traveller\.clear\(/);
  assert.match(travellerUi,/onSave\(next\)/);
  assert.match(travellerUi,/onClear\(\)/);
  assert.doesNotMatch(travellerUi,/localStorage|PROFILE_KEY|passportNumber|payment|bookingReference/i);
  assert.doesNotMatch(source,/async function loadCountries\(/);
});


test('platform localization is isolated from bootstrap logic',()=>{
  const i18n=moduleSources['i18n.js'];
  assert.match(i18n,/legacyWorldText:LEGACY_WORLD_TEXT/);
  assert.match(i18n,/supportedLocales/);
  assert.doesNotMatch(source,/const I18N = \{/);
  assert.doesNotMatch(source,/const LEGACY_WORLD_TEXT = \{/);
});


test('terrain branding is shared by world and regional renderers',()=>{
  const mapStyle=moduleSources['map-style.js'];
  assert.match(mapStyle,/function brandDark/);
  assert.match(mapStyle,/function localize/);
  assert.match(source,/MapStyle\.brandDark/);
  assert.match(source,/MapStyle\.localize/);
  assert.match((iteration2Source+appSource+mapStyle),/ONE_WORLD_PLATFORM_MODULES|brandDark/);
});
