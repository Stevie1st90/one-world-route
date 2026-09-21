import {test,expect} from '@playwright/test';
async function open(page,url){
  await page.goto(url);
  await expect(page.locator('#detailTitle')).not.toHaveText('The route at a glance');
}

test('search selects a country or route result',async({page})=>{
  await open(page,'/');await page.locator('#searchBtn').click();await page.locator('#commandInput').fill('Germany');
  const hit=page.locator('#commandResults .command-item').first();await expect(hit).toBeVisible();await hit.click();
  await expect(page.locator('#detailTitle')).toContainText(/Germany/);
});

test('All route restores 194 globe legs',async({page})=>{
  await open(page,'/?segment=31&phase=2');await page.locator('#phaseRail button[data-phase="all"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__ONE_WORLD_ROUTE_GLOBE__?.arcsData?.()?.length||0)).toBe(194);
});

test('Story survives manual drag',async({page})=>{
  await open(page,'/?segment=7&phase=1');await page.locator('#playBtn').click();await expect(page.locator('body')).toHaveClass(/story-mode/);
  const box=await page.locator('#globe').boundingBox();if(!box)throw new Error('Missing globe');
  await page.mouse.move(box.x+box.width*.52,box.y+box.height*.52);await page.mouse.down();await page.mouse.move(box.x+box.width*.69,box.y+box.height*.57,{steps:8});await page.mouse.up();
  await expect.poll(()=>page.evaluate(()=>{const r=document.querySelector('#globe canvas')?.getBoundingClientRect();return !!r&&r.width>100&&r.height>100})).toBe(true);
});

test('Terrain chapter navigation moves camera',async({page})=>{
  test.setTimeout(90000);
  await open(page,'/?segment=5&phase=1');await page.locator('#settingsBtn').click();await page.locator('#terrainView').check();
  await expect(page.locator('body')).toHaveClass(/terrain-view/,{timeout:30000});
  const before=await page.evaluate(()=>window.__ONE_WORLD_TERRAIN__?.getCenter?.().toArray?.());
  await page.locator('#phaseRail button[data-phase="3"]').click();await page.waitForTimeout(1500);
  const after=await page.evaluate(()=>window.__ONE_WORLD_TERRAIN__?.getCenter?.().toArray?.());
  expect(before&&after&&Math.hypot(before[0]-after[0],before[1]-after[1])).toBeGreaterThan(5);
});

test('mobile details remain in viewport',async({page,isMobile})=>{
  test.skip(!isMobile);await open(page,'/?country=Israel');await page.locator('#mobileDetails').click();
  await expect(page.locator('#rightPanel')).toHaveClass(/mobile-open/);
  await expect.poll(async()=>{const b=await page.locator('#rightPanel').boundingBox();return !!b&&b.x>=0&&b.x+b.width<=page.viewportSize().width+1}).toBe(true);
});

test('PWA and public datasets are reachable',async({page,request})=>{
  await open(page,'/');await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href',/manifest/);
  expect((await request.get('/manifest.webmanifest')).ok()).toBeTruthy();
  expect((await request.get('/data/public-route.json')).ok()).toBeTruthy();
});
test('operational transfers preserve macro counts and expose unknowns',async({page,request,isMobile},testInfo)=>{
  const route=await (await request.get('/data/public-route.json')).json();
  expect(route.segments).toHaveLength(194);expect(route.countries).toHaveLength(195);
  await open(page,'/?segment=22');
  if(isMobile)await page.locator('#mobileFilters').click();
  await page.locator('.mode-switch button[data-mode="operations"]').click();
  await expect(page.locator('[data-movement-id="transfer-21-22"]')).toBeAttached();
  await expect(page.locator('[data-movement-id="transfer-22-23"]')).toBeAttached();
  await expect(page.locator('#selectedOpsIntel')).toContainText('Operational timeline');
  if(isMobile){await page.locator('#closeFilters').click();await page.locator('#mobileDetails').click();}
  await page.locator('[data-movement-id="transfer-21-22"]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-movement-id="transfer-21-22"]')).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('operations-review.png')});
});

test('multi-stop flight geometry uses airport coordinates',async({request})=>{
  const data=await (await request.get('/data/flight-geometries.json')).json();
  expect(data.geometries['69'].airportCodes).toEqual(['APW','NAN','FUN']);
  expect(data.geometries['27']).toBeUndefined();
});

test('Story transfer keeps country count and exits cleanly',async({page},testInfo)=>{
  await open(page,'/?segment=21');
  await page.locator('.speed-control button').first().click();
  await page.locator('#playBtn').click();
  await expect(page.locator('body')).toHaveClass(/story-mode/);
  await expect(page.locator('#storyMovement')).toBeVisible({timeout:20000});
  const before=await page.locator('#storyCountryValue').innerText();
  await expect(page.locator('#storyMovement')).toContainText('country count unchanged');
  const hud=await page.locator('#storyHud').boundingBox();
  expect(hud.y).toBeGreaterThanOrEqual(0);expect(hud.y+hud.height).toBeLessThanOrEqual(page.viewportSize().height);
  expect(await page.locator('#routeRange').inputValue()).toBe('21');
  expect(await page.locator('#storyCountryValue').innerText()).toBe(before);
  await page.screenshot({path:testInfo.outputPath('story-review.png')});
  await page.locator('#storyExit').click();
  await expect(page.locator('body')).not.toHaveClass(/story-mode/);
  await expect(page.locator('#storyMovement')).toHaveCount(0);
});

