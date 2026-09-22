import {test,expect} from '@playwright/test';

test('internal trip builder creates and previews a local draft',async({page},testInfo)=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.getByText('Internal Trip Builder')).toBeVisible();
  await expect(page.getByRole('button',{name:'+ New draft'})).toBeVisible();

  await page.getByRole('button',{name:'+ New draft'}).click();
  await expect(page.getByRole('heading',{name:'New trip draft'})).toBeVisible();
  await page.locator('[name="slug"]').fill('builder-browser-proof');
  await page.locator('[name="kind"]').fill('cycling');
  await page.locator('[name="days"]').fill('9');
  await page.locator('[name="title"]').fill('Builder Browser Proof');
  await page.getByRole('button',{name:'Create draft'}).click();

  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('#slug')).toHaveValue('builder-browser-proof');
  await expect(page.locator('#kind')).toHaveValue('cycling');
  await expect(page.locator('#previewFrame')).toHaveAttribute('src',/builder-browser-proof/);

  await page.locator('[data-tab="gate"]').click();
  await page.getByRole('button',{name:'Run publish gate'}).click();
  await expect(page.locator('#gateState')).toContainText('Publish blocked');
  await expect(page.locator('#gateErrors .message')).not.toHaveCount(0);

  await page.screenshot({
    path:testInfo.outputPath('trip-builder-desktop-1440.png'),
    fullPage:false,
    animations:'disabled'
  });
});
