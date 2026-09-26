import {verificationDate} from './verification-date-model.mjs';

const terminalDecisions=new Set(['hold','blocked']);

export const movementExternalSources=movement=>
  Array.isArray(movement?.source)
    ?movement.source.filter(source=>/^https?:\/\//i.test(source))
    :[];

export const movementDecision=movement=>{
  const explicit=String(movement?.operationalDecision||'').toLowerCase();
  if(terminalDecisions.has(explicit))return explicit;
  return movement?.reviewStatus==='reviewed'?'ready':'needs-review';
};

export const movementDecisionReviewedAt=movement=>
  verificationDate(movement?.decisionReviewedAt)||verificationDate(movement?.lastVerified);

export const movementOperationallyComplete=movement=>
  movementDecision(movement)==='ready'&&
  Boolean(
    movement?.reviewStatus==='reviewed'&&
    movement.coordinates&&
    movement.mode&&
    movement.plannedDuration!==null&&
    movement.estimatedCost!==null&&
    typeof movement.bookingRequired==='boolean'&&
    verificationDate(movement.lastVerified)&&
    movementExternalSources(movement).length
  );

export const movementReviewResolved=movement=>{
  const decision=movementDecision(movement);
  if(decision==='ready')return movementOperationallyComplete(movement);
  if(terminalDecisions.has(decision)){
    return Boolean(
      movement?.reviewStatus==='reviewed'&&
      movementDecisionReviewedAt(movement)&&
      movementExternalSources(movement).length
    );
  }
  return false;
};

export const movementBlocksDeparture=movement=>
  ['hold','blocked'].includes(movementDecision(movement));
