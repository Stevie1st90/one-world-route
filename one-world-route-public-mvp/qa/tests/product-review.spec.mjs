import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

// Fixed shared-surface coverage. Catalog size does not add browser cases.
test('@product-review consumer discovery, personal workspace, journey and sharing',async({page,isMobile},info)=>{
  test.setTimeout(360000);
  page.setDefaultTimeout(12000);await page.emulateMedia({reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const shot=async name=>{
    await page.evaluate(()=>{
      for(const img of document.images){const r=img.getBoundingClientRect();if(r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth)img.loading='eager'}
    });
    await expect.poll(()=>page.evaluate(()=>[...document.images].every(img=>{
      const r=img.getBoundingClientRect();return r.bottom<=0||r.top>=innerHeight||r.right<=0||r.left>=innerWidth||img.complete&&img.naturalWidth>0;
    }))).toBe(true);
    await page.evaluate(()=>window.__ONE_WORLD_ROUTE_GLOBE__?.pauseAnimation?.());
    try{await page.screenshot({path:info.outputPath(name+'.png'),animations:'disabled',timeout:60000});}
    finally{await page.evaluate(()=>{if(!document.querySelector('#app')?.inert)window.__ONE_WORLD_ROUTE_GLOBE__?.resumeAnimation?.()});}
  };
  const fit=async()=>{expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);};
  const closeModal=async id=>{await page.locator('#'+id+' .platform-x').click();await expect(page.locator('#'+id)).toHaveClass(/hidden/);};
  await page.goto('/?lang=de');
  await expect(page.locator('#platformHome')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/platform-booting/);
  await shot('homepage');await fit();
  if(isMobile)await page.locator('.platform-home-overflow summary').click();await shot('home-menu');
  await page.locator('#platformHomeFeatured').scrollIntoViewIfNeeded();await shot('featured-cards');
  await page.locator('.platform-home-collections').scrollIntoViewIfNeeded();await shot('collections');
  await page.locator('.platform-home-destinations summary').click();await page.locator('.platform-home-destinations').scrollIntoViewIfNeeded();await shot('destinations-navigation');
  await page.locator('[data-home-inspire]').first().click();await shot('inspire-me');
  await page.locator('#homeRouteSearch').fill('tokyo');
  await expect(page.locator('#platformHomeResults .platform-home-card')).toHaveCount(1);await expect(page.locator('#platformHomeResults')).toContainText('Japan');
  await shot('search-results');
  await page.locator('#homeRouteSearch').fill('zzzz-no-journey');
  await expect(page.locator('.platform-home-empty')).toBeVisible();await shot('empty-search');
  await page.locator('.platform-home-empty [data-home-reset]').click();
  await page.locator('[data-home-filter-more]').click();await shot('filters-open');await fit();
  await page.locator('#platformHomeResults [data-home-save-trip]').first().click();
  await page.locator('#platformHomeResults [data-home-compare-trip]').nth(0).click();
  await page.locator('#platformHomeResults [data-home-compare-trip]').nth(1).click();
  await page.locator('[data-home-compare-open]').click();await shot('compare');
  await page.locator('.platform-modal:not(.hidden) .platform-x').click();
  await page.locator('[data-home-mytrips]').click();await expect(page.locator('#platformMyTripsModal')).toBeVisible();await shot('saved-boards');
  await page.locator('[data-board-name]').fill('Sommerreisen');await page.locator('[data-board-form] button').click();
  await expect(page.locator('[data-board-select]')).toContainText('Sommerreisen');await shot('named-board');
  await page.locator('[data-board-select]').selectOption('');await page.locator('[data-mytrip] details').filter({has:page.locator('[data-board-member]')}).first().locator('summary').click();await page.locator('[data-board-member]').first().check();
  await page.locator('[data-board-select]').selectOption({label:'Sommerreisen (1)'});await expect(page.locator('[data-mytrip]')).toHaveCount(1);
  await shot('board-with-journey');await closeModal('platformMyTripsModal');
  await page.locator('[data-home-traveller]').first().click();await shot('traveller-context');await closeModal('platformTravellerModal');
  await page.goto('/?trip=japan-by-rail&lang=de');
  await expect(page.locator('body')).toHaveClass(/platform-regional-trip/);
  await expect(page.locator('body')).not.toHaveClass(/platform-booting/);
  await shot('journey-map');await fit();
  await page.locator('#settingsBtn').click();await shot('settings-open');
  if(isMobile)await page.locator('#mobileShareBtn').click();else{await page.locator('#settingsBtn').click();await page.locator('#shareBtn').click();}
  await shot('share-menu');
  await page.locator('[data-share-story]').click();await expect(page.locator('.social-story-stage')).toBeVisible();
  for(let i=0;i<5;i++){await shot('social-story-'+(i+1));if(i<4)await page.locator('[data-social-next]').click();}
  const downloadPromise=page.waitForEvent('download',{timeout:30000});await page.locator('[data-social-download]').click();
  const download=await downloadPromise;await download.saveAs(info.outputPath('exported-story.png'));
  const png=await readFile(info.outputPath('exported-story.png'));expect(png.readUInt32BE(16)).toBe(1080);expect(png.readUInt32BE(20)).toBe(1920);
  await closeModal('platformSocialStory');await closeModal('platformShareMenu');
  await page.locator('[data-journey-mode="plan"]').click();await shot('planning-startpoint');
  if(isMobile)await page.locator('#closeDetails').click();
  await page.locator('[data-journey-mode="story"]').click();await shot('story-mode');
  await page.locator('#platformStoryExit').click();
  await page.locator('[data-journey-mode="terrain"]').click();await expect.poll(()=>page.evaluate(()=>window.ONE_WORLD_PLATFORM_MODULES.terrain.isReady()),{timeout:45000}).toBe(true);await expect(page.locator('#terrainMap canvas')).toBeVisible();await shot('terrain');
  expect(errors).toEqual([]);
});

test('@product-review localized static destination, collection, taxonomy and journey pages',async({page},info)=>{
  test.setTimeout(90000);
  for(const lang of ['en','de','it','es','fr','pt']){
    for(const [name,path] of [['destination','destination/it'],['collection','journeys/great-rail-journeys'],['theme','discover/theme/nature'],['detail','trip/italy-grand-tour']]){
      const response=await page.goto('/'+lang+'/'+path);expect(response.status()).toBe(200);
      await expect(page.locator('h1')).toBeVisible();await expect(page.locator('html')).toHaveAttribute('lang',lang);
      await page.evaluate(()=>document.querySelectorAll('img').forEach(img=>img.loading='eager'));const images=page.locator('img');if(await images.count())await expect(images.first()).toBeVisible();await expect.poll(()=>page.evaluate(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      if(lang==='de'||lang==='fr')await page.screenshot({path:info.outputPath(name+'-'+lang+'.png')});
    }
  }
  const bad=await page.goto('/de/trip/not-a-journey');expect(bad.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex');
});
