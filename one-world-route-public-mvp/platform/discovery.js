(() => {
  'use strict';
  const host=typeof window==='undefined'?globalThis:window;
  const root=host.ONE_WORLD_PLATFORM_MODULES=host.ONE_WORLD_PLATFORM_MODULES||{};
  const unique=values=>[...new Set(values.filter(Boolean))].sort();
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  function facets(catalog){
    const trips=catalog?.trips||[];
    return {
      kinds:unique(trips.map(r=>r.kind)),
      regions:unique(trips.flatMap(r=>r.discovery?.regions||[])),
      modes:unique(trips.flatMap(r=>r.discovery?.modes||[])),
      themes:unique(trips.flatMap(r=>r.discovery?.themes||[])),
      paces:unique(trips.map(r=>r.discovery?.fit?.pace)),
      seasons:unique(trips.flatMap(r=>r.discovery?.fit?.seasons||[])),
      parties:unique(trips.flatMap(r=>r.discovery?.fit?.party||[])),
      starts:unique(trips.map(r=>r.discovery?.fit?.startRegion)),
      accessibilities:unique(trips.map(r=>r.discovery?.fit?.accessibility))
    };
  }
  function matches(trip,filters={},searchText=''){
    const d=trip?.discovery||{},fit=d.fit||{},q=normalize(filters.q).trim();
    return (!q||q.split(/\s+/).every(word=>normalize(searchText).includes(word)))
      &&(!filters.kind||trip.kind===filters.kind)
      &&(!filters.region||(d.regions||[]).includes(filters.region))
      &&(!filters.duration||d.durationBand===filters.duration)
      &&(!filters.mode||(d.modes||[]).includes(filters.mode))
      &&(!filters.theme||(d.themes||[]).includes(filters.theme))
      &&(!filters.pace||fit.pace===filters.pace)
      &&(!filters.season||(fit.seasons||[]).includes(filters.season))
      &&(!filters.party||(fit.party||[]).includes(filters.party))
      &&(!filters.start||fit.startRegion===filters.start)
      &&(!filters.accessibility||fit.accessibility===filters.accessibility);
  }
  function collectionMatches(trip,definition){
    const f=definition?.filters||{},d=trip?.discovery||{};
    return matches(trip,f)&&(!f.modeAny?.length||f.modeAny.some(v=>(d.modes||[]).includes(v)))
      &&(!f.themeAny?.length||f.themeAny.some(v=>(d.themes||[]).includes(v)));
  }
  function filter(catalog,filters={},searchTextFor=()=> ''){
    return (catalog?.trips||[]).filter(trip=>matches(trip,filters,searchTextFor(trip)));
  }
  root.discovery={facets,matches,filter,collectionMatches,normalize};
  if(typeof module!=='undefined')module.exports=root.discovery;
})();
