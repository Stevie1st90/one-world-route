import {test,expect} from '@playwright/test';
// A local SVG fixture exercises future approved artwork without publishing any cover.
test('@discovery @mobile-critical approved cover uses discovery and identity slots while social route remains geographic',async({page,isMobile},testInfo)=>{
 test.setTimeout(90000);
 const asset='./assets/trips/qa-cover-fixture.svg',vertical='./assets/trips/qa-cover-vertical-fixture.svg';
 const svg=(w,h)=>'<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'"><rect width="100%" height="100%" fill="#284c63"/><circle cx="'+w*.6+'" cy="'+h*.4+'" r="'+w*.2+'" fill="#f1bc83"/></svg>';
 await page.route('**/assets/trips/qa-cover*',r=>r.fulfill({contentType:'image/svg+xml',body:svg(r.request().url().includes('vertical')?900:1200,r.request().url().includes('vertical')?1600:675)}));
 await page.route('**/data/platform/media-manifest.json',async route=>{
  const response=await route.fetch(),m=await response.json(),j=m.journeys.find(j=>j.id==='japan-by-rail');
  j.journeyCover={type:'image',sourceType:'generated',mediaKind:'cover',tripId:j.id,asset,aspectRatio:'16:9',status:'published',rightsStatus:'approved',license:'test-fixture',attribution:'QA fixture',attributionRequired:true,focalPoint:{x:.6,y:.4},alt:{en:'Abstract illustration fixture'},derivatives:{vertical:{asset:vertical,focalPoint:{x:.5,y:.4}}}};
  await route.fulfill({response,json:m});
 });
 await page.goto('/?lang=en',{waitUntil:'domcontentloaded'});
 const card=page.locator('[data-home-trip="japan-by-rail"]').first();await card.scrollIntoViewIfNeeded();
 await expect(card.locator('[data-visual-kind="bespoke"]')).toBeVisible();
 await expect(card.locator('.platform-route-image')).toHaveAttribute('src',asset);
 await expect(card.locator('.platform-media-credit')).toContainText('QA fixture');
 await card.locator('[data-open-home-trip]').click();
 await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:25000});
 await expect(page.locator('.platform-journey-hero-art img')).toHaveAttribute('src',asset);
 await expect(page.locator('#detailContent .platform-overview-visual')).toHaveCount(0);
 if(isMobile){await page.locator('#settingsBtn').click();await page.locator('#mobileShareBtn').click()}else await page.locator('#shareBtn').click();
 await page.locator('[data-share-story]').click();const stage=page.locator('.social-story-stage');
 await expect(stage).toHaveCSS('background-image',/qa-cover-vertical/);
 await expect(stage).toHaveCSS('background-position','50% 40%');
 await page.locator('[data-social-next]').click();
 await expect(stage).toHaveCSS('background-image',/generated\/routes\/japan-by-rail\/vertical-/);
 await stage.screenshot({path:testInfo.outputPath('cover-fixture-route-scene.png')});
});
