import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRailExtension} from './platform-extension-validators/rail.mjs';

function validContext(){
  const trip={
    extensions:{
      rail:{
        scope:'rail-only',
        timetablePolicy:'live-operator-check',
        sourcePolicy:'official-operator',
        crossBorder:true
      }
    },
    places:[
      {id:'a',countryCode:'FR'},
      {id:'b',countryCode:'BE'}
    ],
    sources:[
      {id:'operator-route',issuerType:'official-operator'}
    ]
  };
  const segs=[{
    id:'leg-1',
    transport:{
      mode:'rail',
      stages:[{mode:'rail',sourceIds:['operator-route']}]
    },
    planning:{durationBasis:'operator-published-current'},
    verification:{status:'verified',sourceIds:['operator-route']}
  }];
  return {
    item:{id:'rail-proof',discovery:{modes:['rail']}},
    trip,
    segs,
    placeById:new Map(trip.places.map(place=>[place.id,place]))
  };
}

function failuresFor(ctx){
  const failures=[];
  validateRailExtension({...ctx,fail:message=>failures.push(message)});
  return failures;
}

test('rail-only extension accepts an all-rail journey backed by official operators',()=>{
  assert.deepEqual(failuresFor(validContext()),[]);
});

test('rail-only extension rejects non-rail transport stages',()=>{
  const ctx=validContext();
  ctx.segs[0].transport.stages[0].mode='bus';
  assert.match(failuresFor(ctx).join('\n'),/contains non-rail stage bus/);
});

test('official-operator rail source policy rejects non-operator evidence',()=>{
  const ctx=validContext();
  ctx.trip.sources[0].issuerType='editorial';
  assert.match(failuresFor(ctx).join('\n'),/must be official-operator/);
});
