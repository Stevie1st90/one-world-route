import {createHash} from 'node:crypto';

const DAY=86400000;
const asDate=value=>{
  if(!value)return null;
  const date=new Date(String(value).length===10?String(value)+'T00:00:00Z':String(value));
  return Number.isNaN(date.getTime())?null:date;
};
const iso=date=>date?.toISOString().slice(0,10)||null;
const plusDays=(date,days)=>new Date(date.getTime()+Number(days||0)*DAY);
const canonicalUrl=value=>{
  try{
    const url=new URL(String(value||''));
    url.hash='';
    if(url.pathname.length>1)url.pathname=url.pathname.replace(/\/+$/,'');
    return url.toString();
  }catch{return String(value||'').trim()}
};
const stableId=(prefix,value)=>prefix+'-'+createHash('sha1').update(String(value)).digest('hex').slice(0,12);
const stateFor=({now,nextReview,validUntil})=>{
  if(validUntil&&validUntil<now)return 'expired';
  if(!nextReview)return 'unknown';
  const delta=Math.floor((nextReview-now)/DAY);
  if(delta<0)return 'overdue';
  if(delta<=30)return 'due-soon';
  return 'scheduled';
};
const stateWeight={expired:1000,overdue:800,'due-soon':500,unknown:400,scheduled:0};

