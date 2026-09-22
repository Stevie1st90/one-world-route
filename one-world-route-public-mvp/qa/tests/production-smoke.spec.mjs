import {test,expect} from '@playwright/test';

function capturePageErrors(page){
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  return errors;
}

async function open(page,path){
  await page.goto(path,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#app')).toBeVisible({timeout:20000});
}

async function expectRegional(page){
  await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:20000});
  await expect.poll(()=>page.locator('.platform-stop').count()).toBeGreaterThan(1);
}

async function expectRegionalTooltipIsolation(page){
  const tooltip=await page.evaluate(()=>{
    const globe=window.__ONE_WORLD_ROUTE_GLOBE__;
    const points=globe?.pointsData?.()||[];
    const accessor=globe?.pointLabel?.();
    return points.length&&typeof accessor==='function'?String(accessor(points[0])):'';
  });
  expect(tooltip).not.toContain('[object Object]');
  expect(tooltip).not.toContain('undefined/195');
  expect(tooltip.trim().length).toBeGreaterThan(0);
  await expect(page.locator('body')).not.toContainText('[object Object]');
  await expect(page.locator('body')).not.toContainText('undefined/195');
}

async function expectMobileShellStable(page){
  const state=await page.evaluate(()=>{
    const rect=selector=>{
      const node=document.querySelector(selector);
      const box=node?.getBoundingClientRect();
      return box?{left:box.left,right:box.right,width:box.width}:null;
    };
    return {
      innerWidth:window.innerWidth,
      scrollX:window.scrollX,
      appScrollLeft:document.querySelector('#app')?.scrollLeft||0,
      app:rect('#app'),
      topbar:rect('.topbar'),
      timeline:rect('#timeline')
    };
  });
  expect(state.scrollX).toBe(0);
  expect(state.appScrollLeft).toBe(0);
  expect(state.app?.left).toBeGreaterThanOrEqual(-1);
  expect(state.app?.right).toBeGreaterThanOrEqual(state.innerWidth-1);
  expect(state.topbar?.right).toBeGreaterThanOrEqual(state.innerWidth-9);
  expect(state.timeline?.right).toBeGreaterThanOrEqual(state.innerWidth-17);
}

test('production home exposes the trip catalog instead of auto-opening flagship',async({page},testInfo)=>{
  test.setTimeout(120000);
  const errors=capturePageErrors(page);
  await open(page,'/?lang=de');
  await expect(page.locator('#platformHome')).toBeVisible({timeout:20000});
  await expect(page.locator('[data-home-trip]')).toHaveCount(5);
  await expect(page.locator('#platformHome')).toContainText('Routen entdecken');
  expect(errors).toEqual([]);
  await page.screenshot({path:testInfo.outputPath('production-home.png'),fullPage:false,animations:'disabled'});
});

test('production flagship preserves the 195/194 shell invariants',async({page,isMobile},testInfo)=>{
  test.setTimeout(120000);
  const errors=capturePageErrors(page);
  await open(page,'/?trip=world-195&lang=en');
  await expect(page.locator('body')).not.toHaveClass(/platform-regional-trip/);
  await expect(page.locator('#routeRange')).toHaveAttribute('max','194');
  await expect(page.locator('#filterCount')).toContainText('194');
  await expect(page.locator('.brand small')).toContainText('195 countries');
  if(isMobile)await expectMobileShellStable(page);
  expect(errors).toEqual([]);
  await page.screenshot({path:testInfo.outputPath('production-flagship.png'),fullPage:false,animations:'disabled'});
});

test('production cruise uses isolated localized regional tooltips',async({page},testInfo)=>{
  test.setTimeout(120000);
  const errors=capturePageErrors(page);
  await open(page,'/?trip=western-mediterranean-cruise-loop&lang=de');
  await expectRegional(page);
  await expectRegionalTooltipIsolation(page);
  expect(errors).toEqual([]);
  await page.screenshot({path:testInfo.outputPath('production-cruise.png'),fullPage:false,animations:'disabled'});
});

test('production Italy route never renders object-valued labels',async({page},testInfo)=>{
  test.setTimeout(120000);
  const errors=capturePageErrors(page);
  await open(page,'/?trip=italy-grand-tour&lang=de');
  await expectRegional(page);
  await expectRegionalTooltipIsolation(page);
  const stops=page.locator('[data-stop-index]');
  const count=await stops.count();
  for(let index=0;index<count;index++){
    await stops.nth(index).click();
    await expect(page.locator('body')).not.toContainText('[object Object]');
    await expect(page.locator('body')).not.toContainText('undefined/195');
  }
  expect(errors).toEqual([]);
  await page.screenshot({path:testInfo.outputPath('production-italy.png'),fullPage:false,animations:'disabled'});
});

test('production rail architecture proof renders through the shared regional engine',async({page},testInfo)=>{
  test.setTimeout(120000);
  const errors=capturePageErrors(page);
  await open(page,'/?trip=central-europe-rail-journey&lang=de');
  await expectRegional(page);
  await expect(page.locator('body')).toContainText('Mitteleuropa');
  await expectRegionalTooltipIsolation(page);
  expect(errors).toEqual([]);
  await page.screenshot({path:testInfo.outputPath('production-rail.png'),fullPage:false,animations:'disabled'});
});
