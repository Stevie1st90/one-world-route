const legacyExtensionKeys={
  cruise:'cruise',
  roadTrip:'roadTrip',
  road:'roadContext',
  border:'borderContext',
  cruiseCall:'call',
  port:'port'
};

const extensionValidators=new Map();

export const getPlatformExtension=(node,id)=>{
  if(!node)return null;
  if(node.extensions&&Object.prototype.hasOwnProperty.call(node.extensions,id))return node.extensions[id];
  const key=legacyExtensionKeys[id];
  return key&&Object.prototype.hasOwnProperty.call(node,key)?node[key]:null;
};

export function registerPlatformExtensionValidator(id,validator){
  if(!id||typeof validator!=='function')throw new Error('Invalid platform extension validator');
  if(extensionValidators.has(id))throw new Error('Duplicate platform extension validator: '+id);
  extensionValidators.set(id,validator);
  return validator;
}

export function listPlatformExtensionValidators(){
  return [...extensionValidators.keys()];
}

registerPlatformExtensionValidator('cruise',ctx=>{
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
});

registerPlatformExtensionValidator('roadTrip',ctx=>{
  const {item,trip,segs,fail}=ctx;
  const roadTrip=getPlatformExtension(trip,'roadTrip');
  if(!roadTrip)return;

  if(roadTrip.vehicleContextRequired===true&&!trip.travellerContext?.scope?.includes('vehicle'))fail(item.id+': vehicle-aware trip traveller scope must include vehicle');
  const vehicleModes=new Set(['car','road','motorcycle']);
  const roadSegments=segs.filter(s=>vehicleModes.has(s.transport?.mode)||getPlatformExtension(s,'road'));
  if(!roadSegments.length)fail(item.id+': road-trip extension requires at least one vehicle segment');
  for(const s of roadSegments){
    const road=getPlatformExtension(s,'road');
    if(vehicleModes.has(s.transport?.mode)&&!road)fail(item.id+': vehicle segment '+s.id+' requires road extension metadata');
    if(road?.crossBorder&&roadTrip.vehicleOwnershipModes?.includes('rental')&&road.rentalApprovalRequired!==true)fail(item.id+': cross-border rental-capable segment '+s.id+' must flag rental approval');
    if(!(s.verification?.sourceIds||[]).length)fail(item.id+': vehicle segment '+s.id+' requires source evidence');
  }
});

registerPlatformExtensionValidator('border',ctx=>{
  const {item,segs,stopById,placeById,fail}=ctx;
  for(const s of segs){
    const border=getPlatformExtension(s,'border');
    if(!border)continue;
    const fromStop=stopById.get(s.fromStopId),toStop=stopById.get(s.toStopId);
    const fromCountry=placeById.get(fromStop?.placeId)?.countryCode,toCountry=placeById.get(toStop?.placeId)?.countryCode;
    if(border.fromCountry!==fromCountry||border.toCountry!==toCountry)fail(item.id+': border context mismatch on '+s.id);
    if(['schengen-exit','schengen-entry'].includes(border.zoneTransition)&&border.personalizationRequired!==true)fail(item.id+': external Schengen transition must require traveller personalization on '+s.id);
  }
});

registerPlatformExtensionValidator('cruiseCall',ctx=>{
  const {item,orderedStops,fail}=ctx;
  for(const stop of orderedStops){
    const call=getPlatformExtension(stop,'cruiseCall');
    if(call&&!['embarkation','port-call','disembarkation','overnight-port-call'].includes(call.kind))fail(item.id+': invalid cruise call kind on '+stop.id);
  }
});

registerPlatformExtensionValidator('port',ctx=>{
  const {item,trip,sourceIds,fail}=ctx;
  for(const place of trip.places||[]){
    const port=getPlatformExtension(place,'port');
    for(const id of port?.sourceIds||[])if(!sourceIds.has(id))fail(item.id+': port '+place.id+' references missing source '+id);
  }
});

export function validatePlatformExtensions(ctx){
  for(const validator of extensionValidators.values())validator(ctx);
}

export const platformExtensionCompatibility={
  legacyExtensionKeys,
  registeredValidators:listPlatformExtensionValidators
};
