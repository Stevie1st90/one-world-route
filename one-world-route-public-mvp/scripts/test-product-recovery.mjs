import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const catalog=require('../data/platform/trips.json');
const {messages,supportedLocales}=require('../platform/i18n.js');
const Discovery=require('../platform/discovery.js');
test('Every catalog facet has a translated label in all six supported languages',()=>{
  for(const value of new Set(Object.values(Discovery.facets(catalog)).flat()))for(const lang of supportedLocales)assert.ok(messages[lang]['facet_'+value.replaceAll('-','_')],`${lang}: ${value}`);
});
test('Discovery searches all localized place and card values with accent normalization',()=>{
  const text={title:{en:'Japan by rail',de:'Japan mit der Bahn'},places:[{en:'Tokyo',de:'Tokio'},{en:'Kyoto',de:'Kyoto'}]};
  for(const q of ['Tokyo Japan','Tokio Japan','Kyōto'])assert.equal(Discovery.matches({}, {q},text),true);
  assert.equal(Discovery.matches({},{q:'Tokyo Namibia'},text),false);
});
test('Missing static journeys respond with localized 404, noindex and a discover return link',()=>{
 const handler=require('../api/share.js');
 for(const lang of supportedLocales){let output='',headers={};const res={setHeader:(k,v)=>headers[k]=v,end:v=>output=v};handler({query:{type:'trip',slug:'missing-journey',lang}},res);assert.equal(res.statusCode,404);assert.equal(headers['Content-Language'],lang);assert.match(output,new RegExp('<html lang="'+lang+'"'));assert.match(output,/name="robots" content="noindex"/);assert.match(output,new RegExp('/\\?lang='+lang));assert.doesNotMatch(output,/location.replace/);}
});
test('Every literal UI message key used by shared platform modules is translated',async()=>{
 const {readdir}=await import('node:fs/promises');
 for(const name of await readdir(new URL('../platform/',import.meta.url))){if(!name.endsWith('.js')||name==='i18n.js')continue;const source=await readFile(new URL('../platform/'+name,import.meta.url),'utf8');for(const match of source.matchAll(/\bt\(['"]([^'"]+)['"]\)/g))for(const lang of supportedLocales)assert.ok(messages[lang][match[1]],`${name}: ${lang}.${match[1]}`);}
});
