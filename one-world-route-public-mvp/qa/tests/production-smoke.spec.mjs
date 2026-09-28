import {test,expect} from '@playwright/test';

function capturePageErrors(page){
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  return errors;
}

async function open(page,path){
  await page.goto(path,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#app')).toBeVisible({timeout:15000});
}

test.describe.configure({mode:'parallel'});

test('production critical public surfaces boot cleanly',async({page,request,isMobile})=>{
  test.setTimeout(60000);
  const errors=capturePageErrors(page);

  const catalogResponse=await request.get('/data/platform/trips.json');
  expect(catalogResponse.ok()).toBeTruthy();
  const catalog=await catalogResponse.json();
  const regional=catalog.trips.find(item=>item.renderer==='regional-globe');
  expect(catalog.trips.find(item=>item.id===catalog.defaultTripId)).toBeTruthy();
  expect(regional).toBeTruthy();

  await open(page,'/?lang=en');
  await expect(page.locator('body')).toHaveClass(/platform-home/,{timeout:15000});
  await expect(page.locator('#platformHomeResults .platform-home-card')).toHaveCount(catalog.trips.length);
  await expect(page.locator('#platformHome')).not.toContainText('[object');
  await expect(page.locator('#platformHome')).not.toContainText(/\bundefined\b/i);

  await open(page,'/?trip=world-195&lang=en');
  await expect(page.locator('body')).not.toHaveClass(/platform-home|platform-regional-trip/);
  await expect(page.locator('#routeRange')).toHaveAttribute('max','194');
  await expect(page.locator('#filterCount')).toContainText('194');

  const [routeResponse,readinessResponse,queueResponse]=await Promise.all([
    request.get('/data/public-route.json'),
    request.get('/data/flagship-readiness.json'),
    request.get('/data/flagship-operations-queue.json')
  ]);
  expect(routeResponse.ok()).toBeTruthy();
  expect(readinessResponse.ok()).toBeTruthy();
  expect(queueResponse.ok()).toBeTruthy();

  const route=await routeResponse.json();
  const readiness=await readinessResponse.json();
  const queue=await queueResponse.json();
  expect(route.segments).toHaveLength(194);
  expect(route.countries).toHaveLength(195);
  expect(route.segments[96]).toMatchObject({id:97,from:'China',to:'Nordkorea'});
  expect(route.segments[97]).toMatchObject({id:98,from:'Nordkorea',to:'Südkorea'});
  expect(route.segments.at(-1)).toMatchObject({id:194,from:'Vatikanstadt',to:'Malta'});
  expect(route.postTripReturn).toMatchObject({from:'Malta',to:'Deutschland',countedInInternationalLegs:false});
  expect(readiness.topology.canonical).toBe(true);
  expect(readiness.structural.countriesInLegEndpoints).toBe(195);
  expect(queue.summary.total).toBeGreaterThan(0);

  await open(page,'/?trip='+encodeURIComponent(regional.id)+'&lang=en');
  await expect(page.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:15000});
  await expect.poll(()=>page.locator('.platform-stop').count(),{timeout:15000}).toBeGreaterThan(1);
  await expect(page.locator('body')).not.toContainText('[object');
  await expect(page.locator('body')).not.toContainText(/\bundefined\b/i);
  await expect(page.locator('.platform-journey-guide')).toHaveCount(1);
  await page.locator('[data-journey-stop-index="0"]').evaluate(node=>node.click());
  await expect(page.locator('.platform-stop-experience')).toHaveCount(1);
  await expect(page.locator('.platform-stop-experience')).toContainText('What to expect');

  if(isMobile){
    const overflow=await page.evaluate(()=>({x:window.scrollX,app:document.querySelector('#app')?.scrollLeft||0}));
    expect(overflow).toEqual({x:0,app:0});
  }
  expect(errors).toEqual([]);
});

test('production delivery policy and service worker stay live',async({page,request,isMobile})=>{
  test.skip(isMobile,'Delivery headers and service-worker activation only need one live browser project.');
  test.setTimeout(45000);

  const [root,sw,bundle]=await Promise.all([
    request.get('/',{headers:{'Cache-Control':'no-cache'}}),
    request.get('/sw.js',{headers:{'Cache-Control':'no-cache'}}),
    request.get('/features.bundle.js',{headers:{'Cache-Control':'no-cache'}})
  ]);
  expect(root.ok()).toBeTruthy();
  expect(sw.ok()).toBeTruthy();
  expect(bundle.ok()).toBeTruthy();

  expect(root.headers()['cache-control']||'').toMatch(/no-store|no-cache|max-age=0/);
  expect(sw.headers()['cache-control']||'').toMatch(/no-store/);
  expect(bundle.headers()['cache-control']||'').toMatch(/max-age=0|no-cache|no-store/);

  await open(page,'/?lang=en');
  const registration=await page.evaluate(async()=>{
    if(!('serviceWorker' in navigator))return null;
    const ready=await Promise.race([
      navigator.serviceWorker.ready,
      new Promise(resolve=>setTimeout(()=>resolve(null),15000))
    ]);
    return ready?{scope:ready.scope,active:ready.active?.scriptURL||''}:null;
  });
  expect(registration).not.toBeNull();
  expect(registration.scope).toBe(new URL('/',page.url()).origin+'/');
  expect(registration.active).toContain('/sw.js');
});
