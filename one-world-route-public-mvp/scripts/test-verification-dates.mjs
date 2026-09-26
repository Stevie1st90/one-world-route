import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {excelSerialToIso,verificationDate} from './verification-date-model.mjs';

test('Excel serial verification dates normalize deterministically',()=>{
  assert.equal(excelSerialToIso(46282),'2026-09-17');
  assert.equal(verificationDate(46282),'2026-09-17');
  assert.equal(verificationDate('2026-09-20'),'2026-09-20');
  assert.equal(verificationDate(null),null);
});

test('committed route verification dates are ISO dates or null',async()=>{
  const route=JSON.parse(await readFile(new URL('../data/public-route.json',import.meta.url),'utf8'));
  for(const segment of route.segments){
    assert.ok(segment.lastVerified===null||/^\d{4}-\d{2}-\d{2}$/.test(segment.lastVerified),'segment '+segment.id);
  }
  if(route.postTripReturn)assert.ok(route.postTripReturn.lastVerified===null||/^\d{4}-\d{2}-\d{2}$/.test(route.postTripReturn.lastVerified));
});
