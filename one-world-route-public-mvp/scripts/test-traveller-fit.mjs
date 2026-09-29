import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../platform/traveller-fit.js',import.meta.url),'utf8');

function load(){
  const window={ONE_WORLD_PLATFORM_MODULES:{}};
  const context={window,console};
  vm.createContext(context);
  vm.runInContext(source,context);
  return window.ONE_WORLD_PLATFORM_MODULES.travellerFit;
}

test('Traveller Fit derives transparent party context without ranking routes',()=>{
  const fit=load();
  assert.equal(fit.partyKey({party:{adults:1,children:0}}),'solo');
  assert.equal(fit.partyKey({party:{adults:2,children:0}}),'couples');
  assert.equal(fit.partyKey({party:{adults:4,children:0}}),'friends');
  assert.equal(fit.partyKey({party:{adults:2,children:1}}),'families');
});

test('Traveller Fit reports explicit checks from published metadata and local context',()=>{
  const fit=load();
  const meta={
    capabilities:['vehicle-context'],
    discovery:{fit:{party:['couples','friends'],accessibility:'vehicle-dependent',startRegion:'europe',pace:'active',seasons:['spring','autumn']}}
  };
  const result=fit.evaluate(meta,{
    origin:'Frankfurt',
    party:{adults:2,children:1},
    accessibility:{reducedMobility:true},
    vehicle:null
  });
  assert.equal(result.party,'families');
  assert.equal(result.partyListed,false);
  assert.equal(result.needsMobilityCheck,true);
  assert.equal(result.vehicleContextMissing,true);
  assert.equal(result.origin,'Frankfurt');
  assert.deepEqual(JSON.parse(JSON.stringify(result.seasons)),['spring','autumn']);
});

test('traveller fit exposes explicit origin region without inferring it from free text',()=>{
  const fit=load();
  const result=fit.evaluate({discovery:{fit:{party:['solo'],seasons:['spring'],startRegion:'europe',accessibility:'standard-check'}},capabilities:[]},{origin:'Frankfurt / FRA',originRegion:'europe',party:{adults:1,children:0}});
  assert.equal(result.origin,'Frankfurt / FRA');
  assert.equal(result.originRegion,'europe');
  assert.equal(result.startRegion,'europe');
});

test('recommendation reasons expose why a route fits without exposing a magic score',()=>{
  const fit=load();
  const meta={discovery:{modes:['rail'],fit:{party:['couples'],startRegion:'europe',pace:'balanced',seasons:['spring'],accessibility:'standard-check'}},capabilities:[]};
  const profile={origin:'Frankfurt',originCountry:'DE',originRegion:'europe',party:{adults:2,children:0}};
  assert.equal(fit.evaluate(meta,profile).originCountry,'DE');
  assert.deepEqual(JSON.parse(JSON.stringify(fit.recommendationReasons(meta,profile))),[
    {kind:'origin',value:'europe'},
    {kind:'party',value:'couples'},
    {kind:'mode',value:'rail'}
  ]);
});

test('journey preferences reuse published discovery metadata and rank without a separate recommendation dataset',()=>{
  const fit=load();
  const profile={
    originRegion:'europe',
    party:{adults:2,children:0},
    preferences:{durationBand:'7-14',pace:'balanced',season:'spring',mode:'rail',theme:'culture'}
  };
  const rail={
    id:'rail',
    visual:{featurePriority:1},
    discovery:{durationBand:'7-14',modes:['rail'],themes:['culture'],regions:['europe'],fit:{party:['couples'],startRegion:'europe',pace:'balanced',seasons:['spring'],accessibility:'standard-check'}}
  };
  const road={
    id:'road',
    visual:{featurePriority:99},
    discovery:{durationBand:'15-30',modes:['car'],themes:['nature'],regions:['europe'],fit:{party:['couples'],startRegion:'europe',pace:'active',seasons:['summer'],accessibility:'standard-check'}}
  };
  const reasons=fit.recommendationReasons(rail,profile);
  assert.deepEqual(JSON.parse(JSON.stringify(reasons)),[
    {kind:'duration',value:'7-14'},
    {kind:'pace',value:'balanced'},
    {kind:'season',value:'spring'}
  ]);
  const ordered=fit.orderRecommendations([road,rail],profile);
  assert.equal(ordered[0].trip.id,'rail');
  assert.equal(ordered[0].preferenceMatches,5);
  assert.equal(ordered[0].preferenceMisses,0);
  assert.ok(ordered[0].contextMatches>=2);
  assert.equal(ordered[1].preferenceMisses,5);
});


test('recommendation summary separates preference matches from explicit traveller checks',()=>{
  const fit=load();
  const meta={
    capabilities:['vehicle-context'],
    discovery:{
      durationBand:'7-14',
      modes:['car'],
      themes:['nature'],
      fit:{party:['couples'],startRegion:'europe',pace:'balanced',seasons:['spring'],accessibility:'vehicle-dependent'}
    }
  };
  const profile={
    originRegion:'europe',
    party:{adults:2,children:1},
    accessibility:{reducedMobility:true},
    vehicle:null,
    preferences:{durationBand:'7-14',pace:'balanced',season:'spring',mode:'car',theme:'nature'}
  };
  const summary=fit.recommendationSummary(meta,profile);
  assert.equal(summary.configured,5);
  assert.equal(summary.preferenceMatches,5);
  assert.equal(summary.preferenceMisses,0);
  assert.deepEqual(JSON.parse(JSON.stringify(summary.checks)),['party','mobility','vehicle']);
});
