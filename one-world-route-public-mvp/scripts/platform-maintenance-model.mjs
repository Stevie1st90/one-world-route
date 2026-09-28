import {buildExperienceCoverage} from './experience-coverage-model.mjs';

const DAY=86400000;
const asDate=value=>{
  if(!value)return null;
  const raw=String(value);
  const date=new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw+'T00:00:00Z':raw);
  return Number.isNaN(date.getTime())?null:date;
};
const dateOnly=value=>value?new Date(value).toISOString().slice(0,10):null;
const daysBetween=(a,b)=>Math.floor((a-b)/DAY);
const dueState=(dueInDays,expired)=>expired?'expired':dueInDays<0?'overdue':'due-soon';
const rank={expired:0,overdue:1,'due-soon':2};

export function buildMaintenanceReport({
  catalog={trips:[]},
  datasets=new Map(),
  shared={items:[],reviewPolicies:{}},
  experienceProfiles=[],
  now=new Date(),
  dueSoonDays=30
}={}){
  const clock=now instanceof Date?now:new Date(now);
  if(Number.isNaN(clock.getTime()))throw new Error('Maintenance report requires a valid now date');
  const issues=[],queue=[],experienceUse=new Map();
  let sourceCount=0,liveDependentTrips=0,reversibleTrips=0,experienceReferenceCount=0;

  const addCandidate=item=>{
    if(item.expired||item.dueInDays<=dueSoonDays)queue.push({...item,state:dueState(item.dueInDays,item.expired)});
  };

  for(const meta of catalog.trips||[]){
    if(meta.renderer==='legacy-world')continue;
    const trip=datasets.get(meta.id);
    if(!trip){issues.push(meta.id+': dataset unavailable');continue}
    if(trip.id!==meta.id)issues.push(meta.id+': dataset id mismatch');
    const maintenance=trip.maintenance||{};
    if(maintenance.tier==='live-dependent')liveDependentTrips++;
    if(trip.routePolicy?.reversible===true)reversibleTrips++;
    if(trip.routePolicy?.reversible===true&&!['endpoints','any-stop'].includes(trip.routePolicy?.startMode)){
      issues.push(meta.id+': reversible route requires endpoints or any-stop startMode');
    }
    for(const place of trip.places||[]){
      if(place.experienceRef){
        experienceReferenceCount++;
        experienceUse.set(place.experienceRef,(experienceUse.get(place.experienceRef)||0)+1);
      }
    }
    const reviewDays=Number(maintenance.sourceReviewDays||180);
    for(const source of trip.sources||[]){
      sourceCount++;
      const checked=asDate(source.checkedAt);
      if(!checked){issues.push(meta.id+': source '+source.id+' has invalid checkedAt');continue}
      const ageDays=daysBetween(clock,checked),dueInDays=reviewDays-ageDays;
      const validUntil=asDate(source.validUntil);
      if(source.validUntil&&!validUntil)issues.push(meta.id+': source '+source.id+' has invalid validUntil');
      const expired=Boolean(validUntil&&validUntil<clock);
      addCandidate({
        kind:'trip-source',
        tripId:meta.id,
        title:source.title||source.id,
        sourceId:source.id,
        checkedAt:dateOnly(checked),
        validUntil:dateOnly(validUntil),
        reviewDays,
        ageDays,
        dueInDays,
        expired
      });
    }
  }

  for(const profile of experienceProfiles||[]){
    const reviewed=asDate(profile.reviewedAt);
    const reviewDays=Number(profile.reviewDays||365);
    if(!reviewed){issues.push('place experience '+profile.id+': invalid reviewedAt');continue}
    const ageDays=daysBetween(clock,reviewed),dueInDays=reviewDays-ageDays;
    addCandidate({
      kind:'place-experience',
      tripId:'place-experience',
      title:profile.name?.en||profile.id,
      sourceId:profile.id,
      checkedAt:dateOnly(reviewed),
      reviewDays,
      ageDays,
      dueInDays,
      expired:false
    });
  }

  const policies=shared.reviewPolicies||{};
  for(const item of shared.items||[]){
    if(!item.id){issues.push('shared knowledge item without id');continue}
    if(item.type==='planning-policy'||item.sourceRequired===false)continue;
    if(!item.source?.url||!item.checkedAt){issues.push('shared knowledge '+item.id+': factual item needs source.url and checkedAt');continue}
    const checked=asDate(item.checkedAt);
    if(!checked){issues.push('shared knowledge '+item.id+': invalid checkedAt');continue}
    const reviewDays=Number(policies[item.volatility]?.reviewAfterDays||180);
    const ageDays=daysBetween(clock,checked),dueInDays=reviewDays-ageDays;
    addCandidate({
      kind:'shared-knowledge',
      tripId:'shared-knowledge',
      title:item.title?.en||item.id,
      sourceId:item.id,
      checkedAt:dateOnly(checked),
      reviewDays,
      ageDays,
      dueInDays,
      expired:false
    });
  }

  const coverage=buildExperienceCoverage({catalog,datasets,profiles:experienceProfiles});
  queue.sort((a,b)=>
    (rank[a.state]-rank[b.state])||
    (a.dueInDays-b.dueInDays)||
    String(a.tripId).localeCompare(String(b.tripId))||
    String(a.sourceId).localeCompare(String(b.sourceId))
  );
  const counts=queue.reduce((acc,item)=>{acc[item.state]=(acc[item.state]||0)+1;return acc},{});
  return {
    schemaVersion:1,
    generatedAt:clock.toISOString(),
    summary:{
      trips:(catalog.trips||[]).length,
      regionalTrips:(catalog.trips||[]).filter(meta=>meta.renderer!=='legacy-world').length,
      reversibleTrips,
      liveDependentTrips,
      tripSources:sourceCount,
      sharedKnowledgeItems:(shared.items||[]).length,
      experienceProfiles:(experienceProfiles||[]).length,
      experienceReferences:experienceReferenceCount,
      reusedExperienceProfiles:[...experienceUse.values()].filter(count=>count>1).length,
      experienceCoveragePct:coverage.summary.coveragePct,
      completeExperienceJourneys:coverage.summary.completeJourneys,
      experienceJourneys:coverage.summary.journeys,
      queueItems:queue.length,
      expired:counts.expired||0,
      overdue:counts.overdue||0,
      dueSoon:counts['due-soon']||0,
      issues:issues.length
    },
    queue,
    issues,
    experienceCoverage:coverage.summary
  };
}
