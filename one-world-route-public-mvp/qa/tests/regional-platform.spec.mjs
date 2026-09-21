import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const readJson=async url=>JSON.parse(await readFile(url,'utf8'));
const catalog=await readJson(new URL('../../data/platform/trips.json',import.meta.url));
const flagship=catalog.trips.find(item=>item.id===catalog.defaultTripId);
const regional=catalog.trips.filter(item=>item.renderer==='regional-globe');

const datasets=new Map();
test('flagship shell and route invariants work',async({page,isMobile},testInfo)=>{
  test.setTimeout(120000);
  const pageErrors=capturePageErrors(page);
  await openFlagship(page);

  await expect(page.locator('#routeRange')).toHaveValue('1');
  await expect(page.locator('#filterCount')).toContainText(String(flagship.metrics.internationalLegs));
  await expect(page.locator('.brand small')).toContainText('195 countries');
  await expect(page.locator('#settingsBtn')).toBeVisible();
  if(isMobile){
    await expectMobilePanelsClosed(page);
    await expect(page.locator('#infoBtn')).toBeHidden();
    await page.locator('#settingsBtn').click();
    await expect(page.locator('#settingsPopover')).toBeVisible();
    await expect(page.locator('#mobileInfoBtn')).toBeVisible();
    await page.locator('#settingsBtn').click();
    await expect(page.locator('#settingsPopover')).toBeHidden();
    await expectMobilePanelsClosed(page);
  }else{
    await expect(page.locator('#infoBtn')).toBeVisible();
  }

  const viewport=page.viewportSize();
  for(const selector of ['.topbar','.globe-stage','#timeline']){
    const box=await page.locator(selector).boundingBox();
    expect(box,selector+' missing').toBeTruthy();
    expect(box.x,selector+' left overflow').toBeGreaterThanOrEqual(-1);
    expect(box.x+box.width,selector+' right overflow').toBeLessThanOrEqual(viewport.width+1);
  }

  if(isMobile){
    await expect(page.locator('#mobileFilters')).toBeVisible();
    await page.locator('#mobileFilters').click();
    await expect(page.locator('#leftPanel')).toHaveClass(/mobile-open/);
    await page.locator('#closeFilters').click();
    await expect(page.locator('#leftPanel')).not.toHaveClass(/mobile-open/);
    await expectMobilePanelsClosed(page);
  }

  await page.locator('#platformRouteBtn').click();
  await expect(page.locator('#platformRouteModal')).toBeVisible();
  await expect(page.locator('[data-platform-trip]')).toHaveCount(catalog.trips.length);
  await captureViewport(page,testInfo,'route-library-'+testInfo.project.name+'.png');
  await page.locator('#platformRouteModal .platform-x').click();
  if(isMobile)await expectMobilePanelsClosed(page);

  await page.locator('#platformTravellerBtn').click();
  await expect(page.locator('#platformTravellerModal')).toBeVisible();
  await expect(page.locator('#platformTravellerForm [name="passportNumber"]')).toHaveCount(0);
  await captureViewport(page,testInfo,'traveller-'+testInfo.project.name+'.png');
  await page.locator('#platformTravellerModal .platform-x').click();
  if(isMobile)await expectMobilePanelsClosed(page);

  expect(pageErrors,'flagship runtime page errors').toEqual([]);
  await captureViewport(page,testInfo,'world-195-'+testInfo.project.name+'.png');
});

test('route library can switch flagship to regional and back',async({page},testInfo)=>{
  test.setTimeout(90000);
  const pageErrors=capturePageErrors(page);
  const target=regional[0];
  await openFlagship(page);

  await page.locator('#platformRouteBtn').click();
  await page.locator(`[data-platform-trip="${target.id}"]`).click();
  await expect(page).toHaveURL(new RegExp('trip='+target.id));
  await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:20000});
  await expect(page.locator('.platform-stop')).toHaveCount(target.metrics.stops);

  await page.locator('#platformRouteBtn').click();
  await page.locator(`[data-platform-trip="${flagship.id}"]`).click();
  await expect(page).not.toHaveURL(/trip=/);
  await expect(page.locator('body')).not.toHaveClass(/platform-regional-trip/,{timeout:20000});
  await expect(page.locator('#routeRange')).toHaveAttribute('max',String(flagship.metrics.internationalLegs));

  expect(pageErrors,'route-switch runtime page errors').toEqual([]);
  await captureViewport(page,testInfo,'route-switch-'+testInfo.project.name+'.png');
});

