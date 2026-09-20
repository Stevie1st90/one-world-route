import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {validateStyleMin} from '@maplibre/maplibre-gl-style-spec';

test('terrain overlay style passes MapLibre validation including active connector zoom rules',async()=>{
  const source=await readFile(new URL('../../iteration9.js',import.meta.url),'utf8');
  const functions=source.slice(source.indexOf('  function colorExpression()'),source.indexOf('  function deactivateTerrain('));
  const empty=()=>({type:'FeatureCollection',features:[]});
  const context={activeTerrainPhase:()=>1,runtime:{selectedId:22},routeGeoJson:empty,countryGeoJson:empty,$:()=>null,clamp:(x,a,b)=>Math.min(b,Math.max(a,x)),URLSearchParams,location:{search:''},fetch:async()=>({ok:true,json:async()=>({version:8,sources:{},layers:[]})})};
  const style=await runInNewContext(functions+'\nterrainStyle()',context);
  assert.deepEqual(validateStyleMin(JSON.parse(JSON.stringify(style))).map(e=>e.message),[]);
});
