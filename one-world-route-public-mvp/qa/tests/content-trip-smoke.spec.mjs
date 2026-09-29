import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const catalog=JSON.parse(await readFile(new URL('../../data/platform/trips.json',import.meta.url),'utf8'));
const ids=String(process.env.OWR_QA_CONTENT_TRIP_IDS||'').split(',').map(value=>value.trim()).filter(Boolean);

test('@content changed journey data boots cleanly',async({page,isMobile})=>{
  test.setTimeout(60000);
  expect(ids.length,'OWR_QA_CONTENT_TRIP_IDS must contain at least one changed trip').toBeGreaterThan(0);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  for(const id of ids){
    const item=(catalog.trips||[]).find(trip=>trip.id===id);
    expect(item,'changed trip must exist in catalog: '+id).toBeTruthy();
    expect(item.renderer,'content browser smoke supports regional-globe trips').toBe('regional-globe');
    await page.goto('/?trip='+encodeURIComponent(id)+'&lang=en',{waitUntil:'domcontentloaded'});
    await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:15000});
    await expect(page.locator('.platform-stop')).toHaveCount(Number(item.metrics?.stops||0),{timeout:10000});
    await expect(page.locator('#regionalRouteRange')).toHaveAttribute('max',String(item.metrics?.segments||0));
    await expect(page.locator('#detailTitle')).toHaveText(item.title.en);
    await expect(page.locator('#settingsBtn')).toBeVisible();
    await expect(page.locator('#platformRouteBtn')).toBeVisible();
    await expect(page.locator('#platformTravellerBtn')).toBeVisible();
    if((item.capabilities||[]).includes('story'))await expect(page.locator('#platformStoryBtn')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('[object');
    await expect(page.locator('body')).not.toContainText(/\bundefined\b/i);
    if(isMobile){
      await expect.poll(()=>page.evaluate(()=>window.scrollX)).toBe(0);
      await expect.poll(()=>page.evaluate(()=>document.querySelector('#app')?.scrollLeft||0)).toBe(0);
    }
  }
  expect(errors,'changed journey runtime page errors').toEqual([]);
});
