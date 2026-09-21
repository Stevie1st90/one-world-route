import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const moduleFiles=['runtime.js','map-style.js','i18n.js','legacy-localization.js','model.js','traveller.js','traveller-ui.js','ui.js','navigation.js','discovery.js','route-library.js','regional-shell.js','regional-detail.js','story.js','terrain.js','extensions.js'];
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

test('navigation module owns reusable regional URL state',()=>{
  const window={ONE_WORLD_PLATFORM_MODULES:{}};
  const context={window,URLSearchParams};
  vm.createContext(context);
  vm.runInContext(moduleSources['navigation.js'],context);
  const navigation=window.ONE_WORLD_PLATFORM_MODULES.navigation;
  assert.equal(
    navigation.buildTripUrl({
      id:'world-195',
      defaultTripId:'world-195',
      search:'?trip=italy-grand-tour&lang=de&segment=4&view=terrain'
    }),
    '/?lang=de'
  );
  assert.equal(
    navigation.regionalUrl({
      tripId:'italy-grand-tour',
      locale:'de',
      search:'?view=terrain&country=Italy',
      pathname:'/de/trip/italy-grand-tour'
    }),
    '/de/trip/italy-grand-tour?trip=italy-grand-tour&lang=de&view=terrain'
  );
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
  const shell=moduleSources['regional-shell.js'];
  assert.match(shell,/\$\$\('\[data-trip-chapter\]'/);
  assert.doesNotMatch(shell,/(?<!\$)\$\('\[data-trip-chapter\]'[^\n]*\.forEach/);
  assert.doesNotMatch(source,/function buildChapterRail|function buildLeftNavigation|function stopButton/);
});

test('regional routes own timeline and block legacy world mutation paths',()=>{
  for(const token of ['regionalRouteRange','regionalTimelineTitle','syncRegionalUrl','isolateRegionalRuntime'])assert.match(source,new RegExp(token));
  assert.match(appSource,/platformOwnsRoute/);
  assert.match(appSource,/if\(!state\.globe \|\| platformOwnsRoute\(\)\) return/);
  assert.match(iteration2Source,/platform-regional-trip/);
  assert.match(cssSource,/platform-regional-trip \.journey-context/);
});

test('mobile platform keeps Traveller available',()=>{
  const ui=moduleSources['ui.js'];
  assert.match(cssSource,/platform-pill\.secondary\{display:flex\}/);
  assert.match(ui,/id="platformTravellerBtn"/);
  assert.match(ui,/platform-pill-icon/);
  assert.match(source,/Ui\.ensureGlobalActions/);
});

test('localhost service worker cannot keep stale QA bundles',()=>{
  assert.match(swSource,/LOCAL_PREVIEW/);
  assert.match(swSource,/self\.registration\.unregister/);
});



test('regional routes expose generic story and terrain APIs',()=>{
  const story=moduleSources['story.js'];
  const terrain=moduleSources['terrain.js'];
  for(const token of ['platformStoryBtn','platformStoryHud','function start','function stop'])assert.match(story,new RegExp(token));
  for(const token of ['function setActive','function focusRoute','function focusSegment','function routeGeoJson'])assert.match(terrain,new RegExp(token));
  assert.match(source,/setTerrain:active=>Terrain\.setActive\(active\)/);
  assert.match(source,/startStory:\(\)=>Story\.start\(\)/);
  assert.match(source,/stopStory:\(\)=>Story\.stop\(\)/);
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
  const story=moduleSources['story.js'];
  assert.match(source,/id="regionalRouteRange"/);
  assert.doesNotMatch(story,/routeRange|194-leg|194/);
  assert.match(story,/trip\.segments\.length/);
});


test('regional route focus fits the whole trip and terrain labels localize',()=>{
  const mapStyle=moduleSources['map-style.js'];
  const terrain=moduleSources['terrain.js'];
  assert.match(terrain,/function focusRoute/);
  assert.match(terrain,/fitBounds\(bounds/);
  assert.match(source,/focusRoute:\(\)=>\{if\(document\.body\.classList\.contains\('terrain-view'\)\)Terrain\.focusRoute\(\)/);
  assert.match(terrain,/mapStyle\.localize/);
  assert.match(mapStyle,/name:\$\{lang\}/);
});

test('regional Story control is not hidden behind desktop side panels',()=>{
  assert.match(cssSource,/\.platform-story-btn\{[^}]*left:50%[^}]*bottom:18px/);
  assert.match(cssSource,/\.platform-story-mode \.mobile-panel-btn\{display:none!important\}/);
});


test('regional terrain attribution stays compact and clear of mobile controls',()=>{
  const terrain=moduleSources['terrain.js'];
  assert.match(terrain,/attributionControl:false/);
  assert.match(terrain,/AttributionControl\(\{compact:true\}\)/);
  assert.match(cssSource,/maplibregl-ctrl-bottom-left\{left:316px;bottom:88px\}/);
  assert.match(cssSource,/@media\(max-width:820px\)[\s\S]*maplibregl-ctrl-bottom-left\{left:8px;bottom:56px\}/);
});

test('regional overview duration uses a dedicated non-overlapping unit style',()=>{
  const detail=moduleSources['regional-detail.js'];
  assert.match(detail,/platform-duration-number/);
  assert.match(cssSource,/\.platform-duration-number\{display:flex/);
});


test('regional UX detail modes keep sparse panels compact',()=>{
  const detail=moduleSources['regional-detail.js'];
  assert.match(detail,/function setMode/);
  assert.match(detail,/\['overview','stop','segment'\]/);
  assert.match(detail,/platform-detail-'\+key/);
  assert.doesNotMatch(source,/function setRegionalDetailMode/);
  assert.match(cssSource,/platform-detail-overview \.right-panel/);
  assert.match(cssSource,/platform-detail-stop \.right-panel/);
});

test('regional terrain uses branded dark map styling',()=>{
  const mapStyle=moduleSources['map-style.js'];
  const terrain=moduleSources['terrain.js'];
  assert.match(terrain,/mapStyle\.brandDark\(mapStyle\.localize/);
  assert.match(mapStyle,/background-color'\]='#071019'/);
  assert.match(mapStyle,/fill-color'\]='#071b2a'/);
  assert.match(mapStyle,/text-halo-color'\]='#071019'/);
});

test('regional copy is visually reduced without removing overview content',()=>{
  const detail=moduleSources['regional-detail.js'];
  assert.match(cssSource,/-webkit-line-clamp:4/);
  assert.match(cssSource,/-webkit-line-clamp:2/);
  assert.match(detail,/detail-copy/);
});


test('route library exposes transparent Route Fit controls',()=>{
  const routeLibrary=moduleSources['route-library.js'];
  for(const token of ['platformFitToggle','platformFitFilters','platformRoutePace','platformRouteSeason','platformRouteParty','platformRouteStart'])assert.match(routeLibrary,new RegExp(token));
  assert.match(routeLibrary,/pluralLabel\(filtered\.length/);
  assert.doesNotMatch(routeLibrary,/filtered\.length===1/);
  const discovery=moduleSources['discovery.js'];
  assert.match(discovery,/fit\.pace===filters\.pace/);
  assert.match(discovery,/fit\.seasons/);
  assert.match(discovery,/fit\.party/);
  assert.match(discovery,/fit\.startRegion===filters\.start/);
  assert.match(cssSource,/\.platform-fit-filters/);
});


test('platform core delegates reusable concerns to modules',()=>{
  const routeLibrary=moduleSources['route-library.js'];
  const ui=moduleSources['ui.js'];
  assert.match(source,/const Model=PLATFORM_MODULES\.model/);
  assert.match(source,/const Traveller=PLATFORM_MODULES\.traveller/);
  assert.match(source,/const TravellerUi=PLATFORM_MODULES\.travellerUi/);
  assert.match(source,/const Ui=PLATFORM_MODULES\.ui/);
  assert.match(source,/const Navigation=PLATFORM_MODULES\.navigation/);
  assert.match(source,/const LegacyLocalization=PLATFORM_MODULES\.legacyLocalization/);
  assert.match(source,/const Discovery=PLATFORM_MODULES\.discovery/);
  assert.match(source,/const Extensions=PLATFORM_MODULES\.extensions/);
  assert.match(source,/const RouteLibrary=PLATFORM_MODULES\.routeLibrary/);
  assert.match(source,/const RegionalShell=PLATFORM_MODULES\.regionalShell/);
  assert.match(source,/const RegionalDetail=PLATFORM_MODULES\.regionalDetail/);
  assert.match(source,/const Story=PLATFORM_MODULES\.story/);
  assert.match(source,/const Terrain=PLATFORM_MODULES\.terrain/);
  assert.match(source,/RouteLibrary\.open\(/);
  assert.match(source,/RegionalShell\.configure\(/);
  assert.match(source,/RegionalShell\.apply\(/);
  assert.match(source,/RegionalDetail\.configure\(/);
  assert.match(source,/RegionalDetail\.renderTripOverview\(/);
  assert.match(source,/Story\.configure\(/);
  assert.match(source,/Ui\.ensureGlobalActions\(/);
  assert.match(source,/Navigation\.buildTripUrl\(/);
  assert.match(source,/Navigation\.regionalUrl\(/);
  assert.match(source,/ensureDialog:Ui\.ensureDialog/);
  assert.match(source,/settings:Ui\.regionalSettings/);
  assert.match(source,/toast:Ui\.toast/);
  assert.match(source,/LocaleData\.regionName\(locale,code\)/);
  assert.match(source,/LocaleData\.plural\(locale,count/);
  assert.match(routeLibrary,/Discovery\.facets\(catalog\)/);
  assert.match(routeLibrary,/Discovery\.filter\(catalog/);
  assert.match(ui,/function ensureDialog/);
  assert.match(ui,/function regionalSettings/);
  assert.doesNotMatch(source,/function ensureDialog|function platformToast|function regionalSettings/);
  assert.match(source,/Traveller\.load\(/);
  assert.match(source,/Model\.routeGeometry\(/);
});

test('regional shell stays data-driven and renderer-agnostic',()=>{
  const shell=moduleSources['regional-shell.js'];
  for(const token of ['function apply','function buildLeftNavigation','function buildChapterRail'])assert.match(shell,new RegExp(token));
  assert.match(shell,/d\.getTrip\(\)/);
  assert.match(shell,/d\.selectStop/);
  assert.doesNotMatch(shell,/trip\.id\s*===|trip\.kind\s*===|currentTrip|ONE_WORLD_ROUTE_GLOBE/);
});

test('regional detail renderer stays generic and extension-driven',()=>{
  const detail=moduleSources['regional-detail.js'];
  for(const token of ['function renderTripOverview','function renderStopDetail','function renderSegmentDetail'])assert.match(detail,new RegExp(token));
  assert.match(detail,/d\.extensions\.composeTripOverview/);
  assert.match(detail,/d\.extensions\.composeStopDetail/);
  assert.match(detail,/d\.extensions\.composeSegmentDetail/);
  assert.doesNotMatch(detail,/trip\.id\s*===|trip\.kind\s*===|currentTrip|ONE_WORLD_ROUTE_GLOBE/);
  assert.doesNotMatch(source,/function renderTripOverview|function renderStopDetail|function renderSegmentDetail/);
});

test('trip specialization lives in registered extensions rather than trip-kind branches',()=>{
  const extensions=moduleSources['extensions.js'];
  const detail=moduleSources['regional-detail.js'];
  assert.match(extensions,/registerExtension\('cruise'/);
  assert.match(extensions,/registerExtension\('road'/);
  assert.match(extensions,/registerExtension\('border'/);
  assert.match(detail,/composeTripOverview/);
  assert.match(detail,/composeStopDetail/);
  assert.match(detail,/composeSegmentDetail/);
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
  const legacyLocalization=moduleSources['legacy-localization.js'];
  assert.match(i18n,/legacyWorldText:LEGACY_WORLD_TEXT/);
  assert.match(i18n,/supportedLocales/);
  assert.match(legacyLocalization,/function translate/);
  assert.match(legacyLocalization,/function activate/);
  assert.match(source,/LegacyLocalization\.configure/);
  assert.doesNotMatch(source,/const I18N = \{/);
  assert.doesNotMatch(source,/const LEGACY_WORLD_TEXT = \{/);
  assert.doesNotMatch(source,/function legacyTranslate|function activateLegacyLocalization/);
});


test('terrain branding is shared by world and regional renderers',()=>{
  const mapStyle=moduleSources['map-style.js'];
  const terrain=moduleSources['terrain.js'];
  assert.match(mapStyle,/function brandDark/);
  assert.match(mapStyle,/function localize/);
  assert.match(terrain,/root\.mapStyle/);
  assert.match(terrain,/mapStyle\.brandDark\(mapStyle\.localize/);
  assert.match((iteration2Source+appSource+mapStyle+terrain),/ONE_WORLD_PLATFORM_MODULES|brandDark/);
});
