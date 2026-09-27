import {verificationDate} from './verification-date-model.mjs';

const DAY_MS=86400000;
const sourceList=value=>String(value||'').split(';').map(item=>item.trim()).filter(Boolean);
const unique=values=>[...new Set(values.filter(Boolean))];

function shiftDate(iso,days){
  const date=new Date(iso+'T00:00:00Z');
  date.setUTCDate(date.getUTCDate()+days);
  return date.toISOString().slice(0,10);
}

function daysBetween(from,to){
  return Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/DAY_MS);
}

function targetDateForSegment(segment){
  return verificationDate(segment?.planDeparture)||verificationDate(segment?.planArrival);
}

function targetDateForMovement(movement){
  return verificationDate(movement?.planningWindow?.before)||verificationDate(movement?.planningWindow?.after);
}

function watchTriggers({decision,evidenceState,safetyState,reason,notes}){
  const text=[evidenceState,safetyState,reason,notes].filter(Boolean).join(' ').toLowerCase();
  const triggers=['official-guidance-material-change'];
  if(/border|crossing|entry|visa|permit|permission|restricted|corridor|closed/.test(text))triggers.push('border-entry-permission-change');
  if(/operator|service|flight|rail|airport|suspend|transport|routing/.test(text))triggers.push('transport-service-change');
  if(/warning|volatile|risk|security|conflict|war/.test(text))triggers.push('security-environment-change');
  if(decision==='blocked')triggers.push('lawful-corridor-or-entry-established');
  return unique(triggers);
}

function scheduledRechecks(targetDate){
  if(!targetDate)return [];
  return [
    {id:'pre-departure-7d',offsetHours:168,dueOn:shiftDate(targetDate,-7)},
    {id:'pre-departure-48h',offsetHours:48,dueOn:shiftDate(targetDate,-2)},
  ];
}

