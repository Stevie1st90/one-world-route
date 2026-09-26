export function inspectFlagshipTopology(route){
  const countries=route?.countries||[];
  const segments=route?.segments||[];
  const expected=countries.map(country=>country.name);
  const path=segments.length?[segments[0].from,...segments.map(segment=>segment.to)]:[];
  const unique=[...new Set(path)];
  const missing=expected.filter(name=>!unique.includes(name));
  const unexpected=unique.filter(name=>!expected.includes(name));
  const duplicates=[...new Set(path.filter((name,index)=>path.indexOf(name)!==index))];
  const adjacencyErrors=[];
  for(let i=0;i<segments.length-1;i++){
    if(segments[i].to!==segments[i+1].from){
      adjacencyErrors.push({after:Number(segments[i].id),before:Number(segments[i+1].id),to:segments[i].to,from:segments[i+1].from});
    }
  }
  const idSequenceErrors=segments
    .map((segment,index)=>Number(segment.id)!==index+1?{index:index+1,id:Number(segment.id)}:null)
    .filter(Boolean);
  const catalogOrderErrors=segments
    .map((segment,index)=>{
      const from=expected[index],to=expected[index+1];
      return segment.from===from&&segment.to===to?null:{id:Number(segment.id),expectedFrom:from,actualFrom:segment.from,expectedTo:to,actualTo:segment.to};
    })
    .filter(Boolean);
  const returnHome=route?.postTripReturn||null;
  const postTripReturnValid=Boolean(
    returnHome&&
    returnHome.countedInInternationalLegs===false&&
    returnHome.from===expected.at(-1)&&
    returnHome.to===expected[0]
  );
  return {
    expectedCountries:expected.length,
    expectedInternationalLegs:Math.max(0,expected.length-1),
    pathNodes:path.length,
    uniquePathCountries:unique.length,
    start:path[0]||null,
    end:path.at(-1)||null,
    missing,
    unexpected,
    duplicates,
    adjacencyErrors,
    idSequenceErrors,
    catalogOrderErrors,
    postTripReturn:returnHome?{
      from:returnHome.from,
      to:returnHome.to,
      countedInInternationalLegs:returnHome.countedInInternationalLegs,
      valid:postTripReturnValid,
    }:null,
    canonical:
      expected.length===195&&
      segments.length===194&&
      path.length===195&&
      unique.length===195&&
      missing.length===0&&
      unexpected.length===0&&
      duplicates.length===0&&
      adjacencyErrors.length===0&&
      idSequenceErrors.length===0&&
      catalogOrderErrors.length===0&&
      postTripReturnValid,
  };
}
