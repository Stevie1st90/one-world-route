import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const handler=require('../api/share.js');

function render(query){
  const headers={};
  let body='';
  const req={query};
  const res={
    setHeader(k,v){headers[k]=v},
    end(v){body=String(v)}
  };
  handler(req,res);
  return {headers,body};
}

test('localized trip share page emits German metadata canonical and hreflang',()=>{
  const {headers,body}=render({type:'trip',slug:'italy-grand-tour',lang:'de'});
  assert.equal(headers['Content-Language'],'de');
  assert.match(body,/<html lang="de">/);
  assert.match(body,/Große Italien-Rundreise — ONE WORLD ROUTE/);
  assert.match(body,/rel="canonical" href="https:\/\/one-world-route\.vercel\.app\/de\/trip\/italy-grand-tour"/);
  for(const lang of ['en','de','it','es','fr','pt'])assert.match(body,new RegExp('hreflang="'+lang+'"'));
  assert.match(body,/hreflang="x-default"/);
  assert.match(body,/"@type":"TouristTrip"/);
  assert.match(body,/trip=italy-grand-tour&amp;lang=de|trip%3Ditaly-grand-tour/);
});

test('x-default trip share page keeps neutral canonical and falls back to English',()=>{
  const {headers,body}=render({type:'trip',slug:'western-mediterranean-cruise-loop'});
  assert.equal(headers['Content-Language'],'en');
  assert.match(body,/Western Mediterranean Cruise Loop/);
  assert.match(body,/rel="canonical" href="https:\/\/one-world-route\.vercel\.app\/trip\/western-mediterranean-cruise-loop"/);
  assert.match(body,/Cruise tourism/);
});

test('unsupported share language cannot create a bogus canonical',()=>{
  const {headers,body}=render({type:'trip',slug:'italy-grand-tour',lang:'zz'});
  assert.equal(headers['Content-Language'],'en');
  assert.doesNotMatch(body,/\/zz\/trip\//);
  assert.match(body,/href="https:\/\/one-world-route\.vercel\.app\/trip\/italy-grand-tour"/);
});
