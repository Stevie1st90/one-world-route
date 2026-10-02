import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const catalog=JSON.parse(await readFile(new URL('../../data/platform/trips.json',import.meta.url),'utf8'));
const ids=String(process.env.OWR_QA_CONTENT_TRIP_IDS||'').split(',').map(value=>value.trim()).filter(Boolean);
const changed=ids.map(id=>({id,item:(catalog.trips||[]).find(trip=>trip.id===id)}));

function representativeSample(entries,limit=3){
  const selected=[];
  const seen=new Set();
  const add=entry=>{
    if(!entry||seen.has(entry.id)||selected.length>=limit)return;
    seen.add(entry.id);
    selected.push(entry);
  };
  for(const mode of ['rail','car','ferry']){
    add(entries.find(entry=>(entry.item?.discovery?.modes||[]).includes(mode)));
  }
  for(const entry of entries)add(entry);
  return selected;
}

test('@content changed journey data contracts all changed trips and browser-smokes representative renderers',async({page})=>{
  test.setTimeout(90000);
  expect(ids.length,'OWR_QA_CONTENT_TRIP_IDS must contain at least one changed trip').toBeGreaterThan(0);

  for(const entry of changed){
    expect(entry.item,'changed trip must exist in catalog: '+entry.id).toBeTruthy();
    expect(entry.item.renderer,'content browser smoke supports regional-globe trips').toBe('regional-globe');
  }

  const sample=representativeSample(changed);
  expect(sample.length).toBeGreaterThan(0);
  console.log('Content browser sample:',sample.map(entry=>entry.id).join(', '),'from',ids.length,'changed journeys');

  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));

  for(const {id,item} of sample){
    await page.goto('/?trip='+encodeURIComponent(id)+'&lang=en',{waitUntil:'domcontentloaded'});
    await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:15000});
    await expect(page.locator('body')).not.toHaveClass(/platform-booting/,{timeout:15000});
    await expect(page.locator('.platform-stop')).toHaveCount(Number(item.metrics?.stops||0),{timeout:10000});
    await expect(page.locator('#regionalRouteRange')).toHaveAttribute('max',String(item.metrics?.segments||0));
    await expect(page.locator('#detailTitle')).toHaveText(item.title.en);
    await expect(page.locator('#settingsBtn')).toBeVisible();
    await expect(page.locator('#platformRouteBtn')).toBeVisible();
    await expect(page.locator('#platformTravellerBtn')).toBeVisible();
    if((item.capabilities||[]).includes('story'))await expect(page.locator('#platformStoryBtn')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('[object');
    await expect(page.locator('body')).not.toContainText(/\bundefined\b/i);
  }

  expect(errors,'changed journey runtime page errors').toEqual([]);
});
