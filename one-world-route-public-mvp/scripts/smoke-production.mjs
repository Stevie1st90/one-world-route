const base=String(process.env.BASE_URL||'https://one-world-route.vercel.app').replace(/\/$/,'');
const retries=Number(process.env.SMOKE_RETRIES||18);
const interval=Number(process.env.SMOKE_INTERVAL_MS||10000);
const expected=['world-195','italy-grand-tour','western-mediterranean-cruise-loop','southern-europe-road-trip','central-europe-rail-journey'];

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const fail=message=>{throw new Error(message)};

async function fetchText(path){
  const res=await fetch(base+path,{headers:{'user-agent':'one-world-route-production-smoke/1.0'},redirect:'follow'});
  if(!res.ok)fail(path+' returned HTTP '+res.status);
  return res.text();
}
async function fetchJson(path){return JSON.parse(await fetchText(path));}

async function check(){
  const html=await fetchText('/');
  if(!html.includes('ONE WORLD ROUTE'))fail('Production HTML marker missing');
  if(!html.includes('core.bundle.css')||!html.includes('features.bundle.js'))fail('Production bundle references missing');

  const catalog=await fetchJson('/data/platform/trips.json');
  const ids=new Set((catalog.trips||[]).map(item=>item.id));
  for(const id of expected)if(!ids.has(id))fail('Production catalog missing '+id);
  const flagship=(catalog.trips||[]).find(item=>item.id==='world-195');
  if(flagship?.metrics?.countries!==195||flagship?.metrics?.internationalLegs!==194)fail('Flagship 195/194 invariants changed');

  const regional=(catalog.trips||[]).filter(item=>item.renderer==='regional-globe');
  if(regional.length<4)fail('Expected at least four reusable regional trips');
  for(const item of regional){
    const path='/'+String(item.dataset||'').replace(/^\.\//,'');
    const trip=await fetchJson(path);
    if(trip.id!==item.id||trip.slug!==item.slug)fail('Catalog/dataset mismatch for '+item.id);
    if((trip.stops||[]).length!==item.metrics?.stops)fail('Stop metric mismatch for '+item.id);
  }

  const rail=await fetchJson('/data/platform/trips/central-europe-rail-journey.json');
  if((rail.segments||[]).length!==9)fail('Rail proof must expose 9 segments');
  if((rail.segments||[]).some(segment=>segment.transport?.mode!=='rail'))fail('Rail proof contains a non-rail segment');

  const features=await fetchText('/features.bundle.js');
  if(!features.includes('.pointLabel(pointLabel)'))fail('Regional tooltip isolation is not in the deployed feature bundle');

  const coreCss=await fetchText('/core.bundle.css');
  if(!coreCss.includes('overflow:hidden;overflow:clip'))fail('Mobile shell clipping fix is not in the deployed core CSS');

  const share=await fetchText('/trip/central-europe-rail-journey?lang=de');
  if(!/Mitteleuropa|Central Europe Rail Journey/i.test(share))fail('Rail trip share route did not render expected metadata');

  return {trips:(catalog.trips||[]).length,regional:regional.length};
}

let lastError;
for(let attempt=1;attempt<=retries;attempt++){
  try{
    const result=await check();
    console.log(`Production smoke passed on attempt ${attempt}: ${result.trips} trips, ${result.regional} regional trips · ${base}`);
    process.exit(0);
  }catch(error){
    lastError=error;
    console.warn(`Production smoke attempt ${attempt}/${retries} failed: ${error.message}`);
    if(attempt<retries)await sleep(interval);
  }
}
console.error('Production smoke failed:',lastError?.stack||lastError);
process.exit(1);
