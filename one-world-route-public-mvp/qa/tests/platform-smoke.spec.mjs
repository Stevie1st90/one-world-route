import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const readJson=async url=>JSON.parse(await readFile(url,'utf8'));
const catalog=await readJson(new URL('../../data/platform/trips.json',import.meta.url));
const flagship=catalog.trips.find(item=>item.id===catalog.defaultTripId);
const regional=catalog.trips.find(item=>item.renderer==='regional-globe');
const discoveryPreview=catalog.trips.find(item=>item.id==='japan-by-rail');
const discoveryPreviewData=await readJson(new URL('../../data/platform/trips/japan-by-rail.json',import.meta.url));

test('@flagship flagship shell boots cleanly',async({page,isMobile})=>{
  test.setTimeout(60000);
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
  await expect(page.locator('#detailContent')).toContainText('Recheck status');
  await expect(page.locator('#detailContent')).toContainText('Next recheck');
  await expect(page.locator('#detailContent')).toContainText('Manual review');
  await expect(page.locator('#detailContent')).toContainText('HOLD');
  await expect(page.locator('#detailContent')).toContainText('Scheduled + condition watch');
  await page.goto('/?segment=106&mode=operations&lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#detailContent')).toContainText('Operational movement recheck',{timeout:15000});
  await expect(page.locator('#detailContent')).toContainText('Türkmenabat → Serhetabat');
  await expect(page.locator('#detailContent')).toContainText('Recheck status');
  await expect(page.locator('#detailContent')).toContainText('Manual review');
  await expect(page.locator('#detailContent')).toContainText('HOLD');
  expect(errors,'flagship recheck runtime page errors').toEqual([]);
});


