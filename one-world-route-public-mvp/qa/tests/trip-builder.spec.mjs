import {test,expect} from '@playwright/test';

test('internal trip builder creates and edits a draft',async({page,isMobile},testInfo)=>{
  test.setTimeout(90000);
  await page.goto('/builder/',{waitUntil:'domcontentloaded'});
  await expect(page.getByText('Internal Trip Builder')).toBeVisible();
  await expect(page.locator('#newDraftBtn')).toBeVisible();

  await page.locator('#newDraftBtn').click();
  await expect(page.locator('#newDraftDialog')).toBeVisible();
  await page.locator('#newDraftDialog [name="slug"]').fill('qa-builder-proof');
  await page.locator('#newDraftDialog [name="title"]').fill('QA Builder Proof');
  await page.locator('#newDraftDialog [name="kind"]').fill('rail');
  await page.locator('#newDraftDialog [name="days"]').fill('8');
  await page.locator('#newDraftForm .primary').click();

  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('#pageTitle')).toContainText('QA Builder Proof');
  await expect(page.locator('#slug')).toHaveValue('qa-builder-proof');

  await page.locator('[data-tab="places"]').click();
  await page.locator('[data-add="place"]').click();
  await expect(page.locator('[data-row="place"]')).toHaveCount(1);
  const place=page.locator('[data-row="place"]').first();
  await place.locator('[data-key="id"]').fill('paris');
  await place.locator('[data-key="countryCode"]').fill('FR');
  await place.locator('[data-key="coordinates.lat"]').fill('48.8566');
  await place.locator('[data-key="coordinates.lng"]').fill('2.3522');
  await place.locator('[data-key="name.en"]').fill('Paris');

  await page.locator('#saveBtn').click();
  await expect(page.locator('#saveBtn')).not.toHaveClass(/dirty/);

  await page.locator('[data-tab="gate"]').click();
  await page.locator('#gateInlineBtn').click();
  await expect(page.locator('#validationBox')).toHaveClass(/bad/,{timeout:30000});
  await expect(page.locator('#validationBox')).toContainText('Gate failed');

  const viewport=page.viewportSize();
  const appBox=await page.locator('.app').boundingBox();
  expect(appBox).toBeTruthy();
  expect(appBox.x).toBeGreaterThanOrEqual(-1);
  expect(appBox.x+appBox.width).toBeLessThanOrEqual(viewport.width+1);

  await page.screenshot({path:testInfo.outputPath('trip-builder-'+testInfo.project.name+'.png'),fullPage:true,animations:'disabled'});
});

test('internal trip builder preview uses the real regional engine',async({page,context},testInfo)=>{
  test.setTimeout(90000);
  await page.goto('/builder/',{waitUntil:'domcontentloaded'});
  const response=await page.request.post('/api/drafts',{data:{slug:'qa-preview-proof',title:'QA Preview Proof',kind:'custom',days:7}});
  expect(response.ok()).toBeTruthy();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-draft="qa-preview-proof"]').click();
  await expect(page.locator('#previewBtn')).toBeEnabled();

  const [preview]=await Promise.all([
    context.waitForEvent('page'),
    page.locator('#previewBtn').click()
  ]);
  await preview.waitForLoadState('domcontentloaded');
  await expect(preview.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:30000});
  await expect(preview.locator('.brand small')).toContainText('QA Preview Proof');
  await preview.screenshot({path:testInfo.outputPath('trip-builder-preview-'+testInfo.project.name+'.png'),fullPage:false,animations:'disabled'});
  await preview.close();
});
