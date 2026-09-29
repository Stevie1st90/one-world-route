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
