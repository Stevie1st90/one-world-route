const route=require('../data/public-route.json');
const geo=require('../data/country-centroids.json');
const platform=require('../data/platform/trips.json');
const display=new Intl.DisplayNames(['en'],{type:'region'});
const byName=new Map(geo.map(c=>[c.name,c]));
const en=n=>{const c=byName.get(n);try{return c?.cca2?display.of(c.cca2):n}catch{return n}};
const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const localized=(v,lang='en')=>typeof v==='string'?v:(v?.[lang]||v?.en||Object.values(v||{})[0]||'');
module.exports=(req,res)=>{
  const type=String(req.query.type||''),origin='https://one-world-route.vercel.app';
  let title='ONE WORLD ROUTE — routes without borders',desc='Explore world journeys, round trips, road trips, rail routes, cruises and more.',target='/',canonical=origin+'/';
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
      const name=localized(trip.title),sub=localized(trip.subtitle);
      title=name+' — ONE WORLD ROUTE';desc=sub||'Explore this route on ONE WORLD ROUTE.';
      target=trip.id===platform.defaultTripId?'/':'/?trip='+encodeURIComponent(trip.id);
      canonical=origin+'/trip/'+trip.slug;
    }
  }
  res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','public, max-age=300, s-maxage=86400');
  res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><meta name="description" content="'+esc(desc)+'"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(desc)+'"><meta property="og:type" content="website"><meta property="og:url" content="'+esc(canonical)+'"><meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="'+esc(canonical)+'"><meta http-equiv="refresh" content="0;url='+esc(target)+'"></head><body style="background:#05070d;color:#fff;font-family:system-ui"><a href="'+esc(target)+'">Open '+esc(title)+'</a><script>location.replace('+JSON.stringify(target)+')</script></body></html>');
};
