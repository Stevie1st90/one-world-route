const localizedValue=(value,lang='en')=>{
  if(value===null||value===undefined)return '';
  if(typeof value==='string'||typeof value==='number')return value;
  return value?.[lang]??value?.en??Object.values(value)[0]??'';
};

const latest=values=>values.filter(Boolean).sort().at(-1)||null;

export function buildTripIndex(catalog,datasets){
  return {
    schemaVersion:1,
    catalogUpdatedAt:catalog.updatedAt||null,
    trips:(catalog.trips||[]).map(meta=>{
      const trip=datasets.get(meta.id)||{};
      const places=new Map((trip.places||[]).map(place=>[place.id,place]));
      const itinerary=(trip.stops||[]).map(stop=>{
        const place=places.get(stop.placeId)||{};
        return {
          id:stop.id,
          sequence:stop.sequence,
          dayStart:stop.dayStart,
          dayEnd:stop.dayEnd,
          nights:stop.nights,
          name:place.name||'',
          countryCode:place.countryCode||null,
          type:place.type||null
        };
      });
      const segments=trip.segments||[];
      const sources=trip.sources||[];
      const stopById=new Map((trip.stops||[]).map(stop=>[stop.id,stop]));
      const preview=meta.renderer==='regional-globe'?{
        points:(trip.places||[]).filter(place=>Number.isFinite(Number(place.coordinates?.lat))&&Number.isFinite(Number(place.coordinates?.lng))).map(place=>({
          id:place.id,
          name:place.name||'',
          lat:Number(place.coordinates.lat),
          lng:Number(place.coordinates.lng)
        })),
        arcs:segments.map(segment=>{
          const fromStop=stopById.get(segment.fromStopId),toStop=stopById.get(segment.toStopId);
          const from=places.get(fromStop?.placeId)||{},to=places.get(toStop?.placeId)||{};
          if(!Number.isFinite(Number(from.coordinates?.lat))||!Number.isFinite(Number(from.coordinates?.lng))||!Number.isFinite(Number(to.coordinates?.lat))||!Number.isFinite(Number(to.coordinates?.lng)))return null;
          return {
            id:segment.id,
            fromName:from.name||'',
            toName:to.name||'',
            start:{lat:Number(from.coordinates.lat),lng:Number(from.coordinates.lng)},
            end:{lat:Number(to.coordinates.lat),lng:Number(to.coordinates.lng)}
          };
        }).filter(Boolean)
      }:null;
      const sourcedSegments=segments.filter(segment=>
        Boolean(segment.source)||(segment.verification?.sourceIds||[]).length>0
      ).length;
      const verifiedSegments=segments.filter(segment=>
        Boolean(segment.lastVerified)||segment.verification?.status==='verified'
      ).length;
      const latestEvidenceCheck=latest([
        ...segments.map(segment=>segment.lastVerified),
        ...sources.map(source=>source.checkedAt)
      ]);
      const rawKnownMinimum=trip.planning?.knownPublishedMinimumEur;
      const knownMinimum=rawKnownMinimum!==null&&rawKnownMinimum!==undefined&&Number.isFinite(Number(rawKnownMinimum))
        ?Number(rawKnownMinimum)
        :null;
      return {
        id:meta.id,
        slug:meta.slug,
        kind:meta.kind,
        status:meta.status,
        renderer:meta.renderer,
        title:meta.title,
        subtitle:meta.subtitle,
        summary:trip.summary||meta.subtitle,
        metrics:meta.metrics||{},
        defaultPlanningScenario:meta.defaultPlanningScenario||null,
        visual:meta.visual||{},
        discovery:meta.discovery||{},
        planning:{
          days:Number(trip.planning?.days||meta.metrics?.days||0)||null,
          currency:trip.planning?.currency||meta.metrics?.budget?.currency||null,
          pace:trip.planning?.pace||meta.discovery?.fit?.pace||null,
          knownPublishedMinimumEur:knownMinimum,
          knownPublishedMinimumScope:trip.planning?.knownPublishedMinimumScope||null
        },
        itinerary,
        preview,
        evidence:{
          segments:segments.length||Number(meta.metrics?.segments||meta.metrics?.internationalLegs||0),
          sourcedSegments,
          verifiedSegments,
          latestEvidenceCheck
        },
        sources:sources.map(source=>({
          id:source.id,
          issuer:source.issuer||null,
          title:source.title||null,
          url:source.url||null,
          checkedAt:source.checkedAt||null
        })).filter(source=>source.url)
      };
    })
  };
}

export {localizedValue};
