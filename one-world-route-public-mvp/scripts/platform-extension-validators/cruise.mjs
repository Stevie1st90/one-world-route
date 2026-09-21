import {getPlatformExtension,registerPlatformExtensionValidator} from './registry.mjs';

export function validateCruiseExtension(ctx){
  const {item,trip,segs,stopById,fail}=ctx;
  const cruise=getPlatformExtension(trip,'cruise');
  if(!cruise)return;

  const embark=cruise.embarkationStopId?stopById.get(cruise.embarkationStopId):null;
  const disembark=cruise.disembarkationStopId?stopById.get(cruise.disembarkationStopId):null;
  if(cruise.embarkationStopId&&!embark)fail(item.id+': cruise embarkation stop is missing');
  if(cruise.disembarkationStopId&&!disembark)fail(item.id+': cruise disembarkation stop is missing');
  if(embark&&disembark&&Number(embark.sequence)>Number(disembark.sequence))fail(item.id+': cruise embarkation must precede disembarkation');

  const cruiseSegments=segs.filter(s=>s.transport?.mode==='cruise'||getPlatformExtension(s,'cruise'));
  for(const s of cruiseSegments){
    if(s.transport?.mode!=='cruise')fail(item.id+': segment '+s.id+' with cruise extension must use cruise mode');
    const meta=getPlatformExtension(s,'cruise');
    if(!meta)fail(item.id+': cruise segment '+s.id+' requires cruise extension metadata');
    if(cruise.bookingState==='illustrative-template'&&meta?.serviceStatus!=='illustrative')fail(item.id+': unselected cruise segment '+s.id+' must remain illustrative');
  }
  const onboardNights=cruiseSegments.reduce((n,s)=>n+Number(getPlatformExtension(s,'cruise')?.onboardNights||0),0);
  const seaDayNumbers=cruiseSegments.flatMap(s=>getPlatformExtension(s,'cruise')?.seaDayNumbers||[]);
  if(cruise.nights!=null&&onboardNights!==Number(cruise.nights))fail(item.id+': cruise onboard night total mismatch');
  if(new Set(seaDayNumbers).size!==seaDayNumbers.length)fail(item.id+': duplicate cruise sea day');
  if(cruise.seaDays!=null&&seaDayNumbers.length!==Number(cruise.seaDays))fail(item.id+': cruise sea day total mismatch');
}

registerPlatformExtensionValidator('cruise',validateCruiseExtension);
