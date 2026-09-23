const LOCAL_PREVIEW=['127.0.0.1','localhost','::1'].includes(self.location.hostname);
const CACHE='one-world-route-network-first-20260923c';
const MIGRATION_CACHE=/^one-world-route-(regional-hardening|homepage|utility-readiness|compare-calendar)-/;
const SHELL=[
  '/index.html',
  '/core.bundle.css',
  '/features.bundle.css',
  '/core.bundle.js',
  '/features.bundle.js',
  '/manifest.webmanifest',
  '/icon.svg'
];

const isFreshApplicationResource=pathname=>
  pathname==='/'||
  pathname==='/index.html'||
  pathname==='/core.bundle.css'||
  pathname==='/features.bundle.css'||
  pathname==='/core.bundle.js'||
  pathname==='/features.bundle.js'||
  pathname==='/manifest.webmanifest'||
  pathname.startsWith('/data/');

const isLiveOnly=pathname=>/\/(actual-progress|media|changelog)\.json$/.test(pathname);

async function remember(request,response){
  if(response?.ok){
    const cache=await caches.open(CACHE);
    await cache.put(request,response.clone());
  }
  return response;
}

async function networkFirst(request,{fallback}={}){
  try{
    const response=await fetch(request,{cache:'no-store'});
    return remember(request,response);
  }catch(error){
    const cached=await caches.match(request);
    if(cached)return cached;
    if(fallback){
      const fallbackResponse=await caches.match(fallback);
      if(fallbackResponse)return fallbackResponse;
    }
    throw error;
  }
}

async function staleWhileRevalidate(request){
  const cached=await caches.match(request);
  const network=fetch(request).then(response=>remember(request,response)).catch(()=>null);
  return cached||(await network)||Response.error();
}

self.addEventListener('install',event=>{
  event.waitUntil(
    (LOCAL_PREVIEW
      ?Promise.resolve()
      :caches.open(CACHE).then(cache=>cache.addAll(SHELL))
    ).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    const needsLegacyRefresh=keys.some(key=>MIGRATION_CACHE.test(key));
    await Promise.all(keys.filter(key=>LOCAL_PREVIEW||key!==CACHE).map(key=>caches.delete(key)));
    if(LOCAL_PREVIEW){
      await self.registration.unregister();
      return;
    }
    await self.clients.claim();

    if(needsLegacyRefresh){
      const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
      await Promise.all(clients.map(client=>{
        try{return client.navigate(client.url)}
        catch{return null}
      }));
    }
  })());
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  if(LOCAL_PREVIEW||event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(/tile\.openstreetmap\.org|tiles\.mapterhorn\.com|download\.mapterhorn\.com/.test(url.hostname))return;
  if(url.origin!==self.location.origin)return;

  if(isLiveOnly(url.pathname)){
    event.respondWith(fetch(event.request,{cache:'no-store'}));
    return;
  }

  if(event.request.mode==='navigate'){
    event.respondWith(networkFirst(event.request,{fallback:'/index.html'}));
    return;
  }

  if(isFreshApplicationResource(url.pathname)){
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request));
});
