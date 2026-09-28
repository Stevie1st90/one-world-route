const slugify=value=>String(value||'')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'')
  .toLowerCase()
  .replace(/&/g,' and ')
  .replace(/[^a-z0-9]+/g,'-')
  .replace(/^-+|-+$/g,'');

const localName=value=>{
  if(value==null)return '';
  if(typeof value==='string')return value;
  return String(value.en||Object.values(value)[0]||'');
};

const stopDays=stop=>{
  const start=Number(stop?.dayStart),end=Number(stop?.dayEnd);
  if(Number.isFinite(start)&&Number.isFinite(end)&&end>=start)return end-start+1;
  const nights=Number(stop?.nights);
  return Number.isFinite(nights)&&nights>=0?Math.max(1,nights):1;
};

export function buildExperienceCoverage({catalog,datasets,profiles}){
  const profileMap=profiles instanceof Map?profiles:new Map((profiles||[]).map(profile=>[profile.id,profile]));
  const journeys=[];
  const missingMap=new Map();
  const profileUse=new Map();

  for(const meta of catalog?.trips||[]){
    if(meta.renderer!=='regional-globe')continue;
    const trip=datasets.get(meta.id)||{};
    const stopsByPlace=new Map();
    for(const stop of trip.stops||[]){
      const list=stopsByPlace.get(stop.placeId)||[];
      list.push(stop);
      stopsByPlace.set(stop.placeId,list);
    }

    let covered=0;
    const missing=[];
    for(const place of trip.places||[]){
      const ref=String(place.experienceRef||'').trim();
      if(ref&&profileMap.has(ref)){
        covered++;
        const use=profileUse.get(ref)||{profileId:ref,journeys:new Set(),placeUses:0};
        use.journeys.add(meta.id);
        use.placeUses++;
        profileUse.set(ref,use);
        continue;
      }

      const name=localName(place.name);
      const countryCode=String(place.countryCode||'').toUpperCase();
      const suggestedId=countryCode&&name?countryCode+':'+slugify(name):null;
      const key=countryCode+'|'+slugify(name||place.id);
      const stopDaysTotal=(stopsByPlace.get(place.id)||[]).reduce((sum,stop)=>sum+stopDays(stop),0);
      const candidate=missingMap.get(key)||{
        key,
        countryCode,
        name,
        suggestedProfileId:suggestedId,
        action:suggestedId&&profileMap.has(suggestedId)?'link-existing':'create-profile',
        journeyIds:new Set(),
        featuredJourneyIds:new Set(),
        occurrences:0,
        stopDays:0,
        maxFeaturePriority:0
      };
      candidate.journeyIds.add(meta.id);
      if(meta.discovery?.featured)candidate.featuredJourneyIds.add(meta.id);
      candidate.occurrences++;
      candidate.stopDays+=stopDaysTotal;
      candidate.maxFeaturePriority=Math.max(candidate.maxFeaturePriority,Number(meta.visual?.featurePriority||0));
      missingMap.set(key,candidate);
      missing.push({
        placeId:place.id,
        name,
        countryCode,
        suggestedProfileId:suggestedId,
        action:candidate.action,
        stopDays:stopDaysTotal
      });
    }

    const total=(trip.places||[]).length;
    journeys.push({
      tripId:meta.id,
      title:localName(meta.title)||meta.id,
      status:meta.status||null,
      featured:Boolean(meta.discovery?.featured),
      featurePriority:Number(meta.visual?.featurePriority||0),
      totalPlaces:total,
      coveredPlaces:covered,
      missingPlaces:total-covered,
      coveragePct:total?Math.round((covered/total)*100):100,
      missing
    });
  }

  const queue=[...missingMap.values()].map(item=>({
    key:item.key,
    countryCode:item.countryCode,
    name:item.name,
    suggestedProfileId:item.suggestedProfileId,
    action:item.action,
    occurrences:item.occurrences,
    journeyCount:item.journeyIds.size,
    journeyIds:[...item.journeyIds].sort(),
    featuredJourneyCount:item.featuredJourneyIds.size,
    featuredJourneyIds:[...item.featuredJourneyIds].sort(),
    stopDays:item.stopDays,
    maxFeaturePriority:item.maxFeaturePriority
  })).sort((a,b)=>
    b.journeyCount-a.journeyCount||
    b.featuredJourneyCount-a.featuredJourneyCount||
    b.stopDays-a.stopDays||
    b.maxFeaturePriority-a.maxFeaturePriority||
    a.countryCode.localeCompare(b.countryCode)||
    a.name.localeCompare(b.name)
  );

  const reuse=[...profileUse.values()].map(item=>({
    profileId:item.profileId,
    journeyCount:item.journeys.size,
    journeyIds:[...item.journeys].sort(),
    placeUses:item.placeUses
  })).sort((a,b)=>b.journeyCount-a.journeyCount||b.placeUses-a.placeUses||a.profileId.localeCompare(b.profileId));

  const totalPlaces=journeys.reduce((sum,item)=>sum+item.totalPlaces,0);
  const coveredPlaces=journeys.reduce((sum,item)=>sum+item.coveredPlaces,0);
  const completeJourneys=journeys.filter(item=>item.missingPlaces===0).length;

  journeys.sort((a,b)=>
    a.coveragePct-b.coveragePct||
    b.featured-a.featured||
    b.featurePriority-a.featurePriority||
    a.title.localeCompare(b.title)
  );

  return {
    schemaVersion:1,
    summary:{
      journeys:journeys.length,
      totalPlaces,
      coveredPlaces,
      missingPlaces:totalPlaces-coveredPlaces,
      coveragePct:totalPlaces?Math.round((coveredPlaces/totalPlaces)*100):100,
      completeJourneys,
      profiles:profileMap.size,
      reusedProfiles:reuse.filter(item=>item.journeyCount>1).length,
      queueItems:queue.length
    },
    journeys,
    queue,
    reuse
  };
}
