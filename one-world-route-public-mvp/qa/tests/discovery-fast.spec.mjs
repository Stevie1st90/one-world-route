import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const readJson=async url=>JSON.parse(await readFile(url,'utf8'));
const catalog=await readJson(new URL('../../data/platform/trips.json',import.meta.url));
const collections=await readJson(new URL('../../data/platform/collections.json',import.meta.url));

const representative=catalog.trips.find(item=>
  item.id!==catalog.defaultTripId
  &&item.renderer==='regional-globe'
  &&item.discovery?.regions?.length
  &&item.kind
  &&item.discovery?.durationBand
);

test('@discovery-fast discovery catalog, finder and representative journey render through shared UI',async({page,isMobile})=>{
  test.setTimeout(60000);
  expect(representative,'catalog needs one representative regional journey').toBeTruthy();

  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));

  await page.goto('/?lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-home/,{timeout:15000});
  await expect(page.locator('body')).not.toHaveClass(/platform-booting/,{timeout:15000});
  await expect(page.locator('#platformHomeFeatured .platform-home-card')).toHaveCount(6);
  await expect(page.locator('.platform-home-region-card')).toHaveCount(6);
  await expect(page.locator('.platform-home-collection')).toHaveCount(collections.collections.length);

  const results=page.locator('#platformHomeResults .platform-home-card');
  const initialCount=Math.min(24,catalog.trips.length);
  await expect(results).toHaveCount(initialCount);
  // All catalog identities are validated at contract level. Browser work stays bounded.
  const renderedIds=await results.evaluateAll(nodes=>nodes.map(node=>node.dataset.homeTrip));
  expect(new Set(renderedIds).size).toBe(initialCount);
  expect(renderedIds.every(id=>catalog.trips.some(trip=>trip.id===id))).toBe(true);
  if(catalog.trips.length>initialCount)await expect(page.locator('#platformHomeMore')).toBeVisible();

  const firstVisual=results.first().locator('.platform-route-image');
  await expect(firstVisual).toBeVisible();
  await expect(firstVisual).toHaveAttribute('src',/.+/);

  const region=representative.discovery.regions[0];
  await page.locator('#homeFinderRegion').selectOption(region);
  await page.locator('#homeFinderKind').selectOption(representative.kind);
  await page.locator('#homeFinderDuration').selectOption(representative.discovery.durationBand);
  await page.locator('[data-home-finder-apply]').click();

  const expectedFiltered=catalog.trips.filter(item=>
    item.id!==catalog.defaultTripId
    &&(item.discovery?.regions||[]).includes(region)
    &&item.kind===representative.kind
    &&item.discovery?.durationBand===representative.discovery.durationBand
  );
  await expect(results).toHaveCount(Math.min(24,expectedFiltered.length));
  const filteredIds=await results.evaluateAll(nodes=>nodes.map(node=>node.dataset.homeTrip));
  expect(new Set(filteredIds).size).toBe(filteredIds.length);
  expect(filteredIds.every(id=>expectedFiltered.some(item=>item.id===id))).toBe(true);
  const selected=catalog.trips.find(item=>item.id===filteredIds[0]);
  const target=page.locator('#platformHomeResults .platform-home-card[data-home-trip="'+selected.id+'"]');
  await target.locator('[data-open-home-trip]').click();
  await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:20000});
  await expect(page.locator('body')).not.toHaveClass(/platform-booting/,{timeout:15000});
  await expect(page.locator('#detailTitle')).toHaveText(selected.title.en);
  await expect(page.locator('#regionalRouteRange')).toHaveAttribute('max',String(selected.metrics?.segments||0));
  if(isMobile){
    await expect(page.locator('#platformTravellerBtn')).toBeVisible();
  }else{
    await expect(page.locator('#settingsBtn')).toBeVisible();
  }
  await expect(page.locator('#platformRouteBtn')).toBeVisible();

  if(isMobile){
    await expect.poll(()=>page.evaluate(()=>window.scrollX)).toBe(0);
    await expect.poll(()=>page.evaluate(()=>document.querySelector('#app')?.scrollLeft||0)).toBe(0);
  }
  expect(errors,'discovery fast smoke page errors').toEqual([]);
});
