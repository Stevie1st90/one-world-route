import {createHash} from 'node:crypto';
export const STYLE_VERSION='topographic-editorial-v1';
export const RENDERER_VERSION='local-relief-v1';
export const RATIOS={landscape:{width:1200,height:675},portrait:{width:800,height:1000},vertical:{width:900,height:1600}};
export const palette={europe:'#67c9ef',asia:'#bca0ed',africa:'#e7b46a','north-america':'#79adc9','south-america':'#7bc6a1',oceania:'#72d2cf',polar:'#c1def1',global:'#bdd0e1'};
export const hash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
export const wrap=x=>((x+180)%360+360)%360-180;
export const valid=p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite)&&Math.abs(p[1])<=90;
export function circularBounds(points){
  if(!points.length)throw Error('No route coordinates');
  const lons=points.map(p=>((p[0]%360)+360)%360).sort((a,b)=>a-b);
  let gap=-1,start=0;
  for(let i=0;i<lons.length;i++){const next=i+1<lons.length?lons[i+1]:lons[0]+360,g=next-lons[i];if(g>gap){gap=g;start=next%360;}}
  const span=360-gap,west=wrap(start),east=west+span;
  return {west,east,south:Math.min(...points.map(p=>p[1])),north:Math.max(...points.map(p=>p[1])),longitudeSpan:span,datelineCrossing:east>180};
}
export const unwrap=(lon,b)=>{const d=(((lon-b.west)%360)+360)%360;return b.west+(d>360-1e-8?0:d);};
const region=c=>c?.region==='Americas'?(/South/.test(c.subregion)?'south-america':'north-america'):(c?.region||'global').toLowerCase();
export function extractRoute(meta,trip,deps={}){
  const places=new Map((trip.places||[]).map(p=>[p.id,p])),stops=new Map((trip.stops||[]).map(s=>[s.id,s]));
  const countriesByName=new Map((deps.countries||[]).map(c=>[c.name,c]));
  const countriesByCode=new Map((deps.countries||[]).map(c=>[c.cca2,c]));
  const geography=trip.geography?.countries||[...new Set([...(trip.countries||[]).map(c=>countriesByName.get(c.name)?.cca2),...(trip.places||[]).map(p=>p.countryCode)].filter(Boolean))];
  const regions=[...new Set(geography.map(c=>region(countriesByCode.get(c))).filter(r=>palette[r]&&r!=='global'))];
  const defaultRegion=(meta.discovery?.regions||[]).find(r=>palette[r])||regions[0]||'global';
  const lines=[];let detailed=0,schematic=0;
  for(const s of trip.segments||[]){
    const a=places.get(stops.get(s.fromStopId)?.placeId),b=places.get(stops.get(s.toStopId)?.placeId);
    let coords=s.geometry?.coordinates||s.coordinates;
    let kind='segment-geometry';
    if(!Array.isArray(coords)||!coords.every(valid)){
      if(a?.coordinates&&b?.coordinates){coords=[[a.coordinates.lng,a.coordinates.lat],[b.coordinates.lng,b.coordinates.lat]];kind='stop-connector';}
      else {coords=deps.flights?.geometries?.[s.id]?.coordinates||deps.waypoints?.[s.id];kind=deps.flights?.geometries?.[s.id]?'airport-connector':'route-waypoints';}
    }
    if(!Array.isArray(coords)||coords.length<2||!coords.every(valid)){
      const from=countriesByName.get(s.from),to=countriesByName.get(s.to);
      if(from&&to){coords=[[from.lng,from.lat],[to.lng,to.lat]];kind='country-centroid-connector';}
      else throw Error(meta.id+': missing geometry for segment '+s.id);
    }
    const fromRegion=region(countriesByCode.get(a?.countryCode)||countriesByName.get(s.from))||defaultRegion;
    const toRegion=region(countriesByCode.get(b?.countryCode)||countriesByName.get(s.to))||defaultRegion;
    if(kind==='segment-geometry'||kind==='route-waypoints'&&coords.length>2)detailed++;else schematic++;
    lines.push({id:s.id,coordinates:coords.map(p=>p.slice(0,2)),kind,color:palette[fromRegion]||palette[defaultRegion],endColor:palette[toRegion]||palette[defaultRegion],schematic:kind!=='segment-geometry'&&!(kind==='route-waypoints'&&coords.length>2)});
  }
  // Intracountry operational geometry supplements, never increments international legs.
  if(!trip.places&&(trip.countries||[]).length){
    for(const m of deps.movements?.movements||[])if(Array.isArray(m.coordinates)&&m.coordinates.length>1&&m.coordinates.every(valid))lines.push({id:m.id,coordinates:m.coordinates,kind:'operational-connector',color:palette[region(countriesByName.get(m.country))]||palette.global,endColor:palette[region(countriesByName.get(m.country))]||palette.global,schematic:true});
  }
  const stopPoints=(trip.stops||[]).map(s=>places.get(s.placeId)?.coordinates).filter(p=>Number.isFinite(p?.lng)&&Number.isFinite(p?.lat)).map(p=>[p.lng,p.lat]);
  const all=[...lines.flatMap(l=>l.coordinates),...stopPoints];
  if(!all.length)throw Error(meta.id+': no route geometry');
  const bounds=circularBounds(all),spanKm=Math.max(bounds.longitudeSpan*111.2*Math.max(.1,Math.cos((bounds.north+bounds.south)/2*Math.PI/180)),(bounds.north-bounds.south)*111.2);
  const scope=bounds.longitudeSpan>250||regions.length>=4&&spanKm>10000?'GLOBAL':spanKm>6500||bounds.north-bounds.south>60?'CONTINENTAL':spanKm<80?'LOCAL':spanKm<450?'REGIONAL':geography.length===1?'NATIONAL':'MULTI-COUNTRY';
  const markers=stopPoints.length?stopPoints:lines.filter(l=>l.kind!=='operational-connector').flatMap(l=>[l.coordinates[0],l.coordinates.at(-1)]);
  return {lines,markers,bounds,scope,countries:geography,regions,spanKm,detailed,schematic};
}
export function cameraFit(route,ratio){
  const {width,height}=RATIOS[ratio],b=route.bounds;
  const padding={left:width*.09,right:width*.09,top:height*(ratio==='landscape'?.17:.18),bottom:height*(ratio==='vertical'?.38:ratio==='portrait'?.22:.13)};
  const cos=Math.max(.15,Math.cos((b.north+b.south)/2*Math.PI/180));
  const xSpan=Math.max(b.longitudeSpan*cos,.08),ySpan=Math.max(b.north-b.south,.08);
  const scale=Math.min((width-padding.left-padding.right)/xSpan,(height-padding.top-padding.bottom)/ySpan);
  const cx=(padding.left+width-padding.right)/2,cy=(padding.top+height-padding.bottom)/2;
  return {width,height,padding,cos,scale,cx,cy,centerLng:(b.west+b.east)/2,centerLat:(b.south+b.north)/2,zoom:Math.max(0,Math.log2(scale*360/512))};
}
export const project=(p,route,c)=>[c.cx+(unwrap(p[0],route.bounds)-c.centerLng)*c.cos*c.scale,c.cy-(p[1]-c.centerLat)*c.scale];
