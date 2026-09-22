const LOCAL_PREVIEW=['127.0.0.1','localhost','::1'].includes(self.location.hostname);
const CACHE='one-world-route-network-first-20260922';
const SHELL=['/','/index.html','/core.bundle.css','/features.bundle.css','/core.bundle.js','/features.bundle.js','/manifest.webmanifest','/icon.svg'];

async function remember(request,response){
  if(response?.ok){
    const cache=await caches.open(CACHE);
    await cache.put(request,response.clone());
  }
  return response;
}

async function networkFirst(request){
  try{
    return await remember(request,await fetch(request));
  }catch(error){
    const cached=await caches.match(request);
    if(cached)return cached;
    if(request.mode==='navigate')return caches.match('/index.html');
    throw error;
  }
}

self.addEventListener('install',event=>{
  event.waitUntil(
    (LOCAL_PREVIEW?Promise.resolve():caches.open(CACHE).then(cache=>cache.addAll(SHELL)))
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
  event.respondWith(networkFirst(event.request));
});
