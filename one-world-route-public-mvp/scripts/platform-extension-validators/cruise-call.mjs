import {getPlatformExtension,registerPlatformExtensionValidator} from './registry.mjs';

export function validateCruiseCallExtension(ctx){
  const {item,orderedStops,fail}=ctx;
  for(const stop of orderedStops){
    const call=getPlatformExtension(stop,'cruiseCall');
    if(call&&!['embarkation','port-call','disembarkation','overnight-port-call'].includes(call.kind))fail(item.id+': invalid cruise call kind on '+stop.id);
  }
}

registerPlatformExtensionValidator('cruiseCall',validateCruiseCallExtension);
