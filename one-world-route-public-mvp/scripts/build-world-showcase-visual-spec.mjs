import {readFile,writeFile} from 'node:fs/promises';
import {buildVisualBrief} from './visual-brief-model.mjs';

const ROOT=new URL('../',import.meta.url);
const read=async p=>JSON.parse(await readFile(new URL(p,ROOT),'utf8'));
const check=process.argv.includes('--check');
const EXPECTED_RENDER_STYLE='premium-full-bleed-world-v2';
const EXPECTED_STATIC_ROUTE_COLOR_MODE='single-color';
const EXPECTED_STATIC_ROUTE_COLOR='#FF5A52';

const [catalog,publicRoute,routeVisuals,registry]=await Promise.all([
  read('data/platform/trips.json'),
  read('data/public-route.json'),
  read('data/platform/route-visuals.json'),
  read('data/platform/generated-media.json')
]);

const meta=(catalog.trips||[]).find(t=>t.id==='world-195');
if(!meta)throw Error('world-195 catalog entry missing');
if((publicRoute.countries||[]).length!==195)throw Error('world-195 invariant failed: expected 195 countries');
if((publicRoute.segments||[]).length!==194)throw Error('world-195 invariant failed: expected 194 international segments');

const route=routeVisuals.journeys?.find(j=>j.id==='world-195');
if(!route?.media||route.scope!=='GLOBAL')throw Error('world-195 GLOBAL route visual missing');
if(route.countries?.length!==195)throw Error('world-195 route visual must cover 195 countries');
if(route.media.assetId!=='auto-route-world-195')throw Error('world-195 route visual identity changed unexpectedly');

const brief=buildVisualBrief(meta,publicRoute,route);
if(brief.productionStrategy!=='deterministic-full-bleed-world-route'||!brief.routeOverlayRequired){
  throw Error('world-195 must use the deterministic full-bleed strategy');
}
if(brief.imagePrompt!=='')throw Error('world-195 must not require an AI image prompt');

const published=(registry.assets||[]).find(a=>
  a.assetId==='journey--world-195--cover--16x9--v001'&&
  a.tripId==='world-195'&&
  a.mediaKind==='journey-cover'&&
  a.status==='published'&&
  a.rightsStatus==='approved'&&
  a.factualRouteLayer?.renderStyle===EXPECTED_RENDER_STYLE&&
  a.factualRouteLayer?.staticRouteColorMode===EXPECTED_STATIC_ROUTE_COLOR_MODE&&
  a.factualRouteLayer?.staticRouteColor===EXPECTED_STATIC_ROUTE_COLOR
);

const report={
  schemaVersion:1,
  policyVersion:'world-showcase-full-bleed-v2',
  tripId:'world-195',
  strategy:'deterministic-full-bleed-world-route',
  status:published?'published':'render-ready',
  invariants:{
    sovereignCountries:195,
    internationalLegs:194,
    routeVisualScope:route.scope,
    routeLines:route.geometry.lines,
    detailedRouteLines:route.geometry.detailed,
    schematicRouteLines:route.geometry.schematic
  },
  factualLayer:{
    assetId:route.media.assetId,
    asset:route.media.asset,
    provider:route.media.provider,
    license:route.media.license,
    sourceLicenseUrl:route.media.sourceLicenseUrl,
    attribution:route.media.attribution,
    geometryBasis:route.media.geometryBasis,
    geometrySource:'data/public-route.json',
    basemapSource:'data/visual-sources/natural-earth-relief.webp',
    renderStyle:EXPECTED_RENDER_STYLE,
    projection:'equirectangular-full-bleed',
    fullBleed:true,
    spaceBackground:false,
    visibleContainer:false,
    staticGraphicRouteStyle:'single-coral-red',
    staticRouteColorMode:EXPECTED_STATIC_ROUTE_COLOR_MODE,
    staticRouteColor:EXPECTED_STATIC_ROUTE_COLOR,
    interactiveRouteStyle:'continent-colors',
    interactiveGlobeUnchanged:true,
    routeVisualReferenceOnly:true,
    countries:route.countries.length,
    routeLines:route.geometry.lines
  },
  finalCover:{
    assetId:'journey--world-195--cover--16x9--v001',
    sourceType:'generated',
    mediaKind:'journey-cover',
    outputWidths:[480,800,1200,1600],
    approvalRequired:true,
    registrationTargets:[
      'data/platform/generated-media.json',
      'data/public-route.json#media.heroAssetId'
    ]
  },
  ...(published?{publishedAssetId:published.assetId,factualLayerSha256:published.factualRouteLayer?.sha256||null}:{})
};

const target=new URL('data/platform/world-showcase-visual.json',ROOT);
const serialized=JSON.stringify(report,null,2)+'\n';
if(check){
  const current=await readFile(target,'utf8').catch(()=>null);
  if(current!==serialized)throw Error('world-showcase-visual.json stale; run npm run world:visual:spec');
}else{
  await writeFile(target,serialized);
}
console.log('World showcase visual spec:',report.status,'|',report.invariants.sovereignCountries,'countries /',report.invariants.internationalLegs,'legs');
