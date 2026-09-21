import {getPlatformExtension,registerPlatformExtensionValidator} from './registry.mjs';

export function validateRoadTripExtension(ctx){
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
}

registerPlatformExtensionValidator('roadTrip',validateRoadTripExtension);
