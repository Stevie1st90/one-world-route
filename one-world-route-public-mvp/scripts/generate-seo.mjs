import {readFile,writeFile} from 'node:fs/promises';
const route=JSON.parse(await readFile(new URL('../data/public-route.json',import.meta.url),'utf8'));
const geo=JSON.parse(await readFile(new URL('../data/country-centroids.json',import.meta.url),'utf8'));
const platform=JSON.parse(await readFile(new URL('../data/platform/trips.json',import.meta.url),'utf8'));
const langs=['en','de','it','es','fr','pt'];
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
const tripGroup=t=>{
  const alternates=[...langs.map(lang=>({lang,url:base+'/'+lang+'/trip/'+t.slug})),{lang:'x-default',url:base+'/trip/'+t.slug}];
  const entries=[base+'/trip/'+t.slug,...langs.map(lang=>base+'/'+lang+'/trip/'+t.slug)];
  return entries.map(url=>'  <url><loc>'+xmlEsc(url)+'</loc>'+alternates.map(a=>'<xhtml:link rel="alternate" hreflang="'+a.lang+'" href="'+xmlEsc(a.url)+'"/>').join('')+'</url>').join('\n');
};
const normalXml=[...new Set(normal)].map(u=>'  <url><loc>'+xmlEsc(u)+'</loc></url>').join('\n');
const tripXml=platform.trips.map(tripGroup).join('\n');
const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'+normalXml+'\n'+tripXml+'\n</urlset>\n';
await writeFile(new URL('../sitemap.xml',import.meta.url),xml);
console.log('Generated',new Set([...normal,...tripUrls]).size,'SEO URLs in',langs.length,'trip languages');
