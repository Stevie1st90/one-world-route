import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {circularBounds,extractRoute,cameraFit,project,RATIOS} from './route-visual-model.mjs';
import '../platform/visual-policy.js';
const read=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const catalog=await read('data/platform/trips.json');
const deps={countries:await read('data/country-centroids.json'),waypoints:await read('data/route-waypoints.json'),flights:await read('data/flight-geometries.json'),movements:await read('data/operational-movements.json')};
const routes=await Promise.all(catalog.trips.map(async m=>extractRoute(m,await read(m.dataset.slice(2)),deps)));
test('all catalog journeys preserve route coordinates inside native ratio safe bounds',()=>{
 assert.equal(routes.length,catalog.trips.length);
 for(const route of routes)for(const ratio of Object.keys(RATIOS)){
  const c=cameraFit(route,ratio);
  for(const p of [...route.lines.flatMap(l=>l.coordinates),...route.markers]){
   const [x,y]=project(p,route,c);
   assert.ok(x>=c.padding.left-.001&&x<=c.width-c.padding.right+.001,route.scope+' '+ratio+' horizontal fit');
   assert.ok(y>=c.padding.top-.001&&y<=c.height-c.padding.bottom+.001,route.scope+' '+ratio+' vertical fit');
  }
 }
 assert.equal(routes[0].scope,'GLOBAL');
 assert.equal(routes[0].countries.length,195);
 assert.equal(routes[0].lines.filter(l=>l.kind!=='operational-connector').length,194);
});
test('minimal circular interval fits a dateline crossing instead of spanning 340 degrees',()=>{
 const b=circularBounds([[170,35],[-170,60],[178,45]]);
 assert.equal(b.longitudeSpan,20);assert.equal(b.datelineCrossing,true);
 const route={bounds:b};
 for(const ratio of Object.keys(RATIOS)){const c=cameraFit(route,ratio);for(const p of [[170,35],[-170,60]]){const [x,y]=project(p,route,c);assert.ok(x>=c.padding.left-.001&&x<=c.width-c.padding.right+.001);assert.ok(y>=c.padding.top-.001&&y<=c.height-c.padding.bottom+.001);}}
});
const fixture=(points,countries)=>({geography:{countries},places:points.map((p,i)=>({id:String(i),countryCode:countries[i%countries.length],coordinates:{lng:p[0],lat:p[1]}})),stops:points.map((_,i)=>({id:String(i),placeId:String(i)})),segments:points.slice(1).map((_,i)=>({id:String(i),fromStopId:String(i),toStopId:String(i+1)}))});
test('scope uses geographic span before country count; local and continental fixtures',()=>{
 assert.equal(extractRoute({},fixture([[10,46],[10.1,46.1]],['IT','AT','CH']),deps).scope,'LOCAL');
 assert.equal(extractRoute({},fixture([[-5,70],[40,-20]],['GB','ZA']),deps).scope,'CONTINENTAL');
 assert.equal(extractRoute({},fixture([[8,48],[10,55]],['DE']),deps).scope,'NATIONAL');
});
test('explicit segment geometry, including intermediate extremes, overrides stop connectors',()=>{
 const t=fixture([[0,0],[1,1]],['DE']);t.segments[0].geometry={type:'LineString',coordinates:[[0,0],[10,12],[1,1]]};
 const r=extractRoute({},t,deps);assert.equal(r.detailed,1);assert.equal(r.bounds.north,12);assert.equal(r.lines[0].coordinates.length,3);
});
const asset=(id,extra={})=>({assetId:id,type:'image',asset:'./assets/'+id+'.webp',status:'published',rightsStatus:'approved',license:'owned',attribution:'Team',...extra});
test('rights, explicit multi-country anchors and cover precedence are enforced centrally',()=>{
 const p=globalThis.ONE_WORLD_VISUAL_POLICY,auto=asset('auto',{derivatives:{vertical:{asset:'./assets/auto-v.webp'}}}),destination=asset('italy',{destination:{type:'country',id:'IT'}}),cover=asset('journey');
 const c={countries:['IT','FR'],autoRouteVisual:auto,destinationAssets:[destination]};
 assert.equal(p.resolveJourneyVisual({},c).kind,'auto');
 assert.equal(p.resolveJourneyVisual({visualAnchor:{type:'country',id:'IT'}},c).kind,'destination');
 assert.equal(p.resolveJourneyVisual({}, {...c,countries:['IT']}).kind,'destination');
 assert.equal(p.resolveJourneyVisual({}, {...c,journeyCover:cover}).kind,'bespoke');
 assert.equal(p.resolveJourneyVisual({}, {...c,journeyCover:{...cover,rightsStatus:'pending'}}).kind,'auto');
 assert.equal(p.resolveJourneyVisual({}, {...c,journeyCover:cover,purpose:'social',ratio:'vertical'}).kind,'auto');
 assert.equal(p.resolveJourneyVisual({}, {...c,journeyCover:cover,purpose:'planning'}).kind,'auto');
 assert.equal(p.resolveJourneyVisual({}, {...c,autoRouteVisual:{...auto,asset:'./assets/../bad.webp'}}).kind,'abstract');
});
