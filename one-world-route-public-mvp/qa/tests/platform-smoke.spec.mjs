import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const readJson=async url=>JSON.parse(await readFile(url,'utf8'));
const catalog=await readJson(new URL('../../data/platform/trips.json',import.meta.url));
const flagship=catalog.trips.find(item=>item.id===catalog.defaultTripId);
const regional=catalog.trips.find(item=>item.renderer==='regional-globe');

test('@flagship flagship shell boots cleanly',async({page,isMobile})=>{
  test.setTimeout(30000);
  const errors=capturePageErrors(page);
  await page.goto('/?trip='+encodeURIComponent(flagship.id)+'&lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).not.toHaveClass(/platform-regional-trip/,{timeout:15000});
  await expect(page.locator('#routeRange')).toHaveAttribute('max',String(flagship.metrics.internationalLegs),{timeout:15000});
  await expect(page.locator('#filterCount')).toContainText(String(flagship.metrics.internationalLegs));
  await expect(page.locator('#settingsBtn')).toBeVisible();
  await expect(page.locator('#platformRouteBtn')).toBeVisible();
  if(isMobile){
    await expect.poll(()=>page.evaluate(()=>window.scrollX)).toBe(0);
    await expect.poll(()=>page.evaluate(()=>document.querySelector('#app')?.scrollLeft||0)).toBe(0);
  }
  expect(errors,'flagship runtime page errors').toEqual([]);
});

test('@flagship operations exposes departure recheck controls',async({page})=>{
  test.setTimeout(30000);
  const errors=capturePageErrors(page);
  await page.goto('/?segment=13&mode=operations&lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#detailContent')).toContainText('Departure recheck',{timeout:15000});
  await expect(page.locator('#detailContent')).toContainText('Next recheck');
  await expect(page.locator('#detailContent')).toContainText('Manual review');
  await expect(page.locator('#detailContent')).toContainText('HOLD');
  await expect(page.locator('#detailContent')).toContainText('Scheduled + condition watch');
  expect(errors,'flagship recheck runtime page errors').toEqual([]);
});

test('@regional representative regional shell boots cleanly',async({page,isMobile})=>{
  test.setTimeout(30000);
  expect(regional).toBeTruthy();
  const errors=capturePageErrors(page);
  await page.goto('/?trip='+encodeURIComponent(regional.id)+'&lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:15000});
  await expect(page.locator('.platform-stop')).toHaveCount(regional.metrics.stops,{timeout:10000});
  await expect(page.locator('#regionalRouteRange')).toHaveAttribute('max',String(regional.metrics.segments));
  await expect(page.locator('#detailTitle')).toHaveText(regional.title.en);
  await expect(page.locator('#settingsBtn')).toBeVisible();
  await expect(page.locator('#platformRouteBtn')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('[object');
  await expect(page.locator('body')).not.toContainText(/\bundefined\b/i);
  if(isMobile){
    await expect.poll(()=>page.evaluate(()=>window.scrollX)).toBe(0);
    await expect.poll(()=>page.evaluate(()=>document.querySelector('#app')?.scrollLeft||0)).toBe(0);
  }
  expect(errors,'regional runtime page errors').toEqual([]);
});

function capturePageErrors(page){
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  return errors;
}
