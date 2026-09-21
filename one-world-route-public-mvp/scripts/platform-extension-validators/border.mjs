import {getPlatformExtension,registerPlatformExtensionValidator} from './registry.mjs';

export function validateBorderExtension(ctx){
  const {item,segs,stopById,placeById,fail}=ctx;
  for(const s of segs){
    const border=getPlatformExtension(s,'border');
    if(!border)continue;
    const fromStop=stopById.get(s.fromStopId),toStop=stopById.get(s.toStopId);
    const fromCountry=placeById.get(fromStop?.placeId)?.countryCode,toCountry=placeById.get(toStop?.placeId)?.countryCode;
    if(border.fromCountry!==fromCountry||border.toCountry!==toCountry)fail(item.id+': border context mismatch on '+s.id);
    if(['schengen-exit','schengen-entry'].includes(border.zoneTransition)&&border.personalizationRequired!==true)fail(item.id+': external Schengen transition must require traveller personalization on '+s.id);
  }
}

registerPlatformExtensionValidator('border',validateBorderExtension);
