import {test,expect} from '@playwright/test';

test('search selects a country or route result',async({page})=>{
  await page.goto('/');await page.locator('#searchBtn').click();await page.locator('#commandInput').fill('Germany');
  const hit=page.locator('#commandResults .command-row').first();await expect(hit).toBeVisible();await hit.click();
  await expect(page.locator('#detailTitle')).toContainText(/Germany/);
});

test('All route restores 194 globe legs',async({page})=>{
  await page.goto('/?segment=31&phase=2');await page.locator('#phaseRail button[data-phase="all"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__ONE_WORLD_ROUTE_GLOBE__?.arcsData?.()?.length||0)).toBe(194);
});

test('Story survives manual drag',async({page})=>{
  await page.goto('/?segment=7&phase=1');await page.locator('#playBtn').click();await expect(page.locator('body')).toHaveClass(/story-mode/);
  const box=await page.locator('#globe').boundingBox();if(!box)throw new Error('Missing globe');
  await page.mouse.move(box.x+box.width*.52,box.y+box.height*.52);await page.mouse.down();await page.mouse.move(box.x+box.width*.69,box.y+box.height*.57,{steps:8});await page.mouse.up();
  await expect.poll(()=>page.evaluate(()=>{const r=document.querySelector('#globe canvas')?.getBoundingClientRect();return !!r&&r.width>100&&r.height>100})).toBe(true);
});

test('Terrain chapter navigation moves camera',async({page})=>{
  await page.goto('/?segment=5&phase=1');await page.locator('#settingsBtn').click();await page.locator('#terrainView').check();
  await expect(page.locator('body')).toHaveClass(/terrain-view/);
  const before=await page.evaluate(()=>window.__ONE_WORLD_TERRAIN__?.getCenter?.().toArray?.());
  await page.locator('#phaseRail button[data-phase="3"]').click();await page.waitForTimeout(1500);
  const after=await page.evaluate(()=>window.__ONE_WORLD_TERRAIN__?.getCenter?.().toArray?.());
  expect(before&&after&&Math.hypot(before[0]-after[0],before[1]-after[1])).toBeGreaterThan(5);
});

test('mobile details remain in viewport',async({page,isMobile})=>{
  test.skip(!isMobile);await page.goto('/?country=Israel');await page.locator('#mobileDetails').click();
  const box=await page.locator('#rightPanel').boundingBox(),width=await page.evaluate(()=>innerWidth);if(!box)throw new Error('Missing detail panel');
  expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);
});

test('PWA and public datasets are reachable',async({page,request})=>{
  await page.goto('/');await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href',/manifest/);
  expect((await request.get('/manifest.webmanifest')).ok()).toBeTruthy();
  expect((await request.get('/data/public-route.json')).ok()).toBeTruthy();
});