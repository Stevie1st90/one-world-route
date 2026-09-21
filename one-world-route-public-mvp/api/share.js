const route=require('../data/public-route.json');
const geo=require('../data/country-centroids.json');
const platform=require('../data/platform/trips.json');

const SUPPORTED_LANGS=['en','de','it','es','fr','pt'];
const display=new Intl.DisplayNames(['en'],{type:'region'});
const byName=new Map(geo.map(c=>[c.name,c]));
const en=n=>{const c=byName.get(n);try{return c?.cca2?display.of(c.cca2):n}catch{return n}};
const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
const localized=(v,lang='en')=>typeof v==='string'?v:(v?.[lang]||v?.en||Object.values(v||{})[0]||'');
const safeLang=v=>SUPPORTED_LANGS.includes(String(v||'').toLowerCase())?String(v).toLowerCase():'en';
const tripTarget=(trip,lang)=>{
  const p=new URLSearchParams();
  if(trip.id!==platform.defaultTripId)p.set('trip',trip.id);
  p.set('lang',lang);
  return '/?'+p.toString();
};
const alternateLinks=(origin,trip)=>[
  ...SUPPORTED_LANGS.map(lang=>'<link rel="alternate" hreflang="'+lang+'" href="'+esc(origin+'/'+lang+'/trip/'+trip.slug)+'">'),
  '<link rel="alternate" hreflang="x-default" href="'+esc(origin+'/trip/'+trip.slug)+'">'
].join('');
const tripJsonLd=(trip,lang,url)=>JSON.stringify({
  '@context':'https://schema.org',
  '@type':'TouristTrip',
  name:localized(trip.title,lang),
  description:localized(trip.subtitle,lang),
  url,
  touristType:trip.kind==='cruise'?'Cruise tourism':trip.kind==='world'?'Long-term world travel':trip.kind==='round-trip'?'Round trip':'Travel itinerary'
}).replace(/</g,'\\u003c');

module.exports=(req,res)=>{
  const type=String(req.query.type||''),origin='https://one-world-route.vercel.app';
  const requestedLang=String(req.query.lang||'').toLowerCase(),lang=safeLang(requestedLang);
  let htmlLang='en',title='ONE WORLD ROUTE — routes without borders',desc='Explore world journeys, round trips, road trips, rail routes, cruises and more.',target='/',canonical=origin+'/',alternates='',jsonLd='';
  if(type==='route'){
    const id=parseInt(String(req.query.id||''),10),s=route.segments.find(x=>Number(x.id)===id);
    if(s){const a=en(s.from),b=en(s.to);title=a+' → '+b+' — ONE WORLD ROUTE';desc='Route leg '+id+' of 194 · '+a+' to '+b+'. Explore the continuous 195-country journey.';target='/?segment='+id;canonical=origin+'/route/'+id+'-'+slug(a)+'-'+slug(b);}
  }else if(type==='country'){
    const wanted=slug(req.query.slug||'');
    const c=route.countries.find(x=>slug(en(x.name))===wanted||slug(x.name)===wanted);
    if(c){const name=en(c.name);title=name+' — ONE WORLD ROUTE';desc='Country '+c.number+' of 195 on the flagship ONE WORLD ROUTE journey. Explore arrival, onward route and public planning context.';target='/?country='+encodeURIComponent(c.name);canonical=origin+'/country/'+slug(name);}
  }else if(type==='trip'){
    const wanted=slug(req.query.slug||req.query.id||'');
    const trip=platform.trips.find(x=>slug(x.slug)===wanted||slug(x.id)===wanted);
    if(trip){
      htmlLang=lang;
      const name=localized(trip.title,lang),sub=localized(trip.subtitle,lang);
      title=name+' — ONE WORLD ROUTE';
      desc=sub||'Explore this route on ONE WORLD ROUTE.';
      target=tripTarget(trip,lang);
      canonical=requestedLang&&SUPPORTED_LANGS.includes(requestedLang)?origin+'/'+lang+'/trip/'+trip.slug:origin+'/trip/'+trip.slug;
      alternates=alternateLinks(origin,trip);
      jsonLd='<script type="application/ld+json">'+tripJsonLd(trip,lang,canonical)+'</script>';
    }
  }
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Content-Language',htmlLang);
  res.setHeader('Cache-Control','public, max-age=300, s-maxage=86400');
  res.end('<!doctype html><html lang="'+esc(htmlLang)+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><meta name="description" content="'+esc(desc)+'"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(desc)+'"><meta property="og:type" content="website"><meta property="og:url" content="'+esc(canonical)+'"><meta property="og:locale" content="'+esc(htmlLang)+'"><meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="'+esc(canonical)+'">'+alternates+jsonLd+'</head><body style="background:#05070d;color:#fff;font-family:system-ui;max-width:720px;margin:0 auto;padding:48px 24px"><main><p>ONE WORLD ROUTE</p><h1>'+esc(title)+'</h1><p>'+esc(desc)+'</p><p><a style="color:#8fe9ff" href="'+esc(target)+'">Open interactive route →</a></p></main><script>location.replace('+JSON.stringify(target)+')</script><noscript><p><a href="'+esc(target)+'">Open interactive route</a></p></noscript></body></html>');
};
