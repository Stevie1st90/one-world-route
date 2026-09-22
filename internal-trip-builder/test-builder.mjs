import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraft,normalizeCatalogEntry,validateDraft} from './lib.mjs';

const catalog={
  defaultLocale:'en',
  supportedLocales:['en','de','it','es','fr','pt'],
  trips:[{id:'world-195',slug:'world-195'}]
};
const all=value=>Object.fromEntries(catalog.supportedLocales.map(l=>[l,value]));

function validCycling(){
  const draft=createDraft(catalog,{slug:'alpine-cycling-loop',kind:'cycling',days:8,title:'Alpine Cycling Loop'});
  draft.trip.status='sourced-beta';
  draft.catalogEntry.status='sourced-beta';
  draft.trip.title=all('Alpine Cycling Loop');
  draft.trip.summary=all('An illustrative cycling architecture proof with sourced route-ready data.');
  draft.catalogEntry.title=all('Alpine Cycling Loop');
  draft.catalogEntry.subtitle=all('8 days · cycling architecture proof');
  draft.catalogEntry.capabilities=['globe','regional-stops','story','terrain'];
  draft.catalogEntry.discovery={
    regions:['europe'],themes:['cycling','mountains'],modes:['bicycle'],durationBand:'7-14',featured:false,
    fit:{pace:'active',seasons:['summer'],party:['solo','couples','friends'],startRegion:'europe',accessibility:'complex-planning'}
  };
  draft.trip.places=[
    {id:'a',type:'city',countryCode:'DE',name:{en:'A'},coordinates:{lat:47.5,lng:10.2}},
    {id:'b',type:'city',countryCode:'AT',name:{en:'B'},coordinates:{lat:47.3,lng:11.1}}
  ];
  draft.trip.stops=[
    {sequence:1,id:'stop-a',placeId:'a',day:1,kind:'stop'},
    {sequence:2,id:'stop-b',placeId:'b',day:8,kind:'stop'}
  ];
  draft.trip.sources=[{id:'official-route',title:'Official route',issuer:'Tourism board',issuerType:'primary-source',url:'https://example.com/route',checkedAt:'2026-09-22'}];
  draft.trip.segments=[{
    sequence:1,id:'leg-1',fromStopId:'stop-a',toStopId:'stop-b',
    transport:{mode:'bicycle',stages:[]},
    planning:{durationMinutes:null,durationBasis:'live-timetable-required'},
    verification:{status:'current-check-required',sourceIds:['official-route']}
  }];
  return draft;
}

test('builder accepts an open cycling kind without renderer changes',()=>{
  const draft=validCycling();
  const item=normalizeCatalogEntry(draft.catalogEntry,draft.trip,catalog);
  const result=validateDraft({catalog,item,trip:draft.trip});
  assert.equal(result.ok,true,result.errors.join('\n'));
  assert.equal(result.metrics.stops,2);
  assert.equal(result.metrics.segments,1);
  assert.equal(item.kind,'cycling');
  assert.equal(item.renderer,'regional-globe');
});

test('builder gate rejects broken continuity',()=>{
  const draft=validCycling();
  draft.trip.segments[0].toStopId='missing-stop';
  const item=normalizeCatalogEntry(draft.catalogEntry,draft.trip,catalog);
  const result=validateDraft({catalog,item,trip:draft.trip});
  assert.equal(result.ok,false);
  assert.match(result.errors.join('\n'),/non-continuous segment/);
});

test('builder gate rejects TODO placeholders',()=>{
  const draft=validCycling();
  draft.trip.summary.de='TODO translate';
  const item=normalizeCatalogEntry(draft.catalogEntry,draft.trip,catalog);
  const result=validateDraft({catalog,item,trip:draft.trip});
  assert.equal(result.ok,false);
  assert.match(result.errors.join('\n'),/TODO placeholders/);
});