test('@regional global discovery home exposes a broad visual journey catalog',async({page,isMobile},testInfo)=>{
  test.setTimeout(90000);
  const errors=capturePageErrors(page);
  await page.goto('/?lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-home/,{timeout:15000});
  await expect(page.locator('#platformHomeFeatured .platform-home-card')).toHaveCount(6,{timeout:15000});
  await expect(page.locator('#platformHomeResults .platform-home-card')).toHaveCount(catalog.trips.length,{timeout:15000});
  await expect(page.locator('.platform-home-card-visual').first()).toBeVisible();
  await expect(page.locator('.platform-home-quick button')).toHaveCount(5);
  await expect(page.locator('.platform-home-region-card')).toHaveCount(6);
  await expect(page.locator('.platform-home-collection')).toHaveCount(6);
  await expect(page.locator('#platformHome')).toContainText('Japan by Rail');
  await expect(page.locator('#platformHome')).toContainText('Patagonia Road Trip');
  if(isMobile)await expect.poll(()=>page.evaluate(()=>window.scrollX)).toBe(0);
  await page.screenshot({path:testInfo.outputPath('discovery-home.png'),fullPage:false});
  await expect(page.locator('.platform-home-collection').first()).toBeAttached();
  await expect(page.locator('.platform-home-region-card').first()).toBeAttached();
  if(!isMobile){
    await page.locator('.platform-home-collections').screenshot({path:testInfo.outputPath('discovery-collections.png'),animations:'disabled'});
    await page.locator('.platform-home-regions').screenshot({path:testInfo.outputPath('discovery-regions.png'),animations:'disabled'});
  }
  expect(errors,'global discovery home page errors').toEqual([]);
});

test('@regional traveller start region changes transparent journey recommendations',async({page})=>{
  test.setTimeout(60000);
  await page.addInitScript(()=>{
    localStorage.setItem('one-world-route:traveller-context:v1',JSON.stringify({
      language:'en',
      currency:'EUR',
      origin:'Frankfurt / FRA',
      originRegion:'south-america',
      party:{adults:2,children:0},
      accessibility:{reducedMobility:false}
    }));
  });
  const errors=capturePageErrors(page);
  await page.goto('/?lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-home/,{timeout:15000});
  await expect(page.locator('.platform-home-featured h2')).toHaveText('Recommended for you');
  await expect(page.locator('#platformHomeFeatured .platform-home-card').first().locator('h3')).toHaveText('Patagonia Road Trip');
  expect(errors,'personalized discovery runtime page errors').toEqual([]);
});

test('@regional traveller origin country derives recommendation region without manual region selection',async({page,isMobile},testInfo)=>{
  test.setTimeout(90000);
  const errors=capturePageErrors(page);
  await page.goto('/?lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-home/,{timeout:15000});
  if(isMobile)await page.evaluate(()=>window.ONE_WORLD_PLATFORM?.openTraveller?.());
  else await page.locator('[data-home-traveller]').click();
  await expect(page.locator('#platformTravellerForm')).toBeVisible();
  await expect(page.locator('#platformTravellerForm select[name="originRegion"]')).toHaveCount(0);
  await page.locator('#platformTravellerForm input[name="origin"]').fill('São Paulo / GRU');
  await page.locator('#platformTravellerForm select[name="originCountry"]').selectOption('BR');
  await page.locator('#platformTravellerForm input[name="adults"]').fill('2');
  await page.screenshot({path:testInfo.outputPath('traveller-origin.png'),fullPage:false});
  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    page.locator('#platformTravellerForm').locator('button[type="submit"]').click()
  ]);
  await expect(page.locator('body')).toHaveClass(/platform-home/,{timeout:15000});
  const context=await page.evaluate(()=>JSON.parse(localStorage.getItem('one-world-route:traveller-context:v1')||'{}'));
  expect(context.originCountry).toBe('BR');
  expect(context.originRegion).toBe('south-america');
  await expect(page.locator('#platformHomeFeatured .platform-home-card').first().locator('h3')).toHaveText('Patagonia Road Trip');
  await expect(page.locator('#platformHomeFeatured .platform-home-card').first().locator('.platform-home-card-fit')).toContainText('South America');
  expect(errors,'origin-country derived recommendation runtime page errors').toEqual([]);
});

test('@regional editorial preview journey uses the generic visual detail shell',async({page,isMobile},testInfo)=>{
  test.setTimeout(120000);
  expect(discoveryPreview).toBeTruthy();
  const errors=capturePageErrors(page);
  await page.goto('/?trip='+encodeURIComponent(discoveryPreview.id)+'&lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:15000});
  await expect(page.locator('.platform-journey-hero-art')).toHaveCount(1);
  if(!isMobile)await expect(page.locator('.platform-journey-hero-art')).toBeVisible();
  await expect(page.locator('#detailTitle')).toHaveText(discoveryPreview.title.en);
  await expect(page.locator('.platform-stop')).toHaveCount(discoveryPreview.metrics.stops);
  await expect(page.locator('.platform-journey-flow-stop')).toHaveCount(discoveryPreview.metrics.stops);
  await expect(page.locator('.platform-route-fit-panel')).toHaveCount(1);
  await expect(page.locator('.platform-journey-guide')).toHaveCount(1);
  await expect(page.locator('.platform-journey-guide')).toContainText('Journey guide');
  await expect(page.locator('.platform-journey-guide')).toContainText('Kanazawa');
  await expect(page.locator('.platform-editorial-status')).toContainText(/Editorial preview/i);
  if(isMobile){
    await page.locator('#mobileDetails').click();
    await expect(page.locator('#rightPanel')).toHaveClass(/mobile-open/);
  }
  await expect(page.locator('.platform-journey-personalize')).toBeVisible();
  await page.locator('.platform-journey-guide').screenshot({path:testInfo.outputPath('journey-guide.png'),animations:'disabled'});
  await expect(page.locator('.platform-route-access')).toContainText('Tokyo');
  await expect(page.locator('[data-trip-route-start]')).toHaveCount(1);
  await expect(page.locator('.platform-shared-guidance')).toHaveCount(1);
  await expect.poll(()=>page.evaluate(()=>window.__ONE_WORLD_ROUTE_GLOBE__?.pointOfView?.()?.lng??null),{timeout:10000}).toBeGreaterThan(120);
  await expect.poll(()=>page.evaluate(()=>window.__ONE_WORLD_ROUTE_GLOBE__?.pointOfView?.()?.lng??null),{timeout:10000}).toBeLessThan(150);
  await expect(page.locator('body')).not.toContainText(/undefined/i);
  await page.screenshot({path:testInfo.outputPath('editorial-journey.png'),fullPage:true});
  if(isMobile&&await page.locator('#rightPanel').evaluate(node=>node.classList.contains('mobile-open')))await page.locator('#closeDetails').click();
  await page.locator('#platformRouteBtn').click();
  await expect(page.locator('#platformRouteModal:not(.hidden) .platform-route-card-visual')).toHaveCount(catalog.trips.length);
  await expect(page.locator('#platformRouteModal .platform-route-card').first().locator('h3')).toHaveText(discoveryPreview.title.en);
  if(isMobile){
    await expect(page.locator('#platformPrimaryFilterToggle')).toBeVisible();
    await expect(page.locator('#platformRouteKind')).not.toBeVisible();
  }
  if(isMobile){
    const filterToggle=page.locator('#platformPrimaryFilterToggle');
    await filterToggle.scrollIntoViewIfNeeded();
    await filterToggle.click();
    await expect(page.locator('#platformRouteKind')).toBeVisible();
    await filterToggle.click();
    await expect(page.locator('#platformRouteKind')).not.toBeVisible();
  }
  await page.screenshot({path:testInfo.outputPath('route-library.png'),fullPage:false});
  await page.locator('#platformRouteModal .platform-x').click();
  if(isMobile){
    await page.locator('#mobileDetails').click();
    await expect(page.locator('#rightPanel')).toHaveClass(/mobile-open/);
  }
  const lastStop=discoveryPreviewData.stops.at(-1);
  await page.locator('[data-trip-route-start]').selectOption(lastStop.id);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.platform-journey-flow-stop').first()).toContainText('Hiroshima',{timeout:15000});
  await expect(page.locator('#regionalRangeLabels span').first()).toContainText('Hiroshima');
  await expect(page.locator('[data-trip-route-start]')).toHaveValue(lastStop.id);
  if(!isMobile){
    await page.locator('[data-journey-stop-index="1"]').evaluate(node=>node.click());
    await expect(page.locator('#detailTitle')).toHaveText('Osaka');
    await expect(page.locator('.platform-stop-visual')).toBeVisible();
  }
  expect(errors,'editorial preview runtime page errors').toEqual([]);
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
