// The homepage needs searchable places and bounded globe samples, not every itinerary/source.
export const GLOBE_SAMPLE_LIMIT=12;
export function buildDiscoveryIndex(index){
  const featured=[...index.trips].filter(t=>t.preview).sort((a,b)=>Number(b.visual?.featurePriority||0)-Number(a.visual?.featurePriority||0)||a.id.localeCompare(b.id));
  const sampled=new Set(featured.slice(0,GLOBE_SAMPLE_LIMIT).map(t=>t.id));
  return {schemaVersion:1,catalogUpdatedAt:index.catalogUpdatedAt,trips:index.trips.map(t=>({
    id:t.id,countries:[...new Set(t.itinerary.map(s=>s.countryCode).filter(Boolean))],
    searchPlaces:[...new Map(t.itinerary.map(s=>[JSON.stringify(s.name),s.name])).values()],
    ...(sampled.has(t.id)?{preview:t.preview}:{})
  }))};
}
