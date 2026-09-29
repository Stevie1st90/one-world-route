import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const readJson=async url=>JSON.parse(await readFile(url,'utf8'));
const catalog=await readJson(new URL('../../data/platform/trips.json',import.meta.url));
const collectionCatalog=await readJson(new URL('../../data/platform/collections.json',import.meta.url));
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


test('@regional @discovery homepage claims ownership before deferred feature runtime',async({page})=>{
  test.setTimeout(30000);
  await page.route('**/features.bundle.js',async route=>{
    await new Promise(resolve=>setTimeout(resolve,1400));
    await route.continue();
  });
  await page.goto('/?lang=en',{waitUntil:'commit'});
  await page.waitForSelector('#app>.topbar',{state:'attached',timeout:10000});
  await expect(page.locator('body')).toHaveClass(/platform-home/);
  await expect(page.locator('#app>.topbar')).toBeHidden();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#platformHome')).toBeVisible({timeout:15000});
});

test('@regional @discovery @mobile-critical global discovery home exposes a broad visual journey catalog',async({page,isMobile},testInfo)=>{
  test.setTimeout(90000);
  const errors=capturePageErrors(page);
  await page.goto('/?lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-home/,{timeout:15000});
  await expect(page.locator('body')).not.toHaveClass(/platform-booting/,{timeout:15000});
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



test('@regional @discovery @mobile-critical guided discovery exposes a simple finder before advanced filters',async({page,isMobile},testInfo)=>{
  test.setTimeout(90000);
  const errors=capturePageErrors(page);
  await page.goto('/?lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-home/,{timeout:15000});
  await expect(page.locator('.platform-home-hero h1')).toHaveText('One world. Many ways to travel.');
  await expect(page.locator('#platformHomeFinder')).toBeVisible();
  await expect(page.locator('#homeFinderPace option')).not.toHaveCount(1);
  await expect(page.locator('#homeFinderTheme option')).not.toHaveCount(1);
  await expect(page.locator('#homeFinderParty option')).not.toHaveCount(1);
  await expect(page.locator('#homeRouteSort')).toBeVisible();
  await expect(page.locator('[data-home-filter-advanced]')).toBeHidden();
  if(isMobile){
    await expect(page.locator('.platform-home-nav [data-home-traveller]')).toBeVisible();
    await expect(page.locator('.platform-home-nav [data-home-method]')).toBeHidden();
  }else{
    await expect(page.locator('.platform-home-nav [data-home-traveller]')).toBeVisible();
    await expect(page.locator('.platform-home-nav [data-home-method]')).toBeVisible();
  }

  const expectedFinder=catalog.trips.filter(item=>
    item.id!==catalog.defaultTripId&&
    item.kind==='rail'&&
    (item.discovery?.regions||[]).includes('asia')&&
    item.discovery?.durationBand==='7-14'
  );
  await page.locator('#homeFinderRegion').selectOption('asia');
  await page.locator('#homeFinderKind').selectOption('rail');
  await page.locator('#homeFinderDuration').selectOption('7-14');
  await page.locator('[data-home-finder-apply]').click();
  const finderCards=page.locator('#platformHomeResults .platform-home-card');
  await expect(finderCards).toHaveCount(expectedFinder.length);
  for(const item of expectedFinder)await expect(finderCards.filter({hasText:item.title.en})).toHaveCount(1);
  await page.locator('#homeRouteSort').selectOption('alphabetical');
  const titles=await page.locator('#platformHomeResults .platform-home-card h3').allTextContents();
  expect(titles).toEqual([...titles].sort((a,b)=>a.localeCompare(b)));

  await page.locator('[data-home-filter-more]').click();
  await expect(page.locator('[data-home-filter-advanced]')).toBeVisible();
  await expect(page.locator('[data-home-filter-more]')).toHaveAttribute('aria-expanded','true');
  await page.locator('#platformHomeFinder').screenshot({path:testInfo.outputPath('discovery-finder-v2.png'),animations:'disabled'});
  if(isMobile)await expect.poll(()=>page.evaluate(()=>window.scrollX)).toBe(0);
  expect(errors,'guided discovery runtime page errors').toEqual([]);
});



test('@regional @discovery @mobile-critical collection deep link opens the same filtered interactive catalog',async({page,isMobile},testInfo)=>{
  test.setTimeout(90000);
  const errors=capturePageErrors(page);
  await page.goto('/?collection=great-rail-journeys&lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-home/,{timeout:15000});
  const context=page.locator('#platformHomeCollectionContext');
  await expect(context).toBeVisible();
  await expect(context).toContainText('Great Rail Journeys');
  const definition=collectionCatalog.collections.find(item=>item.id==='great-rail-journeys');
  const expected=catalog.trips.filter(trip=>trip.id!==catalog.defaultTripId&&(!definition.filters.mode||(trip.discovery?.modes||[]).includes(definition.filters.mode)));
  const cards=page.locator('#platformHomeResults .platform-home-card');
  await expect(cards).toHaveCount(expected.length);
  for(const trip of expected)await expect(cards.filter({hasText:trip.title.en})).toHaveCount(1);
  await context.screenshot({path:testInfo.outputPath('collection-handoff.png'),animations:'disabled'});
  if(isMobile)await expect.poll(()=>page.evaluate(()=>window.scrollX)).toBe(0);
  expect(errors,'collection deep-link runtime errors').toEqual([]);
});

test('@regional @discovery traveller start region changes transparent journey recommendations',async({page})=>{
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

test('@regional @discovery @mobile-critical traveller origin country derives recommendation region without manual region selection',async({page,isMobile},testInfo)=>{
  test.setTimeout(90000);
  const errors=capturePageErrors(page);
  await page.goto('/?lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-home/,{timeout:15000});
  if(isMobile)await page.evaluate(()=>window.ONE_WORLD_PLATFORM?.openTraveller?.());
  else await page.locator('.platform-home-nav [data-home-traveller]').click();
  await expect(page.locator('#platformTravellerForm')).toBeVisible();
  await expect(page.locator('#platformTravellerForm select[name="originRegion"]')).toHaveCount(0);
  for(const name of ['durationBand','pace','season','mode','theme']){
    await expect(page.locator('#platformTravellerForm [name="'+name+'"]')).toBeVisible();
  }
  await page.locator('#platformTravellerForm input[name="origin"]').fill('São Paulo / GRU');
  await page.locator('#platformTravellerForm select[name="originCountry"]').selectOption('BR');
  await page.locator('#platformTravellerForm input[name="adults"]').fill('2');
  await page.locator('#platformTravellerForm select[name="durationBand"]').selectOption('15-30');
  await page.locator('#platformTravellerForm select[name="pace"]').selectOption('active');
  await page.locator('#platformTravellerForm select[name="season"]').selectOption('summer');
  await page.locator('#platformTravellerForm select[name="mode"]').selectOption('car');
  await page.locator('#platformTravellerForm select[name="theme"]').selectOption('nature');
  await page.screenshot({path:testInfo.outputPath('traveller-preferences.png'),fullPage:false});
  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    page.locator('#platformTravellerForm').locator('button[type="submit"]').click()
  ]);
  await expect(page.locator('body')).toHaveClass(/platform-home/,{timeout:15000});
  const context=await page.evaluate(()=>JSON.parse(localStorage.getItem('one-world-route:traveller-context:v1')||'{}'));
  expect(context.originCountry).toBe('BR');
  expect(context.originRegion).toBe('south-america');
  expect(context.preferences).toEqual({
    durationBand:'15-30',
    pace:'active',
    season:'summer',
    mode:'car',
    theme:'nature'
  });
  const firstRecommendation=page.locator('#platformHomeFeatured .platform-home-card').first();
  await expect(firstRecommendation.locator('h3')).toHaveText('Patagonia Road Trip');
  await expect(firstRecommendation.locator('[data-recommendation-kind="duration"]')).toBeVisible();
  await expect(firstRecommendation.locator('[data-recommendation-kind="pace"]')).toBeVisible();
  await expect(firstRecommendation.locator('[data-recommendation-kind="season"]')).toBeVisible();
  await page.locator('.platform-home-featured').screenshot({path:testInfo.outputPath('personalized-recommendations.png'),animations:'disabled'});
  expect(errors,'origin-country derived recommendation runtime page errors').toEqual([]);
});

test('@regional starting country applies the closest supported journey entry and keeps manual control',async({page,isMobile},testInfo)=>{
  test.setTimeout(120000);
  await page.addInitScript(()=>{
    localStorage.setItem('one-world-route:traveller-context:v1',JSON.stringify({
      language:'en',currency:'EUR',origin:'Seoul / ICN',originCountry:'KR',originRegion:'asia',
      party:{adults:1,children:0},accessibility:{reducedMobility:false}
    }));
    if(!sessionStorage.getItem('one-world-route:journey-entry-qa:init')){
      localStorage.removeItem('one-world-route:trip-tools:v1');
      sessionStorage.setItem('one-world-route:journey-entry-qa:init','1');
    }
  });
  const errors=capturePageErrors(page);
  await page.goto('/?trip=japan-by-rail&lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:15000});
  await expect(page.locator('body')).not.toHaveClass(/platform-booting/,{timeout:15000});
  if(isMobile){await page.locator('#mobileDetails').click();await expect(page.locator('#rightPanel')).toHaveClass(/mobile-open/);}
  await expect(page.locator('.platform-journey-flow-stop').first()).toContainText('Hiroshima');
  await expect(page.locator('[data-entry-suggestion]')).toContainText('Seoul / ICN → Hiroshima');
  await expect(page.locator('[data-trip-route-start]')).toHaveValue('japan-by-rail-stop-06');
  await page.locator('.platform-journey-personalize').screenshot({path:testInfo.outputPath('journey-entry-suggestion.png'),animations:'disabled'});

  await page.locator('[data-trip-route-start]').selectOption('japan-by-rail-stop-01');
  await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:15000});
  await expect(page.locator('.platform-journey-flow-stop').first()).toContainText('Tokyo',{timeout:20000});
  const manualState=await page.evaluate(()=>JSON.parse(localStorage.getItem('one-world-route:trip-tools:v1')||'{}'));
  expect(manualState.routeStarts?.['japan-by-rail']).toBe('japan-by-rail-stop-01');
  if(isMobile&&!await page.locator('#rightPanel').evaluate(node=>node.classList.contains('mobile-open'))){
    await page.locator('#mobileDetails').click();
    await expect(page.locator('#rightPanel')).toHaveClass(/mobile-open/);
  }
  await expect(page.locator('[data-trip-entry-suggest]')).toBeVisible();

  await page.locator('[data-trip-entry-suggest]').click();
  await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:15000});
  await expect(page.locator('.platform-journey-flow-stop').first()).toContainText('Hiroshima',{timeout:20000});
  const suggestedState=await page.evaluate(()=>JSON.parse(localStorage.getItem('one-world-route:trip-tools:v1')||'{}'));
  expect(suggestedState.routeStarts?.['japan-by-rail']).toBe('japan-by-rail-stop-06');
  expect(errors,'journey entry recommendation runtime page errors').toEqual([]);
});





test('@regional journey detail guides the essential planning flow without duplicate state',async({page,isMobile},testInfo)=>{
  test.setTimeout(120000);
  await page.addInitScript(()=>{
    localStorage.setItem('one-world-route:traveller-context:v1',JSON.stringify({
      language:'en',currency:'EUR',origin:'Seoul / ICN',originCountry:'KR',originRegion:'asia',
      party:{adults:1,children:0},accessibility:{reducedMobility:false}
    }));
    localStorage.removeItem('one-world-route:trip-tools:v1');
  });
  const errors=capturePageErrors(page);
  await page.goto('/?trip=japan-by-rail&lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:15000});
  if(isMobile){
    await page.locator('#mobileDetails').click();
    await expect(page.locator('#rightPanel')).toHaveClass(/mobile-open/);
  }
  const plan=page.locator('[data-trip-planning-status]');
  await expect(plan).toBeVisible();
  await expect(plan.locator('[data-trip-planning-step]')).toHaveCount(6);
  await expect(plan.locator('.platform-detail-planning-head>strong')).toHaveText('1 / 6');
  await expect(plan.locator('.platform-detail-planning-head')).toContainText('Next planning step: Saved');

  await plan.locator('[data-trip-plan-next]').click();
  await expect(plan.locator('.platform-detail-planning-head>strong')).toHaveText('2 / 6');
  await expect(plan.locator('.platform-detail-planning-head')).toContainText('Next planning step: Start this route at');

  await plan.locator('[data-trip-plan-next]').click();
  await expect(page.locator('[data-trip-planning-status] .platform-detail-planning-head>strong')).toHaveText('3 / 6',{timeout:20000});
  await expect(page.locator('[data-trip-planning-status] .platform-detail-planning-head')).toContainText('Next planning step: Start date');

  await page.locator('[data-trip-plan-next]').click();
  const dateInput=page.locator('[data-trip-start-date]');
  await expect(dateInput).toBeFocused();
  await dateInput.fill('2027-04-10');
  await dateInput.dispatchEvent('change');
  await expect(page.locator('[data-trip-planning-status] .platform-detail-planning-head>strong')).toHaveText('4 / 6');
  await expect(page.locator('[data-trip-planning-status] .platform-detail-planning-head')).toContainText('Next planning step: Budget estimate');

  await page.locator('[data-trip-plan-next]').click();
  await expect(page.locator('.platform-trip-tools')).toHaveAttribute('open','');
  await page.locator('[data-trip-budget] input[name="lodging"]').fill('100');
  await page.locator('[data-trip-budget] button[type="submit"]').click();
  await expect(page.locator('[data-trip-planning-status] .platform-detail-planning-head>strong')).toHaveText('5 / 6');
  await expect(page.locator('[data-trip-planning-status] .platform-detail-planning-head')).toContainText('Next planning step: Route access check');

  await page.locator('[data-trip-plan-next]').click();
  await expect(page.locator('[data-trip-planning-status] .platform-detail-planning-head>strong')).toHaveText('6 / 6');
  await expect(page.locator('[data-trip-planning-status] .platform-detail-planning-head')).toContainText('Core planning setup recorded');
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('one-world-route:trip-tools:v1')||'{}'));
  expect(state.savedTrips).toContain('japan-by-rail');
  expect(state.routeStarts?.['japan-by-rail']).toBeTruthy();
  expect(state.startDates?.['japan-by-rail']).toBe('2027-04-10');
  expect(state.budgets?.['japan-by-rail']?.lodgingPerNight).toBe(100);
  expect(state.planningChecks?.['japan-by-rail']?.accessCheckedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  await plan.screenshot({path:testInfo.outputPath('journey-planning-v3.png'),animations:'disabled'});
  if(isMobile)await expect.poll(()=>page.evaluate(()=>window.scrollX)).toBe(0);
  expect(errors,'journey detail planning runtime errors').toEqual([]);
});

test('@regional saved journeys expose actionable planning workspace status',async({page,isMobile},testInfo)=>{
  test.setTimeout(90000);
  await page.addInitScript(()=>{
    localStorage.setItem('one-world-route:traveller-context:v1',JSON.stringify({
      language:'en',currency:'EUR',origin:'Seoul / ICN',originCountry:'KR',originRegion:'asia',
      party:{adults:1,children:0},accessibility:{reducedMobility:false}
    }));
    localStorage.setItem('one-world-route:trip-tools:v1',JSON.stringify({
      savedTrips:['japan-by-rail'],
      budgets:{'japan-by-rail':{lodgingPerNight:110,foodPerPersonDay:35,localPerPersonDay:15,extras:100,contingencyPercent:10,transportMultiplier:1}},
      startDates:{'japan-by-rail':'2027-04-10'},
      seasons:{'japan-by-rail':'spring'},
      routeStarts:{'japan-by-rail':'japan-by-rail-stop-06'},
      planningChecks:{}
    }));
  });
  const errors=capturePageErrors(page);
  await page.goto('/?lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-home/,{timeout:15000});
  await page.evaluate(()=>window.ONE_WORLD_PLATFORM?.openMyTrips?.());
  const modal=page.locator('#platformMyTripsModal:not(.hidden)');
  await expect(modal).toBeVisible();
  const card=modal.locator('[data-mytrip="japan-by-rail"]');
  await expect(card).toBeVisible();
  await expect(card.locator('[data-planning-step]')).toHaveCount(5);
  await expect(card.locator('.platform-mytrip-plan-head>strong')).toHaveText('4 / 5');
  await expect(card.locator('.platform-mytrip-plan-head')).toContainText('Next planning step: Route access check');
  await expect(card.locator('[data-mytrip-open]')).toContainText('Continue planning');
  await card.screenshot({path:testInfo.outputPath('planning-workspace-before-check.png'),animations:'disabled'});

  await card.locator('[data-mytrip-access-check]').click();
  await expect(card.locator('.platform-mytrip-plan-head>strong')).toHaveText('5 / 5');
  await expect(card.locator('.platform-mytrip-plan-head')).toContainText('Core planning setup recorded');
  await expect(card.locator('[data-planning-step="access"]')).toContainText('Manual check recorded');
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('one-world-route:trip-tools:v1')||'{}'));
  expect(state.planningChecks?.['japan-by-rail']?.accessCheckedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  await card.screenshot({path:testInfo.outputPath('planning-workspace.png'),animations:'disabled'});
  if(isMobile)await expect.poll(()=>page.evaluate(()=>window.scrollX)).toBe(0);
  expect(errors,'planning workspace runtime page errors').toEqual([]);
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

test('@regional reusable place experience content renders from a shared country shard',async({page,isMobile},testInfo)=>{
  test.setTimeout(60000);
  const errors=capturePageErrors(page);
  await page.goto('/?trip=japan-by-rail&lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:15000});
  if(isMobile){
    await page.locator('#mobileDetails').click();
    await expect(page.locator('#rightPanel')).toHaveClass(/mobile-open/);
  }
  await page.locator('[data-journey-stop-index="2"]').evaluate(node=>node.click());
  await expect(page.locator('#detailTitle')).toHaveText('Kanazawa');
  await expect(page.locator('.platform-stop-experience')).toHaveCount(1);
  await expect(page.locator('.platform-stop-experience')).toContainText('What to expect');
  await expect(page.locator('.platform-stop-experience')).toContainText('Longer stay');
  await expect(page.locator('.platform-stop-experience')).toContainText('Historic districts');
  await expect(page.locator('.platform-stop-experience-tags')).toContainText('History');
  await page.locator('.platform-stop-experience').screenshot({path:testInfo.outputPath('place-experience.png'),animations:'disabled'});
  if(isMobile)await expect.poll(()=>page.evaluate(()=>window.scrollX)).toBe(0);
  expect(errors,'place experience runtime page errors').toEqual([]);
});

test('@regional country-sharded place experiences load across Patagonia and New Zealand',async({page,isMobile},testInfo)=>{
  test.setTimeout(120000);
  const errors=capturePageErrors(page);

  await page.goto('/?trip=patagonia-road-trip&lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:15000});
  if(isMobile){await page.locator('#mobileDetails').click();await expect(page.locator('#rightPanel')).toHaveClass(/mobile-open/);}
  await page.locator('[data-journey-stop-index="1"]').evaluate(node=>node.click());
  await expect(page.locator('#detailTitle')).toHaveText('El Chaltén');
  await expect(page.locator('.platform-stop-experience')).toContainText('trekking-oriented Patagonian town');

  await page.goto('/?trip=patagonia-road-trip&lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:15000});
  if(isMobile){await page.locator('#mobileDetails').click();await expect(page.locator('#rightPanel')).toHaveClass(/mobile-open/);}
  await page.locator('[data-journey-stop-index="3"]').evaluate(node=>node.click());
  await expect(page.locator('#detailTitle')).toHaveText('Puerto Natales');
  await expect(page.locator('.platform-stop-experience')).toContainText('compact waterfront town');
  await page.locator('.platform-stop-experience').screenshot({path:testInfo.outputPath('patagonia-place-experience.png'),animations:'disabled'});

  await page.goto('/?trip=new-zealand-camper-loop&lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:15000});
  if(isMobile){await page.locator('#mobileDetails').click();await expect(page.locator('#rightPanel')).toHaveClass(/mobile-open/);}
  await page.locator('[data-journey-stop-index="3"]').evaluate(node=>node.click());
  await expect(page.locator('#detailTitle')).toHaveText('Milford Sound');
  await expect(page.locator('.platform-stop-experience')).toContainText('Steep fjord walls');
  await page.locator('.platform-stop-experience').screenshot({path:testInfo.outputPath('new-zealand-place-experience.png'),animations:'disabled'});

  if(isMobile)await expect.poll(()=>page.evaluate(()=>window.scrollX)).toBe(0);
  expect(errors,'country-sharded place experience page errors').toEqual([]);
});

test('@regional major experience batch loads cruise and island country shards',async({page,isMobile},testInfo)=>{
  test.setTimeout(150000);
  const errors=capturePageErrors(page);

  async function openTrip(tripId,stopIndex,title,copy,shot){
    await page.goto('/?trip='+tripId+'&lang=en',{waitUntil:'domcontentloaded'});
    await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:15000});
    if(isMobile){await page.locator('#mobileDetails').click();await expect(page.locator('#rightPanel')).toHaveClass(/mobile-open/);}
    await page.locator('[data-journey-stop-index="'+stopIndex+'"]').evaluate(node=>node.click());
    await expect(page.locator('#detailTitle')).toHaveText(title);
    await expect(page.locator('.platform-stop-experience')).toContainText(copy);
    await page.locator('.platform-stop-experience').screenshot({path:testInfo.outputPath(shot),animations:'disabled'});
  }

  await openTrip('western-mediterranean-cruise-loop',4,'La Goulette · Tunis','Mediterranean port gateway','cruise-place-experience.png');
  await openTrip('norway-arctic-road-trip',2,'Andøya','Open ocean','norway-place-experience.png');
  await openTrip('greek-island-hopping',4,'Santorini','volcanic caldera','greece-place-experience.png');

  if(isMobile)await expect.poll(()=>page.evaluate(()=>window.scrollX)).toBe(0);
  expect(errors,'major experience batch runtime page errors').toEqual([]);
});

test('@regional final experience completion batch loads remaining regional shards',async({page,isMobile},testInfo)=>{
  test.setTimeout(180000);
  const errors=capturePageErrors(page);

  async function openTrip(tripId,stopIndex,title,copy,shot){
    await page.goto('/?trip='+tripId+'&lang=en',{waitUntil:'domcontentloaded'});
    await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:15000});
    if(isMobile){await page.locator('#mobileDetails').click();await expect(page.locator('#rightPanel')).toHaveClass(/mobile-open/);}
    await page.locator('[data-journey-stop-index="'+stopIndex+'"]').evaluate(node=>node.click());
    await expect(page.locator('#detailTitle')).toHaveText(title);
    await expect(page.locator('.platform-stop-experience')).toContainText(copy);
    await page.locator('.platform-stop-experience').screenshot({path:testInfo.outputPath(shot),animations:'disabled'});
  }

  await openTrip('central-europe-rail-journey',9,'Berlin','creative neighbourhoods','central-europe-place-experience.png');
  await openTrip('italy-grand-tour',6,'Venice','car-free lanes','italy-place-experience.png');
  await openTrip('southern-europe-road-trip',0,'Lisbon','tiled façades','southern-europe-place-experience.png');
  await openTrip('vietnam-north-south',0,'Hanoi','old-quarter streets','vietnam-place-experience.png');
  await openTrip('iceland-ring-road',2,'Jökulsárlón','Floating ice','iceland-place-experience.png');

  if(isMobile)await expect.poll(()=>page.evaluate(()=>window.scrollX)).toBe(0);
  expect(errors,'final experience completion batch runtime page errors').toEqual([]);
});

test('@regional @mobile-critical representative regional shell boots cleanly',async({page,isMobile})=>{
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


test('@regional journey variant deep link derives a smaller route from the source trip',async({page,isMobile})=>{
  test.setTimeout(60000);
  const errors=capturePageErrors(page);
  await page.goto('/?trip=italy-grand-tour&variant=southern-italy-highlights&lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:15000});
  await expect(page.locator('body')).not.toHaveClass(/platform-booting/,{timeout:15000});
  if(isMobile){
    await page.locator('#mobileDetails').click();
    await expect(page.locator('#rightPanel')).toHaveClass(/mobile-open/);
  }
  await expect(page.locator('[data-trip-variant]')).toHaveValue('southern-italy-highlights');
  await expect(page.locator('.platform-journey-flow-stop')).toHaveCount(5);
  await expect(page.locator('#regionalRouteRange')).toHaveAttribute('max','4');
  await expect(page.locator('#detailTitle')).toHaveText('Southern Italy Highlights');
  expect(new URL(page.url()).searchParams.get('variant')).toBe('southern-italy-highlights');
  expect(errors,'journey variant runtime page errors').toEqual([]);
});
