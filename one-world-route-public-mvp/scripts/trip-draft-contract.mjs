import {validatePlatformExtensions} from './platform-extension-validators.mjs';
import {deriveDiscoveryRegions,derivePrimaryRegion} from './country-region-model.mjs';
import {journeyArchetype,journeyArchetypes} from './journey-archetype-registry.mjs';
export {journeyArchetype,journeyArchetypes} from './journey-archetype-registry.mjs';

const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedModes=new Set(['walk','bicycle','road','car','motorcycle','bus','coach','rail','metro','tram','ground-transfer','rideshare','taxi','ferry','cruise','flight','helicopter','rail+ground','multimodal','other']);
const verificationStates=new Set(['current-check-required','verified','draft','illustrative']);
const durationBands=new Set(['7-14','15-30','31-89','90-plus']);
const paces=new Set(['relaxed','balanced','active']);
const seasons=new Set(['spring','summer','autumn','winter','multi-season']);
const parties=new Set(['solo','couples','friends','families']);
const accessibilities=new Set(['standard-check','operator-dependent','vehicle-dependent','complex-planning']);
export const publicationStatuses=new Set(['planned','sourced-beta','illustrative-template','editorial-preview']);

const clone=value=>JSON.parse(JSON.stringify(value));
const localized=(locales,value)=>Object.fromEntries(locales.map(locale=>[locale,value]));
const durationBand=days=>days==null?'7-14':days<=14?'7-14':days<=30?'15-30':days<=89?'31-89':'90-plus';

export function scaffoldTripDraft({slug,kind,days,catalog}){
  const locales=Array.isArray(catalog?.supportedLocales)&&catalog.supportedLocales.length?catalog.supportedLocales:['en'];
  const human=String(slug||'').split('-').filter(Boolean).map(part=>part[0]?.toUpperCase()+part.slice(1)).join(' ');
  const normalizedDays=days===null||days===undefined||days===''?null:Number(days);
  const archetype=journeyArchetype(kind);
  const trip={
    schemaVersion:1,id:slug,slug,kind,status:'draft',
    defaultLocale:catalog?.defaultLocale||'en',supportedLocales:[...locales],
    title:localized(locales,human),summary:localized(locales,'TODO — editorial summary'),
    geography:{regions:[],countries:[]},
    planning:{days:normalizedDays,currency:null},
    maintenance:{tier:archetype.maintenanceTier,sourceReviewDays:archetype.reviewDays},
    routePolicy:archetype.routePolicy,
    rendering:{},places:[],stops:[],segments:[],chapters:[],
    travellerContext:{scope:[]},sources:[],extensions:{}
  };
  const catalogEntry={
    id:slug,slug,kind,status:'draft',renderer:'regional-globe',
    dataset:'./data/platform/trips/'+slug+'.json',
    title:localized(locales,human),subtitle:localized(locales,'TODO — discovery subtitle'),
    metrics:{},capabilities:archetype.capabilities,
    visual:{theme:archetype.visualTheme,mediaState:'art-directed'},
    discovery:{
      regions:['global'],themes:archetype.themes,modes:[archetype.mode],
      durationBand:durationBand(normalizedDays),featured:false,
      fit:{pace:'balanced',seasons:['multi-season'],party:['solo','couples','friends'],startRegion:'global',accessibility:archetype.accessibility}
    }
  };
  return {trip,catalogEntry,archetype};
}

