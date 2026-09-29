import {readFile,writeFile} from 'node:fs/promises';
const route=JSON.parse(await readFile(new URL('../data/public-route.json',import.meta.url),'utf8'));
const geo=JSON.parse(await readFile(new URL('../data/country-centroids.json',import.meta.url),'utf8'));
const platform=JSON.parse(await readFile(new URL('../data/platform/trips.json',import.meta.url),'utf8'));
const collections=JSON.parse(await readFile(new URL('../data/platform/collections.json',import.meta.url),'utf8'));
const TAXONOMY_REGIONS=new Set(['europe','asia','africa','north-america','south-america','oceania','central-america']);
const taxonomyPages=()=>{
  const trips=(platform.trips||[]).filter(t=>t.id!==platform.defaultTripId);
  const pages=[];
  const push=(facet,value,count)=>{if(count>=2)pages.push({facet,value})};
  const counts=values=>values.reduce((m,v)=>(m.set(v,(m.get(v)||0)+1),m),new Map());
  for(const [value,count] of counts(trips.map(t=>t.kind).filter(Boolean)))push('kind',value,count);
  for(const [value,count] of counts(trips.flatMap(t=>(t.discovery?.regions||[]).filter(v=>TAXONOMY_REGIONS.has(v)))))push('region',value,count);
  for(const [value,count] of counts(trips.map(t=>t.discovery?.durationBand).filter(Boolean)))push('duration',value,count);
  return pages.sort((a,b)=>a.facet.localeCompare(b.facet)||a.value.localeCompare(b.value));
};
const langs=Array.isArray(platform.supportedLocales)&&platform.supportedLocales.length?platform.supportedLocales:['en'];
const display=new Intl.DisplayNames(['en'],{type:'region'}),gm=new Map(geo.map(c=>[c.name,c]));
const en=n=>{const c=gm.get(n);try{return c?.cca2?display.of(c.cca2):n}catch{return n}};
const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const base='https://one-world-route.vercel.app';
const xmlEsc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const normal=[
  base+'/',
  ...route.segments.map(s=>base+'/route/'+s.id+'-'+slug(en(s.from))+'-'+slug(en(s.to))),
  ...route.countries.map(c=>base+'/country/'+slug(en(c.name)))
];
const tripUrls=platform.trips.flatMap(t=>[base+'/trip/'+t.slug,...langs.map(lang=>base+'/'+lang+'/trip/'+t.slug)]);
const collectionUrls=(collections.collections||[]).flatMap(item=>[base+'/journeys/'+item.id,...langs.map(lang=>base+'/'+lang+'/journeys/'+item.id)]);
const taxonomy=taxonomyPages();
const taxonomyUrls=taxonomy.flatMap(item=>[base+'/discover/'+item.facet+'/'+item.value,...langs.map(lang=>base+'/'+lang+'/discover/'+item.facet+'/'+item.value)]);
const tripGroup=t=>{
  const alternates=[...langs.map(lang=>({lang,url:base+'/'+lang+'/trip/'+t.slug})),{lang:'x-default',url:base+'/trip/'+t.slug}];
  const entries=[base+'/trip/'+t.slug,...langs.map(lang=>base+'/'+lang+'/trip/'+t.slug)];
  return entries.map(url=>'  <url><loc>'+xmlEsc(url)+'</loc>'+alternates.map(a=>'<xhtml:link rel="alternate" hreflang="'+a.lang+'" href="'+xmlEsc(a.url)+'"/>').join('')+'</url>').join('\n');
};
const collectionGroup=item=>{
  const alternates=[...langs.map(lang=>({lang,url:base+'/'+lang+'/journeys/'+item.id})),{lang:'x-default',url:base+'/journeys/'+item.id}];
  const entries=[base+'/journeys/'+item.id,...langs.map(lang=>base+'/'+lang+'/journeys/'+item.id)];
  return entries.map(url=>'  <url><loc>'+xmlEsc(url)+'</loc>'+alternates.map(a=>'<xhtml:link rel="alternate" hreflang="'+a.lang+'" href="'+xmlEsc(a.url)+'"/>').join('')+'</url>').join('\n');
};
const taxonomyGroup=item=>{
  const alternates=[...langs.map(lang=>({lang,url:base+'/'+lang+'/discover/'+item.facet+'/'+item.value})),{lang:'x-default',url:base+'/discover/'+item.facet+'/'+item.value}];
  const entries=[base+'/discover/'+item.facet+'/'+item.value,...langs.map(lang=>base+'/'+lang+'/discover/'+item.facet+'/'+item.value)];
  return entries.map(url=>'  <url><loc>'+xmlEsc(url)+'</loc>'+alternates.map(a=>'<xhtml:link rel="alternate" hreflang="'+a.lang+'" href="'+xmlEsc(a.url)+'"/>').join('')+'</url>').join('\n');
};
const normalXml=[...new Set(normal)].map(u=>'  <url><loc>'+xmlEsc(u)+'</loc></url>').join('\n');
const tripXml=platform.trips.map(tripGroup).join('\n');
const collectionXml=(collections.collections||[]).map(collectionGroup).join('\n');
const taxonomyXml=taxonomy.map(taxonomyGroup).join('\n');
const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'+normalXml+'\n'+tripXml+'\n'+collectionXml+'\n'+taxonomyXml+'\n</urlset>\n';
await writeFile(new URL('../sitemap.xml',import.meta.url),xml);
console.log('Generated',new Set([...normal,...tripUrls,...collectionUrls,...taxonomyUrls]).size,'SEO URLs in',langs.length,'trip languages,',(collections.collections||[]).length,'collections and',taxonomy.length,'taxonomy pages');
