import {test,expect} from '@playwright/test';

const localized=(locales,value)=>Object.fromEntries(locales.map(locale=>[locale,value]));

test('internal trip builder edits and previews a draft in the real engine',async({page,request,isMobile},testInfo)=>{
  test.setTimeout(120000);
  const projectSlug=testInfo.project.name.replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const slug='qa-builder-'+projectSlug;

  const bootstrap=await request.get('/api/bootstrap').then(r=>r.json());
  const locales=bootstrap.supportedLocales;
  const created=await request.post('/api/drafts',{data:{slug,kind:'rail',days:4}});
  expect(created.ok()).toBeTruthy();
  const draft=await created.json();

  draft.trip.status='sourced-beta';
  draft.catalogEntry.status='sourced-beta';
  draft.trip.title=localized(locales,'QA Rail Draft');
  draft.trip.summary=localized(locales,'A browser-QA draft for the internal authoring pipeline.');
  draft.catalogEntry.title=localized(locales,'QA Rail Draft');
  draft.catalogEntry.subtitle=localized(locales,'4 days · 2 stops · QA');
  draft.catalogEntry.discovery={
    regions:['europe'],themes:['rail','qa'],modes:['rail'],durationBand:'7-14',featured:false,
    fit:{pace:'balanced',seasons:['multi-season'],party:['solo'],startRegion:'europe',accessibility:'standard-check'}
  };
  draft.trip.places=[
    {id:'qa-a',type:'city',countryCode:'DE',name:localized(locales,'QA City A'),coordinates:{lat:50.1,lng:8.6}},
    {id:'qa-b',type:'city',countryCode:'AT',name:localized(locales,'QA City B'),coordinates:{lat:48.2,lng:16.3}}
  ];
  draft.trip.stops=[
    {id:slug+'-stop-01',sequence:1,placeId:'qa-a',dayStart:1,dayEnd:2,nights:2},
    {id:slug+'-stop-02',sequence:2,placeId:'qa-b',dayStart:3,dayEnd:4,nights:2}
  ];
  draft.trip.sources=[{
    id:'qa-source',title:'QA source',issuer:'QA operator',issuerType:'official-operator',
    url:'https://example.com/qa',checkedAt:'2026-09-22',claims:['QA route evidence']
  }];
  draft.trip.segments=[{
    id:slug+'-leg-01',sequence:1,fromStopId:slug+'-stop-01',toStopId:slug+'-stop-02',
    transport:{mode:'rail',stages:[{mode:'rail',sourceIds:['qa-source']}]},
    planning:{durationMinutes:null,durationBasis:'live-timetable-required',distanceKm:null,cost:null},
    verification:{status:'current-check-required',lastVerified:null,sourceIds:['qa-source'],notes:'QA only'}
  }];
  draft.trip.extensions={rail:{scope:'rail-only',timetablePolicy:'live-operator-check',sourcePolicy:'official-operator',crossBorder:true}};

  const saved=await request.put('/api/drafts/'+slug,{data:draft});
  expect(saved.ok()).toBeTruthy();

  await page.goto('/');
  await expect(page.getByText('Internal Trip Builder')).toBeVisible();
  await page.locator('[data-slug="'+slug+'"]').click();
  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('#editorTitle')).toContainText('QA Rail Draft');

  const enRow=page.locator('.locale-row[data-locale="en"]');
  await enRow.locator('[data-local="title"]').fill('QA Rail Draft Updated');
  await page.locator('#saveBtn').click();
  await expect(page.locator('#dirtyBadge')).toBeHidden();

  await page.locator('#validateBtn').click();
  await expect(page.locator('#validationState')).toHaveText('pass');

  await page.locator('#previewBtn').click();
  await expect(page.locator('.tab[data-tab="preview"]')).toHaveClass(/active/);
  const frame=page.frameLocator('#previewFrame');
  await expect(frame.locator('body')).toHaveClass(/platform-regional-trip/,{timeout:30000});
  await expect(frame.locator('.platform-stop')).toHaveCount(2,{timeout:15000});
  await expect(frame.locator('.brand small')).toContainText('QA Rail Draft Updated');

  await page.screenshot({path:testInfo.outputPath('trip-builder-'+testInfo.project.name+'.png'),fullPage:false,animations:'disabled'});
  if(isMobile){
    const box=await page.locator('.topbar').boundingBox();
    expect(box).toBeTruthy();
    expect(box.x+box.width).toBeLessThanOrEqual(page.viewportSize().width+1);
  }
});