export function buildMaintenanceQueue({catalog,datasets=new Map(),shared={items:[],reviewPolicies:{}},profiles=[],now=new Date()}={}){
  const today=new Date(now);today.setUTCHours(0,0,0,0);
  const grouped=new Map();
  const addSource=(source,context)=>{
    const url=canonicalUrl(source?.url);
    if(!url)return;
    const key=url;
    const checkedAt=asDate(source.checkedAt);
    const validUntil=asDate(source.validUntil);
    const reviewDays=Number(source.reviewDays||context.reviewDays||180);
    const nextReview=checkedAt?plusDays(checkedAt,reviewDays):null;
    const existing=grouped.get(key)||{
      id:stableId('source',key),type:'external-source',url,
      title:source.title||source.issuer||url,issuer:source.issuer||null,
      checkedAt:source.checkedAt||null,validUntil:source.validUntil||null,
      reviewDays,nextReviewAt:iso(nextReview),maintenanceTiers:new Set(),
      dependents:[],state:null,daysUntilReview:null,priority:0
    };
    if(!existing.dependents.some(item=>JSON.stringify(item)===JSON.stringify(context.dependent)))existing.dependents.push(context.dependent);
    existing.maintenanceTiers.add(context.tier||'stable-editorial');
    if(checkedAt&&(!asDate(existing.checkedAt)||checkedAt>asDate(existing.checkedAt)))existing.checkedAt=source.checkedAt;
    existing.reviewDays=Math.min(Number(existing.reviewDays||reviewDays),reviewDays);
    const existingNext=asDate(existing.nextReviewAt);
    if(nextReview&&(!existingNext||nextReview<existingNext))existing.nextReviewAt=iso(nextReview);
    if(validUntil&&(!asDate(existing.validUntil)||validUntil<asDate(existing.validUntil)))existing.validUntil=source.validUntil;
    grouped.set(key,existing);
  };

  for(const meta of catalog?.trips||[]){
    if(meta.renderer==='legacy-world')continue;
    const trip=datasets instanceof Map?datasets.get(meta.id):datasets?.[meta.id];
    if(!trip)continue;
    const maintenance=trip.maintenance||{};
    const reviewDays=Number(maintenance.sourceReviewDays||180);
    for(const source of trip.sources||[])addSource(source,{
      reviewDays,tier:maintenance.tier||'stable-editorial',
      dependent:{kind:'journey',tripId:meta.id,sourceId:source.id}
    });
  }

  const policyFor=volatility=>{
    const key=volatility==='live'?'live-dependent':volatility==='seasonal'?'seasonal':'evergreen';
    return Number(shared?.reviewPolicies?.[key]?.reviewAfterDays||180);
  };
  for(const item of shared?.items||[]){
    if(!item.source?.url)continue;
    addSource({...item.source,id:item.id,checkedAt:item.checkedAt,reviewDays:item.reviewDays||policyFor(item.volatility)},{
      reviewDays:item.reviewDays||policyFor(item.volatility),tier:item.volatility==='live'?'live-dependent':'shared-knowledge',
      dependent:{kind:'shared-knowledge',itemId:item.id}
    });
  }

  const sourceItems=[...grouped.values()].map(item=>{
    const nextReview=asDate(item.nextReviewAt),validUntil=asDate(item.validUntil);
    item.state=stateFor({now:today,nextReview,validUntil});
    item.daysUntilReview=nextReview?Math.floor((nextReview-today)/DAY):null;
    item.reuseCount=item.dependents.length;
    item.maintenanceTiers=[...item.maintenanceTiers].sort();
    const live=item.maintenanceTiers.includes('live-dependent')?120:0;
    const overdue=item.daysUntilReview!==null&&item.daysUntilReview<0?Math.min(180,Math.abs(item.daysUntilReview)):0;
    item.priority=stateWeight[item.state]+live+Math.min(120,item.reuseCount*20)+overdue;
    item.priorityReason=[item.state,live?'live-dependent':null,item.reuseCount>1?'reused '+item.reuseCount+'×':null].filter(Boolean).join(' · ');
    return item;
  });

  const profileItems=(profiles||[]).map(profile=>{
    const reviewed=asDate(profile.reviewedAt),reviewDays=Number(profile.reviewDays||365),nextReview=reviewed?plusDays(reviewed,reviewDays):null;
    const state=stateFor({now:today,nextReview,validUntil:null});
    const daysUntilReview=nextReview?Math.floor((nextReview-today)/DAY):null;
    return {
      id:stableId('experience',profile.id),type:'place-experience',profileId:profile.id,
      title:profile.name?.en||profile.id,countryCode:profile.countryCode||null,
      reviewedAt:profile.reviewedAt||null,reviewDays,nextReviewAt:iso(nextReview),
      state,daysUntilReview,priority:stateWeight[state]+(daysUntilReview!==null&&daysUntilReview<0?Math.min(180,Math.abs(daysUntilReview)):0),
      priorityReason:state
    };
  });

  const items=[...sourceItems,...profileItems].sort((a,b)=>b.priority-a.priority||String(a.nextReviewAt||'9999').localeCompare(String(b.nextReviewAt||'9999'))||a.id.localeCompare(b.id));
  const sourcesByJourney=new Map();
  for(const item of sourceItems)for(const dep of item.dependents){
    if(dep.kind!=='journey')continue;
    if(!sourcesByJourney.has(dep.tripId))sourcesByJourney.set(dep.tripId,new Set());
    sourcesByJourney.get(dep.tripId).add(item);
  }
  const journeyHealth=(catalog?.trips||[]).filter(meta=>meta.renderer!=='legacy-world').map(meta=>{
    const trip=datasets instanceof Map?datasets.get(meta.id):datasets?.[meta.id],related=[...(sourcesByJourney.get(meta.id)||[])];
    const sourceStates=related.map(item=>item.state),currentChecks=(trip?.segments||[]).filter(segment=>segment.verification?.status!=='verified').length;
    const stale=sourceStates.filter(state=>['expired','overdue','unknown'].includes(state)).length,dueSoon=sourceStates.filter(state=>state==='due-soon').length;
    const state=stale||!related.length?'source-stale':dueSoon?'review-soon':currentChecks?'current-check-required':'healthy';
    return {tripId:meta.id,title:meta.title?.en||meta.id,state,currentChecks,staleSources:stale,dueSoonSources:dueSoon,totalSources:related.length};
  }).sort((a,b)=>{
    const weight={'source-stale':4,'review-soon':3,'current-check-required':2,healthy:1};
    return (weight[b.state]||0)-(weight[a.state]||0)||a.title.localeCompare(b.title);
  });
  const count=state=>items.filter(item=>item.state===state).length;
  const journeyCount=state=>journeyHealth.filter(item=>item.state===state).length;
  return {
    schemaVersion:1,generatedAt:today.toISOString(),
    summary:{
      journeys:(catalog?.trips||[]).filter(item=>item.renderer!=='legacy-world').length,
      uniqueExternalSources:sourceItems.length,
      reusedExternalSources:sourceItems.filter(item=>item.reuseCount>1).length,
      placeExperienceProfiles:profileItems.length,
      expired:count('expired'),overdue:count('overdue'),dueSoon:count('due-soon'),unknown:count('unknown'),scheduled:count('scheduled'),
      journeyHealthy:journeyCount('healthy'),journeyCurrentCheck:journeyCount('current-check-required'),journeyReviewSoon:journeyCount('review-soon'),journeySourceStale:journeyCount('source-stale')
    },
    journeyHealth,
    items
  };
}