for(const item of regional){
  const rel=item.dataset.replace(/^\.\//,'');
  datasets.set(item.id,await readJson(new URL('../../'+rel,import.meta.url)));
}

async function captureViewport(page,testInfo,name){
  await page.screenshot({
    path:testInfo.outputPath(name),
    fullPage:false,
    animations:'disabled'
  });
}

function capturePageErrors(page){
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  return errors;
}

async function openRegional(page,item){
  await page.goto('/?trip='+encodeURIComponent(item.id)+'&lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:20000});
  await expect(page.locator('.platform-stop')).toHaveCount(item.metrics.stops,{timeout:10000});
}

async function openFlagship(page){
  await page.goto('/?lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).not.toHaveClass(/platform-regional-trip/,{timeout:20000});
  await expect(page.locator('#routeRange')).toHaveAttribute('max',String(flagship.metrics.internationalLegs),{timeout:20000});
  await expect(page.locator('#platformRouteBtn')).toBeVisible({timeout:10000});
  await expect(page.locator('#platformTravellerBtn')).toBeVisible({timeout:10000});
}

async function expectMobilePanelsClosed(page){
  const left=page.locator('#leftPanel');
  const right=page.locator('#rightPanel');
  await expect(left).not.toHaveClass(/mobile-open/);
  await expect(right).not.toHaveClass(/mobile-open/);
  await expect(left).toBeHidden();
  await expect(right).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>window.scrollX)).toBe(0);
}

async function expectActiveLabelsSeparated(page){
  const labels=page.locator('.platform-globe-label');
  const viewport=page.viewportSize();
  await expect.poll(async()=>{
    const boxes=await labels.evaluateAll(nodes=>nodes.map(node=>{
      const rect=node.getBoundingClientRect();
      return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom};
    }));
    if(boxes.length!==2)return false;
    const [a,b]=boxes;
    const overlapWidth=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));
    const overlapHeight=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
    return overlapWidth*overlapHeight===0&&boxes.every(box=>box.left>=-1&&box.right<=viewport.width+1);
  },{timeout:10000}).toBe(true);
}

for(const item of regional){
  test(item.id+' shell, navigation, context and story work',async({page,isMobile},testInfo)=>{
    test.setTimeout(120000);
    const pageErrors=capturePageErrors(page);
    const trip=datasets.get(item.id);
    await openRegional(page,item);

    await expect(page.locator('#regionalRouteRange')).toHaveAttribute('max',String(item.metrics.segments));
    await expect(page.locator('#detailTitle')).toHaveText(item.title.en);
    await expect(page.locator('#settingsBtn')).toBeVisible();
    await expect(page.locator('#platformRouteBtn')).toBeVisible();
    await expect(page.locator('#platformTravellerBtn')).toBeVisible();
    if(isMobile){
      await expect(page.locator('.brand small')).toBeVisible();
      await expect(page.locator('.brand small')).toHaveText(item.title.en);
    }

    const viewport=page.viewportSize();
    if(isMobile)await expectMobilePanelsClosed(page);
    for(const selector of ['.topbar','.globe-stage','#timeline']){
      const box=await page.locator(selector).boundingBox();
      expect(box,selector+' missing').toBeTruthy();
      expect(box.x,selector+' left overflow').toBeGreaterThanOrEqual(-1);
      expect(box.x+box.width,selector+' right overflow').toBeLessThanOrEqual(viewport.width+1);
    }

    const secondStop=trip.stops[1];
    const secondPlace=trip.places.find(place=>place.id===secondStop.placeId);
    if(isMobile){
      await page.locator('#mobileFilters').click();
      await expect(page.locator('#leftPanel')).toHaveClass(/mobile-open/);
    }
    await page.locator('[data-stop-index="1"]').click();
    await expect(page.locator('[data-stop-index="1"]')).toHaveClass(/active/);
    await expect(page.locator('#detailTitle')).toHaveText(secondPlace.name.en);
    await expectActiveLabelsSeparated(page);
    if(isMobile){
      await page.locator('#closeFilters').click();
      await expect(page.locator('#leftPanel')).not.toHaveClass(/mobile-open/);
      await page.locator('#mobileDetails').click();
      await expect(page.locator('#rightPanel')).toHaveClass(/mobile-open/);
      await expect(page.locator('#detailTitle')).toHaveText(secondPlace.name.en);
      await captureViewport(page,testInfo,item.id+'-detail-'+testInfo.project.name+'.png');
      await page.locator('#closeDetails').click();
      await expect(page.locator('#rightPanel')).not.toHaveClass(/mobile-open/);
    }

    const range=page.locator('#regionalRouteRange');
    await expect(range).toHaveValue('2');
    await page.locator('#regionalNextBtn').click();
    await expect(range).toHaveValue('3');
    await expect(page.locator('#detailEyebrow')).toContainText('3 / '+item.metrics.segments);
    await page.locator('#regionalPrevBtn').click();
    await expect(range).toHaveValue('2');

    await page.locator('#regionalPlayBtn').click();
    await expect.poll(async()=>Number(await range.inputValue()),{timeout:5000}).toBeGreaterThan(2);
    await page.locator('#regionalPlayBtn').click();
    const stoppedAt=await range.inputValue();
    await page.waitForTimeout(1700);
    await expect(range).toHaveValue(stoppedAt);

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
    if(item.id===regional[0].id){
      await captureViewport(page,testInfo,'regional-settings-'+testInfo.project.name+'.png');
    }

    if(item.capabilities.includes('story')){
      if(isMobile){
        await expect(page.locator('#regionalStorySettingsBtn')).toBeVisible();
        await page.locator('#regionalStorySettingsBtn').click();
      }else{
        await expect(page.locator('#regionalStorySettingsBtn')).toBeHidden();
        await page.locator('#settingsBtn').click();
        await expect(page.locator('#settingsPopover')).toBeHidden();
        await expect(page.locator('#platformStoryBtn')).toBeVisible();
        await page.locator('#platformStoryBtn').click();
      }
      await expect(page.locator('#settingsPopover')).toBeHidden();
      await expect(page.locator('body')).toHaveClass(/platform-story-mode/);
      await expect(page.locator('#platformStoryHud')).toBeVisible();
      if(item.id===regional[0].id){
        await captureViewport(page,testInfo,'regional-story-'+testInfo.project.name+'.png');
      }
      await page.evaluate(()=>window.ONE_WORLD_PLATFORM.stopStory());
      await expect(page.locator('body')).not.toHaveClass(/platform-story-mode/);
    }else{
      await page.locator('#settingsBtn').click();
      await expect(page.locator('#settingsPopover')).toBeHidden();
    }

    expect(pageErrors,item.id+' runtime page errors').toEqual([]);
    await captureViewport(page,testInfo,item.id+'-'+testInfo.project.name+'.png');
  });
}


