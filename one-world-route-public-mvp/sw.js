const CACHE='one-world-route-v2-20260919';
const CORE=['/','/index.html','/app.bundle.css','/app.bundle.js','/manifest.webmanifest','/icon.svg','/data/public-route.json','/data/country-centroids.json','/data/route-waypoints.json','/data/actual-progress.json','/data/media.json','/data/changelog.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(/tile\.openstreetmap\.org|tiles\.mapterhorn\.com|download\.mapterhorn\.com/.test(u.hostname))return;
  if(u.origin!==location.origin)return;
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;}).catch(()=>caches.match('/index.html'))));
});