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
  await expect(page.locator('body')).not.toHaveClass(/platform-booting/,{timeout:15000});
  await expect(page.locator('#routeRange')).toHaveAttribute('max',String(flagship.metrics.internationalLegs),{timeout:15000});
  await expect(page.locator('#filterCount')).toContainText(String(flagship.metrics.internationalLegs));
  try{await expect(page.locator('#settingsBtn')).toBeVisible()}
  catch(error){console.log('flagship settings layout',await page.locator('#settingsBtn').evaluate(el=>{const chain=[];for(let n=el;n;n=n.parentElement){const s=getComputedStyle(n),r=n.getBoundingClientRect();chain.push({node:n.id||n.className,display:s.display,visibility:s.visibility,width:r.width,height:r.height})}return chain}));throw error}
  await expect(page.locator('#platformRouteBtn')).toBeVisible();
  if(isMobile){
    await expect.poll(()=>page.evaluate(()=>window.scrollX)).toBe(0);
    await expect.poll(()=>page.evaluate(()=>document.querySelector('#app')?.scrollLeft||0)).toBe(0);
  }
  expect(errors,'flagship runtime page errors').toEqual([]);
});

test('@flagship operations exposes departure recheck controls',async({page})=>{
  // Two complete globe navigations and a fresh browser context share this budget.
  test.setTimeout(60000);
  const errors=capturePageErrors(page);
  await page.goto('/?segment=13&mode=operations&lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#detailContent')).toContainText('Departure recheck',{timeout:15000});
  await expect(page.locator('[data-journey-mode="operations"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-journey-mode="explore"]')).toHaveAttribute('aria-pressed','false');
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


test('@discovery homepage claims ownership before deferred feature runtime',async({page})=>{
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

test('@discovery @mobile-critical global discovery home exposes a broad visual journey catalog',async({page,isMobile},testInfo)=>{
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
  await expect(page.locator('.platform-home-collection')).toHaveCount(collectionCatalog.collections.length);
  await expect(page.locator('#platformHome')).toContainText('Japan by Rail');
  await expect(page.locator('#platformHome')).toContainText('Patagonia Road Trip');

  const centralEurope=page.locator('#platformHomeResults .platform-home-card[data-home-trip="central-europe-rail-journey"]');
  await expect(centralEurope.locator('.platform-country-chips')).toContainText('7 countries');
  await expect(centralEurope.locator('.platform-home-card-metrics')).toContainText('18 days');
  await expect(centralEurope.locator('.platform-home-card-metrics')).toContainText('10 stops');
  await expect(centralEurope.locator('.platform-home-card-metrics')).not.toContainText('7 countries');
  await expect(centralEurope.locator('.platform-home-card-metrics')).not.toContainText('Rail');
  await expect(centralEurope.locator('.platform-home-card-body > p')).toHaveCount(0);

  const greek=page.locator('#platformHomeResults .platform-home-card[data-home-trip="greek-island-hopping"]');
  await expect(greek.locator('.platform-home-card-metrics')).not.toContainText('1 country');
  await expect(greek.locator('.platform-home-card-body > p')).toHaveText('Athens, Cyclades and Aegean blue');
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



test('@discovery @mobile-critical guided discovery exposes a simple finder before advanced filters',async({page,isMobile},testInfo)=>{
  test.setTimeout(90000);
  const errors=capturePageErrors(page);
  await page.goto('/?lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-home/,{timeout:15000});
  await expect(page.locator('.platform-home-hero h1')).toHaveText('Remarkable journeys. One world.');
  await expect(page.locator('#platformHomeFinder')).toBeVisible();
  await expect(page.locator('#homeFinderPace')).toBeHidden();
  await page.locator('.platform-finder-preferences summary').click();
  await expect(page.locator('#homeFinderPace')).toBeVisible();
  await expect(page.locator('#homeFinderPace option')).not.toHaveCount(1);
  await expect(page.locator('#homeFinderTheme option')).not.toHaveCount(1);
  await expect(page.locator('#homeFinderParty option')).not.toHaveCount(1);
  await expect(page.locator('#homeRouteSort')).toBeVisible();
  await expect(page.locator('[data-home-filter-advanced]')).toBeHidden();
  if(isMobile){
    await expect(page.locator('.platform-home-nav [data-home-traveller]')).toBeVisible();
    await expect(page.locator('.platform-home-nav [data-home-method]')).toBeHidden();
    await page.locator('.platform-home-overflow summary').click();
    await expect(page.locator('.platform-home-nav [data-home-method]')).toBeVisible();
    await page.locator('.platform-home-overflow summary').click();
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



test('@discovery @mobile-critical collection deep link opens the same filtered interactive catalog',async({page,isMobile},testInfo)=>{
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

test('@discovery traveller start region changes transparent journey recommendations',async({page})=>{
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

test('@discovery @mobile-critical traveller origin country derives recommendation region without manual region selection',async({page,isMobile},testInfo)=>{
  test.setTimeout(90000);
  const errors=capturePageErrors(page);
  await page.goto('/?lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-home/,{timeout:15000});
  if(isMobile)await page.evaluate(()=>window.ONE_WORLD_PLATFORM?.openTraveller?.());
  else await page.locator('.platform-home-nav [data-home-traveller]').click();
  await expect(page.locator('#platformTravellerForm')).toBeVisible();
  await expect(page.locator('#platformTravellerForm select[name="originRegion"]')).toHaveCount(0);
  await page.locator('#platformTravellerForm details:not(.traveller-vehicle)>summary').click();
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
  await page.locator('.platform-personalization-details>summary').click();
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
  await page.locator('.platform-personalization-details>summary').click();
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
  await page.locator('.platform-personalization-details>summary').click();
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
  await expect(page.locator('#platformRouteModal:not(.hidden) .platform-route-card')).toHaveCount(catalog.trips.length);
  await expect(page.locator('#platformRouteModal [data-library-discovery]')).toBeVisible();
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
  if(!(await page.locator('.platform-personalization-details').getAttribute('open')!==null))await page.locator('.platform-personalization-details>summary').click();
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

test('@experience reusable place experience content renders from a shared country shard',async({page,isMobile},testInfo)=>{
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

test('@experience country-sharded place experiences load across Patagonia and New Zealand',async({page,isMobile},testInfo)=>{
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

test('@experience major experience batch loads cruise and island country shards',async({page,isMobile},testInfo)=>{
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

test('@experience final experience completion batch loads remaining regional shards',async({page,isMobile},testInfo)=>{
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


test('@regional @mobile-critical journey variant and planning state stay consistent together',async({page,isMobile})=>{
  test.setTimeout(90000);
  await page.addInitScript(()=>{
    localStorage.setItem('one-world-route:traveller-context:v1',JSON.stringify({
      language:'en',currency:'EUR',origin:'Frankfurt / FRA',originCountry:'DE',
      party:{adults:2,children:0},accessibility:{reducedMobility:false}
    }));
    localStorage.removeItem('one-world-route:trip-tools:v1');
  });
  const errors=capturePageErrors(page);
  await page.goto('/?trip=italy-grand-tour&variant=southern-italy-highlights&lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:15000});
  await expect(page.locator('body')).not.toHaveClass(/platform-booting/,{timeout:15000});
  if(isMobile){
    await page.locator('#mobileDetails').click();
    await expect(page.locator('#rightPanel')).toHaveClass(/mobile-open/);
  }
  await expect(page.locator('[data-trip-variant]')).toHaveValue('southern-italy-highlights');
  await expect(page.locator('[data-trip-planning-status]')).toBeVisible();
  await page.locator('[data-trip-save]').click();

  await page.locator('.platform-personalization-details>summary').click();
  await page.locator('[data-trip-variant]').selectOption('northern-italy-tuscany');
  await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:15000});
  if(isMobile&&!await page.locator('#rightPanel').evaluate(node=>node.classList.contains('mobile-open'))){
    await page.locator('#mobileDetails').click();
    await expect(page.locator('#rightPanel')).toHaveClass(/mobile-open/);
  }
  await expect(page.locator('[data-trip-variant]')).toHaveValue('northern-italy-tuscany',{timeout:20000});
  await expect(page.locator('#detailTitle')).toHaveText('Northern Italy & Tuscany');
  await expect(page.locator('.platform-journey-flow-stop')).toHaveCount(6);
  expect(new URL(page.url()).searchParams.get('variant')).toBe('northern-italy-tuscany');

  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('one-world-route:trip-tools:v1')||'{}'));
  expect(state.savedTrips).toContain('italy-grand-tour');
  expect(state.variants?.['italy-grand-tour']).toBe('northern-italy-tuscany');
  await expect(page.locator('[data-trip-planning-status]')).toBeVisible();
  if(isMobile)await expect.poll(()=>page.evaluate(()=>window.scrollX)).toBe(0);
  expect(errors,'variant + planning integration runtime errors').toEqual([]);
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

test('@discovery curated collection deep link supports combined metadata filters',async({page})=>{
  await page.goto('/?collection=active-nature&lang=en',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/platform-home/,{timeout:15000});
  await expect(page.locator('#platformHomeResults .platform-home-card')).toHaveCount(3);
  for(const title of ['Patagonia Road Trip','Iceland Ring Road','Utah National Parks Road Trip']){
    await expect(page.locator('#platformHomeResults .platform-home-card').filter({hasText:title})).toHaveCount(1);
  }
});



test('@discovery @mobile-critical scalable static visuals load cards hero and native social without card tile requests',async({page,isMobile},testInfo)=>{
 // Four software-GL captures and two journey boots share this budget.
 test.setTimeout(180000);const errors=capturePageErrors(page),tiles=[];
 await page.emulateMedia({reducedMotion:'reduce'});
 page.on('request',r=>{if(/tiles\.openfreemap|tiles\.mapterhorn/.test(r.url()))tiles.push(r.url())});
 await page.goto('/?lang=en',{waitUntil:'domcontentloaded'});
 const card=page.locator('[data-home-trip="japan-by-rail"]').first();
 await card.scrollIntoViewIfNeeded();
 await expect(card.locator('[data-visual-kind="bespoke"]')).toBeVisible();
 await expect.poll(()=>card.locator('.platform-route-image').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
 const size=await card.locator('.platform-home-card-visual').evaluate(el=>({w:el.clientWidth,h:el.clientHeight,imgW:el.querySelector('.platform-route-image').clientWidth,imgH:el.querySelector('.platform-route-image').clientHeight}));
 expect(Math.abs(size.w/size.h-16/9)).toBeLessThan(.02);expect(size.imgW).toBe(size.w);expect(size.imgH).toBe(size.h);
 await expect(card.locator('.platform-country-chips img[src$="jp.svg"]')).toHaveCount(1);
 const regions=page.locator('.platform-home-region-card img');await expect(regions).toHaveCount(6);
 await expect(page.locator('[data-region-map]')).toHaveCount(0);
 await page.locator('.platform-home-region-grid').scrollIntoViewIfNeeded();
 for(const portrait of await regions.all())await portrait.scrollIntoViewIfNeeded();
 await expect.poll(()=>regions.evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
 await page.locator('.platform-home-region-grid').screenshot({path:testInfo.outputPath('region-discovery.png')});
 await card.screenshot({path:testInfo.outputPath('auto-card.png')});
 expect(tiles,'card images must not load map tiles').toEqual([]);
 const manifest=await page.evaluate(async()=>fetch('./data/platform/media-manifest.json').then(r=>r.json()));
 expect(manifest.journeys).toHaveLength(21);
 const requests=await Promise.all(manifest.journeys.map(j=>page.request.get(j.autoRouteVisual.asset)));
 expect(requests.every(r=>r.ok())).toBe(true);
 await card.locator('[data-open-home-trip]').click();
 await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:25000});
 await expect(page.locator('.platform-journey-hero-art img')).toHaveCount(1);
 await expect(page.locator('[data-journey-mode="plan"]')).toHaveCount(1);
 await page.evaluate(()=>window.ONE_WORLD_PLATFORM_MODULES.regionalDetail?.renderTripOverview?.());
 await expect(page.locator('#detailContent .platform-overview-visual img')).toHaveCount(0);
 if(!isMobile)await page.locator('.platform-journey-hero-art').screenshot({path:testInfo.outputPath('auto-hero.png')});
 if(isMobile){await page.locator('#settingsBtn').click();await page.locator('#mobileShareBtn').click()}else await page.locator('#shareBtn').click();
 await page.locator('[data-share-story]').click();
 const stage=page.locator('.social-story-stage');await expect(stage).toBeVisible();
 await expect(stage).toHaveCSS('background-image',/vertical-/);
 await expect(page.locator('.social-story-controls')).toBeInViewport({ratio:1});
 await stage.screenshot({path:testInfo.outputPath('auto-social.png')});
 await page.locator('[data-social-next]').click();await expect(stage).toHaveAttribute('data-visual-role','routeOverview');
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:25000});
 expect(errors).toEqual([]);
});

test('@discovery @mobile-critical inspiration selects published routes and keeps globe widths uniform',async({page},testInfo)=>{
 test.setTimeout(90000);const errors=capturePageErrors(page);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/?lang=en',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#platformHomeMoment .platform-home-card')).toHaveCount(1);
 await page.waitForFunction(()=>{const g=window.__ONE_WORLD_ROUTE_GLOBE__;return g?.arcsData()?.some(a=>a.tripId==='japan-by-rail')&&g.globeMaterial()?.map?.image?.complete});
 const defaults=await page.evaluate(()=>{const g=window.__ONE_WORLD_ROUTE_GLOBE__;return [...new Set(g.arcsData().map(g.arcStroke()))]});
 expect(defaults).toEqual([.23]);
 await page.evaluate(()=>{const g=window.__ONE_WORLD_ROUTE_GLOBE__;g.onArcClick()(g.arcsData().find(a=>a.tripId==='japan-by-rail'))});
 await expect(page.locator('#platformHomeGlobePreview')).toContainText('Japan by Rail');
 await page.screenshot({path:testInfo.outputPath('globe-selection.png')});
 expect(await page.evaluate(()=>{const g=window.__ONE_WORLD_ROUTE_GLOBE__;return g.arcStroke()(g.arcsData().find(a=>a.tripId==='japan-by-rail'))})).toBe(.42);
 await page.locator('.platform-home-hero [data-home-inspire]').click();
 const first=await page.locator('#platformHomeMoment .platform-home-card').getAttribute('data-home-trip');
 await page.locator('#platformHomeInspiration [data-home-inspire]').click();
 expect(await page.locator('#platformHomeMoment .platform-home-card').getAttribute('data-home-trip')).not.toBe(first);
 await page.screenshot({path:testInfo.outputPath('inspiration.png')});
 await page.locator('#platformHomeMoment [data-open-home-trip]').click();
 await expect(page.locator('body')).not.toHaveClass(/platform-home/);
 await page.locator('#platformHomeBtn').click();
 await expect(page.locator('.platform-home-recent')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 expect(errors).toEqual([]);
});

test('@discovery @mobile-critical social story presents five factual vertical scenes and a user planning date',async({page,isMobile},testInfo)=>{
 test.setTimeout(90000);const errors=capturePageErrors(page);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/?trip=japan-by-rail&lang=en&stop=2',{waitUntil:'domcontentloaded'});
 await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:20000});
 if(isMobile){await page.locator('#settingsBtn').click();await page.locator('#mobileShareBtn').click()}else await page.locator('#shareBtn').click();
 await page.locator('[data-share-story]').click();
 await expect(page.locator('#platformSocialStory')).toBeVisible();
 await expect(page.locator('.social-story-controls')).toBeInViewport({ratio:1});
 const b=await page.locator('.social-story-stage').boundingBox();expect(Math.abs(b.width/b.height-9/16)).toBeLessThan(.01);
 await expect(page.locator('.social-story-copy')).toContainText('Japan by Rail');
 await page.screenshot({path:testInfo.outputPath('social-story.png')});
 for(let i=1;i<5;i++)await page.locator('[data-social-next]').click();
 await expect(page.locator('[data-social-open]')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 await page.goto('/?trip=world-195&lang=en&segment=1',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.platform-scenario-note')).toBeAttached({timeout:20000});
 if(isMobile)await page.locator('#mobileDetails').click();
 await expect(page.locator('#detailContent')).toContainText('Day 1');
 if(isMobile){await page.locator('#settingsBtn').click();await page.locator('#mobileShareBtn').click();await page.locator('[data-share-planning]').click()}else await page.locator('.platform-scenario-note button').click();
 await page.locator('#platformPlanningContext input').fill('2030-04-12');
 await page.locator('#platformPlanningContext [type=submit]').click();
 await expect(page.locator('#detailContent')).toContainText(/Apr 12, 2030|12 Apr 2030/,{timeout:20000});
 const original=await page.evaluate(async()=>{const meta=window.ONE_WORLD_PLATFORM.getTrip();return (await fetch(meta.dataset).then(r=>r.json())).segments[0].planDeparture});
 expect(original).not.toBe('2030-04-12');expect(errors).toEqual([]);
});
