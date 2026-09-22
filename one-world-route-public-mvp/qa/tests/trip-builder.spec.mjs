import {test,expect} from '@playwright/test';
import {rm} from 'node:fs/promises';
import {resolve} from 'node:path';

test('internal builder authors a draft and previews it with the regional engine',async({page,isMobile},testInfo)=>{
  test.setTimeout(90000);
  const slug=('ci-builder-ui-'+testInfo.project.name).toLowerCase().replace(/[^a-z0-9]+/g,'-');
  const root=resolve(process.cwd(),'..');
  const draftBase=resolve(root,'data/platform/drafts',slug);
  try{
    await page.goto('/__builder/',{waitUntil:'domcontentloaded'});
    await expect(page.locator('#heading')).toHaveText('Select or create a trip');
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
  }finally{
    await rm(draftBase+'.trip.json',{force:true});
    await rm(draftBase+'.catalog.json',{force:true});
  }
});