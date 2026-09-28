import {test,expect} from '@playwright/test';
import {rm} from 'node:fs/promises';
import {resolve} from 'node:path';

test('internal builder authors a draft and previews it with the regional engine',async({page,isMobile},testInfo)=>{
  test.setTimeout(90000);
  const slug=('ci-builder-ui-'+testInfo.project.name).toLowerCase().replace(/[^a-z0-9]+/g,'-');
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  const root=resolve(process.cwd(),'..');
  const draftBase=resolve(root,'data/platform/drafts',slug);
  try{
    await page.goto('/__builder/',{waitUntil:'domcontentloaded'});
    await expect(page.locator('#heading')).toHaveText('Select or create a trip');
    if(isMobile)await page.locator('#mobileCoverageBtn').click();else await page.locator('#coverageBtn').click();
    await expect(page.locator('#coverageDialog')).toBeVisible();
    const coverageBounds=await page.locator('#coverageDialog').evaluate(el=>{const r=el.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:innerWidth,height:innerHeight}});
    expect(coverageBounds.top).toBeGreaterThanOrEqual(0);
    expect(coverageBounds.left).toBeGreaterThanOrEqual(0);
    expect(coverageBounds.bottom).toBeLessThanOrEqual(coverageBounds.height);
    expect(coverageBounds.right).toBeLessThanOrEqual(coverageBounds.width);
    await expect(page.locator('#coverageSummary')).toContainText('Coverage');
    await expect(page.locator('#coverageSummary')).toContainText('Profiles');
    await expect(page.locator('#coverageQueue .coverage-item').first()).toBeVisible();
    await expect(page.locator('#coverageJourneys .coverage-journey')).toHaveCount(16);
    await page.locator('#coverageDialog').screenshot({path:testInfo.outputPath('experience-coverage-'+testInfo.project.name+'.png'),animations:'disabled'});
    await page.locator('#coverageDialog [data-close="coverageDialog"]').click();
    await expect(page.locator('#coverageDialog')).not.toBeVisible();
    await page.request.post('/__builder/api/scaffold',{data:{slug,kind:'island-hopping',days:8}});
    await page.reload({waitUntil:'domcontentloaded'});
    if(isMobile){await page.locator('#mobileDraftSelect').selectOption(slug)}else{await page.locator('[data-slug="'+slug+'"]').click()}
    await expect(page.locator('#editor')).toBeVisible();
    await expect(page.locator('[data-tab="localization"]')).toBeVisible();
    await expect(page.locator('[data-tab="trip"]')).toBeVisible();
    await expect(page.locator('[data-tab="catalog"]')).toBeVisible();
    await page.locator('[data-tab="localization"]').click();
    await expect(page.locator('#jsonEditor')).toHaveValue(/"subtitle"/);
    await page.screenshot({path:testInfo.outputPath('trip-builder-'+testInfo.project.name+'.png'),fullPage:true,animations:'disabled'});

    const popupPromise=page.waitForEvent('popup');
    await page.locator('#previewBtn').click();
    const preview=await popupPromise;
    await expect(preview.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:30000});
    await expect(preview.locator('#platformRouteBtn')).toBeVisible();
    await preview.close();
    expect(pageErrors,'trip builder runtime page errors').toEqual([]);
  }finally{
    await rm(draftBase+'.trip.json',{force:true});
    await rm(draftBase+'.catalog.json',{force:true});
  }
});