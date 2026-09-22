const LOCAL_PREVIEW=['127.0.0.1','localhost','::1'].includes(self.location.hostname);
const CACHE='one-world-route-platform-live-data-20260922a';
const CORE=[
  '/',
  '/index.html',
  '/core.bundle.css',
  '/features.bundle.css',
  '/core.bundle.js',
  '/features.bundle.js',
  '/manifest.webmanifest',
  '/icon.svg',
  '/data/public-route.json',
  '/data/country-centroids.json',
  '/data/route-waypoints.json',
  '/data/flight-geometries.json',
  '/data/operational-movements.json',
  '/data/platform/trip-schema.json',
  '/data/platform/traveller-context-schema.json',
  '/data/platform/traveller-rule-schema.json'
];

const isLiveData=pathname=>
  /\/(actual-progress|media|changelog)\.json$/.test(pathname) ||
  pathname==='/data/platform/trips.json' ||
  /^\/data\/platform\/trips\/[^/]+\.json$/.test(pathname);

async function networkFirst(request){
  try{
    const response=await fetch(request);
    if(response.ok){
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(request,copy));
    }
    return response;
  }catch(error){
    const cached=await caches.match(request);
    if(cached)return cached;
    throw error;
  }
}

self.addEventListener('install',event=>{
  event.waitUntil(
    (LOCAL_PREVIEW?Promise.resolve():caches.open(CACHE).then(cache=>cache.addAll(CORE)))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>LOCAL_PREVIEW||key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>LOCAL_PREVIEW?self.registration.unregister():true)
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(LOCAL_PREVIEW||event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(/tile\.openstreetmap\.org|tiles\.mapterhorn\.com|download\.mapterhorn\.com/.test(url.hostname))return;
  if(url.origin!==location.origin)return;

  if(isLiveData(url.pathname)){
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(hit=>
      hit ||
      fetch(event.request)
        .then(response=>{
          if(response.ok){
            const copy=response.clone();
            caches.open(CACHE).then(cache=>cache.put(event.request,copy));
          }
          return response;
        })
        .catch(()=>caches.match('/index.html'))
    )
  );
});