export function buildFlagshipRecheckPlan({route,operations,queue,criticalReviews={reviews:{}}}){
  const segmentById=new Map((route.segments||[]).map(segment=>[Number(segment.id),segment]));
  const movementById=new Map((operations.movements||[]).map(movement=>[movement.id,movement]));
  const tasks=(queue.tasks||[]).filter(task=>task.priority==='P0'&&task.blocksDeparture).map(task=>{
    let decision=null,reviewedAt=null,lastVerified=null,targetDate=null,evidenceState=null,safetyState=null,recheckPolicy=null,sources=[],reason=null,notes=null,planningWindow=null;

    if(task.category==='international-leg'){
      const segment=segmentById.get(Number(task.legId));
      const review=criticalReviews.reviews?.[String(task.legId)]||null;
      if(!segment||!review)throw new Error('Missing critical recheck input for '+task.id);
      decision=review.decision||task.reviewDecision||null;
      reviewedAt=verificationDate(review.reviewedAt);
      lastVerified=verificationDate(segment.lastVerified);
      targetDate=targetDateForSegment(segment);
      evidenceState=review.routeEvidence||null;
      safetyState=review.safetyState||null;
      recheckPolicy=review.recheckPolicy||null;
      sources=unique([...sourceList(segment.source),...(review.sources||[])]);
      notes=review.notes||null;
    }else if(task.category==='operational-movement'){
      const movement=movementById.get(task.movementId);
      if(!movement)throw new Error('Missing movement recheck input for '+task.id);
      decision=movement.operationalDecision||task.reviewDecision||null;
      reviewedAt=verificationDate(movement.decisionReviewedAt);
      lastVerified=verificationDate(movement.lastVerified);
      targetDate=targetDateForMovement(movement);
      evidenceState=movement.decisionReason||null;
      recheckPolicy=movement.recheckPolicy||null;
      sources=unique(Array.isArray(movement.source)?movement.source:[]);
      reason=movement.decisionReason||null;
      notes=movement.notes||null;
      planningWindow=movement.planningWindow||null;
    }else{
      throw new Error('Unsupported P0 recheck category '+task.category);
    }

    if(!['hold','blocked'].includes(decision))throw new Error('P0 recheck task must remain HOLD/BLOCKED: '+task.id);
    if(!reviewedAt)throw new Error('P0 recheck task must have reviewedAt: '+task.id);
    const rechecks=scheduledRechecks(targetDate);

    return {
      id:task.id,
      priority:'P0',
      category:task.category,
      legId:task.legId??null,
      movementId:task.movementId??null,
      title:task.title,
      decision,
      blocksDeparture:true,
      targetDate,
      planningWindow,
      reviewedAt,
      lastVerified,
      evidenceState,
      safetyState,
      monitoringMode:targetDate?'scheduled-and-condition-watch':'condition-watch',
      scheduledRechecks:rechecks,
      nextScheduledRecheck:rechecks.find(item=>item.dueOn>reviewedAt)?.dueOn||null,
      watchTriggers:watchTriggers({decision,evidenceState,safetyState,reason,notes}),
      recheckPolicy,
      sources,
      releaseControl:{
        manualReviewRequired:true,
        autoPromote:false,
        requirement:'A HOLD/BLOCKED task may change only after a new source-backed review establishes current safety/entry conditions and executable transport where applicable.',
      },
    };
  });

  const allMilestones=tasks.flatMap(task=>task.scheduledRechecks.map(milestone=>({...milestone,taskId:task.id})));
  return {
    schemaVersion:1,
    tripId:'world-195',
    dataAsOf:queue.dataAsOf||null,
    policy:{
      scheduledOffsetsHours:[168,48],
      immediateRecheckOnMaterialChange:true,
      manualReleaseRequired:true,
      autoPromote:false,
      datePrecision:'day',
      note:'The source itinerary is date-granular; the 48-hour checkpoint is represented as target date minus two calendar days. Material official changes require immediate manual re-review regardless of schedule.',
    },
    summary:{
      total:tasks.length,
      blocking:tasks.filter(task=>task.blocksDeparture).length,
      byDecision:{hold:tasks.filter(task=>task.decision==='hold').length,blocked:tasks.filter(task=>task.decision==='blocked').length},
      byCategory:{'international-leg':tasks.filter(task=>task.category==='international-leg').length,'operational-movement':tasks.filter(task=>task.category==='operational-movement').length},
      scheduledTaskCount:tasks.filter(task=>task.targetDate).length,
      conditionWatchOnlyTaskCount:tasks.filter(task=>!task.targetDate).length,
      milestoneCount:allMilestones.length,
      nextScheduledRecheck:allMilestones.map(item=>item.dueOn).sort()[0]||null,
    },
    tasks,
  };
}

export function evaluateFlagshipRechecks(plan,{asOf}={}){
  const checkDate=verificationDate(asOf);
  if(!checkDate)throw new Error('evaluateFlagshipRechecks requires ISO asOf date');
  const rows=[];
  for(const task of plan.tasks||[]){
    const reviewedAt=verificationDate(task.reviewedAt);
    for(const milestone of task.scheduledRechecks||[]){
      const dueOn=verificationDate(milestone.dueOn);
      const satisfied=Boolean(reviewedAt&&dueOn&&reviewedAt>=dueOn);
      let state='scheduled';
      if(satisfied)state='satisfied';
      else if(dueOn<=checkDate)state=task.targetDate&&checkDate>task.targetDate?'overdue':'due';
      else if(daysBetween(checkDate,dueOn)<=7)state='upcoming';
      rows.push({taskId:task.id,title:task.title,category:task.category,decision:task.decision,milestone:milestone.id,dueOn,targetDate:task.targetDate,reviewedAt,state});
    }
  }
  const count=state=>rows.filter(row=>row.state===state).length;
  const dueRows=rows.filter(row=>row.state==='due'||row.state==='overdue');
  return {
    schemaVersion:1,
    tripId:plan.tripId,
    asOf:checkDate,
    summary:{
      taskCount:(plan.tasks||[]).length,
      milestoneCount:rows.length,
      due:count('due'),
      overdue:count('overdue'),
      upcoming:count('upcoming'),
      satisfied:count('satisfied'),
      scheduled:count('scheduled'),
      conditionWatchOnly:(plan.tasks||[]).filter(task=>task.monitoringMode==='condition-watch').length,
      requiresAction:dueRows.length,
    },
    due:dueRows,
    upcoming:rows.filter(row=>row.state==='upcoming'),
  };
}
