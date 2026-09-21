(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const unique=values=>[...new Set(values.filter(Boolean))].sort();
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
      starts:unique(trips.map(r=>r.discovery?.fit?.startRegion))
    };
  }
  function matches(trip,filters={},searchText=''){
    const d=trip?.discovery||{},fit=d.fit||{},q=String(filters.q||'').trim().toLowerCase();
    return (!q||String(searchText).toLowerCase().includes(q))
      &&(!filters.kind||trip.kind===filters.kind)
      &&(!filters.region||(d.regions||[]).includes(filters.region))
      &&(!filters.duration||d.durationBand===filters.duration)
      &&(!filters.mode||(d.modes||[]).includes(filters.mode))
      &&(!filters.theme||(d.themes||[]).includes(filters.theme))
      &&(!filters.pace||fit.pace===filters.pace)
      &&(!filters.season||(fit.seasons||[]).includes(filters.season))
      &&(!filters.party||(fit.party||[]).includes(filters.party))
      &&(!filters.start||fit.startRegion===filters.start);
  }
  function filter(catalog,filters={},searchTextFor=()=> ''){
    return (catalog?.trips||[]).filter(trip=>matches(trip,filters,searchTextFor(trip)));
  }
  root.discovery={facets,matches,filter};
})();
