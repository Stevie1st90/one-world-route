import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const catalog=JSON.parse(await readFile(new URL('../data/platform/trips.json',import.meta.url),'utf8'));
const base=String(process.env.OWR_BASE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const locales=catalog.supportedLocales||[catalog.defaultLocale||'en'];

async function fetchOk(path,label){
  const response=await fetch(base+path,{redirect:'manual'});
  assert.equal(response.status,200,`${label}: expected 200 for ${path}, got ${response.status}`);
  return response;
}

function datasetPath(dataset){
  const normalized=String(dataset||'').replace(/^\.\//,'');
  return '/'+normalized;
}

const home=await fetchOk('/','home');
const homeHtml=await home.text();
assert.match(homeHtml,/ONE WORLD ROUTE/);
assert.match(homeHtml,/features\.bundle\.js/);

const bundle=await fetchOk('/features.bundle.js','feature bundle');
const bundleText=await bundle.text();
for(const marker of [
  'platform/home.js',
  'platform/regional-shell.js',
  'platform/regional-detail.js',
  'platform/regional-globe.js',
  'platform/regional-timeline.js',
  'platform/regional-controls.js',
  'platform/regional-selection.js',
  'platform/extensions/cruise.js',
  'platform/extensions/road.js',
  'platform/extensions/border.js'
]){
  assert.ok(bundleText.includes(marker),`feature bundle missing ${marker}`);
}

const servedCatalog=await fetchOk('/data/platform/trips.json','trip catalog');
const servedCatalogJson=await servedCatalog.json();
assert.deepEqual(
  servedCatalogJson.trips.map(trip=>trip.id),
  catalog.trips.map(trip=>trip.id),
  'served catalog differs from repository catalog'
);

let sharePages=0;
let interactivePages=0;
for(const trip of catalog.trips){
  await fetchOk(datasetPath(trip.dataset),`dataset ${trip.id}`);

  for(const locale of locales){
    const share=await fetchOk(`/${locale}/trip/${encodeURIComponent(trip.slug)}`,`share ${trip.id} ${locale}`);
    assert.equal(share.headers.get('content-language'),locale,`wrong Content-Language for ${trip.id} ${locale}`);
    const html=await share.text();
    const expectedTitle=trip.title?.[locale]||trip.title?.[catalog.defaultLocale]||trip.title?.en||trip.id;
    assert.ok(html.includes(expectedTitle),`share page missing localized title for ${trip.id} ${locale}`);
    assert.ok(html.includes(`/${locale}/trip/${trip.slug}`),`share page missing localized path for ${trip.id} ${locale}`);
    assert.match(html,/"@type":"TouristTrip"/,`share page missing TouristTrip schema for ${trip.id} ${locale}`);
    sharePages++;

    const interactive=await fetchOk(`/?trip=${encodeURIComponent(trip.id)}&lang=${locale}`,`interactive ${trip.id} ${locale}`);
    const interactiveHtml=await interactive.text();
    assert.match(interactiveHtml,/features\.bundle\.js/,`interactive shell missing feature bundle for ${trip.id} ${locale}`);
    interactivePages++;
  }
}

console.log(`Preview route smoke passed: ${catalog.trips.length} trips, ${sharePages} localized share pages, ${interactivePages} interactive entry URLs.`);
