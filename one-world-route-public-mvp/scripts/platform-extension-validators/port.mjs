import {getPlatformExtension,registerPlatformExtensionValidator} from './registry.mjs';

export function validatePortExtension(ctx){
  const {item,trip,sourceIds,fail}=ctx;
  for(const place of trip.places||[]){
    const port=getPlatformExtension(place,'port');
    for(const id of port?.sourceIds||[])if(!sourceIds.has(id))fail(item.id+': port '+place.id+' references missing source '+id);
  }
}

registerPlatformExtensionValidator('port',validatePortExtension);