test('regional Italy route does not inherit world labels or 194-leg context',async({page})=>{
  await open(page,'/?trip=italy-grand-tour&lang=de');
  await expect(page.locator('body')).toHaveClass(/platform-regional-trip/);
  await expect(page.locator('#regionalTimelineTitle')).toContainText('Rom');
  await expect(page.locator('#timelineTitle')).toHaveCount(0);
  await expect(page.locator('#routeRange')).toHaveCount(0);
  await expect(page.locator('#detailContent .journey-context')).toHaveCount(0);
  await expect(page.locator('.platform-globe-label')).toHaveCount(2);
  await expect(page.locator('.platform-globe-label')).not.toContainText('Luxembourg');
  await expect(page).toHaveURL(/trip=italy-grand-tour/);
});

test('regional road trip ignores legacy country polygon selection',async({page})=>{
  await open(page,'/?trip=southern-europe-road-trip&lang=de');
  const before=page.url();
  await page.evaluate(()=>{
    const globe=window.__ONE_WORLD_ROUTE_GLOBE__;
    const handler=globe?.onPolygonClick?.();
    if(typeof handler==='function')handler({id:'AUT',properties:{name:'Austria'}});
  });
  await page.waitForTimeout(100);
  await expect(page).toHaveURL(/trip=southern-europe-road-trip/);
  expect(page.url()).not.toContain('country=');
  await expect(page.locator('#detailEyebrow')).not.toContainText('COUNTRY');
  expect(before).toContain('southern-europe-road-trip');
});

test('regional route library opens another trip and keeps locale',async({page})=>{
  await open(page,'/?trip=italy-grand-tour&lang=de');
  await page.locator('#platformRouteBtn').click();
  const road=page.locator('[data-platform-trip="southern-europe-road-trip"]');
  await expect(road).toBeVisible();
  await road.click();
  await expect(page).toHaveURL(/trip=southern-europe-road-trip/);
  await expect(page).toHaveURL(/lang=de/);
  await expect(page.locator('.hero-copy h1')).toContainText('Südeuropa-Roadtrip');
});

test('regional mobile header exposes routes and traveller',async({page,isMobile})=>{
  test.skip(!isMobile);
  await open(page,'/?trip=italy-grand-tour&lang=de');
  await expect(page.locator('#platformRouteBtn')).toBeVisible();
  await expect(page.locator('#platformTravellerBtn')).toBeVisible();
  await expect(page.locator('#phaseRail')).toBeVisible();
});

test('cruise without chapters hides empty chapter rail and keeps regional timeline',async({page})=>{
  await open(page,'/?trip=western-mediterranean-cruise-loop&lang=de');
  await expect(page.locator('#phaseRail')).toHaveClass(/platform-empty-rail/);
  await expect(page.locator('#regionalRouteRange')).toHaveAttribute('max','6');
  await expect(page.locator('#regionalTimelineTitle')).toContainText(/Barcelona|Marseille/);
  await expect(page.locator('#detailContent .journey-context')).toHaveCount(0);
});



test('regional Story mode uses trip segments and exits cleanly',async({page})=>{
  await open(page,'/?trip=italy-grand-tour&lang=de');
  await expect(page.locator('#platformStoryBtn')).toBeVisible();
  const before=await page.locator('#regionalTimelineTitle').innerText();
  await page.locator('#platformStoryBtn').click();
  await expect(page.locator('body')).toHaveClass(/platform-story-mode/);
  await expect(page.locator('#platformStoryHud')).toBeVisible();
  await page.locator('#platformStoryNext').click();
  await expect.poll(()=>page.locator('#regionalTimelineTitle').innerText()).not.toBe(before);
  await expect(page.locator('#platformStoryRoute')).toContainText('→');
  await page.locator('#platformStoryExit').click();
  await expect(page.locator('body')).not.toHaveClass(/platform-story-mode/);
  await expect(page.locator('#platformStoryHud')).toBeHidden();
});

test('regional desktop exposes settings, methodology and terrain control',async({page,isMobile})=>{
  test.skip(isMobile);
  await open(page,'/?trip=southern-europe-road-trip&lang=de');
  await expect(page.locator('#settingsBtn')).toBeVisible();
  await expect(page.locator('#infoBtn')).toBeVisible();
  await expect(page.locator('#shareBtn')).toBeVisible();
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#settingsPopover')).toBeVisible();
  await expect(page.locator('#terrainView')).toBeVisible();
  await expect(page.locator('#settingsPopover')).toContainText(/3D|Terrain/);
});

test('regional mobile exposes settings as a third top action',async({page,isMobile})=>{
  test.skip(!isMobile);
  await open(page,'/?trip=southern-europe-road-trip&lang=de');
  await expect(page.locator('#platformRouteBtn')).toBeVisible();
  await expect(page.locator('#platformTravellerBtn')).toBeVisible();
  await expect(page.locator('#settingsBtn')).toBeVisible();
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#settingsPopover')).toBeVisible();
  await expect(page.locator('#regionalStorySettingsBtn')).toBeVisible();
});
