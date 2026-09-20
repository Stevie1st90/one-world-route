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