export function parseRouteSkeletonText(text){
  const lines=String(text||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  if(lines.length<2)throw new Error('Route skeleton requires at least two stops');
  return lines.map((line,index)=>{
    const parts=line.split('|').map(value=>value.trim());
    if(parts.length!==5)throw new Error('Route skeleton line '+(index+1)+' must be: Place | CC | latitude | longitude | nights');
    const [name,countryCodeRaw,latRaw,lngRaw,nightsRaw]=parts;
    const countryCode=countryCodeRaw.toUpperCase(),lat=Number(latRaw),lng=Number(lngRaw),nights=Number(nightsRaw);
    if(!name)throw new Error('Route skeleton line '+(index+1)+' requires a place name');
    if(!/^[A-Z]{2}$/.test(countryCode))throw new Error('Route skeleton line '+(index+1)+' requires an ISO alpha-2 country code');
    if(!Number.isFinite(lat)||lat < -90||lat > 90)throw new Error('Route skeleton line '+(index+1)+' latitude is invalid');
    if(!Number.isFinite(lng)||lng < -180||lng > 180)throw new Error('Route skeleton line '+(index+1)+' longitude is invalid');
    if(!Number.isInteger(nights)||nights<1)throw new Error('Route skeleton line '+(index+1)+' nights must be a positive integer');
    return {name,countryCode,lat,lng,nights};
  });
}

export function buildRouteSkeleton({trip={},catalogEntry={},text='',mode}={}){
  const nextTrip=clone(trip||{}),nextEntry=clone(catalogEntry||{}),rows=parseRouteSkeletonText(text);
  const locales=Array.isArray(nextTrip.supportedLocales)&&nextTrip.supportedLocales.length?nextTrip.supportedLocales:Object.keys(nextTrip.title||{}).length?Object.keys(nextTrip.title):['en'];
  const selectedMode=String(mode||nextEntry.discovery?.modes?.[0]||journeyArchetype(nextTrip.kind).mode||'multimodal').trim();
  if(!allowedModes.has(selectedMode))throw new Error('Route skeleton uses unsupported mode '+selectedMode);
  let day=1;
  const places=[],stops=[];
  rows.forEach((row,index)=>{
    const number=String(index+1).padStart(2,'0'),placeId=nextTrip.slug+'-place-'+number,stopId=nextTrip.slug+'-stop-'+number;
    places.push({id:placeId,countryCode:row.countryCode,type:'city',name:localized(locales,row.name),coordinates:{lat:row.lat,lng:row.lng}});
    stops.push({id:stopId,sequence:index+1,placeId,dayStart:day,dayEnd:day+row.nights-1,nights:row.nights});
    day+=row.nights;
  });
  const segments=stops.slice(0,-1).map((stop,index)=>({
    id:nextTrip.slug+'-segment-'+String(index+1).padStart(2,'0'),sequence:index+1,fromStopId:stop.id,toStopId:stops[index+1].id,
    transport:{mode:selectedMode,stages:[{mode:selectedMode,sourceIds:[]}]},verification:{status:'draft',sourceIds:[]}
  }));
  nextTrip.places=places;nextTrip.stops=stops;nextTrip.segments=segments;nextTrip.chapters=[];
  nextTrip.planning={...(nextTrip.planning||{}),days:day-1};
  nextEntry.discovery={...(nextEntry.discovery||{}),modes:[selectedMode]};
  return normalizeDraftMetadata({trip:nextTrip,catalogEntry:nextEntry});
}

export function parseSegmentSelection(value,maxSequence){
  const tokens=String(value||'').split(',').map(token=>token.trim()).filter(Boolean);
  if(!tokens.length)throw new Error('Select at least one segment');
  const selected=new Set();
  for(const token of tokens){
    let start,end;
    if(/^\d+$/.test(token))start=end=Number(token);
    else{
      const match=token.match(/^(\d+)\s*-\s*(\d+)$/);
      if(!match)throw new Error('Invalid segment selection: '+token);
      start=Number(match[1]);end=Number(match[2]);
      if(start>end)throw new Error('Invalid descending segment range: '+token);
    }
    for(let sequence=start;sequence<=end;sequence++){
      if(sequence<1||Number.isFinite(Number(maxSequence))&&sequence>Number(maxSequence))throw new Error('Segment selection out of range: '+sequence);
      selected.add(sequence);
    }
  }
  return [...selected].sort((a,b)=>a-b);
}

export function attachEvidenceSource({trip={},catalogEntry={},source={},segments='',status='draft',notes=''}={}){
  const nextTrip=clone(trip||{}),nextEntry=clone(catalogEntry||{}),sourceId=String(source.id||'').trim();
  if(!slugPattern.test(sourceId))throw new Error('Evidence source ID must be a normalized slug');
  const normalizedSource={
    id:sourceId,title:String(source.title||'').trim(),issuer:String(source.issuer||'').trim(),issuerType:String(source.issuerType||'').trim(),
    url:String(source.url||'').trim(),checkedAt:String(source.checkedAt||'').trim(),claims:(Array.isArray(source.claims)?source.claims:[]).map(value=>String(value).trim()).filter(Boolean)
  };
  if(!normalizedSource.title||!normalizedSource.issuer||!normalizedSource.issuerType)throw new Error('Evidence source title, issuer and issuerType are required');
  if(!/^https:\/\//.test(normalizedSource.url))throw new Error('Evidence source requires an https URL');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(normalizedSource.checkedAt))throw new Error('Evidence source requires checkedAt as YYYY-MM-DD');
  const verificationStatus=String(status||'draft').trim();
  if(!verificationStates.has(verificationStatus))throw new Error('Unsupported verification status '+verificationStatus);
  const ordered=[...(nextTrip.segments||[])].sort((a,b)=>Number(a.sequence)-Number(b.sequence));
  if(!ordered.length)throw new Error('Add route segments before attaching evidence');
  const selected=parseSegmentSelection(segments,ordered.length),selectedSet=new Set(selected);
  const existing=(nextTrip.sources||[]).find(item=>item.id===sourceId);
  if(existing&&String(existing.url||'')!==normalizedSource.url)throw new Error('Evidence source ID already belongs to another URL');
  nextTrip.sources=[...(nextTrip.sources||[]).filter(item=>item.id!==sourceId),normalizedSource];
  nextTrip.segments=(nextTrip.segments||[]).map(segment=>{
    if(!selectedSet.has(Number(segment.sequence)))return segment;
    const verification={...(segment.verification||{}),status:verificationStatus,sourceIds:[...new Set([...(segment.verification?.sourceIds||[]),sourceId])]};
    if(verificationStatus!=='draft')verification.lastVerified=normalizedSource.checkedAt;
    if(String(notes||'').trim())verification.notes=String(notes).trim();
    return {...segment,verification};
  });
  return normalizeDraftMetadata({trip:nextTrip,catalogEntry:nextEntry});
}

export function computeTripMetrics(trip={}){
  const segments=Array.isArray(trip.segments)?trip.segments:[];
  const places=Array.isArray(trip.places)?trip.places:[];
  return {
    days:Number.isFinite(Number(trip.planning?.days))?Number(trip.planning.days):null,
    stops:Array.isArray(trip.stops)?trip.stops.length:0,
    segments:segments.length,
    countries:new Set(places.map(p=>p.countryCode).filter(Boolean)).size,
    sourcedSegments:segments.filter(s=>(s.verification?.sourceIds||[]).length).length,
    verifiedSegments:segments.filter(s=>s.verification?.status==='verified').length
  };
}

export function normalizeDraftMetadata({trip={},catalogEntry={}}={}){
  const nextTrip=clone(trip||{});
  const nextEntry=clone(catalogEntry||{});
  const countries=[...new Set((nextTrip.places||[]).map(place=>String(place.countryCode||'').trim()).filter(code=>/^[A-Z]{2}$/.test(code)))];
  nextTrip.geography={...(nextTrip.geography||{}),countries};
  nextTrip.planning={...(nextTrip.planning||{})};
  if(!Number.isFinite(Number(nextTrip.planning.days))||Number(nextTrip.planning.days)<=0){
    const stopDays=(nextTrip.stops||[]).flatMap(stop=>[stop.dayEnd,stop.dayStart]).map(Number).filter(value=>Number.isFinite(value)&&value>0);
    if(stopDays.length)nextTrip.planning.days=Math.max(...stopDays);
  }
  const normalized=normalizeCatalogEntry(nextEntry,nextTrip);
  normalized.title=clone(nextTrip.title||{});
  normalized.status=String(nextTrip.status||'draft');
  const archetype=journeyArchetype(nextTrip.kind);
  const existingCapabilities=Array.isArray(normalized.capabilities)?normalized.capabilities:[];
  normalized.capabilities=[...new Set([...archetype.capabilities,...existingCapabilities])];
  const actualModes=[...new Set((nextTrip.segments||[]).map(segment=>segment.transport?.mode).filter(mode=>allowedModes.has(mode)))];
  const existingModes=Array.isArray(normalized.discovery?.modes)?normalized.discovery.modes:[];
  const existingDiscovery=normalized.discovery||{};
  const existingRegions=Array.isArray(existingDiscovery.regions)?existingDiscovery.regions:[];
  const derivedRegions=deriveDiscoveryRegions(countries);
  const useDerivedRegions=!existingRegions.length||existingRegions.every(region=>region==='global');
  const fit={...(existingDiscovery.fit||{})};
  if((!fit.startRegion||fit.startRegion==='global')&&countries.length)fit.startRegion=derivePrimaryRegion(countries)||'global';
  normalized.discovery={
    ...existingDiscovery,
    regions:useDerivedRegions?(derivedRegions.length?derivedRegions:['global']):existingRegions,
    modes:[...new Set([...existingModes,...actualModes])],
    durationBand:durationBand(nextTrip.planning.days),
    fit
  };
  return {trip:nextTrip,catalogEntry:normalized};
}

export function normalizeCatalogEntry(entry={},trip={}){
  const metrics=computeTripMetrics(trip);
  return {
    ...entry,
    id:trip.id,
    slug:trip.slug,
    kind:trip.kind,
    renderer:'regional-globe',
    dataset:`./data/platform/trips/${trip.slug}.json`,
    metrics:{...(entry.metrics||{}),...metrics}
  };
}

export function validatePublicationReadiness({trip,catalogEntry}={}){
  const errors=[];
  const tripStatus=String(trip?.status||'').trim();
  const catalogStatus=String(catalogEntry?.status||'').trim();
  if(!tripStatus||tripStatus==='draft')errors.push('trip.status must be an explicit public status before publish');
  if(!catalogStatus||catalogStatus==='draft')errors.push('catalog status must be an explicit public status before publish');
  if(tripStatus&&catalogStatus&&tripStatus!==catalogStatus)errors.push('trip and catalog publication status must match');
  if(tripStatus&&tripStatus!=='draft'&&!publicationStatuses.has(tripStatus))errors.push('unsupported trip publication status: '+tripStatus);
  if(catalogStatus&&catalogStatus!=='draft'&&!publicationStatuses.has(catalogStatus))errors.push('unsupported catalog publication status: '+catalogStatus);
  return {valid:errors.length===0,errors,status:tripStatus||catalogStatus||''};
}

export function validateTripDraft({trip,catalogEntry,catalog}){
  const errors=[]; const warnings=[];
  const fail=m=>errors.push(m); const warn=m=>warnings.push(m);
  const locales=Array.isArray(catalog?.supportedLocales)&&catalog.supportedLocales.length?catalog.supportedLocales:['en'];
  if(!trip||typeof trip!=='object')return {valid:false,errors:['Trip payload missing'],warnings,metrics:computeTripMetrics({}),catalogEntry};
  if(!catalogEntry||typeof catalogEntry!=='object')return {valid:false,errors:['Catalog entry missing'],warnings,metrics:computeTripMetrics(trip),catalogEntry};
  if(Number(trip.schemaVersion)!==1)fail('trip.schemaVersion must be 1');
  if(!slugPattern.test(String(trip.id||'')))fail('trip.id must be a normalized slug');
  if(trip.slug!==trip.id)fail('trip.slug must equal trip.id');
  if(!slugPattern.test(String(trip.kind||'')))fail('trip.kind must be a normalized slug');
  if(catalogEntry.id!==trip.id||catalogEntry.slug!==trip.slug)fail('catalog identity must match trip identity');
  if(catalogEntry.kind!==trip.kind)fail('catalog kind must match trip kind');
  if(catalogEntry.renderer&&catalogEntry.renderer!=='regional-globe')fail('draft trips must use regional-globe renderer');

  for(const lang of locales){
    const tripTitle=String(trip.title?.[lang]||'').trim();
    const catalogTitle=String(catalogEntry.title?.[lang]||'').trim();
    const subtitle=String(catalogEntry.subtitle?.[lang]||'').trim();
    const summary=String(trip.summary?.[lang]||'').trim();
    if(!tripTitle)fail(`trip title missing for ${lang}`);
    if(!summary)fail(`trip summary missing for ${lang}`);
    if(!catalogTitle)fail(`catalog title missing for ${lang}`);
    if(!subtitle)fail(`catalog subtitle missing for ${lang}`);
    if(/^TODO\b/i.test(tripTitle)||/^TODO\b/i.test(summary)||/^TODO\b/i.test(catalogTitle)||/^TODO\b/i.test(subtitle))fail(`placeholder localization remains for ${lang}`);
  }

  const sources=Array.isArray(trip.sources)?trip.sources:[];
  const sourceIds=new Set();
  for(const src of sources){
    if(!src.id||sourceIds.has(src.id))fail('source IDs must be present and unique: '+src.id); else sourceIds.add(src.id);
    if(!/^https:\/\//.test(String(src.url||'')))fail('source '+src.id+' requires https URL');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(src.checkedAt||'')))fail('source '+src.id+' requires checkedAt date');
  }

  const places=Array.isArray(trip.places)?trip.places:[];
  const placeIds=new Set(); const placeById=new Map();
  for(const p of places){
    if(!p.id||placeIds.has(p.id))fail('place IDs must be present and unique: '+p.id); else placeIds.add(p.id);
    placeById.set(p.id,p);
    const lat=Number(p.coordinates?.lat),lng=Number(p.coordinates?.lng);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))fail('place '+p.id+' requires numeric coordinates');
    else if(lat < -90 || lat > 90 || lng < -180 || lng > 180)fail('place '+p.id+' coordinates are out of range');
    if(!String(p.countryCode||'').trim())warn('place '+p.id+' has no countryCode');
    else if(!/^[A-Z]{2}$/.test(String(p.countryCode)))fail('place '+p.id+' countryCode must be ISO alpha-2');
    for(const lang of locales){
      const name=String(p.name?.[lang]||'').trim();
      if(!name)fail(`place ${p.id} name missing for ${lang}`);
      if(/^TODO\b/i.test(name))fail(`place ${p.id} has placeholder name for ${lang}`);
    }
  }

  const stops=[...(Array.isArray(trip.stops)?trip.stops:[])].sort((a,b)=>Number(a.sequence)-Number(b.sequence));
  const stopIds=new Set(); const stopById=new Map();
  for(let i=0;i<stops.length;i++){
    const s=stops[i];
    if(!s.id||stopIds.has(s.id))fail('stop IDs must be present and unique: '+s.id); else stopIds.add(s.id);
    stopById.set(s.id,s);
    if(!placeIds.has(s.placeId))fail('stop '+s.id+' references missing place '+s.placeId);
    if(Number(s.sequence)!==i+1)fail('stop '+s.id+' sequence must be contiguous from 1');
  }

  const segs=[...(Array.isArray(trip.segments)?trip.segments:[])].sort((a,b)=>Number(a.sequence)-Number(b.sequence));
  const segmentIds=new Set();
  if(segs.length!==Math.max(0,stops.length-1))fail('segments must connect every adjacent stop');
  for(let i=0;i<segs.length;i++){
    const s=segs[i],from=stops[i],to=stops[i+1];
    if(!s.id)fail('segment at index '+i+' requires id');
    else if(segmentIds.has(s.id))fail('segment IDs must be unique: '+s.id);
    else segmentIds.add(s.id);
    if(Number(s.sequence)!==i+1)fail('segment '+s.id+' sequence must be contiguous from 1');
    if(s.fromStopId!==from?.id||s.toStopId!==to?.id)fail('segment '+s.id+' must connect adjacent stops');
    if(!allowedModes.has(s.transport?.mode))fail('segment '+s.id+' uses unsupported mode '+s.transport?.mode);
    if(!verificationStates.has(s.verification?.status))fail('segment '+s.id+' has invalid verification status');
    const refs=s.verification?.sourceIds||[];
    if(catalogEntry.capabilities?.includes('source-evidence')&&!refs.length)fail('segment '+s.id+' requires source evidence for source-evidence capability');
    for(const id of refs)if(!sourceIds.has(id))fail('segment '+s.id+' references missing source '+id);
    for(const stage of s.transport?.stages||[])for(const id of stage.sourceIds||[])if(!sourceIds.has(id))fail('stage on '+s.id+' references missing source '+id);
    if(s.verification?.status==='verified'){
      if(!refs.length)fail('verified segment '+s.id+' requires sourceIds');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s.verification?.lastVerified||'')))fail('verified segment '+s.id+' requires lastVerified');
    }
  }

  const d=catalogEntry.discovery||{}; const fit=d.fit||{};
  if(!Array.isArray(d.regions)||!d.regions.length)fail('discovery.regions required');
  if(!Array.isArray(d.themes)||!d.themes.length)fail('discovery.themes required');
  if(!Array.isArray(d.modes)||!d.modes.length)fail('discovery.modes required');
  if(!durationBands.has(d.durationBand))fail('invalid discovery.durationBand');
  if(!paces.has(fit.pace))fail('invalid discovery.fit.pace');
  if(!Array.isArray(fit.seasons)||!fit.seasons.length||fit.seasons.some(v=>!seasons.has(v)))fail('invalid discovery.fit.seasons');
  if(!Array.isArray(fit.party)||!fit.party.length||fit.party.some(v=>!parties.has(v)))fail('invalid discovery.fit.party');
  if(!fit.startRegion)fail('discovery.fit.startRegion required');
  if(!accessibilities.has(fit.accessibility))fail('invalid discovery.fit.accessibility');
  if(!Array.isArray(catalogEntry.capabilities)||!catalogEntry.capabilities.includes('globe'))fail('regional draft requires globe capability');

  try{validatePlatformExtensions({item:catalogEntry,trip,orderedStops:stops,segs,stopById,placeById,sourceIds,fail});}
  catch(error){fail('extension validation failed: '+error.message);}

  const metrics=computeTripMetrics(trip);
  const normalized=normalizeCatalogEntry(catalogEntry,trip);
  return {valid:errors.length===0,errors,warnings,metrics,catalogEntry:normalized};
}
