import {getPlatformExtension,registerPlatformExtensionValidator} from './registry.mjs';

export function validateRailExtension(ctx){
  const {item,trip,segs,placeById,fail}=ctx;
  const rail=getPlatformExtension(trip,'rail');
  if(!rail)return;

  if(!item.discovery?.modes?.includes('rail'))fail(item.id+': rail extension requires rail discovery mode');
  if(!segs.length)fail(item.id+': rail extension requires at least one segment');

  if(rail.scope==='rail-only'){
    for(const segment of segs){
      if(segment.transport?.mode!=='rail')fail(item.id+': rail-only journey segment '+segment.id+' must use rail mode');
      const stages=segment.transport?.stages||[];
      if(!stages.length)fail(item.id+': rail-only segment '+segment.id+' requires at least one rail stage');
      for(const stage of stages){
        if(stage.mode!=='rail')fail(item.id+': rail-only segment '+segment.id+' contains non-rail stage '+stage.mode);
      }
    }
  }

  if(rail.sourcePolicy==='official-operator'){
    const sourceById=new Map((trip.sources||[]).map(source=>[source.id,source]));
    for(const segment of segs){
      const refs=[
        ...(segment.verification?.sourceIds||[]),
        ...(segment.transport?.stages||[]).flatMap(stage=>stage.sourceIds||[])
      ];
      if(!refs.length)fail(item.id+': rail segment '+segment.id+' requires operator source evidence');
      for(const id of new Set(refs)){
        const source=sourceById.get(id);
        if(source&&source.issuerType!=='official-operator')fail(item.id+': rail source '+id+' must be official-operator');
      }
    }
  }

  if(rail.timetablePolicy==='live-operator-check'){
    for(const segment of segs){
      if(segment.planning?.durationBasis==='live-timetable-required'&&!['current-check-required','verified'].includes(segment.verification?.status)){
        fail(item.id+': live-timetable rail segment '+segment.id+' requires current-check-required or verified status');
      }
    }
  }

  if(rail.crossBorder===true){
    const countries=new Set((trip.places||[]).map(place=>place.countryCode).filter(Boolean));
    if(countries.size<2)fail(item.id+': cross-border rail extension requires multiple countries');
  }
}

registerPlatformExtensionValidator('rail',validateRailExtension);