test('regional methodology modal renders route evidence context',async({page,isMobile},testInfo)=>{
  test.setTimeout(90000);
  const pageErrors=capturePageErrors(page);
  const item=regional[0];
  await openRegional(page,item);

  if(isMobile){
    await page.locator('#settingsBtn').click();
    await expect(page.locator('#settingsPopover')).toBeVisible();
    await expect(page.locator('#mobileInfoBtn')).toBeVisible();
    await page.locator('#mobileInfoBtn').click();
  }else{
    await page.locator('#infoBtn').click();
  }

  await expect(page.locator('#infoModal')).toBeVisible();
  await expect(page.locator('#infoModal .method-grid article')).toHaveCount(4);
  await expect(page.locator('#infoModal')).toContainText(String(item.metrics.stops));
  await expect(page.locator('#infoModal')).toContainText(String(item.metrics.segments));
  await captureViewport(page,testInfo,'regional-methodology-'+testInfo.project.name+'.png');
  await page.locator('#infoModal .modal-close').click();
  await expect(page.locator('#infoModal')).toBeHidden();

  expect(pageErrors,'methodology runtime page errors').toEqual([]);
});

test('route fit filters and reset produce deterministic catalog results',async({page},testInfo)=>{
  test.setTimeout(90000);
  const pageErrors=capturePageErrors(page);
  await openFlagship(page);

  await page.locator('#platformRouteBtn').click();
  await expect(page.locator('#platformRouteModal')).toBeVisible();
  await page.locator('#platformFitToggle').click();
  await expect(page.locator('#platformFitFilters')).toBeVisible();

  await page.locator('#platformRoutePace').selectOption('balanced');
  await expect(page.locator('[data-platform-trip]')).toHaveCount(1);
  await expect(page.locator('[data-platform-trip="italy-grand-tour"]')).toBeVisible();
  await captureViewport(page,testInfo,'route-fit-'+testInfo.project.name+'.png');

  await page.locator('#platformRouteReset').click();
  await expect(page.locator('[data-platform-trip]')).toHaveCount(catalog.trips.length);
  await expect(page.locator('#platformRoutePace')).toHaveValue('');

  expect(pageErrors,'route fit runtime page errors').toEqual([]);
});

test('regional terrain activates and exits on the shared engine',async({page,isMobile},testInfo)=>{
  test.setTimeout(90000);
  const pageErrors=capturePageErrors(page);
  const item=regional.find(entry=>entry.capabilities.includes('terrain'));
  expect(item).toBeTruthy();
  await openRegional(page,item);

  await page.evaluate(()=>window.ONE_WORLD_PLATFORM.setTerrain(true));
  await expect(page.locator('body')).toHaveClass(/terrain-view/,{timeout:45000});
  await expect.poll(()=>page.evaluate(()=>Boolean(window.__ONE_WORLD_REGIONAL_TERRAIN__))).toBe(true);
  await expect(page.locator('#terrainMap')).toBeVisible();
  if(isMobile)await expectMobilePanelsClosed(page);
  await captureViewport(page,testInfo,'regional-terrain-'+testInfo.project.name+'.png');

  await page.evaluate(()=>window.ONE_WORLD_PLATFORM.setTerrain(false));
  await expect(page.locator('body')).not.toHaveClass(/terrain-view/);
  expect(pageErrors,'terrain runtime page errors').toEqual([]);
});
