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

test('road-trip share page is localized and identified as a road trip',()=>{
  const {headers,body}=render({type:'trip',slug:'southern-europe-road-trip',lang:'fr'});
  assert.equal(headers['Content-Language'],'fr');
  assert.match(body,/Road trip en Europe du Sud — ONE WORLD ROUTE/);
  assert.match(body,/\/fr\/trip\/southern-europe-road-trip/);
  assert.match(body,/"touristType":"Road trip"/);
});



test('flagship trip and legacy share pages redirect to explicit flagship URLs',()=>{
  const flagship=render({type:'trip',slug:'world-195',lang:'en'}).body;
  assert.match(flagship,/trip=world-195&amp;lang=en|trip%3Dworld-195/);

  const leg=render({type:'route',id:'1'}).body;
  assert.match(leg,/trip=world-195&amp;segment=1|trip%3Dworld-195/);

  const country=render({type:'country',slug:'germany'}).body;
  assert.match(country,/trip=world-195&amp;country=Deutschland|trip%3Dworld-195/);
});


test('trip share page is a real crawlable itinerary rather than an auto redirect',()=>{
  const {body}=render({type:'trip',slug:'italy-grand-tour',lang:'de'});
  assert.doesNotMatch(body,/location\.replace/);
  assert.match(body,/Reiseplan/);
  assert.match(body,/Rom|Rome/);
  assert.match(body,/Florenz|Florence/);
  assert.match(body,/Bekanntes veröffentlichtes Verkehrsminimum/);
  assert.match(body,/120,40|120\.40|120,4|120\.4/);
  assert.match(body,/Trenitalia|Italo|Trenord|official/i);
  assert.match(body,/"itemListElement"/);
});

test('legacy route and country share pages keep their direct interactive redirect',()=>{
  assert.match(render({type:'route',id:'1'}).body,/location\.replace/);
  assert.match(render({type:'country',slug:'germany'}).body,/location\.replace/);
});
