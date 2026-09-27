import {verificationDate} from './verification-date-model.mjs';
import {
  movementDecision,
  movementDecisionReviewedAt,
  movementReviewResolved,
} from './movement-decision-model.mjs';

const DAY_MS=24*60*60*1000;
const EXCEL_EPOCH_MS=Date.UTC(1899,11,30);
const isoPattern=/^\d{4}-\d{2}-\d{2}$/;

function isoDateValue(value){
  if(typeof value==='string'&&isoPattern.test(value))return value;
  if(typeof value==='number'&&Number.isFinite(value)){
    return new Date(EXCEL_EPOCH_MS+Math.round(value)*DAY_MS).toISOString().slice(0,10);
  }
  return null;
}

function addDays(value,days){
  const date=isoDateValue(value);
  if(!date)return null;
  return new Date(Date.parse(date+'T00:00:00Z')+days*DAY_MS).toISOString().slice(0,10);
}

function daysBetween(from,to){
  const a=isoDateValue(from);
  const b=isoDateValue(to);
  if(!a||!b)return null;
  return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/DAY_MS);
}

function checkpointState({checkpointDate,reviewedAt,dataAsOf}){
  if(!checkpointDate)return 'unscheduled';
  if(reviewedAt&&reviewedAt>=checkpointDate)return 'satisfied';
  if(dataAsOf&&dataAsOf>=checkpointDate)return 'due';
  return 'scheduled';
}

function legTravelDate(segment){
  const departure=isoDateValue(segment?.planDeparture);
  if(departure)return {date:departure,basis:'plan-departure'};
  const arrival=isoDateValue(segment?.planArrival);
  if(arrival)return {date:arrival,basis:'plan-arrival'};
  return {date:null,basis:'unscheduled'};
}

function movementTravelDate(movement){
  const planned=isoDateValue(movement?.plannedDate);
  if(planned)return {date:planned,basis:'planned-date'};
  const before=isoDateValue(movement?.planningWindow?.before);
  if(before)return {date:before,basis:'planning-window-before'};
  const after=isoDateValue(movement?.planningWindow?.after);
  if(after)return {date:after,basis:'planning-window-after'};
  return {date:null,basis:'external-change-only'};
}

function scheduleFor({travelDate,reviewedAt,dataAsOf}){
  const tMinus7=addDays(travelDate,-7);
  const tMinus48h=addDays(travelDate,-2);
  return {
    tMinus7:{
      date:tMinus7,
      state:checkpointState({checkpointDate:tMinus7,reviewedAt,dataAsOf}),
    },
    tMinus48h:{
      date:tMinus48h,
      state:checkpointState({checkpointDate:tMinus48h,reviewedAt,dataAsOf}),
    },
  };
}

function scheduledCheckpointRows(items){
  return items.flatMap(item=>[
    {itemId:item.id,label:'T-7d',...item.schedule.tMinus7},
    {itemId:item.id,label:'T-48h',...item.schedule.tMinus48h},
  ]).filter(row=>row.date);
}

