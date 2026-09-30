import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../platform/media.js',import.meta.url),'utf8');
function load(){
  const window={ONE_WORLD_PLATFORM_MODULES:{}};
  const context=vm.createContext({window,String});
  vm.runInContext(source,context);
  return window.ONE_WORLD_PLATFORM_MODULES.media;
}

test('media renderer keeps art-directed fallback',()=>{
  const media=load().descriptor({type:'art-directed',theme:'desert',license:'original-ui-art'});
  assert.equal(media.type,'art-directed');
  assert.equal(media.className,'visual-desert');
  assert.equal(media.style,'');
});

test('media renderer accepts only controlled local assets',()=>{
  const api=load();
  const ok=api.descriptor({type:'image',theme:'ocean',asset:'./assets/trips/example.webp',attribution:'ONE WORLD ROUTE',license:'owned'});
  assert.equal(ok.type,'image');
  assert.match(ok.style,/assets\/trips\/example\.webp/);
  const unsafe=api.descriptor({type:'image',theme:'ocean',asset:'https://example.com/image.jpg'});
  assert.equal(unsafe.type,'art-directed');
});

test('media credit is emitted only for licensed image assets',()=>{
  const api=load();
  assert.match(api.credit({type:'image',asset:'./assets/example.webp',attribution:'Photo team',license:'owned'},v=>String(v)),/Photo team · owned/);
  assert.equal(api.credit({type:'art-directed',theme:'ocean'},v=>String(v)),'');
});

// Reject unlicensed assets and traversal even if an entry bypasses the data validator.
test('media rendering requires credit, rights and a contained asset path',()=>{
  const api=load();
  assert.equal(api.descriptor({type:'image',asset:'./assets/example.webp'}).type,'art-directed');
  assert.equal(api.descriptor({type:'image',asset:'./assets/../example.webp',license:'owned',attribution:'Team'}).type,'art-directed');
});

test('journey visuals project the public place coordinates',()=>{
  const api=load();
  const preview=api.tripPreview({places:[{id:'a',coordinates:{lat:35,lng:139}},{id:'b',coordinates:{lat:34,lng:135}}],stops:[{placeId:'a'},{placeId:'b'}]});
  assert.match(api.routeArt(preview),/<path d="M/);
  assert.equal(api.routeArt({arcs:[{start:{lat:null,lng:null},end:{lat:0,lng:0}}]}),'');
});

 test('generated assets require approval and use format-specific focal points',()=>{
 const api=load(),entry={type:'image',sourceType:'generated',status:'planned',rightsStatus:'pending',asset:'./assets/example.webp',license:'reviewed-terms',attribution:'ONE WORLD ROUTE',focalPoint:{x:.2,y:.3},derivatives:{vertical:{asset:'./assets/example-vertical.webp',focalPoint:{x:2,y:-1}}}};
 assert.equal(api.descriptor(entry).type,'art-directed');
 entry.status='published';entry.rightsStatus='approved';
 const result=api.descriptor(entry,'ocean','vertical');
 assert.equal(result.asset,'./assets/example-vertical.webp');
 assert.equal(result.focalPoint.x,1);assert.equal(result.focalPoint.y,0);
 });
