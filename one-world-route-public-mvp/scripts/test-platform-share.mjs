import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../platform/share.js',import.meta.url),'utf8');

function load({share=null,clipboard=null}={}){
  const calls={share:[],clipboard:[],toast:[]};
  const document={
    title:'Route title',
    querySelector:()=>null
  };
  const navigator={};
  if(share)navigator.share=async payload=>{calls.share.push(payload);return share(payload)};
  if(clipboard)navigator.clipboard={writeText:async value=>{calls.clipboard.push(value);return clipboard(value)}};
  const window={ONE_WORLD_PLATFORM_MODULES:{}};
  const context={window,document,navigator,location:{href:'https://example.test/?trip=abc&variant=short'},console};
  vm.createContext(context);
  vm.runInContext(source,context);
  const api=window.ONE_WORLD_PLATFORM_MODULES.share;
  api.configure({title:()=> 'Trip ABC',t:key=>({shareCopied:'Copied',shareCopyFallback:'Manual'}[key]||key),toast:value=>calls.toast.push(value)});
  return {api,calls};
}

test('native share preserves the full deep link',async()=>{
  const {api,calls}=load({share:async()=>{}});
  const result=await api.shareCurrent();
  assert.equal(result.ok,true);
  assert.equal(result.method,'native');
  assert.equal(calls.share[0].url,'https://example.test/?trip=abc&variant=short');
  assert.equal(calls.share[0].title,'Trip ABC');
});

test('clipboard is used when native share is unavailable',async()=>{
  const {api,calls}=load({clipboard:async()=>{}});
  const result=await api.shareCurrent();
  assert.equal(result.ok,true);
  assert.equal(result.method,'clipboard');
  assert.deepEqual(calls.clipboard,['https://example.test/?trip=abc&variant=short']);
  assert.deepEqual(calls.toast,['Copied']);
});

test('cancelling native share does not show a failure message',async()=>{
  const {api,calls}=load({share:async()=>{const error=new Error('cancel');error.name='AbortError';throw error}});
  const result=await api.shareCurrent();
  assert.equal(result.ok,false);
  assert.equal(result.reason,'cancelled');
  assert.deepEqual(calls.toast,[]);
});