export function buildFlagshipRecheckPlan({route,operations,criticalReviews={reviews:{}},readiness}){
  const dataAsOf=verificationDate(readiness?.dataAsOf);
  const items=[];

  for(const segment of route.segments||[]){
    if(segment.feasibility!=='Kritisch')continue;
    const review=criticalReviews.reviews?.[String(segment.id)]||null;
    if(!review?.status||!['hold','blocked'].includes(review.decision))continue;
    const reviewedAt=verificationDate(review.reviewedAt);
    const travel=legTravelDate(segment);
    items.push({
      id:'leg-'+Number(segment.id),
      category:'international-leg',
      legId:Number(segment.id),
      movementId:null,
      title:String(segment.from||'?')+' → '+String(segment.to||'?'),
      currentDecision:review.decision,
      actionClass:review.decision==='blocked'?'external-change-required':'monitor-and-recheck',
      travelDate:travel.date,
      travelDateBasis:travel.basis,
      daysUntilTravelFromDataAsOf:daysBetween(dataAsOf,travel.date),
      reviewedAt,
      evidenceState:review.routeEvidence||null,
      safetyState:review.safetyState||null,
      recheckPolicy:review.recheckPolicy||null,
      triggerOn:[
        'official-security-advice-change',
        'entry-border-rule-change',
        'transport-service-status-change',
      ],
      dependencyLegs:[Number(segment.id)],
      schedule:scheduleFor({travelDate:travel.date,reviewedAt,dataAsOf}),
      blocksDeparture:true,
    });
  }

  for(const movement of operations.movements||[]){
    const decision=movementDecision(movement);
    if(!['hold','blocked'].includes(decision)||!movementReviewResolved(movement))continue;
    const reviewedAt=movementDecisionReviewedAt(movement);
    const travel=movementTravelDate(movement);
    items.push({
      id:'movement-'+movement.id,
      category:'operational-movement',
      legId:Number(movement.parentAfterLeg)||null,
      movementId:movement.id,
      title:String(movement.from||'?')+' → '+String(movement.to||'?'),
      currentDecision:decision,
      actionClass:decision==='blocked'?'external-change-required':'monitor-and-recheck',
      travelDate:travel.date,
      travelDateBasis:travel.basis,
      daysUntilTravelFromDataAsOf:daysBetween(dataAsOf,travel.date),
      reviewedAt,
      evidenceState:movement.decisionReason||null,
      safetyState:null,
      recheckPolicy:movement.recheckPolicy||null,
      triggerOn:[
        'dependent-leg-decision-change',
        'official-security-advice-change',
        'entry-border-rule-change',
        'transport-service-status-change',
      ],
      dependencyLegs:[
        Number(movement.parentAfterLeg)||null,
        Number(movement.parentBeforeLeg)||null,
      ].filter(Boolean),
      schedule:scheduleFor({travelDate:travel.date,reviewedAt,dataAsOf}),
      blocksDeparture:true,
    });
  }

  items.sort((a,b)=>
    String(a.travelDate||'9999-12-31').localeCompare(String(b.travelDate||'9999-12-31'))||
    a.category.localeCompare(b.category)||
    a.id.localeCompare(b.id)
  );

  const checkpoints=scheduledCheckpointRows(items);
  const scheduledFuture=checkpoints
    .filter(row=>row.state==='scheduled')
    .sort((a,b)=>a.date.localeCompare(b.date)||a.itemId.localeCompare(b.itemId)||a.label.localeCompare(b.label));
  const dueRows=checkpoints.filter(row=>row.state==='due');
  const upcomingLimit=addDays(dataAsOf,30);
  const upcomingItemIds=new Set(
    scheduledFuture
      .filter(row=>row.date>dataAsOf&&row.date<=upcomingLimit)
      .map(row=>row.itemId)
  );
  const nextScheduledRecheck=scheduledFuture[0]?.date||null;

  return {
    schemaVersion:1,
    tripId:'world-195',
    dataAsOf,
    policy:{
      fixedCheckpoints:['T-7d','T-48h'],
      immediateTriggers:[
        'material-regional-change',
        'official-security-advice-change',
        'entry-border-rule-change',
        'transport-service-status-change',
        'dependent-leg-decision-change',
      ],
      principle:'A completed review does not clear a HOLD/BLOCKED item. Rechecks update evidence and decisions only when current sources justify a change.',
    },
    summary:{
      total:items.length,
      internationalLegs:items.filter(item=>item.category==='international-leg').length,
      operationalMovements:items.filter(item=>item.category==='operational-movement').length,
      hold:items.filter(item=>item.currentDecision==='hold').length,
      blocked:items.filter(item=>item.currentDecision==='blocked').length,
      dueAtDataAsOf:new Set(dueRows.map(row=>row.itemId)).size,
      upcoming30Days:upcomingItemIds.size,
      unscheduledTravelDate:items.filter(item=>!item.travelDate).length,
      eventDrivenWatch:items.length,
      nextScheduledRecheck,
    },
    nextScheduledItems:nextScheduledRecheck
      ?scheduledFuture.filter(row=>row.date===nextScheduledRecheck).map(row=>({itemId:row.itemId,checkpoint:row.label}))
      :[],
    items,
  };
}
