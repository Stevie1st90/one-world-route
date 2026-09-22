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
  const labels=await page.evaluate(()=>{
    const globe=window.__ONE_WORLD_ROUTE_GLOBE__;
    const read=(dataGetter,accessorGetter,extract=value=>String(value??''))=>{
      const data=typeof globe?.[dataGetter]==='function'?(globe[dataGetter]()||[]):[];
      const accessor=typeof globe?.[accessorGetter]==='function'?globe[accessorGetter]():null;
      if(typeof accessor!=='function')return [];
      return data.map(item=>{
        try{return extract(accessor(item))}
        catch(error){return 'ACCESSOR_ERROR:'+String(error?.message||error)}
      });
    };
    return {
      points:read('pointsData','pointLabel'),
      arcs:read('arcsData','arcLabel'),
      html:read('htmlElementsData','htmlElement',node=>String(node?.textContent??'')),
      text:read('labelsData','labelText')
    };
  });
  const all=Object.values(labels).flat();
  expect(labels.points.length).toBeGreaterThan(0);
  expect(all.some(value=>value.trim().length>0)).toBeTruthy();
  for(const value of all){
    expect(value).not.toContain('[object');
    expect(value).not.toContain('undefined/195');
    expect(value).not.toContain('ACCESSOR_ERROR:');
  }
  await expect(page.locator('body')).not.toContainText('[object');
  await expect(page.locator('body')).not.toContainText('undefined/195');
  await expect(page.locator('body')).not.toContainText(/\bundefined\b/i);
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

test('production root is the public multi-trip homepage',async({page},testInfo)=>{
  test.setTimeout(120000);
  const errors=capturePageErrors(page);
  await open(page,'/?lang=en');
  await expect(page.locator('body')).toHaveClass(/platform-home/,{timeout:20000});
  await expect(page.locator('#platformHome')).toBeVisible();
  await expect(page.locator('#platformHomeResults .platform-home-card')).toHaveCount(5);
  await expect(page.locator('#platformHome')).toContainText('Explore extraordinary journeys worldwide.');
  await expect(page.locator('#platformHome')).not.toContainText('[object');
  await expect(page.locator('#platformHome')).not.toContainText(/\bundefined\b/i);
  const overflow=await page.evaluate(()=>({x:window.scrollX,app:document.querySelector('#app')?.scrollLeft||0}));
  expect(overflow).toEqual({x:0,app:0});
  expect(errors).toEqual([]);
  await page.screenshot({path:testInfo.outputPath('production-home.png'),fullPage:false,animations:'disabled'});
});

test('production flagship preserves the 195/194 shell invariants at its explicit trip URL',async({page,isMobile},testInfo)=>{
  test.setTimeout(120000);
  const errors=capturePageErrors(page);
  await open(page,'/?trip=world-195&lang=en');
  await expect(page.locator('body')).not.toHaveClass(/platform-home|platform-regional-trip/);
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


test('every published regional trip keeps localized labels object-safe',async({page,request},testInfo)=>{
  test.setTimeout(180000);
  const errors=capturePageErrors(page);
  const response=await request.get('/data/platform/trips.json');
  expect(response.ok()).toBeTruthy();
  const catalog=await response.json();
  const regional=catalog.trips.filter(item=>item.renderer==='regional-globe');
  expect(regional.length).toBeGreaterThanOrEqual(4);
  for(const item of regional){
    await open(page,`/?trip=${encodeURIComponent(item.id)}&lang=de`);
    await expectRegional(page);
    await expectRegionalTooltipIsolation(page);
    await page.screenshot({path:testInfo.outputPath(`regional-${item.id}.png`),fullPage:false,animations:'disabled'});
  }
  expect(errors).toEqual([]);
});
