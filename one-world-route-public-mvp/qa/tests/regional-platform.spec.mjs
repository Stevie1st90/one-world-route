import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const readJson=async url=>JSON.parse(await readFile(url,'utf8'));
const catalog=await readJson(new URL('../../data/platform/trips.json',import.meta.url));
const regional=catalog.trips.filter(item=>item.renderer==='regional-globe');

const datasets=new Map();
for(const item of regional){
  const rel=item.dataset.replace(/^\.\//,'');
  datasets.set(item.id,await readJson(new URL('../../'+rel,import.meta.url)));
}

async function openRegional(page,item){
  await page.goto('/?trip='+encodeURIComponent(item.id)+'&lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:20000});
  await expect(page.locator('.platform-stop')).toHaveCount(item.metrics.stops,{timeout:10000});
}

for(const item of regional){
  test(item.id+' shell, navigation, context and story work',async({page},testInfo)=>{
    const trip=datasets.get(item.id);
    await openRegional(page,item);

    await expect(page.locator('#regionalRouteRange')).toHaveAttribute('max',String(item.metrics.segments));
    await expect(page.locator('#detailTitle')).toHaveText(item.title.en);
    await expect(page.locator('#settingsBtn')).toBeVisible();
    await expect(page.locator('#platformRouteBtn')).toBeVisible();
    await expect(page.locator('#platformTravellerBtn')).toBeVisible();

    const viewport=page.viewportSize();
    for(const selector of ['.topbar','.globe-stage','#timeline']){
      const box=await page.locator(selector).boundingBox();
      expect(box,selector+' missing').toBeTruthy();
      expect(box.x,selector+' left overflow').toBeGreaterThanOrEqual(-1);
      expect(box.x+box.width,selector+' right overflow').toBeLessThanOrEqual(viewport.width+1);
    }

    const secondStop=trip.stops[1];
    const secondPlace=trip.places.find(place=>place.id===secondStop.placeId);
    await page.locator('[data-stop-index="1"]').click();
    await expect(page.locator('[data-stop-index="1"]')).toHaveClass(/active/);
    await expect(page.locator('#detailTitle')).toHaveText(secondPlace.name.en);

    await page.locator('#platformTravellerBtn').click();
    await expect(page.locator('#platformTravellerModal')).toBeVisible();
    await expect(page.locator('#platformTravellerForm [name="passport"]')).toBeVisible();
    await expect(page.locator('#platformTravellerForm [name="vehicleType"]')).toBeVisible();
    await expect(page.locator('#platformTravellerForm [name="passportNumber"]')).toHaveCount(0);
    await page.locator('#platformTravellerModal .platform-x').click();
    await expect(page.locator('#platformTravellerModal')).toBeHidden();

    await page.locator('#platformRouteBtn').click();
    await expect(page.locator('#platformRouteModal')).toBeVisible();
    await expect(page.locator('[data-platform-trip]')).toHaveCount(catalog.trips.length);
    await expect(page.locator('#platformFitToggle')).toBeVisible();
    await page.locator('#platformRouteModal .platform-x').click();
    await expect(page.locator('#platformRouteModal')).toBeHidden();

    await page.locator('#settingsBtn').click();
    await expect(page.locator('#settingsPopover')).toBeVisible();
    if(item.capabilities.includes('terrain'))await expect(page.locator('#terrainView')).toBeVisible();
    await page.locator('#settingsBtn').click();
    await expect(page.locator('#settingsPopover')).toBeHidden();

    if(item.capabilities.includes('story')){
      await page.evaluate(()=>window.ONE_WORLD_PLATFORM.startStory());
      await expect(page.locator('body')).toHaveClass(/platform-story-mode/);
      await expect(page.locator('#platformStoryHud')).toBeVisible();
      await page.evaluate(()=>window.ONE_WORLD_PLATFORM.stopStory());
      await expect(page.locator('body')).not.toHaveClass(/platform-story-mode/);
    }

    await page.screenshot({path:testInfo.outputPath(item.id+'-'+testInfo.project.name+'.png'),fullPage:true});
  });
}

test('regional terrain activates and exits on the shared engine',async({page,isMobile},testInfo)=>{
  test.skip(isMobile);
  test.setTimeout(90000);
  const item=regional.find(entry=>entry.capabilities.includes('terrain'));
  expect(item).toBeTruthy();
  await openRegional(page,item);

  await page.evaluate(()=>window.ONE_WORLD_PLATFORM.setTerrain(true));
  await expect(page.locator('body')).toHaveClass(/terrain-view/,{timeout:45000});
  await expect.poll(()=>page.evaluate(()=>Boolean(window.__ONE_WORLD_REGIONAL_TERRAIN__))).toBe(true);
  await expect(page.locator('#terrainMap')).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('regional-terrain-'+testInfo.project.name+'.png'),fullPage:true});

  await page.evaluate(()=>window.ONE_WORLD_PLATFORM.setTerrain(false));
  await expect(page.locator('body')).not.toHaveClass(/terrain-view/);
});
