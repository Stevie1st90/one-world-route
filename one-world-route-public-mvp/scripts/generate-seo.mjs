import {readFile,writeFile} from 'node:fs/promises';
const route=JSON.parse(await readFile(new URL('../data/public-route.json',import.meta.url),'utf8'));
const geo=JSON.parse(await readFile(new URL('../data/country-centroids.json',import.meta.url),'utf8'));
const platform=JSON.parse(await readFile(new URL('../data/platform/trips.json',import.meta.url),'utf8'));
const display=new Intl.DisplayNames(['en'],{type:'region'}),gm=new Map(geo.map(c=>[c.name,c]));
const en=n=>{const c=gm.get(n);try{return c?.cca2?display.of(c.cca2):n}catch{return n}};
const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const base='https://one-world-route.vercel.app';
const urls=[
  base+'/',
  ...route.segments.map(s=>base+'/route/'+s.id+'-'+slug(en(s.from))+'-'+slug(en(s.to))),
  ...route.countries.map(c=>base+'/country/'+slug(en(c.name))),
  ...platform.trips.map(t=>base+'/trip/'+t.slug)
];
const unique=[...new Set(urls)];
const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+unique.map(u=>'  <url><loc>'+u+'</loc></url>').join('\n')+'\n</urlset>\n';
await writeFile(new URL('../sitemap.xml',import.meta.url),xml);
console.log('Generated',unique.length,'SEO URLs');
